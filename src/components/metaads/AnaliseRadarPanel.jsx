import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Sparkles, Clock, AlertTriangle, Activity, TrendingUp, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatPercent(value) {
    const sign = value > 0 ? '+' : '';
    return `${sign}${(value || 0).toFixed(1)}%`;
}

function formatDate(dateString) {
    if (!dateString) return '—';
    try {
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(dateString));
    } catch {
        return '—';
    }
}

const statusConfig = {
    estavel: { label: 'Estável', className: 'bg-green-100 text-green-800' },
    em_recuperacao: { label: 'Em Recuperação', className: 'bg-blue-100 text-blue-800' },
    atencao: { label: 'Atenção', className: 'bg-yellow-100 text-yellow-800' },
    critico: { label: 'Crítico', className: 'bg-red-100 text-red-800' },
    sem_dados: { label: 'Sem Dados', className: 'bg-slate-100 text-slate-600' }
};

const classificacaoColors = {
    'ELITE': 'bg-green-700 text-white',
    'SAUDÁVEL': 'bg-green-500 text-white',
    'OPERACIONAL': 'bg-yellow-500 text-white',
    'ALERTA': 'bg-orange-500 text-white',
    'CRÍTICO': 'bg-red-600 text-white'
};

const prioridadeColors = {
    'P1': 'bg-red-600 text-white',
    'P2': 'bg-orange-500 text-white',
    'P3': 'bg-blue-500 text-white'
};

const severityColors = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-blue-100 text-blue-700'
};

const severityLabels = {
    critical: 'CRÍTICO',
    high: 'ALTO',
    medium: 'MÉDIO',
    low: 'BAIXO'
};

