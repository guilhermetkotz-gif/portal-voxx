import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, TrendingUp, TrendingDown, Minus, MessageSquare, BarChart3, Target, Smile, Activity, Clock, Kanban, Calendar, ChevronRight } from 'lucide-react';
import EficaciaDetalheDrawer from '@/components/metaads/EficaciaDetalheDrawer';
import { cn } from '@/lib/utils';
import moment from 'moment-timezone';

const TZ = 'America/Sao_Paulo';

export default function EficaciaOtimizacoesTab() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filtroEficacia, setFiltroEficacia] = useState('all');
    const [filtroSentimento, setFiltroSentimento] = useState('all');
    const [filtroPeriodo, setFiltroPeriodo] = useState('30d');
    const [selectedGrupo, setSelectedGrupo] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const { data: avaliacoes = [], isLoading } = useQuery({
        queryKey: ['avaliacoesEficacia'],
        queryFn: () => base44.entities.AvaliacaoEficaciaOtimizacao.list('-data_otimizacao', 500),
        staleTime: 60 * 1000
    });

    // Buscar otimizações de origem kanban para verificar setor_responsavel_original da demanda
    const { data: kanbanOtimizacoes = [] } = useQuery({
        queryKey: ['kanbanOtimizacoesEficacia'],
        queryFn: () => base44.entities.MetaAdsOtimizacao.filter({ origem_registro: 'kanban' }, '-data_acao', 500),
        staleTime: 5 * 60 * 1000
    });

    // Buscar demandas vinculadas às otimizações kanban para verificar setor_responsavel_original
    const { data: demandasKanban = [] } = useQuery({
        queryKey: ['demandasKanbanEficacia', kanbanOtimizacoes.map(o => o.demanda_id).filter(Boolean).join(',')],
        queryFn: async () => {
            const demandaIds = [...new Set(kanbanOtimizacoes.map(o => o.demanda_id).filter(Boolean))];
            if (demandaIds.length === 0) return [];
            const demandas = [];
            for (const id of demandaIds) {
                try {
                    const found = await base44.entities.Demanda.filter({ id });
                    if (found[0]) demandas.push(found[0]);
                } catch (e) { /* skip invalid id */ }
            }
            return demandas;
        },
        enabled: kanbanOtimizacoes.length > 0,
        staleTime: 5 * 60 * 1000
    });

    // Set de otimizacao_ids a excluir (kanban + setor_responsavel_original !== TRAFEGO_META)
    const otimizacaoIdsExcluir = useMemo(() => {
        const demandaIdsNaoTrafego = new Set(
            demandasKanban
                .filter(d => d.setor_responsavel_original !== 'TRAFEGO_META')
                .map(d => d.id)
        );
        return new Set(
            kanbanOtimizacoes
                .filter(o => o.demanda_id && demandaIdsNaoTrafego.has(o.demanda_id))
                .map(o => o.id)
        );
    }, [kanbanOtimizacoes, demandasKanban]);

    // Filtrar avaliações: remover kanban cuja demanda não foi aberta diretamente em TRAFEGO_META
    const avaliacoesValidas = useMemo(() => {
        return avaliacoes.filter(a => !otimizacaoIdsExcluir.has(a.otimizacao_id));
    }, [avaliacoes, otimizacaoIdsExcluir]);

    const periodoDias = { '7d': 7, '30d': 30, '90d': 90, 'all': 9999 };
    const periodoCorte = useMemo(() => {
        return moment().tz(TZ).subtract(periodoDias[filtroPeriodo] || 30, 'days');
    }, [filtroPeriodo]);

    const avaliacoesPeriodo = useMemo(() => {
        return avaliacoesValidas.filter(a => {
            if (!a.data_otimizacao) return false;
            return moment(a.data_otimizacao).isAfter(periodoCorte);
        });
    }, [avaliacoesValidas, periodoCorte]);

    const concluidas = avaliacoesPeriodo.filter(a => a.status === 'concluida');
    const pendentes = avaliacoesPeriodo.filter(a => a.status === 'pendente');

    const stats = useMemo(() => {
        if (concluidas.length === 0) {
            return { avgEficacia: 0, avgSatisfacao: 0, totalMelhorou: 0, totalPiorou: 0, totalEstavel: 0 };
        }
        const avgEficacia = concluidas.reduce((s, a) => s + (a.score_eficacia || 0), 0) / concluidas.length;
        const comSatisfacao = concluidas.filter(a => a.score_satisfacao != null);
        const avgSatisfacao = comSatisfacao.length > 0
            ? comSatisfacao.reduce((s, a) => s + (a.score_satisfacao || 0), 0) / comSatisfacao.length
            : 0;
        return {
            avgEficacia,
            avgSatisfacao,
            totalMelhorou: concluidas.filter(a => a.eficacia_tecnica === 'melhorou').length,
            totalPiorou: concluidas.filter(a => a.eficacia_tecnica === 'piorou').length,
            totalEstavel: concluidas.filter(a => a.eficacia_tecnica === 'estavel').length
        };
    }, [concluidas]);

    // Group by account_name — each unit appears only once
    const grupos = useMemo(() => {
        const map = {};
        avaliacoesPeriodo.forEach(a => {
            const key = a.account_name || 'Sem conta';
            if (!map[key]) {
                map[key] = {
                    account_name: key,
                    cliente_nome: a.cliente_nome || '',
                    avaliacoes: [],
                    melhorou: 0,
                    estavel: 0,
                    piorou: 0,
                    pendente: 0,
                    erro: 0,
                    totalScore: 0,
                    scoreCount: 0,
                    datas: [],
                };
            }
            map[key].avaliacoes.push(a);
            if (a.status === 'concluida') {
                if (a.eficacia_tecnica === 'melhorou') map[key].melhorou++;
                else if (a.eficacia_tecnica === 'estavel') map[key].estavel++;
                else if (a.eficacia_tecnica === 'piorou') map[key].piorou++;
                if (a.score_eficacia != null) {
                    map[key].totalScore += a.score_eficacia;
                    map[key].scoreCount++;
                }
            } else if (a.status === 'pendente') {
                map[key].pendente++;
            } else if (a.status === 'erro') {
                map[key].erro++;
            }
            if (a.data_otimizacao) {
                map[key].datas.push(a.data_otimizacao);
            }
        });
        Object.values(map).forEach(g => {
            g.datas.sort((a, b) => b.localeCompare(a));
            g.avgScore = g.scoreCount > 0 ? Math.round(g.totalScore / g.scoreCount) : 0;
        });
        return Object.values(map);
    }, [avaliacoesPeriodo]);

    const filteredGrupos = useMemo(() => {
        return grupos.filter(g => {
            const matchesSearch = g.account_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                g.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesEficacia = filtroEficacia === 'all' ||
                (filtroEficacia === 'melhorou' && g.melhorou > 0) ||
                (filtroEficacia === 'estavel' && g.estavel > 0) ||
                (filtroEficacia === 'piorou' && g.piorou > 0);
            const matchesSentimento = filtroSentimento === 'all' ||
                g.avaliacoes.some(a => a.sentimento_cliente === filtroSentimento);
            return matchesSearch && matchesEficacia && matchesSentimento;
        }).sort((a, b) => {
            const aLast = a.datas[0] || '';
            const bLast = b.datas[0] || '';
            return bLast.localeCompare(aLast);
        });
    }, [grupos, searchTerm, filtroEficacia, filtroSentimento]);

    const getScoreColor = (score) => {
        if (score >= 65) return 'text-green-600';
        if (score >= 40) return 'text-yellow-600';
        return 'text-red-600';
    };

    const handleOpenDrawer = (grupo) => {
        setSelectedGrupo(grupo);
        setDrawerOpen(true);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <BarChart3 className="w-4 h-4 text-violet-600" />
                            <span className="text-xs text-slate-500">Unidades com Avaliações</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-900">{filteredGrupos.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4 text-yellow-500" />
                            <span className="text-xs text-slate-500">Aguardando (T+3)</span>
                        </div>
                        <p className="text-2xl font-bold text-yellow-600">{pendentes.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Activity className="w-4 h-4 text-violet-600" />
                            <span className="text-xs text-slate-500">Eficácia Média</span>
                        </div>
                        <p className={cn("text-2xl font-bold", getScoreColor(stats.avgEficacia))}>
                            {stats.avgEficacia.toFixed(0)}
                            <span className="text-sm text-slate-400">/100</span>
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Smile className="w-4 h-4 text-blue-600" />
                            <span className="text-xs text-slate-500">Satisfação Média</span>
                        </div>
                        <p className={cn("text-2xl font-bold", getScoreColor(stats.avgSatisfacao))}>
                            {stats.avgSatisfacao.toFixed(0)}
                            <span className="text-sm text-slate-400">/100</span>
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            <span className="text-xs text-slate-500">Melhoraram</span>
                        </div>
                        <p className="text-2xl font-bold text-green-600">{stats.totalMelhorou}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingDown className="w-4 h-4 text-red-600" />
                            <span className="text-xs text-slate-500">Pioraram</span>
                        </div>
                        <p className="text-2xl font-bold text-red-600">{stats.totalPiorou}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Buscar por conta ou cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                    <SelectTrigger className="w-full md:w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7d">Últimos 7 dias</SelectItem>
                        <SelectItem value="30d">Últimos 30 dias</SelectItem>
                        <SelectItem value="90d">Últimos 90 dias</SelectItem>
                        <SelectItem value="all">Todo o período</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filtroEficacia} onValueChange={setFiltroEficacia}>
                    <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="Eficácia" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas Eficácias</SelectItem>
                        <SelectItem value="melhorou">Melhorou</SelectItem>
                        <SelectItem value="estavel">Estável</SelectItem>
                        <SelectItem value="piorou">Piorou</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filtroSentimento} onValueChange={setFiltroSentimento}>
                    <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="Sentimento" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos Sentimentos</SelectItem>
                        <SelectItem value="positivo">Positivo</SelectItem>
                        <SelectItem value="neutro">Neutro</SelectItem>
                        <SelectItem value="negativo">Negativo</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Grouped list — each unit appears only once */}
            <div className="space-y-3">
                {filteredGrupos.map(grupo => (
                    <Card
                        key={grupo.account_name}
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => handleOpenDrawer(grupo)}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-semibold text-slate-900 truncate">
                                            {grupo.account_name}
                                        </h3>
                                        {grupo.avaliacoes[0]?.origem_registro === 'kanban' ? (
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1 shrink-0">
                                                <Kanban className="w-3 h-3" /> Kanban
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 gap-1 shrink-0">
                                                <BarChart3 className="w-3 h-3" /> Monitoramento
                                            </Badge>
                                        )}
                                        <Badge className="bg-violet-600 shrink-0">
                                            {grupo.avaliacoes.length} {grupo.avaliacoes.length === 1 ? 'ação' : 'ações'}
                                        </Badge>
                                    </div>

                                    {/* Eficacy breakdown */}
                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                        {grupo.melhorou > 0 && (
                                            <Badge className="bg-green-500 text-white gap-1">
                                                <TrendingUp className="w-3 h-3" />{grupo.melhorou} melhorou
                                            </Badge>
                                        )}
                                        {grupo.estavel > 0 && (
                                            <Badge className="bg-yellow-500 text-white gap-1">
                                                <Minus className="w-3 h-3" />{grupo.estavel} estável
                                            </Badge>
                                        )}
                                        {grupo.piorou > 0 && (
                                            <Badge className="bg-red-500 text-white gap-1">
                                                <TrendingDown className="w-3 h-3" />{grupo.piorou} piorou
                                            </Badge>
                                        )}
                                        {grupo.pendente > 0 && (
                                            <Badge variant="outline" className="text-yellow-600 border-yellow-300 gap-1">
                                                <Clock className="w-3 h-3" />{grupo.pendente} pendente
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Timeline of optimization dates */}
                                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                                        <span className="shrink-0">Otimizações:</span>
                                        <div className="flex flex-wrap gap-1">
                                            {grupo.datas.slice(0, 10).map((data, i) => (
                                                <span key={i} className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 whitespace-nowrap">
                                                    {moment(data).format('DD/MM')}
                                                </span>
                                            ))}
                                            {grupo.datas.length > 10 && (
                                                <span className="text-slate-400">+{grupo.datas.length - 10}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Last satisfaction summary */}
                                    {grupo.avaliacoes.find(a => a.resumo_satisfacao && a.status === 'concluida') && (
                                        <p className="text-sm text-slate-600 mt-2 line-clamp-1">
                                            {grupo.avaliacoes.find(a => a.resumo_satisfacao && a.status === 'concluida').resumo_satisfacao}
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-col items-end gap-2 shrink-0">
                                    {grupo.scoreCount > 0 && (
                                        <div className="text-right">
                                            <p className={cn("text-2xl font-bold", getScoreColor(grupo.avgScore))}>
                                                {grupo.avgScore}
                                            </p>
                                            <p className="text-[10px] text-slate-400">Eficácia média</p>
                                        </div>
                                    )}
                                    <ChevronRight className="w-5 h-5 text-slate-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {filteredGrupos.length === 0 && (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500">
                                {isLoading ? 'Carregando...' : 'Nenhuma avaliação de eficácia encontrada no período selecionado'}
                            </p>
                            <p className="text-xs text-slate-400 mt-2">
                                As avaliações são criadas automaticamente quando uma otimização é registrada e processadas após 3 dias.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Drawer */}
            <EficaciaDetalheDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                avaliacao={selectedGrupo?.avaliacoes[0]}
                grupoAvaliacoes={selectedGrupo}
            />
        </div>
    );
}