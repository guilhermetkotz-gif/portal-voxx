import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertTriangle, TrendingUp, DollarSign, MessageCircle, Users, MousePointer, Target, CheckCircle2, Plus, Lightbulb, Loader2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import AdicionarOtimizacaoModal from '@/components/metaads/AdicionarOtimizacaoModal';

export default function DetalheConta({ user }) {
    const [searchParams] = useSearchParams();
    const accountName = searchParams.get('account');
    const [showOtimizacaoModal, setShowOtimizacaoModal] = useState(false);
    const [recommendations, setRecommendations] = useState(null);
    const [loadingRecommendations, setLoadingRecommendations] = useState(false);

    // Verificar se é admin
    const isAdmin = user?.role === 'admin' || user?.tipo_usuario === 'voxx_admin' || user?.tipo_usuario === 'voxx_manager';

    const { data: accounts = [], isLoading } = useQuery({
        queryKey: ['metaAdsAccounts'],
        queryFn: () => base44.entities.ContaMetaAds.list('-created_date', 500),
        staleTime: 2 * 60 * 1000
    });

    const { data: clientes = [] } = useQuery({
        queryKey: ['clientes'],
        queryFn: () => base44.entities.Cliente.list('-updated_date', 500),
        staleTime: 5 * 60 * 1000
    });

    const account = accounts.find(acc => acc.account_name === accountName);
    const cliente = clientes.find(c => c.nome === accountName);

    // Load recommendations when account is available
    React.useEffect(() => {
        if (account && !recommendations && !loadingRecommendations) {
            setLoadingRecommendations(true);
            base44.functions.invoke('getMetaAdsRecommendations', {
                account_name: account.account_name,
                investment_tier: cliente?.tipo_cliente || 'particular'
            })
                .then(response => {
                    setRecommendations(response.data);
                })
                .catch(error => {
                    console.error('Erro ao carregar recomendações:', error);
                })
                .finally(() => {
                    setLoadingRecommendations(false);
                });
        }
    }, [account, recommendations, loadingRecommendations, cliente]);

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

    if (isLoading) {
        return <div className="text-center py-12">Carregando...</div>;
    }

    if (!account) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500 mb-4">Conta não encontrada</p>
                <Link to={createPageUrl('MonitoramentoContas')}>
                    <Button>Voltar para Monitoramento</Button>
                </Link>
            </div>
        );
    }

    const getNotaColor = (nota) => {
        if (nota >= 90) return 'text-green-700 bg-green-50 border-green-200';
        if (nota >= 80) return 'text-green-600 bg-green-50 border-green-100';
        if (nota >= 65) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        if (nota >= 50) return 'text-orange-600 bg-orange-50 border-orange-200';
        return 'text-red-600 bg-red-50 border-red-200';
    };

    const getClassificacaoBadge = (classificacao) => {
        const colors = {
            'ELITE': 'bg-green-700 text-white',
            'SAUDÁVEL': 'bg-green-500 text-white',
            'OPERACIONAL': 'bg-yellow-500 text-white',
            'ALERTA': 'bg-orange-500 text-white',
            'CRÍTICO': 'bg-red-600 text-white'
        };
        return colors[classificacao] || 'bg-slate-500 text-white';
    };

    const getPrioridadeBadge = (prioridade) => {
        const colors = {
            'P1': 'bg-red-600 text-white',
            'P2': 'bg-orange-500 text-white',
            'P3': 'bg-blue-500 text-white'
        };
        const labels = {
            'P1': 'P1 - Urgente',
            'P2': 'P2 - Importante',
            'P3': 'P3 - Monitorar'
        };
        return { color: colors[prioridade] || 'bg-slate-500 text-white', label: labels[prioridade] };
    };

    const getDiagnostico = () => {
        if (account.frequency >= 3.2) {
            return {
                titulo: "⚠️ Frequência Alta Detectada",
                descricao: "A frequência de 3.2+ indica que o mesmo público está vendo seus anúncios repetidamente. Isso causa saturação criativa e fadiga do público.",
                impacto: "Redução progressiva no CTR, aumento no CPM e queda na taxa de conversão.",
                risco: "Se não for corrigido, o custo por resultado pode dobrar nas próximas 2 semanas, comprometendo a meta do mês."
            };
        }
        if (account.leads_repetidos_percent >= 22) {
            return {
                titulo: "⚠️ Alta Taxa de Leads Repetidos",
                descricao: "Mais de 22% dos leads são pessoas que já converteram anteriormente. Isso indica público pequeno ou segmentação muito restrita.",
                impacto: "Desperdício de orçamento com pessoas que já estão na base e saturação rápida do público disponível.",
                risco: "O público disponível pode esgotar antes do fim do mês, impedindo escalar ou manter o volume atual."
            };
        }
        if ((account.cpl_meta_ads || account.cost_per_messaging) >= 30) {
            return {
                titulo: "⚠️ Custo por Conversa Elevado",
                descricao: "O custo acima de R$ 30 por conversa iniciada sugere baixa qualificação no criativo, oferta pouco atrativa ou público frio demais.",
                impacto: "ROI comprometido, dificulta atingir metas de custo por lead e escalar campanhas de forma lucrativa.",
                risco: "Se o custo não reduzir, pode inviabilizar a continuidade da campanha dentro do orçamento planejado."
            };
        }
        return {
            titulo: "✅ Conta Operando Normalmente",
            descricao: "A conta está dentro dos parâmetros esperados e não apresenta sinais críticos de performance.",
            impacto: "Manutenção dos resultados atuais com pequenas otimizações incrementais.",
            risco: "Baixo. Monitoramento contínuo é recomendado para prevenir degradação futura."
        };
    };

    const diagnostico = getDiagnostico();
    const prioridadeInfo = getPrioridadeBadge(account.prioridade);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <Link to={createPageUrl('MonitoramentoContas')}>
                    <Button variant="ghost" className="mb-4">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar para Monitoramento
                    </Button>
                </Link>
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">{account.account_name}</h1>
                        <div className="flex items-center gap-3 mt-3">
                            <span className={cn("px-4 py-1.5 rounded-full text-lg font-bold border-2", getNotaColor(account.nota_gpt))}>
                                Nota GPT: {account.nota_gpt.toFixed(0)}
                            </span>
                            <Badge className={cn("text-sm py-1", getClassificacaoBadge(account.classificacao))}>
                                {account.classificacao}
                            </Badge>
                            <Badge className={cn("text-sm py-1", prioridadeInfo.color)}>
                                {prioridadeInfo.label}
                            </Badge>
                        </div>
                        <p className="text-slate-600 mt-2 font-medium">{account.main_issue}</p>
                    </div>
                    <Button
                        onClick={() => setShowOtimizacaoModal(true)}
                        className="bg-violet-600 hover:bg-violet-700"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Otimização
                    </Button>
                </div>
            </div>

            {/* Métricas-Chave */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className={account.frequency >= 3.2 ? 'border-red-300 bg-red-50' : ''}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Frequência
                            {account.frequency >= 3.2 && <AlertTriangle className="w-4 h-4 text-red-600" />}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className={cn("text-3xl font-bold", account.frequency >= 3.2 ? 'text-red-600' : 'text-slate-900')}>
                            {account.frequency.toFixed(2)}
                        </span>
                        {account.frequency >= 3.2 && (
                            <p className="text-xs text-red-600 mt-1">Acima do ideal (≥3.2)</p>
                        )}
                    </CardContent>
                </Card>

                <Card className={account.leads_repetidos_percent >= 22 ? 'border-red-300 bg-red-50' : ''}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Leads Repetidos
                            {account.leads_repetidos_percent >= 22 && <AlertTriangle className="w-4 h-4 text-red-600" />}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className={cn("text-3xl font-bold", account.leads_repetidos_percent >= 22 ? 'text-red-600' : 'text-slate-900')}>
                            {account.leads_repetidos_percent.toFixed(1)}%
                        </span>
                        {account.leads_repetidos_percent >= 22 && (
                            <p className="text-xs text-red-600 mt-1">Acima do ideal (≥22%)</p>
                        )}
                    </CardContent>
                </Card>

                {(() => {
                    const custoConversa = account.cpl_meta_ads > 0 ? account.cpl_meta_ads : account.cost_per_messaging;
                    const isAlto = custoConversa >= 30;
                    return (
                        <Card className={isAlto ? 'border-red-300 bg-red-50' : ''}>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                    <MessageCircle className="w-4 h-4" />
                                    Custo/Conversa
                                    {isAlto && <AlertTriangle className="w-4 h-4 text-red-600" />}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <span className={cn("text-3xl font-bold", isAlto ? 'text-red-600' : 'text-slate-900')}>
                                    R$ {custoConversa.toFixed(2)}
                                </span>
                                {isAlto && (
                                    <p className="text-xs text-red-600 mt-1">Acima do ideal (≥R$30)</p>
                                )}
                            </CardContent>
                        </Card>
                    );
                })()}

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Investido no Mês
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-3xl font-bold text-slate-900">
                            R$ {account.amount_spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                    </CardContent>
                </Card>
            </div>

            {/* Métricas Adicionais */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500">Cadastros + WhatsApp</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-bold text-slate-900">{account.cadastros_whats ?? 0}</span>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500">Novas Conexões</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-bold text-slate-900">{account.new_messaging_connections}</span>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500">CPC</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-bold text-slate-900">R$ {account.cpc.toFixed(2)}</span>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500">Custo/Engajamento</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-bold text-slate-900">R$ {account.custo_engajamento.toFixed(2)}</span>
                    </CardContent>
                </Card>
            </div>

            {/* Diagnóstico */}
            <Card className="border-l-4 border-l-violet-600">
                <CardHeader>
                    <CardTitle className="text-xl">{diagnostico.titulo}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-slate-700 mb-1">O que está acontecendo:</h4>
                        <p className="text-slate-600">{diagnostico.descricao}</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-slate-700 mb-1">Por que isso reduz performance:</h4>
                        <p className="text-slate-600">{diagnostico.impacto}</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-slate-700 mb-1">Risco para o mês corrente:</h4>
                        <p className="text-slate-600">{diagnostico.risco}</p>
                    </div>
                </CardContent>
            </Card>

            {/* Plano de Ação */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-violet-600" />
                        Plano de Ação Recomendado
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loadingRecommendations ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-violet-600 mr-2" />
                            <span className="text-slate-600">Gerando recomendações personalizadas...</span>
                        </div>
                    ) : recommendations ? (
                        <div className="space-y-4">
                            {recommendations.recommendations?.length > 0 ? (
                                recommendations.recommendations.map((rec, idx) => (
                                    <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className={cn(
                                                "px-3 py-1 rounded text-xs font-semibold uppercase",
                                                rec.severity === 'critical' ? "bg-red-100 text-red-700" :
                                                rec.severity === 'high' ? "bg-orange-100 text-orange-700" :
                                                rec.severity === 'medium' ? "bg-yellow-100 text-yellow-700" :
                                                "bg-blue-100 text-blue-700"
                                            )}>
                                                {rec.severity === 'critical' ? 'Crítico' :
                                                 rec.severity === 'high' ? 'Alto' :
                                                 rec.severity === 'medium' ? 'Médio' : 'Baixo'}
                                            </div>
                                        </div>
                                        
                                        <h4 className="font-semibold text-slate-900 mb-2">{rec.problem}</h4>
                                        <p className="text-sm text-slate-600 mb-3">{rec.diagnosis}</p>
                                        
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-700 mb-2">Ações Prioritárias:</p>
                                                <ul className="space-y-2">
                                                    {rec.actions?.map((action, actionIdx) => (
                                                        <li key={actionIdx} className="flex items-start gap-2">
                                                            <CheckCircle2 className={cn(
                                                                "w-5 h-5 flex-shrink-0 mt-0.5",
                                                                rec.severity === 'critical' || rec.severity === 'high' ? "text-red-600" : "text-violet-600"
                                                            )} />
                                                            <span className="text-sm text-slate-700">
                                                                {action}
                                                                {(rec.severity === 'critical' || rec.severity === 'high') && (
                                                                    <span className="ml-2 text-xs text-red-600 font-semibold">(URGENTE)</span>
                                                                )}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            
                                            {rec.expected_impact && (
                                                <div className="p-3 bg-green-50 rounded border border-green-200">
                                                    <p className="text-sm font-semibold text-green-900 mb-1">Impacto Esperado:</p>
                                                    <p className="text-sm text-green-700">{rec.expected_impact}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8">
                                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                    <p className="text-slate-600">✅ Nenhuma ação crítica identificada. Conta operando dentro dos parâmetros esperados.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-500">
                            Carregando recomendações...
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal de Adicionar Otimização */}
            <AdicionarOtimizacaoModal
                open={showOtimizacaoModal}
                onOpenChange={setShowOtimizacaoModal}
                conta={account}
                recommendations={recommendations}
            />
        </div>
    );
}