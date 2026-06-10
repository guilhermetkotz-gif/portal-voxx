import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Users, Clock, Star, AlertTriangle, BarChart3, Search, Eye, RefreshCw, UserX, FileQuestion } from 'lucide-react';
import OperadorDetailDrawer from './OperadorDetailDrawer';
import { toast } from 'sonner';
import moment from 'moment';
import 'moment-timezone';

const TZ = 'America/Sao_Paulo';

const CLASS_COLORS = {
  excelente: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  bom: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  atencao: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  critico: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  emergencial: 'bg-red-500/15 text-red-400 border-red-500/25',
};

function normalizarTel(tel) {
  return (tel || '').replace(/\D/g, '');
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

function calcularMinutosUteis(inicio, fim) {
  const BLOCOS = [
    { inicio: 8 * 60, fim: 12 * 60 },
    { inicio: 13 * 60 + 13, fim: 18 * 60 },
  ];
  const i = new Date(inicio);
  const f = new Date(fim);
  if (isNaN(i) || isNaN(f) || f <= i) return 0;
  let cursor = new Date(i);
  let total = 0;
  while (cursor < f) {
    const localStr = cursor.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const localDate = new Date(localStr);
    const diaSemana = localDate.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      const fimDiaLocal = new Date(localDate);
      fimDiaLocal.setHours(23, 59, 59, 999);
      const limiteMs = f < fimDiaLocal ? f.getTime() : fimDiaLocal.getTime();
      const minsCursor = localDate.getHours() * 60 + localDate.getMinutes();
      const limiteDate = new Date(limiteMs);
      const limiteStr = limiteDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
      const minsLimite = new Date(limiteStr).getHours() * 60 + new Date(limiteStr).getMinutes();
      for (const b of BLOCOS) {
        const ini = Math.max(minsCursor, b.inicio);
        const fim2 = Math.min(minsLimite, b.fim);
        if (ini < fim2) total += fim2 - ini;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }
  return total;
}

function CardTopo({ icon: Icon, label, value, sub, color }) {
  return (
    <div className={`rounded-lg border p-2.5 flex items-center gap-2.5 ${color}`}>
      <Icon className="w-4 h-4 opacity-70 shrink-0" />
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight">{value ?? '—'}</p>
        <p className="text-[10px] opacity-70 leading-tight truncate">{label}</p>
        {sub && <p className="text-[9px] opacity-50">{sub}</p>}
      </div>
    </div>
  );
}

export default function AbaOperadoresVoxx({ mensagens = [] }) {
  const queryClient = useQueryClient();
  const [periodo, setPeriodo] = useState('30d');
  const [filtroClassificacao, setFiltroClassificacao] = useState('todas');
  const [filtroAtendente, setFiltroAtendente] = useState('');
  const [operadorSelecionado, setOperadorSelecionado] = useState(null);
  const [avaliando, setAvaliando] = useState(false);

  const getPeriodo = () => {
    const agora = moment().tz(TZ);
    switch (periodo) {
      case 'hoje': return { inicio: agora.clone().startOf('day').toISOString(), fim: agora.toISOString() };
      case 'ontem': return { inicio: agora.clone().subtract(1, 'day').startOf('day').toISOString(), fim: agora.clone().subtract(1, 'day').endOf('day').toISOString() };
      case '7d': return { inicio: agora.clone().subtract(7, 'days').startOf('day').toISOString(), fim: agora.toISOString() };
      case '30d': default: return { inicio: agora.clone().subtract(30, 'days').startOf('day').toISOString(), fim: agora.toISOString() };
    }
  };

  const periodoObj = getPeriodo();

  // Buscar apenas remetentes e avaliações (dados leves)
  const { data: remetentes = [], isLoading: loadingRemetentes } = useQuery({
    queryKey: ['remetentesVoxx'],
    queryFn: () => base44.entities.WhatsappRemetenteVoxx.list('-nome', 200),
    staleTime: 5 * 60 * 1000,
  });

  const { data: avaliacoes = [], isLoading: loadingAvals } = useQuery({
    queryKey: ['avalsVoxx'],
    queryFn: () => base44.entities.WhatsappAvaliacaoMensagemVoxx.list('-avaliado_em', 2000),
    staleTime: 2 * 60 * 1000,
  });

  const isLoading = loadingRemetentes || loadingAvals;

  // Calcular performance no frontend
  const { operadores, cards, remetentesNaoCadastrados } = useMemo(() => {
    if (remetentes.length === 0) return { operadores: [], cards: {}, remetentesNaoCadastrados: 0 };

    const remetentesAtivos = remetentes.filter(r => r.ativo !== false);
    const mapaRemetentes = {};
    for (const r of remetentesAtivos) {
      mapaRemetentes[normalizarTel(r.telefone_normalizado || r.telefone)] = r;
    }

    const mapaAvaliacoes = {};
    for (const a of avaliacoes) {
      mapaAvaliacoes[a.whatsapp_mensagem_id] = a;
    }

    // Filtrar mensagens do período
    const msgsVoxx = mensagens.filter(m => {
      const ts = m.timestamp_mensagem || m.received_at;
      return m.remetente_tipo === 'voxx' && ts >= periodoObj.inicio && ts <= periodoObj.fim;
    });

    const msgsCliente = mensagens.filter(m => {
      const ts = m.timestamp_mensagem || m.received_at;
      return m.remetente_tipo === 'cliente' && ts >= periodoObj.inicio && ts <= periodoObj.fim
        && !['sistema', 'atividade', 'sem_conteudo'].includes(m.tipo_mensagem);
    });

    // Calcular primeiras respostas (só top 200 msgs cliente para não travar o browser)
    const primeirasRespostas = [];
    for (const msgCliente of msgsCliente.slice(0, 200)) {
      const tsCliente = msgCliente.timestamp_mensagem || msgCliente.received_at;
      if (!tsCliente || !msgCliente.grupo_id) continue;
      const respostasVoxx = msgsVoxx
        .filter(m => {
          const ts = m.timestamp_mensagem || m.received_at;
          return m.grupo_id === msgCliente.grupo_id && ts > tsCliente;
        })
        .sort((a, b) => {
          const ta = a.timestamp_mensagem || a.received_at;
          const tb = b.timestamp_mensagem || b.received_at;
          return ta < tb ? -1 : 1;
        });
      if (respostasVoxx.length > 0) {
        const primeiraVoxx = respostasVoxx[0];
        const tsVoxx = primeiraVoxx.timestamp_mensagem || primeiraVoxx.received_at;
        const mins = calcularMinutosUteis(tsCliente, tsVoxx);
        const tel = normalizarTel(primeiraVoxx.remetente_telefone);
        primeirasRespostas.push({ operador_tel: tel, minutos_uteis: mins });
      }
    }

    const resultado = [];

    for (const [tel, remetente] of Object.entries(mapaRemetentes)) {
      const msgsDoOp = msgsVoxx.filter(m => normalizarTel(m.remetente_telefone) === tel);
      const respsDoOp = primeirasRespostas.filter(r => r.operador_tel === tel);
      const gruposUnicos = new Set(msgsDoOp.map(m => m.grupo_id).filter(Boolean));
      const clientesUnicos = new Set(msgsDoOp.map(m => m.cliente_id).filter(Boolean));
      const avalsDoOp = msgsDoOp.map(m => mapaAvaliacoes[m.id]).filter(Boolean);
      const avaliadas = avalsDoOp.length;
      const pendentes = Math.max(0, msgsDoOp.length - avaliadas);
      const scores = avalsDoOp.map(a => a.score_qualidade).filter(s => s != null);
      const scoreMedio = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      const qualCounts = { excelente: 0, boa: 0, atencao: 0, fraca: 0, critica: 0 };
      for (const a of avalsDoOp) { const c = classificarQualidade(a.score_qualidade || 0); qualCounts[c]++; }
      const tempos = respsDoOp.map(r => r.minutos_uteis).filter(t => t > 0);
      const tempoMedio = tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null;
      const temposOrd = [...tempos].sort((a, b) => a - b);
      const tempoMediano = temposOrd.length > 0 ? temposOrd[Math.floor(temposOrd.length / 2)] : null;
      const maiorAtraso = temposOrd.length > 0 ? temposOrd[temposOrd.length - 1] : null;
      const dentroSLA = tempos.filter(t => t <= 14).length;
      const pctDentroSLA = tempos.length > 0 ? Math.round((dentroSLA / tempos.length) * 100) : null;
      const comProximoPasso = avalsDoOp.filter(a => a.tem_proximo_passo).length;
      const semProximoPasso = avalsDoOp.filter(a => !a.tem_proximo_passo).length;
      const respostasVagas = avalsDoOp.filter(a => a.resposta_vaga).length;
      const comRiscoRuido = avalsDoOp.filter(a => (a.risco_ruido || 0) >= 50).length;
      const respostasCriticas = avalsDoOp.filter(a => a.classificacao === 'critica').length;
      const respostasDefensivas = avalsDoOp.filter(a => a.resposta_defensiva).length;
      const respostasMuitoCurtas = avalsDoOp.filter(a => a.resposta_muito_curta).length;
      let scoreTempo = 50;
      if (tempoMedio !== null) {
        if (tempoMedio <= 14) scoreTempo = 100;
        else if (tempoMedio <= 29) scoreTempo = 80;
        else if (tempoMedio <= 59) scoreTempo = 60;
        else if (tempoMedio <= 119) scoreTempo = 40;
        else scoreTempo = 20;
      }
      const scoreQualidade = scoreMedio !== null ? scoreMedio : 50;
      let scoreConsistencia = 50;
      if (msgsDoOp.length > 0 && avaliadas > 0) {
        let cs = 100;
        if ((qualCounts.critica / avaliadas) * 100 > 30) cs -= 30;
        else if ((qualCounts.critica / avaliadas) * 100 > 15) cs -= 15;
        if ((pendentes / msgsDoOp.length) * 100 > 50) cs -= 20;
        else if ((pendentes / msgsDoOp.length) * 100 > 20) cs -= 10;
        if (msgsDoOp.length < 5) cs -= 10;
        scoreConsistencia = Math.max(0, Math.min(100, cs));
      }
      const scoreGeral = Math.round(scoreTempo * 0.35 + scoreQualidade * 0.45 + scoreConsistencia * 0.20);
      const classificacaoGeral = classificarScore(scoreGeral);
      let principalPontoAtencao = null;
      if (respostasCriticas > 0) principalPontoAtencao = `${respostasCriticas} msg(s) crítica(s)`;
      else if (pendentes > 3) principalPontoAtencao = `${pendentes} aval. pendentes`;
      else if (pctDentroSLA !== null && pctDentroSLA < 70) principalPontoAtencao = `${pctDentroSLA}% dentro do SLA`;
      else if (respostasVagas > 2) principalPontoAtencao = `${respostasVagas} respostas vagas`;

      resultado.push({
        nome: remetente.nome,
        telefone: remetente.telefone,
        telefone_normalizado: tel,
        score_geral: scoreGeral,
        classificacao: classificacaoGeral,
        mensagens_enviadas: msgsDoOp.length,
        grupos_em_que_participou: gruposUnicos.size,
        clientes_em_que_participou: clientesUnicos.size,
        primeiras_respostas: respsDoOp.length,
        tempo_medio_resposta: tempoMedio,
        tempo_mediano_resposta: tempoMediano,
        maior_atraso: maiorAtraso,
        pct_dentro_sla: pctDentroSLA,
        respostas_dentro_sla: dentroSLA,
        respostas_atencao: tempos.filter(t => t > 14 && t <= 29).length,
        respostas_alerta: tempos.filter(t => t > 29 && t <= 59).length,
        respostas_criticas_tempo: tempos.filter(t => t > 59 && t <= 119).length,
        respostas_emergenciais: tempos.filter(t => t > 119).length,
        score_medio_qualidade: scoreMedio,
        mensagens_avaliadas: avaliadas,
        avaliacoes_pendentes: pendentes,
        mensagens_excelentes: qualCounts.excelente,
        mensagens_boas: qualCounts.boa,
        mensagens_atencao: qualCounts.atencao,
        mensagens_fracas: qualCounts.fraca,
        mensagens_criticas: qualCounts.critica,
        com_proximo_passo: comProximoPasso,
        sem_proximo_passo: semProximoPasso,
        respostas_vagas: respostasVagas,
        com_risco_ruido: comRiscoRuido,
        respostas_defensivas: respostasDefensivas,
        respostas_muito_curtas: respostasMuitoCurtas,
        principal_ponto_atencao: principalPontoAtencao,
        score_tempo: scoreTempo,
        score_qualidade_parcial: scoreQualidade,
        score_consistencia: scoreConsistencia,
      });
    }

    resultado.sort((a, b) => {
      if (a.score_geral !== b.score_geral) return a.score_geral - b.score_geral;
      if (b.mensagens_criticas !== a.mensagens_criticas) return b.mensagens_criticas - a.mensagens_criticas;
      return (a.pct_dentro_sla ?? 100) - (b.pct_dentro_sla ?? 100);
    });

    const scoresGeral = resultado.map(o => o.score_geral);
    const temposMedios = resultado.map(o => o.tempo_medio_resposta).filter(t => t != null);
    const todosPctSLA = resultado.map(o => o.pct_dentro_sla).filter(p => p != null);
    const totalCriticas = resultado.reduce((acc, o) => acc + o.mensagens_criticas, 0);
    const totalPendentes = resultado.reduce((acc, o) => acc + o.avaliacoes_pendentes, 0);

    const cards = {
      atendentes_ativos: resultado.length,
      score_medio_equipe: scoresGeral.length > 0 ? Math.round(scoresGeral.reduce((a, b) => a + b, 0) / scoresGeral.length) : null,
      tempo_medio_resposta_equipe: temposMedios.length > 0 ? Math.round(temposMedios.reduce((a, b) => a + b, 0) / temposMedios.length) : null,
      pct_dentro_sla_equipe: todosPctSLA.length > 0 ? Math.round(todosPctSLA.reduce((a, b) => a + b, 0) / todosPctSLA.length) : null,
      mensagens_criticas_total: totalCriticas,
      avaliacoes_pendentes_total: totalPendentes,
      melhor_score: scoresGeral.length > 0 ? Math.max(...scoresGeral) : null,
      maior_ponto_atencao: resultado.find(o => o.mensagens_criticas > 0)?.principal_ponto_atencao || 'Nenhum',
    };

    // Remetentes não cadastrados
    const telsCadastrados = new Set(Object.keys(mapaRemetentes));
    const telsNaoCadastrados = new Set(
      msgsVoxx.map(m => normalizarTel(m.remetente_telefone)).filter(t => t && !telsCadastrados.has(t))
    );

    return { operadores: resultado, cards, remetentesNaoCadastrados: telsNaoCadastrados.size };
  }, [mensagens, remetentes, avaliacoes, periodoObj.inicio, periodoObj.fim]);

  // Filtros UI
  const operadoresFiltrados = useMemo(() => {
    return operadores.filter(op => {
      if (filtroClassificacao !== 'todas' && op.classificacao !== filtroClassificacao) return false;
      if (filtroAtendente && !op.nome.toLowerCase().includes(filtroAtendente.toLowerCase())) return false;
      return true;
    });
  }, [operadores, filtroClassificacao, filtroAtendente]);

  const avaliarPendentes = async () => {
    setAvaliando(true);
    try {
      const res = await base44.functions.invoke('avaliarQualidadeMensagensVoxx', { maxMensagens: 10 });
      toast.success(res.data.mensagem || 'Avaliação concluída.');
      queryClient.invalidateQueries({ queryKey: ['avalsVoxx'] });
    } catch (e) {
      toast.error('Erro ao avaliar: ' + e.message);
    } finally {
      setAvaliando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cards do topo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <CardTopo icon={Users} label="Atendentes ativos" value={cards.atendentes_ativos} color="bg-violet-500/10 text-violet-400 border-violet-500/15" />
        <CardTopo icon={Star} label="Score médio equipe" value={cards.score_medio_equipe} color="bg-blue-500/10 text-blue-400 border-blue-500/15" />
        <CardTopo icon={Clock} label="Tempo médio resp." value={cards.tempo_medio_resposta_equipe != null ? `${cards.tempo_medio_resposta_equipe}min` : '—'} color="bg-emerald-500/10 text-emerald-400 border-emerald-500/15" />
        <CardTopo icon={BarChart3} label="% dentro do SLA" value={cards.pct_dentro_sla_equipe != null ? `${cards.pct_dentro_sla_equipe}%` : '—'} color="bg-cyan-500/10 text-cyan-400 border-cyan-500/15" />
        <CardTopo icon={AlertTriangle} label="Msgs críticas" value={cards.mensagens_criticas_total} color="bg-red-500/10 text-red-400 border-red-500/15" />
        <CardTopo icon={FileQuestion} label="Aval. pendentes" value={cards.avaliacoes_pendentes_total} color="bg-amber-500/10 text-amber-400 border-amber-500/15" />
        <CardTopo icon={Star} label="Melhor score" value={cards.melhor_score} color="bg-emerald-500/10 text-emerald-400 border-emerald-500/15" sub="Individual" />
        <CardTopo icon={AlertTriangle} label="Ponto de atenção" value={cards.maior_ponto_atencao || 'Nenhum'} color="bg-slate-700 text-slate-300 border-slate-600" />
      </div>

      {/* Alertas */}
      {remetentesNaoCadastrados > 0 && (
        <div className="bg-amber-950/20 border border-amber-800/40 rounded-lg px-4 py-2.5 flex items-center gap-2">
          <UserX className="w-4 h-4 text-amber-400" />
          <p className="text-amber-300 text-xs">
            Existem <strong>{remetentesNaoCadastrados}</strong> remetente(s) VOXX não cadastrado(s). Verifique a aba <strong>Remetentes VOXX</strong>.
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 flex items-center gap-2 flex-wrap">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-28 h-7 text-xs bg-slate-800 border-slate-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="hoje" className="text-xs text-white">Hoje</SelectItem>
            <SelectItem value="ontem" className="text-xs text-white">Ontem</SelectItem>
            <SelectItem value="7d" className="text-xs text-white">7 dias</SelectItem>
            <SelectItem value="30d" className="text-xs text-white">30 dias</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroClassificacao} onValueChange={setFiltroClassificacao}>
          <SelectTrigger className="w-28 h-7 text-xs bg-slate-800 border-slate-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="todas" className="text-xs text-white">Todas</SelectItem>
            <SelectItem value="excelente" className="text-xs text-white">Excelente</SelectItem>
            <SelectItem value="bom" className="text-xs text-white">Bom</SelectItem>
            <SelectItem value="atencao" className="text-xs text-white">Atenção</SelectItem>
            <SelectItem value="critico" className="text-xs text-white">Crítico</SelectItem>
            <SelectItem value="emergencial" className="text-xs text-white">Emergencial</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Buscar atendente..."
            value={filtroAtendente}
            onChange={e => setFiltroAtendente(e.target.value)}
            className="w-36 h-7 text-xs bg-slate-800 border-slate-700 text-white pl-7"
          />
        </div>

        <div className="flex-1" />

        <Button
          size="sm"
          onClick={avaliarPendentes}
          disabled={avaliando}
          className="bg-emerald-600 hover:bg-emerald-500 h-7 text-xs gap-1.5"
        >
          {avaliando ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Avaliar pendentes
        </Button>
      </div>

      {/* Tabela */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="text-left px-3 py-2.5 text-slate-500 font-medium">#</th>
                <th className="text-left px-3 py-2.5 text-slate-500 font-medium">Atendente</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Score</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Classif.</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Msgs</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Grupos</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Clientes</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">1ª Resp.</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">T. Médio</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">% SLA</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Qualid.</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Críticas</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Pend.</th>
                <th className="text-left px-3 py-2.5 text-slate-500 font-medium">Ponto de Atenção</th>
                <th className="text-center px-2 py-2.5 text-slate-500 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={15} className="px-4 py-10 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : operadoresFiltrados.length === 0 ? (
                <tr><td colSpan={15} className="px-4 py-10 text-center text-slate-500">
                  {remetentes.length === 0
                    ? 'Cadastre remetentes VOXX na aba "Remetentes VOXX" para iniciar a avaliação.'
                    : 'Nenhum atendente encontrado com os filtros atuais.'}
                </td></tr>
              ) : (
                operadoresFiltrados.map((op, i) => (
                  <tr key={op.telefone_normalizado} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                    <td className="px-3 py-2.5 text-slate-500 font-mono">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <p className="text-white font-medium text-sm">{op.nome}</p>
                      <p className="text-slate-500 text-[10px] font-mono">{op.telefone}</p>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                        op.score_geral >= 90 ? 'bg-emerald-500/20 text-emerald-400' :
                        op.score_geral >= 75 ? 'bg-blue-500/20 text-blue-400' :
                        op.score_geral >= 60 ? 'bg-amber-500/20 text-amber-400' :
                        op.score_geral >= 40 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>{op.score_geral}</span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <Badge className={`text-[10px] border ${CLASS_COLORS[op.classificacao] || CLASS_COLORS.atencao}`}>
                        {op.classificacao === 'excelente' ? 'Excel.' :
                         op.classificacao === 'atencao' ? 'Atenção' :
                         op.classificacao === 'critico' ? 'Crítico' :
                         op.classificacao}
                      </Badge>
                    </td>
                    <td className="px-2 py-2.5 text-center text-white font-mono">{op.mensagens_enviadas}</td>
                    <td className="px-2 py-2.5 text-center text-slate-300 font-mono">{op.grupos_em_que_participou}</td>
                    <td className="px-2 py-2.5 text-center text-slate-300 font-mono">{op.clientes_em_que_participou}</td>
                    <td className="px-2 py-2.5 text-center text-white font-mono">{op.primeiras_respostas}</td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`font-mono ${op.tempo_medio_resposta != null && op.tempo_medio_resposta > 14 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {op.tempo_medio_resposta != null ? `${op.tempo_medio_resposta}m` : '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`font-mono ${op.pct_dentro_sla != null && op.pct_dentro_sla < 80 ? 'text-red-400' : op.pct_dentro_sla != null && op.pct_dentro_sla < 95 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {op.pct_dentro_sla != null ? `${op.pct_dentro_sla}%` : '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`font-mono ${op.score_medio_qualidade != null && op.score_medio_qualidade < 75 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {op.score_medio_qualidade != null ? op.score_medio_qualidade : '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {op.mensagens_criticas > 0
                        ? <span className="text-red-400 font-bold font-mono">{op.mensagens_criticas}</span>
                        : <span className="text-slate-500 font-mono">0</span>}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {op.avaliacoes_pendentes > 0
                        ? <span className="text-amber-400 font-mono">{op.avaliacoes_pendentes}</span>
                        : <span className="text-slate-500 font-mono">0</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] text-slate-400">{op.principal_ponto_atencao || '—'}</span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setOperadorSelecionado(op)}
                        className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-7 w-7 p-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {operadorSelecionado && (
        <OperadorDetailDrawer
          open={!!operadorSelecionado}
          onClose={() => setOperadorSelecionado(null)}
          operador={operadorSelecionado}
          periodoInicio={periodoObj.inicio}
          periodoFim={periodoObj.fim}
        />
      )}
    </div>
  );
}