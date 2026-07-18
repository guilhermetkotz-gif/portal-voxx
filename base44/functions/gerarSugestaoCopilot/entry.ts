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
//  DETECÇÃO DE RELATÓRIO/ALINHAMENTO DE LEADS
// ════════════════════════════════════════════════════════════

const TERMOS_RELATORIO_LEADS = [
  'relatorio de leads', 'relatório de leads', 'alinhamento de leads', 'alinhamento',
  'total de leads', 'leads do dia', 'leads da semana', 'leads de hoje',
  'leads recebidos', 'leads gerados', 'leads captados', 'quantidade de leads',
  'agendamentos', 'agendamento', 'agendou', 'agendar',
  'compareceu', 'faltou', 'desmarcou', 'reagendou',
  'sem contato', 'sem_contato', 'sem resposta', 'sem retorno',
  'kanban', 'duplicidades', 'duplicidade', 'duplicado', 'duplicada',
  'distancia', 'distância', 'longe', 'muito longe',
  'orcamento', 'orçamento', 'poder aquisitivo', 'sem poder aquisitivo',
  'qualidade dos contatos', 'qualidade dos leads', 'perfil dos contatos', 'perfil dos leads',
  'tratamento', 'implante', 'protese', 'prótese', 'ortodontia', 'lentes',
  'conversao', 'conversão', 'taxa de conversao', 'taxa de conversão',
  'perda', 'perdeu', 'fechou em outro', 'sem interesse',
  'leads meta', 'leads google', 'leads facebook', 'leads instagram',
];

function detectarRelatorioLeads(mensagensUteis) {
  // Analisa as últimas mensagens (cliente + VOXX) para detectar relatório/alinhamento de leads
  const recentes = mensagensUteis.slice(-8);
  const texto = recentes.map(m => {
    if (m.tipo_mensagem === 'audio') return m.transcricao_audio || '';
    return m.mensagem || '';
  }).join(' ');
  const norm = normalizarTexto(texto);

  let matches = 0;
  const termosEncontrados = [];
  for (const termo of TERMOS_RELATORIO_LEADS) {
    if (termoPresente(norm, termo)) {
      matches++;
      termosEncontrados.push(termo);
    }
  }

  // Pelo menos 2 termos distintos OU 1 termo muito específico
  const termosEspecificos = ['relatorio de leads', 'relatório de leads', 'alinhamento de leads', 'total de leads', 'kanban'];
  const temEspecifico = termosEspecificos.some(t => termoPresente(norm, t));

  const detectado = matches >= 2 || (temEspecifico && matches >= 1);
  return { detectado, matches, termos: termosEncontrados };
}

