import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { mensagem_id, forcar_reavaliacao = false, modo_lote = false, filtro = {} } = body;

    // ── MODO LOTE ──────────────────────────────────────────────
    if (modo_lote) {
      const limite = filtro.limite || 50;
      let query = { remetente_tipo: 'voxx' };
      if (filtro.grupo_id)   query.grupo_id   = filtro.grupo_id;
      if (filtro.cliente_id) query.cliente_id = filtro.cliente_id;

      // período
      const agora = new Date();
      let corte;
      if (filtro.periodo === '24h') {
        corte = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString();
      } else if (filtro.periodo === '7d') {
        corte = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      }

      const mensagens = await base44.asServiceRole.entities.WhatsappMensagem.filter(query, '-received_at', limite);

      // filtrar por período se necessário
      const mensagensFiltradas = corte
        ? mensagens.filter(m => m.received_at >= corte)
        : mensagens;

      // filtrar tipos inválidos
      const tiposIgnorados = ['sistema', 'atividade', 'sem_conteudo', 'audio', 'video', 'sticker'];
      const mensagensValidas = mensagensFiltradas.filter(m =>
        m.mensagem && m.mensagem.trim().length > 0 &&
        !tiposIgnorados.includes(m.tipo_mensagem)
      );

      // verificar quais já foram avaliadas
      let aavaliar = mensagensValidas;
      if (!forcar_reavaliacao) {
        const avaliacoesExistentes = await base44.asServiceRole.entities.WhatsappAvaliacaoMensagemVoxx.filter(
          {}, '-created_date', 500
        );
        const idsAvaliados = new Set(avaliacoesExistentes.map(a => a.mensagem_id));
        aavaliar = mensagensValidas.filter(m => !idsAvaliados.has(m.id));
      }

      if (filtro.apenas_nao_avaliadas && !forcar_reavaliacao) {
        // já filtrou acima
      }

      const resultados = [];
      for (const msg of aavaliar.slice(0, 20)) { // max 20 por vez
        const resultado = await avaliarUmaMensagem(base44, msg);
        resultados.push(resultado);
      }

      return Response.json({
        avaliados: resultados.length,
        total_candidatos: aavaliar.length,
        resultados
      });
    }

    // ── MODO INDIVIDUAL ──────────────────────────────────────────
    if (!mensagem_id) return Response.json({ error: 'mensagem_id obrigatório' }, { status: 400 });

    // Verificar se já existe avaliação
    if (!forcar_reavaliacao) {
      const existentes = await base44.asServiceRole.entities.WhatsappAvaliacaoMensagemVoxx.filter(
        { mensagem_id }, '-created_date', 1
      );
      if (existentes.length > 0) {
        return Response.json({ avaliacao: existentes[0], ja_existia: true });
      }
    }

    const msgs = await base44.asServiceRole.entities.WhatsappMensagem.filter({ id: mensagem_id }, '-received_at', 1);
    if (!msgs.length) return Response.json({ error: 'Mensagem não encontrada' }, { status: 404 });

    const avaliacao = await avaliarUmaMensagem(base44, msgs[0]);
    return Response.json({ avaliacao, ja_existia: false });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function avaliarUmaMensagem(base44, msg) {
  // buscar contexto: até 5 mensagens anteriores do mesmo grupo
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
    ? contexto.map(m => `[${m.remetente_tipo?.toUpperCase() || 'DESCONHECIDO'}] ${m.remetente_nome || ''}: ${m.mensagem || '(sem texto)'}`).join('\n')
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

  const resIA = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        clareza_score: { type: 'number' },
        tom_score: { type: 'number' },
        especificidade_score: { type: 'number' },
        resolucao_score: { type: 'number' },
        valor_percebido_score: { type: 'number' },
        risco_ruido_score: { type: 'number' },
        padrao_voxx_score: { type: 'number' },
        score_qualidade: { type: 'number' },
        pontos_positivos: { type: 'array', items: { type: 'string' } },
        pontos_atencao: { type: 'array', items: { type: 'string' } },
        risco_detectado: { type: 'string' },
        sugestao_melhoria: { type: 'string' },
        versao_sugerida: { type: 'string' },
        avaliacao_resumo: { type: 'string' },
        contexto_limitado: { type: 'boolean' }
      }
    }
  });

  const score = Math.round(Math.max(0, Math.min(100, resIA.score_qualidade || 0)));
  const classificacao = classificarScore(score);

  const registro = {
    mensagem_id: msg.id,
    grupo_id: msg.grupo_id || '',
    grupo_nome: msg.grupo_nome || '',
    cliente_id: msg.cliente_id || '',
    cliente_nome: msg.cliente_nome || '',
    remetente_nome: msg.remetente_nome || '',
    remetente_telefone: msg.remetente_telefone || '',
    mensagem_original: msg.mensagem || '',
    data_mensagem: msg.received_at || msg.timestamp_mensagem || new Date().toISOString(),
    score_qualidade: score,
    classificacao,
    clareza_score: resIA.clareza_score || 0,
    tom_score: resIA.tom_score || 0,
    especificidade_score: resIA.especificidade_score || 0,
    resolucao_score: resIA.resolucao_score || 0,
    valor_percebido_score: resIA.valor_percebido_score || 0,
    risco_ruido_score: resIA.risco_ruido_score || 0,
    padrao_voxx_score: resIA.padrao_voxx_score || 0,
    pontos_positivos: resIA.pontos_positivos || [],
    pontos_atencao: resIA.pontos_atencao || [],
    sugestao_melhoria: resIA.sugestao_melhoria || '',
    versao_sugerida: resIA.versao_sugerida || '',
    risco_detectado: resIA.risco_detectado || '',
    avaliacao_resumo: resIA.avaliacao_resumo || '',
    contexto_limitado: resIA.contexto_limitado || contextoLimitado,
    resolvido: false
  };

  // Se já existe (reavaliação), atualizar; senão criar
  const existentes = await base44.asServiceRole.entities.WhatsappAvaliacaoMensagemVoxx.filter(
    { mensagem_id: msg.id }, '-created_date', 1
  );
  
  let avaliacao;
  if (existentes.length > 0) {
    avaliacao = await base44.asServiceRole.entities.WhatsappAvaliacaoMensagemVoxx.update(existentes[0].id, registro);
  } else {
    avaliacao = await base44.asServiceRole.entities.WhatsappAvaliacaoMensagemVoxx.create(registro);
  }

  return avaliacao;
}