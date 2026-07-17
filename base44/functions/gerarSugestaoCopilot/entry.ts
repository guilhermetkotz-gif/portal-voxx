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
    termos_diretos: ['meta ads', 'google ads', 'facebook ads', 'instagram ads', 'campanha', 'tráfego', 'anúncio', 'impulsionar'],
    sinonimos: ['leads', 'contatos', 'conversões', 'cpl', 'cpc', 'ctr', 'investimento', 'gasto', 'resultado', 'queda', 'diminuiu', 'aumentou', 'cliques', 'visualizações', 'alcance', 'impressões']
  },
  criacao_artes: {
    termos_diretos: ['arte', 'design', 'banner', 'cartaz', 'flyer', 'peça gráfica', 'logotipo', 'identidade visual'],
    sinonimos: ['imagem', 'criativo', 'layout', 'paleta', 'tipografia', 'montagem', 'edição']
  },
  conteudo_redes_sociais: {
    termos_diretos: ['redes sociais', 'instagram', 'facebook', 'post', 'reels', 'stories', 'conteúdo', 'calendário'],
    sinonimos: ['publicação', 'legenda', 'feed', 'perfil', 'engajamento', 'seguidores', 'hashtag']
  },
  operacao_atendimento: {
    termos_diretos: ['atendimento', 'operacional', 'equipe', 'processo', 'fluxo'],
    sinonimos: ['tempo de resposta', 'demora', 'aguardando', 'andamento', 'status']
  },
  reclamacoes_sensiveis: {
    termos_diretos: ['reclamação', 'processo jurídico', 'advogado', 'ameaça', 'insatisfação', 'elogio à concorrência'],
    sinonimos: ['chateado', 'frustrado', 'decepcionado', 'irritado', 'revoltado'],
    termos_inequivocos: ['cobrança indevida', 'vão processar', 'advogado', 'ação judicial', 'procon']
  },
  contratos_financeiro: {
    termos_diretos: ['contrato', 'faturamento', 'cobrança', 'boleto', 'nota fiscal', 'pagamento', 'vencimento', 'renovação'],
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
      const porCategoriaEscopo = {};
      for (const o of grupo) {
        const key = `${o.categoria}|${o.escopo_tipo}`;
        if (!porCategoriaEscopo[key]) porCategoriaEscopo[key] = [];
        porCategoriaEscopo[key].push(o);
      }

      for (const [comboKey, subgrupo] of Object.entries(porCategoriaEscopo)) {
        if (subgrupo.length === 1) {
          resolvidas.push(subgrupo[0]);
        } else {
          // Conflito real: mesma chave + categoria + escopo
          // Ordenar por precedência de escopo (mais específico vence)
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
              console.warn(`[CopilotKB] Conflito irresolveível: ${JSON.stringify(conflitosDetectados[conflitosDetectados.length - 1])}`);
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
${blocoKB}
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
        conflito_detectado: (conhecimento.conflitos_detectados || []).length > 0
      }
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
});