import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Minus, MessageSquare, Sparkles, Lightbulb, Target, Activity, Smile, Kanban, BarChart3, Radio, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import moment from 'moment-timezone';

export default function EficaciaDetalheDrawer({ open, onOpenChange, avaliacao, grupoAvaliacoes }) {
    const avaliacoes = grupoAvaliacoes?.avaliacoes || (avaliacao ? [avaliacao] : []);
    const [selectedId, setSelectedId] = useState(null);

    // Reset selection when grupo changes
    useEffect(() => {
        if (grupoAvaliacoes?.avaliacoes?.length > 0) {
            setSelectedId(grupoAvaliacoes.avaliacoes[0].id);
        } else if (avaliacao) {
            setSelectedId(avaliacao.id);
        }
    }, [grupoAvaliacoes, avaliacao]);

    const current = useMemo(() => {
        if (!selectedId && avaliacao) return avaliacao;
        return avaliacoes.find(a => a.id === selectedId) || avaliacao;
    }, [avaliacoes, selectedId, avaliacao]);

    const accountName = current?.account_name || grupoAvaliacoes?.account_name;

    // Fetch current/live metrics for this account
    const { data: radarAtual = [] } = useQuery({
        queryKey: ['radarAtualEficacia', accountName],
        queryFn: () => base44.entities.RadarMetaData.filter({ account_name: accountName }),
        enabled: !!accountName && open,
        staleTime: 60 * 1000,
    });

    const { data: contasMeta = [] } = useQuery({
        queryKey: ['contaMetaAtualEficacia', accountName],
        queryFn: () => base44.entities.ContaMetaAds.filter({ account_name: accountName }),
        enabled: !!accountName && open,
        staleTime: 60 * 1000,
    });

    if (!current) return null;

    const t0 = current.snapshot_t0 || {};
    const t3 = current.snapshot_t3 || {};
    const isConcluida = current.status === 'concluida';
    const isPendente = current.status === 'pendente';

    // Build current snapshot from live data
    const radar = radarAtual[0];
    const conta = contasMeta[0];
    const snapshotAtual = (radar || conta) ? {
        cpl_7d: radar?.cpl_7d || conta?.cpl_meta_ads || 0,
        leads_7d: radar?.leads_7d || conta?.leads || 0,
        ctr_7d: radar?.ctr_7d || 0,
        frequencia_7d: radar?.frequencia_7d || conta?.frequency || 0,
        nota_gpt: conta?.nota_gpt || 0,
        classificacao: conta?.classificacao || '',
        amount_spent_ontem: radar?.amount_spent_ontem || 0,
    } : null;

    // Calculate deltas T0 → Atual (retroactive long-term follow-up)
    const calcDelta = (v0, v1) => {
        if (!v0 || !v1 || v0 === 0) return null;
        return ((v1 - v0) / v0) * 100;
    };
    const deltaCplAtual = calcDelta(t0.cpl_7d, snapshotAtual?.cpl_7d);
    const deltaLeadsAtual = calcDelta(t0.leads_7d, snapshotAtual?.leads_7d);
    const deltaCtrAtual = calcDelta(t0.ctr_7d, snapshotAtual?.ctr_7d);
    const deltaFreqAtual = calcDelta(t0.frequencia_7d, snapshotAtual?.frequencia_7d);
    const deltaNotaAtual = snapshotAtual ? (snapshotAtual.nota_gpt || 0) - (t0.nota_gpt || 0) : null;

    // Days since optimization
    const diasDesdeOtim = current.data_otimizacao
        ? moment().tz('America/Sao_Paulo').diff(moment(current.data_otimizacao), 'days')
        : null;

    const getEficaciaConfig = () => {
        const config = {
            'melhorou': { label: 'Melhorou', className: 'bg-green-500 text-white', icon: TrendingUp, color: 'text-green-600' },
            'estavel': { label: 'Estável', className: 'bg-yellow-500 text-white', icon: Minus, color: 'text-yellow-600' },
            'piorou': { label: 'Piorou', className: 'bg-red-500 text-white', icon: TrendingDown, color: 'text-red-600' }
        };
        return config[current.eficacia_tecnica] || config.estavel;
    };

    const eficaciaConfig = getEficaciaConfig();
    const EficaciaIcon = eficaciaConfig.icon;

    const getScoreColor = (score) => {
        if (score >= 65) return 'text-green-600';
        if (score >= 40) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getDeltaColor = (delta, invert) => {
        if (delta === null) return 'text-slate-300';
        const isPositive = invert ? delta < 0 : delta > 0;
        const isNeutral = Math.abs(delta) < 0.1;
        if (isNeutral) return 'text-slate-400';
        return isPositive ? 'text-green-600' : 'text-red-600';
    };

    const fmtVal = (v, prefix, suffix) => {
        if (typeof v !== 'number' || v === 0) return '—';
        if (prefix === 'R$') return `R$ ${v.toFixed(2)}`;
        if (suffix === '%') return `${v.toFixed(1)}%`;
        return v.toFixed(0);
    };

    const fmtDelta = (delta, absolute) => {
        if (delta === null) return '—';
        if (absolute) return `${delta > 0 ? '+' : ''}${delta.toFixed(0)}`;
        return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
    };

    const getDeltaIcon = (delta, invert) => {
        if (delta === null) return '—';
        if (Math.abs(delta) < 0.1) return '→';
        return (invert ? delta < 0 : delta > 0) ? '↑' : '↓';
    };

    const KpiRow = ({ label, t0Val, t3Val, atualVal, deltaT3, deltaAtual, invert, prefix, suffix, absolute }) => (
        <div className="py-2 border-b border-slate-100 last:border-0">
            <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-600">{label}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                    <p className="text-[10px] text-slate-400 uppercase">T0</p>
                    <p className="text-slate-500 line-through">{fmtVal(t0Val, prefix, suffix)}</p>
                </div>
                <div className="text-center">
                    <p className="text-[10px] text-slate-400 uppercase">T3 (3 dias)</p>
                    <p className="font-medium text-slate-700">{fmtVal(t3Val, prefix, suffix)}</p>
                    {deltaT3 !== undefined && deltaT3 !== null && (
                        <p className={cn("font-semibold", getDeltaColor(deltaT3, invert))}>
                            {getDeltaIcon(deltaT3, invert)} {fmtDelta(deltaT3, absolute)}
                        </p>
                    )}
                </div>
                <div className="text-center">
                    <p className="text-[10px] text-violet-500 uppercase font-medium flex items-center justify-center gap-0.5">
                        <Radio className="w-2.5 h-2.5" /> Atual
                    </p>
                    <p className="font-medium text-violet-700">{fmtVal(atualVal, prefix, suffix)}</p>
                    {deltaAtual !== null && deltaAtual !== undefined && (
                        <p className={cn("font-semibold", getDeltaColor(deltaAtual, invert))}>
                            {getDeltaIcon(deltaAtual, invert)} {fmtDelta(deltaAtual, absolute)}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
                <div className="p-6 space-y-6">
                    {/* Evaluation selector (if multiple in group) */}
                    {avaliacoes.length > 1 && (
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Selecionar avaliação</label>
                            <Select value={selectedId || ''} onValueChange={setSelectedId}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {avaliacoes.map(a => (
                                        <SelectItem key={a.id} value={a.id}>
                                            {moment(a.data_otimizacao).format('DD/MM/YYYY')} — {a.status === 'concluida' ? (a.eficacia_tecnica || '—') : 'Pendente'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Header */}
                    <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h2 className="text-xl font-bold text-slate-900">{current.account_name}</h2>
                            {current.origem_registro === 'kanban' ? (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
                                    <Kanban className="w-3 h-3" /> Kanban
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 gap-1">
                                    <BarChart3 className="w-3 h-3" /> Monitoramento
                                </Badge>
                            )}
                            {isConcluida && (
                                <Badge className={eficaciaConfig.className}>
                                    <EficaciaIcon className="w-3 h-3 mr-1" />
                                    {eficaciaConfig.label}
                                </Badge>
                            )}
                            {isPendente && (
                                <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                                    Aguardando T+3
                                </Badge>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                Otimização: {moment(current.data_otimizacao).format('DD/MM/YYYY')}
                            </span>
                            {diasDesdeOtim !== null && (
                                <span className="flex items-center gap-1">
                                    <Radio className="w-3.5 h-3.5 text-violet-500" />
                                    {diasDesdeOtim} dias desde a otimização
                                </span>
                            )}
                            {current.data_avaliacao && (
                                <span>Análise T3: {moment(current.data_avaliacao).format('DD/MM/YYYY [às] HH:mm')}</span>
                            )}
                            {current.cliente_nome && <span>Cliente: {current.cliente_nome}</span>}
                        </div>
                    </div>

                    {/* Scores Principais */}
                    {isConcluida && (
                        <div className="grid grid-cols-2 gap-4">
                            <Card>
                                <CardContent className="p-4 text-center">
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                        <Activity className="w-4 h-4 text-violet-600" />
                                        <span className="text-xs text-slate-500">Score de Eficácia Técnica</span>
                                    </div>
                                    <p className={cn("text-3xl font-bold", getScoreColor(current.score_eficacia))}>
                                        {current.score_eficacia}
                                        <span className="text-sm text-slate-400">/100</span>
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4 text-center">
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                        <Smile className="w-4 h-4 text-blue-600" />
                                        <span className="text-xs text-slate-500">Score de Satisfação do Cliente</span>
                                    </div>
                                    <p className={cn("text-3xl font-bold", getScoreColor(current.score_satisfacao))}>
                                        {current.score_satisfacao}
                                        <span className="text-sm text-slate-400">/100</span>
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Status Pendente */}
                    {isPendente && (
                        <Card>
                            <CardContent className="p-6 text-center">
                                <Target className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                                <p className="text-slate-600 font-medium">Avaliação em andamento</p>
                                <p className="text-sm text-slate-400 mt-1">
                                    O snapshot T0 foi capturado. A análise T3 será gerada automaticamente 3 dias após a otimização.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Comparativo T0 → T3 → Atual (live follow-up) */}
                    {snapshotAtual && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Radio className="w-4 h-4 text-violet-600 animate-pulse" />
                                    Acompanhamento Estendido (T0 → T3 → Atual)
                                </CardTitle>
                                <p className="text-xs text-slate-500">
                                    Métricas ao vivo da conta — acompanhe se a unidade continuou melhorando após os 3 dias iniciais.
                                </p>
                            </CardHeader>
                            <CardContent>
                                <KpiRow label="CPL (7 dias)" t0Val={t0.cpl_7d} t3Val={t3.cpl_7d} atualVal={snapshotAtual.cpl_7d} deltaT3={current.delta_cpl} deltaAtual={deltaCplAtual} invert prefix="R$" />
                                <KpiRow label="Leads (7 dias)" t0Val={t0.leads_7d} t3Val={t3.leads_7d} atualVal={snapshotAtual.leads_7d} deltaT3={current.delta_leads} deltaAtual={deltaLeadsAtual} />
                                <KpiRow label="CTR (7 dias)" t0Val={t0.ctr_7d} t3Val={t3.ctr_7d} atualVal={snapshotAtual.ctr_7d} deltaT3={current.delta_ctr} deltaAtual={deltaCtrAtual} suffix="%" />
                                <KpiRow label="Frequência (7 dias)" t0Val={t0.frequencia_7d} t3Val={t3.frequencia_7d} atualVal={snapshotAtual.frequencia_7d} deltaT3={current.delta_frequencia} deltaAtual={deltaFreqAtual} invert />
                                <KpiRow label="Nota GPT" t0Val={t0.nota_gpt} t3Val={t3.nota_gpt} atualVal={snapshotAtual.nota_gpt} deltaT3={current.delta_nota_gpt} deltaAtual={deltaNotaAtual} absolute />
                                <KpiRow label="Investimento/dia" t0Val={t0.amount_spent_ontem} t3Val={t3.amount_spent_ontem} atualVal={snapshotAtual.amount_spent_ontem} deltaT3={0} deltaAtual={null} prefix="R$" />
                            </CardContent>
                        </Card>
                    )}

                    {/* Sentimento do Cliente (WhatsApp) */}
                    {isConcluida && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-blue-600" />
                                    Análise de Satisfação (WhatsApp)
                                    {current.total_mensagens_whatsapp > 0 && (
                                        <Badge variant="outline" className="ml-auto">
                                            {current.total_mensagens_whatsapp} mensagens
                                        </Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {current.total_mensagens_whatsapp > 0 ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Badge className={cn(
                                                current.sentimento_cliente === 'positivo' ? 'bg-green-100 text-green-700 border-green-200' :
                                                current.sentimento_cliente === 'negativo' ? 'bg-red-100 text-red-700 border-red-200' :
                                                'bg-slate-100 text-slate-700 border-slate-200'
                                            )}>
                                                {current.sentimento_cliente === 'positivo' && '😊 Positivo'}
                                                {current.sentimento_cliente === 'neutro' && '😐 Neutro'}
                                                {current.sentimento_cliente === 'negativo' && '😟 Negativo'}
                                            </Badge>
                                            <span className={cn("text-lg font-bold", getScoreColor(current.score_satisfacao))}>
                                                {current.score_satisfacao}/100
                                            </span>
                                        </div>
                                        {current.resumo_satisfacao && (
                                            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                                                {current.resumo_satisfacao}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-400 italic">
                                        Sem mensagens de WhatsApp registradas no período de 3 dias pós-otimização.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Análise LLM Completa */}
                    {isConcluida && current.analise_llm && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-violet-600" />
                                    Análise de Eficácia (IA)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                                    {current.analise_llm}
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Recomendações */}
                    {isConcluida && current.recomendacoes && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                                    Recomendações de Próximos Passos
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                                    {current.recomendacoes}
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Erro */}
                    {current.status === 'erro' && (
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-red-600">
                                    <TrendingDown className="w-5 h-5" />
                                    <p className="text-sm font-medium">Erro na avaliação</p>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">{current.erro_detalhe}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Other evaluations in the group */}
                    {avaliacoes.length > 1 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-violet-600" />
                                    Histórico de Otimizações desta Unidade ({avaliacoes.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {avaliacoes.map(a => (
                                        <button
                                            key={a.id}
                                            onClick={() => setSelectedId(a.id)}
                                            className={cn(
                                                "w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors",
                                                a.id === selectedId ? "bg-violet-50 border border-violet-200" : "hover:bg-slate-50"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-slate-600">{moment(a.data_otimizacao).format('DD/MM/YYYY')}</span>
                                                {a.status === 'concluida' ? (
                                                    <Badge className={cn(
                                                        "text-[10px]",
                                                        a.eficacia_tecnica === 'melhorou' ? 'bg-green-500 text-white' :
                                                        a.eficacia_tecnica === 'piorou' ? 'bg-red-500 text-white' :
                                                        'bg-yellow-500 text-white'
                                                    )}>
                                                        {a.eficacia_tecnica}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px] text-yellow-600 border-yellow-300">
                                                        Pendente
                                                    </Badge>
                                                )}
                                            </div>
                                            {a.score_eficacia != null && (
                                                <span className={cn("text-sm font-bold", getScoreColor(a.score_eficacia))}>
                                                    {a.score_eficacia}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}