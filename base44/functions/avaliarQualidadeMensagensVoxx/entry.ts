import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function normalizarTel(tel) {
  return (tel || '').replace(/\D/g, '');
}

Deno.serve(async (_req) => {
  try {
    const base44 = createClientFromRequest(_req);
    const sdk = base44.asServiceRole;

    let params = {};
    try { params = await _req.json(); } catch { /* defaults */ }
    const maxMensagens = params.maxMensagens || 10;

    // Buscar remetentes VOXX cadastrados
    const remetentes = await sdk.entities.WhatsappRemetenteVoxx.list('-nome', 200);
    const remetentesAtivos = remetentes.filter(r => r.ativo !== false);
    const telsCadastrados = new Set(remetentesAtivos.map(r => normalizarTel(r.telefone_normalizado)));

    // Buscar mensagens VOXX sem avaliação
    const mensagensVoxx = await sdk.entities.WhatsappMensagem.filter(
      { remetente_tipo: 'voxx' }, '-received_at', 500
    );

    // Verificar se um telefone de mensagem pertence a algum remetente cadastrado
    // (match exato ou por nome, pois o dígito 9 pode diferir)
    function ehRemetenteCadastrado(tel, nome) {
      if (telsCadastrados.has(tel)) return true;
      if (nome) {
        return remetentesAtivos.some(r => nome.toUpperCase().includes(r.nome.toUpperCase()));
      }
      return false;
    }

    // Filtrar apenas com conteúdo e de remetentes cadastrados
    const candidatas = mensagensVoxx.filter(m => {
      const tel = normalizarTel(m.remetente_telefone);
      if (!ehRemetenteCadastrado(tel, m.remetente_nome) || !m.grupo_id) return false;
      const textoAvaliavel = (m.tipo_mensagem === 'audio' && m.transcricao_audio)
        ? m.transcricao_audio
        : m.mensagem;
      return textoAvaliavel && textoAvaliavel.trim().length > 5;
    });

    // Verificar quais já têm avaliação
    const idsCandidatas = candidatas.map(m => m.id);
    const avaliacoesExistentes = await sdk.entities.WhatsappAvaliacaoMensagemVoxx.filter(
      { whatsapp_mensagem_id: { $in: idsCandidatas } }, '-created_date', 500
    );
    const idsAvaliados = new Set(avaliacoesExistentes.map(a => a.whatsapp_mensagem_id));

    // Filtrar não avaliadas, limitar
    const naoAvaliadas = candidatas.filter(m => !idsAvaliados.has(m.id)).slice(0, maxMensagens);

    if (naoAvaliadas.length === 0) {
      return Response.json({ success: true, avaliadas: 0, mensagem: 'Nenhuma mensagem pendente para avaliação.' });
    }

    let avaliadas = 0;
    for (const msg of naoAvaliadas) {
      try {
        // Buscar até 5 mensagens anteriores no mesmo grupo para contexto
        const contextoMsgs = await sdk.entities.WhatsappMensagem.filter(
          { grupo_id: msg.grupo_id },
          '-received_at',
          20
        );

        // Filtrar apenas as anteriores à mensagem atual
        const tsMsg = msg.timestamp_mensagem || msg.received_at;
        const anteriores = contextoMsgs
          .filter(m => (m.timestamp_mensagem || m.received_at) < tsMsg)
          .slice(0, 5)
          .map(m => ({
            remetente: m.remetente_tipo,
            nome: m.remetente_nome,
            texto: ((m.tipo_mensagem === 'audio' && m.transcricao_audio) ? `[Áudio]: ${m.transcricao_audio}` : (m.mensagem || '')).substring(0, 300),
            tipo: m.tipo_mensagem,
          }));

        const contextoTexto = anteriores.length > 0
          ? `\n\nContexto das últimas ${anteriores.length} mensagens anteriores no grupo "${msg.grupo_nome || 'sem nome'}":\n` +
            anteriores.map((c, i) => `${i + 1}. [${c.remetente}] ${c.nome || ''}: "${c.texto}"`).join('\n')
          : '';

        const temContexto = anteriores.length > 0;

        const textoParaAvaliar = (msg.tipo_mensagem === 'audio' && msg.transcricao_audio)
          ? msg.transcricao_audio
          : msg.mensagem;
        const tipoLabel = msg.tipo_mensagem === 'audio' ? 'mensagem de áudio (transcrição)' : 'mensagem';

        const prompt = `Avalie a qualidade desta ${tipoLabel} enviada por um atendente VOXX em um grupo de WhatsApp de cliente.

MENSAGEM A AVALIAR:
"${textoParaAvaliar}"

Remetente: ${msg.remetente_nome || 'VOXX'}
Grupo: ${msg.grupo_nome || 'sem nome'}${contextoTexto}

CRITÉRIOS DE AVALIAÇÃO (cada item de 0 a 100):
1. Clareza — A mensagem é fácil de entender?
2. Tom profissional — É cordial, segura, consultiva, respeitosa?
3. Objetividade — Vai direto ao ponto sem ser seca ou vaga?
4. Próximo passo — Apresenta ação, prazo, retorno, confirmação ou direcionamento claro?
5. Especificidade — A resposta é concreta ou genérica?
6. Valor percebido — Reforça acompanhamento, controle, estratégia ou presença da VOXX?
7. Risco de ruído — Pode gerar dúvida, insegurança, cobrança ou interpretação negativa? (0=sem risco, 100=alto risco)

Classificação final: excelente (90-100), boa (75-89), atencao (60-74), fraca (40-59), critica (0-39).

ATENÇÃO: Retorne APENAS o JSON, sem markdown, sem explicações.`;

        const resultado = await base44.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: 'object',
            properties: {
              score_qualidade: { type: 'number', description: 'Score geral 0-100' },
              classificacao: { type: 'string', enum: ['excelente', 'boa', 'atencao', 'fraca', 'critica'] },
              clareza: { type: 'number' },
              tom_profissional: { type: 'number' },
              objetividade: { type: 'number' },
              proximo_passo: { type: 'number' },
              especificidade: { type: 'number' },
              valor_percebido: { type: 'number' },
              risco_ruido: { type: 'number' },
              tem_proximo_passo: { type: 'boolean' },
              tem_prazo: { type: 'boolean' },
              tem_confirmacao: { type: 'boolean' },
              tem_encaminhamento: { type: 'boolean' },
              resposta_vaga: { type: 'boolean' },
              resposta_defensiva: { type: 'boolean' },
              resposta_muito_curta: { type: 'boolean' },
              sugestao_melhoria: { type: 'string' },
              pontos_positivos: { type: 'array', items: { type: 'string' } },
              pontos_atencao: { type: 'array', items: { type: 'string' } },
            },
          },
          model: 'automatic',
        });

        await sdk.entities.WhatsappAvaliacaoMensagemVoxx.create({
          whatsapp_mensagem_id: msg.id,
          message_id: msg.message_id || null,
          remetente_telefone: normalizarTel(msg.remetente_telefone),
          remetente_nome: msg.remetente_nome || null,
          grupo_id: msg.grupo_id || null,
          grupo_nome: msg.grupo_nome || null,
          cliente_id: msg.cliente_id || null,
          cliente_nome: msg.cliente_nome || null,
          texto_mensagem: textoParaAvaliar || null,
          timestamp_mensagem: msg.timestamp_mensagem || msg.received_at,
          score_qualidade: resultado.score_qualidade,
          classificacao: resultado.classificacao,
          clareza: resultado.clareza,
          tom_profissional: resultado.tom_profissional,
          objetividade: resultado.objetividade,
          proximo_passo: resultado.proximo_passo,
          especificidade: resultado.especificidade,
          valor_percebido: resultado.valor_percebido,
          risco_ruido: resultado.risco_ruido,
          tem_proximo_passo: resultado.tem_proximo_passo,
          tem_prazo: resultado.tem_prazo,
          tem_confirmacao: resultado.tem_confirmacao,
          tem_encaminhamento: resultado.tem_encaminhamento,
          resposta_vaga: resultado.resposta_vaga,
          resposta_defensiva: resultado.resposta_defensiva,
          resposta_muito_curta: resultado.resposta_muito_curta,
          contexto_limitado: !temContexto,
          sugestao_melhoria: resultado.sugestao_melhoria || null,
          pontos_positivos: resultado.pontos_positivos || [],
          pontos_atencao: resultado.pontos_atencao || [],
          contexto_utilizado: temContexto ? `Contexto com ${anteriores.length} mensagens anteriores` : 'Sem contexto suficiente',
          avaliado_por: 'sistema',
          avaliado_em: new Date().toISOString(),
        });

        avaliadas++;
      } catch (e) {
        // Continua com a próxima
        console.error('Erro ao avaliar mensagem:', msg.id, e.message);
      }
    }

    return Response.json({
      success: true,
      avaliadas,
      total_candidatas: naoAvaliadas.length + idsAvaliados.size,
      mensagem: `${avaliadas} mensagem(ns) avaliada(s) com sucesso.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});