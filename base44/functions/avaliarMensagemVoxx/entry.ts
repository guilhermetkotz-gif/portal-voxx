import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TIPOS_SEM_CONTEUDO = ['sistema', 'atividade', 'sem_conteudo', 'audio', 'video', 'sticker'];

const PROMPT_SISTEMA = `Você é um auditor de qualidade de comunicação de uma agência de marketing digital chamada VOXX.
Sua função é avaliar mensagens enviadas pela equipe VOXX para clientes via WhatsApp.

PADRÃO ESPERADO DA VOXX:
- Clareza e objetividade
- Tom profissional, cordial e consultivo
- Especificidade: respostas concretas, não genéricas
- Resolução: próximo passo, prazo ou posicionamento claro
- Valor percebido: demonstrar acompanhamento, controle e expertise
- Ausência de risco de ruído: sem mensagens que gerem dúvida, insegurança ou interpretação negativa
- Padrão VOXX: sem respostas secas, sem excesso de informalidade, sem promessas sem garantia

CRITÉRIOS DE AVALIAÇÃO (score de 0 a 10 cada):
1. clareza: A mensagem é fácil de entender?
2. tom: Tom profissional, cordial, consultivo e respeitoso?
3. especificidade: Mensagem concreta e específica (não genérica)?
4. resolucao: Encaminha solução, prazo, próximo passo ou posicionamento?
5. valor_percebido: Reforça presença, estratégia ou controle da VOXX?
6. risco_ruido: INVERSO — quanto maior, mais risco. 0=sem risco, 10=alto risco
7. padrao_voxx: Alinhado ao padrão geral esperado da agência?

SCORE GERAL (0-100):
Calcule como média ponderada:
- clareza: 15%
- tom: 15%
- especificidade: 20%
- resolucao: 20%
- valor_percebido: 15%
- risco_ruido: -10% (penalidade proporcional ao risco)
- padrao_voxx: 15%

IMPORTANTE: mensagens curtas como "ok", "vou ver", "feito" sem contexto devem receber score baixo.
Seja crítico mas objetivo. Não invente contexto. Se não houver contexto suficiente, informe contexto_limitado: true.

Retorne APENAS JSON válido, sem markdown, sem comentários.`;

function classificarScore(score) {
  if (score >= 90) return 'excelente';
  if (score >= 75) return 'boa';
  if (score >= 60) return 'atencao';
  if (score >= 40) return 'fraca';
  return 'critica';
}

