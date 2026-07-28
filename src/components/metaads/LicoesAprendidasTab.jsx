import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lightbulb, TrendingUp, AlertTriangle, CheckCircle, Sparkles, RefreshCw, Brain, Target, Award, Wrench } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import moment from 'moment-timezone';

const TZ = 'America/Sao_Paulo';

export default function LicoesAprendidasTab() {
    const [analise, setAnalise] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filtroPeriodo, setFiltroPeriodo] = useState('90d');

    const { data: otimizacoes = [] } = useQuery({
        queryKey: ['metaAdsOtimizacoesLicoes'],
        queryFn: async () => {
            const batch = await base44.entities.MetaAdsOtimizacao.list('-data_acao', 1000, 0);
            return batch;
        },
        staleTime: 5 * 60 * 1000
    });

    const { data: avaliacoes = [] } = useQuery({
        queryKey: ['avaliacoesEficaciaLicoes'],
        queryFn: () => base44.entities.AvaliacaoEficaciaOtimizacao.list('-data_otimizacao', 500),
        staleTime: 5 * 60 * 1000
    });

    // Join otimizacoes with avaliacoes by otimizacao_id
    const dadosCombinados = useMemo(() => {
        const avaliacaoMap = new Map();
        avaliacoes.forEach(a => {
            if (a.otimizacao_id) avaliacaoMap.set(a.otimizacao_id, a);
        });
        return otimizacoes.map(o => ({
            ...o,
            avaliacao: avaliacaoMap.get(o.id) || null,
        }));
    }, [otimizacoes, avaliacoes]);

    // Filter by period
    const periodoDias = { '30d': 30, '90d': 90, '180d': 180, 'all': 9999 };
    const dadosPeriodo = useMemo(() => {
        const corte = moment().tz(TZ).subtract(periodoDias[filtroPeriodo] || 90, 'days');
        return dadosCombinados.filter(d => {
            if (!d.data_acao) return false;
            return moment(d.data_acao).isAfter(corte);
        });
    }, [dadosCombinados, filtroPeriodo]);

    // Client-side stats (always available)
    const stats = useMemo(() => {
        const comEficacia = dadosPeriodo.filter(d => d.avaliacao && d.avaliacao.status === 'concluida');
        const melhorou = comEficacia.filter(d => d.avaliacao.eficacia_tecnica === 'melhorou').length;
        const estavel = comEficacia.filter(d => d.avaliacao.eficacia_tecnica === 'estavel').length;
        const piorou = comEficacia.filter(d => d.avaliacao.eficacia_tecnica === 'piorou').length;
        const avgScore = comEficacia.length > 0
            ? comEficacia.reduce((s, d) => s + (d.avaliacao.score_eficacia || 0), 0) / comEficacia.length
            : 0;
        return {
            total: dadosPeriodo.length,
            comEficacia: comEficacia.length,
            melhorou,
            estavel,
            piorou,
            avgScore: Math.round(avgScore),
            taxaSucesso: comEficacia.length > 0 ? (melhorou / comEficacia.length) * 100 : 0,
        };
    }, [dadosPeriodo]);

    const gerarAnalise = async () => {
        setLoading(true);
        setError(null);
        try {
            const comEficacia = dadosPeriodo.filter(d => d.avaliacao && d.avaliacao.status === 'concluida');
            const dadosParaLLM = dadosPeriodo.slice(0, 120).map(d => ({
                problema: (d.problema || '').substring(0, 150),
                objetivo: (d.objetivo || '').substring(0, 150),
                acoes: (d.acoes_implementadas || '').substring(0, 200),
                eficacia: d.avaliacao?.eficacia_tecnica || 'sem_avaliacao',
                score: d.avaliacao?.score_eficacao ?? null,
            }));

            const prompt = `Você é um analista de marketing digital especializado em Meta Ads. Analise o histórico de otimizações e suas eficácias para identificar padrões, problemas frequentes e lições aprendidas.

=== RESUMO GERAL ===
Total de otimizações no período: ${dadosPeriodo.length}
Otimizações com avaliação de eficácia concluída: ${comEficacia.length}
Melhoraram: ${stats.melhorou} | Estáveis: ${stats.estavel} | Pioraram: ${stats.piorou}
Taxa de sucesso geral: ${stats.taxaSucesso.toFixed(1)}%
Score médio de eficácia: ${stats.avgScore}/100

=== DADOS DAS OTIMIZAÇÕES ===
${dadosParaLLM.map((d, i) => `
[${i + 1}]
Problema: ${d.problema}
Objetivo: ${d.objetivo}
Ações: ${d.acoes}
Eficácia: ${d.eficacia}${d.score !== null ? ` (Score: ${d.score})` : ''}
`).join('\n')}

Analise os dados e forneça:

1. problemas_frequentes: Liste os 5-8 problemas mais frequentes identificados nas otimizações. Para cada problema, forneça: problema (nome da categoria do problema), frequencia (número aproximado de ocorrências), taxa_sucesso (porcentagem de casos que resultaram em "melhorou"), e acoes_recomendadas (quais ações costumam resolver este problema com mais eficácia).

2. acoes_eficazes: Liste as 5-8 ações/táticas mais eficazes identificadas. Para cada ação, forneça: acao (descrição da ação), frequencia (número aproximado), taxa_sucesso (porcentagem de "melhorou"), e problemas_relacionados (quais problemas esta ação resolve melhor).

3. insights_gerais: Análise detalhada de padrões, tendências e correlações entre problemas e ações. Quais combinações problema→ação funcionam melhor? Quais não funcionam?

4. recomendacoes: 3-5 recomendações práticas para a equipe de tráfego baseadas nas lições aprendidas.

Formate sua resposta em JSON com esta estrutura:
{
  "problemas_frequentes": [
    { "problema": "...", "frequencia": 0, "taxa_sucesso": 0, "acoes_recomendadas": "..." }
  ],
  "acoes_eficazes": [
    { "acao": "...", "frequencia": 0, "taxa_sucesso": 0, "problemas_relacionados": "..." }
  ],
  "insights_gerais": "texto...",
  "recomendacoes": "texto..."
}`;

            const response = await base44.integrations.Core.InvokeLLM({
                prompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        problemas_frequentes: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    problema: { type: "string" },
                                    frequencia: { type: "number" },
                                    taxa_sucesso: { type: "number" },
                                    acoes_recomendadas: { type: "string" }
                                }
                            }
                        },
                        acoes_eficazes: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    acao: { type: "string" },
                                    frequencia: { type: "number" },
                                    taxa_sucesso: { type: "number" },
                                    problemas_relacionados: { type: "string" }
                                }
                            }
                        },
                        insights_gerais: { type: "string" },
                        recomendacoes: { type: "string" }
                    }
                }
            });

            setAnalise(response);
        } catch (e) {
            setError(e.message || 'Erro ao gerar análise');
        } finally {
            setLoading(false);
        }
    };

    // Auto-generate when data is first available
    useEffect(() => {
        if (dadosPeriodo.length > 0 && !analise && !loading && !error) {
            gerarAnalise();
        }
    }, [dadosPeriodo.length]);

    const periodoLabel = { '30d': '30 dias', '90d': '90 dias', '180d': '180 dias', 'all': 'Todo o período' };

    return (
        <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Target className="w-4 h-4 text-violet-600" />
                            <span className="text-xs text-slate-500">Total de Otimizações</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-xs text-slate-500">Com Eficácia Avaliada</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-900">{stats.comEficacia}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            <span className="text-xs text-slate-500">Taxa de Sucesso</span>
                        </div>
                        <p className={cn("text-2xl font-bold", stats.taxaSucesso >= 50 ? 'text-green-600' : stats.taxaSucesso >= 30 ? 'text-yellow-600' : 'text-red-600')}>
                            {stats.taxaSucesso.toFixed(0)}%
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Award className="w-4 h-4 text-violet-600" />
                            <span className="text-xs text-slate-500">Eficácia Média</span>
                        </div>
                        <p className={cn("text-2xl font-bold", stats.avgScore >= 65 ? 'text-green-600' : stats.avgScore >= 40 ? 'text-yellow-600' : 'text-red-600')}>
                            {stats.avgScore}<span className="text-sm text-slate-400">/100</span>
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <span className="text-xs text-slate-500">Pioraram</span>
                        </div>
                        <p className="text-2xl font-bold text-red-600">{stats.piorou}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Header + period filter + regenerate */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-violet-600" />
                    <h3 className="text-lg font-bold text-slate-900">Análise de Padrões (IA)</h3>
                    {analise && (
                        <Badge variant="outline" className="text-xs">
                            Período: {periodoLabel[filtroPeriodo]}
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        {[
                            { value: '30d', label: '30d' },
                            { value: '90d', label: '90d' },
                            { value: '180d', label: '180d' },
                            { value: 'all', label: 'Tudo' }
                        ].map(opt => (
                            <Button
                                key={opt.value}
                                variant={filtroPeriodo === opt.value ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                    setFiltroPeriodo(opt.value);
                                    setAnalise(null);
                                }}
                                className={filtroPeriodo === opt.value ? 'bg-violet-600' : ''}
                            >
                                {opt.label}
                            </Button>
                        ))}
                    </div>
                    <Button
                        onClick={gerarAnalise}
                        disabled={loading || stats.total === 0}
                        variant="outline"
                        size="sm"
                    >
                        {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                        Regenerar
                    </Button>
                </div>
            </div>

            {stats.total === 0 && (
                <Card>
                    <CardContent className="p-12 text-center">
                        <Lightbulb className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">Nenhuma otimização encontrada no período selecionado</p>
                    </CardContent>
                </Card>
            )}

            {/* Loading */}
            {loading && (
                <Card>
                    <CardContent className="p-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-4" />
                        <p className="text-slate-600 font-medium">Analisando padrões com IA...</p>
                        <p className="text-xs text-slate-400 mt-1">Processando {stats.total} otimizações para identificar problemas frequentes e ações eficazes</p>
                    </CardContent>
                </Card>
            )}

            {error && !loading && (
                <Card>
                    <CardContent className="p-6 text-center">
                        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                        <p className="text-red-600 font-medium">Erro ao gerar análise</p>
                        <p className="text-xs text-slate-500 mt-1">{error}</p>
                        <Button onClick={gerarAnalise} variant="outline" size="sm" className="mt-3">
                            <RefreshCw className="w-4 h-4 mr-1" /> Tentar novamente
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Results */}
            {analise && !loading && (
                <>
                    {/* Problems frequent */}
                    {analise.problemas_frequentes && analise.problemas_frequentes.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                                    Problemas Mais Frequentes
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-4 h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={analise.problemas_frequentes.map(p => ({
                                                name: p.problema.substring(0, 20),
                                                frequencia: p.frequencia,
                                                taxa_sucesso: p.taxa_sucesso,
                                            }))}
                                            layout="vertical"
                                            margin={{ left: 80, right: 10, top: 0, bottom: 0 }}
                                        >
                                            <XAxis type="number" tick={{ fontSize: 10 }} />
                                            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={80} />
                                            <Tooltip
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const d = payload[0].payload;
                                                        return (
                                                            <div className="bg-white p-2 border border-slate-200 rounded shadow-lg text-xs">
                                                                <p className="font-semibold">{d.name}</p>
                                                                <p>Frequência: {d.frequencia}</p>
                                                                <p>Taxa de sucesso: {d.taxa_sucesso}%</p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar dataKey="frequencia" radius={[0, 4, 4, 0]}>
                                                {analise.problemas_frequentes.map((p, i) => (
                                                    <Cell key={i} fill={p.taxa_sucesso >= 50 ? '#22C55E' : p.taxa_sucesso >= 30 ? '#EAB308' : '#DC2626'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="space-y-3">
                                    {analise.problemas_frequentes.map((p, i) => (
                                        <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <h4 className="font-medium text-slate-800 text-sm">{p.problema}</h4>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Badge variant="outline" className="text-xs">{p.frequencia}x</Badge>
                                                    <Badge className={cn(
                                                        "text-xs",
                                                        p.taxa_sucesso >= 50 ? 'bg-green-500 text-white' :
                                                        p.taxa_sucesso >= 30 ? 'bg-yellow-500 text-white' :
                                                        'bg-red-500 text-white'
                                                    )}>
                                                        {p.taxa_sucesso}% sucesso
                                                    </Badge>
                                                </div>
                                            </div>
                                            {p.acoes_recomendadas && (
                                                <p className="text-xs text-slate-600 mt-1">
                                                    <span className="font-medium">Ações recomendadas:</span> {p.acoes_recomendadas}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Effective actions */}
                    {analise.acoes_eficazes && analise.acoes_eficazes.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Wrench className="w-4 h-4 text-green-600" />
                                    Ações Mais Eficazes
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-4 h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={analise.acoes_eficazes.map(a => ({
                                                name: a.acao.substring(0, 20),
                                                frequencia: a.frequencia,
                                                taxa_sucesso: a.taxa_sucesso,
                                            }))}
                                            layout="vertical"
                                            margin={{ left: 80, right: 10, top: 0, bottom: 0 }}
                                        >
                                            <XAxis type="number" tick={{ fontSize: 10 }} />
                                            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={80} />
                                            <Tooltip
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const d = payload[0].payload;
                                                        return (
                                                            <div className="bg-white p-2 border border-slate-200 rounded shadow-lg text-xs">
                                                                <p className="font-semibold">{d.name}</p>
                                                                <p>Frequência: {d.frequencia}</p>
                                                                <p>Taxa de sucesso: {d.taxa_sucesso}%</p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar dataKey="frequencia" radius={[0, 4, 4, 0]}>
                                                {analise.acoes_eficazes.map((a, i) => (
                                                    <Cell key={i} fill={a.taxa_sucesso >= 50 ? '#22C55E' : a.taxa_sucesso >= 30 ? '#EAB308' : '#DC2626'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="space-y-3">
                                    {analise.acoes_eficazes.map((a, i) => (
                                        <div key={i} className="p-3 bg-green-50 rounded-lg border border-green-100">
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <h4 className="font-medium text-slate-800 text-sm">{a.acao}</h4>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Badge variant="outline" className="text-xs">{a.frequencia}x</Badge>
                                                    <Badge className={cn(
                                                        "text-xs",
                                                        a.taxa_sucesso >= 50 ? 'bg-green-500 text-white' :
                                                        a.taxa_sucesso >= 30 ? 'bg-yellow-500 text-white' :
                                                        'bg-red-500 text-white'
                                                    )}>
                                                        {a.taxa_sucesso}% sucesso
                                                    </Badge>
                                                </div>
                                            </div>
                                            {a.problemas_relacionados && (
                                                <p className="text-xs text-slate-600 mt-1">
                                                    <span className="font-medium">Resolve:</span> {a.problemas_relacionados}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Insights */}
                    {analise.insights_gerais && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-violet-600" />
                                    Insights e Padrões Identificados
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                                    {analise.insights_gerais}
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Recommendations */}
                    {analise.recomendacoes && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                                    Recomendações para a Equipe
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                                    {analise.recomendacoes}
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}