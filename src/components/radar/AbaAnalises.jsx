import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Zap, ChevronRight, Brain, Play, Users
} from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';
import 'moment-timezone';
import AnaliseDetalheDrawer from './AnaliseDetalheDrawer';

const TZ = 'America/Sao_Paulo';

export const STATUS_CONFIG = {
  excelente:   { label: 'Excelente',   color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' },
  saudavel:    { label: 'Saudável',    color: 'bg-green-500/20 text-green-400 border-green-500/30',       dot: 'bg-green-400' },
  atencao:     { label: 'Atenção',     color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',    dot: 'bg-yellow-400' },
  critico:     { label: 'Crítico',     color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',    dot: 'bg-orange-400' },
  emergencial: { label: 'Emergencial', color: 'bg-red-500/20 text-red-400 border-red-500/30',             dot: 'bg-red-500' },
  sem_dados:   { label: 'Sem dados',   color: 'bg-slate-700 text-slate-400 border-slate-600',             dot: 'bg-slate-500' },
};

export const CHURN_CONFIG = {
  baixo:    { label: 'Baixo',    color: 'text-emerald-400' },
  moderado: { label: 'Moderado', color: 'text-yellow-400' },
  alto:     { label: 'Alto',     color: 'text-orange-400' },
  critico:  { label: 'Crítico',  color: 'text-red-400' },
};

export const CLIMA_CONFIG = {
  positivo:    { label: 'Positivo',    color: 'text-emerald-400' },
  neutro:      { label: 'Neutro',      color: 'text-slate-400' },
  ansioso:     { label: 'Ansioso',     color: 'text-yellow-400' },
  insatisfeito:{ label: 'Insatisfeito',color: 'text-orange-400' },
  critico:     { label: 'Crítico',     color: 'text-red-400' },
  sem_dados:   { label: '—',           color: 'text-slate-500' },
};

export const TENDENCIA_CONFIG = {
  melhorando:  { label: 'Melhorando', icon: TrendingUp,   color: 'text-emerald-400' },
  estavel:     { label: 'Estável',    icon: Minus,        color: 'text-slate-400' },
  piorando:    { label: 'Piorando',   icon: TrendingDown, color: 'text-red-400' },
  sem_dados:   { label: '—',          icon: Minus,        color: 'text-slate-500' },
};

function ordemPrioridade(g) {
  if (g.alertaNivel === 'emergencial') return 1;
  if (g.alertaNivel === 'critico')     return 2;
  if (g.alertaNivel === 'alerta')      return 3;
  if (g.analise?.risco_churn === 'critico') return 4;
  const statusOrd = { emergencial: 5, critico: 6, atencao: 7, sem_dados: 8, saudavel: 9, excelente: 10 };
  return statusOrd[g.analise?.status || 'sem_dados'] || 8;
}

export default function AbaAnalises({ gruposEnriquecidos, clientes }) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroChurn, setFiltroChurn] = useState('todos');
  const [filtroTendencia, setFiltroTendencia] = useState('todos');
  const [filtroAlerta, setFiltroAlerta] = useState('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('7');
  const [gerandoId, setGerandoId] = useState(null);
  const [gerandoTodos, setGerandoTodos] = useState(false);
  const [analiseSelecionada, setAnaliseSelecionada] = useState(null);
  const [grupoSelecionado, setGrupoSelecionado] = useState(null);

  // Buscar análises mais recentes por grupo
  const { data: analises = [], isLoading: loadingAnalises } = useQuery({
    queryKey: ['radarAnalises'],
    queryFn: () => base44.entities.WhatsappAnaliseGrupo.list('-created_date', 200),
    staleTime: 60 * 1000,
  });

  // Análise mais recente por grupo_id
  const analisesPorGrupo = useMemo(() => {
    const map = {};
    analises.forEach(a => {
      if (!map[a.grupo_id] || a.created_date > map[a.grupo_id].created_date) {
        map[a.grupo_id] = a;
      }
    });
    return map;
  }, [analises]);

  // Enriquecer grupos com análise
  const itens = useMemo(() => {
    return gruposEnriquecidos.map(g => ({
      ...g,
      analise: analisesPorGrupo[g.grupo_id] || null,
    })).sort((a, b) => ordemPrioridade(a) - ordemPrioridade(b));
  }, [gruposEnriquecidos, analisesPorGrupo]);

  // Grupos sem remetentes parametrizados
  const semParametrizacao = useMemo(() =>
    itens.filter(g => g.todasMsgs?.some(m => m.remetente_tipo === 'desconhecido')).length
  , [itens]);

  // Filtros
  const filtrados = useMemo(() => {
    return itens.filter(g => {
      if (filtroStatus !== 'todos' && g.analise?.status !== filtroStatus) return false;
      if (filtroChurn !== 'todos' && g.analise?.risco_churn !== filtroChurn) return false;
      if (filtroTendencia !== 'todos' && g.analise?.tendencia !== filtroTendencia) return false;
      if (filtroAlerta === 'com_alerta' && !g.alertaNivel) return false;
      if (filtroAlerta === 'sem_analise' && g.analise) return false;
      if (filtroAlerta === 'criticos' && !['critico', 'emergencial'].includes(g.analise?.status)) return false;
      if (busca) {
        const b = busca.toLowerCase();
        if (!g.nome_grupo?.toLowerCase().includes(b) && !g.cliente_nome?.toLowerCase().includes(b)) return false;
      }
      return true;
    });
  }, [itens, filtroStatus, filtroChurn, filtroTendencia, filtroAlerta, busca]);

  const handleGerar = async (grupo) => {
    if (!grupo.cliente_id) {
      toast.error('Vincule o grupo a um cliente antes de gerar análise.');
      return;
    }
    setGerandoId(grupo.grupo_id);
    try {
      const res = await base44.functions.invoke('gerarAnaliseGrupoWhatsapp', {
        grupo_id: grupo.grupo_id,
        periodo_dias: parseInt(filtroPeriodo),
      });
      if (res.data?.ok === false) {
        toast.warning(res.data.mensagem || 'Sem dados suficientes.');
      } else {
        toast.success(`Análise gerada: Score ${res.data?.scores?.geral}`);
        queryClient.invalidateQueries({ queryKey: ['radarAnalises'] });
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    } finally {
      setGerandoId(null);
    }
  };

  const handleGerarTodos = async () => {
    const elegíveis = itens.filter(g => g.cliente_id && g.totalMsgs >= 3);
    if (!elegíveis.length) { toast.warning('Nenhum grupo elegível para análise.'); return; }
    setGerandoTodos(true);
    let ok = 0, err = 0;
    for (const g of elegíveis) {
      try {
        const res = await base44.functions.invoke('gerarAnaliseGrupoWhatsapp', {
          grupo_id: g.grupo_id,
          periodo_dias: parseInt(filtroPeriodo),
        });
        if (res.data?.ok !== false) ok++;
        else err++;
      } catch { err++; }
    }
    toast.success(`${ok} análises geradas. ${err > 0 ? `${err} com erro.` : ''}`);
    queryClient.invalidateQueries({ queryKey: ['radarAnalises'] });
    setGerandoTodos(false);
  };

  const tempoFormatado = (min) => {
    if (!min) return null;
    if (min >= 60) return `${Math.floor(min / 60)}h${min % 60 > 0 ? `${min % 60}m` : ''}`;
    return `${min}m`;
  };

  return (
    <div className="space-y-4">
      {/* Aviso remetentes não parametrizados */}
      {semParametrizacao > 0 && (
        <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-amber-300">
            <strong>{semParametrizacao} grupo(s)</strong> têm remetentes não classificados. Classifique os remetentes na aba Grupos & Clientes para melhorar a precisão da análise.
          </span>
        </div>
      )}

      {/* Filtros + Ações */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
          <Input placeholder="Buscar cliente ou grupo..." value={busca} onChange={e => setBusca(e.target.value)}
            className="pl-8 w-48 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm" />
        </div>

        <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
          <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-slate-100 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="14">14 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-slate-100 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="todos">Todos status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtroChurn} onValueChange={setFiltroChurn}>
          <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-slate-100 text-sm"><SelectValue placeholder="Churn" /></SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="todos">Risco churn</SelectItem>
            {Object.entries(CHURN_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtroAlerta} onValueChange={setFiltroAlerta}>
          <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-slate-100 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="com_alerta">Com alerta VOXX</SelectItem>
            <SelectItem value="sem_analise">Sem análise</SelectItem>
            <SelectItem value="criticos">Somente críticos</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-slate-500 ml-auto">{filtrados.length} grupos</span>

        <Button onClick={handleGerarTodos} disabled={gerandoTodos}
          className="bg-violet-700 hover:bg-violet-600 gap-2 text-sm h-8">
          {gerandoTodos ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
          Analisar Todos
        </Button>

        <Button size="sm" variant="ghost" onClick={() => queryClient.invalidateQueries({ queryKey: ['radarAnalises'] })}
          className="text-slate-400 hover:text-white h-8">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Ranking */}
      <div className="space-y-2">
        {loadingAnalises && !filtrados.length ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-400" /></div>
        ) : filtrados.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl py-16 text-center text-slate-500">
            Nenhum grupo encontrado.
          </div>
        ) : (
          filtrados.map((g, idx) => {
            const a = g.analise;
            const statusCfg = STATUS_CONFIG[a?.status || 'sem_dados'];
            const churnCfg  = CHURN_CONFIG[a?.risco_churn || 'moderado'];
            const climaCfg  = CLIMA_CONFIG[a?.clima_emocional || 'sem_dados'];
            const tendCfg   = TENDENCIA_CONFIG[a?.tendencia || 'sem_dados'];
            const TendIcon  = tendCfg.icon;
            const isGerando = gerandoId === g.grupo_id;

            return (
              <div key={g.id}
                className={`bg-slate-900 border rounded-xl px-4 py-3 hover:border-slate-600 transition-all ${
                  g.alertaNivel === 'emergencial' ? 'border-red-800/50 bg-red-950/10' :
                  g.alertaNivel === 'critico'     ? 'border-orange-800/50 bg-orange-950/10' :
                  g.alertaNivel === 'alerta'       ? 'border-yellow-800/40' :
                  'border-slate-800'
                }`}>
                <div className="flex items-center gap-3">
                  {/* Posição */}
                  <span className="text-slate-600 font-mono text-xs w-5 text-right flex-shrink-0">{idx + 1}</span>

                  {/* Score */}
                  <ScoreBadge score={a?.score_geral} />

                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{g.cliente_nome || <span className="text-slate-500 italic text-xs">Sem vínculo</span>}</span>
                      <span className="text-slate-500 text-xs">·</span>
                      <span className="text-slate-400 text-xs truncate max-w-[180px]">{g.nome_grupo}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className={`text-[10px] border ${statusCfg.color}`}>{statusCfg.label}</Badge>
                      {a && (
                        <>
                          <span className={`text-[11px] ${churnCfg.color}`}>Churn: {churnCfg.label}</span>
                          <span className={`text-[11px] ${climaCfg.color}`}>{climaCfg.label}</span>
                          <span className={`text-[11px] flex items-center gap-0.5 ${tendCfg.color}`}>
                            <TendIcon className="w-3 h-3" />{tendCfg.label}
                          </span>
                        </>
                      )}
                      {g.alertaNivel && (
                        <Badge className={`text-[10px] border gap-1 ${
                          g.alertaNivel === 'emergencial' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                          g.alertaNivel === 'critico' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                          'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        }`}>
                          <Zap className="w-2.5 h-2.5" />
                          {tempoFormatado(g.minutosSemResposta)} sem resposta
                        </Badge>
                      )}
                    </div>
                    {a?.principal_risco && (
                      <p className="text-red-400/70 text-[11px] mt-1 truncate">⚠ {a.principal_risco}</p>
                    )}
                    {!g.cliente_id && (
                      <p className="text-amber-500/70 text-[11px] mt-1">Vincule este grupo a um cliente para gerar análise.</p>
                    )}
                    {g.cliente_id && !a && g.totalMsgs < 3 && (
                      <p className="text-slate-500 text-[11px] mt-1">Sem mensagens suficientes para análise confiável.</p>
                    )}
                  </div>

                  {/* Métricas rápidas */}
                  <div className="hidden lg:flex items-center gap-4 text-xs text-slate-400 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-white font-medium">{g.msgsHoje}</p>
                      <p className="text-[10px] text-slate-500">hoje</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-medium">{g.totalMsgs}</p>
                      <p className="text-[10px] text-slate-500">total</p>
                    </div>
                    {a?.created_date && (
                      <div className="text-center">
                        <p className="text-white font-medium text-[11px]">{moment(a.created_date).tz(TZ).format('DD/MM')}</p>
                        <p className="text-[10px] text-slate-500">análise</p>
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => handleGerar(g)} disabled={isGerando || !g.cliente_id}
                      className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 h-7 gap-1 text-[11px] px-2">
                      {isGerando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      {a ? 'Re-analisar' : 'Analisar'}
                    </Button>
                    {a && (
                      <Button size="sm" variant="ghost"
                        onClick={() => { setAnaliseSelecionada(a); setGrupoSelecionado(g); }}
                        className="text-slate-400 hover:text-white hover:bg-slate-700 h-7 gap-1 text-[11px] px-2">
                        <ChevronRight className="w-3 h-3" /> Ver
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Drawer detalhe */}
      {analiseSelecionada && grupoSelecionado && (
        <AnaliseDetalheDrawer
          analise={analiseSelecionada}
          grupo={grupoSelecionado}
          analiseHistorico={analises.filter(a => a.grupo_id === grupoSelecionado.grupo_id).sort((a, b) => b.created_date > a.created_date ? 1 : -1)}
          onClose={() => { setAnaliseSelecionada(null); setGrupoSelecionado(null); }}
          onReanalisar={() => handleGerar(grupoSelecionado)}
          gerandoId={gerandoId}
        />
      )}
    </div>
  );
}

function ScoreBadge({ score }) {
  if (score == null) return <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 text-xs flex-shrink-0">—</div>;
  const color = score >= 90 ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30' :
    score >= 75 ? 'text-green-400 border-green-500/40 bg-green-950/30' :
    score >= 60 ? 'text-yellow-400 border-yellow-500/40 bg-yellow-950/30' :
    score >= 40 ? 'text-orange-400 border-orange-500/40 bg-orange-950/30' :
    'text-red-400 border-red-500/40 bg-red-950/30';
  return (
    <div className={`w-10 h-10 rounded-lg border flex items-center justify-center font-bold text-sm flex-shrink-0 ${color}`}>
      {score}
    </div>
  );
}