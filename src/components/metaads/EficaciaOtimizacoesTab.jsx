import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, TrendingUp, TrendingDown, Minus, MessageSquare, BarChart3, Target, Smile, Activity, Clock } from 'lucide-react';
import EficaciaDetalheDrawer from '@/components/metaads/EficaciaDetalheDrawer';
import { cn } from '@/lib/utils';
import moment from 'moment-timezone';

export default function EficaciaOtimizacoesTab() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filtroEficacia, setFiltroEficacia] = useState('all');
    const [filtroSentimento, setFiltroSentimento] = useState('all');
    const [selectedAvaliacao, setSelectedAvaliacao] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const { data: avaliacoes = [], isLoading } = useQuery({
        queryKey: ['avaliacoesEficacia'],
        queryFn: () => base44.entities.AvaliacaoEficaciaOtimizacao.list('-data_otimizacao', 500),
        staleTime: 60 * 1000
    });

    const concluidas = avaliacoes.filter(a => a.status === 'concluida');
    const pendentes = avaliacoes.filter(a => a.status === 'pendente');

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

    const filteredAvaliacoes = useMemo(() => {
        return avaliacoes.filter(a => {
            const matchesSearch = a.account_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                a.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesEficacia = filtroEficacia === 'all' || a.eficacia_tecnica === filtroEficacia;
            const matchesSentimento = filtroSentimento === 'all' || a.sentimento_cliente === filtroSentimento;
            return matchesSearch && matchesEficacia && matchesSentimento;
        });
    }, [avaliacoes, searchTerm, filtroEficacia, filtroSentimento]);

    const getEficaciaBadge = (eficacia) => {
        const config = {
            'melhorou': { label: 'Melhorou', className: 'bg-green-500 text-white', icon: TrendingUp },
            'estavel': { label: 'Estável', className: 'bg-yellow-500 text-white', icon: Minus },
            'piorou': { label: 'Piorou', className: 'bg-red-500 text-white', icon: TrendingDown }
        };
        return config[eficacia] || { label: '—', className: 'bg-slate-400 text-white', icon: Minus };
    };

    const getSentimentoBadge = (sentimento) => {
        const config = {
            'positivo': { label: 'Positivo', className: 'bg-green-100 text-green-700 border-green-200' },
            'neutro': { label: 'Neutro', className: 'bg-slate-100 text-slate-700 border-slate-200' },
            'negativo': { label: 'Negativo', className: 'bg-red-100 text-red-700 border-red-200' }
        };
        return config[sentimento] || { label: '—', className: 'bg-slate-100 text-slate-500' };
    };

    const getScoreColor = (score) => {
        if (score >= 65) return 'text-green-600';
        if (score >= 40) return 'text-yellow-600';
        return 'text-red-600';
    };

    const handleOpenDrawer = (avaliacao) => {
        setSelectedAvaliacao(avaliacao);
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
            {/* KPIs Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <BarChart3 className="w-4 h-4 text-violet-600" />
                            <span className="text-xs text-slate-500">Avaliações Concluídas</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-900">{concluidas.length}</p>
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

            {/* Filtros */}
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

            {/* Lista de Avaliações */}
            <div className="space-y-3">
                {filteredAvaliacoes.map((aval) => {
                    const eficaciaConfig = getEficaciaBadge(aval.eficacia_tecnica);
                    const sentimentoConfig = getSentimentoBadge(aval.sentimento_cliente);
                    const EficaciaIcon = eficaciaConfig.icon;

                    return (
                        <Card
                            key={aval.id}
                            className="hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => handleOpenDrawer(aval)}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="font-semibold text-slate-900 truncate">
                                                {aval.account_name}
                                            </h3>
                                            {aval.status === 'pendente' && (
                                                <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                                                    <Clock className="w-3 h-3 mr-1" />
                                                    Em análise
                                                </Badge>
                                            )}
                                            {aval.status === 'erro' && (
                                                <Badge variant="outline" className="text-red-600 border-red-300">
                                                    Erro
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                            <span>Otimização: {moment(aval.data_otimizacao).format('DD/MM/YYYY')}</span>
                                            {aval.data_avaliacao && (
                                                <span>Análise: {moment(aval.data_avaliacao).format('DD/MM/YYYY')}</span>
                                            )}
                                            {aval.total_mensagens_whatsapp > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <MessageSquare className="w-3 h-3" />
                                                    {aval.total_mensagens_whatsapp} msgs
                                                </span>
                                            )}
                                        </div>
                                        {aval.resumo_satisfacao && aval.status === 'concluida' && (
                                            <p className="text-sm text-slate-600 mt-2 line-clamp-1">
                                                {aval.resumo_satisfacao}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                        {aval.status === 'concluida' && (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <Badge className={eficaciaConfig.className}>
                                                        <EficaciaIcon className="w-3 h-3 mr-1" />
                                                        {eficaciaConfig.label}
                                                    </Badge>
                                                    <div className="text-right">
                                                        <p className={cn("text-lg font-bold", getScoreColor(aval.score_eficacia))}>
                                                            {aval.score_eficacia}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400">Eficácia</p>
                                                    </div>
                                                </div>
                                                {aval.sentimento_cliente && (
                                                    <Badge variant="outline" className={sentimentoConfig.className}>
                                                        {sentimentoConfig.label} ({aval.score_satisfacao})
                                                    </Badge>
                                                )}
                                            </>
                                        )}
                                        {aval.status === 'pendente' && (
                                            <div className="text-right">
                                                <p className="text-sm text-slate-400">Aguardando T+3</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Mini comparativo T0 vs T3 */}
                                {aval.status === 'concluida' && aval.snapshot_t0 && aval.snapshot_t3 && (
                                    <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100">
                                        <MiniKpi label="CPL" t0={aval.snapshot_t0.cpl_7d} t3={aval.snapshot_t3.cpl_7d} delta={aval.delta_cpl} invertColor />
                                        <MiniKpi label="Leads 7d" t0={aval.snapshot_t0.leads_7d} t3={aval.snapshot_t3.leads_7d} delta={aval.delta_leads} />
                                        <MiniKpi label="CTR" t0={aval.snapshot_t0.ctr_7d} t3={aval.snapshot_t3.ctr_7d} delta={aval.delta_ctr} suffix="%" />
                                        <MiniKpi label="Freq" t0={aval.snapshot_t0.frequencia_7d} t3={aval.snapshot_t3.frequencia_7d} delta={aval.delta_frequencia} invertColor />
                                        <MiniKpi label="Nota" t0={aval.snapshot_t0.nota_gpt} t3={aval.snapshot_t3.nota_gpt} delta={aval.delta_nota_gpt} absolute />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}

                {filteredAvaliacoes.length === 0 && (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500">
                                {isLoading ? 'Carregando...' : 'Nenhuma avaliação de eficácia encontrada'}
                            </p>
                            <p className="text-xs text-slate-400 mt-2">
                                As avaliações são criadas automaticamente quando uma otimização é registrada e processadas após 3 dias.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Drawer de Detalhes */}
            <EficaciaDetalheDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                avaliacao={selectedAvaliacao}
            />
        </div>
    );
}

function MiniKpi({ label, t0, t3, delta, invertColor, suffix, absolute }) {
    const isPositive = invertColor ? delta < 0 : delta > 0;
    const isNeutral = Math.abs(delta) < 0.1;
    const colorClass = isNeutral ? 'text-slate-400' : isPositive ? 'text-green-600' : 'text-red-600';
    const deltaIcon = isNeutral ? '→' : isPositive ? '↑' : '↓';
    const deltaText = absolute
        ? `${delta > 0 ? '+' : ''}${delta.toFixed(0)}`
        : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;

    return (
        <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
            <div className="flex items-baseline gap-1.5">
                <span className="text-xs text-slate-400 line-through">
                    {typeof t0 === 'number' ? t0.toFixed(suffix === '%' ? 1 : 0) : '—'}{suffix}
                </span>
                <span className="text-xs font-medium text-slate-700">
                    {typeof t3 === 'number' ? t3.toFixed(suffix === '%' ? 1 : 0) : '—'}{suffix}
                </span>
                <span className={cn("text-xs font-semibold", colorClass)}>
                    {deltaIcon} {deltaText}
                </span>
            </div>
        </div>
    );
}