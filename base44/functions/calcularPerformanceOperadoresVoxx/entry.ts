import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── Horário útil (America/Sao_Paulo) ───────────────────────────
const BLOCOS_MINUTOS = [
  { inicio: 8 * 60, fim: 12 * 60 },
  { inicio: 13 * 60 + 13, fim: 18 * 60 },
];

function calcularMinutosUteis(inicio, fim) {
  const i = new Date(inicio);
  const f = new Date(fim);
  if (isNaN(i) || isNaN(f) || f <= i) return 0;

  let cursor = new Date(i);
  let total = 0;

  while (cursor < f) {
    const localStr = cursor.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const localDate = new Date(localStr);
    const diaSemana = localDate.getDay();
    const ehFimDeSemana = diaSemana === 0 || diaSemana === 6;

    if (!ehFimDeSemana) {
      const fimDiaLocal = new Date(localDate);
      fimDiaLocal.setHours(23, 59, 59, 999);
      const limiteMs = f < fimDiaLocal ? f.getTime() : fimDiaLocal.getTime();

      const minsCursor = localDate.getHours() * 60 + localDate.getMinutes();
      const limiteLocal = new Date(limiteMs);
      const limiteStr = limiteLocal.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
      const limiteDate = new Date(limiteStr);
      const minsLimite = limiteDate.getHours() * 60 + limiteDate.getMinutes();

      for (const b of BLOCOS_MINUTOS) {
        const iniBloco = Math.max(minsCursor, b.inicio);
        const fimBloco = Math.min(minsLimite, b.fim);
        if (iniBloco < fimBloco) total += fimBloco - iniBloco;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }
  return total;
}

function classificarTempoResposta(minutos) {
  if (minutos <= 14) return 'dentro_sla';
  if (minutos <= 29) return 'atencao';
  if (minutos <= 59) return 'alerta';
  if (minutos <= 119) return 'critico';
  return 'emergencial';
}

function classificarScore(score) {
  if (score >= 90) return 'excelente';
  if (score >= 75) return 'bom';
  if (score >= 60) return 'atencao';
  if (score >= 40) return 'critico';
  return 'emergencial';
}

function classificarQualidade(score) {
  if (score >= 90) return 'excelente';
  if (score >= 75) return 'boa';
  if (score >= 60) return 'atencao';
  if (score >= 40) return 'fraca';
  return 'critica';
}

function normalizarTel(tel) {
  return (tel || '').replace(/\D/g, '');
}

const TIPOS_VALIDOS_CLIENTE = ['texto', 'audio', 'imagem', 'video', 'documento'];
const IGNORAR_TIPOS = ['sistema', 'atividade', 'sem_conteudo'];

// ── MAIN ────────────────────────────────────────────────────────
Deno.serve(async (_req) => {
  try {
    const base44 = createClientFromRequest(_req);
    const sdk = base44.asServiceRole;

    // Parâmetros de filtro
    let params = {};
    try { params = await _req.json(); } catch { /* defaults */ }

    const agora = new Date().toISOString();
    const padrao30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const periodoInicio = params.periodoInicio || padrao30d;
    const periodoFim = params.periodoFim || agora;
    const filtroRemetenteTel = params.remetente_telefone || null;
    const filtroClienteId = params.cliente_id || null;
    const filtroGrupoId = params.grupo_id || null;
    const filtroClassificacao = params.classificacao || null;
    const apenasCriticos = params.apenasCriticos || false;
    const apenasPendentes = params.apenasPendentes || false;
    const apenasForaSLA = params.apenasForaSLA || false;

    // 1. Remetentes VOXX
    const remetentes = await sdk.entities.WhatsappRemetenteVoxx.list('-nome', 200);
    const remetentesAtivos = remetentes.filter(r => r.ativo !== false);
    const mapaRemetentes = {};
    for (const r of remetentesAtivos) {
      mapaRemetentes[normalizarTel(r.telefone_normalizado)] = r;
    }

    // 2. Mensagens VOXX no período
    const todasMsgsVoxx = await sdk.entities.WhatsappMensagem.filter(
      { remetente_tipo: 'voxx' }, '-received_at', 2000
    );
    const msgsVoxxFiltradas = todasMsgsVoxx.filter(m => {
      const ts = m.timestamp_mensagem || m.received_at;
      if (ts < periodoInicio || ts > periodoFim) return false;
      if (filtroClienteId && m.cliente_id !== filtroClienteId) return false;
      if (filtroGrupoId && m.grupo_id !== filtroGrupoId) return false;
      return true;
    });

    // 3. Mensagens de cliente no período (para tempo de resposta)
    const todasMsgsCliente = await sdk.entities.WhatsappMensagem.filter(
      { remetente_tipo: 'cliente' }, '-received_at', 2000
    );
    const msgsClienteFiltradas = todasMsgsCliente.filter(m => {
      const ts = m.timestamp_mensagem || m.received_at;
      if (ts < periodoInicio || ts > periodoFim) return false;
      if (filtroClienteId && m.cliente_id !== filtroClienteId) return false;
      if (filtroGrupoId && m.grupo_id !== filtroGrupoId) return false;
      return TIPOS_VALIDOS_CLIENTE.includes(m.tipo_mensagem) && !IGNORAR_TIPOS.includes(m.tipo_mensagem);
    });

    // 4. Avaliações existentes
    const avaliacoes = await sdk.entities.WhatsappAvaliacaoMensagemVoxx.list('-avaliado_em', 2000);
    const mapaAvaliacoes = {};
    for (const a of avaliacoes) {
      mapaAvaliacoes[a.whatsapp_mensagem_id] = a;
    }

    // ── Calcular primeiras respostas ────────────────────────────
    // Para cada mensagem de cliente, buscar a primeira resposta VOXX no mesmo grupo
    const primeirasRespostas = []; // { operador_tel, grupo_id, minutos_uteis, classificacao }

    for (const msgCliente of msgsClienteFiltradas) {
      const tsCliente = msgCliente.timestamp_mensagem || msgCliente.received_at;
      if (!tsCliente || !msgCliente.grupo_id) continue;

      // Mensagens VOXX no mesmo grupo após a msg do cliente
      const respostasVoxx = msgsVoxxFiltradas
        .filter(m => {
          const ts = m.timestamp_mensagem || m.received_at;
          return m.grupo_id === msgCliente.grupo_id && ts > tsCliente;
        })
        .sort((a, b) => {
          const ta = a.timestamp_mensagem || a.received_at;
          const tb = b.timestamp_mensagem || b.received_at;
          return ta < tb ? -1 : ta > tb ? 1 : 0;
        });

      if (respostasVoxx.length > 0) {
        const primeiraVoxx = respostasVoxx[0];
        const tsVoxx = primeiraVoxx.timestamp_mensagem || primeiraVoxx.received_at;
        const mins = calcularMinutosUteis(tsCliente, tsVoxx);
        const tel = normalizarTel(primeiraVoxx.remetente_telefone);

        primeirasRespostas.push({
          operador_tel: tel,
          grupo_id: msgCliente.grupo_id,
          minutos_uteis: mins,
          classificacao: classificarTempoResposta(mins),
        });
      }
    }

    // ── Agregar por operador ────────────────────────────────────
    const operadores = [];

    for (const [tel, remetente] of Object.entries(mapaRemetentes)) {
      // Filtrar por remetente se especificado
      if (filtroRemetenteTel && normalizarTel(filtroRemetenteTel) !== tel) continue;

      // Mensagens deste operador
      const msgsDoOp = msgsVoxxFiltradas.filter(m => normalizarTel(m.remetente_telefone) === tel);

      // Primeiras respostas deste operador
      const respsDoOp = primeirasRespostas.filter(r => r.operador_tel === tel);

      // Grupos únicos
      const gruposUnicos = new Set(msgsDoOp.map(m => m.grupo_id).filter(Boolean));
      const clientesUnicos = new Set(msgsDoOp.map(m => m.cliente_id).filter(Boolean));

      // Avaliações deste operador
      const avalsDoOp = msgsDoOp
        .map(m => mapaAvaliacoes[m.id])
        .filter(Boolean);

      // Total de mensagens avaliadas
      const avaliadas = avalsDoOp.length;
      const pendentes = msgsDoOp.length - avaliadas;

      // Scores de qualidade
      const scores = avalsDoOp.map(a => a.score_qualidade).filter(s => s != null);
      const scoreMedio = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;

      // Classificação das avaliações
      const qualCounts = { excelente: 0, boa: 0, atencao: 0, fraca: 0, critica: 0 };
      for (const a of avalsDoOp) {
        const c = classificarQualidade(a.score_qualidade || 0);
        qualCounts[c] = (qualCounts[c] || 0) + 1;
      }

      // Tempo de resposta
      const temposResposta = respsDoOp.map(r => r.minutos_uteis).filter(t => t > 0);
      const tempoMedio = temposResposta.length > 0
        ? Math.round(temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length)
        : null;
      const temposOrdenados = [...temposResposta].sort((a, b) => a - b);
      const tempoMediano = temposOrdenados.length > 0
        ? temposOrdenados[Math.floor(temposOrdenados.length / 2)]
        : null;
      const maiorAtraso = temposOrdenados.length > 0 ? temposOrdenados[temposOrdenados.length - 1] : null;

      // Classificações de tempo
      const tempoCounts = { dentro_sla: 0, atencao: 0, alerta: 0, critico: 0, emergencial: 0 };
      for (const r of respsDoOp) {
        tempoCounts[r.classificacao] = (tempoCounts[r.classificacao] || 0) + 1;
      }
      const pctDentroSLA = respsDoOp.length > 0
        ? Math.round((tempoCounts.dentro_sla / respsDoOp.length) * 100)
        : null;

      // Resolutividade
      const comProximoPasso = avalsDoOp.filter(a => a.tem_proximo_passo).length;
      const semProximoPasso = avalsDoOp.filter(a => !a.tem_proximo_passo).length;
      const respostasVagas = avalsDoOp.filter(a => a.resposta_vaga).length;
      const comRiscoRuido = avalsDoOp.filter(a => (a.risco_ruido || 0) >= 50).length;
      const respostasCriticas = avalsDoOp.filter(a => a.classificacao === 'critica').length;
      const respostasDefensivas = avalsDoOp.filter(a => a.resposta_defensiva).length;
      const respostasMuitoCurtas = avalsDoOp.filter(a => a.resposta_muito_curta).length;

      // Mensagens por dia
      const diasAtuacao = gruposUnicos.size > 0 ? Math.max(1, Math.ceil((new Date(periodoFim) - new Date(periodoInicio)) / (1000 * 60 * 60 * 24))) : 1;
      const msgsPorDia = Math.round((msgsDoOp.length / diasAtuacao) * 10) / 10;

      // Participação no total VOXX
      const pctParticipacao = msgsVoxxFiltradas.length > 0
        ? Math.round((msgsDoOp.length / msgsVoxxFiltradas.length) * 100)
        : 0;

      // ── Score geral ────────────────────────────────────────────
      // Peso: Tempo 35%, Qualidade 45%, Consistência 20%
      let scoreTempo = 50;
      if (tempoMedio !== null) {
        if (tempoMedio <= 14) scoreTempo = 100;
        else if (tempoMedio <= 29) scoreTempo = 80;
        else if (tempoMedio <= 59) scoreTempo = 60;
        else if (tempoMedio <= 119) scoreTempo = 40;
        else scoreTempo = 20;
      }

      let scoreQualidade = 50;
      if (scoreMedio !== null) scoreQualidade = scoreMedio;

      let scoreConsistencia = 50;
      if (msgsDoOp.length > 0 && avaliadas > 0) {
        let cs = 100;
        const pctCriticas = (qualCounts.critica / avaliadas) * 100;
        const pctPendentes = (pendentes / msgsDoOp.length) * 100;

        if (pctCriticas > 30) cs -= 30;
        else if (pctCriticas > 15) cs -= 15;
        if (pctPendentes > 50) cs -= 20;
        else if (pctPendentes > 20) cs -= 10;
        if (msgsDoOp.length < 5) cs -= 10;

        scoreConsistencia = Math.max(0, Math.min(100, cs));
      }

      const scoreGeral = Math.round(
        scoreTempo * 0.35 + scoreQualidade * 0.45 + scoreConsistencia * 0.20
      );

      const classificacaoGeral = classificarScore(scoreGeral);

      // Filtrar por classificação se especificado
      if (filtroClassificacao && classificacaoGeral !== filtroClassificacao) continue;
      if (apenasCriticos && classificacaoGeral !== 'critico' && classificacaoGeral !== 'emergencial') continue;
      if (apenasPendentes && pendentes === 0) continue;
      if (apenasForaSLA && pctDentroSLA !== null && pctDentroSLA >= 80) continue;

      // Principal ponto de atenção
      let principalPontoAtencao = null;
      if (respostasCriticas > 0) principalPontoAtencao = `${respostasCriticas} mensagem(ns) crítica(s)`;
      else if (pendentes > 3) principalPontoAtencao = `${pendentes} avaliações pendentes`;
      else if (pctDentroSLA !== null && pctDentroSLA < 70) principalPontoAtencao = `${pctDentroSLA}% dentro do SLA`;
      else if (respostasVagas > 2) principalPontoAtencao = `${respostasVagas} respostas vagas`;
      else if (comRiscoRuido > 1) principalPontoAtencao = `${comRiscoRuido} com risco de ruído`;

      operadores.push({
        nome: remetente.nome,
        telefone: remetente.telefone,
        telefone_normalizado: tel,
        score_geral: scoreGeral,
        classificacao: classificacaoGeral,
        // Volume
        mensagens_enviadas: msgsDoOp.length,
        grupos_em_que_participou: gruposUnicos.size,
        clientes_em_que_participou: clientesUnicos.size,
        mensagens_por_dia: msgsPorDia,
        pct_participacao: pctParticipacao,
        // Tempo
        primeiras_respostas: respsDoOp.length,
        tempo_medio_resposta: tempoMedio,
        tempo_mediano_resposta: tempoMediano,
        maior_atraso: maiorAtraso,
        pct_dentro_sla: pctDentroSLA,
        respostas_dentro_sla: tempoCounts.dentro_sla,
        respostas_atencao: tempoCounts.atencao,
        respostas_alerta: tempoCounts.alerta,
        respostas_criticas_tempo: tempoCounts.critico,
        respostas_emergenciais: tempoCounts.emergencial,
        // Qualidade
        score_medio_qualidade: scoreMedio,
        mensagens_avaliadas: avaliadas,
        avaliacoes_pendentes: pendentes,
        mensagens_excelentes: qualCounts.excelente,
        mensagens_boas: qualCounts.boa,
        mensagens_atencao: qualCounts.atencao,
        mensagens_fracas: qualCounts.fraca,
        mensagens_criticas: qualCounts.critica,
        // Resolutividade
        com_proximo_passo: comProximoPasso,
        sem_proximo_passo: semProximoPasso,
        respostas_vagas: respostasVagas,
        com_risco_ruido: comRiscoRuido,
        respostas_defensivas: respostasDefensivas,
        respostas_muito_curtas: respostasMuitoCurtas,
        // Risco
        principal_ponto_atencao: principalPontoAtencao,
        // Scores parciais
        score_tempo: scoreTempo,
        score_qualidade_parcial: scoreQualidade,
        score_consistencia: scoreConsistencia,
      });
    }

    // Ordenar: menor score > mais críticas > pior SLA > maior tempo > mais pendentes
    operadores.sort((a, b) => {
      if (a.score_geral !== b.score_geral) return a.score_geral - b.score_geral;
      if (b.mensagens_criticas !== a.mensagens_criticas) return b.mensagens_criticas - a.mensagens_criticas;
      const slaA = a.pct_dentro_sla ?? 100;
      const slaB = b.pct_dentro_sla ?? 100;
      if (slaA !== slaB) return slaA - slaB;
      const tempoA = a.tempo_medio_resposta ?? 0;
      const tempoB = b.tempo_medio_resposta ?? 0;
      if (tempoA !== tempoB) return tempoB - tempoA;
      return b.avaliacoes_pendentes - a.avaliacoes_pendentes;
    });

    // ── Cards do topo ────────────────────────────────────────────
    const scoresGeral = operadores.map(o => o.score_geral).filter(s => s != null);
    const temposMedios = operadores.map(o => o.tempo_medio_resposta).filter(t => t != null);
    const todosPctSLA = operadores.map(o => o.pct_dentro_sla).filter(p => p != null);
    const totalCriticas = operadores.reduce((acc, o) => acc + o.mensagens_criticas, 0);
    const totalPendentes = operadores.reduce((acc, o) => acc + o.avaliacoes_pendentes, 0);
    const melhorScore = scoresGeral.length > 0 ? Math.max(...scoresGeral) : null;
    const maiorPontoAtencao = operadores.find(o => o.mensagens_criticas > 0)?.principal_ponto_atencao || 'Nenhum';

    const cards = {
      atendentes_ativos: operadores.length,
      score_medio_equipe: scoresGeral.length > 0
        ? Math.round(scoresGeral.reduce((a, b) => a + b, 0) / scoresGeral.length)
        : null,
      tempo_medio_resposta_equipe: temposMedios.length > 0
        ? Math.round(temposMedios.reduce((a, b) => a + b, 0) / temposMedios.length)
        : null,
      pct_dentro_sla_equipe: todosPctSLA.length > 0
        ? Math.round(todosPctSLA.reduce((a, b) => a + b, 0) / todosPctSLA.length)
        : null,
      mensagens_criticas_total: totalCriticas,
      avaliacoes_pendentes_total: totalPendentes,
      melhor_score: melhorScore,
      maior_ponto_atencao: maiorPontoAtencao,
      total_mensagens_avaliadas: avaliacoes.length,
    };

    // Remetentes não cadastrados
    const telsCadastrados = new Set(Object.keys(mapaRemetentes));
    const telsNaoCadastrados = new Set();
    for (const m of msgsVoxxFiltradas) {
      const tel = normalizarTel(m.remetente_telefone);
      if (tel && !telsCadastrados.has(tel)) {
        telsNaoCadastrados.add(tel);
      }
    }

    return Response.json({
      success: true,
      operadores,
      cards,
      remetentes_nao_cadastrados: telsNaoCadastrados.size,
      total_msgs_voxx_periodo: msgsVoxxFiltradas.length,
      total_primeiras_respostas: primeirasRespostas.length,
      periodo: { inicio: periodoInicio, fim: periodoFim },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});