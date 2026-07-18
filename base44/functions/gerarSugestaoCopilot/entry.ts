import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ════════════════════════════════════════════════════════════
//  DICIONÁRIO HEURÍSTICO DE CLASSIFICAÇÃO
//  (Configuração no código — exige publicação para alterar)
// ════════════════════════════════════════════════════════════

const DICIONARIO_CATEGORIAS = {
  padrao_comunicacao: {
    termos_diretos: ['tom de voz', 'padrão de comunicação', 'linguagem', 'forma de falar'],
    sinonimos: ['como responder', 'como falar', 'cordialidade', 'formalidade']
  },
  campanhas_trafego: {
    termos_diretos: ['meta ads', 'google ads', 'facebook ads', 'instagram ads', 'campanha', 'campanhas', 'tráfego', 'anúncio', 'anúncios', 'impulsionar'],
    sinonimos: ['leads', 'lead', 'contatos', 'contato', 'conversões', 'cpl', 'cpc', 'ctr', 'investimento', 'gasto', 'resultado', 'queda', 'caiu', 'caíram', 'cair', 'diminuiu', 'aumentou', 'cliques', 'visualizações', 'alcance', 'impressões']
  },
  criacao_artes: {
    termos_diretos: ['arte', 'artes', 'design', 'banner', 'cartaz', 'flyer', 'peça gráfica', 'logotipo', 'logo', 'identidade visual', 'layout'],
    sinonimos: ['imagem', 'imagens', 'criativo', 'paleta', 'tipografia', 'montagem', 'edição']
  },
  conteudo_redes_sociais: {
    termos_diretos: ['redes sociais', 'instagram', 'facebook', 'post', 'posts', 'reels', 'stories', 'conteúdo', 'calendário', 'postagem', 'postagens'],
    sinonimos: ['publicação', 'legenda', 'feed', 'perfil', 'engajamento', 'seguidores', 'hashtag']
  },
  operacao_atendimento: {
    termos_diretos: ['operacional', 'equipe', 'processo', 'fluxo'],
    sinonimos: ['atendimento', 'tempo de resposta', 'demora', 'aguardando', 'andamento', 'status']
  },
  reclamacoes_sensiveis: {
    termos_diretos: ['reclamação', 'reclamar', 'processo jurídico', 'advogado', 'ameaça', 'insatisfação', 'insatisfeito', 'elogio à concorrência'],
    sinonimos: ['chateado', 'frustrado', 'decepcionado', 'irritado', 'revoltado', 'ninguém resolveu'],
    termos_inequivocos: ['cobrança indevida', 'vão processar', 'advogado', 'ação judicial', 'procon']
  },
  contratos_financeiro: {
    termos_diretos: ['contrato', 'faturamento', 'cobrança', 'boleto', 'nota fiscal', 'pagamento', 'vencimento', 'renovação', 'cancelar contrato'],
    sinonimos: ['valor', 'mensalidade', 'honorários', 'orçamento', 'reajuste', 'inadimplência']
  }
};

const TERMOS_SENSIVEIS_UNIVERSAIS = [
  'cobrança', 'cancelamento', 'processo', 'advogado', 'procon',
  'reclamação', 'reclamar', 'insatisfeito', 'frustrado', 'chateado',
  'irritado', 'revoltado', 'erro da agência', 'erro da voxx',
  'devolução', 'reembolso', 'cancelar contrato'
];

// ════════════════════════════════════════════════════════════
//  DETECÇÃO E ANÁLISE DE RELATÓRIO/ALINHAMENTO DE LEADS
// ════════════════════════════════════════════════════════════

// Expressões que indicam que uma data DD/MM é a data de referência do relatório
const EXPRESSOES_DATA_REFERENCIA = [
  'relatorio do dia', 'alinhamento do dia', 'referente ao dia',
  'dados de', 'fechamento de', 'fechamento da semana', 'periodo de',
  'relatorio de leads de', 'relatorio de', 'alinhamento de',
  'de hoje', 'de ontem', 'do dia'
];

// Expressões que indicam que uma data DD/MM é data de evento individual (NÃO é data de referência)
const EXPRESSOES_DATA_EVENTO = [
  'marcou para', 'marcaram para', 'agendado para', 'agendada para',
  'avaliacao para', 'retorna em', 'retorno dia', 'retorna dia',
  'estara na cidade', 'vem no dia', 'disponivel em', 'disponivel dia',
  'comparecera em', 'comparecera dia', 'inicio de', 'proxima semana',
  'proximo mes', 'mes que vem'
];

const TERMOS_RELATORIO_LEADS = [
  'relatorio de leads', 'relatório de leads', 'alinhamento de leads', 'alinhamento',
  'total de leads', 'leads do dia', 'leads da semana', 'leads de hoje',
  'leads recebidos', 'leads gerados', 'leads captados', 'quantidade de leads',
  'leads novos', 'total processado',
  'agendamentos', 'agendamento', 'agendou', 'agendar',
  'compareceu', 'faltou', 'desmarcou', 'reagendou',
  'sem contato', 'sem_contato', 'sem resposta', 'sem retorno',
  'kanban', 'duplicidades', 'duplicidade', 'duplicado', 'duplicada',
  'distancia', 'distância', 'longe',
  'orcamento', 'orçamento', 'poder aquisitivo',
  'qualidade dos contatos', 'qualidade dos leads',
  'conversao', 'conversão', 'taxa de conversao', 'taxa de conversão',
  'perda', 'perdeu', 'perderam', 'fechou em outro', 'sem interesse',
  'fechamento semanal', 'fechamento mensal', 'fechamento da semana',
  'acumulado do mes', 'acumulado',
  'marcou para', 'marcaram para', 'proxima semana', 'próxima semana',
];

