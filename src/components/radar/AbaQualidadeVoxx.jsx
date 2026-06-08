import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Star, Search, AlertTriangle, CheckCircle, RotateCcw, Copy, CheckCheck,
  Play, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import moment from 'moment';
import 'moment-timezone';
import { toast } from 'sonner';
import AvaliacaoDetalheDrawer from './AvaliacaoDetalheDrawer';

const TZ = 'America/Sao_Paulo';

const CLASSIF_CONFIG = {
  excelente: { label: 'Excelente', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', bg: 'bg-emerald-950/10' },
  boa:       { label: 'Boa',       color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',         bg: '' },
  atencao:   { label: 'Atenção',   color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',   bg: 'bg-yellow-950/10' },
  fraca:     { label: 'Fraca',     color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',   bg: 'bg-orange-950/10' },
  critica:   { label: 'Crítica',   color: 'bg-red-500/20 text-red-400 border-red-500/30',            bg: 'bg-red-950/20' },
};

function ScoreChip({ score }) {
  const color = score >= 75 ? 'text-emerald-400' : score >= 60 ? 'text-yellow-400' : score >= 40 ? 'text-orange-400' : 'text-red-400';
  return <span className={`font-bold text-base tabular-nums ${color}`}>{score}</span>;
}

export default function AbaQualidadeVoxx({ clientes, gruposEnriquecidos }) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [filtroClassif, setFiltroClassif] = useState('todos');
  const [filtroRemetente, setFiltroRemetente] = useState('todos');
  const [filtroCliente, setFiltroCliente] = useState('todos');
  const [avaliacaoSelecionada, setAvaliacaoSelecionada] = useState(null);
  const [avaliandoLote, setAvaliandoLote] = useState(false);
  const [periodoLote, setPeriodoLote] = useState('24h');

  // ── Dados ────────────────────────────────────────────────────
  const { data: avaliacoes = [], isLoading } = useQuery({
    queryKey: ['avaliacoesMensagens'],
    queryFn: () => base44.entities.WhatsappAvaliacaoMensagemVoxx.list('-data_mensagem', 200),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  // Subscrição realtime
  React.useEffect(() => {
    const unsub = base44.entities.WhatsappAvaliacaoMensagemVoxx.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['avaliacoesMensagens'] });
    });
    return unsub;
  }, [queryClient]);

  // ── KPIs ──────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const hoje = moment().tz(TZ).startOf('day');
    const hoje_ = avaliacoes.filter(a => moment(a.data_mensagem).tz(TZ).isAfter(hoje));
    const total = avaliacoes.length;
    const scoresMedio = total > 0 ? Math.round(avaliacoes.reduce((s, a) => s + (a.score_qualidade || 0), 0) / total) : 0;
    const scoreMedioHoje = hoje_.length > 0
      ? Math.round(hoje_.reduce((s, a) => s + (a.score_qualidade || 0), 0) / hoje_.length) : 0;

    return {
      total,
      hoje: hoje_.length,
      scoreMedioGeral: scoresMedio,
      scoreMedioHoje,
      atencao: avaliacoes.filter(a => a.classificacao === 'atencao').length,
      fraca: avaliacoes.filter(a => a.classificacao === 'fraca').length,
      critica: avaliacoes.filter(a => a.classificacao === 'critica').length,
      excelentes: avaliacoes.filter(a => a.classificacao === 'excelente').length,
      boas: avaliacoes.filter(a => a.classificacao === 'boa').length,
    };
  }, [avaliacoes]);

  // ── Remetentes únicos ──────────────────────────────────────────
  const remetentesUnicos = useMemo(() => {
    const set = new Map();
    avaliacoes.forEach(a => {
      if (a.remetente_nome) set.set(a.remetente_nome, a.remetente_nome);
    });
    return Array.from(set.values()).sort();
  }, [avaliacoes]);

  // ── Clientes únicos ──────────────────────────────────────────
  const clientesUnicos = useMemo(() => {
    const set = new Map();
    avaliacoes.forEach(a => {
      if (a.cliente_id && a.cliente_nome) set.set(a.cliente_id, a.cliente_nome);
    });
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [avaliacoes]);

  // ── Stats por remetente ──────────────────────────────────────
  const statsPorRemetente = useMemo(() => {
    const map = {};
    avaliacoes.forEach(a => {
      if (!a.remetente_nome) return;
      if (!map[a.remetente_nome]) map[a.remetente_nome] = { nome: a.remetente_nome, scores: [], atencao: 0, critica: 0, total: 0 };
      map[a.remetente_nome].scores.push(a.score_qualidade || 0);
      map[a.remetente_nome].total++;
      if (a.classificacao === 'atencao' || a.classificacao === 'fraca') map[a.remetente_nome].atencao++;
      if (a.classificacao === 'critica') map[a.remetente_nome].critica++;
    });
    return Object.values(map).map(r => ({
      ...r,
      scoreMedio: Math.round(r.scores.reduce((s, v) => s + v, 0) / r.scores.length)
    })).sort((a, b) => a.scoreMedio - b.scoreMedio);
  }, [avaliacoes]);

  // ── Filtros ───────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    return avaliacoes.filter(a => {
      if (filtroClassif !== 'todos' && a.classificacao !== filtroClassif) return false;
      if (filtroRemetente !== 'todos' && a.remetente_nome !== filtroRemetente) return false;
      if (filtroCliente !== 'todos' && a.cliente_id !== filtroCliente) return false;
      if (busca) {
        const b = busca.toLowerCase();
        if (
          !a.cliente_nome?.toLowerCase().includes(b) &&
          !a.grupo_nome?.toLowerCase().includes(b) &&
          !a.remetente_nome?.toLowerCase().includes(b) &&
          !a.mensagem_original?.toLowerCase().includes(b)
        ) return false;
      }
      return true;
    });
  }, [avaliacoes, filtroClassif, filtroRemetente, filtroCliente, busca]);

  // ── Ações ─────────────────────────────────────────────────────
  const avaliarLote = async () => {
    setAvaliandoLote(true);
    try {
      const res = await base44.functions.invoke('avaliarMensagemVoxx', {
        modo_lote: true,
        filtro: { periodo: periodoLote, apenas_nao_avaliadas: true, limite: 50 }
      });
      const count = res.data?.avaliados || 0;
      toast.success(`${count} mensagens avaliadas com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['avaliacoesMensagens'] });
    } catch (err) {
      toast.error('Erro ao avaliar mensagens: ' + err.message);
    } finally {
      setAvaliandoLote(false);
    }
  };

  const reavaliar = async (avaliacao) => {
    toast.info('Reavaliando mensagem...');
    try {
      const res = await base44.functions.invoke('avaliarMensagemVoxx', {
        mensagem_id: avaliacao.mensagem_id,
        forcar_reavaliacao: true
      });
      toast.success('Mensagem reavaliada!');
      queryClient.invalidateQueries({ queryKey: ['avaliacoesMensagens'] });
      if (avaliacaoSelecionada?.id === avaliacao.id) {
        setAvaliacaoSelecionada(res.data?.avaliacao || null);
      }
    } catch (err) {
      toast.error('Erro ao reavaliar: ' + err.message);
    }
  };

  const resolver = async (avaliacao) => {
    await base44.entities.WhatsappAvaliacaoMensagemVoxx.update(avaliacao.id, { resolvido: true });
    toast.success('Marcado como resolvido.');
    queryClient.invalidateQueries({ queryKey: ['avaliacoesMensagens'] });
    setAvaliacaoSelecionada(prev => prev ? { ...prev, resolvido: true } : null);
  };

  const copiarSugestao = (a) => {
    navigator.clipboard.writeText(a.versao_sugerida || a.sugestao_melhoria || '');
    toast.success('Sugestão copiada!');
  };

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiQ label="Score Médio Hoje" value={kpis.scoreMedioHoje} suffix="/100"
          color={kpis.scoreMedioHoje >= 75 ? 'emerald' : kpis.scoreMedioHoje >= 60 ? 'yellow' : 'red'} />
        <KpiQ label="Score Médio Geral" value={kpis.scoreMedioGeral} suffix="/100" color="blue" />
        <KpiQ label="Avaliadas Hoje" value={kpis.hoje} color="violet" />
        <KpiQ label="Total Avaliadas" value={kpis.total} color="slate" />
        <KpiQ label="Excelentes" value={kpis.excelentes} color="emerald" />
        <KpiQ label="Boas" value={kpis.boas} color="blue" />
        <KpiQ label="Atenção" value={kpis.atencao} color="yellow" pulse={kpis.atencao > 0} />
        <KpiQ label="Fracas/Críticas" value={kpis.fraca + kpis.critica} color="red" pulse={kpis.critica > 0} />
      </div>

      {/* Stats por remetente */}
      {statsPorRemetente.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Score Médio por Remetente VOXX</h3>
          <div className="flex flex-wrap gap-3">
            {statsPorRemetente.map(r => {
              const cor = r.scoreMedio >= 75 ? 'text-emerald-400' : r.scoreMedio >= 60 ? 'text-yellow-400' : 'text-red-400';
              return (
                <button key={r.nome}
                  onClick={() => setFiltroRemetente(filtroRemetente === r.nome ? 'todos' : r.nome)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors text-xs ${
                    filtroRemetente === r.nome
                      ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}>
                  <span>{r.nome}</span>
                  <span className={`font-bold ${cor}`}>{r.scoreMedio}</span>
                  <span className="text-slate-500">({r.total})</span>
                  {r.critica > 0 && <span className="text-red-400">⚠️{r.critica}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
          <Input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)}
            className="pl-8 w-48 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm" />
        </div>

        <Select value={filtroClassif} onValueChange={setFiltroClassif}>
          <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-slate-100 text-sm">
            <SelectValue placeholder="Classificação" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="excelente">Excelente</SelectItem>
            <SelectItem value="boa">Boa</SelectItem>
            <SelectItem value="atencao">Atenção</SelectItem>
            <SelectItem value="fraca">Fraca</SelectItem>
            <SelectItem value="critica">Crítica</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroCliente} onValueChange={setFiltroCliente}>
          <SelectTrigger className="w-44 bg-slate-800 border-slate-700 text-slate-100 text-sm">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="todos">Todos os clientes</SelectItem>
            {clientesUnicos.map(([id, nome]) => (
              <SelectItem key={id} value={id}>{nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtroRemetente !== 'todos' && (
          <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-xs cursor-pointer"
            onClick={() => setFiltroRemetente('todos')}>
            {filtroRemetente} ✕
          </Badge>
        )}

        <span className="text-xs text-slate-500 ml-auto">{filtradas.length} registros</span>

        {/* Avaliar lote */}
        <div className="flex items-center gap-2">
          <Select value={periodoLote} onValueChange={setPeriodoLote}>
            <SelectTrigger className="w-28 bg-slate-800 border-slate-700 text-slate-100 text-sm h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="24h">Últimas 24h</SelectItem>
              <SelectItem value="7d">Últimos 7d</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={avaliarLote} disabled={avaliandoLote}
            className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5 text-xs h-8">
            {avaliandoLote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Avaliar mensagens
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-slate-800">
              <tr>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Data/Hora</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Cliente / Grupo</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Remetente</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Mensagem</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Score</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Classificação</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Problema / Risco</th>
                <th className="px-3 py-3 text-slate-500 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Carregando avaliações...
                </td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  <Star className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma avaliação encontrada.</p>
                  <p className="text-slate-600 text-[11px] mt-1">Clique em "Avaliar mensagens" para gerar avaliações.</p>
                </td></tr>
              ) : (
                filtradas.map(a => {
                  const classif = CLASSIF_CONFIG[a.classificacao] || CLASSIF_CONFIG.atencao;
                  return (
                    <tr key={a.id}
                      className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${classif.bg} ${a.resolvido ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {a.data_mensagem ? moment(a.data_mensagem).tz(TZ).format('DD/MM HH:mm') : '—'}
                        {a.resolvido && <span className="ml-1.5 text-emerald-500 text-[10px]">✓</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-white text-sm">{a.cliente_nome || <span className="text-slate-500 italic">—</span>}</div>
                        <div className="text-slate-500 text-[11px]">{a.grupo_nome}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-300">{a.remetente_nome || '—'}</td>
                      <td className="px-3 py-3">
                        <p className="max-w-[200px] truncate text-slate-300">{a.mensagem_original}</p>
                      </td>
                      <td className="px-3 py-3"><ScoreChip score={a.score_qualidade ?? 0} /></td>
                      <td className="px-3 py-3">
                        <Badge className={`text-[10px] border ${classif.color}`}>{classif.label}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        {a.risco_detectado
                          ? <p className="max-w-[180px] truncate text-red-300 text-[11px]">{a.risco_detectado}</p>
                          : a.pontos_atencao?.[0]
                          ? <p className="max-w-[180px] truncate text-yellow-400 text-[11px]">{a.pontos_atencao[0]}</p>
                          : <span className="text-slate-600">—</span>
                        }
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setAvaliacaoSelecionada(a)}
                            className="text-slate-400 hover:text-white hover:bg-slate-700 h-7 w-7 p-0">
                            <Star className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => reavaliar(a)}
                            className="text-slate-400 hover:text-white hover:bg-slate-700 h-7 w-7 p-0">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                          {(a.sugestao_melhoria || a.versao_sugerida) && (
                            <Button size="sm" variant="ghost" onClick={() => copiarSugestao(a)}
                              className="text-slate-400 hover:text-white hover:bg-slate-700 h-7 w-7 p-0">
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {!a.resolvido && (
                            <Button size="sm" variant="ghost" onClick={() => resolver(a)}
                              className="text-slate-400 hover:text-emerald-400 hover:bg-slate-700 h-7 w-7 p-0">
                              <CheckCheck className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer detalhe */}
      {avaliacaoSelecionada && (
        <AvaliacaoDetalheDrawer
          avaliacao={avaliacaoSelecionada}
          onClose={() => setAvaliacaoSelecionada(null)}
          onReavaliar={() => reavaliar(avaliacaoSelecionada)}
          onResolver={() => resolver(avaliacaoSelecionada)}
        />
      )}
    </div>
  );
}

function KpiQ({ label, value, suffix = '', color, pulse }) {
  const colors = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
    yellow:  'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    orange:  'text-orange-400 bg-orange-500/10 border-orange-500/20',
    red:     'text-red-400 bg-red-500/10 border-red-500/20',
    violet:  'text-violet-400 bg-violet-500/10 border-violet-500/20',
    slate:   'text-slate-400 bg-slate-800 border-slate-700',
  };
  const cls = colors[color] || colors.slate;
  return (
    <div className={`rounded-xl border p-3 ${cls} ${pulse ? 'animate-pulse' : ''}`}>
      <div className="text-[10px] font-medium uppercase tracking-wider opacity-70 mb-1">{label}</div>
      <div className="font-bold text-xl tabular-nums">{value}{suffix && <span className="text-xs font-normal opacity-60 ml-0.5">{suffix}</span>}</div>
    </div>
  );
}