export default function AnaliseRadarPanel({ conta, radarRow, recommendations, onReanalyze }) {
    const [reanalyzing, setReanalyzing] = useState(false);
    const [localRecommendations, setLocalRecommendations] = useState(recommendations);

    const analysisDate = conta?.updated_date || conta?.created_date;
    const recs = localRecommendations?.recommendations || [];
    const hasRecommendations = recs.length > 0;

    const handleReanalyze = async () => {
        setReanalyzing(true);
        try {
            const response = await base44.functions.invoke('getMetaAdsRecommendations', {
                account_name: conta?.account_name,
                investment_tier: 'particular'
            });
            const newRecs = response.data;
            setLocalRecommendations(newRecs);
            if (onReanalyze) onReanalyze(newRecs);
            toast.success('Análise atualizada com sucesso!');
        } catch (error) {
            toast.error('Erro ao re-analisar: ' + error.message);
        } finally {
            setReanalyzing(false);
        }
    };

    return (
        <div className="space-y-3">
            {/* Header com data da análise e botão re-analisar */}
            <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Análise gerada em: <strong className="text-slate-900">{formatDate(analysisDate)}</strong></span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReanalyze}
                    disabled={reanalyzing}
                    className="gap-2"
                >
                    {reanalyzing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <RefreshCw className="w-4 h-4" />
                    )}
                    {reanalyzing ? 'Analisando...' : 'Re-analisar'}
                </Button>
            </div>

            {/* Resumo Executivo */}
            <Card className="border-violet-200">
                <CardHeader className="pb-2 pt-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-violet-900">
                        <Sparkles className="w-4 h-4 text-violet-600" />
                        Resumo Executivo
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-3 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {/* Nota GPT */}
                        <div className="bg-white rounded-lg p-2 border border-slate-200 text-center">
                            <p className="text-xs text-slate-500 mb-1">Nota IA</p>
                            <p className={cn(
                                "text-xl font-bold",
                                (conta?.nota_gpt || 0) >= 80 ? "text-green-600" :
                                (conta?.nota_gpt || 0) >= 65 ? "text-yellow-600" :
                                (conta?.nota_gpt || 0) >= 50 ? "text-orange-600" :
                                "text-red-600"
                            )}>
                                {(conta?.nota_gpt || 0).toFixed(0)}
                            </p>
                            <p className="text-xs text-slate-400">/100</p>
                        </div>

                        {/* Classificação */}
                        <div className="bg-white rounded-lg p-2 border border-slate-200 text-center">
                            <p className="text-xs text-slate-500 mb-1">Classificação</p>
                            <Badge className={cn("text-xs", classificacaoColors[conta?.classificacao] || 'bg-slate-100 text-slate-600')}>
                                {conta?.classificacao || '—'}
                            </Badge>
                        </div>

                        {/* Prioridade */}
                        <div className="bg-white rounded-lg p-2 border border-slate-200 text-center">
                            <p className="text-xs text-slate-500 mb-1">Prioridade</p>
                            <Badge className={cn("text-xs", prioridadeColors[conta?.prioridade] || 'bg-slate-100 text-slate-600')}>
                                {conta?.prioridade || '—'}
                            </Badge>
                        </div>

                        {/* Radar Score */}
                        {radarRow && (
                            <div className="bg-white rounded-lg p-2 border border-slate-200 text-center">
                                <p className="text-xs text-slate-500 mb-1">Radar Score</p>
                                <p className={cn(
                                    "text-xl font-bold",
                                    radarRow.radarScore < 40 ? "text-red-600" :
                                    radarRow.radarScore < 60 ? "text-orange-600" :
                                    radarRow.radarScore < 80 ? "text-yellow-600" :
                                    "text-green-600"
                                )}>
                                    {radarRow.radarScore}
                                </p>
                                <p className="text-xs text-slate-400">/100</p>
                            </div>
                        )}
                    </div>

                    {/* Main Issue */}
                    {conta?.main_issue && (
                        <div className="flex items-start gap-2 bg-amber-50 rounded-lg p-2 border border-amber-200">
                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-900">{conta.main_issue}</p>
                        </div>
                    )}

                    {/* Status descritivo do radar */}
                    {radarRow?.status && (
                        <div className="flex items-start gap-2 bg-slate-50 rounded-lg p-2 border border-slate-200">
                            <Activity className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-slate-700">{radarRow.status}</p>
                        </div>
                    )}

                    {/* Métricas rápidas do radar */}
                    {radarRow && (
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                            <div className="text-center">
                                <p className="text-slate-400">CPL Atual</p>
                                <p className="font-semibold text-slate-700">{formatCurrency(radarRow.cplAtual)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-slate-400">Δ CPL</p>
                                <p className={cn("font-semibold", radarRow.variacaoCPL > 0 ? "text-red-600" : "text-green-600")}>
                                    {formatPercent(radarRow.variacaoCPL)}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-slate-400">CTR</p>
                                <p className="font-semibold text-slate-700">{(radarRow.ctrAtual || 0).toFixed(2)}%</p>
                            </div>
                            <div className="text-center">
                                <p className="text-slate-400">Freq. 7d</p>
                                <p className={cn("font-semibold", radarRow.frequencia7d >= 3.0 ? "text-red-600" : radarRow.frequencia7d >= 2.5 ? "text-orange-600" : "text-green-600")}>
                                    {(radarRow.frequencia7d || 0).toFixed(2)}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-slate-400">Leads/dia</p>
                                <p className="font-semibold text-slate-700">{radarRow.leadsDia7d}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-slate-400">Inv. Diário</p>
                                <p className="font-semibold text-slate-700">{formatCurrency(radarRow.investimentoDiario)}</p>
                            </div>
                        </div>
                    )}

                    {/* Previsão */}
                    {radarRow?.forecast && (
                        <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-2 border border-blue-200">
                            <TrendingUp className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <p className="text-xs text-blue-900">
                                <strong>Previsão 7 dias:</strong> Radar Score {radarRow.forecast.radarScore}
                                <span className={cn("font-semibold ml-1", radarRow.forecast.delta > 0 ? "text-green-600" : radarRow.forecast.delta < 0 ? "text-red-600" : "text-slate-500")}>
                                    ({radarRow.forecast.delta > 0 ? '+' : ''}{radarRow.forecast.delta} pts)
                                </span>
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Diagnóstico */}
            <Card className="border-blue-200">
                <CardHeader className="pb-2 pt-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                        <AlertTriangle className="w-4 h-4 text-blue-600" />
                        Diagnóstico
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-3 space-y-2">
                    {reanalyzing ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                            <span className="text-sm text-slate-600">Gerando diagnóstico...</span>
                        </div>
                    ) : hasRecommendations ? (
                        recs.map((rec, idx) => (
                            <div key={idx} className="bg-white rounded-lg p-3 border border-slate-200">
                                <div className="flex items-start gap-2">
                                    <Badge className={cn("text-xs flex-shrink-0", severityColors[rec.severity] || 'bg-slate-100 text-slate-600')}>
                                        {severityLabels[rec.severity] || rec.severity}
                                    </Badge>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-slate-900 mb-1">{rec.problem}</p>
                                        <p className="text-xs text-slate-600 mb-2">{rec.diagnosis}</p>
                                        {rec.actions && rec.actions.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-xs font-medium text-slate-700 mb-1">Ações sugeridas:</p>
                                                <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-600">
                                                    {rec.actions.map((action, actionIdx) => (
                                                        <li key={actionIdx}>{action}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {rec.expected_impact && (
                                            <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                                                <p className="text-xs text-green-700"><strong>Impacto esperado:</strong> {rec.expected_impact}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-6 text-sm text-slate-500">
                            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                            Nenhum problema crítico identificado. Conta operando dentro dos parâmetros esperados.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export { statusConfig };