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

    const { data: radarMetaData = [] } = useQuery({
        queryKey: ['radarMetaData'],
        queryFn: () => base44.entities.RadarMetaData.list('-created_date', 500),
        staleTime: 2 * 60 * 1000
    });

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

    // Enriquecer accounts com CPL de ontem e frequência 7d
    const enrichedAccounts = React.useMemo(() => {
        return accounts.map(acc => {
            const radarData = radarMetaDataMap.get(acc.account_name);
            return {
                ...acc,
                cost_per_messaging: radarData?.cpl_ontem || acc.cost_per_messaging || acc.cost_per_new_messaging || 0,
                frequency: radarData?.frequencia_7d || acc.frequency || 0
            };
        });
    }, [accounts, radarMetaDataMap]);

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
    const filteredAccounts = enrichedAccounts
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
    const totalContas = enrichedAccounts.length;
    const contasP1 = enrichedAccounts.filter(acc => acc.prioridade === 'P1').length;
    const contasCritico = enrichedAccounts.filter(acc => acc.classificacao === 'CRÍTICO').length;
    const mediaNotaGPT = enrichedAccounts.length > 0 
        ? (enrichedAccounts.reduce((sum, acc) => sum + acc.nota_gpt, 0) / enrichedAccounts.length).toFixed(1)
        : 0;
    const totalGasto = enrichedAccounts.reduce((sum, acc) => sum + acc.amount_spent, 0);

    // Distribuição por classificação
    const distribuicaoClassificacao = [
        { name: 'CRÍTICO', count: enrichedAccounts.filter(acc => acc.classificacao === 'CRÍTICO').length, color: '#DC2626' },
        { name: 'ALERTA', count: enrichedAccounts.filter(acc => acc.classificacao === 'ALERTA').length, color: '#F97316' },
        { name: 'OPERACIONAL', count: enrichedAccounts.filter(acc => acc.classificacao === 'OPERACIONAL').length, color: '#EAB308' },
        { name: 'SAUDÁVEL', count: enrichedAccounts.filter(acc => acc.classificacao === 'SAUDÁVEL').length, color: '#22C55E' },
        { name: 'ELITE', count: enrichedAccounts.filter(acc => acc.classificacao === 'ELITE').length, color: '#15803D' }
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

    // RADAR META Logic - Recriado do Zero
    const radarData = React.useMemo(() => {
        if (!accounts.length || !radarMetaData.length) return [];

        return radarMetaData.map(radar => {
            const cliente = clientesMap.get(radar.account_name);
            const conta = accounts.find(a => a.account_name === radar.account_name);
            
            // Dados base das planilhas
            const leadsOntem = radar.leads_ontem || 0;
            const leads7d = radar.leads_7d || 0;
            const leadsDia7d = leads7d > 0 ? leads7d / 7 : 0;
            
            const cplAtual = radar.cpl_ontem || 0;
            const cpl7d = radar.cpl_7d || 0;
            
            const ctrAtual = radar.ctr_ontem || 0;
            const ctr7d = radar.ctr_7d || 0;
            
            const frequenciaAtual = radar.frequencia_ontem || conta?.frequency || 0;
            const frequencia7d = radar.frequencia_7d || 0;
            const cpmAtual = conta ? ((conta.amount_spent || 0) / (conta.impressions || 1)) * 1000 : 0;
            const investimentoDiario = conta?.amount_spent ? conta.amount_spent / 30 : 0;
            
            // Variações (Ontem vs 7d)
            const variacaoCPL = radar.variacao_cpl || 0;
            const variacaoCTR = radar.variacao_ctr || 0;
            const variacaoFrequencia = radar.variacao_frequencia || 0;

            // EIXO A: Estado Atual
            // Definir limiares de "bom" vs "ruim"
            const cplRuim = cplAtual > 35; // CPL acima de 35
            const ctrRuim = ctrAtual < 1.0; // CTR abaixo de 1%
            const frequenciaRuim = frequenciaAtual >= 2.5; // Frequência >= 2.5
            
            const estadoAtual = (cplRuim || ctrRuim || frequenciaRuim) ? 'ruim' : 'bom';
            
            // EIXO B: Tendência (>= 2 sinais)
            let sinaisPositivos = 0;
            let sinaisNegativos = 0;
            
            // Sinal 1: CPL
            if (variacaoCPL < -10) sinaisPositivos++;
            else if (variacaoCPL > 15) sinaisNegativos++;
            
            // Sinal 2: CTR
            if (variacaoCTR > 10) sinaisPositivos++;
            else if (variacaoCTR < -15) sinaisNegativos++;
            
            // Sinal 3: Frequência - variação negativa é bom (frequência diminuindo)
            if (variacaoFrequencia < -10) sinaisPositivos++;
            else if (variacaoFrequencia > 15) sinaisNegativos++;
            
            const tendencia = sinaisPositivos >= 2 ? 'melhora' :
                             sinaisNegativos >= 2 ? 'piora' : 'estavel';
            
            // PRIORIZAÇÃO
            let prioridade, prioridadeLabel;
            
            if (estadoAtual === 'ruim' && tendencia === 'piora') {
                prioridade = 'critica';
                prioridadeLabel = '🔴 Crítica';
            } else if (estadoAtual === 'ruim' && tendencia === 'estavel') {
                prioridade = 'alta';
                prioridadeLabel = '🟠 Alta';
            } else if (estadoAtual === 'bom' && tendencia === 'piora') {
                prioridade = 'media';
                prioridadeLabel = '🟡 Média';
            } else if (estadoAtual === 'ruim' && tendencia === 'melhora') {
                prioridade = 'baixa';
                prioridadeLabel = '🟢 Baixa';
            } else {
                prioridade = 'baixa';
                prioridadeLabel = '🟢 Baixa';
            }
            
            // RADAR SCORE (Base 100)
            let radarScore = 100;
            
            // Penalizações por métricas ruins
            if (cplRuim) radarScore -= 20;
            if (ctrRuim) radarScore -= 15;
            if (frequenciaRuim) radarScore -= 15;
            if (frequenciaAtual >= 3.5) radarScore -= 10; // Penalização extra
            
            // Penalização por volume baixo
            if (leadsOntem < 5) radarScore -= 10;
            
            // Ajuste por tendência
            if (tendencia === 'melhora') radarScore += 15;
            else if (tendencia === 'piora') radarScore -= 25;
            
            // Garantir limites
            radarScore = Math.max(0, Math.min(100, radarScore));
            
            // STATUS AUTOMÁTICO (refletindo tendência)
            let status = '';
            
            if (estadoAtual === 'ruim' && tendencia === 'piora') {
                status = '🔴 Crítico: Métricas ruins piorando';
            } else if (estadoAtual === 'ruim' && tendencia === 'estavel') {
                status = '🟠 Atenção: Métricas ruins estáveis';
            } else if (estadoAtual === 'ruim' && tendencia === 'melhora') {
                status = '🟢 Recuperação: Métricas ruins melhorando';
            } else if (estadoAtual === 'bom' && tendencia === 'piora') {
                status = '🟡 Alerta: Métricas boas piorando';
            } else if (estadoAtual === 'bom' && tendencia === 'melhora') {
                status = '✅ Excelente: Métricas boas melhorando';
            } else {
                status = '✓ Estável: Dentro dos parâmetros';
            }
            
            // Detalhes adicionais no status
            const problemas = [];
            if (cplRuim) problemas.push('CPL alto');
            if (ctrRuim) problemas.push('CTR baixo');
            if (frequenciaRuim) problemas.push('Saturação');
            
            if (problemas.length > 0) {
                status += ` (${problemas.join(', ')})`;
            }

            return {
                account_name: radar.account_name,
                cliente,
                radarScore,
                prioridade,
                prioridadeLabel,
                estadoAtual,
                tendencia,
                leadsOntem,
                leadsDia7d: leadsDia7d.toFixed(1),
                cplAtual,
                cpl7d,
                variacaoCPL,
                ctrAtual,
                ctr7d,
                variacaoCTR,
                cpmAtual,
                frequenciaAtual,
                frequencia7d,
                variacaoFrequencia,
                investimentoDiario,
                status
            };
        }).filter(d => d.cliente); // Apenas contas com cliente cadastrado
    }, [radarMetaData, accounts, clientesMap]);

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
                                            <TableHead className="text-right">Leads Ontem</TableHead>
                                            <TableHead className="text-right">Leads/dia (7d)</TableHead>
                                            <TableHead className="text-right">CPL Atual</TableHead>
                                            <TableHead className="text-right">Δ CPL</TableHead>
                                            <TableHead className="text-right">CTR Atual</TableHead>
                                            <TableHead className="text-right">Δ CTR</TableHead>
                                            <TableHead className="text-right">CPM</TableHead>
                                            <TableHead className="text-right">Freq. Atual</TableHead>
                                            <TableHead className="text-right">Δ Freq.</TableHead>
                                            <TableHead className="text-right">Inv. Diário</TableHead>
                                            <TableHead className="w-[280px]">Status</TableHead>
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
                                                <TableCell className="text-right font-bold text-lg">
                                                    {Math.round(row.leadsOntem)}
                                                </TableCell>
                                                <TableCell className="text-right text-slate-600">
                                                    {row.leadsDia7d}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {formatCurrency(row.cplAtual)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className={cn(
                                                        "flex items-center justify-end gap-1 font-semibold",
                                                        row.variacaoCPL > 15 ? "text-red-600" :
                                                        row.variacaoCPL > 5 ? "text-orange-600" :
                                                        row.variacaoCPL < -10 ? "text-green-600" :
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
                                                <TableCell className="text-right font-medium">
                                                    {row.ctrAtual.toFixed(2)}%
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className={cn(
                                                        "flex items-center justify-end gap-1 font-semibold",
                                                        row.variacaoCTR < -15 ? "text-red-600" :
                                                        row.variacaoCTR < -5 ? "text-orange-600" :
                                                        row.variacaoCTR > 10 ? "text-green-600" :
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
                                                <TableCell className="text-right">
                                                    <span className={cn(
                                                        "font-semibold",
                                                        row.frequenciaAtual >= 3.5 ? "text-red-600" :
                                                        row.frequenciaAtual >= 2.5 ? "text-orange-600" :
                                                        "text-slate-600"
                                                    )}>
                                                        {row.frequenciaAtual.toFixed(2)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className={cn(
                                                        "flex items-center justify-end gap-1 font-semibold",
                                                        row.variacaoFrequencia > 15 ? "text-red-600" :
                                                        row.variacaoFrequencia > 5 ? "text-orange-600" :
                                                        row.variacaoFrequencia < -10 ? "text-green-600" :
                                                        "text-slate-600"
                                                    )}>
                                                        {row.variacaoFrequencia > 0 ? (
                                                            <TrendingUp className="w-4 h-4" />
                                                        ) : row.variacaoFrequencia < 0 ? (
                                                            <TrendingDown className="w-4 h-4" />
                                                        ) : null}
                                                        {formatPercent(row.variacaoFrequencia)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {formatCurrency(row.investimentoDiario)}
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
                            <div className="space-y-3">
                                <h3 className="font-semibold text-slate-900">Metodologia do RADAR META:</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="font-medium mb-1">Priorização:</p>
                                        <ul className="space-y-1 text-slate-600">
                                            <li>🔴 <strong>Crítica</strong>: Métricas ruins + Piora (Ação imediata)</li>
                                            <li>🟠 <strong>Alta</strong>: Métricas ruins + Estável (Ajuste prioritário)</li>
                                            <li>🟡 <strong>Média</strong>: Métricas boas + Piora (Monitorar tendência)</li>
                                            <li>🟢 <strong>Baixa</strong>: Métricas ruins + Melhora (Manter recuperação)</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="font-medium mb-1">Critérios de Tendência:</p>
                                        <ul className="space-y-1 text-slate-600">
                                            <li>✅ <strong>Melhora</strong>: ≥2 sinais positivos (CPL caindo, CTR subindo, etc.)</li>
                                            <li>⚠️ <strong>Piora</strong>: ≥2 sinais negativos (CPL subindo, CTR caindo, etc.)</li>
                                            <li>➡️ <strong>Estável</strong>: Menos de 2 sinais em qualquer direção</li>
                                        </ul>
                                    </div>
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