import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Parseia o texto exportado do WhatsApp
function parsearHistorico(texto) {
  const linhas = texto.split('\n');
  const mensagens = [];
  const participantesMap = {};

  // Regex para linha de mensagem: DD/MM/AAAA HH:MM - Remetente: conteudo
  const regexMsg = /^(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2}) - ([^:]+): (.+)$/;
  const regexSistema = /^(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2}) - (.+)$/;

  let msgAtual = null;

  for (const linha of linhas) {
    const matchMsg = linha.match(regexMsg);
    if (matchMsg) {
      if (msgAtual) mensagens.push(msgAtual);
      const [, data, hora, remetente, conteudo] = matchMsg;
      const tipo = conteudo.trim() === '<Mídia oculta>' ? 'midia' : 'texto';
      const tipoRemetente = classificarRemetente(remetente);
      msgAtual = { data, hora, remetente: remetente.trim(), tipo_remetente: tipoRemetente, conteudo: conteudo.trim(), tipo };
      participantesMap[remetente.trim()] = (participantesMap[remetente.trim()] || 0) + 1;
    } else if (msgAtual && !linha.match(regexSistema) && linha.trim()) {
      // Continuação de mensagem anterior (multi-linha)
      msgAtual.conteudo += '\n' + linha.trim();
    } else {
      if (msgAtual) mensagens.push(msgAtual);
      msgAtual = null;
      const matchSis = linha.match(regexSistema);
      if (matchSis && linha.includes(' - ') && !linha.match(regexMsg)) {
        const [, data, hora, conteudo] = matchSis;
        if (!conteudo.includes(':')) {
          mensagens.push({ data, hora, remetente: 'sistema', tipo_remetente: 'desconhecido', conteudo: conteudo.trim(), tipo: 'sistema' });
        }
      }
    }
  }
  if (msgAtual) mensagens.push(msgAtual);

  // Montar participantes
  const participantes = Object.entries(participantesMap).map(([nome, total]) => ({
    nome,
    tipo: classificarRemetente(nome),
    total_mensagens: total
  })).sort((a, b) => b.total_mensagens - a.total_mensagens);

  const datas = mensagens.filter(m => m.data).map(m => m.data);
  const datasOrdenadas = datas.sort((a, b) => {
    const [da, ma, aa] = a.split('/');
    const [db, mb, ab] = b.split('/');
    return new Date(`${aa}-${ma}-${da}`) - new Date(`${ab}-${mb}-${db}`) ;
  });

  return {
    mensagens: mensagens.slice(-500), // últimas 500 para análise
    total_mensagens: mensagens.length,
    participantes,
    data_inicio: datasOrdenadas[0] ? converterData(datasOrdenadas[0]) : null,
    data_fim: datasOrdenadas[datasOrdenadas.length - 1] ? converterData(datasOrdenadas[datasOrdenadas.length - 1]) : null,
    todas_mensagens: mensagens
  };
}

function converterData(dataBR) {
  const [d, m, a] = dataBR.split('/');
  return `${a}-${m}-${d}`;
}

function classificarRemetente(nome) {
  const n = nome.toLowerCase();
  if (
    n.includes('voxx') || n.includes('atendimento') || n.includes('sthefany') ||
    n.includes('abner') || n.includes('pedro') || n.includes('gabriel') ||
    n.includes('nicolas') || n.includes('nick') || n.includes('marketiza')
  ) return 'voxx';
  if (
    n.includes('oral sin') || n.includes('dep. administrativo') || n.includes('rebecca') ||
    n.includes('aline') || n.includes('ludmylla') || n.includes('simone') || n.includes('iris') ||
    n.startsWith('+55') || n.includes('888')
  ) return 'cliente';
  return 'desconhecido';
}