async function recuperarRelatoriosHistoricos(sdk, chatId, idsJaNoContexto) {
  // Buscar volume maior para cobrir ~14 dias de conversa ativa
  const todasMsgs = await sdk.entities.WhatsappMensagem.filter(
    { grupo_id: chatId },
    '-received_at',
    200
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const idsSet = new Set(idsJaNoContexto);

  const relatorios = (todasMsgs || [])
    .filter(m => !m.deletado)
    .filter(m => !['sistema', 'atividade', 'sem_conteudo', 'reacao'].includes(m.tipo_mensagem))
    .filter(m => {
      const ts = m.received_at || m.timestamp_mensagem;
      if (!ts) return false;
      return new Date(ts) >= cutoff;
    })
    .filter(m => !idsSet.has(m.id)) // excluir mensagens já no contexto atual
    .filter(m => {
      const texto = m.tipo_mensagem === 'audio'
        ? (m.transcricao_audio || '')
        : (m.mensagem || '');
      if (!texto || !texto.trim()) return false;
      const norm = normalizarTexto(texto);
      return TERMOS_RELATORIO_LEADS.some(termo => termoPresente(norm, termo));
    })
    .slice(0, 10);

  return relatorios;
}

function extrairMetricasLeads(texto) {
  if (!texto) return {};
  const norm = normalizarTexto(texto);
  const metricas = {};
  let m;

  m = norm.match(/(?:total\s+de\s+)?(\d+)\s+leads?/) || norm.match(/leads?\s*[:\-]\s*(\d+)/);
  if (m) metricas.total_leads = parseInt(m[1]);

  m = norm.match(/(\d+)\s+agendamentos?/) || norm.match(/agendaram\s+(\d+)/);
  if (m) metricas.agendamentos = parseInt(m[1]);

  m = norm.match(/(\d+)\s+compareceram/) || norm.match(/compareceu\s+(\d+)/);
  if (m) metricas.comparecimentos = parseInt(m[1]);

  m = norm.match(/(\d+)\s+faltaram/) || norm.match(/faltou\s+(\d+)/);
  if (m) metricas.faltas = parseInt(m[1]);

  m = norm.match(/(\d+)\s+desmarcou/);
  if (m) metricas.desmarcou = parseInt(m[1]);

  m = norm.match(/(\d+)\s+sem\s+contato/) || norm.match(/(\d+)\s+sem\s+resposta/) || norm.match(/(\d+)\s+sem\s+retorno/);
  if (m) metricas.sem_contato = parseInt(m[1]);

  m = norm.match(/(\d+)\s+duplicidades?/) || norm.match(/(\d+)\s+duplicad[ao]s?/);
  if (m) metricas.duplicidades = parseInt(m[1]);

  m = norm.match(/(\d+)\s+perderam/) || norm.match(/(\d+)\s+perdas?/);
  if (m) metricas.perdas = parseInt(m[1]);

  const motivos = [];
  if (termoPresente(norm, 'distancia') || termoPresente(norm, 'longe')) motivos.push('distância');
  if (termoPresente(norm, 'poder aquisitivo') || termoPresente(norm, 'orcamento')) motivos.push('orçamento');
  if (termoPresente(norm, 'sem interesse')) motivos.push('sem interesse');
  if (termoPresente(norm, 'fechou em outro')) motivos.push('concorrência');
  if (motivos.length > 0) metricas.motivos_perda = motivos;

  return metricas;
}

function construirBlocoAnaliseLeads(relatoriosContexto, relatoriosHistoricos) {
  const todos = [
    ...(relatoriosHistoricos || []),
    ...(relatoriosContexto || []),
  ].map(msg => {
    const texto = msg.tipo_mensagem === 'audio'
      ? (msg.transcricao_audio || '')
      : (msg.mensagem || '');
    const metricas = extrairMetricasLeads(texto);
    return { data: msg.received_at || msg.timestamp_mensagem, metricas };
  }).sort((a, b) => {
    const ta = new Date(a.data || 0).getTime();
    const tb = new Date(b.data || 0).getTime();
    return ta - tb;
  });

  const comMetricas = todos.filter(r => Object.keys(r.metricas).length > 0);

  let tendencias = null;
  if (comMetricas.length >= 2) {
    tendencias = {};
    const campos = ['total_leads', 'agendamentos', 'comparecimentos', 'faltas', 'desmarcou', 'sem_contato', 'duplicidades', 'perdas'];
    for (const campo of campos) {
      const valores = comMetricas.map(r => r.metricas[campo]).filter(v => v !== undefined && v !== null);
      if (valores.length < 2) continue;
      const primeiro = valores[0];
      const ultimo = valores[valores.length - 1];
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
  }

  const nomesMetricas = {
    total_leads: 'Leads', agendamentos: 'Agend.', comparecimentos: 'Comp.',
    faltas: 'Faltas', desmarcou: 'Desm.', sem_contato: 'S/contato',
    duplicidades: 'Dupl.', perdas: 'Perdas',
  };

  const linhasTimeline = comMetricas.map(r => {
    const data = r.data
      ? new Date(r.data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
      : 'Sem data';
    const partes = Object.entries(nomesMetricas)
      .map(([k, label]) => r.metricas[k] !== undefined ? `${label}: ${r.metricas[k]}` : null)
      .filter(Boolean);
    if (r.metricas.motivos_perda && r.metricas.motivos_perda.length > 0) {
      partes.push(`Motivos perda: ${r.metricas.motivos_perda.join(', ')}`);
    }
    return `[${data}] ${partes.join(' | ')}`;
  });

  const nomesTendencias = {
    total_leads: 'Volume de leads', agendamentos: 'Agendamentos',
    comparecimentos: 'Comparecimentos', faltas: 'Faltas', desmarcou: 'Desmarcações',
    sem_contato: 'Sem contato', duplicidades: 'Duplicidades', perdas: 'Perdas',
  };

  const linhasTendencias = tendencias && Object.keys(tendencias).length > 0
    ? Object.entries(tendencias).map(([campo, t]) => {
        const nome = nomesTendencias[campo] || campo;
        const pctStr = t.pct !== null ? ` (${t.pct > 0 ? '+' : ''}${t.pct}%)` : '';
        return `- ${nome}: ${t.direcao}${pctStr} (${t.primeiro} → ${t.ultimo})`;
      })
    : [];

  const linhasRaw = (relatoriosHistoricos || []).map(m => {
    const ts = m.received_at || m.timestamp_mensagem;
    const horario = ts
      ? new Date(ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : 'Sem data';
    const isVoxx = m.remetente_tipo === 'voxx' || m.origem === 'enviada' || m.from_me;
    const autor = isVoxx ? 'VOXX' : 'Cliente';
    const nome = m.remetente_nome || 'Desconhecido';
    let texto = '';
    if (m.tipo_mensagem === 'audio') {
      texto = m.transcricao_audio ? `[Áudio] ${m.transcricao_audio}` : '[Áudio sem transcrição]';
    } else if (m.tipo_mensagem === 'imagem') {
      texto = m.mensagem && m.mensagem.trim() ? `[Imagem] ${m.mensagem}` : '[Imagem sem legenda]';
    } else {
      texto = (m.mensagem || '').replace(/\n*— [^\n]+ \| Voxx\n*$/, '').trim();
    }
    if (texto.length > 600) texto = texto.substring(0, 600) + '...';
    return `[${horario}] [${autor}] ${nome}: ${texto}`;
  });

  let bloco = `## ANÁLISE ESTRUTURADA DE RELATÓRIO DE LEADS\n`;
  bloco += `\n### Linha do tempo de métricas extraídas:\n`;
  bloco += linhasTimeline.length > 0
    ? linhasTimeline.join('\n')
    : 'Não foi possível extrair métricas estruturadas dos relatórios.';

  if (linhasTendencias.length > 0) {
    bloco += `\n\n### Tendências identificadas (comparação entre relatórios):\n${linhasTendencias.join('\n')}`;
  } else if (comMetricas.length < 2) {
    bloco += `\n\n### Tendências: dados insuficientes para comparação (apenas ${comMetricas.length} relatório com métricas extraídas).`;
  }

  if (linhasRaw.length > 0) {
    bloco += `\n\n### Relatórios anteriores (texto original):\n${linhasRaw.join('\n')}`;
  }

  bloco += `

### Instruções para análise de relatório de leads:
- Diferencie corretamente os status do funil de leads: Leads recebidos → Agendamentos → Comparecimentos → Faltas/Perdas.
- Leads recebidos e agendamentos refletem volume e atração (topo do funil).
- Comparecimentos, faltas e perdas refletem qualificação e operação (fundo do funil).
- Apresente tendências SOMENTE quando houver dados comparáveis entre 2 ou mais relatórios na linha do tempo acima.
- NÃO invente percentuais, metas ou comparações não presentes nos dados extraídos.
- NÃO diga apenas "vamos acompanhar" quando o histórico já permitir uma análise concreta.
- NÃO sugira alteração de campanha (orçamento, segmentação, criativos) sem relacioná-la a uma tendência observada nos dados.
- Se a variação negativa estiver em comparecimentos ou faltas (fundo do funil), o problema é operacional, não de campanha — NÃO sugira ajuste de tráfego.
- Se a variação negativa estiver em volume de leads (topo do funil), aí pode ser relevante sugerir revisão de campanha.
- Distinga perdas por distância/orçamento (qualificação do lead) de perdas por concorrência ou falta de interesse (criativo/mensagem).
- Quando os dados forem insuficientes ou não comparáveis entre relatórios, indique isso explicitamente na resposta.`;

  return { bloco, totalTendencias: linhasTendencias.length, totalComMetricas: comMetricas.length };
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
    let deteccaoRelatorioLeads = { detectado: false, matches: 0, termos: [] };
    let relatoriosHistoricos = [];
    let blocoRelatorios = '';
    let relatorioLeadsAtivo = false;

    let totalTendencias = 0;
    let totalRelatoriosComMetricas = 0;

    try {
      deteccaoRelatorioLeads = detectarRelatorioLeads(mensagensUteis);
      if (deteccaoRelatorioLeads.detectado) {
        const relatoriosContexto = mensagensUteis.filter(m => {
          const texto = m.tipo_mensagem === 'audio' ? (m.transcricao_audio || '') : (m.mensagem || '');
          if (!texto || !texto.trim()) return false;
          const norm = normalizarTexto(texto);
          return TERMOS_RELATORIO_LEADS.some(termo => termoPresente(norm, termo));
        });
        const idsAtuais = mensagensUteis.map(m => m.id);
        relatoriosHistoricos = await recuperarRelatoriosHistoricos(sdk, chatId, idsAtuais);
        const analise = construirBlocoAnaliseLeads(relatoriosContexto, relatoriosHistoricos);
        blocoRelatorios = analise.bloco;
        totalTendencias = analise.totalTendencias;
        totalRelatoriosComMetricas = analise.totalComMetricas;
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
        fallback: conhecimento.fallback,
        conflito_detectado: (conhecimento.conflitos_detectados || []).length > 0,
        relatorio_leads_detectado: deteccaoRelatorioLeads.detectado,
        relatorios_historicos_recuperados: relatoriosHistoricos.length,
        relatorio_leads_ativo: relatorioLeadsAtivo,
        relatorios_com_metricas: totalRelatoriosComMetricas,
        tendencias_identificadas: totalTendencias
      }
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
});