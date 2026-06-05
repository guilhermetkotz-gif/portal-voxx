import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Brain, Settings2, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Clock, BarChart3, ChevronRight,
  Flame, Shield, Zap, Activity
} from 'lucide-react';
import AnalisesParametrizacao from '@/components/analises/AnalisesParametrizacao';

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
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono font-bold" style={{ color }}>{score ?? '—'}</span>
    </div>
  );
}

function RankingRow({ item, position, onVerAnalise }) {
  const risco = RISCO_CONFIG[item.risco_churn] || RISCO_CONFIG.sem_dados;
  const clima = CLIMA_CONFIG[item.clima_emocional] || CLIMA_CONFIG.sem_dados;
  const tendencia = TENDENCIA_CONFIG[item.tendencia] || TENDENCIA_CONFIG.sem_dados;
  const TendIcon = tendencia.icon;

  const posColor = position <= 3 ? 'text-red-400' : position <= 7 ? 'text-amber-400' : 'text-slate-500';

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors group">
      {/* Posição */}
      <span className={`w-6 text-center text-xs font-bold font-mono ${posColor} shrink-0`}>{position}</span>

      {/* Nome */}
      <div className="w-36 shrink-0">
        <p className="text-sm font-medium text-slate-100 truncate">{item.nome}</p>
        <p className="text-xs text-slate-500 truncate">{item.cidade || '—'}</p>
      </div>

      {/* Score */}
      <div className="w-24 shrink-0">
        <ScoreBar score={item.score ?? 0} />
      </div>

      {/* Status */}
      <div className="w-20 shrink-0">
        <Badge className={`text-xs px-1.5 py-0 border ${
          item.status === 'ativo' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
          item.status === 'pausado' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
          'bg-slate-700/50 text-slate-400 border-slate-600/20'
        }`}>
          {item.status || '—'}
        </Badge>
      </div>

      {/* Risco Churn */}
      <div className="w-20 shrink-0">
        <Badge className={`text-xs px-1.5 py-0 border ${risco.color}`}>{risco.label}</Badge>
      </div>

      {/* Clima */}
      <div className="w-24 shrink-0">
        <span className={`text-xs ${clima.color}`}>{clima.label}</span>
      </div>

      {/* Tendência */}
      <div className="w-24 shrink-0 flex items-center gap-1">
        <TendIcon className={`w-3.5 h-3.5 ${tendencia.color}`} />
        <span className={`text-xs ${tendencia.color}`}>{tendencia.label}</span>
      </div>

      {/* Pressão cliente */}
      <div className="w-16 shrink-0 text-center">
        {item.pressao_cliente != null ? (
          <div className="flex items-center justify-center gap-0.5">
            {[1,2,3,4,5].map(i => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= item.pressao_cliente ? 'bg-red-400' : 'bg-slate-700'}`} />
            ))}
          </div>
        ) : <span className="text-xs text-slate-600">—</span>}
      </div>

      {/* Sem contato */}
      <div className="w-20 shrink-0 text-center">
        {item.dias_sem_contato != null ? (
          <span className={`text-xs font-mono ${item.dias_sem_contato > 14 ? 'text-red-400' : item.dias_sem_contato > 7 ? 'text-amber-400' : 'text-slate-400'}`}>
            {item.dias_sem_contato}d
          </span>
        ) : <span className="text-xs text-slate-600">—</span>}
      </div>

      {/* Alertas */}
      <div className="w-12 shrink-0 text-center">
        {item.qtd_alertas > 0 ? (
          <span className="text-xs font-bold text-red-400 bg-red-400/10 rounded px-1.5 py-0.5">{item.qtd_alertas}</span>
        ) : <span className="text-xs text-slate-600">0</span>}
      </div>

      {/* Principal risco */}
      <div className="flex-1 min-w-0">
        <span className="text-xs text-slate-400 truncate block">
          {item.principal_risco || <span className="text-slate-600 italic">Sem análise</span>}
        </span>
      </div>

      {/* Última análise */}
      <div className="w-20 shrink-0 text-right text-xs text-slate-600">
        {item.ultima_analise ? item.ultima_analise : <span className="italic">—</span>}
      </div>

      {/* Ação */}
      <div className="w-24 shrink-0 flex justify-end">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onVerAnalise(item)}
        >
          Ver <ChevronRight className="w-3 h-3" />
        </Button>
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

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientesAnalises'],
    queryFn: () => base44.entities.Cliente.filter({ status: 'ativo' }, 'nome', 300),
    staleTime: 60 * 1000
  });

  // Enriquece clientes com campos de análise (vindos de campos do cliente ou zerados)
  const clientesEnriquecidos = clientes.map(c => ({
    ...c,
    score: c.health_score ?? null,
    risco_churn: null,
    clima_emocional: null,
    tendencia: null,
    pressao_cliente: null,
    dias_sem_contato: null,
    qtd_alertas: 0,
    principal_risco: null,
    ultima_analise: null,
  }));

  // Ordenar do pior para o melhor (score null vai para o topo = sem dados = pior)
  const clientesOrdenados = [...clientesEnriquecidos].sort((a, b) => {
    if (a.score == null && b.score == null) return 0;
    if (a.score == null) return -1;
    if (b.score == null) return 1;
    return a.score - b.score;
  });

  // Filtros
  const clientesFiltrados = clientesOrdenados.filter(c => {
    if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false;
    if (filtroRisco !== 'todos' && c.risco_churn !== filtroRisco) return false;
    if (filtroTendencia !== 'todos' && c.tendencia !== filtroTendencia) return false;
    if (somenteCriticos && (c.score == null || c.score >= 40)) return false;
    if (somenteSemAnalise && c.ultima_analise != null) return false;
    if (somenteAlertasVoxx && c.qtd_alertas === 0) return false;
    return true;
  });

  const isFiltered = filtroStatus !== 'todos' || filtroRisco !== 'todos' || filtroTendencia !== 'todos'
    || somenteCriticos || somenteSemAnalise || somenteAlertasVoxx;

  const handleVerAnalise = (cliente) => {
    // Futuro: abrir modal/drawer de análise detalhada
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
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
              onClick={() => setShowParametrizacao(true)}
            >
              <Settings2 className="w-4 h-4" /> Parametrização
            </Button>
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

          {isFiltered && (
            <button
              className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
              onClick={() => {
                setFiltroStatus('todos'); setFiltroRisco('todos'); setFiltroTendencia('todos');
                setSomenteCriticos(false); setSomenteSemAnalise(false); setSomenteAlertasVoxx(false);
              }}
            >
              Limpar filtros
            </button>
          )}
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
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-800/60 border-b border-slate-700/50">
            <span className="w-6 text-center text-xs text-slate-500 font-medium">#</span>
            <span className="w-36 text-xs text-slate-500 font-medium">Cliente</span>
            <span className="w-24 text-xs text-slate-500 font-medium">Score</span>
            <span className="w-20 text-xs text-slate-500 font-medium">Status</span>
            <span className="w-20 text-xs text-slate-500 font-medium">Churn</span>
            <span className="w-24 text-xs text-slate-500 font-medium">Clima</span>
            <span className="w-24 text-xs text-slate-500 font-medium">Tendência</span>
            <span className="w-16 text-center text-xs text-slate-500 font-medium">Pressão</span>
            <span className="w-20 text-center text-xs text-slate-500 font-medium">S/ contato</span>
            <span className="w-12 text-center text-xs text-slate-500 font-medium">Alertas</span>
            <span className="flex-1 text-xs text-slate-500 font-medium">Principal risco</span>
            <span className="w-20 text-right text-xs text-slate-500 font-medium">Últ. análise</span>
            <span className="w-24" />
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
    </div>
  );
}