// Extrai dados de leads dos relatórios diários no histórico
function extrairDadosLeads(mensagens) {
  const relatorios = [];
  let buffer = null;

  for (const msg of mensagens) {
    const c = msg.conteudo || '';
    if (c.includes('LEADS') && (c.includes('NOVOS') || c.includes('AGENDADO'))) {
      if (buffer) relatorios.push(buffer);
      buffer = { data: msg.data, remetente: msg.remetente, texto: c, novos: 0, agendados: 0, distantes: 0, repetidos: 0, resgates: 0, indicacoes: 0, total: 0 };
    } else if (buffer) {
      buffer.texto += '\n' + c;
      const matchNovos = c.match(/_NOVOS_\s*:?\s*(\d+)/);
      const matchAgend = c.match(/Total:\s*(\d+)/);
      const matchDist = c.match(/_DISTANTES_\s*:?\s*(\d+)/);
      const matchRep = c.match(/_REPETIDOS_\s*:?\s*(\d+)/);
      const matchResgate = c.match(/_RESGATE_\s*:?\s*(\d+)/);
      const matchInd = c.match(/_INDICA[ÇC][ÃA]O[^_]*_\s*:?\s*(\d+)/i);
      if (matchNovos) buffer.novos = parseInt(matchNovos[1]) || 0;
      if (matchAgend) { buffer.total = parseInt(matchAgend[1]) || 0; relatorios.push(buffer); buffer = null; }
      if (matchDist) buffer.distantes = parseInt(matchDist[1]) || 0;
      if (matchRep) buffer.repetidos = parseInt(matchRep[1]) || 0;
      if (matchResgate) buffer.resgates = parseInt(matchResgate[1]) || 0;
      if (matchInd) buffer.indicacoes = parseInt(matchInd[1]) || 0;
    }
  }
  if (buffer) relatorios.push(buffer);

  return relatorios;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.tipo_usuario !== 'voxx_admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { cliente_id, cliente_nome, nome_arquivo, conteudo_txt } = await req.json();

    if (!cliente_id || !conteudo_txt) {
      return Response.json({ error: 'cliente_id e conteudo_txt são obrigatórios' }, { status: 400 });
    }

    // Parsear histórico
    const parsed = parsearHistorico(conteudo_txt);
    const relatoriosLeads = extrairDadosLeads(parsed.todas_mensagens);

    const mediaLeadsDia = relatoriosLeads.length > 0
      ? Math.round(relatoriosLeads.reduce((s, r) => s + r.novos, 0) / relatoriosLeads.length * 10) / 10
      : 0;
    const mediaAgendDia = relatoriosLeads.length > 0
      ? Math.round(relatoriosLeads.reduce((s, r) => s + r.total, 0) / relatoriosLeads.length * 10) / 10
      : 0;
    const taxaConversao = mediaLeadsDia > 0 ? Math.round((mediaAgendDia / mediaLeadsDia) * 100) : 0;

    // Preparar contexto para IA (amostra das últimas 200 mensagens de texto)
    const amostraMensagens = parsed.mensagens
      .filter(m => m.tipo === 'texto' && m.conteudo.length > 5)
      .slice(-200)
      .map(m => `[${m.data} ${m.hora}] ${m.remetente}: ${m.conteudo.substring(0, 200)}`)
      .join('\n');

    const resumoLeads = relatoriosLeads.slice(-20).map(r =>
      `${r.data}: ${r.novos} novos, ${r.total} agendamentos, ${r.distantes} distantes, ${r.resgates} resgates`
    ).join('\n');

    const participantesInfo = parsed.participantes.slice(0, 8)
      .map(p => `${p.nome} (${p.tipo}): ${p.total_mensagens} msgs`)
      .join(', ');

    const promptIA = `Você é analista executivo sênior da agência VOXX Digital. Analise o histórico de conversa do grupo WhatsApp do cliente "${cliente_nome}".

DADOS DO HISTÓRICO:
- Período: ${parsed.data_inicio} a ${parsed.data_fim}
- Total de mensagens: ${parsed.total_mensagens}
- Participantes: ${participantesInfo}
- Relatórios de leads encontrados: ${relatoriosLeads.length}
- Média de leads/dia: ${mediaLeadsDia}
- Média de agendamentos/dia: ${mediaAgendDia}
- Taxa de conversão média: ${taxaConversao}%

ÚLTIMOS RELATÓRIOS DE LEADS:
${resumoLeads}

AMOSTRA DAS CONVERSAS (últimas mensagens):
${amostraMensagens}

Com base nesse histórico, gere uma análise executiva completa em JSON com:
- resumo_executivo: parágrafo com situação geral do relacionamento (3-4 frases)
- pontos_positivos: lista de 3-5 aspectos positivos observados
- pontos_atencao: lista de 3-5 pontos de atenção ou problemas
- acoes_recomendadas: lista de 3-5 ações concretas recomendadas
- clima_relacional: classificação do clima (otimo/bom/neutro/tenso/critico)
- score_engajamento: nota de 0 a 100 para engajamento do cliente
- score_satisfacao: nota de 0 a 100 para satisfação percebida
- principal_objecao: principal objeção dos leads identificada no histórico
- principais_problemas: lista dos 3 principais problemas operacionais recorrentes`;

    const analiseIA = await base44.integrations.Core.InvokeLLM({
      prompt: promptIA,
      response_json_schema: {
        type: 'object',
        properties: {
          resumo_executivo: { type: 'string' },
          pontos_positivos: { type: 'array', items: { type: 'string' } },
          pontos_atencao: { type: 'array', items: { type: 'string' } },
          acoes_recomendadas: { type: 'array', items: { type: 'string' } },
          clima_relacional: { type: 'string' },
          score_engajamento: { type: 'number' },
          score_satisfacao: { type: 'number' },
          principal_objecao: { type: 'string' },
          principais_problemas: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    // Salvar no banco
    const registro = await base44.entities.HistoricoConversaWhatsapp.create({
      cliente_id,
      cliente_nome,
      nome_arquivo: nome_arquivo || 'historico.txt',
      data_inicio: parsed.data_inicio,
      data_fim: parsed.data_fim,
      total_mensagens: parsed.total_mensagens,
      participantes: parsed.participantes,
      mensagens: parsed.mensagens,
      analise_ia: {
        ...analiseIA,
        media_leads_dia: mediaLeadsDia,
        media_agendamentos_dia: mediaAgendDia,
        taxa_conversao_media: taxaConversao,
        gerado_em: new Date().toISOString()
      },
      status: 'analisado',
      importado_por: user.email,
      importado_por_nome: user.full_name
    });

    return Response.json({
      success: true,
      id: registro.id,
      total_mensagens: parsed.total_mensagens,
      total_relatorios_leads: relatoriosLeads.length,
      media_leads_dia: mediaLeadsDia,
      taxa_conversao: taxaConversao,
      clima_relacional: analiseIA.clima_relacional,
      score_engajamento: analiseIA.score_engajamento,
      score_satisfacao: analiseIA.score_satisfacao
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});