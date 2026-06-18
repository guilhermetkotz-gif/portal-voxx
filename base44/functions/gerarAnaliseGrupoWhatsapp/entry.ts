import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TZ_OFFSET = -3; // America/Sao_Paulo (UTC-3)

function toBrasilia(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const br = new Date(utc + TZ_OFFSET * 3600000);
  return br.toLocaleString('pt-BR');
}

function calcularScore(stats) {
  // Atendimento VOXX (35%)
  let atendimento = 70; // base neutra
  if (stats.totalCliente > 0) {
    const taxaResposta = stats.totalVoxx / Math.max(stats.totalCliente, 1);
    if (taxaResposta >= 0.8) atendimento = 90;
    else if (taxaResposta >= 0.5) atendimento = 70;
    else if (taxaResposta >= 0.3) atendimento = 50;
    else atendimento = 30;
  }
  if (stats.minutosSemResposta >= 120) atendimento -= 30;
  else if (stats.minutosSemResposta >= 60) atendimento -= 20;
  else if (stats.minutosSemResposta >= 30) atendimento -= 10;

  // Relacionamento (25%)
  let relacionamento = 60;
  const climaMap = { positivo: 95, neutro: 70, ansioso: 50, insatisfeito: 35, critico: 15, sem_dados: 60 };
  const pressaoMap = { baixa: 95, media: 70, alta: 45, critica: 20 };
  relacionamento = Math.round((climaMap[stats.clima] || 60) * 0.6 + (pressaoMap[stats.pressao] || 70) * 0.4);

  // Operação (25%)
  let operacao = 70;
  if (stats.solicitacoesSemResposta > 5) operacao = 30;
  else if (stats.solicitacoesSemResposta > 2) operacao = 50;
  else if (stats.solicitacoesSemResposta > 0) operacao = 65;

  // Tempo & Fluxo (15%)
  let tempoFluxo = 60;
  if (stats.totalMensagens > 50) tempoFluxo = 85;
  else if (stats.totalMensagens > 20) tempoFluxo = 70;
  else if (stats.totalMensagens > 5) tempoFluxo = 55;
  else tempoFluxo = 35;

  const geral = Math.round(
    atendimento * 0.35 +
    relacionamento * 0.25 +
    operacao * 0.25 +
    tempoFluxo * 0.15
  );

  return {
    geral: Math.min(100, Math.max(0, geral)),
    atendimento: Math.min(100, Math.max(0, atendimento)),
    relacionamento: Math.min(100, Math.max(0, relacionamento)),
    operacao: Math.min(100, Math.max(0, operacao)),
    tempoFluxo: Math.min(100, Math.max(0, tempoFluxo)),
  };
}

