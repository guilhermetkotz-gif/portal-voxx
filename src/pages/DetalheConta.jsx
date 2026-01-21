import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertTriangle, TrendingUp, DollarSign, MessageCircle, Users, MousePointer, Target, CheckCircle2, Plus } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import AdicionarOtimizacaoModal from '@/components/metaads/AdicionarOtimizacaoModal';

export default function DetalheConta({ user }) {
    const [searchParams] = useSearchParams();
    const accountName = searchParams.get('account');
    const [showOtimizacaoModal, setShowOtimizacaoModal] = useState(false);

    // Verificar se é admin
    const isAdmin = user?.role === 'admin' || user?.tipo_usuario === 'voxx_admin' || user?.tipo_usuario === 'voxx_manager';

    const { data: accounts = [], isLoading } = useQuery({
        queryKey: ['metaAdsAccounts'],
        queryFn: () => base44.entities.ContaMetaAds.list('-created_date', 500),
        staleTime: 2 * 60 * 1000
    });

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

    const account = accounts.find(acc => acc.account_name === accountName);

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
        if (account.cost_per_messaging >= 30) {
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

    const getPlanoAcao = () => {
        const acoes = [];

        if (account.frequency >= 3.2) {
            acoes.push(
                { texto: "Trocar eixo criativo (não apenas variação)", urgente: true },
                { texto: "Reduzir anúncios redundantes no mesmo público", urgente: true },
                { texto: "Expandir raio geográfico ou público se possível", urgente: false }
            );
        }

        if (account.leads_repetidos_percent >= 22) {
            acoes.push(
                { texto: "Criar criativos novos para topo de funil", urgente: true },
                { texto: "Ampliar alcance geográfico", urgente: true },
                { texto: "Evitar remarketing involuntário (excluir base)", urgente: false }
            );
        }

        if (account.cost_per_messaging >= 30) {
            acoes.push(
                { texto: "Revisar CTA e promessa no criativo", urgente: true },
                { texto: "Ajustar qualificação no WhatsApp", urgente: false },
                { texto: "Trocar formato criativo (vídeo ↔ imagem)", urgente: false }
            );
        }

        // Checklist técnico padrão
        acoes.push(
            { texto: "Advantage+ Placements ON", urgente: false, tecnico: true },
            { texto: "Advantage+ Creative ON (quando disponível)", urgente: false, tecnico: true },
            { texto: "Estrutura simples (1 campanha / 1 conjunto)", urgente: false, tecnico: true },
            { texto: "Revisão a cada 48-72h", urgente: false, tecnico: true }
        );

        return acoes;
    };

    const diagnostico = getDiagnostico();
    const planoAcao = getPlanoAcao();
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

                <Card className={account.cost_per_messaging >= 30 ? 'border-red-300 bg-red-50' : ''}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                            <MessageCircle className="w-4 h-4" />
                            Custo/Conversa
                            {account.cost_per_messaging >= 30 && <AlertTriangle className="w-4 h-4 text-red-600" />}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className={cn("text-3xl font-bold", account.cost_per_messaging >= 30 ? 'text-red-600' : 'text-slate-900')}>
                            R$ {account.cost_per_messaging.toFixed(2)}
                        </span>
                        {account.cost_per_messaging >= 30 && (
                            <p className="text-xs text-red-600 mt-1">Acima do ideal (≥R$30)</p>
                        )}
                    </CardContent>
                </Card>

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
                        <CardTitle className="text-sm font-medium text-slate-500">Conversas Iniciadas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-bold text-slate-900">{account.messaging_conversations}</span>
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
                        <Target className="w-5 h-5 text-violet-600" />
                        Plano de Ação Recomendado
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {planoAcao.filter(a => !a.tecnico).length > 0 && (
                            <div>
                                <h4 className="font-semibold text-slate-700 mb-3">Ações Prioritárias:</h4>
                                <div className="space-y-2">
                                    {planoAcao.filter(a => !a.tecnico).map((acao, idx) => (
                                        <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                                            <CheckCircle2 className={cn("w-5 h-5 flex-shrink-0 mt-0.5", acao.urgente ? "text-red-600" : "text-violet-600")} />
                                            <span className={cn("text-slate-700", acao.urgente && "font-semibold")}>
                                                {acao.texto}
                                                {acao.urgente && <span className="ml-2 text-xs text-red-600 font-normal">(URGENTE)</span>}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <div className="pt-4 border-t">
                            <h4 className="font-semibold text-slate-700 mb-3">Checklist Técnico Padrão:</h4>
                            <div className="space-y-2">
                                {planoAcao.filter(a => a.tecnico).map((acao, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                                        <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
                                        <span className="text-slate-700">{acao.texto}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Modal de Adicionar Otimização */}
            <AdicionarOtimizacaoModal
                open={showOtimizacaoModal}
                onOpenChange={setShowOtimizacaoModal}
                conta={account}
            />
        </div>
    );
}