function detectarMetricasQuantitativas(texto) {
  if (!texto) return { count: 0, termos: [] };
  const norm = normalizarTexto(texto);
  const termosFunil = [
    'leads', 'contatos', 'pacientes', 'agendamentos', 'agendamento',
    'comparecimentos', 'compareceu', 'compareceram', 'faltas', 'faltaram', 'faltou',
    'sem contato', 'sem resposta', 'perdas', 'perda', 'perdeu', 'perderam',
    'duplicidades', 'duplicidade', 'duplicado', 'duplicada', 'kanban',
    'reagendou', 'reagendamentos', 'desmarcou', 'desmarcacoes'
  ];
  let count = 0;
  const encontrados = [];
  for (const termo of termosFunil) {
    const escaped = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(\\d+)\\s+${escaped}`, 'i');
    if (regex.test(norm)) {
      count++;
      encontrados.push(termo);
    }
  }
  return { count, termos: encontrados };
}

function detectarRelatorioLeads(mensagensUteis) {
  const recentes = mensagensUteis.slice(-15);
  const texto = recentes.map(m => {
    if (m.tipo_mensagem === 'audio') return m.transcricao_audio || '';
    return m.mensagem || '';
  }).join(' ');
  const norm = normalizarTexto(texto);

  let matches = 0;
  const termosEncontrados = [];
  for (const termo of TERMOS_RELATORIO_LEADS) {
    if (termoPresente(norm, termo)) { matches++; termosEncontrados.push(termo); }
  }
  const termosEspecificos = ['relatorio de leads', 'relatório de leads', 'alinhamento de leads', 'total de leads', 'kanban', 'fechamento semanal', 'fechamento mensal'];
  const temEspecifico = termosEspecificos.some(t => termoPresente(norm, t));

  // Detecção informal: 2+ métricas quantitativas do funil
  const metricasQuant = detectarMetricasQuantitativas(texto);
  const temMetricasInformais = metricasQuant.count >= 2;

  const detectado = matches >= 2 || (temEspecifico && matches >= 1) || temMetricasInformais;
  return { detectado, matches, termos: termosEncontrados, metricas_informais: metricasQuant.count, metricas_informais_termos: metricasQuant.termos };
}

async function recuperarRelatoriosHistoricos(sdk, chatId, idsJaNoContexto) {
  const todasMsgs = await sdk.entities.WhatsappMensagem.filter(
    { grupo_id: chatId }, '-received_at', 200
  );
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const idsSet = new Set(idsJaNoContexto);

  return (todasMsgs || [])
    .filter(m => !m.deletado)
    .filter(m => !['sistema', 'atividade', 'sem_conteudo', 'reacao'].includes(m.tipo_mensagem))
    .filter(m => {
      const ts = m.received_at || m.timestamp_mensagem;
      if (!ts) return false;
      return new Date(ts) >= cutoff;
    })
    .filter(m => !idsSet.has(m.id))
    .filter(m => {
      const texto = m.tipo_mensagem === 'audio' ? (m.transcricao_audio || '') : (m.mensagem || '');
      if (!texto || !texto.trim()) return false;
      const norm = normalizarTexto(texto);
      if (TERMOS_RELATORIO_LEADS.some(termo => termoPresente(norm, termo))) return true;
      // Detecção informal: 2+ métricas quantitativas
      return detectarMetricasQuantitativas(texto).count >= 2;
    })
    .slice(0, 10);
}

// --- Consolidação de mensagens consecutivas ---

function ehInicioNovoRelatorio(texto) {
  if (!texto) return false;
  const norm = normalizarTexto(texto);
  const marcadores = ['relatorio de leads', 'relatório de leads', 'alinhamento de leads',
                       'fechamento semanal', 'fechamento mensal', 'fechamento da semana', 'acumulado do mes'];
  return marcadores.some(m => termoPresente(norm, m));
}

function consolidarMensagensConsecutivas(mensagens) {
  if (!mensagens || mensagens.length === 0) return [];
  const grupos = [];
  let grupoAtual = null;

  for (const msg of mensagens) {
    const ts = msg.received_at || msg.timestamp_mensagem;
    const texto = msg.tipo_mensagem === 'audio' ? (msg.transcricao_audio || '') : (msg.mensagem || '');
    const remetente = msg.remetente_telefone || msg.remetente_nome || msg.usuario_id || '';
    const ehNovoRelatorio = ehInicioNovoRelatorio(texto);

    if (grupoAtual && grupoAtual.remetente === remetente && !ehNovoRelatorio) {
      const ultimaMsg = grupoAtual.mensagens[grupoAtual.mensagens.length - 1];
      const tsUltima = new Date(ultimaMsg.received_at || ultimaMsg.timestamp_mensagem || 0).getTime();
      const tsAtual = new Date(ts || 0).getTime();
      const diffMin = Math.abs(tsAtual - tsUltima) / 60000;
      if (diffMin <= 10) {
        grupoAtual.mensagens.push(msg);
        grupoAtual.texto_completado = (grupoAtual.texto_completado + ' ' + texto).trim();
        if (ts) grupoAtual.data_ultima = ts;
        grupoAtual.ids.push(msg.id);
        continue;
      }
    }
    if (grupoAtual) grupos.push(grupoAtual);
    grupoAtual = {
      mensagens: [msg], texto_completado: texto, remetente,
      remetente_nome: msg.remetente_nome, remetente_tipo: msg.remetente_tipo,
      data_primeira: ts, data_ultima: ts, ids: [msg.id], tipo_mensagem: msg.tipo_mensagem,
    };
  }
  if (grupoAtual) grupos.push(grupoAtual);
  return grupos;
}

// --- Data de referência ---

function normalizarDataBR(str) {
  const parts = str.split('/');
  if (parts.length < 2) return null;
  let dia = parseInt(parts[0]), mes = parseInt(parts[1]);
  let ano = parts[2] ? parseInt(parts[2]) : new Date().getFullYear();
  if (ano < 100) ano += 2000;
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function extrairDataReferencia(texto, dataRecebimento) {
  if (!texto) return null;
  const norm = normalizarTexto(texto);
  const baseDate = dataRecebimento ? new Date(dataRecebimento) : new Date();

  const datasAgendamentos = [];
  const datasOportunidades = [];
  const outrasDatas = [];
  let dataRefInicio = null;
  let dataRefFim = null;
  let confiancaDataRef = 'baixa';

  // 1. Fechamento semanal
  if (termoPresente(norm, 'fechamento semanal') || termoPresente(norm, 'fechamento da semana')) {
    let m = norm.match(/(?:de\s+)?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(?:a|ate)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
    if (m) {
      dataRefInicio = normalizarDataBR(m[1]);
      dataRefFim = normalizarDataBR(m[2]);
      confiancaDataRef = 'alta';
    }
    return { tipo: 'semana', inicio: dataRefInicio, fim: dataRefFim,
             datas_agendamentos_futuros: datasAgendamentos, datas_oportunidades_futuras: datasOportunidades,
             outras_datas_identificadas: outrasDatas, confianca_data_referencia: confiancaDataRef };
  }

  // 2. Fechamento mensal / acumulado
  if (termoPresente(norm, 'acumulado do mes') || termoPresente(norm, 'fechamento mensal')) {
    return { tipo: 'mes', inicio: null, fim: null,
             datas_agendamentos_futuros: datasAgendamentos, datas_oportunidades_futuras: datasOportunidades,
             outras_datas_identificadas: outrasDatas, confianca_data_referencia: 'alta' };
  }

  // 3. Range explícito: "de DD/MM a DD/MM" ou "periodo de DD/MM a DD/MM"
  let m = norm.match(/(?:periodo\s+de\s+)?de\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(?:a|ate)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
  if (m) {
    dataRefInicio = normalizarDataBR(m[1]);
    dataRefFim = normalizarDataBR(m[2]);
    confiancaDataRef = 'alta';
  }

  // 4. "referente ao dia DD/MM" ou "relatorio do dia DD/MM" ou "alinhamento do dia DD/MM" ou "dados de DD/MM"
  if (!dataRefInicio) {
    m = norm.match(/(?:referente\s+ao\s+dia|relatorio\s+do\s+dia|alinhamento\s+do\s+dia|dados\s+de)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
    if (m) {
      const d = normalizarDataBR(m[1]);
      dataRefInicio = d; dataRefFim = d;
      confiancaDataRef = 'alta';
    }
  }

  // 5. "relatorio de leads de DD/MM"
  if (!dataRefInicio) {
    m = norm.match(/relatorio\s+de\s+leads\s+de\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
    if (m) {
      const d = normalizarDataBR(m[1]);
      dataRefInicio = d; dataRefFim = d;
      confiancaDataRef = 'alta';
    }
  }

  // 5b. "alinhamento dos leads ... DD/MM/YY" (cabeçalho de relatório com data embutida)
  if (!dataRefInicio) {
    m = norm.match(/alinhamento\s+dos?\s+leads?\s+\*?[a-z\s]{0,30}?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\*?/);
    if (m) {
      const d = normalizarDataBR(m[1]);
      dataRefInicio = d; dataRefFim = d;
      confiancaDataRef = 'alta';
    }
  }

  // 6. "hoje"
  if (!dataRefInicio && (termoPresente(norm, 'de hoje') || termoPresente(norm, 'leads de hoje'))) {
    const hoje = baseDate.toISOString().split('T')[0];
    dataRefInicio = hoje; dataRefFim = hoje;
    confiancaDataRef = 'media';
  }

  // 7. "ontem"
  if (!dataRefInicio && termoPresente(norm, 'de ontem')) {
    const o = new Date(baseDate); o.setDate(o.getDate() - 1);
    const d = o.toISOString().split('T')[0];
    dataRefInicio = d; dataRefFim = d;
    confiancaDataRef = 'media';
  }

  // 8. Dias da semana com data: "nesta segunda DD/MM" ou "segunda DD/MM"
  if (!dataRefInicio) {
    const diasSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    for (const dia of diasSemana) {
      if (termoPresente(norm, dia)) {
        m = norm.match(new RegExp(dia + '\\s+(\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?)'));
        if (m) {
          const d = normalizarDataBR(m[1]);
          dataRefInicio = d; dataRefFim = d;
          confiancaDataRef = 'media';
          break;
        }
      }
    }
  }

  // 9. Classificar TODAS as datas DD/MM encontradas no texto
  const regexTodasDatas = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/g;
  let matchData;
  while ((matchData = regexTodasDatas.exec(norm)) !== null) {
    const dataStr = normalizarDataBR(`${matchData[1]}/${matchData[2]}${matchData[3] ? '/' + matchData[3] : ''}`);
    if (!dataStr) continue;

    // Obter contexto ao redor (40 chars antes)
    const start = Math.max(0, matchData.index - 40);
    const contextoAntes = norm.substring(start, matchData.index);

    // Encontrar a expressão de evento MAIS PRÓXIMA da data (não qualquer uma)
    let closestEvento = null;
    let closestEventoPos = -1;
    for (const expr of EXPRESSOES_DATA_EVENTO) {
      const pos = contextoAntes.lastIndexOf(expr);
      if (pos !== -1 && pos > closestEventoPos) {
        closestEvento = expr;
        closestEventoPos = pos;
      }
    }

    // Encontrar a expressão de referência MAIS PRÓXIMA da data
    let closestReferencia = null;
    let closestReferenciaPos = -1;
    for (const expr of EXPRESSOES_DATA_REFERENCIA) {
      const pos = contextoAntes.lastIndexOf(expr);
      if (pos !== -1 && pos > closestReferenciaPos) {
        closestReferencia = expr;
        closestReferenciaPos = pos;
      }
    }

    // A classificação é determinada pela expressão mais próxima (evento vs referência)
    const isEvento = closestEvento !== null && (closestReferencia === null || closestEventoPos > closestReferenciaPos);
    const isReferencia = closestReferencia !== null && (closestEvento === null || closestReferenciaPos > closestEventoPos);

    if (isEvento) {
      if (closestEvento === 'marcou para' || closestEvento === 'marcaram para' ||
          closestEvento === 'agendado para' || closestEvento === 'agendada para') {
        datasAgendamentos.push(dataStr);
      } else {
        datasOportunidades.push(dataStr);
      }
    } else if (!isReferencia && dataStr !== dataRefInicio && dataStr !== dataRefFim) {
      outrasDatas.push(dataStr);
    }
  }

  const tipo = dataRefInicio ? (dataRefInicio === dataRefFim ? 'ponto' : 'range') : null;
  return {
    tipo, inicio: dataRefInicio, fim: dataRefFim,
    datas_agendamentos_futuros: datasAgendamentos,
    datas_oportunidades_futuras: datasOportunidades,
    outras_datas_identificadas: outrasDatas,
    confianca_data_referencia: confiancaDataRef
  };
}

function detectarPeriodicidade(texto, dataRef) {
  const norm = normalizarTexto(texto);
  if (termoPresente(norm, 'fechamento semanal') || termoPresente(norm, 'fechamento da semana') || (dataRef && dataRef.tipo === 'semana'))
    return { periodicidade: 'semanal', confianca: 'alta' };
  if (termoPresente(norm, 'fechamento mensal') || termoPresente(norm, 'acumulado do mes') || (dataRef && dataRef.tipo === 'mes'))
    return { periodicidade: 'mensal', confianca: 'alta' };
  if (termoPresente(norm, 'acumulado'))
    return { periodicidade: 'acumulado', confianca: 'media' };
  if (dataRef && dataRef.tipo === 'range')
    return { periodicidade: 'periodo_personalizado', confianca: 'alta' };
  if (termoPresente(norm, 'de hoje') || termoPresente(norm, 'de ontem') ||
      termoPresente(norm, 'do dia') || termoPresente(norm, 'leads de hoje') ||
      (dataRef && dataRef.tipo === 'ponto'))
    return { periodicidade: 'diario', confianca: 'media' };
  return { periodicidade: 'desconhecido', confianca: 'baixa' };
}

// --- Extração de métricas V2 ---

function extrairMetricasLeadsV2(texto) {
  if (!texto) return {};
  const norm = normalizarTexto(texto);
  const metricas = {};
  let m;

  m = norm.match(/(\d+)\s+leads?\s+novos?/);
  if (m) metricas.leads_novos = parseInt(m[1]);

  m = norm.match(/(\d+)\s+(?:ja\s+estavam|ja\s+estava)\s+(?:no|na)\s+kanban/)
    || norm.match(/\*?(\d+)\*?\s+leads?\s+(?:que\s+)?ja\s+estavam\s+(?:no|na)\s+kanban/);
  if (m) metricas.leads_anteriores_kanban = parseInt(m[1]);

  m = norm.match(/(\d+)\s+duplicidades?/) || norm.match(/(\d+)\s+duplicad[ao]s?/);
  if (m) metricas.leads_duplicados = parseInt(m[1]);

  m = norm.match(/total\s+processado[:\s]*(\d+)/);
  if (m) metricas.total_processado = parseInt(m[1]);

  if (metricas.leads_novos === undefined) {
    m = norm.match(/(?:total\s+de\s+)?(\d+)\s+leads?/) || norm.match(/leads?\s*[:\-]\s*(\d+)/)
      || norm.match(/total\s+de\s+leads?\s+(?:pelo\s+)?(?:whatsapp|wpp|wa)?\s*\*?(\d+)\*?/);
    if (m) metricas.total_leads = parseInt(m[1]);
  }

  m = norm.match(/(\d+)\s+agendamentos?/) || norm.match(/agendaram\s+(\d+)/)
    || norm.match(/\*?(\d+)\*?\s+total\s+de\s+leads?\s+agendados/);
  if (m) metricas.agendamentos = parseInt(m[1]);

  m = norm.match(/(\d+)\s+compareceram/) || norm.match(/compareceu\s+(\d+)/);
  if (m) metricas.comparecimentos = parseInt(m[1]);

  m = norm.match(/(\d+)\s+faltaram/) || norm.match(/faltou\s+(\d+)/);
  if (m) metricas.faltas = parseInt(m[1]);

  m = norm.match(/(\d+)\s+desmarcou/);
  if (m) metricas.desmarcou = parseInt(m[1]);

  m = norm.match(/(\d+)\s+reagendou/);
  if (m) metricas.reagendou = parseInt(m[1]);

  m = norm.match(/(\d+)\s+sem\s+contato/)
    || norm.match(/\*?(\d+)\*?\s+leads?\s+que\s+nao\s+consegui\s+contato/);
  if (m) metricas.sem_contato = parseInt(m[1]);

  m = norm.match(/(\d+)\s+sem\s+resposta/);
  if (m) metricas.sem_resposta = parseInt(m[1]);

  // Perdas — extrair TODAS as ocorrências com motivo
  const regexPerdas = /(\d+)\s+(?:perdeu|perderam)\s+por\s+([a-z\s]+?)(?=\s*\d|\s*$|\.|,|;)/g;
  let match;
  const perdasDetalhadas = [];
  while ((match = regexPerdas.exec(norm)) !== null) {
    perdasDetalhadas.push({ qtd: parseInt(match[1]), motivo: match[2].trim() });
  }

  if (perdasDetalhadas.length > 0) {
    let totalPerdas = 0;
    const motivos = [];
    for (const p of perdasDetalhadas) {
      totalPerdas += p.qtd;
      if (termoPresente(p.motivo, 'distancia') || termoPresente(p.motivo, 'longe')) {
        motivos.push('distância');
        metricas.perdas_distancia = (metricas.perdas_distancia || 0) + p.qtd;
      } else if (termoPresente(p.motivo, 'orcamento') || termoPresente(p.motivo, 'poder aquisitivo')) {
        motivos.push('orçamento');
        metricas.perdas_orcamento = (metricas.perdas_orcamento || 0) + p.qtd;
      } else if (termoPresente(p.motivo, 'sem interesse')) {
        motivos.push('sem interesse');
        metricas.perdas_sem_interesse = (metricas.perdas_sem_interesse || 0) + p.qtd;
      } else if (termoPresente(p.motivo, 'fechou em outro') || termoPresente(p.motivo, 'concorrencia')) {
        motivos.push('concorrência');
        metricas.perdas_concorrencia = (metricas.perdas_concorrencia || 0) + p.qtd;
      }
    }
    metricas.perdas_total = totalPerdas;
    metricas.motivos_perda = motivos;
  } else {
    m = norm.match(/(\d+)\s+perdas?/);
    if (m) metricas.perdas_total = parseInt(m[1]);
  }

  // Agendamento futuro confirmado
  m = norm.match(/(\d+)\s+(?:marcou|marcaram)\s+para\s+(?:proxima\s+semana|pr[oó]xima\s+semana|\d{1,2}\/\d{1,2})/);
  if (m) {
    metricas.agendamento_futuro_confirmado = parseInt(m[1]);
  } else if (norm.match(/marcou\s+para\s+\d{1,2}\/\d{1,2}/) || norm.match(/marcaram\s+para\s+\d{1,2}\/\d{1,2}/)) {
    metricas.agendamento_futuro_confirmado = 1;
  }

  // Oportunidade futura sem agendamento
  if (norm.match(/s[oó]\s+estar[aá]?\s+(?:na\s+)?cidade/) || norm.match(/dispon[ií]vel\s+(?:em|no|na)\s+/)) {
    metricas.oportunidade_futura_sem_agendamento = 1;
  }

  return metricas;
}

// --- Verificação de comparabilidade (fail-closed) ---

function verificarComparabilidade(relatorios) {
  if (relatorios.length < 2) {
    return { comparaveis: [], naoComparaveis: relatorios, motivos: [], confianca: 'baixa' };
  }

  const porPeriodicidade = {};
  for (const r of relatorios) {
    const p = r.periodicidade;
    if (!porPeriodicidade[p]) porPeriodicidade[p] = [];
    porPeriodicidade[p].push(r);
  }

  const motivosNaoComp = [];
  const naoComparaveis = [];

  // Periodicidade desconhecida → não comparável
  if (porPeriodicidade['desconhecido']) {
    for (const r of porPeriodicidade['desconhecido']) {
      naoComparaveis.push(r);
      motivosNaoComp.push({ motivo: 'periodicidade_desconhecida' });
    }
    delete porPeriodicidade['desconhecido'];
  }

  // Agrupar periodicidades diferentes → não comparáveis entre si
  const periodicidadesPresentes = Object.keys(porPeriodicidade);
  if (periodicidadesPresentes.length > 1) {
    for (const p of periodicidadesPresentes) {
      for (const r of porPeriodicidade[p]) {
        naoComparaveis.push(r);
        motivosNaoComp.push({ motivo: `periodicidade_incompativel:${p}` });
      }
    }
    return { comparaveis: [], naoComparaveis, motivos: motivosNaoComp, confianca: 'baixa' };
  }

  // Se nenhuma periodicidade conhecida restou (todas eram desconhecidas)
  if (periodicidadesPresentes.length === 0) {
    return { comparaveis: [], naoComparaveis, motivos: motivosNaoComp, confianca: 'baixa' };
  }

  // Mesma periodicidade — verificar sobreposição
  const periodicidade = periodicidadesPresentes[0];
  const grupo = porPeriodicidade[periodicidade];
  grupo.sort((a, b) => {
    const ta = a.data_ref?.inicio ? new Date(a.data_ref.inicio).getTime() : new Date(a.data_recebimento || 0).getTime();
    const tb = b.data_ref?.inicio ? new Date(b.data_ref.inicio).getTime() : new Date(b.data_recebimento || 0).getTime();
    return ta - tb;
  });

  const comparaveis = [];
  for (let i = 0; i < grupo.length; i++) {
    let sobreposto = false;
    if (i > 0) {
      const prev = grupo[i - 1], curr = grupo[i];
      if (prev.data_ref?.inicio && prev.data_ref?.fim && curr.data_ref?.inicio && curr.data_ref?.fim) {
        const overlap = !(new Date(prev.data_ref.fim) < new Date(curr.data_ref.inicio) ||
                         new Date(curr.data_ref.fim) < new Date(prev.data_ref.inicio));
        if (overlap) {
          naoComparaveis.push(curr);
          motivosNaoComp.push({ motivo: 'periodos_sobrepostos' });
          sobreposto = true;
        }
      }
    }
    if (!sobreposto) comparaveis.push(grupo[i]);
  }

  if (comparaveis.length < 2) {
    naoComparaveis.push(...comparaveis);
    motivosNaoComp.push({ motivo: 'sem_par_comparavel_na_mesma_periodicidade' });
    return { comparaveis: [], naoComparaveis, motivos: motivosNaoComp, confianca: 'baixa' };
  }

  return { comparaveis, naoComparaveis, motivos: motivosNaoComp, confianca: 'media' };
}

// --- Construção do bloco de análise ---

function construirBlocoAnaliseLeads(gruposContexto, gruposHistoricos) {
  const todosRelatorios = [];

  for (const grupo of [...(gruposHistoricos || []), ...(gruposContexto || [])]) {
    const texto = grupo.texto_completado || (grupo.tipo_mensagem === 'audio'
      ? (grupo.transcricao_audio || '') : (grupo.mensagem || ''));
    if (!texto || !texto.trim()) continue;

    const dataRecebimento = grupo.data_primeira || grupo.received_at || grupo.timestamp_mensagem;
    const dataRef = extrairDataReferencia(texto, dataRecebimento);
    const { periodicidade, confianca: confiancaPeriod } = detectarPeriodicidade(texto, dataRef);
    const metricas = extrairMetricasLeadsV2(texto);

    todosRelatorios.push({
      texto, data_recebimento: dataRecebimento, data_ref: dataRef,
      periodicidade, confianca_periodicidade: confiancaPeriod,
      metricas, ids: grupo.ids || [grupo.id],
      remetente_nome: grupo.remetente_nome, remetente_tipo: grupo.remetente_tipo,
      mensagens_consolidadas: (grupo.ids || []).length,
    });
  }

  // Ordenar por data de referência (fallback para recebimento)
  todosRelatorios.sort((a, b) => {
    const ta = a.data_ref?.inicio ? new Date(a.data_ref.inicio).getTime() : (a.data_recebimento ? new Date(a.data_recebimento).getTime() : 0);
    const tb = b.data_ref?.inicio ? new Date(b.data_ref.inicio).getTime() : (b.data_recebimento ? new Date(b.data_recebimento).getTime() : 0);
    return ta - tb;
  });

  const comMetricas = todosRelatorios.filter(r => Object.keys(r.metricas).length > 0);
  const { comparaveis, naoComparaveis, motivos, confianca } = verificarComparabilidade(todosRelatorios);

  // Tendências APENAS entre comparáveis com métricas
  let tendencias = null;
  const comparaveisComMetricas = comparaveis.filter(r => Object.keys(r.metricas).length > 0);

  if (comparaveisComMetricas.length >= 2) {
    tendencias = {};
    const campos = ['leads_novos', 'total_leads', 'total_processado', 'agendamentos',
                    'comparecimentos', 'faltas', 'desmarcou', 'reagendou',
                    'sem_contato', 'sem_resposta', 'leads_duplicados', 'perdas_total',
                    'leads_anteriores_kanban'];
    for (const campo of campos) {
      const valores = comparaveisComMetricas.map(r => r.metricas[campo]).filter(v => v !== undefined && v !== null && v !== '');
      if (valores.length < 2) continue;
      const primeiro = valores[0], ultimo = valores[valores.length - 1];
      const diff = ultimo - primeiro;
      const pct = primeiro > 0 ? Math.round((diff / primeiro) * 100) : null;
      let direcao = 'estavel';
      if (pct !== null) {
        if (pct > 10) direcao = 'aumentou';
        else if (pct < -10) direcao = 'diminuiu';
      } else if (diff !== 0) {
        direcao = diff > 0 ? 'aumentou' : 'diminuiu';
      }
      tendencias[campo] = { primeiro, ultimo, diff, pct, direcao };
    }
    if (Object.keys(tendencias).length === 0) tendencias = null;
  }

  const nomesMetricas = {
    leads_novos: 'Leads novos', total_leads: 'Total leads', total_processado: 'Total proc.',
    leads_anteriores_kanban: 'Kanban ant.', leads_duplicados: 'Dupl.',
    agendamentos: 'Agend.', comparecimentos: 'Comp.',
    faltas: 'Faltas', desmarcou: 'Desm.', reagendou: 'Reag.',
    sem_contato: 'S/contato', sem_resposta: 'S/resposta',
    perdas_total: 'Perdas', agendamento_futuro_confirmado: 'Agend. futuro',
    oportunidade_futura_sem_agendamento: 'Oport. futura',
  };

  const linhasTimeline = comMetricas.map(r => {
    const dataRef = r.data_ref?.inicio
      ? new Date(r.data_ref.inicio + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      : (r.data_recebimento ? new Date(r.data_recebimento).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }) : 'Sem data');
    const partes = Object.entries(nomesMetricas)
      .map(([k, label]) => r.metricas[k] !== undefined ? `${label}: ${r.metricas[k]}` : null)
      .filter(Boolean);
    if (r.metricas.motivos_perda && r.metricas.motivos_perda.length > 0)
      partes.push(`Motivos: ${r.metricas.motivos_perda.join(', ')}`);
    return `[${dataRef}] [${r.periodicidade}] ${partes.join(' | ')}`;
  });

  const nomesTendencias = {
    leads_novos: 'Leads novos', total_leads: 'Volume de leads', total_processado: 'Total processado',
    agendamentos: 'Agendamentos', comparecimentos: 'Comparecimentos', faltas: 'Faltas',
    desmarcou: 'Desmarcações', reagendou: 'Reagendamentos',
    sem_contato: 'Sem contato', sem_resposta: 'Sem resposta',
    leads_duplicados: 'Duplicidades', perdas_total: 'Perdas',
    leads_anteriores_kanban: 'Leads já no Kanban',
  };

  const linhasTendencias = tendencias
    ? Object.entries(tendencias).map(([campo, t]) => {
        const nome = nomesTendencias[campo] || campo;
        const pctStr = t.pct !== null ? ` (${t.pct > 0 ? '+' : ''}${t.pct}%)` : '';
        return `- ${nome}: ${t.direcao}${pctStr} (${t.primeiro} → ${t.ultimo})`;
      })
    : [];

  const linhasNaoComp = motivos.length > 0 ? motivos.map(m => `- ${m.motivo}`).join('\n') : '';
  const periodosUnicos = [...new Set(todosRelatorios.map(r => r.periodicidade))];

  const periodoInicio = todosRelatorios.length > 0
    ? (todosRelatorios[0].data_ref?.inicio || todosRelatorios[0].data_recebimento || null) : null;
  const periodoFim = todosRelatorios.length > 0
    ? (todosRelatorios[todosRelatorios.length - 1].data_ref?.fim || todosRelatorios[todosRelatorios.length - 1].data_ref?.inicio || todosRelatorios[todosRelatorios.length - 1].data_recebimento || null) : null;

  let bloco = `## ANÁLISE ESTRUTURADA DE RELATÓRIO DE LEADS\n`;
  bloco += `\n### Linha do tempo de métricas extraídas:\n`;
  bloco += linhasTimeline.length > 0 ? linhasTimeline.join('\n') : 'Não foi possível extrair métricas estruturadas dos relatórios.';

  if (linhasTendencias.length > 0) {
    bloco += `\n\n### Tendências identificadas (comparação entre relatórios comparáveis):\n${linhasTendencias.join('\n')}`;
  } else if (comparaveisComMetricas.length < 2) {
    if (todosRelatorios.length >= 2 && (naoComparaveis.length > 0 || motivos.length > 0)) {
      bloco += `\n\n### Tendências: NÃO CALCULADAS — os relatórios recuperados NÃO são comparáveis.`;
      if (linhasNaoComp) bloco += `\nMotivos: ${linhasNaoComp}`;
    } else if (comMetricas.length < 2) {
      bloco += `\n\n### Tendências: dados insuficientes para comparação (apenas ${comMetricas.length} relatório com métricas extraídas).`;
    }
  }

  const linhasRaw = (gruposHistoricos || []).map(g => {
    const ts = g.data_primeira || g.received_at;
    const horario = ts ? new Date(ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Sem data';
    const isVoxx = g.remetente_tipo === 'voxx';
    const autor = isVoxx ? 'VOXX' : 'Cliente';
    const nome = g.remetente_nome || 'Desconhecido';
    let texto = (g.texto_completado || '').replace(/\n*— [^\n]+ \| Voxx\n*$/, '').trim();
    if (texto.length > 600) texto = texto.substring(0, 600) + '...';
    return `[${horario}] [${autor}] ${nome}: ${texto}`;
  });
  if (linhasRaw.length > 0) {
    bloco += `\n\n### Relatórios anteriores (texto original):\n${linhasRaw.join('\n')}`;
  }

  // Seção de datas classificadas
  const linhasDatas = comMetricas.map(r => {
    const dataRef = r.data_ref?.inicio
      ? new Date(r.data_ref.inicio + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      : 'Não identificada';
    const agendamentos = (r.data_ref?.datas_agendamentos_futuros || []).join(', ') || '—';
    const oportunidades = (r.data_ref?.datas_oportunidades_futuras || []).join(', ') || '—';
    const outras = (r.data_ref?.outras_datas_identificadas || []).join(', ') || '—';
    return `- Data de referência: ${dataRef} (confiança: ${r.data_ref?.confianca_data_referencia || 'baixa'}) | Agendamentos futuros: ${agendamentos} | Oportunidades: ${oportunidades} | Outras: ${outras}`;
  });
  if (linhasDatas.length > 0) {
    bloco += `\n\n### Datas identificadas e classificadas:\n${linhasDatas.join('\n')}`;
  }

  bloco += `

### Instruções para análise de relatório de leads:
- Apresente tendências SOMENTE quando houver 2 ou mais relatórios comparáveis indicados acima.
- Se os relatórios NÃO forem comparáveis (periodicidades diferentes, períodos sobrepostos, etc.), informe naturalmente que os registros representam períodos diferentes e não permitem comparação direta. Trabalhe apenas com o relatório atual.
- NÃO invente percentuais, metas ou comparações não presentes nos dados extraídos.
- NÃO use "vamos acompanhar os próximos relatórios" quando já existir histórico comparável.
- Diferencie o funil: Leads novos/recebidos → Agendamentos → Comparecimentos → Faltas/Perdas.
- Leads novos e agendamentos = volume e atração (topo do funil).
- Comparecimentos, faltas e perdas = qualificação e operação (fundo do funil).
- NÃO sugira alteração de campanha (orçamento, segmentação, criativos) quando a variação negativa estiver em comparecimentos, faltas, sem contato, sem resposta, agendamento ou operação da unidade.
- SOMENTE sugira possível ajuste de campanha quando os dados de topo do funil (volume de leads novos) sustentarem essa hipótese.
- Distinga perdas por distância/orçamento (qualificação) de perdas por concorrência/falta de interesse (criativo/mensagem).
- Não classifique agendamentos futuros ou oportunidades futuras como perdas.
- Métricas não informadas NÃO devem ser tratadas como zero.
- A data exibida no timestamp de cada mensagem é a data de ENVIO da mensagem, NÃO a data de referência do relatório.
- NUNCA afirme que um relatório é de determinada data quando essa data não estiver identificada como "Data de referência" na seção acima.
- Se a data de referência for "Não identificada", diga apenas que o período não pôde ser determinado. NÃO use a data de envio como substituta.
- Datas de agendamento futuro NÃO devem ser usadas como data do relatório.
- Quando houver 2+ relatórios comparáveis com tendências identificadas, a resposta DEVE apresentar ao menos uma comparação histórica objetiva (ex: "o volume de leads passou de X para Y" ou "agendamentos cresceram Z%").
- Priorize as tendências mais relevantes (maior variação percentual ou maior impacto operacional). NÃO liste todas as tendências mecanicamente.
- NÃO use "vamos acompanhar", "vamos analisar", "seguimos monitorando" ou similares quando os dados já permitem uma leitura conclusiva. Apresente a leitura.
- Considere ações recentes registradas na conversa. Se uma ação (ex: ajuste de segmentação, pausa de anúncio) já foi executada e comunicada, NÃO sugira executá-la novamente.
- NÃO atribua automaticamente uma melhora observada a uma alteração recente sem um período suficiente para confirmação.
- Leads com agendamento futuro ou oportunidade futura NÃO devem ser tratados como perda.
- NÃO agrupe genericamente status diferentes como "os demais não avançaram". Diferencie: sem contato, perda por distância, perda por orçamento, perda por concorrência, etc.
- Métricas ausentes (sem valor numérico no relatório) NÃO devem ser inferidas a partir de informações secundárias. Permanecem como não informadas.`;

  // Coletar todas as datas de eventos de todos os relatórios
  const todasDatasAgendamentos = todosRelatorios.flatMap(r => r.data_ref?.datas_agendamentos_futuros || []);
  const todasDatasOportunidades = todosRelatorios.flatMap(r => r.data_ref?.datas_oportunidades_futuras || []);
  const todasOutrasDatas = todosRelatorios.flatMap(r => r.data_ref?.outras_datas_identificadas || []);
  const confiancaDataRefMedia = todosRelatorios.length > 0
    ? todosRelatorios.map(r => r.data_ref?.confianca_data_referencia || 'baixa')
        .reduce((acc, c) => acc === 'alta' || c === 'alta' ? 'alta' : acc === 'media' || c === 'media' ? 'media' : 'baixa', 'baixa')
    : 'baixa';

  const meta = {
    relatorios_detectados: todosRelatorios.length,
    relatorios_consolidados: todosRelatorios.filter(r => r.mensagens_consolidadas > 1).length,
    relatorios_com_metricas: comMetricas.length,
    relatorios_comparaveis: comparaveis.length,
    relatorios_nao_comparaveis: naoComparaveis.length,
    motivos_nao_comparabilidade: motivos.map(m => m.motivo),
    periodo_analisado_inicio: periodoInicio,
    periodo_analisado_fim: periodoFim,
    periodicidades_identificadas: periodosUnicos,
    tendencias_identificadas: linhasTendencias.length,
    utilizou_historico_especializado: (gruposHistoricos || []).length > 0,
    confianca_comparacao: confianca,
    fallback: comMetricas.length === 0,
    motivo_fallback: comMetricas.length === 0 ? 'nenhum_relatorio_com_metricas_extraidas' : '',
    mensagens_consolidadas: todosRelatorios.reduce((sum, r) => sum + r.mensagens_consolidadas, 0),
    alertas_extracao: [],
    data_referencia_inicio: todosRelatorios.length > 0 ? (todosRelatorios[0].data_ref?.inicio || null) : null,
    data_referencia_fim: todosRelatorios.length > 0 ? (todosRelatorios[todosRelatorios.length - 1].data_ref?.fim || todosRelatorios[todosRelatorios.length - 1].data_ref?.inicio || null) : null,
    datas_agendamentos_futuros: [...new Set(todasDatasAgendamentos)],
    datas_oportunidades_futuras: [...new Set(todasDatasOportunidades)],
    outras_datas_identificadas: [...new Set(todasOutrasDatas)],
    confianca_data_referencia: confiancaDataRefMedia,
  };

  return { bloco, meta };
}

// ════════════════════════════════════════════════════════════
//  HELPERS DE CLASSIFICAÇÃO
// ════════════════════════════════════════════════════════════

function normalizarTexto(str) {
  if (!str) return '';
  return str.toString().toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function termoPresente(texto, termo) {
  const norm = normalizarTexto(termo);
  if (!norm) return false;
  const escaped = norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
  return regex.test(texto);
}

function classificarHeuristico(mensagensUteis) {
  // Priorizar mensagens recentes do cliente
  const msgsCliente = mensagensUteis
    .filter(m => m.remetente_tipo !== 'voxx' && !m.from_me && m.origem !== 'enviada')
    .slice(-10);

  const msgsVoxx = mensagensUteis
    .filter(m => m.remetente_tipo === 'voxx' || m.from_me || m.origem === 'enviada')
    .slice(-5);

  const textoCliente = msgsCliente.map(m => {
    if (m.tipo_mensagem === 'audio') return m.transcricao_audio || '';
    return m.mensagem || '';
  }).join(' ');

  const textoVoxx = msgsVoxx.map(m => {
    if (m.tipo_mensagem === 'audio') return m.transcricao_audio || '';
    return m.mensagem || '';
  }).join(' ');

  const textoCombinado = textoCliente + ' ' + textoVoxx;
  const textoNorm = normalizarTexto(textoCombinado);

  const resultados = {};
  let termosSensiveisDetectados = [];

  for (const [categoria, dict] of Object.entries(DICIONARIO_CATEGORIAS)) {
    let score = 0;
    const termosDetectados = [];

    for (const termo of (dict.termos_diretos || [])) {
      if (termoPresente(textoNorm, termo)) {
        score += 3;
        termosDetectados.push(termo);
      }
    }

    for (const termo of (dict.sinonimos || [])) {
      if (termoPresente(textoNorm, termo)) {
        score += 1;
        termosDetectados.push(termo);
      }
    }

    if (dict.termos_inequivocos) {
      for (const termo of dict.termos_inequivocos) {
        if (termoPresente(textoNorm, termo)) {
          termosSensiveisDetectados.push(termo);
          score += 4;
        }
      }
    }

    resultados[categoria] = { score, termos: termosDetectados };
  }

  // Detectar sensibilidade universal
  const textoClienteNorm = normalizarTexto(textoCliente);
  for (const termo of TERMOS_SENSIVEIS_UNIVERSAIS) {
    if (termoPresente(textoClienteNorm, termo)) {
      termosSensiveisDetectados.push(termo);
    }
  }

  // Ordenar categorias por score (excluindo padrao_comunicacao como principal)
  const categoriasOrdenadas = Object.entries(resultados)
    .map(([cat, r]) => ({ categoria: cat, score: r.score, termos: r.termos }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score);

  const naoPadrao = categoriasOrdenadas.filter(c => c.categoria !== 'padrao_comunicacao');
  const principal = naoPadrao.length > 0 ? naoPadrao[0] : null;

  let confianca = 'sem';
  if (principal) {
    if (principal.score >= 4) confianca = 'alta';
    else if (principal.score >= 2) confianca = 'baixa';
    else confianca = 'sem';
  }

  const sensivel = termosSensiveisDetectados.length > 0 ||
    (resultados.reclamacoes_sensiveis?.score >= 2) ||
    (resultados.contratos_financeiro?.score >= 2);

  return {
    categoria_principal: principal?.categoria || null,
    confianca,
    sensivel,
    termos_detectados: principal?.termos || [],
    termos_sensiveis_detectados: [...new Set(termosSensiveisDetectados)],
    categorias_candidatas: categoriasOrdenadas.map(c => ({ categoria: c.categoria, score: c.score }))
  };
}

// ════════════════════════════════════════════════════════════
//  SELEÇÃO DE CONHECIMENTO
// ════════════════════════════════════════════════════════════

const ESCOPO_PRECEDENCIA = { cliente: 4, marca: 3, segmento: 2, global: 1 };

async function selecionarOrientacoes(sdk, classificacao, cliente) {
  // Buscar orientações ativas aplicáveis ao escopo
  let candidatas = [];

  // 1. Globais
  const globais = await sdk.entities.CopilotConhecimento.filter({ ativa: true, escopo_tipo: 'global' });
  candidatas.push(...globais);

  if (cliente) {
    // 2. Segmento
    if (cliente.tipo_cliente) {
      const todasSegmento = await sdk.entities.CopilotConhecimento.filter({ ativa: true, escopo_tipo: 'segmento' });
      const normSeg = normalizarTexto(cliente.tipo_cliente);
      candidatas.push(...todasSegmento.filter(o => normalizarTexto(o.escopo_segmento) === normSeg));
    }

    // 3. Marca
    if (cliente.marca) {
      const todasMarca = await sdk.entities.CopilotConhecimento.filter({ ativa: true, escopo_tipo: 'marca' });
      const normMar = normalizarTexto(cliente.marca);
      candidatas.push(...todasMarca.filter(o => normalizarTexto(o.escopo_marca) === normMar));
    }

    // 4. Cliente específico
    const todasCliente = await sdk.entities.CopilotConhecimento.filter({ ativa: true, escopo_tipo: 'cliente' });
    candidatas.push(...todasCliente.filter(o => o.escopo_cliente_id === cliente.id));
  }

  // Deduplicar
  const seen = new Set();
  candidatas = candidatas.filter(o => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });

  if (candidatas.length === 0) {
    return { orientacoes: [], ids_utilizados: [], fallback: true };
  }

  // Determinar categorias a incluir
  const categoriasParaIncluir = new Set();
  if (classificacao.confianca === 'alta' && classificacao.categoria_principal) {
    categoriasParaIncluir.add(classificacao.categoria_principal);
  }
  if (classificacao.sensivel) {
    categoriasParaIncluir.add('reclamacoes_sensiveis');
    categoriasParaIncluir.add('contratos_financeiro');
  }

  // Filtrar por relevância
  let selecionadas = [];

  for (const o of candidatas) {
    if (o.obrigatoria) {
      // Obrigatórias: incluir conforme confiança
      if (classificacao.confianca === 'alta') {
        selecionadas.push(o);
      } else if (classificacao.confianca === 'baixa') {
        if (o.escopo_tipo === 'global' || categoriasParaIncluir.has(o.categoria)) {
          selecionadas.push(o);
        }
      } else {
        // Sem confiança: somente globais obrigatórias
        if (o.escopo_tipo === 'global') {
          selecionadas.push(o);
        }
      }
    } else {
      // Não obrigatórias: incluir apenas se categoria corresponder e confiança for alta
      if (classificacao.confianca === 'alta' && categoriasParaIncluir.has(o.categoria)) {
        selecionadas.push(o);
      } else if (classificacao.confianca === 'baixa' && classificacao.sensivel && categoriasParaIncluir.has(o.categoria)) {
        // Sensíveis inequívocas em baixa confiança
        selecionadas.push(o);
      }
    }
  }

  if (selecionadas.length === 0) {
    return { orientacoes: [], ids_utilizados: [], fallback: true };
  }

  // Resolver conflitos por chave_tematica
  const porChave = {};
  const semChave = [];

  for (const o of selecionadas) {
    if (o.chave_tematica && o.chave_tematica.trim()) {
      const chave = normalizarTexto(o.chave_tematica);
      if (!porChave[chave]) porChave[chave] = [];
      porChave[chave].push(o);
    } else {
      semChave.push(o);
    }
  }

  let resolvidas = [...semChave];
  const conflitosDetectados = [];

  for (const [chave, grupo] of Object.entries(porChave)) {
    if (grupo.length === 1) {
      resolvidas.push(grupo[0]);
    } else {
      // Múltiplas com mesma chave — verificar se são mesma categoria
      // Agrupar por categoria (NÃO por categoria+escopo) para aplicar precedência de escopo
      const porCategoria = {};
      for (const o of grupo) {
        if (!porCategoria[o.categoria]) porCategoria[o.categoria] = [];
        porCategoria[o.categoria].push(o);
      }

      for (const [categoria, subgrupo] of Object.entries(porCategoria)) {
        if (subgrupo.length === 1) {
          resolvidas.push(subgrupo[0]);
        } else {
          // Múltiplas com mesma chave + categoria em escopos diferentes
          // Aplicar precedência: cliente > marca > segmento > global
          subgrupo.sort((a, b) => (ESCOPO_PRECEDENCIA[b.escopo_tipo] || 0) - (ESCOPO_PRECEDENCIA[a.escopo_tipo] || 0));
          const maxPrec = ESCOPO_PRECEDENCIA[subgrupo[0].escopo_tipo] || 0;
          const top = subgrupo.filter(o => (ESCOPO_PRECEDENCIA[o.escopo_tipo] || 0) === maxPrec);

          if (top.length === 1) {
            resolvidas.push(top[0]);
          } else {
            // Mesmo escopo: manter a de maior prioridade
            top.sort((a, b) => (b.prioridade || 5) - (a.prioridade || 5));
            if (top.length === 2 && top[0].prioridade !== top[1].prioridade) {
              resolvidas.push(top[0]);
            } else {
              // Conflito irresolveível: NÃO incluir nenhuma
              for (const o of top) {
                conflitosDetectados.push({
                  id: o.id,
                  chave_tematica: chave,
                  categoria: o.categoria,
                  escopo_tipo: o.escopo_tipo
                });
              }
              console.warn(`[CopilotKB] Conflito irresolvevel: chave=${chave} categoria=${categoria} ids=${top.map(o => o.id).join(',')}`);
            }
          }
        }
      }
    }
  }

  // Deduplicar resolvidas
  const seenRes = new Set();
  resolvidas = resolvidas.filter(o => {
    if (seenRes.has(o.id)) return false;
    seenRes.add(o.id);
    return true;
  });

  // Aplicar limites
  // Priorizar: 1. restrições, 2. revisão obrigatória, 3. cliente, 4. marca, 5. segmento, 6. global, 7. prioridade, 8. relevância
  resolvidas.sort((a, b) => {
    const prioridadeTipo = { restricao: 1, revisao_obrigatoria: 2, info_exige_confirmacao: 3, regra_operacional: 4, info_autorizada: 5, procedimento: 6, tom_linguagem: 7 };
    const pa = prioridadeTipo[a.tipo_orientacao] || 8;
    const pb = prioridadeTipo[b.tipo_orientacao] || 8;
    if (pa !== pb) return pa - pb;
    const ea = ESCOPO_PRECEDENCIA[a.escopo_tipo] || 0;
    const eb = ESCOPO_PRECEDENCIA[b.escopo_tipo] || 0;
    if (ea !== eb) return eb - ea;
    return (b.prioridade || 5) - (a.prioridade || 5);
  });

  const MAX_ORIENTACOES = 8;
  const MAX_OBRIGATORIAS = 3;
  const MAX_CHARS_BLOCO = 3000;
  const MAX_CHARS_ORIENTACAO = 800;

  let obrigatóriasCount = 0;
  let totalChars = 0;
  let finais = [];

  for (const o of resolvidas) {
    if (finais.length >= MAX_ORIENTACOES) break;
    if (o.obrigatoria && obrigatóriasCount >= MAX_OBRIGATORIAS) continue;

    const conteudo = (o.conteudo || '').substring(0, MAX_CHARS_ORIENTACAO);
    const entrada = `[${o.tipo_orientacao}] ${conteudo}\n`;
    const charsEntrada = entrada.length;

    if (totalChars + charsEntrada > MAX_CHARS_BLOCO) {
      // Não truncar no meio — pular
      continue;
    }

    finais.push(o);
    totalChars += charsEntrada;
    if (o.obrigatoria) obrigatóriasCount++;
  }

  return {
    orientacoes: finais,
    ids_utilizados: finais.map(o => o.id),
    fallback: finais.length === 0,
    conflitos_detectados: conflitosDetectados
  };
}

function montarBlocoConhecimento(orientacoes) {
  if (!orientacoes || orientacoes.length === 0) return '';

  const linhas = orientacoes.map(o => {
    const conteudo = (o.conteudo || '').substring(0, 800);
    return `[${o.tipo_orientacao}] ${conteudo}`;
  });

  const bloco = `## ORIENTAÇÕES DA BASE DE CONHECIMENTO

As orientações abaixo foram selecionadas com base no contexto da conversa. Siga-as ao gerar a resposta:

${linhas.join('\n\n')}

### Instruções por tipo de orientação:
- [tom_linguagem]: direciona o estilo da resposta.
- [regra_operacional]: NÃO comunique como ação realizada; é procedimento interno da VOXX.
- [restricao]: NUNCA viole esta restrição.
- [procedimento]: orientação de como responder ou proceder.
- [info_autorizada]: pode ser comunicada quando relevante.
- [info_exige_confirmacao]: NÃO apresente como fato confirmado ao cliente.
- [revisao_obrigatoria]: marque necessidade_revisao como true.`;

  return bloco;
}

// ════════════════════════════════════════════════════════════
//  HANDLER PRINCIPAL
// ════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── Validar permissão: somente colaboradores VOXX ou admin da plataforma ──
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

    // ── 1. Buscar mensagens recentes da conversa ──────────────
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

    // ── 2. Filtrar e limpar mensagens ─────────────────────────
    const TIPOS_IGNORAR = ['sistema', 'atividade', 'sem_conteudo', 'reacao'];
    const mensagensUteis = mensagens
      .filter(m => !m.deletado)
      .filter(m => !TIPOS_IGNORAR.includes(m.tipo_mensagem))
      .slice(0, 25)
      .reverse();

    if (mensagensUteis.length === 0) {
      return Response.json({ error: 'Não há mensagens com conteúdo útil nesta conversa.' }, { status: 400 });
    }

    // ── 3. Buscar dados do cliente ────────────────────────────
    let cliente = null;
    if (clienteId) {
      try {
        cliente = await sdk.entities.Cliente.get(clienteId);
      } catch (_) { /* ignora se não encontrar */ }
    }

    // ── 4. Montar contexto do cliente ─────────────────────────
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

    // ── 5. Classificação heurística (ANTES do InvokeLLM) ─────
    let classificacao = { categoria_principal: null, confianca: 'sem', sensivel: false, termos_detectados: [], termos_sensiveis_detectados: [], categorias_candidatas: [] };
    try {
      classificacao = classificarHeuristico(mensagensUteis);
    } catch (e) {
      // Erro na classificação não impede o fluxo
    }

    // ── 5b. Detectar relatório/alinhamento de leads e recuperar histórico ──
    let deteccaoRelatorioLeads = { detectado: false, matches: 0, termos: [], metricas_informais: 0, metricas_informais_termos: [] };
    let relatoriosHistoricos = [];
    let blocoRelatorios = '';
    let relatorioLeadsAtivo = false;
    let metaRelatorios = {};

    try {
      deteccaoRelatorioLeads = detectarRelatorioLeads(mensagensUteis);
      if (deteccaoRelatorioLeads.detectado) {
        const gruposContexto = consolidarMensagensConsecutivas(mensagensUteis);
        const relatoriosContextoConsolidados = gruposContexto.filter(g => {
          const texto = g.texto_completado || '';
          const norm = normalizarTexto(texto);
          if (TERMOS_RELATORIO_LEADS.some(termo => termoPresente(norm, termo))) return true;
          return detectarMetricasQuantitativas(texto).count >= 2;
        });

        const idsAtuais = mensagensUteis.map(m => m.id);
        relatoriosHistoricos = await recuperarRelatoriosHistoricos(sdk, chatId, idsAtuais);
        const gruposHistoricos = consolidarMensagensConsecutivas(relatoriosHistoricos);

        const analise = construirBlocoAnaliseLeads(relatoriosContextoConsolidados, gruposHistoricos);
        blocoRelatorios = analise.bloco;
        metaRelatorios = analise.meta;
        relatorioLeadsAtivo = true;
      }
    } catch (e) {
      // Falha na recuperação de relatórios não impede o fluxo principal
      relatoriosHistoricos = [];
      blocoRelatorios = '';
      relatorioLeadsAtivo = false;
    }

    // ── 6. Selecionar orientações da base de conhecimento ────
    let conhecimento = { orientacoes: [], ids_utilizados: [], fallback: true, conflitos_detectados: [] };
    let blocoConhecimento = '';
    let conhecimentoUsado = false;

    try {
      conhecimento = await selecionarOrientacoes(sdk, classificacao, cliente);
      if (!conhecimento.fallback && conhecimento.orientacoes.length > 0) {
        blocoConhecimento = montarBlocoConhecimento(conhecimento.orientacoes);
        conhecimentoUsado = true;
      }
    } catch (e) {
      // Erro na base de conhecimento não impede o fluxo — comportamento MVP
      conhecimento = { orientacoes: [], ids_utilizados: [], fallback: true, conflitos_detectados: [] };
    }

    // ── 7. Montar linhas formatadas do histórico ─────────────
    const linhasFormatadas = mensagensUteis.map(m => {
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
        texto = (m.mensagem || '').replace(/\n*— [^\n]+ \| Voxx\n*$/, '').trim();
        if (!texto) texto = '[Sem conteúdo textual]';
      }

      if (texto.length > 500) texto = texto.substring(0, 500) + '...';
      return `[${horario}] [${autor}] ${nome}: ${texto}`;
    });

    // ── 8. Limite global do bloco de histórico ───────────────
    const LIMITE_CHARS_HISTORICO = 12000;
    let linhasFinais = [];
    let totalChars = 0;
    for (let i = linhasFormatadas.length - 1; i >= 0; i--) {
      const linha = linhasFormatadas[i];
      const charsLinha = linha.length + 1;
      if (totalChars + charsLinha > LIMITE_CHARS_HISTORICO && linhasFinais.length > 0) {
        break;
      }
      totalChars += charsLinha;
      linhasFinais.unshift(linha);
    }
    const historico = linhasFinais.join('\n');

    // ── 9. Contexto de resposta e melhoria ────────────────────
    const contextoResposta = respondendoTexto
      ? `\n## MENSAGEM SENDO RESPONDIDA\nO colaborador está respondendo a esta mensagem de ${respondendoRemetente || 'um participante'}:\n"${respondendoTexto.substring(0, 300)}"\n`
      : '';

    const contextoMelhoria = (acao === 'melhorar' && textoExistente)
      ? `\n## TEXTO A MELHORAR\nO colaborador já escreveu o seguinte texto. Aprore-o sem alterar informações factuais, mantendo o sentido original:\n"${textoExistente}"\n`
      : '';

    // ── 10. Montar prompt com bloco de conhecimento ──────────
    const blocoKB = conhecimentoUsado ? `\n${blocoConhecimento}\n` : '';
    const blocoRelatoriosPrompt = relatorioLeadsAtivo && blocoRelatorios ? `\n${blocoRelatorios}\n` : '';

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
${blocoKB}${blocoRelatoriosPrompt}
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

    // ── 11. Invocar LLM ───────────────────────────────────────
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

    // ── 12. Validar resposta ─────────────────────────────────
    if (!resultado || !resultado.mensagem_sugerida || !resultado.mensagem_sugerida.trim()) {
      return Response.json({ error: 'A IA não retornou uma sugestão válida. Tente novamente.' }, { status: 500 });
    }

    // Remover assinatura
    let sugestaoLimpa = resultado.mensagem_sugerida
      .replace(/\s*—\s+[^\n]{1,60}\|\s*Voxx\s*$/i, '')
      .replace(/^—\s+[^\n]{1,60}\|\s*Voxx\s*\n+/i, '')
      .trim();

    // Forçar necessidade_revisao se houve orientação revisao_obrigatoria aplicável
    let necessidadeRevisao = !!resultado.necessidade_revisao;
    if (conhecimentoUsado) {
      const temRevisaoObrigatoria = conhecimento.orientacoes.some(o => o.tipo_orientacao === 'revisao_obrigatoria');
      if (temRevisaoObrigatoria) {
        necessidadeRevisao = true;
      }
    }

    // 12 (cont.) — assunto_identificado retornado apenas como metadado/validação
    return Response.json({
      mensagem_sugerida: sugestaoLimpa,
      assunto_identificado: resultado.assunto_identificado || 'Não identificado',
      necessidade_revisao: necessidadeRevisao,
      alerta_risco: resultado.alerta_risco || '',
      informacoes_ausentes: resultado.informacoes_ausentes || '',
      // Metadados internos (não exibidos ao cliente)
      _meta: {
        categoria_heuristica: classificacao.categoria_principal,
        confianca: classificacao.confianca,
        sensivel: classificacao.sensivel,
        orientacoes_utilizadas: conhecimento.ids_utilizados,
        conhecimento_usado: conhecimentoUsado,
        kb_fallback: conhecimento.fallback,
        conflito_detectado: (conhecimento.conflitos_detectados || []).length > 0,
        relatorio_leads_detectado: deteccaoRelatorioLeads.detectado,
        relatorio_leads_ativo: relatorioLeadsAtivo,
        relatorios_detectados: metaRelatorios.relatorios_detectados || 0,
        relatorios_consolidados: metaRelatorios.relatorios_consolidados || 0,
        relatorios_com_metricas: metaRelatorios.relatorios_com_metricas || 0,
        relatorios_comparaveis: metaRelatorios.relatorios_comparaveis || 0,
        relatorios_nao_comparaveis: metaRelatorios.relatorios_nao_comparaveis || 0,
        motivos_nao_comparabilidade: metaRelatorios.motivos_nao_comparabilidade || [],
        periodo_analisado_inicio: metaRelatorios.periodo_analisado_inicio,
        periodo_analisado_fim: metaRelatorios.periodo_analisado_fim,
        periodicidades_identificadas: metaRelatorios.periodicidades_identificadas || [],
        tendencias_identificadas: metaRelatorios.tendencias_identificadas || 0,
        utilizou_historico_especializado: metaRelatorios.utilizou_historico_especializado || false,
        confianca_comparacao: metaRelatorios.confianca_comparacao || 'baixa',
        fallback: metaRelatorios.fallback || false,
        motivo_fallback: metaRelatorios.motivo_fallback || '',
        mensagens_consolidadas: metaRelatorios.mensagens_consolidadas || 0,
        alertas_extracao: metaRelatorios.alertas_extracao || [],
        data_referencia_inicio: metaRelatorios.data_referencia_inicio || null,
        data_referencia_fim: metaRelatorios.data_referencia_fim || null,
        datas_agendamentos_futuros: metaRelatorios.datas_agendamentos_futuros || [],
        datas_oportunidades_futuras: metaRelatorios.datas_oportunidades_futuras || [],
        outras_datas_identificadas: metaRelatorios.outras_datas_identificadas || [],
        confianca_data_referencia: metaRelatorios.confianca_data_referencia || 'baixa',
        metricas_informais_detectadas: deteccaoRelatorioLeads.metricas_informais || 0,
      }
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
});