function statusFromScore(score) {
  if (score >= 90) return 'excelente';
  if (score >= 75) return 'saudavel';
  if (score >= 60) return 'atencao';
  if (score >= 40) return 'critico';
  return 'emergencial';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { grupo_id, periodo_dias = 7 } = body;

    if (!grupo_id) return Response.json({ error: 'grupo_id é obrigatório' }, { status: 400 });

    // Buscar grupo
    const grupos = await base44.asServiceRole.entities.WhatsappGrupo.filter({ grupo_id });
    if (!grupos.length) return Response.json({ error: 'Grupo não encontrado' }, { status: 404 });
    const grupo = grupos[0];

    // Período de análise
    const agora = new Date();
    const inicio = new Date(agora.getTime() - periodo_dias * 24 * 3600 * 1000);
    const inicioAnterior = new Date(inicio.getTime() - periodo_dias * 24 * 3600 * 1000);

    // Buscar mensagens do período
    const todasMensagens = await base44.asServiceRole.entities.WhatsappMensagem.filter({ grupo_id }, '-received_at', 500);

    const mensagens = todasMensagens.filter(m => {
      const ts = m.received_at || m.timestamp_mensagem;
      return ts >= inicio.toISOString();
    });

    const mensagensAnteriores = todasMensagens.filter(m => {
      const ts = m.received_at || m.timestamp_mensagem;
      return ts >= inicioAnterior.toISOString() && ts < inicio.toISOString();
    });

    if (mensagens.length < 3) {
      return Response.json({
        ok: false,
        motivo: 'sem_mensagens',
        mensagem: 'Mensagens insuficientes para análise confiável (mínimo 3).',
      });
    }

    const ignorarTipos = ['sistema', 'atividade', 'sem_conteudo'];
    const msgsValidas = mensagens.filter(m => !ignorarTipos.includes(m.tipo_mensagem));

    const msgsVoxx    = msgsValidas.filter(m => m.remetente_tipo === 'voxx'    || m.from_me === true);
    const msgsCliente = msgsValidas.filter(m => m.remetente_tipo === 'cliente' || (m.origem === 'recebida' && !m.from_me));
    const msgsDesconhecidas = msgsValidas.filter(m => m.remetente_tipo === 'desconhecido' && !m.from_me);
    const msgsSistema = mensagens.filter(m => ignorarTipos.includes(m.tipo_mensagem));

    const sorted = [...msgsValidas].sort((a, b) => (a.received_at || '') > (b.received_at || '') ? 1 : -1);
    const primeiraMsg = sorted[0];
    const ultimaGeral = sorted[sorted.length - 1];

    const ultimaVoxx    = [...msgsVoxx].sort((a, b) => (b.received_at || '') > (a.received_at || '') ? 1 : -1)[0];
    const ultimaCliente = [...msgsCliente].sort((a, b) => (b.received_at || '') > (a.received_at || '') ? 1 : -1)[0];

    // Tempo sem resposta (simplificado em minutos corridos para o LLM)
    let minutosSemResposta = 0;
    if (ultimaCliente) {
      const tsCliente = ultimaCliente.received_at;
      const tsVoxx    = ultimaVoxx?.received_at;
      if (!tsVoxx || tsCliente > tsVoxx) {
        minutosSemResposta = Math.round((agora.getTime() - new Date(tsCliente).getTime()) / 60000);
      }
    }

    // Tendência (comparar volume)
    let tendencia = 'sem_dados';
    if (mensagensAnteriores.length > 0) {
      const ratioCliente = msgsCliente.length / Math.max(
        mensagensAnteriores.filter(m => m.remetente_tipo === 'cliente' || m.origem === 'recebida').length, 1
      );
      if (ratioCliente > 1.2) tendencia = 'melhorando';
      else if (ratioCliente < 0.8) tendencia = 'piorando';
      else tendencia = 'estavel';
    }

    // Montar contexto para o LLM
    const amostras = msgsValidas
      .sort((a, b) => (b.received_at || '') > (a.received_at || '') ? 1 : -1)
      .slice(0, 60)
      .map(m => {
        const tipo = m.from_me || m.remetente_tipo === 'voxx' ? 'VOXX' : m.remetente_tipo === 'cliente' ? 'CLIENTE' : 'DESCONHECIDO';
        const ts = toBrasilia(m.received_at || m.timestamp_mensagem) || '';
        const textoMsg = (m.tipo_mensagem === 'audio' && m.transcricao_audio)
          ? `[Áudio transcrito]: ${m.transcricao_audio}`
          : (m.mensagem || '');
        return `[${ts}] ${tipo} (${m.remetente_nome || ''}): ${textoMsg}`;
      })
      .join('\n');

    const stats = {
      totalMensagens: msgsValidas.length,
      totalVoxx: msgsVoxx.length,
      totalCliente: msgsCliente.length,
      totalDesconhecidas: msgsDesconhecidas.length,
      totalSistema: msgsSistema.length,
      minutosSemResposta,
      clima: 'neutro',
      pressao: 'media',
      solicitacoesSemResposta: 0,
    };

    const prompt = `Você é um analista de relacionamento com clientes da agência Voxx, especialista em comunicação e retenção.

Analise as mensagens do grupo de WhatsApp abaixo e retorne uma análise estruturada em JSON.

GRUPO: ${grupo.nome_grupo}
CLIENTE: ${grupo.cliente_nome || 'Não vinculado'}
PERÍODO: últimos ${periodo_dias} dias (${toBrasilia(inicio.toISOString())} até agora)

ESTATÍSTICAS:
- Total de mensagens válidas: ${msgsValidas.length}
- Mensagens VOXX: ${msgsVoxx.length}
- Mensagens CLIENTE: ${msgsCliente.length}
- Mensagens desconhecidas: ${msgsDesconhecidas.length}
- Minutos sem resposta VOXX: ${minutosSemResposta}
- Tendência de volume: ${tendencia}

MENSAGENS RECENTES (mais recentes primeiro):
${amostras || 'Nenhuma mensagem disponível.'}

INSTRUÇÕES:
- Analise APENAS as mensagens fornecidas. Não invente fatos.
- Se não houver evidência clara, use "Não identificado no período".
- Base a análise em padrões reais das mensagens.
- Seja direto e objetivo. Use linguagem de gestão executiva.
- clima_emocional: positivo, neutro, ansioso, insatisfeito, critico, sem_dados
- risco_churn: baixo, moderado, alto, critico
- pressao_cliente: baixa, media, alta, critica
- Identifique solicitações do cliente que ficaram sem resposta clara.

Retorne APENAS o JSON, sem markdown:`;

    const resultado = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          clima_emocional: { type: 'string' },
          risco_churn: { type: 'string' },
          pressao_cliente: { type: 'string' },
          resumo_executivo: { type: 'string' },
          pontos_positivos: { type: 'array', items: { type: 'string' } },
          pontos_atencao: { type: 'array', items: { type: 'string' } },
          alertas: { type: 'array', items: { type: 'string' } },
          solicitacoes_sem_conclusao: { type: 'array', items: { type: 'string' } },
          principal_risco: { type: 'string' },
          prioridade_semana: { type: 'string' },
          recomendacoes_voxx: { type: 'array', items: { type: 'string' } },
          solicitacoes_sem_resposta_count: { type: 'number' },
        }
      }
    });

    // Atualizar stats com resultado IA
    stats.clima = resultado.clima_emocional || 'neutro';
    stats.pressao = resultado.pressao_cliente || 'media';
    stats.solicitacoesSemResposta = resultado.solicitacoes_sem_resposta_count || 0;

    const scores = calcularScore(stats);
    const status = statusFromScore(scores.geral);

    const base_analisada = {
      periodo_dias,
      total_mensagens: mensagens.length,
      mensagens_validas: msgsValidas.length,
      mensagens_voxx: msgsVoxx.length,
      mensagens_cliente: msgsCliente.length,
      mensagens_desconhecidas: msgsDesconhecidas.length,
      mensagens_sistema: msgsSistema.length,
      primeira_mensagem: primeiraMsg ? toBrasilia(primeiraMsg.received_at) : null,
      ultima_mensagem: ultimaGeral ? toBrasilia(ultimaGeral.received_at) : null,
      ultima_mensagem_voxx: ultimaVoxx ? toBrasilia(ultimaVoxx.received_at) : null,
      ultima_mensagem_cliente: ultimaCliente ? toBrasilia(ultimaCliente.received_at) : null,
    };

    const analise = await base44.asServiceRole.entities.WhatsappAnaliseGrupo.create({
      grupo_id: grupo.grupo_id,
      grupo_nome: grupo.nome_grupo,
      cliente_id: grupo.cliente_id || null,
      cliente_nome: grupo.cliente_nome || null,
      periodo_inicio: inicio.toISOString(),
      periodo_fim: agora.toISOString(),
      periodo_label: `Últimos ${periodo_dias} dias`,
      score_geral: scores.geral,
      score_atendimento: scores.atendimento,
      score_relacionamento: scores.relacionamento,
      score_operacao: scores.operacao,
      score_tempo_fluxo: scores.tempoFluxo,
      status,
      risco_churn: resultado.risco_churn || 'moderado',
      clima_emocional: resultado.clima_emocional || 'neutro',
      tendencia,
      pressao_cliente: resultado.pressao_cliente || 'media',
      resumo_executivo: resultado.resumo_executivo || '',
      pontos_positivos: resultado.pontos_positivos || [],
      pontos_atencao: resultado.pontos_atencao || [],
      alertas: resultado.alertas || [],
      solicitacoes_sem_conclusao: resultado.solicitacoes_sem_conclusao || [],
      principal_risco: resultado.principal_risco || '',
      prioridade_semana: resultado.prioridade_semana || '',
      recomendacoes_voxx: resultado.recomendacoes_voxx || [],
      base_analisada,
      mensagens_utilizadas: msgsValidas.length,
      gerado_por: user.email,
      gerado_por_nome: user.full_name || user.email,
    });

    return Response.json({ ok: true, analise_id: analise.id, scores, status });

  } catch (error) {
    console.error('[gerarAnaliseGrupoWhatsapp] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});