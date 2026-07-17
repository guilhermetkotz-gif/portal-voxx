import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── Validar permissão: somente colaboradores VOXX ou admin da plataforma ──
    // Estrutura utilizada: user.tipo_usuario / user.tipo_acesso (mesmo padrão do Layout.jsx e auth.jsx)
    const tipoUsuario = user.tipo_usuario || user.tipo_acesso;
    const isVoxxUser = tipoUsuario === 'voxx_admin' || tipoUsuario === 'voxx_operacao' || tipoUsuario === 'voxx_manager' || tipoUsuario === 'voxx_financeiro';
    const isPlatformAdmin = user.role === 'admin';

    if (!isVoxxUser && !isPlatformAdmin) {
      return Response.json({ error: 'Acesso negado. O Copilot está disponível apenas para colaboradores da VOXX.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      chatId,
      clienteId,
      clienteNome,
      chatName,
      textoExistente = '',
      acao = 'gerar',
      respondendoTexto = '',
      respondendoRemetente = '',
    } = body;

    if (!chatId) return Response.json({ error: 'chatId é obrigatório' }, { status: 400 });

    const sdk = base44.asServiceRole;

    // ── Buscar mensagens recentes da conversa ──────────────────
    let mensagens = [];
    try {
      const msgs = await sdk.entities.WhatsappMensagem.filter(
        { grupo_id: chatId },
        '-received_at',
        40
      );
      mensagens = msgs || [];
    } catch (e) {
      return Response.json({ error: 'Erro ao buscar mensagens da conversa' }, { status: 500 });
    }

    if (mensagens.length === 0) {
      return Response.json({ error: 'Não há mensagens nesta conversa para analisar.' }, { status: 400 });
    }

    // ── Filtrar e limpar mensagens ─────────────────────────────
    const TIPOS_IGNORAR = ['sistema', 'atividade', 'sem_conteudo', 'reacao'];
    const mensagensUteis = mensagens
      .filter(m => !m.deletado)
      .filter(m => !TIPOS_IGNORAR.includes(m.tipo_mensagem))
      .slice(0, 25) // Últimas 25 mensagens úteis
      .reverse(); // Ordem cronológica (mais antiga primeiro)

    if (mensagensUteis.length === 0) {
      return Response.json({ error: 'Não há mensagens com conteúdo útil nesta conversa.' }, { status: 400 });
    }

    // ── Buscar dados do cliente ────────────────────────────────
    let cliente = null;
    if (clienteId) {
      try {
        cliente = await sdk.entities.Cliente.get(clienteId);
      } catch (_) { /* ignora se não encontrar */ }
    }

    // ── Montar contexto do cliente ────────────────────────────
    const contextoCliente = cliente ? [
      `Nome: ${cliente.nome || clienteNome || 'Não informado'}`,
      `Cidade: ${cliente.cidade || 'Não informada'}`,
      `Estado: ${cliente.estado || ''}`,
      `Segmento: ${cliente.tipo_cliente === 'oral_sin' ? 'Odontologia (Oral Sin)' : cliente.tipo_cliente || 'Não informado'}`,
      `Plano de serviço: ${cliente.plano_servico || 'Não informado'}`,
      `Responsável CS: ${cliente.responsavel_voxx_cs || 'Não informado'}`,
      `Responsável Tráfego: ${cliente.responsavel_voxx_trafego || 'Não informado'}`,
      cliente.briefing ? `Briefing: ${cliente.briefing}` : null,
      cliente.restrictions ? `Restrições: ${cliente.restrictions}` : null,
      cliente.procedimentos_foco ? `Procedimentos foco: ${cliente.procedimentos_foco}` : null,
      cliente.publico_alvo ? `Público-alvo: ${cliente.publico_alvo}` : null,
    ].filter(Boolean).join('\n') : `Nome: ${clienteNome || 'Não informado'}`;

    // ── Montar histórico da conversa ─────────────────────────
    const historico = mensagensUteis.map(m => {
      const ts = m.received_at || m.timestamp_mensagem;
      const horario = ts ? new Date(ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
      const isVoxx = m.remetente_tipo === 'voxx' || m.origem === 'enviada' || m.from_me;
      const autor = isVoxx ? 'VOXX' : 'Cliente';
      const nome = m.remetente_nome || 'Desconhecido';
      let texto = '';

      if (m.tipo_mensagem === 'audio') {
        texto = m.transcricao_audio
          ? `[Áudio transcrito]: ${m.transcricao_audio}`
          : '[Áudio sem transcrição]';
      } else if (m.tipo_mensagem === 'imagem') {
        texto = m.mensagem && m.mensagem.trim() && !m.mensagem.startsWith('[Mídia')
          ? `[Imagem com legenda]: ${m.mensagem}`
          : '[Imagem sem legenda]';
      } else if (m.tipo_mensagem === 'video') {
        texto = m.mensagem && m.mensagem.trim() && !m.mensagem.startsWith('[Mídia')
          ? `[Vídeo com legenda]: ${m.mensagem}`
          : '[Vídeo sem legenda]';
      } else if (m.tipo_mensagem === 'documento') {
        texto = `[Documento: ${m.midia_nome || 'sem nome'}]`;
      } else if (m.tipo_mensagem === 'sticker') {
        texto = '[Figurinha]';
      } else {
        // texto
        texto = (m.mensagem || '').replace(/\n*— [^\n]+ \| Voxx\n*$/, '').trim();
        if (!texto) texto = '[Sem conteúdo textual]';
      }

      // Limitar tamanho de cada mensagem
      if (texto.length > 500) texto = texto.substring(0, 500) + '...';

      return `[${horario}] [${autor}] ${nome}: ${texto}`;
    }).join('\n');

    // ── Contexto de resposta (mensagem sendo respondida) ──────
    const contextoResposta = respondendoTexto
      ? `\n## MENSAGEM SENDO RESPONDIDA\nO colaborador está respondendo a esta mensagem de ${respondendoRemetente || 'um participante'}:\n"${respondendoTexto.substring(0, 300)}"\n`
      : '';

    // ── Contexto de melhoria de texto ─────────────────────────
    const contextoMelhoria = (acao === 'melhorar' && textoExistente)
      ? `\n## TEXTO A MELHORAR\nO colaborador já escreveu o seguinte texto. Aprore-o sem alterar informações factuais, mantendo o sentido original:\n"${textoExistente}"\n`
      : '';

    // ── Prompt principal ──────────────────────────────────────
    const prompt = `Você é o Copilot de atendimento da VOXX Marketing dentro do Radar WhatsApp.

Sua função é gerar uma sugestão de resposta para que um colaborador da VOXX revise, edite e envie ao cliente.

## DIRETRIZES DA VOXX

- Utilize português do Brasil.
- Mantenha uma comunicação natural, humana e profissional, sem formalidade excessiva.
- Fale de pessoa para pessoa.
- Não utilize linguagem robótica, seca ou excessivamente objetiva.
- Não crie mensagens muito longas. A maioria das respostas deve ter entre 40 e 100 palavras, em no máximo três parágrafos curtos.
- Responda diretamente ao assunto apresentado pelo cliente.
- Demonstre que a solicitação foi compreendida.
- Explique somente o necessário para evitar dúvidas.
- Apresente o próximo passo quando houver.
- Utilize parágrafos curtos.
- Evite listas quando uma mensagem simples for suficiente.
- Evite jargões técnicos desnecessários. Quando precisar usar, explique de forma simples.
- Não utilize emojis por padrão. No máximo um emoji se combinar com o estilo da conversa.
- Não repita saudações em conversas que já estão em andamento.
- NÃO inclua assinatura, nome do colaborador ou " | Voxx" no texto. A assinatura é adicionada automaticamente pelo sistema.
- NÃO mencione que a resposta foi criada por inteligência artificial.

## REGRAS DE CONFIABILIDADE

- Utilize SOMENTE informações presentes no contexto recebido.
- NÃO invente dados, métricas, campanhas, tarefas, decisões, prazos ou promessas.
- NÃO afirme que algo foi feito sem confirmação no histórico.
- NÃO confirme alterações de orçamento, contrato, campanha ou escopo sem evidência.
- Quando informações essenciais estiverem ausentes, gere uma resposta segura informando que a situação será verificada ou solicitando apenas o dado necessário.
- Não pergunte novamente informações que já estejam presentes no histórico da conversa.
- Não revele informações internas da VOXX ou de outros clientes.

## SITUAÇÕES SENSÍVEIS

Marque necessidade_revisao como true quando a conversa envolver:
- Cobrança, contrato, cancelamento, valores, alteração de investimento ou gasto indevido
- Reclamação grave, conflito, ameaça jurídica ou forte insatisfação
- Dados pessoais ou sensíveis
- Erro assumido pela agência
- Prazo crítico
- Mudança relevante de estratégia
- Informações insuficientes para uma resposta segura

Nestas situações, a resposta deve ser cuidadosa e o alerta_risco deve explicar o motivo.

## CONTEXTO DO CLIENTE

${contextoCliente}

## HISTÓRICO DA CONVERSA

${historico}
${contextoResposta}${contextoMelhoria}
## INSTRUÇÃO

Analise conjuntamente:
- A última solicitação do cliente
- As mensagens consecutivas que complementam a solicitação (trate mensagens consecutivas do cliente como partes de uma mesma solicitação)
- O histórico recente da conversa
- O perfil e as particularidades do cliente
- As orientações relevantes

Produza uma resposta humana, clara, segura e útil. A mensagem deve parecer escrita por um colaborador da VOXX conversando diretamente com o cliente.

Retorne APENAS o JSON no formato especificado. Não inclua markdown, explicações ou texto adicional.`;

    // ── Invocar LLM ───────────────────────────────────────────
    let resultado;
    try {
      resultado = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            mensagem_sugerida: { type: 'string', description: 'Texto sugerido para o colaborador enviar ao cliente. Sem assinatura.' },
            assunto_identificado: { type: 'string', description: 'Assunto principal identificado na solicitação do cliente' },
            necessidade_revisao: { type: 'boolean', description: 'Se a resposta exige revisão humana obrigatória' },
            alerta_risco: { type: 'string', description: 'Motivo do risco ou alerta, quando aplicável. Vazio se não houver.' },
            informacoes_ausentes: { type: 'string', description: 'Informações essenciais que estão faltando, quando aplicável. Vazio se não houver.' },
          },
          required: ['mensagem_sugerida', 'assunto_identificado', 'necessidade_revisao'],
        },
        model: 'automatic',
      });
    } catch (e) {
      return Response.json({ error: 'Erro ao processar a análise. Tente novamente.' }, { status: 500 });
    }

    // ── Validar resposta ──────────────────────────────────────
    if (!resultado || !resultado.mensagem_sugerida || !resultado.mensagem_sugerida.trim()) {
      return Response.json({ error: 'A IA não retornou uma sugestão válida. Tente novamente.' }, { status: 500 });
    }

    // Remover possível assinatura se a IA incluiu por engano
    let sugestaoLimpa = resultado.mensagem_sugerida
      .replace(/\n*— [^\n]+\| Voxx\n*$/i, '')
      .replace(/^\s*[^\n]+\| Voxx\s*\n+/i, '')
      .trim();

    return Response.json({
      mensagem_sugerida: sugestaoLimpa,
      assunto_identificado: resultado.assunto_identificado || 'Não identificado',
      necessidade_revisao: !!resultado.necessidade_revisao,
      alerta_risco: resultado.alerta_risco || '',
      informacoes_ausentes: resultado.informacoes_ausentes || '',
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
});