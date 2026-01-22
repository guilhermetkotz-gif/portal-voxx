import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Search, AlertTriangle, TrendingUp, DollarSign, Target, Activity, TrendingDown, CheckCircle, Clock, ChevronDown, ChevronRight, Lightbulb } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import ListaHistoricoOtimizacoes from '@/components/metaads/ListaHistoricoOtimizacoes';

export default function MonitoramentoContas({ user }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [prioridadeFilter, setPrioridadeFilter] = useState('all');
    const [classificacaoFilter, setClassificacaoFilter] = useState('all');
    const [radarSearchTerm, setRadarSearchTerm] = useState('');
    const [radarPrioridadeFilter, setRadarPrioridadeFilter] = useState('all');
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

    const { data: radarMetaData = [] } = useQuery({
        queryKey: ['radarMetaData'],
        queryFn: () => base44.entities.RadarMetaData.list('-created_date', 500),
        staleTime: 2 * 60 * 1000
    });

    const [expandedRows, setExpandedRows] = useState(new Set());
    const [recommendations, setRecommendations] = useState({});

    const loadRecommendation = async (accountName, cliente) => {
        if (recommendations[accountName]) return; // Já carregado

        try {
            const response = await base44.functions.invoke('getMetaAdsRecommendations', {
                account_name: accountName,
                investment_tier: cliente?.tipo_cliente || 'particular'
            });
            
            setRecommendations(prev => ({
                ...prev,
                [accountName]: response.data
            }));
        } catch (error) {
            console.error('Erro ao carregar recomendações:', error);
            setRecommendations(prev => ({
                ...prev,
                [accountName]: { error: 'Erro ao carregar recomendações' }
            }));
        }
    };

    const toggleRow = (accountName, cliente) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(accountName)) {
            newExpanded.delete(accountName);
        } else {
            newExpanded.add(accountName);
            loadRecommendation(accountName, cliente);
        }
        setExpandedRows(newExpanded);
    };

    const clientesMap = React.useMemo(() => {
        return new Map(clientes.map(c => [c.nome, c]));
    }, [clientes]);

    const radarMetaDataMap = React.useMemo(() => {
        return new Map(radarMetaData.map(r => [r.account_name, r]));
    }, [radarMetaData]);

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

    // Auto-sync on mount if no data
    useEffect(() => {
        if (!isLoading && accounts.length === 0) {
            syncMutation.mutate();
        }
    }, [isLoading, accounts.length]);

    // Filter and sort accounts
    const filteredAccounts = accounts
        .filter(acc => {
            const matchesSearch = acc.account_name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesPrioridade = prioridadeFilter === 'all' || acc.prioridade === prioridadeFilter;
            const matchesClassificacao = classificacaoFilter === 'all' || acc.classificacao === classificacaoFilter;
            return matchesSearch && matchesPrioridade && matchesClassificacao;
        })
        .sort((a, b) => {
            // Sort by prioridade first (P1 > P2 > P3)
            const prioOrder = { 'P1': 1, 'P2': 2, 'P3': 3 };
            if (prioOrder[a.prioridade] !== prioOrder[b.prioridade]) {
                return prioOrder[a.prioridade] - prioOrder[b.prioridade];
            }
            // Then by nota_gpt ascending
            if (a.nota_gpt !== b.nota_gpt) {
                return a.nota_gpt - b.nota_gpt;
            }
            // Finally by amount_spent descending
            return b.amount_spent - a.amount_spent;
        });

    // Calculate KPIs
    const totalContas = accounts.length;
    const contasP1 = accounts.filter(acc => acc.prioridade === 'P1').length;
    const contasCritico = accounts.filter(acc => acc.classificacao === 'CRÍTICO').length;
    const mediaNotaGPT = accounts.length > 0 
        ? (accounts.reduce((sum, acc) => sum + acc.nota_gpt, 0) / accounts.length).toFixed(1)
        : 0;
    const totalGasto = accounts.reduce((sum, acc) => sum + acc.amount_spent, 0);

    // Distribuição por classificação
    const distribuicaoClassificacao = [
        { name: 'CRÍTICO', count: accounts.filter(acc => acc.classificacao === 'CRÍTICO').length, color: '#DC2626' },
        { name: 'ALERTA', count: accounts.filter(acc => acc.classificacao === 'ALERTA').length, color: '#F97316' },
        { name: 'OPERACIONAL', count: accounts.filter(acc => acc.classificacao === 'OPERACIONAL').length, color: '#EAB308' },
        { name: 'SAUDÁVEL', count: accounts.filter(acc => acc.classificacao === 'SAUDÁVEL').length, color: '#22C55E' },
        { name: 'ELITE', count: accounts.filter(acc => acc.classificacao === 'ELITE').length, color: '#15803D' }
    ].filter(item => item.count > 0);

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
        return colors[prioridade] || 'bg-slate-500 text-white';
    };

    // RADAR META Logic
    const radarData = React.useMemo(() => {
        if (!accounts.length) return [];

        const cpls = accounts
            .map(c => c.cost_per_new_messaging || c.cost_per_messaging || 0)
            .filter(cpl => cpl > 0);
        const avgCPL = cpls.reduce((sum, cpl) => sum + cpl, 0) / cpls.length;

        return accounts.map(conta => {
            const cliente = clientesMap.get(conta.account_name);
            const radarData = radarMetaDataMap.get(conta.account_name);
            
            const cplAtual = radarData?.cpl_ontem || (conta.cost_per_new_messaging || conta.cost_per_messaging || 0);
            const cpl7d = radarData?.cpl_7d || cplAtual;
            const ctrAtual = radarData?.ctr_ontem || (((conta.clicks_all || 0) / (conta.impressions || 1)) * 100);
            const ctr7d = radarData?.ctr_7d || ctrAtual;
            const cpmAtual = ((conta.amount_spent || 0) / (conta.impressions || 1)) * 1000;
            const investimento = conta.amount_spent || 0;
            const leadsOntem = radarData?.leads_ontem || (conta.new_messaging_connections || conta.messaging_conversations || 0);
            const frequencia = conta.frequency || 0;

            // Variação CPL e CTR vindas das planilhas (Ontem vs 7 dias)
            const variacaoCPL = radarData?.variacao_cpl || 0;
            const variacaoCTR = radarData?.variacao_ctr || 0;
            
            // Variação de Frequência e CPM (calculadas localmente se não tiver nos dados)
            const variacaoFrequencia = 0; // Placeholder - não temos histórico de frequência
            const variacaoCPM = 0; // Placeholder - não temos histórico de CPM

            // EIXO A: Estado Atual (métricas absolutas)
            const cplRuim = cplAtual > avgCPL * 1.2;
            const ctrRuim = ctrAtual < 1.0;
            const frequenciaRuim = frequencia >= 2.5;
            const estadoProblematico = cplRuim || ctrRuim || frequenciaRuim;

            // EIXO B: Tendência (Ontem vs 7 dias)
            const cplMelhorando = variacaoCPL < -5;  // CPL caindo
            const ctrMelhorando = variacaoCTR > 5;   // CTR subindo
            const frequenciaMelhorando = frequencia < (radarData?.frequency || frequencia);
            const emMelhora = cplMelhorando || ctrMelhorando;

            const cplPiorando = variacaoCPL > 15;
            const ctrPiorando = variacaoCTR < -15;
            const frequenciaPiorando = frequencia > 2.8 && variacaoCTR < -10;
            const emPiora = cplPiorando || ctrPiorando || frequenciaPiorando;

            // Performance Base Score (0-60)
            const cplRatio = avgCPL > 0 ? (avgCPL / (cplAtual || 1)) : 1;
            const cplScore = Math.min(Math.max(cplRatio * 20, 0), 30);
            const leadsScore = leadsOntem > 50 ? 20 : leadsOntem > 20 ? 15 : leadsOntem > 10 ? 10 : leadsOntem > 5 ? 5 : 0;
            const ctrScore = ctrAtual >= 2.0 ? 10 : ctrAtual >= 1.5 ? 7 : ctrAtual >= 1.0 ? 5 : ctrAtual >= 0.5 ? 2 : 0;
            
            let baseScore = cplScore + leadsScore + ctrScore;

            // Ajuste por Tendência (-30 a +30)
            let ajusteTendencia = 0;
            
            if (emMelhora && !emPiora) {
                // Conta melhorando: bônus
                ajusteTendencia = 20;
            } else if (emPiora && !emMelhora) {
                // Conta piorando: penalização
                ajusteTendencia = -25;
            } else if (emMelhora && emPiora) {
                // Sinais mistos: leve penalização
                ajusteTendencia = -5;
            }
            
            // Penalização extra por frequência crítica
            if (frequencia >= 3.2) ajusteTendencia -= 10;
            else if (frequencia >= 2.8) ajusteTendencia -= 5;

            // Impacto Financeiro (0-20)
            const impactoScore = investimento > 10000 ? 20 :
                                investimento > 5000 ? 15 :
                                investimento > 2000 ? 10 :
                                investimento > 1000 ? 5 : 0;

            const radarScore = Math.max(0, Math.min(100, Math.round(baseScore + ajusteTendencia + impactoScore)));

            // PRIORIZAÇÃO BASEADA EM ESTADO + TENDÊNCIA
            let prioridade, prioridadeLabel;

            if (estadoProblematico && emPiora) {
                // REGRA 1: PROBLEMA + PIORA = Crítica
                prioridade = 'critica';
                prioridadeLabel = '🔴 Crítica';
            } else if (estadoProblematico && !emMelhora && !emPiora) {
                // REGRA 2: PROBLEMA + ESTÁVEL = Alta
                prioridade = 'alta';
                prioridadeLabel = '🟠 Alta';
            } else if (estadoProblematico && emMelhora) {
                // REGRA 3: PROBLEMA + MELHORA = Baixa (reduzir prioridade)
                prioridade = 'baixa';
                prioridadeLabel = '🟢 Baixa';
            } else if (!estadoProblematico && emPiora) {
                // REGRA 4: MÉTRICA BOA + PIORA = Média
                prioridade = 'media';
                prioridadeLabel = '🟡 Média';
            } else if (radarScore < 40) {
                prioridade = 'alta';
                prioridadeLabel = '🟠 Alta';
            } else if (radarScore < 70) {
                prioridade = 'media';
                prioridadeLabel = '🟡 Média';
            } else {
                prioridade = 'baixa';
                prioridadeLabel = '🟢 Baixa';
            }

            // STATUS AUTOMÁTICO COM TENDÊNCIA
            let status = '';
            
            if (estadoProblematico && emMelhora) {
                status = 'Indicadores ruins, porém em melhora';
            } else if (!estadoProblematico && emMelhora) {
                status = 'Conta em recuperação - métricas melhorando';
            } else if (frequencia >= 3.2 && ctrPiorando) {
                status = 'Saturação crítica - frequência alta e CTR em queda';
            } else if (frequencia >= 2.8 && emPiora) {
                status = 'Performance em piora - frequência elevada';
            } else if (cplPiorando && ctrPiorando) {
                status = 'Performance em piora - CPL e CTR deteriorando';
            } else if (cplPiorando) {
                status = 'Performance em piora - CPL em alta';
            } else if (ctrPiorando) {
                status = 'Performance em piora - CTR em queda';
            } else if (emPiora) {
                status = 'Performance em piora';
            } else if (estadoProblematico) {
                status = 'Indicadores ruins, estáveis';
            } else if (Math.abs(variacaoCPL) < 10 && frequencia < 2.5) {
                status = 'Estável, sem alertas críticos';
            } else {
                status = 'Dentro dos parâmetros esperados';
            }

            return {
                account_name: conta.account_name,
                cliente,
                radarScore,
                prioridade,
                prioridadeLabel,
                cplAtual,
                cpl7d,
                variacaoCPL,
                leadsOntem,
                frequencia,
                variacaoFrequencia,
                ctrAtual,
                ctr7d,
                variacaoCTR,
                cpmAtual,
                variacaoCPM,
                investimento,
                status
            };
        });
    }, [accounts, clientesMap, radarMetaDataMap]);

    const filteredRadarData = React.useMemo(() => {
        let filtered = radarData;

        if (radarSearchTerm) {
            const search = radarSearchTerm.toLowerCase();
            filtered = filtered.filter(d => 
                d.account_name?.toLowerCase().includes(search) ||
                d.cliente?.cidade?.toLowerCase().includes(search)
            );
        }

        if (radarPrioridadeFilter !== 'all') {
            filtered = filtered.filter(d => d.prioridade === radarPrioridadeFilter);
        }

        return filtered.sort((a, b) => {
            const prioridadeOrder = { critica: 0, alta: 1, media: 2, baixa: 3 };
            const prioCompare = prioridadeOrder[a.prioridade] - prioridadeOrder[b.prioridade];
            if (prioCompare !== 0) return prioCompare;
            return b.investimento - a.investimento;
        });
    }, [radarData, radarSearchTerm, radarPrioridadeFilter]);

    const radarStats = React.useMemo(() => {
        return {
            critica: radarData.filter(d => d.prioridade === 'critica').length,
            alta: radarData.filter(d => d.prioridade === 'alta').length,
            media: radarData.filter(d => d.prioridade === 'media').length,
            baixa: radarData.filter(d => d.prioridade === 'baixa').length
        };
    }, [radarData]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatPercent = (value) => {
        const sign = value > 0 ? '+' : '';
        return `${sign}${value.toFixed(1)}%`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Monitoramento de Contas Meta Ads</h1>
                    <p className="text-slate-500 mt-1">Dados do mês corrente</p>
                </div>
                <Button 
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    className="bg-violet-600 hover:bg-violet-700"
                >
                    <RefreshCw className={cn("w-4 h-4 mr-2", syncMutation.isPending && "animate-spin")} />
                    Sincronizar Planilha
                </Button>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="monitoramento" className="w-full">
                <TabsList className="grid w-full max-w-2xl grid-cols-3">
                    <TabsTrigger value="monitoramento">Monitoramento de Contas</TabsTrigger>
                    <TabsTrigger value="radar">RADAR META</TabsTrigger>
                    <TabsTrigger value="otimizacoes">Histórico de Otimizações</TabsTrigger>
                </TabsList>

                {/* Tab: Monitoramento de Contas */}
                <TabsContent value="monitoramento" className="space-y-6 mt-6">

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500">Total de Contas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-violet-600" />
                            <span className="text-2xl font-bold text-slate-900">{totalContas}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500">Contas P1 (Urgente)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            <span className="text-2xl font-bold text-red-600">{contasP1}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500">Contas CRÍTICO</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            <span className="text-2xl font-bold text-red-600">{contasCritico}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500">Média Nota GPT</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-violet-600" />
                            <span className="text-2xl font-bold text-slate-900">{mediaNotaGPT}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500">Total Investido</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-green-600" />
                            <span className="text-2xl font-bold text-slate-900">
                                R$ {totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500">Distribuição por Classificação</CardTitle>
                    </CardHeader>
                    <CardContent className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={distribuicaoClassificacao} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip 
                                    formatter={(value) => [`${value} contas`, 'Quantidade']}
                                    contentStyle={{ fontSize: 12 }}
                                />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {distribuicaoClassificacao.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Pesquisar por nome da conta..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
                            <SelectTrigger className="w-full md:w-48">
                                <SelectValue placeholder="Prioridade" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas Prioridades</SelectItem>
                                <SelectItem value="P1">P1 - Urgente</SelectItem>
                                <SelectItem value="P2">P2 - Importante</SelectItem>
                                <SelectItem value="P3">P3 - Monitorar</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={classificacaoFilter} onValueChange={setClassificacaoFilter}>
                            <SelectTrigger className="w-full md:w-48">
                                <SelectValue placeholder="Classificação" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas Classificações</SelectItem>
                                <SelectItem value="ELITE">ELITE</SelectItem>
                                <SelectItem value="SAUDÁVEL">SAUDÁVEL</SelectItem>
                                <SelectItem value="OPERACIONAL">OPERACIONAL</SelectItem>
                                <SelectItem value="ALERTA">ALERTA</SelectItem>
                                <SelectItem value="CRÍTICO">CRÍTICO</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Conta</TableHead>
                                    <TableHead className="text-center">Nota GPT</TableHead>
                                    <TableHead>Classificação</TableHead>
                                    <TableHead>Prioridade</TableHead>
                                    <TableHead>Diagnóstico</TableHead>
                                    <TableHead className="text-right">Frequência</TableHead>
                                    <TableHead className="text-right">Leads Rep. %</TableHead>
                                    <TableHead className="text-right">Custo/Conv</TableHead>
                                    <TableHead className="text-right">Investido</TableHead>
                                    <TableHead className="text-right">Conversas</TableHead>
                                    <TableHead className="text-right">Conexões</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAccounts.map((account) => (
                                    <TableRow key={account.id} className="hover:bg-slate-50 cursor-pointer">
                                        <TableCell>
                                            <Link 
                                                to={`${createPageUrl('DetalheConta')}?account=${encodeURIComponent(account.account_name)}`}
                                                className="font-medium text-violet-600 hover:text-violet-800 hover:underline"
                                            >
                                                {account.account_name}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className={cn("px-3 py-1 rounded-full text-sm font-semibold border", getNotaColor(account.nota_gpt))}>
                                                {account.nota_gpt.toFixed(0)}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={getClassificacaoBadge(account.classificacao)}>
                                                {account.classificacao}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={getPrioridadeBadge(account.prioridade)}>
                                                {account.prioridade}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600 max-w-xs truncate">
                                            {account.main_issue}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={account.frequency >= 3.2 ? 'text-red-600 font-semibold' : ''}>
                                                {account.frequency.toFixed(2)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={account.leads_repetidos_percent >= 22 ? 'text-red-600 font-semibold' : ''}>
                                                {account.leads_repetidos_percent.toFixed(1)}%
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={account.cost_per_messaging >= 30 ? 'text-red-600 font-semibold' : ''}>
                                                R$ {account.cost_per_messaging.toFixed(2)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            R$ {account.amount_spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {account.messaging_conversations}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {account.new_messaging_connections}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {filteredAccounts.length === 0 && (
                            <div className="text-center py-12 text-slate-500">
                                {isLoading ? 'Carregando...' : 'Nenhuma conta encontrada'}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
                </TabsContent>

                {/* Tab: RADAR META */}
                <TabsContent value="radar" className="space-y-6 mt-6">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle className="w-8 h-8 text-red-500" />
                                    <div>
                                        <p className="text-2xl font-bold">{radarStats.critica}</p>
                                        <p className="text-sm text-slate-600">Prioridade Crítica</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <TrendingDown className="w-8 h-8 text-orange-500" />
                                    <div>
                                        <p className="text-2xl font-bold">{radarStats.alta}</p>
                                        <p className="text-sm text-slate-600">Prioridade Alta</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <Activity className="w-8 h-8 text-yellow-500" />
                                    <div>
                                        <p className="text-2xl font-bold">{radarStats.media}</p>
                                        <p className="text-sm text-slate-600">Prioridade Média</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <CheckCircle className="w-8 h-8 text-green-500" />
                                    <div>
                                        <p className="text-2xl font-bold">{radarStats.baixa}</p>
                                        <p className="text-sm text-slate-600">Prioridade Baixa</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filters */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex gap-4">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        value={radarSearchTerm}
                                        onChange={(e) => setRadarSearchTerm(e.target.value)}
                                        placeholder="Buscar unidade ou cidade..."
                                        className="pl-10"
                                    />
                                </div>
                                <Select value={radarPrioridadeFilter} onValueChange={setRadarPrioridadeFilter}>
                                    <SelectTrigger className="w-48">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas Prioridades</SelectItem>
                                        <SelectItem value="critica">🔴 Crítica</SelectItem>
                                        <SelectItem value="alta">🟠 Alta</SelectItem>
                                        <SelectItem value="media">🟡 Média</SelectItem>
                                        <SelectItem value="baixa">🟢 Baixa</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Radar Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Painel Executivo - {filteredRadarData.length} Unidades</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[200px]">Unidade</TableHead>
                                            <TableHead className="text-center w-[100px]">Radar Score</TableHead>
                                            <TableHead className="text-center w-[120px]">Prioridade</TableHead>
                                            <TableHead className="text-right">CPL Ontem</TableHead>
                                            <TableHead className="text-right">CPL 7d</TableHead>
                                            <TableHead className="text-right">Δ CPL</TableHead>
                                            <TableHead className="text-right">Freq. Ontem</TableHead>
                                            <TableHead className="text-right">CTR Ontem</TableHead>
                                            <TableHead className="text-right">CTR 7d</TableHead>
                                            <TableHead className="text-right">Δ CTR</TableHead>
                                            <TableHead className="text-right">CPM</TableHead>
                                            <TableHead className="text-right">Leads Ontem</TableHead>
                                            <TableHead className="text-right">Investimento</TableHead>
                                            <TableHead className="w-[250px]">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                       {filteredRadarData.map((row, index) => (
                                           <React.Fragment key={index}>
                                           <TableRow className="hover:bg-slate-50">
                                               <TableCell className="font-medium">
                                                   <div className="flex items-center gap-2">
                                                       <button
                                                           onClick={() => toggleRow(row.account_name, row.cliente)}
                                                           className="text-slate-400 hover:text-slate-600"
                                                       >
                                                           {expandedRows.has(row.account_name) ? (
                                                               <ChevronDown className="w-4 h-4" />
                                                           ) : (
                                                               <ChevronRight className="w-4 h-4" />
                                                           )}
                                                       </button>
                                                       <div>
                                                           <p className="font-semibold text-slate-900">{row.account_name}</p>
                                                           {row.cliente && (
                                                               <p className="text-xs text-slate-500">{row.cliente.cidade}</p>
                                                           )}
                                                       </div>
                                                   </div>
                                               </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center">
                                                        <div className={cn(
                                                            "w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg",
                                                            row.radarScore < 40 ? "bg-red-100 text-red-700" :
                                                            row.radarScore < 60 ? "bg-orange-100 text-orange-700" :
                                                            row.radarScore < 80 ? "bg-yellow-100 text-yellow-700" :
                                                            "bg-green-100 text-green-700"
                                                        )}>
                                                            {row.radarScore}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className={cn(
                                                        "text-sm font-semibold",
                                                        row.prioridade === 'critica' ? "bg-red-100 text-red-800" :
                                                        row.prioridade === 'alta' ? "bg-orange-100 text-orange-800" :
                                                        row.prioridade === 'media' ? "bg-yellow-100 text-yellow-800" :
                                                        "bg-green-100 text-green-800"
                                                    )}>
                                                        {row.prioridadeLabel}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {formatCurrency(row.cplAtual)}
                                                </TableCell>
                                                <TableCell className="text-right text-slate-500">
                                                    {formatCurrency(row.cpl7d)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className={cn(
                                                        "flex items-center justify-end gap-1 font-semibold",
                                                        row.variacaoCPL > 15 ? "text-red-600" :
                                                        row.variacaoCPL > 5 ? "text-orange-600" :
                                                        row.variacaoCPL < -5 ? "text-green-600" :
                                                        "text-slate-600"
                                                    )}>
                                                        {row.variacaoCPL > 0 ? (
                                                            <TrendingUp className="w-4 h-4" />
                                                        ) : row.variacaoCPL < 0 ? (
                                                            <TrendingDown className="w-4 h-4" />
                                                        ) : null}
                                                        {formatPercent(row.variacaoCPL)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className={cn(
                                                        "font-semibold",
                                                        row.frequencia >= 3.2 ? "text-red-600" :
                                                        row.frequencia >= 2.5 ? "text-orange-600" :
                                                        "text-slate-600"
                                                    )}>
                                                        {row.frequencia.toFixed(2)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {row.ctrAtual.toFixed(2)}%
                                                </TableCell>
                                                <TableCell className="text-right text-slate-500">
                                                    {row.ctr7d.toFixed(2)}%
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className={cn(
                                                        "flex items-center justify-end gap-1 font-semibold",
                                                        row.variacaoCTR < -15 ? "text-red-600" :
                                                        row.variacaoCTR < -5 ? "text-orange-600" :
                                                        row.variacaoCTR > 5 ? "text-green-600" :
                                                        "text-slate-600"
                                                    )}>
                                                        {row.variacaoCTR > 0 ? (
                                                            <TrendingUp className="w-4 h-4" />
                                                        ) : row.variacaoCTR < 0 ? (
                                                            <TrendingDown className="w-4 h-4" />
                                                        ) : null}
                                                        {formatPercent(row.variacaoCTR)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(row.cpmAtual)}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {Math.round(row.leadsOntem)}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {formatCurrency(row.investimento)}
                                                </TableCell>
                                                <TableCell>
                                                    <p className="text-sm text-slate-600">{row.status}</p>
                                                </TableCell>
                                            </TableRow>
                                            
                                            {expandedRows.has(row.account_name) && (
                                                <TableRow>
                                                    <TableCell colSpan={14} className="bg-slate-50 p-6">
                                                        {recommendations[row.account_name] ? (
                                                            recommendations[row.account_name].error ? (
                                                                <div className="text-red-600">{recommendations[row.account_name].error}</div>
                                                            ) : (
                                                                <div className="space-y-4">
                                                                    <div className="flex items-center gap-2 mb-4">
                                                                        <Lightbulb className="w-5 h-5 text-amber-500" />
                                                                        <h3 className="font-semibold text-lg">Plano de Ação Recomendado</h3>
                                                                    </div>
                                                                    
                                                                    {recommendations[row.account_name].recommendations?.map((rec, idx) => (
                                                                        <div key={idx} className="bg-white rounded-lg p-4 border border-slate-200">
                                                                            <div className="flex items-start gap-3">
                                                                                <div className={cn(
                                                                                    "px-2 py-1 rounded text-xs font-semibold",
                                                                                    rec.severity === 'critical' ? "bg-red-100 text-red-700" :
                                                                                    rec.severity === 'high' ? "bg-orange-100 text-orange-700" :
                                                                                    rec.severity === 'medium' ? "bg-yellow-100 text-yellow-700" :
                                                                                    "bg-blue-100 text-blue-700"
                                                                                )}>
                                                                                    {rec.severity === 'critical' ? 'CRÍTICO' :
                                                                                     rec.severity === 'high' ? 'ALTO' :
                                                                                     rec.severity === 'medium' ? 'MÉDIO' : 'BAIXO'}
                                                                                </div>
                                                                                <div className="flex-1">
                                                                                    <h4 className="font-semibold text-slate-900 mb-1">{rec.problem}</h4>
                                                                                    <p className="text-sm text-slate-600 mb-3">{rec.diagnosis}</p>
                                                                                    
                                                                                    <div className="space-y-2">
                                                                                        <p className="text-sm font-medium text-slate-700">Ações Sugeridas:</p>
                                                                                        <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                                                                                            {rec.actions?.map((action, actionIdx) => (
                                                                                                <li key={actionIdx}>{action}</li>
                                                                                            ))}
                                                                                        </ul>
                                                                                    </div>
                                                                                    
                                                                                    {rec.expected_impact && (
                                                                                        <div className="mt-3 p-3 bg-green-50 rounded border border-green-200">
                                                                                            <p className="text-sm font-medium text-green-900">Impacto Esperado:</p>
                                                                                            <p className="text-sm text-green-700">{rec.expected_impact}</p>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    
                                                                    {(!recommendations[row.account_name].recommendations || 
                                                                      recommendations[row.account_name].recommendations.length === 0) && (
                                                                        <div className="text-center py-8 text-slate-500">
                                                                            ✅ Nenhuma ação crítica identificada. Conta operando dentro dos parâmetros esperados.
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        ) : (
                                                            <div className="flex items-center justify-center py-8">
                                                                <RefreshCw className="w-5 h-5 animate-spin text-violet-600 mr-2" />
                                                                <span className="text-slate-600">Carregando recomendações...</span>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            </React.Fragment>
                                        ))}
                                    </TableBody>
                                </Table>

                                {filteredRadarData.length === 0 && (
                                    <div className="text-center py-12 text-slate-500">
                                        Nenhuma unidade encontrada com os filtros aplicados
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Legend */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-6 text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <span>Crítica (0-39): Ação imediata</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                                    <span>Alta (40-59): Ajuste prioritário</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                    <span>Média (60-79): Monitorar</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                    <span>Baixa (80-100): Manter</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab: Histórico de Otimizações */}
                <TabsContent value="otimizacoes" className="mt-6">
                    <ListaHistoricoOtimizacoes />
                </TabsContent>
            </Tabs>
        </div>
    );
}