function temConteudoTextual(msg) {
  if (!msg.mensagem || msg.mensagem.trim().length === 0) return false;
  if (TIPOS_SEM_CONTEUDO.includes(msg.tipo_mensagem)) return false;
  // imagem/vídeo/documento sem legenda
  const conteudo = msg.mensagem.trim().toLowerCase();
  if (['[imagem]', '[vídeo]', '[video]', '[documento]', '[áudio]', '[audio]', '[sticker]', '[apagada]'].includes(conteudo)) return false;
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // ── MODO LOTE MANUAL (botão da tela) ──────────────────────────
    if (body.modo_lote) {
      // Requer autenticação para modo lote manual
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      const limite = Math.min(body.filtro?.limite || 10, 10); // max 10 por vez
      const query = { remetente_tipo: 'voxx' };

      // Buscar mensagens candidatas
      const mensagens = await base44.asServiceRole.entities.WhatsappMensagem.filter(
        query, '-received_at', 100
      );

      // Filtrar apenas com conteúdo textual
      const validas = mensagens.filter(m => temConteudoTextual(m));

      // Verificar quais ainda não têm avaliação concluída
      const avaliacoes = await base44.asServiceRole.entities.WhatsappAvaliacaoMensagemVoxx.filter(
        {}, '-created_date', 500
      );
      const idsConcluidos = new Set(
        avaliacoes
          .filter(a => a.status_avaliacao === 'concluida')
          .map(a => a.mensagem_id)
      );

      const pendentes = validas.filter(m => !idsConcluidos.has(m.id)).slice(0, limite);

      const resultados = [];
      for (const msg of pendentes) {
        const r = await processarAvaliacao(base44, msg.id, false);
        resultados.push({ mensagem_id: msg.id, status: r.status_avaliacao });
      }

      return Response.json({
        avaliados: resultados.filter(r => r.status === 'concluida').length,
        total_candidatos: pendentes.length,
        resultados
      });
    }

    // ── MODO INDIVIDUAL (automação ou reavaliação manual) ──────────
    const { mensagem_id, forcar_reavaliacao = false } = body;

    if (!mensagem_id) {
      return Response.json({ error: 'mensagem_id obrigatório' }, { status: 400 });
    }

    const avaliacao = await processarAvaliacao(base44, mensagem_id, forcar_reavaliacao);
    return Response.json({ avaliacao });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function processarAvaliacao(base44, mensagem_id, forcarReavaliacao) {
  // 1. Verificar se já existe avaliação concluída (idempotência)
  const existentes = await base44.asServiceRole.entities.WhatsappAvaliacaoMensagemVoxx.filter(
    { mensagem_id }, '-created_date', 1
  );
  const avaliacaoExistente = existentes[0] || null;

  if (avaliacaoExistente) {
    if (!forcarReavaliacao && avaliacaoExistente.status_avaliacao === 'concluida') {
      // Já concluída e não forçando reavaliação — retornar existente
      return avaliacaoExistente;
    }
    if (avaliacaoExistente.status_avaliacao === 'avaliando') {
      // Já está sendo avaliada — evitar concorrência
      return avaliacaoExistente;
    }
  }

  // 2. Buscar a mensagem
  const msgs = await base44.asServiceRole.entities.WhatsappMensagem.filter(
    { id: mensagem_id }, '-received_at', 1
  );
  if (!msgs.length) {
    throw new Error('Mensagem não encontrada: ' + mensagem_id);
  }
  const msg = msgs[0];

  // 3. Verificar se é remetente VOXX
  if (msg.remetente_tipo !== 'voxx') {
    return avaliacaoExistente || null;
  }

  // 4. Verificar conteúdo
  const possuiConteudo = temConteudoTextual(msg);

  // 5. Marcar como "avaliando" (ou criar registro pendente)
  const registroBase = {
    mensagem_id: msg.id,
    grupo_id: msg.grupo_id || '',
    grupo_nome: msg.grupo_nome || '',
    cliente_id: msg.cliente_id || '',
    cliente_nome: msg.cliente_nome || '',
    remetente_nome: msg.remetente_nome || '',
    remetente_telefone: msg.remetente_telefone || '',
    mensagem_original: msg.mensagem || '',
    data_mensagem: msg.received_at || msg.timestamp_mensagem || new Date().toISOString(),
    resolvido: avaliacaoExistente?.resolvido || false,
  };

  // 6. Sem conteúdo textual — salvar sem chamar IA
  if (!possuiConteudo) {
    const semConteudo = {
      ...registroBase,
      status_avaliacao: 'concluida',
      classificacao: 'nao_avaliada',
      score_qualidade: null,
      avaliacao_resumo: 'Sem conteúdo textual suficiente para avaliação.',
      contexto_limitado: true,
      pontos_positivos: [],
      pontos_atencao: [],
    };
    if (avaliacaoExistente) {
      return base44.asServiceRole.entities.WhatsappAvaliacaoMensagemVoxx.update(avaliacaoExistente.id, semConteudo);
    }
    return base44.asServiceRole.entities.WhatsappAvaliacaoMensagemVoxx.create(semConteudo);
  }

  // 7. Marcar como "avaliando"
  let avaliacaoAtual;
  if (avaliacaoExistente) {
    avaliacaoAtual = await base44.asServiceRole.entities.WhatsappAvaliacaoMensagemVoxx.update(
      avaliacaoExistente.id, { ...registroBase, status_avaliacao: 'avaliando' }
    );
  } else {
    avaliacaoAtual = await base44.asServiceRole.entities.WhatsappAvaliacaoMensagemVoxx.create(
      { ...registroBase, status_avaliacao: 'avaliando' }
    );
  }

  // 8. Buscar contexto (máx 5 mensagens anteriores)
  let contexto = [];
  let contextoLimitado = false;
  if (msg.grupo_id) {
    const msgsAnteriores = await base44.asServiceRole.entities.WhatsappMensagem.filter(
      { grupo_id: msg.grupo_id }, '-received_at', 10
    );
    contexto = msgsAnteriores
      .filter(m => m.id !== msg.id && m.received_at < msg.received_at)
      .slice(0, 5)
      .reverse();
    if (contexto.length === 0) contextoLimitado = true;
  } else {
    contextoLimitado = true;
  }

  const contextoTexto = contexto.length > 0
    ? contexto.map(m =>
        `[${m.remetente_tipo?.toUpperCase() || 'DESCONHECIDO'}] ${m.remetente_nome || ''}: ${m.mensagem || '(sem texto)'}`
      ).join('\n')
    : 'Sem contexto disponível.';

  const prompt = `${PROMPT_SISTEMA}

CONTEXTO (últimas mensagens do grupo antes desta):
${contextoTexto}

MENSAGEM A AVALIAR:
Remetente: ${msg.remetente_nome || 'Desconhecido'} (VOXX)
Conteúdo: "${msg.mensagem}"

Responda APENAS com este JSON:
{
  "clareza_score": <0-10>,
  "tom_score": <0-10>,
  "especificidade_score": <0-10>,
  "resolucao_score": <0-10>,
  "valor_percebido_score": <0-10>,
  "risco_ruido_score": <0-10>,
  "padrao_voxx_score": <0-10>,
  "score_qualidade": <0-100>,
  "pontos_positivos": ["..."],
  "pontos_atencao": ["..."],
  "risco_detectado": "...",
  "sugestao_melhoria": "...",
  "versao_sugerida": "...",
  "avaliacao_resumo": "...",
  "contexto_limitado": <true|false>
}`;

  // 9. Chamar IA
  let resIA;
  try {
    resIA = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          clareza_score:        { type: 'number' },
          tom_score:            { type: 'number' },
          especificidade_score: { type: 'number' },
          resolucao_score:      { type: 'number' },
          valor_percebido_score:{ type: 'number' },
          risco_ruido_score:    { type: 'number' },
          padrao_voxx_score:    { type: 'number' },
          score_qualidade:      { type: 'number' },
          pontos_positivos:     { type: 'array', items: { type: 'string' } },
          pontos_atencao:       { type: 'array', items: { type: 'string' } },
          risco_detectado:      { type: 'string' },
          sugestao_melhoria:    { type: 'string' },
          versao_sugerida:      { type: 'string' },
          avaliacao_resumo:     { type: 'string' },
          contexto_limitado:    { type: 'boolean' }
        }
      }
    });
  } catch (err) {
    // Rate limit ou erro da IA — marcar como erro, não tentar em loop
    await base44.asServiceRole.entities.WhatsappAvaliacaoMensagemVoxx.update(avaliacaoAtual.id, {
      status_avaliacao: 'erro',
      erro_avaliacao: err.message || 'Erro ao chamar IA',
    });
    return { ...avaliacaoAtual, status_avaliacao: 'erro', erro_avaliacao: err.message };
  }

  // 10. Salvar resultado concluído
  const score = Math.round(Math.max(0, Math.min(100, resIA.score_qualidade || 0)));

  const registroConcluido = {
    ...registroBase,
    status_avaliacao: 'concluida',
    score_qualidade: score,
    classificacao: classificarScore(score),
    clareza_score:         resIA.clareza_score || 0,
    tom_score:             resIA.tom_score || 0,
    especificidade_score:  resIA.especificidade_score || 0,
    resolucao_score:       resIA.resolucao_score || 0,
    valor_percebido_score: resIA.valor_percebido_score || 0,
    risco_ruido_score:     resIA.risco_ruido_score || 0,
    padrao_voxx_score:     resIA.padrao_voxx_score || 0,
    pontos_positivos:      resIA.pontos_positivos || [],
    pontos_atencao:        resIA.pontos_atencao || [],
    sugestao_melhoria:     resIA.sugestao_melhoria || '',
    versao_sugerida:       resIA.versao_sugerida || '',
    risco_detectado:       resIA.risco_detectado || '',
    avaliacao_resumo:      resIA.avaliacao_resumo || '',
    contexto_limitado:     resIA.contexto_limitado || contextoLimitado,
    erro_avaliacao:        '',
  };

  return base44.asServiceRole.entities.WhatsappAvaliacaoMensagemVoxx.update(
    avaliacaoAtual.id, registroConcluido
  );
}