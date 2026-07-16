import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Calendar, Target, AlertCircle, CheckCircle2, Loader2, User, Kanban, BarChart3 } from 'lucide-react';
import { format, startOfMonth, subDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import moment from 'moment-timezone';

export default function HistoricoOtimizacoesCliente() {
    const navigate = useNavigate();
    const urlParams = new URLSearchParams(window.location.search);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const contaId = urlParams.get('conta_id');
    const contaName = urlParams.get('conta_name');

    const { data: conta, isLoading: loadingConta } = useQuery({
        queryKey: ['contaMetaAds', contaId, contaName],
        queryFn: async () => {
            const contas = await base44.entities.ContaMetaAds.list('-updated_date', 500);
            // Busca por account_name (prioritário) ou por id
            return contas.find(c => contaName ? c.account_name === contaName : c.id === contaId);
        },
        enabled: !!(contaId || contaName),
        staleTime: 2 * 60 * 1000
    });

    const { data: otimizacoes = [], isLoading: loadingOtimizacoes } = useQuery({
        queryKey: ['metaAdsOtimizacoes', contaName || contaId],
        queryFn: () => base44.entities.MetaAdsOtimizacao.filter(
            { account_name: conta?.account_name },
            '-data_acao',
            500
        ),
        enabled: !!conta?.account_name,
        staleTime: 60 * 1000
    });

    if (!contaId) {
        return (
            <div className="max-w-4xl mx-auto">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-slate-600">ID da conta não fornecido</p>
                        <Button
                            onClick={() => navigate(createPageUrl('MonitoramentoContas'))}
                            className="mt-4"
                        >
                            Voltar
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (loadingConta || loadingOtimizacoes) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
            </div>
        );
    }

    if (!conta) {
        return (
            <div className="max-w-4xl mx-auto">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-slate-600">Conta não encontrada</p>
                        <Button
                            onClick={() => navigate(createPageUrl('MonitoramentoContas'))}
                            className="mt-4"
                        >
                            Voltar
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(createPageUrl('MonitoramentoContas'))}
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                </Button>
            </div>

            {/* Informações da Conta */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <CardTitle className="text-2xl">{conta.account_name}</CardTitle>
                            <p className="text-sm text-slate-500 mt-1">
                                Histórico completo de otimizações
                            </p>
                        </div>
                        <Badge className="bg-violet-600">
                            {otimizacoes.length} {otimizacoes.length === 1 ? 'otimização' : 'otimizações'}
                        </Badge>
                    </div>
                </CardHeader>
            </Card>

            {/* Filtro de Data */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium text-slate-700">Filtrar por período:</span>
                        <div className="flex items-center gap-2">
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="h-8 text-sm w-36"
                                placeholder="De"
                            />
                            <span className="text-xs text-slate-400">até</span>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="h-8 text-sm w-36"
                                placeholder="Até"
                            />
                        </div>
                        {(dateFrom || dateTo) && (
                            <button
                                onClick={() => { setDateFrom(''); setDateTo(''); }}
                                className="text-xs text-slate-500 hover:text-slate-700 underline"
                            >
                                Limpar filtro
                            </button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Timeline de Otimizações */}
            {(() => {
                const otimizacoesFiltradas = otimizacoes.filter(o => {
                    const data = o.data_acao?.slice(0, 10);
                    if (dateFrom && data < dateFrom) return false;
                    if (dateTo && data > dateTo) return false;
                    return true;
                });
                return otimizacoesFiltradas.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">
                            Nenhuma otimização registrada para esta conta ainda
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {otimizacoesFiltradas.map((otimizacao, index) => (
                        <Card key={otimizacao.id}>
                            <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                    {/* Timeline indicator */}
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                                            <CheckCircle2 className="w-5 h-5 text-violet-600" />
                                        </div>
                                        {index < otimizacoes.length - 1 && (
                                            <div className="w-0.5 h-full bg-slate-200 mt-2" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm font-medium text-slate-900">
                                                {moment(otimizacao.data_acao).format('DD/MM/YYYY')}
                                            </span>
                                            {index === 0 && (
                                                <Badge variant="outline" className="ml-2">
                                                    Mais recente
                                                </Badge>
                                            )}
                                            {otimizacao.origem_registro === 'kanban' ? (
                                                <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200 gap-1">
                                                    <Kanban className="w-3 h-3" />
                                                    Demanda Kanban
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="ml-2 bg-violet-50 text-violet-700 border-violet-200 gap-1">
                                                    <BarChart3 className="w-3 h-3" />
                                                    Monitoramento
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="space-y-3 bg-slate-50 rounded-lg p-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                                    <h4 className="text-sm font-semibold text-slate-700">
                                                        Problema Identificado
                                                    </h4>
                                                </div>
                                                <p className="text-sm text-slate-600 pl-6">
                                                    {otimizacao.problema}
                                                </p>
                                            </div>

                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Target className="w-4 h-4 text-blue-500" />
                                                    <h4 className="text-sm font-semibold text-slate-700">
                                                        Objetivo
                                                    </h4>
                                                </div>
                                                <p className="text-sm text-slate-600 pl-6">
                                                    {otimizacao.objetivo}
                                                </p>
                                            </div>

                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                    <h4 className="text-sm font-semibold text-slate-700">
                                                        Ações Implementadas
                                                    </h4>
                                                </div>
                                                <p className="text-sm text-slate-600 pl-6 whitespace-pre-wrap">
                                                    {otimizacao.acoes_implementadas}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 text-xs text-slate-400">
                                            <span>Registrado em {moment(otimizacao.created_date).format('DD/MM/YYYY [às] HH:mm')}</span>
                                            {otimizacao.usuario_nome && (
                                                <>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <User className="w-3 h-3" />
                                                        {otimizacao.usuario_nome}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            );
            })()}
        </div>
    );
}