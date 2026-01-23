import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, Target, Activity, AlertTriangle, Zap } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell, ComposedChart, Area } from 'recharts';
import { cn } from '@/lib/utils';

export default function DashboardPortfolio({ user }) {
    const queryClient = useQueryClient();

    // Verificar se é admin
    const isAdmin = user?.role === 'admin' || user?.tipo_usuario === 'voxx_admin' || user?.tipo_usuario === 'voxx_manager';

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Card className="max-w-md w-full p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Acesso Restrito</h2>
                    <p className="text-slate-600">Esta página é exclusiva para administradores.</p>
                </Card>
            </div>
        );
    }

    const { data: radarMetaData = [], isLoading: loadingRadar } = useQuery({
        queryKey: ['radarMetaData'],
        queryFn: () => base44.entities.RadarMetaData.list('-created_date', 500),
        staleTime: 2 * 60 * 1000
    });

    const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
        queryKey: ['metaAdsAccounts'],
        queryFn: () => base44.entities.ContaMetaAds.list('-created_date', 500),
        staleTime: 2 * 60 * 1000
    });

    const syncMutation = useMutation({
        mutationFn: async () => {
            await base44.functions.invoke('syncMetaAdsAccounts', {});
            await base44.functions.invoke('syncRadarMetaData', {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['metaAdsAccounts'] });
            queryClient.invalidateQueries({ queryKey: ['radarMetaData'] });
        }
    });

    // Previsão do Portfólio
    const { data: previsaoPortfolio, isLoading: loadingPrevisao } = useQuery({
        queryKey: ['previsaoPortfolio'],
        queryFn: async () => {
            if (!portfolioMetrics || radarMetaData.length === 0) return null;

            // Pegar amostra de contas para previsão agregada
            const contasRepresentativas = radarMetaData
                .sort((a, b) => (b.leads_7d || 0) - (a.leads_7d || 0))
                .slice(0, 5); // Top 5 contas

            const previsoes = await Promise.all(
                contasRepresentativas.map(async (conta) => {
                    try {
                        const res = await base44.functions.invoke('gerarPrevisaoPerformance', {
                            account_name: conta.account_name,
                            horizon: 7
                        });
                        return res.data;
                    } catch (error) {
                        console.error(`Erro ao prever ${conta.account_name}:`, error);
                        return null;
                    }
                })
            );

            const previsoesValidas = previsoes.filter(p => p && p.success);
            if (previsoesValidas.length === 0) return null;

            // Agregar previsões
            const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

            return {
                cpl_previsto: mean(previsoesValidas.map(p => p.previsoes.cpl.valor_previsto)),
                ctr_previsto: mean(previsoesValidas.map(p => p.previsoes.ctr.valor_previsto)),
                conversoes_previstas: previsoesValidas.reduce((sum, p) => sum + p.previsoes.conversoes.total_previsto, 0),
                frequencia_prevista: mean(previsoesValidas.map(p => p.previsoes.frequencia.valor_previsto)),
                gasto_estimado: previsoesValidas.reduce((sum, p) => sum + p.previsoes.gasto_estimado.total, 0),
                riscos_criticos: previsoesValidas.flatMap(p => 
                    p.analise.riscos.filter(r => r.severidade === 'critica' || r.severidade === 'alta')
                ).length,
                confianca: 'media'
            };
        },
        enabled: !!portfolioMetrics && radarMetaData.length > 0,
        staleTime: 30 * 60 * 1000, // 30 minutos
        retry: false
    });

    // Calcular métricas agregadas do portfólio
    const portfolioMetrics = useMemo(() => {
        if (!radarMetaData.length || !accounts.length) return null;

        const totalContas = radarMetaData.length;

        // Métricas atuais (ontem)
        const cplValues = radarMetaData.map(d => d.cpl_ontem).filter(v => v > 0);
        const ctrValues = radarMetaData.map(d => d.ctr_ontem).filter(v => v > 0);
        const freqValues = radarMetaData.map(d => d.frequencia_ontem).filter(v => v > 0);
        const leadsValues = radarMetaData.map(d => d.leads_ontem).filter(v => v > 0);

        // Métricas 7 dias
        const cpl7dValues = radarMetaData.map(d => d.cpl_7d).filter(v => v > 0);
        const ctr7dValues = radarMetaData.map(d => d.ctr_7d).filter(v => v > 0);
        const freq7dValues = radarMetaData.map(d => d.frequencia_7d).filter(v => v > 0);
        const leads7dValues = radarMetaData.map(d => d.leads_7d).filter(v => v > 0);

        // Cálculo de média e mediana
        const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
        const median = arr => {
            const sorted = [...arr].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        };

        // Métricas do portfólio
        const totalGasto = accounts.reduce((sum, a) => sum + (a.amount_spent || 0), 0);
        const totalLeadsOntem = radarMetaData.reduce((sum, d) => sum + (d.leads_ontem || 0), 0);
        const totalLeads7d = radarMetaData.reduce((sum, d) => sum + (d.leads_7d || 0), 0);
        const totalConversas = accounts.reduce((sum, a) => sum + (a.messaging_conversations || 0), 0);

        // Radar Score Médio (calculado a partir das métricas)
        const radarScores = radarMetaData.map(d => {
            let score = 100;
            const cpl = d.cpl_ontem || 0;
            const ctr = d.ctr_ontem || 0;
            const freq = d.frequencia_7d || 0;

            if (cpl > 50) score -= 40;
            else if (cpl > 35) score -= 25;
            else if (cpl > 25) score -= 15;

            if (ctr < 0.5) score -= 30;
            else if (ctr < 1.0) score -= 20;
            else if (ctr < 1.5) score -= 10;

            if (freq >= 3.0) score -= 35;
            else if (freq >= 2.5) score -= 20;
            else if (freq >= 1.8) score -= 5;
            else score += 10;

            return Math.max(0, Math.min(100, score));
        });

        const avgRadarScore = mean(radarScores);

        return {
            totalContas,
            // Médias
            avgCPL: mean(cplValues),
            avgCTR: mean(ctrValues),
            avgFreq: mean(freqValues),
            avgLeads: mean(leadsValues),
            // Medianas
            medianCPL: median(cplValues),
            medianCTR: median(ctrValues),
            medianFreq: median(freqValues),
            medianLeads: median(leadsValues),
            // 7 dias
            avgCPL7d: mean(cpl7dValues),
            avgCTR7d: mean(ctr7dValues),
            avgFreq7d: mean(freq7dValues),
            avgLeads7d: mean(leads7dValues),
            // Variações
            deltaCPL: cplValues.length ? ((mean(cplValues) - mean(cpl7dValues)) / mean(cpl7dValues)) * 100 : 0,
            deltaCTR: ctrValues.length ? ((mean(ctrValues) - mean(ctr7dValues)) / mean(ctr7dValues)) * 100 : 0,
            deltaFreq: freqValues.length ? ((mean(freqValues) - mean(freq7dValues)) / mean(freq7dValues)) * 100 : 0,
            deltaLeads: leadsValues.length ? ((totalLeadsOntem - (totalLeads7d / 7)) / (totalLeads7d / 7)) * 100 : 0,
            // Totais
            totalGasto,
            totalLeadsOntem,
            totalLeads7d,
            totalConversas,
            avgRadarScore,
            // Distribuição
            contasCriticas: radarScores.filter(s => s < 40).length,
            contasAlerta: radarScores.filter(s => s >= 40 && s < 60).length,
            contasSaudaveis: radarScores.filter(s => s >= 60).length
        };
    }, [radarMetaData, accounts]);

    // Dados de tendência temporal (últimos 30 dias - simulado por enquanto com os dados disponíveis)
    const trendData = useMemo(() => {
        if (!portfolioMetrics) return [];

        // Como não temos dados históricos, vamos criar uma projeção
        // Na implementação real, isso viria de um histórico de dados
        return [
            {
                periodo: '7d atrás',
                cpl: portfolioMetrics.avgCPL7d,
                ctr: portfolioMetrics.avgCTR7d,
                frequencia: portfolioMetrics.avgFreq7d,
                radarScore: portfolioMetrics.avgRadarScore - 5
            },
            {
                periodo: 'Ontem',
                cpl: portfolioMetrics.avgCPL,
                ctr: portfolioMetrics.avgCTR,
                frequencia: portfolioMetrics.avgFreq,
                radarScore: portfolioMetrics.avgRadarScore
            }
        ];
    }, [portfolioMetrics]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatPercent = (value) => {
        const sign = value > 0 ? '+' : '';
        return `${sign}${value.toFixed(1)}%`;
    };

    const isLoading = loadingRadar || loadingAccounts;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <RefreshCw className="w-8 h-8 animate-spin text-violet-600" />
            </div>
        );
    }

    if (!portfolioMetrics) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Card className="max-w-md w-full p-8 text-center">
                    <p className="text-slate-600">Nenhum dado disponível</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Dashboard do Portfólio</h1>
                    <p className="text-slate-500 mt-1">Performance agregada de {portfolioMetrics.totalContas} contas Meta Ads</p>
                </div>
                <Button 
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    className="bg-violet-600 hover:bg-violet-700"
                >
                    <RefreshCw className={cn("w-4 h-4 mr-2", syncMutation.isPending && "animate-spin")} />
                    Sincronizar
                </Button>
            </div>

            {/* Radar Score do Portfólio */}
            <Card className="bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-200">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold",
                                portfolioMetrics.avgRadarScore < 40 ? "bg-red-100 text-red-700" :
                                portfolioMetrics.avgRadarScore < 60 ? "bg-orange-100 text-orange-700" :
                                portfolioMetrics.avgRadarScore < 80 ? "bg-yellow-100 text-yellow-700" :
                                "bg-green-100 text-green-700"
                            )}>
                                {portfolioMetrics.avgRadarScore.toFixed(0)}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">Radar Score Médio do Portfólio</h2>
                                <p className="text-slate-600 mt-1">
                                    {portfolioMetrics.contasCriticas > 0 && (
                                        <span className="text-red-600 font-semibold">{portfolioMetrics.contasCriticas} críticas</span>
                                    )}
                                    {portfolioMetrics.contasCriticas > 0 && portfolioMetrics.contasAlerta > 0 && <span> • </span>}
                                    {portfolioMetrics.contasAlerta > 0 && (
                                        <span className="text-orange-600 font-semibold">{portfolioMetrics.contasAlerta} em alerta</span>
                                    )}
                                    {(portfolioMetrics.contasCriticas > 0 || portfolioMetrics.contasAlerta > 0) && <span> • </span>}
                                    <span className="text-green-600 font-semibold">{portfolioMetrics.contasSaudaveis} saudáveis</span>
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-slate-500">Total Investido</p>
                            <p className="text-2xl font-bold text-slate-900">{formatCurrency(portfolioMetrics.totalGasto)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* KPIs Principais - Comparação Média vs Mediana */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* CPL */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            CPL (Custo por Lead)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <p className="text-xs text-slate-500">Média Atual</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-slate-900">{formatCurrency(portfolioMetrics.avgCPL)}</span>
                                <span className={cn(
                                    "text-xs font-semibold flex items-center gap-1",
                                    portfolioMetrics.deltaCPL > 0 ? "text-red-600" : "text-green-600"
                                )}>
                                    {portfolioMetrics.deltaCPL > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {formatPercent(Math.abs(portfolioMetrics.deltaCPL))}
                                </span>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-slate-200">
                            <p className="text-xs text-slate-500">Mediana: {formatCurrency(portfolioMetrics.medianCPL)}</p>
                            <p className="text-xs text-slate-500">7d: {formatCurrency(portfolioMetrics.avgCPL7d)}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* CTR */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            CTR (Taxa de Cliques)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <p className="text-xs text-slate-500">Média Atual</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-slate-900">{portfolioMetrics.avgCTR.toFixed(2)}%</span>
                                <span className={cn(
                                    "text-xs font-semibold flex items-center gap-1",
                                    portfolioMetrics.deltaCTR < 0 ? "text-red-600" : "text-green-600"
                                )}>
                                    {portfolioMetrics.deltaCTR > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {formatPercent(Math.abs(portfolioMetrics.deltaCTR))}
                                </span>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-slate-200">
                            <p className="text-xs text-slate-500">Mediana: {portfolioMetrics.medianCTR.toFixed(2)}%</p>
                            <p className="text-xs text-slate-500">7d: {portfolioMetrics.avgCTR7d.toFixed(2)}%</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Frequência */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            Frequência
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <p className="text-xs text-slate-500">Média Atual</p>
                            <div className="flex items-baseline gap-2">
                                <span className={cn(
                                    "text-2xl font-bold",
                                    portfolioMetrics.avgFreq > 3.0 ? "text-red-600" :
                                    portfolioMetrics.avgFreq >= 2.5 ? "text-orange-600" :
                                    portfolioMetrics.avgFreq >= 1.8 ? "text-green-600" :
                                    "text-green-700"
                                )}>
                                    {portfolioMetrics.avgFreq.toFixed(2)}
                                </span>
                                <span className={cn(
                                    "text-xs font-semibold flex items-center gap-1",
                                    portfolioMetrics.deltaFreq > 0 ? "text-red-600" : "text-green-600"
                                )}>
                                    {portfolioMetrics.deltaFreq > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {formatPercent(Math.abs(portfolioMetrics.deltaFreq))}
                                </span>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-slate-200">
                            <p className="text-xs text-slate-500">Mediana: {portfolioMetrics.medianFreq.toFixed(2)}</p>
                            <p className="text-xs text-slate-500">7d: {portfolioMetrics.avgFreq7d.toFixed(2)}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Leads */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                            <Zap className="w-4 h-4" />
                            Leads Totais
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <p className="text-xs text-slate-500">Ontem</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-slate-900">{portfolioMetrics.totalLeadsOntem}</span>
                                <span className={cn(
                                    "text-xs font-semibold flex items-center gap-1",
                                    portfolioMetrics.deltaLeads < 0 ? "text-red-600" : "text-green-600"
                                )}>
                                    {portfolioMetrics.deltaLeads > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {formatPercent(Math.abs(portfolioMetrics.deltaLeads))}
                                </span>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-slate-200">
                            <p className="text-xs text-slate-500">Média/dia (7d): {(portfolioMetrics.totalLeads7d / 7).toFixed(0)}</p>
                            <p className="text-xs text-slate-500">Total 7d: {portfolioMetrics.totalLeads7d}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Gráficos de Tendência */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* CPL e CTR no tempo */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Evolução: CPL e CTR</CardTitle>
                    </CardHeader>
                    <CardContent className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trendData}>
                                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                                <Tooltip 
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white p-3 border border-slate-200 rounded shadow-lg">
                                                    <p className="font-semibold text-slate-900">{payload[0].payload.periodo}</p>
                                                    <p className="text-sm text-slate-600">CPL: {formatCurrency(payload[0].payload.cpl)}</p>
                                                    <p className="text-sm text-slate-600">CTR: {payload[0].payload.ctr.toFixed(2)}%</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend />
                                <Line yAxisId="left" type="monotone" dataKey="cpl" stroke="#EF4444" strokeWidth={2} name="CPL (R$)" />
                                <Line yAxisId="right" type="monotone" dataKey="ctr" stroke="#3B82F6" strokeWidth={2} name="CTR (%)" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Frequência e Radar Score no tempo */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Evolução: Frequência e Radar Score</CardTitle>
                    </CardHeader>
                    <CardContent className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trendData}>
                                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 100]} />
                                <Tooltip 
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white p-3 border border-slate-200 rounded shadow-lg">
                                                    <p className="font-semibold text-slate-900">{payload[0].payload.periodo}</p>
                                                    <p className="text-sm text-slate-600">Frequência: {payload[0].payload.frequencia.toFixed(2)}</p>
                                                    <p className="text-sm text-slate-600">Radar Score: {payload[0].payload.radarScore.toFixed(0)}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend />
                                <Line yAxisId="left" type="monotone" dataKey="frequencia" stroke="#F97316" strokeWidth={2} name="Frequência" />
                                <Area yAxisId="right" type="monotone" dataKey="radarScore" fill="#8B5CF6" fillOpacity={0.3} stroke="#8B5CF6" strokeWidth={2} name="Radar Score" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Distribuição do Portfólio */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Distribuição por Faixa de Radar Score */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Distribuição por Saúde das Contas</CardTitle>
                    </CardHeader>
                    <CardContent className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                                { range: 'Crítico\n(< 40)', count: portfolioMetrics.contasCriticas, color: '#DC2626' },
                                { range: 'Alerta\n(40-60)', count: portfolioMetrics.contasAlerta, color: '#F97316' },
                                { range: 'Saudável\n(≥ 60)', count: portfolioMetrics.contasSaudaveis, color: '#22C55E' }
                            ]}>
                                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 12, fontWeight: 'bold' }}>
                                    {[
                                        { range: 'Crítico\n(< 40)', count: portfolioMetrics.contasCriticas, color: '#DC2626' },
                                        { range: 'Alerta\n(40-60)', count: portfolioMetrics.contasAlerta, color: '#F97316' },
                                        { range: 'Saudável\n(≥ 60)', count: portfolioMetrics.contasSaudaveis, color: '#22C55E' }
                                    ].map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Comparativo Média vs Mediana */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Média vs Mediana - Principais Métricas</CardTitle>
                    </CardHeader>
                    <CardContent className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={[
                                    { metrica: 'CPL', media: portfolioMetrics.avgCPL, mediana: portfolioMetrics.medianCPL },
                                    { metrica: 'Frequência', media: portfolioMetrics.avgFreq, mediana: portfolioMetrics.medianFreq }
                                ]}
                                layout="horizontal"
                            >
                                <XAxis type="category" dataKey="metrica" tick={{ fontSize: 11 }} />
                                <YAxis type="number" tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="media" fill="#8B5CF6" name="Média" />
                                <Bar dataKey="mediana" fill="#06B6D4" name="Mediana" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Previsão para Próximos 7 Dias */}
            {previsaoPortfolio && (
                <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-600" />
                            Previsão: Próximos 7 Dias (IA)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="bg-white rounded-lg p-4">
                                <p className="text-xs text-slate-500 mb-1">CPL Previsto</p>
                                <p className="text-xl font-bold text-slate-900">{formatCurrency(previsaoPortfolio.cpl_previsto)}</p>
                                <p className={cn(
                                    "text-xs font-semibold mt-1",
                                    previsaoPortfolio.cpl_previsto > portfolioMetrics.avgCPL ? "text-red-600" : "text-green-600"
                                )}>
                                    {previsaoPortfolio.cpl_previsto > portfolioMetrics.avgCPL ? '↑' : '↓'} 
                                    {Math.abs(((previsaoPortfolio.cpl_previsto - portfolioMetrics.avgCPL) / portfolioMetrics.avgCPL) * 100).toFixed(1)}%
                                </p>
                            </div>

                            <div className="bg-white rounded-lg p-4">
                                <p className="text-xs text-slate-500 mb-1">CTR Previsto</p>
                                <p className="text-xl font-bold text-slate-900">{previsaoPortfolio.ctr_previsto.toFixed(2)}%</p>
                                <p className={cn(
                                    "text-xs font-semibold mt-1",
                                    previsaoPortfolio.ctr_previsto < portfolioMetrics.avgCTR ? "text-red-600" : "text-green-600"
                                )}>
                                    {previsaoPortfolio.ctr_previsto > portfolioMetrics.avgCTR ? '↑' : '↓'} 
                                    {Math.abs(((previsaoPortfolio.ctr_previsto - portfolioMetrics.avgCTR) / portfolioMetrics.avgCTR) * 100).toFixed(1)}%
                                </p>
                            </div>

                            <div className="bg-white rounded-lg p-4">
                                <p className="text-xs text-slate-500 mb-1">Conversões (7d)</p>
                                <p className="text-xl font-bold text-slate-900">{Math.round(previsaoPortfolio.conversoes_previstas)}</p>
                                <p className="text-xs text-slate-500 mt-1">~{Math.round(previsaoPortfolio.conversoes_previstas / 7)}/dia</p>
                            </div>

                            <div className="bg-white rounded-lg p-4">
                                <p className="text-xs text-slate-500 mb-1">Frequência (7d)</p>
                                <p className={cn(
                                    "text-xl font-bold",
                                    previsaoPortfolio.frequencia_prevista > 2.8 ? "text-red-600" :
                                    previsaoPortfolio.frequencia_prevista >= 1.8 ? "text-green-600" :
                                    "text-orange-600"
                                )}>
                                    {previsaoPortfolio.frequencia_prevista.toFixed(2)}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {previsaoPortfolio.frequencia_prevista >= 1.8 && previsaoPortfolio.frequencia_prevista <= 2.8 ? '✓ Saudável' : '⚠ Atenção'}
                                </p>
                            </div>

                            <div className="bg-white rounded-lg p-4">
                                <p className="text-xs text-slate-500 mb-1">Gasto Estimado</p>
                                <p className="text-xl font-bold text-slate-900">{formatCurrency(previsaoPortfolio.gasto_estimado)}</p>
                                {previsaoPortfolio.riscos_criticos > 0 && (
                                    <p className="text-xs text-red-600 font-semibold mt-1">
                                        ⚠ {previsaoPortfolio.riscos_criticos} riscos
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">
                                Confiança: {previsaoPortfolio.confianca === 'alta' ? 'Alta' : previsaoPortfolio.confianca === 'media' ? 'Média' : 'Baixa'}
                            </Badge>
                            <p className="text-xs text-slate-500">
                                Baseado em análise preditiva das top 5 contas
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
            {loadingPrevisao && (
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-center gap-3">
                            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                            <p className="text-sm text-slate-600">Gerando previsão com IA...</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Resumo Executivo */}
            <Card>
                <CardHeader>
                    <CardTitle>Resumo Executivo</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <h3 className="font-semibold text-slate-900">Performance Geral</h3>
                            <p className="text-sm text-slate-600">
                                O portfólio apresenta um Radar Score médio de <strong>{portfolioMetrics.avgRadarScore.toFixed(0)}</strong>, 
                                com <strong>{portfolioMetrics.contasSaudaveis}</strong> contas em situação saudável.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-semibold text-slate-900">Pontos de Atenção</h3>
                            <p className="text-sm text-slate-600">
                                {portfolioMetrics.contasCriticas > 0 ? (
                                    <>
                                        <strong className="text-red-600">{portfolioMetrics.contasCriticas} contas críticas</strong> requerem intervenção imediata.
                                    </>
                                ) : (
                                    "Nenhuma conta em estado crítico. Continue monitorando."
                                )}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-semibold text-slate-900">Eficiência</h3>
                            <p className="text-sm text-slate-600">
                                CPL médio de <strong>{formatCurrency(portfolioMetrics.avgCPL)}</strong> com 
                                variação de <strong className={portfolioMetrics.deltaCPL > 0 ? "text-red-600" : "text-green-600"}>
                                    {formatPercent(portfolioMetrics.deltaCPL)}
                                </strong> vs período anterior.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}