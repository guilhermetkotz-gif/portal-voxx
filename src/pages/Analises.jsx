import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Brain, Settings2, TrendingUp, TrendingDown, Minus,
  Clock, BarChart3, ChevronRight,
  Flame, Zap, Activity, ArrowUpDown, AlertTriangle
} from 'lucide-react';
import moment from 'moment';
import 'moment-timezone';
import AnalisesParametrizacao from '@/components/analises/AnalisesParametrizacao';
import ClienteAnaliseDrawer from '@/components/analises/ClienteAnaliseDrawer';
import RemetentesParametrizacao from '@/components/analises/RemetentesParametrizacao';
import { useAlertaSemRetornoVoxx } from '@/hooks/useAlertaSemRetornoVoxx';
import { useAlertaSound } from '@/hooks/useAlertaSound';
import BotaoSomAlertas from '@/components/analises/BotaoSomAlertas';

const NIVEL_ALERTA_CONFIG = {
  alerta:      { label: 'Sem retorno +30min', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', border: 'border-l-amber-500/60' },
  critico:     { label: 'Sem retorno +1h',    color: 'text-orange-400 bg-orange-500/10 border-orange-500/30', border: 'border-l-orange-500/70' },
  emergencial: { label: 'Sem retorno +2h',    color: 'text-red-400 bg-red-500/10 border-red-500/30', border: 'border-l-red-500' },
};

const RISCO_CONFIG = {
  critico: { label: 'Crítico', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  alto: { label: 'Alto', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  medio: { label: 'Médio', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  baixo: { label: 'Baixo', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  sem_dados: { label: 'Sem dados', color: 'bg-slate-700/50 text-slate-400 border-slate-600/30' }
};

const CLIMA_CONFIG = {
  otimo: { label: '😊 Ótimo', color: 'text-green-400' },
  bom: { label: '🙂 Bom', color: 'text-emerald-400' },
  neutro: { label: '😐 Neutro', color: 'text-slate-400' },
  tenso: { label: '😟 Tenso', color: 'text-amber-400' },
  critico: { label: '😡 Crítico', color: 'text-red-400' },
  sem_dados: { label: '— Sem dados', color: 'text-slate-600' }
};

const TENDENCIA_CONFIG = {
  melhorando: { label: 'Melhorando', icon: TrendingUp, color: 'text-green-400' },
  estavel: { label: 'Estável', icon: Minus, color: 'text-slate-400' },
  piorando: { label: 'Piorando', icon: TrendingDown, color: 'text-red-400' },
  sem_dados: { label: '—', icon: Minus, color: 'text-slate-600' }
};

function ScoreBar({ score }) {
  if (score == null) return <span className="text-xs text-slate-600 font-mono">—</span>;
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono font-bold tabular-nums" style={{ color }}>{score}</span>
    </div>
  );
}

function RankingRow({ item, position, onVerAnalise }) {
  const risco = RISCO_CONFIG[item.risco_churn] || RISCO_CONFIG.sem_dados;
  const clima = CLIMA_CONFIG[item.clima_emocional] || CLIMA_CONFIG.sem_dados;
  const tendencia = TENDENCIA_CONFIG[item.tendencia] || TENDENCIA_CONFIG.sem_dados;
  const TendIcon = tendencia.icon;
  const hasAlertaVoxx = item.qtd_alertas > 0;
  const alertaSemRetorno = item._alertaSemRetorno; // { nivel, minutosUteis, label }
  const nivelCfg = alertaSemRetorno ? NIVEL_ALERTA_CONFIG[alertaSemRetorno.nivel] : null;
  const posColor = position <= 3 ? 'text-red-400' : position <= 7 ? 'text-amber-400' : 'text-slate-600';

  const riscoTexto = item._estado_sem_analise || item.principal_risco || null;

  // Borda pulsante baseada no nível
  const borderClass = nivelCfg
    ? `border-l-2 ${nivelCfg.border}`
    : hasAlertaVoxx
      ? 'border-l-2 border-l-amber-500/50'
      : 'border-l-2 border-l-transparent';

  const bgClass = alertaSemRetorno?.nivel === 'emergencial'
    ? 'bg-red-500/5'
    : alertaSemRetorno?.nivel === 'critico'
      ? 'bg-orange-500/5'
      : alertaSemRetorno?.nivel === 'alerta'
        ? 'bg-amber-500/5'
        : hasAlertaVoxx
          ? 'bg-amber-500/5'
          : '';

  return (
    <div className={`px-3 py-1.5 border-b border-slate-800/50 hover:bg-slate-800/25 transition-colors group ${borderClass} ${bgClass} ${nivelCfg ? 'animate-pulse-border' : ''}`}>

      {/* Linha 1 — dados principais */}
      <div className="flex items-center gap-2">
        {/* # */}
        <span className={`w-5 text-center text-[10px] font-bold font-mono shrink-0 ${posColor}`}>{position}</span>

        {/* Nome + cidade */}
        <div className="w-32 shrink-0">
          <p className="text-xs font-semibold text-slate-100 truncate leading-tight">{item.nome}</p>
          <p className="text-[10px] text-slate-500 truncate leading-tight">{item.cidade || '—'}</p>
        </div>

        {/* Badge alerta sem retorno VOXX */}
        {nivelCfg && (
          <span className={`shrink-0 flex items-center gap-0.5 text-[10px] border rounded px-1 py-0.5 leading-none font-medium ${nivelCfg.color} animate-pulse`}>
            <AlertTriangle className="w-2.5 h-2.5" />{nivelCfg.label}
          </span>
        )}

        {/* Alerta VOXX legado */}
        {hasAlertaVoxx && !nivelCfg && (
          <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1 py-0.5 leading-none">
            <AlertTriangle className="w-2.5 h-2.5" />{item.qtd_alertas}
          </span>
        )}

        {/* Score */}
        <div className="shrink-0">
          <ScoreBar score={item.score} />
        </div>

        {/* Status */}
        <Badge className={`shrink-0 text-[10px] px-1 py-0 leading-4 border h-4 ${
          item.status === 'ativo' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
          item.status === 'pausado' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
          'bg-slate-700/50 text-slate-400 border-slate-600/20'
        }`}>
          {item.status || '—'}
        </Badge>

        {/* Churn */}
        <Badge className={`shrink-0 text-[10px] px-1 py-0 leading-4 border h-4 ${risco.color}`}>
          {risco.label}
        </Badge>

        {/* Clima */}
        <span className={`shrink-0 text-[10px] ${clima.color}`}>{clima.label}</span>

        {/* Tendência */}
        <span className={`shrink-0 flex items-center gap-0.5 text-[10px] ${tendencia.color}`}>
          <TendIcon className="w-3 h-3" />
          {tendencia.label}
        </span>

        {/* Pressão */}
        <div className="shrink-0 flex items-center gap-px">
          {item.pressao_cliente != null
            ? [1,2,3,4,5].map(i => (
                <div key={i} className={`w-1 h-1 rounded-full ${i <= item.pressao_cliente ? 'bg-red-400' : 'bg-slate-700'}`} />
              ))
            : <span className="text-[10px] text-slate-700">—</span>
          }
        </div>

        {/* Sem contato */}
        {item.dias_sem_contato != null ? (
          <span className={`shrink-0 text-[10px] font-mono tabular-nums ${
            item.dias_sem_contato > 14 ? 'text-red-400' : item.dias_sem_contato > 7 ? 'text-amber-400' : 'text-slate-500'
          }`}>
            {item.dias_sem_contato}d
          </span>
        ) : <span className="shrink-0 text-[10px] text-slate-700">—</span>}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Botão Ver */}
        <Button
          size="sm"
          variant="ghost"
          className="h-5 text-[10px] text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 gap-0.5 px-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={() => onVerAnalise(item)}
        >
          Ver <ChevronRight className="w-2.5 h-2.5" />
        </Button>
      </div>

      {/* Linha 2 — risco + última análise */}
      <div className="flex items-center gap-2 mt-0.5 pl-7">
        <div className="flex-1 min-w-0">
          {riscoTexto ? (
            <p
              className={`text-[10px] truncate leading-tight ${item._estado_sem_analise ? 'text-slate-600 italic' : 'text-slate-500'}`}
              title={riscoTexto}
            >
              {riscoTexto}
            </p>
          ) : (
            <span className="text-[10px] text-slate-700">—</span>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-slate-600 tabular-nums">
          {item.ultima_analise || <span className="italic text-slate-700">sem análise</span>}
        </span>
      </div>

    </div>
  );
}

function EmptyState({ filtered }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
        <BarChart3 className="w-8 h-8 text-slate-600" />
      </div>
      <p className="text-slate-400 font-medium mb-1">
        {filtered ? 'Nenhum cliente encontrado com esses filtros' : 'Nenhum cliente cadastrado'}
      </p>
      <p className="text-slate-600 text-sm max-w-xs">
        {filtered
          ? 'Tente ajustar os filtros para visualizar mais resultados.'
          : 'Os clientes aparecerão aqui assim que forem cadastrados no sistema.'}
      </p>
    </div>
  );
}

export default function Analises({ user }) {
  const [periodo, setPeriodo] = useState('30d');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroRisco, setFiltroRisco] = useState('todos');
  const [filtroTendencia, setFiltroTendencia] = useState('todos');
  const [somenteCriticos, setSomenteCriticos] = useState(false);
  const [somenteSemAnalise, setSomenteSemAnalise] = useState(false);
  const [somenteAlertasVoxx, setSomenteAlertasVoxx] = useState(false);
  const [showParametrizacao, setShowParametrizacao] = useState(false);
  const [showRemetentes, setShowRemetentes] = useState(false);
  const [ordenacao, setOrdenacao] = useState('pior_melhor');
  const [clienteAnalise, setClienteAnalise] = useState(null);

  const isAdmin = user?.role === 'admin' || user?.tipo_usuario === 'voxx_admin';

  // --- Som de alertas ---
  const { somAtivado, toggleSom, tocarSom } = useAlertaSound();

  // --- Alertas sem retorno VOXX ---
  const alertasSemRetorno = useAlertaSemRetornoVoxx([], tocarSom);

  // --- Dados reais ---
  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['clientesAnalises'],
    queryFn: () => base44.entities.Cliente.filter({ status: 'ativo' }, 'nome', 300),
    staleTime: 60 * 1000
  });

  // Último envio por cliente (último contato via WhatsApp)
  const { data: logsEnvio = [] } = useQuery({
    queryKey: ['analisesLogsEnvio'],
    queryFn: () => base44.entities.WhatsappEnvioLog.list('-enviado_em', 500),
    staleTime: 60 * 1000
  });

  // Alertas/notificações não lidas por cliente
  const { data: notificacoes = [] } = useQuery({
    queryKey: ['analisesNotificacoes'],
    queryFn: () => base44.entities.Notificacao.filter({ lida: false }, '-created_date', 500),
    staleTime: 60 * 1000
  });

  // Demandas aguardando cliente (pressão)
  const { data: demandasAguardando = [] } = useQuery({
    queryKey: ['analisesDemandasAguardando'],
    queryFn: () => base44.entities.Demanda.filter({ status: 'aguardando_cliente' }, '-created_date', 500),
    staleTime: 60 * 1000
  });

  // Resumos diários (última análise gerada)
  const { data: resumos = [] } = useQuery({
    queryKey: ['analisesResumos'],
    queryFn: () => base44.entities.ResumoDiarioCliente.list('-data', 500),
    staleTime: 60 * 1000
  });

  // Grupos WhatsApp
  const { data: grupos = [] } = useQuery({
    queryKey: ['analisesGrupos'],
    queryFn: () => base44.entities.WhatsappGrupo.list('-created_date', 200),
    staleTime: 60 * 1000
  });

  const isLoading = loadingClientes;

  // --- Enriquecimento ---
  const clientesEnriquecidos = useMemo(() => {
    // alertasSemRetorno é um Map<clienteId, { nivel, minutosUteis, label }>

    // Índices para lookup rápido
    const ultimoLogPorCliente = {};
    logsEnvio.forEach(log => {
      if (!log.cliente_id || !log.enviado_em) return;
      if (!ultimoLogPorCliente[log.cliente_id] || log.enviado_em > ultimoLogPorCliente[log.cliente_id]) {
        ultimoLogPorCliente[log.cliente_id] = log.enviado_em;
      }
    });

    const alertasPorCliente = {};
    notificacoes.forEach(n => {
      if (!n.cliente_id) return;
      alertasPorCliente[n.cliente_id] = (alertasPorCliente[n.cliente_id] || 0) + 1;
    });

    const pressaoPorCliente = {};
    demandasAguardando.forEach(d => {
      if (!d.cliente_id) return;
      pressaoPorCliente[d.cliente_id] = (pressaoPorCliente[d.cliente_id] || 0) + 1;
    });

    const ultimoResumoPorCliente = {};
    resumos.forEach(r => {
      if (!r.cliente_id) return;
      if (!ultimoResumoPorCliente[r.cliente_id] || r.data > ultimoResumoPorCliente[r.cliente_id].data) {
        ultimoResumoPorCliente[r.cliente_id] = r;
      }
    });

    const gruposPorCliente = {};
    grupos.forEach(g => {
      if (g.cliente_id) gruposPorCliente[g.cliente_id] = g;
    });

    return clientes.map(c => {
      const ultimoLog = ultimoLogPorCliente[c.id];
      const diasSemContato = ultimoLog
        ? moment().diff(moment(ultimoLog), 'days')
        : null;

      const qtdDemandasAguardando = pressaoPorCliente[c.id] || 0;
      // pressão 1-5 baseada em quantidade de demandas aguardando
      const pressaoNivel = Math.min(5, qtdDemandasAguardando);

      const qtdAlertas = alertasPorCliente[c.id] || 0;
      const ultimoResumo = ultimoResumoPorCliente[c.id];
      const temGrupo = !!(c.whatsapp_grupo_id || gruposPorCliente[c.id]);

      // Estado sem análise inteligente
      let estadoSemAnalise = null;
      if (!ultimoResumo) {
        if (!temGrupo) estadoSemAnalise = 'Vincule um grupo para gerar análise';
        else if (!ultimoLog) estadoSemAnalise = 'Sem mensagens suficientes';
        else estadoSemAnalise = 'Sem análise gerada';
      }

      // Inferir risco de churn baseado em dados disponíveis
      let risco_churn = null;
      const score = c.health_score;
      if (score != null) {
        if (score < 30) risco_churn = 'critico';
        else if (score < 50) risco_churn = 'alto';
        else if (score < 70) risco_churn = 'medio';
        else risco_churn = 'baixo';
      } else if (diasSemContato != null && diasSemContato > 30) {
        risco_churn = 'alto';
      } else if (qtdAlertas > 5) {
        risco_churn = 'medio';
      }

      // Inferir tendência pela variação de score e pressão
      let tendencia = null;
      if (qtdDemandasAguardando > 3) tendencia = 'piorando';
      else if (score != null && score >= 70) tendencia = 'melhorando';
      else if (score != null) tendencia = 'estavel';

      const alertaSemRetorno = alertasSemRetorno.get(c.id) || null;

      return {
        ...c,
        score: score ?? null,
        risco_churn,
        clima_emocional: null,
        tendencia,
        pressao_cliente: pressaoNivel > 0 ? pressaoNivel : null,
        dias_sem_contato: diasSemContato,
        qtd_alertas: qtdAlertas,
        principal_risco: estadoSemAnalise || null,
        ultima_analise: ultimoResumo
          ? moment(ultimoResumo.updated_date || ultimoResumo.data).tz('America/Sao_Paulo').format('DD/MM HH:mm')
          : null,
        _tem_resumo: !!ultimoResumo,
        _estado_sem_analise: estadoSemAnalise,
        _alertaSemRetorno: alertaSemRetorno,
      };
    });
  }, [clientes, logsEnvio, notificacoes, demandasAguardando, resumos, grupos, alertasSemRetorno]);

  // --- Ordenação ---

  // Grupo de prioridade para ordenação "pior para melhor"
  // 0 = alerta VOXX ativo (topo absoluto), 1-6 = faixas de score, 7 = sem análise
  const NIVEL_ORDEM_SEM_RETORNO = { emergencial: 0, critico: 1, alerta: 2 };

  const getGrupoOrdem = (c) => {
    // Alertas de sem retorno VOXX têm prioridade máxima (0, 1, 2 por nível)
    if (c._alertaSemRetorno) return NIVEL_ORDEM_SEM_RETORNO[c._alertaSemRetorno.nivel] ?? 2;
    if (c.qtd_alertas > 0) return 3;           // Alerta operacional VOXX legado
    if (!c._tem_resumo) return 9;               // Sem análise (fundo)
    const s = c.score;
    if (s == null) return 9;
    if (s < 20) return 4;                       // Emergencial score
    if (s < 40) return 5;                       // Crítico score
    if (s < 60) return 6;                       // Atenção
    if (s < 75) return 7;                       // Saudável
    return 8;                                   // Excelente
  };

  const RISCO_ORDEM = { critico: 0, alto: 1, medio: 2, baixo: 3 };
  const TENDENCIA_ORDEM = { piorando: 0, estavel: 1, melhorando: 2 };

  // Desempate multi-critério dentro do mesmo grupo
  const desempate = (a, b) => {
    // 1. Menor score
    const sa = a.score ?? 999, sb = b.score ?? 999;
    if (sa !== sb) return sa - sb;
    // 2. Risco de churn mais alto
    const ra = RISCO_ORDEM[a.risco_churn] ?? 9, rb = RISCO_ORDEM[b.risco_churn] ?? 9;
    if (ra !== rb) return ra - rb;
    // 3. Tendência piorando
    const ta = TENDENCIA_ORDEM[a.tendencia] ?? 9, tb = TENDENCIA_ORDEM[b.tendencia] ?? 9;
    if (ta !== tb) return ta - tb;
    // 4. Maior pressão do cliente
    const pa = a.pressao_cliente ?? 0, pb = b.pressao_cliente ?? 0;
    if (pb !== pa) return pb - pa;
    // 5. Maior tempo sem contato
    const da = a.dias_sem_contato ?? -1, db = b.dias_sem_contato ?? -1;
    if (db !== da) return db - da;
    // 6. Análise mais recente primeiro
    const ua = a.ultima_analise || '', ub = b.ultima_analise || '';
    return ub.localeCompare(ua);
  };

  const clientesOrdenados = useMemo(() => {
    const arr = [...clientesEnriquecidos];

    switch (ordenacao) {
      case 'pior_melhor':
        return arr.sort((a, b) => {
          const ga = getGrupoOrdem(a), gb = getGrupoOrdem(b);
          if (ga !== gb) return ga - gb;
          return desempate(a, b);
        });

      case 'melhor_pior':
        return arr.sort((a, b) => {
          // Sem análise vai ao fundo
          if (!a._tem_resumo && b._tem_resumo) return 1;
          if (a._tem_resumo && !b._tem_resumo) return -1;
          // Alerta VOXX vai ao topo mesmo na direção "melhor para pior"
          if (a.qtd_alertas > 0 && b.qtd_alertas === 0) return -1;
          if (b.qtd_alertas > 0 && a.qtd_alertas === 0) return 1;
          const sa = a.score ?? -1, sb = b.score ?? -1;
          return sb - sa;
        });

      case 'maior_risco':
        return arr.sort((a, b) => {
          const ra = RISCO_ORDEM[a.risco_churn] ?? 9, rb = RISCO_ORDEM[b.risco_churn] ?? 9;
          if (ra !== rb) return ra - rb;
          return desempate(a, b);
        });

      case 'menor_score':
        return arr.sort((a, b) => {
          if (a.score == null && b.score == null) return 0;
          if (a.score == null) return 1;
          if (b.score == null) return -1;
          return a.score - b.score;
        });

      case 'sem_contato':
        return arr.sort((a, b) => {
          const da = a.dias_sem_contato ?? -1, db = b.dias_sem_contato ?? -1;
          return db - da;
        });

      case 'mais_recente':
        return arr.sort((a, b) => {
          const ua = a.ultima_analise || '', ub = b.ultima_analise || '';
          if (!ua && ub) return 1;
          if (ua && !ub) return -1;
          return ub.localeCompare(ua);
        });

      case 'sem_analise':
        return arr.sort((a, b) => {
          if (!a._tem_resumo && b._tem_resumo) return -1;
          if (a._tem_resumo && !b._tem_resumo) return 1;
          return desempate(a, b);
        });

      default:
        return arr;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientesEnriquecidos, ordenacao]);

  // Filtros
  const clientesFiltrados = useMemo(() => {
    return clientesOrdenados.filter(c => {
      if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false;
      if (filtroRisco !== 'todos' && c.risco_churn !== filtroRisco) return false;
      if (filtroTendencia !== 'todos' && c.tendencia !== filtroTendencia) return false;
      if (somenteCriticos && (c.score == null || c.score >= 40)) return false;
      if (somenteSemAnalise && c._tem_resumo) return false;
      if (somenteAlertasVoxx && c.qtd_alertas === 0) return false;
      return true;
    });
  }, [clientesOrdenados, filtroStatus, filtroRisco, filtroTendencia, somenteCriticos, somenteSemAnalise, somenteAlertasVoxx]);

  const isFiltered = filtroStatus !== 'todos' || filtroRisco !== 'todos' || filtroTendencia !== 'todos'
    || somenteCriticos || somenteSemAnalise || somenteAlertasVoxx;

  const handleVerAnalise = (clienteEnriquecido) => {
    setClienteAnalise(clienteEnriquecido);
  };

  const ToggleFilter = ({ label, active, onToggle, icon: Icon, activeColor = 'border-violet-500 bg-violet-500/10 text-violet-300' }) => (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
        active ? activeColor : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'
      }`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <Activity className="w-5 h-5 text-violet-400" />
              </div>
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Análises</h1>
            </div>
            <p className="text-slate-500 text-sm ml-12">Ranking executivo de saúde relacional, atendimento e operação.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <BotaoSomAlertas somAtivado={somAtivado} onToggle={toggleSom} />
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
                onClick={() => setShowRemetentes(true)}
              >
                <Settings2 className="w-4 h-4" /> Parametrização
              </Button>
            )}
            <Button
              size="sm"
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Brain className="w-4 h-4" /> Gerar análise
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-slate-800 bg-slate-900/50">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="h-8 w-32 text-xs bg-slate-800 border-slate-700 text-slate-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="h-8 w-32 text-xs bg-slate-800 border-slate-700 text-slate-300">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="pausado">Pausado</SelectItem>
              <SelectItem value="implantacao">Implantação</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroRisco} onValueChange={setFiltroRisco}>
            <SelectTrigger className="h-8 w-32 text-xs bg-slate-800 border-slate-700 text-slate-300">
              <SelectValue placeholder="Risco" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
              <SelectItem value="todos">Todos riscos</SelectItem>
              <SelectItem value="critico">Crítico</SelectItem>
              <SelectItem value="alto">Alto</SelectItem>
              <SelectItem value="medio">Médio</SelectItem>
              <SelectItem value="baixo">Baixo</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroTendencia} onValueChange={setFiltroTendencia}>
            <SelectTrigger className="h-8 w-36 text-xs bg-slate-800 border-slate-700 text-slate-300">
              <SelectValue placeholder="Tendência" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
              <SelectItem value="todos">Todas tendências</SelectItem>
              <SelectItem value="melhorando">Melhorando</SelectItem>
              <SelectItem value="estavel">Estável</SelectItem>
              <SelectItem value="piorando">Piorando</SelectItem>
            </SelectContent>
          </Select>

          <div className="w-px h-6 bg-slate-700 mx-1" />

          <ToggleFilter
            label="Somente críticos"
            active={somenteCriticos}
            onToggle={() => setSomenteCriticos(v => !v)}
            icon={Flame}
            activeColor="border-red-500/50 bg-red-500/10 text-red-400"
          />
          <ToggleFilter
            label="Sem análise"
            active={somenteSemAnalise}
            onToggle={() => setSomenteSemAnalise(v => !v)}
            icon={Clock}
          />
          <ToggleFilter
            label="Alertas VOXX"
            active={somenteAlertasVoxx}
            onToggle={() => setSomenteAlertasVoxx(v => !v)}
            icon={Zap}
            activeColor="border-amber-500/50 bg-amber-500/10 text-amber-400"
          />

          <div className="ml-auto flex items-center gap-2">
            {isFiltered && (
              <button
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                onClick={() => {
                  setFiltroStatus('todos'); setFiltroRisco('todos'); setFiltroTendencia('todos');
                  setSomenteCriticos(false); setSomenteSemAnalise(false); setSomenteAlertasVoxx(false);
                }}
              >
                Limpar filtros
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <Select value={ordenacao} onValueChange={setOrdenacao}>
                <SelectTrigger className="h-8 w-44 text-xs bg-slate-800 border-slate-700 text-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                  <SelectItem value="pior_melhor">Pior para melhor</SelectItem>
                  <SelectItem value="melhor_pior">Melhor para pior</SelectItem>
                  <SelectItem value="maior_risco">Maior risco de churn</SelectItem>
                  <SelectItem value="menor_score">Menor score</SelectItem>
                  <SelectItem value="sem_contato">Mais tempo sem contato</SelectItem>
                  <SelectItem value="mais_recente">Análise mais recente</SelectItem>
                  <SelectItem value="sem_analise">Sem análise primeiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Contador */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            <span className="text-slate-300 font-medium">{clientesFiltrados.length}</span> unidades
            {isFiltered && ` de ${clientes.length}`}
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500/60 inline-block" /> Crítico &lt; 40</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500/60 inline-block" /> Atenção 40–70</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500/60 inline-block" /> Saudável ≥ 70</span>
          </div>
        </div>

        {/* Tabela */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          {/* Cabeçalho da tabela */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border-b border-slate-700/50">
            <span className="w-5 text-center text-[10px] text-slate-600 font-medium">#</span>
            <span className="w-32 text-[10px] text-slate-500 font-medium">Cliente</span>
            <span className="text-[10px] text-slate-500 font-medium">Score</span>
            <span className="text-[10px] text-slate-500 font-medium ml-1">Status</span>
            <span className="text-[10px] text-slate-500 font-medium ml-1">Churn</span>
            <span className="text-[10px] text-slate-500 font-medium ml-1">Clima</span>
            <span className="text-[10px] text-slate-500 font-medium ml-1">Tend.</span>
            <span className="text-[10px] text-slate-500 font-medium ml-1">Pressão</span>
            <span className="text-[10px] text-slate-500 font-medium ml-1">S/contato</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <EmptyState filtered={isFiltered} />
          ) : (
            clientesFiltrados.map((c, i) => (
              <RankingRow key={c.id} item={c} position={i + 1} onVerAnalise={handleVerAnalise} />
            ))
          )}
        </div>

      </div>

      {showParametrizacao && (
        <AnalisesParametrizacao onClose={() => setShowParametrizacao(false)} />
      )}

      {showRemetentes && (
        <RemetentesParametrizacao
          clienteId={clienteAnalise?.id || null}
          clienteNome={clienteAnalise?.nome || 'Todos os clientes'}
          onClose={() => setShowRemetentes(false)}
          onReprocessar={() => setShowRemetentes(false)}
        />
      )}

      {clienteAnalise && (
        <ClienteAnaliseDrawer
          cliente={clienteAnalise}
          clienteEnriquecido={clienteAnalise}
          onClose={() => setClienteAnalise(null)}
        />
      )}
    </div>
  );
}