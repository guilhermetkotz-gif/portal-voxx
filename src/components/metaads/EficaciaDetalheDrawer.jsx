import React from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, MessageSquare, Sparkles, Lightbulb, Target, Activity, Smile, Kanban, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import moment from 'moment-timezone';

export default function EficaciaDetalheDrawer({ open, onOpenChange, avaliacao }) {
    if (!avaliacao) return null;

    const t0 = avaliacao.snapshot_t0 || {};
    const t3 = avaliacao.snapshot_t3 || {};
    const isConcluida = avaliacao.status === 'concluida';
    const isPendente = avaliacao.status === 'pendente';

    const getEficaciaConfig = () => {
        const config = {
            'melhorou': { label: 'Melhorou', className: 'bg-green-500 text-white', icon: TrendingUp, color: 'text-green-600' },
            'estavel': { label: 'Estável', className: 'bg-yellow-500 text-white', icon: Minus, color: 'text-yellow-600' },
            'piorou': { label: 'Piorou', className: 'bg-red-500 text-white', icon: TrendingDown, color: 'text-red-600' }
        };
        return config[avaliacao.eficacia_tecnica] || config.estavel;
    };

    const eficaciaConfig = getEficaciaConfig();
    const EficaciaIcon = eficaciaConfig.icon;

    const getScoreColor = (score) => {
        if (score >= 65) return 'text-green-600';
        if (score >= 40) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getDeltaColor = (delta, invert) => {
        const isPositive = invert ? delta < 0 : delta > 0;
        const isNeutral = Math.abs(delta) < 0.1;
        if (isNeutral) return 'text-slate-400';
        return isPositive ? 'text-green-600' : 'text-red-600';
    };

    const KpiRow = ({ label, t0Val, t3Val, delta, invert, prefix, suffix, absolute }) => {
        const fmtVal = (v) => {
            if (typeof v !== 'number' || v === 0) return '—';
            if (prefix === 'R$') return `R$ ${v.toFixed(2)}`;
            if (suffix === '%') return `${v.toFixed(1)}%`;
            return v.toFixed(0);
        };
        const deltaText = absolute
            ? `${delta > 0 ? '+' : ''}${delta.toFixed(0)}`
            : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
        const deltaIcon = Math.abs(delta) < 0.1 ? '→' : (invert ? delta < 0 : delta > 0) ? '↑' : '↓';

        return (
            <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm text-slate-600">{label}</span>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <span className="text-xs text-slate-400 line-through">{fmtVal(t0Val)}</span>
                        <span className="text-sm font-medium text-slate-700 ml-2">{fmtVal(t3Val)}</span>
                    </div>
                    <span className={cn("text-sm font-semibold w-20 text-right", getDeltaColor(delta, invert))}>
                        {deltaIcon} {deltaText}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
                <div className="p-6 space-y-6">
                    {/* Header */}
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-xl font-bold text-slate-900">{avaliacao.account_name}</h2>
                            {avaliacao.origem_registro === 'kanban' ? (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
                                    <Kanban className="w-3 h-3" />
                                    Kanban
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 gap-1">
                                    <BarChart3 className="w-3 h-3" />
                                    Monitoramento
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
                            <span>Otimização: {moment(avaliacao.data_otimizacao).format('DD/MM/YYYY')}</span>
                            {avaliacao.data_avaliacao && (
                                <span>Análise: {moment(avaliacao.data_avaliacao).format('DD/MM/YYYY [às] HH:mm')}</span>
                            )}
                            {avaliacao.cliente_nome && <span>Cliente: {avaliacao.cliente_nome}</span>}
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
                                    <p className={cn("text-3xl font-bold", getScoreColor(avaliacao.score_eficacia))}>
                                        {avaliacao.score_eficacia}
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
                                    <p className={cn("text-3xl font-bold", getScoreColor(avaliacao.score_satisfacao))}>
                                        {avaliacao.score_satisfacao}
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
                                    O snapshot T0 foi capturado. A análise completa será gerada automaticamente 3 dias após a otimização.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Comparativo T0 vs T3 */}
                    {isConcluida && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Target className="w-4 h-4 text-violet-600" />
                                    Comparativo de Métricas (T0 → T3)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between py-2 mb-2 border-b border-slate-200">
                                    <span className="text-xs font-medium text-slate-400">Métrica</span>
                                    <span className="text-xs font-medium text-slate-400">T0 → T3 (Variação)</span>
                                </div>
                                <KpiRow label="CPL (7 dias)" t0Val={t0.cpl_7d} t3Val={t3.cpl_7d} delta={avaliacao.delta_cpl} invert prefix="R$" />
                                <KpiRow label="Leads (7 dias)" t0Val={t0.leads_7d} t3Val={t3.leads_7d} delta={avaliacao.delta_leads} />
                                <KpiRow label="CTR (7 dias)" t0Val={t0.ctr_7d} t3Val={t3.ctr_7d} delta={avaliacao.delta_ctr} suffix="%" />
                                <KpiRow label="Frequência (7 dias)" t0Val={t0.frequencia_7d} t3Val={t3.frequencia_7d} delta={avaliacao.delta_frequencia} invert />
                                <KpiRow label="Nota GPT" t0Val={t0.nota_gpt} t3Val={t3.nota_gpt} delta={avaliacao.delta_nota_gpt} absolute />
                                <KpiRow label="Investimento/dia" t0Val={t0.amount_spent_ontem} t3Val={t3.amount_spent_ontem} delta={avaliacao.delta_cpl * 0} prefix="R$" />
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
                                    {avaliacao.total_mensagens_whatsapp > 0 && (
                                        <Badge variant="outline" className="ml-auto">
                                            {avaliacao.total_mensagens_whatsapp} mensagens
                                        </Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {avaliacao.total_mensagens_whatsapp > 0 ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Badge className={cn(
                                                avaliacao.sentimento_cliente === 'positivo' ? 'bg-green-100 text-green-700 border-green-200' :
                                                avaliacao.sentimento_cliente === 'negativo' ? 'bg-red-100 text-red-700 border-red-200' :
                                                'bg-slate-100 text-slate-700 border-slate-200'
                                            )}>
                                                {avaliacao.sentimento_cliente === 'positivo' && '😊 Positivo'}
                                                {avaliacao.sentimento_cliente === 'neutro' && '😐 Neutro'}
                                                {avaliacao.sentimento_cliente === 'negativo' && '😟 Negativo'}
                                            </Badge>
                                            <span className={cn("text-lg font-bold", getScoreColor(avaliacao.score_satisfacao))}>
                                                {avaliacao.score_satisfacao}/100
                                            </span>
                                        </div>
                                        {avaliacao.resumo_satisfacao && (
                                            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                                                {avaliacao.resumo_satisfacao}
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
                    {isConcluida && avaliacao.analise_llm && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-violet-600" />
                                    Análise de Eficácia (IA)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                                    {avaliacao.analise_llm}
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Recomendações */}
                    {isConcluida && avaliacao.recomendacoes && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                                    Recomendações de Próximos Passos
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                                    {avaliacao.recomendacoes}
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Erro */}
                    {avaliacao.status === 'erro' && (
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-red-600">
                                    <TrendingDown className="w-5 h-5" />
                                    <p className="text-sm font-medium">Erro na avaliação</p>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">{avaliacao.erro_detalhe}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}