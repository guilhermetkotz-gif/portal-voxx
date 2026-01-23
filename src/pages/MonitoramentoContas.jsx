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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend, ScatterChart, Scatter, ZAxis } from 'recharts';
import ListaHistoricoOtimizacoes from '@/components/metaads/ListaHistoricoOtimizacoes';
import AdicionarOtimizacaoModal from '@/components/metaads/AdicionarOtimizacaoModal';

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
    const [previsoes, setPrevisoes] = useState({});
    const [loadingPrevisoes, setLoadingPrevisoes] = useState({});
    const [otimizacaoModalOpen, setOtimizacaoModalOpen] = useState(false);
    const [selectedAccountForOtimizacao, setSelectedAccountForOtimizacao] = useState(null);

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

    const loadPrevisao = async (accountName) => {
        if (previsoes[accountName] || loadingPrevisoes[accountName]) return;

        setLoadingPrevisoes(prev => ({ ...prev, [accountName]: true }));

        try {
            const response = await base44.functions.invoke('gerarPrevisaoPerformance', {
                account_name: accountName,
                horizon: 7
            });
            
            setPrevisoes(prev => ({
                ...prev,
                [accountName]: response.data
            }));
        } catch (error) {
            console.error('Erro ao carregar previsão:', error);
            setPrevisoes(prev => ({
                ...prev,
                [accountName]: { error: 'Erro ao gerar previsão' }
            }));
        } finally {
            setLoadingPrevisoes(prev => ({ ...prev, [accountName]: false }));
        }
    };

    const toggleRow = (accountName, cliente) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(accountName)) {
            newExpanded.delete(accountName);
        } else {
            newExpanded.add(accountName);
            loadRecommendation(accountName, cliente);
            loadPrevisao(accountName);
        }
        setExpandedRows(newExpanded);
    };

    const clientesMap = React.useMemo(() => {
        return new Map(clientes.map(c => [c.nome, c]));
    }, [clientes]);

    const radarMetaDataMap = React.useMemo(() => {
        return new Map(radarMetaData.map(r => [r.account_name, r]));
    }, [radarMetaData]);

    // Enriquecer accounts com frequência 7d (cost_per_messaging usa dados da página 1)
    const enrichedAccounts = React.useMemo(() => {
        return accounts.map(acc => {
            const radarData = radarMetaDataMap.get(acc.account_name);
            return {
                ...acc,
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
            
            // ========== DADOS BASE ==========
            const leadsOntem = radar.leads_ontem || 0;
            const leads7d = radar.leads_7d || 0;
            const leadsDia7d = leads7d > 0 ? leads7d / 7 : 0;

            const cplAtual = radar.cpl_ontem || 0;
            const cpl7d = radar.cpl_7d || 0;

            const ctrAtual = radar.ctr_ontem || 0;
            const ctr7d = radar.ctr_7d || 0;

            const frequenciaOntem = radar.frequencia_ontem || 0;
            const frequencia7d = radar.frequencia_7d || 0;

            const cpmAtual = conta ? ((conta.amount_spent || 0) / (conta.impressions || 1)) * 1000 : 0;
            const investimentoDiario = conta?.amount_spent ? conta.amount_spent / 30 : 0;

            // Variações (Ontem vs 7d)
            const variacaoCPL = radar.variacao_cpl || 0;
            const variacaoCTR = radar.variacao_ctr || 0;

            // ========== EIXO 1: RISCO (0-100) ==========
            let riscoScore = 100;

            // Penalizar CPL alto
            if (cplAtual > 50) riscoScore -= 40;
            else if (cplAtual > 35) riscoScore -= 25;
            else if (cplAtual > 25) riscoScore -= 15;

            // Penalizar CTR baixo
            if (ctrAtual < 0.5) riscoScore -= 30;
            else if (ctrAtual < 1.0) riscoScore -= 20;
            else if (ctrAtual < 1.5) riscoScore -= 10;

            // Penalizar Frequência
            if (frequencia7d >= 3.0) riscoScore -= 35;
            else if (frequencia7d >= 2.5) riscoScore -= 20;
            else if (frequencia7d >= 1.8) riscoScore -= 5;
            else riscoScore += 10; // Bonus para < 1.8

            riscoScore = Math.max(0, Math.min(100, riscoScore));

            // ========== EIXO 2: TENDÊNCIA (0-100) ==========
            let tendenciaScore = 50; // Base neutra

            // CPL: melhorando vs piorando
            if (cplAtual < cpl7d * 0.9) tendenciaScore += 10; // CPL caiu 10%+
            else if (cplAtual > cpl7d * 1.1) tendenciaScore -= 10; // CPL subiu 10%+

            // CTR: melhorando vs piorando
            if (ctrAtual > ctr7d * 1.1) tendenciaScore += 10; // CTR subiu 10%+
            else if (ctrAtual < ctr7d * 0.9) tendenciaScore -= 10; // CTR caiu 10%+

            // Leads/dia: melhorando vs piorando
            if (leadsOntem > leadsDia7d * 1.2) tendenciaScore += 10; // +20% leads
            else if (leadsOntem < leadsDia7d * 0.7) tendenciaScore -= 10; // -30% leads

            // Frequência: melhorando vs piorando
            if (frequenciaOntem < frequencia7d * 0.9) tendenciaScore += 10; // Freq caiu
            else if (frequenciaOntem > frequencia7d * 1.1) tendenciaScore -= 10; // Freq subiu

            tendenciaScore = Math.max(0, Math.min(100, tendenciaScore));

            // ========== EIXO 3: IMPACTO (0-100) ==========
            let impactoScore = 0;

            // Componente 1: Leads/dia (peso maior)
            if (leadsDia7d >= 30) impactoScore += 50;
            else if (leadsDia7d >= 20) impactoScore += 40;
            else if (leadsDia7d >= 10) impactoScore += 30;
            else if (leadsDia7d >= 5) impactoScore += 20;
            else impactoScore += 10;

            // Componente 2: Investimento diário
            if (investimentoDiario >= 500) impactoScore += 50;
            else if (investimentoDiario >= 300) impactoScore += 40;
            else if (investimentoDiario >= 200) impactoScore += 30;
            else if (investimentoDiario >= 100) impactoScore += 20;
            else impactoScore += 10;

            impactoScore = Math.max(0, Math.min(100, impactoScore));

            // ========== RADAR SCORE FINAL ==========
            const radarScore = Math.round(
                (riscoScore * 0.4) + (tendenciaScore * 0.3) + (impactoScore * 0.3)
            );

            // ========== PRIORIDADE ==========
            let prioridade, prioridadeLabel;

            if (radarScore <= 30) {
                prioridade = 'critica';
                prioridadeLabel = '🔴 Crítica';
            } else if (radarScore <= 50) {
                prioridade = 'alta';
                prioridadeLabel = '🟠 Alta';
            } else if (radarScore <= 70) {
                prioridade = 'media';
                prioridadeLabel = '🟡 Média';
            } else {
                prioridade = 'baixa';
                prioridadeLabel = '🟢 Baixa';
            }

            // ========== STATUS DESCRITIVO ==========
            let status = '';
            const problemas = [];

            // Identificar problemas principais
            if (cplAtual > 35) problemas.push('CPL elevado');
            if (ctrAtual < 1.0) problemas.push('CTR baixo');
            if (frequencia7d >= 3.0) problemas.push('Saturação crítica');
            else if (frequencia7d >= 2.5) problemas.push('Saturação moderada');
            if (leadsOntem < leadsDia7d * 0.7) problemas.push('Queda de leads');

            // Construir status baseado em risco + tendência
            if (riscoScore < 40) {
                if (tendenciaScore < 40) {
                    status = '🔴 CRÍTICO: Alto risco e piorando';
                } else if (tendenciaScore > 60) {
                    status = '🟠 RECUPERAÇÃO: Alto risco mas melhorando';
                } else {
                    status = '🔴 ATENÇÃO: Alto risco estável';
                }
            } else if (riscoScore < 60) {
                if (tendenciaScore < 40) {
                    status = '🟠 ALERTA: Performance média piorando';
                } else if (tendenciaScore > 60) {
                    status = '🟢 MELHORA: Performance média subindo';
                } else {
                    status = '🟡 ESTÁVEL: Performance moderada';
                }
            } else {
                if (tendenciaScore < 40) {
                    status = '🟡 MONITORAR: Performance boa mas caindo';
                } else if (tendenciaScore > 60) {
                    status = '✅ EXCELENTE: Performance ótima e melhorando';
                } else {
                    status = '✓ SAUDÁVEL: Performance boa e estável';
                }
            }

            if (problemas.length > 0) {
                status += ` (${problemas.join(', ')})`;
            }

            // ========== PREVISÃO 7 DIAS ==========
            // Projeções lineares baseadas na tendência atual
            const taxaCPL = cpl7d > 0 ? (cplAtual - cpl7d) / cpl7d : 0;
            const taxaCTR = ctr7d > 0 ? (ctrAtual - ctr7d) / ctr7d : 0;
            const taxaLeads = leadsDia7d > 0 ? (leadsOntem - leadsDia7d) / leadsDia7d : 0;
            const taxaFreq = frequencia7d > 0 ? (frequenciaOntem - frequencia7d) / frequencia7d : 0;

            const cplPrevisao = cplAtual * (1 + taxaCPL * 0.5); // Amortizado
            const ctrPrevisao = ctrAtual * (1 + taxaCTR * 0.5);
            const leadsPrevisao = leadsOntem * (1 + taxaLeads * 0.5);
            const freqPrevisao = frequencia7d * (1 + taxaFreq * 0.5);

            // Projetar novo Radar Score
            let riscoPrevisao = 100;
            if (cplPrevisao > 50) riscoPrevisao -= 40;
            else if (cplPrevisao > 35) riscoPrevisao -= 25;
            else if (cplPrevisao > 25) riscoPrevisao -= 15;

            if (ctrPrevisao < 0.5) riscoPrevisao -= 30;
            else if (ctrPrevisao < 1.0) riscoPrevisao -= 20;
            else if (ctrPrevisao < 1.5) riscoPrevisao -= 10;

            if (freqPrevisao >= 3.0) riscoPrevisao -= 35;
            else if (freqPrevisao >= 2.5) riscoPrevisao -= 20;
            else if (freqPrevisao >= 1.8) riscoPrevisao -= 5;
            else riscoPrevisao += 10;

            riscoPrevisao = Math.max(0, Math.min(100, riscoPrevisao));

            const radarScorePrevisao = Math.round(
                (riscoPrevisao * 0.4) + (tendenciaScore * 0.3) + (impactoScore * 0.3)
            );

            return {
                account_name: radar.account_name,
                cliente,
                radarScore,
                riscoScore,
                tendenciaScore,
                impactoScore,
                prioridade,
                prioridadeLabel,
                leadsOntem,
                leadsDia7d: leadsDia7d.toFixed(1),
                cplAtual,
                cpl7d,
                variacaoCPL,
                ctrAtual,
                ctr7d,
                variacaoCTR,
                cpmAtual,
                frequencia7d,
                investimentoDiario,
                status,
                // Previsões
                forecast: {
                    radarScore: radarScorePrevisao,
                    cpl: cplPrevisao,
                    ctr: ctrPrevisao,
                    leads: leadsPrevisao,
                    frequencia: freqPrevisao,
                    delta: radarScorePrevisao - radarScore
                }
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
            // 1. Prioridade
            const prioridadeOrder = { critica: 0, alta: 1, media: 2, baixa: 3 };
            const prioCompare = prioridadeOrder[a.prioridade] - prioridadeOrder[b.prioridade];
            if (prioCompare !== 0) return prioCompare;

            // 2. Radar Score (ascendente - piores primeiro)
            if (a.radarScore !== b.radarScore) return a.radarScore - b.radarScore;

            // 3. Impacto (descendente - maior impacto primeiro)
            if (a.impactoScore !== b.impactoScore) return b.impactoScore - a.impactoScore;

            // 4. Investimento diário (descendente)
            return b.investimentoDiario - a.investimentoDiario;
        });
    }, [radarData, radarSearchTerm, radarPrioridadeFilter]);

    const radarStats = React.useMemo(() => {
        const totalContas = radarData.length;
        const avgCPL = totalContas > 0 ? radarData.reduce((sum, d) => sum + d.cplAtual, 0) / totalContas : 0;
        const avgCTR = totalContas > 0 ? radarData.reduce((sum, d) => sum + d.ctrAtual, 0) / totalContas : 0;
        const avgFreq = totalContas > 0 ? radarData.reduce((sum, d) => sum + d.frequencia7d, 0) / totalContas : 0;
        const avgRadarScore = totalContas > 0 ? radarData.reduce((sum, d) => sum + d.radarScore, 0) / totalContas : 0;
        const totalInvestimento = radarData.reduce((sum, d) => sum + d.investimentoDiario, 0);
        const totalLeads = radarData.reduce((sum, d) => sum + parseFloat(d.leadsDia7d), 0);

        // Top melhorias e pioras (baseado em tendenciaScore)
        const sorted = [...radarData].sort((a, b) => b.tendenciaScore - a.tendenciaScore);
        const topMelhorias = sorted.slice(0, 5);
        const topPioras = sorted.slice(-5).reverse();

        return {
            critica: radarData.filter(d => d.prioridade === 'critica').length,
            alta: radarData.filter(d => d.prioridade === 'alta').length,
            media: radarData.filter(d => d.prioridade === 'media').length,
            baixa: radarData.filter(d => d.prioridade === 'baixa').length,
            avgCPL,
            avgCTR,
            avgFreq,
            avgRadarScore,
            totalInvestimento,
            totalLeads,
            topMelhorias,
            topPioras
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
                    {/* Dashboard Executivo */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-slate-500">Radar Score Médio</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-violet-600" />
                                    <span className="text-2xl font-bold text-slate-900">{radarStats.avgRadarScore.toFixed(0)}</span>
                                    <span className="text-sm text-slate-500">/100</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-slate-500">CPL Médio</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2">
                                    <DollarSign className="w-5 h-5 text-green-600" />
                                    <span className="text-2xl font-bold text-slate-900">{formatCurrency(radarStats.avgCPL)}</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-slate-500">CTR Médio</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2">
                                    <Target className="w-5 h-5 text-blue-600" />
                                    <span className="text-2xl font-bold text-slate-900">{radarStats.avgCTR.toFixed(2)}%</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-slate-500">Frequência Média</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-orange-600" />
                                    <span className={cn(
                                        "text-2xl font-bold",
                                        radarStats.avgFreq > 3.0 ? "text-red-600" :
                                        radarStats.avgFreq >= 2.5 ? "text-orange-600" :
                                        radarStats.avgFreq >= 1.8 ? "text-green-600" :
                                        "text-green-700"
                                    )}>{radarStats.avgFreq.toFixed(2)}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Gráficos de Tendência do Portfólio */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="pb-2 pt-4">
                                <CardTitle className="text-xs font-medium">Top 10 Contas: CPL Maior Variação</CardTitle>
                            </CardHeader>
                            <CardContent className="h-40 pt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart 
                                        data={[...radarData]
                                            .sort((a, b) => Math.abs(b.variacaoCPL) - Math.abs(a.variacaoCPL))
                                            .slice(0, 10)
                                            .map(d => ({ 
                                                name: d.account_name.substring(0, 12), 
                                                variacao: d.variacaoCPL,
                                                cplAtual: d.cplAtual
                                            }))}
                                        layout="vertical"
                                        margin={{ left: 60, right: 10, top: 5, bottom: 5 }}
                                    >
                                        <XAxis type="number" tick={{ fontSize: 9 }} />
                                        <YAxis dataKey="name" type="category" tick={{ fontSize: 8 }} width={60} />
                                        <Tooltip 
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    return (
                                                        <div className="bg-white p-2 border border-slate-200 rounded shadow-lg text-xs">
                                                            <p className="font-semibold">{data.name}</p>
                                                            <p className={data.variacao > 0 ? "text-red-600" : "text-green-600"}>
                                                                Variação: {formatPercent(data.variacao)}
                                                            </p>
                                                            <p>CPL Atual: {formatCurrency(data.cplAtual)}</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="variacao" radius={[0, 4, 4, 0]}>
                                            {[...radarData]
                                                .sort((a, b) => Math.abs(b.variacaoCPL) - Math.abs(a.variacaoCPL))
                                                .slice(0, 10)
                                                .map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.variacaoCPL > 0 ? '#DC2626' : '#10B981'} />
                                                ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2 pt-4">
                                <CardTitle className="text-xs font-medium">Top 10 Contas: CTR Maior Variação</CardTitle>
                            </CardHeader>
                            <CardContent className="h-40 pt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart 
                                        data={[...radarData]
                                            .sort((a, b) => Math.abs(b.variacaoCTR) - Math.abs(a.variacaoCTR))
                                            .slice(0, 10)
                                            .map(d => ({ 
                                                name: d.account_name.substring(0, 12), 
                                                variacao: d.variacaoCTR,
                                                ctrAtual: d.ctrAtual
                                            }))}
                                        layout="vertical"
                                        margin={{ left: 60, right: 10, top: 5, bottom: 5 }}
                                    >
                                        <XAxis type="number" tick={{ fontSize: 9 }} />
                                        <YAxis dataKey="name" type="category" tick={{ fontSize: 8 }} width={60} />
                                        <Tooltip 
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    return (
                                                        <div className="bg-white p-2 border border-slate-200 rounded shadow-lg text-xs">
                                                            <p className="font-semibold">{data.name}</p>
                                                            <p className={data.variacao < 0 ? "text-red-600" : "text-green-600"}>
                                                                Variação: {formatPercent(data.variacao)}
                                                            </p>
                                                            <p>CTR Atual: {data.ctrAtual.toFixed(2)}%</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="variacao" radius={[0, 4, 4, 0]}>
                                            {[...radarData]
                                                .sort((a, b) => Math.abs(b.variacaoCTR) - Math.abs(a.variacaoCTR))
                                                .slice(0, 10)
                                                .map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.variacaoCTR < 0 ? '#DC2626' : '#10B981'} />
                                                ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2 pt-4">
                                <CardTitle className="text-xs font-medium">Contas por Faixa de Frequência</CardTitle>
                            </CardHeader>
                            <CardContent className="h-40 pt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart 
                                        data={[
                                            { range: 'Ótima\n< 1.8', count: radarData.filter(d => d.frequencia7d < 1.8).length, color: '#059669', label: 'Ótima' },
                                            { range: 'Boa\n1.8-2.5', count: radarData.filter(d => d.frequencia7d >= 1.8 && d.frequencia7d < 2.5).length, color: '#22C55E', label: 'Boa' },
                                            { range: 'Alerta\n2.5-3.0', count: radarData.filter(d => d.frequencia7d >= 2.5 && d.frequencia7d < 3.0).length, color: '#F97316', label: 'Alerta' },
                                            { range: 'Crítica\n≥ 3.0', count: radarData.filter(d => d.frequencia7d >= 3.0).length, color: '#DC2626', label: 'Crítica' }
                                        ]}
                                        margin={{ top: 5, right: 5, left: 5, bottom: 25 }}
                                    >
                                        <XAxis 
                                            dataKey="range" 
                                            tick={{ fontSize: 9 }}
                                            interval={0}
                                        />
                                        <YAxis tick={{ fontSize: 9 }} />
                                        <Tooltip 
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    return (
                                                        <div className="bg-white p-2 border border-slate-200 rounded shadow-lg text-xs">
                                                            <p className="font-semibold">{data.label}</p>
                                                            <p>{data.count} contas</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="count" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 10, fontWeight: 'bold' }}>
                                            {[
                                                { range: 'Ótima\n< 1.8', count: radarData.filter(d => d.frequencia7d < 1.8).length, color: '#059669' },
                                                { range: 'Boa\n1.8-2.5', count: radarData.filter(d => d.frequencia7d >= 1.8 && d.frequencia7d < 2.5).length, color: '#22C55E' },
                                                { range: 'Alerta\n2.5-3.0', count: radarData.filter(d => d.frequencia7d >= 2.5 && d.frequencia7d < 3.0).length, color: '#F97316' },
                                                { range: 'Crítica\n≥ 3.0', count: radarData.filter(d => d.frequencia7d >= 3.0).length, color: '#DC2626' }
                                            ].map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Mapa de Calor e Distribuição */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader className="pb-2 pt-4">
                                <CardTitle className="flex items-center gap-2 text-sm">
                                    <Target className="w-4 h-4 text-violet-600" />
                                    Mapa de Risco: Score vs Impacto
                                </CardTitle>
                                <p className="text-xs text-slate-600">Menor score + maior impacto = maior prioridade</p>
                            </CardHeader>
                            <CardContent className="h-64 pt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
                                    <XAxis 
                                        type="number" 
                                        dataKey="radarScore" 
                                        name="Radar Score" 
                                        label={{ value: 'Radar Score', position: 'bottom', offset: 40 }}
                                        domain={[0, 100]}
                                    />
                                    <YAxis 
                                        type="number" 
                                        dataKey="impactoScore" 
                                        name="Impacto" 
                                        label={{ value: 'Score de Impacto', angle: -90, position: 'left' }}
                                        domain={[0, 100]}
                                    />
                                    <ZAxis 
                                        type="number" 
                                        dataKey="investimentoDiario" 
                                        range={[50, 400]} 
                                        name="Investimento"
                                    />
                                    <Tooltip 
                                        cursor={{ strokeDasharray: '3 3' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
                                                        <p className="font-semibold text-slate-900">{data.account_name}</p>
                                                        <p className="text-sm text-slate-600">{data.cliente?.cidade}</p>
                                                        <div className="mt-2 space-y-1 text-xs">
                                                            <p><strong>Radar Score:</strong> {data.radarScore}</p>
                                                            <p><strong>Impacto:</strong> {data.impactoScore}</p>
                                                            <p><strong>Investimento:</strong> {formatCurrency(data.investimentoDiario)}/dia</p>
                                                            <p><strong>Prioridade:</strong> {data.prioridadeLabel}</p>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Legend />
                                    <Scatter 
                                        name="Contas" 
                                        data={radarData} 
                                        fill="#8B5CF6"
                                    >
                                        {radarData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={
                                                    entry.prioridade === 'critica' ? '#DC2626' :
                                                    entry.prioridade === 'alta' ? '#F97316' :
                                                    entry.prioridade === 'media' ? '#EAB308' :
                                                    '#22C55E'
                                                }
                                            />
                                        ))}
                                    </Scatter>
                                </ScatterChart>
                            </ResponsiveContainer>
                            <div className="mt-2 flex gap-3 justify-center text-xs">
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-red-600"></div>
                                    <span>Crítica</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                    <span>Alta</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                    <span>Média</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    <span>Baixa</span>
                                </div>
                            </div>
                        </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2 pt-4">
                                <CardTitle className="flex items-center gap-2 text-sm">
                                    <Activity className="w-4 h-4 text-violet-600" />
                                    Distribuição de Radar Scores
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-64 pt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[
                                    { range: '0-20 (Crítico)', count: radarData.filter(d => d.radarScore <= 20).length, color: '#7F1D1D' },
                                    { range: '21-40 (Alto Risco)', count: radarData.filter(d => d.radarScore > 20 && d.radarScore <= 40).length, color: '#DC2626' },
                                    { range: '41-60 (Moderado)', count: radarData.filter(d => d.radarScore > 40 && d.radarScore <= 60).length, color: '#F97316' },
                                    { range: '61-80 (Bom)', count: radarData.filter(d => d.radarScore > 60 && d.radarScore <= 80).length, color: '#EAB308' },
                                    { range: '81-100 (Excelente)', count: radarData.filter(d => d.radarScore > 80).length, color: '#22C55E' }
                                ]}>
                                    <XAxis dataKey="range" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={80} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                        {[
                                            { range: '0-20 (Crítico)', count: radarData.filter(d => d.radarScore <= 20).length, color: '#7F1D1D' },
                                            { range: '21-40 (Alto Risco)', count: radarData.filter(d => d.radarScore > 20 && d.radarScore <= 40).length, color: '#DC2626' },
                                            { range: '41-60 (Moderado)', count: radarData.filter(d => d.radarScore > 40 && d.radarScore <= 60).length, color: '#F97316' },
                                            { range: '61-80 (Bom)', count: radarData.filter(d => d.radarScore > 60 && d.radarScore <= 80).length, color: '#EAB308' },
                                            { range: '81-100 (Excelente)', count: radarData.filter(d => d.radarScore > 80).length, color: '#22C55E' }
                                        ].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                        </Card>
                    </div>

                    {/* Distribuição de Prioridades */}
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

                    {/* Top Melhorias e Pioras */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-green-600" />
                                    Top 5 Melhorias (Tendência)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {radarStats.topMelhorias.map((conta, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                                            <div className="flex-1">
                                                <Link 
                                                    to={`${createPageUrl('DetalheConta')}?account=${encodeURIComponent(conta.account_name)}`}
                                                    className="font-medium text-green-900 hover:text-green-700 hover:underline"
                                                >
                                                    {conta.account_name}
                                                </Link>
                                                <p className="text-xs text-green-700 mt-1">{conta.cliente?.cidade}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-green-700">{conta.tendenciaScore}</p>
                                                <p className="text-xs text-green-600">Tendência</p>
                                            </div>
                                        </div>
                                    ))}
                                    {radarStats.topMelhorias.length === 0 && (
                                        <p className="text-center text-slate-500 py-4">Nenhuma conta disponível</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingDown className="w-5 h-5 text-red-600" />
                                    Top 5 Pioras (Tendência)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {radarStats.topPioras.map((conta, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                                            <div className="flex-1">
                                                <Link 
                                                    to={`${createPageUrl('DetalheConta')}?account=${encodeURIComponent(conta.account_name)}`}
                                                    className="font-medium text-red-900 hover:text-red-700 hover:underline"
                                                >
                                                    {conta.account_name}
                                                </Link>
                                                <p className="text-xs text-red-700 mt-1">{conta.cliente?.cidade}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-red-700">{conta.tendenciaScore}</p>
                                                <p className="text-xs text-red-600">Tendência</p>
                                            </div>
                                        </div>
                                    ))}
                                    {radarStats.topPioras.length === 0 && (
                                        <p className="text-center text-slate-500 py-4">Nenhuma conta disponível</p>
                                    )}
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
                                            <TableHead className="text-right">Frequência (7d)</TableHead>
                                            <TableHead className="text-right">Inv. Diário</TableHead>
                                            <TableHead className="w-[280px]">Status</TableHead>
                                            <TableHead className="text-center w-[120px]">Previsão 7d</TableHead>
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
                                                        "font-semibold px-2 py-1 rounded",
                                                        row.frequencia7d > 3.0 ? "text-red-600" :
                                                        row.frequencia7d >= 2.5 ? "text-orange-600" :
                                                        row.frequencia7d >= 1.8 ? "text-green-600" :
                                                        "text-white bg-green-400"
                                                    )}>
                                                        {row.frequencia7d.toFixed(2)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {formatCurrency(row.investimentoDiario)}
                                                </TableCell>
                                                <TableCell>
                                                    <p className="text-sm text-slate-600">{row.status}</p>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className={cn(
                                                            "text-lg font-bold",
                                                            row.forecast.delta > 10 ? "text-green-600" :
                                                            row.forecast.delta < -10 ? "text-red-600" :
                                                            "text-slate-600"
                                                        )}>
                                                            {row.forecast.radarScore}
                                                        </span>
                                                        <div className={cn(
                                                            "flex items-center gap-1 text-xs font-semibold",
                                                            row.forecast.delta > 0 ? "text-green-600" :
                                                            row.forecast.delta < 0 ? "text-red-600" :
                                                            "text-slate-400"
                                                        )}>
                                                            {row.forecast.delta > 0 ? (
                                                                <TrendingUp className="w-3 h-3" />
                                                            ) : row.forecast.delta < 0 ? (
                                                                <TrendingDown className="w-3 h-3" />
                                                            ) : null}
                                                            {row.forecast.delta > 0 ? '+' : ''}{row.forecast.delta}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                </TableRow>
                                            
                                            {expandedRows.has(row.account_name) && (
                                                <TableRow>
                                                    <TableCell colSpan={14} className="bg-slate-50 p-6">
                                                        {/* Previsão IA */}
                                                        {previsoes[row.account_name] && !previsoes[row.account_name].error ? (
                                                                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200">
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <Activity className="w-5 h-5 text-indigo-600" />
                                                                        <h3 className="font-semibold text-lg text-indigo-900">Previsão IA - Próximos 7 Dias</h3>
                                                                        <Badge className={cn(
                                                                            "ml-auto",
                                                                            previsoes[row.account_name].confianca_geral === 'alta' ? "bg-green-100 text-green-800" :
                                                                            previsoes[row.account_name].confianca_geral === 'media' ? "bg-yellow-100 text-yellow-800" :
                                                                            "bg-red-100 text-red-800"
                                                                        )}>
                                                                            Confiança: {previsoes[row.account_name].confianca_geral}
                                                                        </Badge>
                                                                    </div>
                                                                    
                                                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                                                                        <div className="bg-white rounded p-3">
                                                                            <p className="text-xs text-slate-500 mb-1">CPL Previsto</p>
                                                                            <p className="text-lg font-bold text-slate-900">
                                                                                {formatCurrency(previsoes[row.account_name].previsoes.cpl.valor_previsto)}
                                                                            </p>
                                                                            <div className="flex items-center gap-1 text-xs mt-1">
                                                                                {previsoes[row.account_name].previsoes.cpl.tendencia === 'alta' ? (
                                                                                    <TrendingUp className="w-3 h-3 text-red-600" />
                                                                                ) : previsoes[row.account_name].previsoes.cpl.tendencia === 'baixa' ? (
                                                                                    <TrendingDown className="w-3 h-3 text-green-600" />
                                                                                ) : null}
                                                                                <span className={
                                                                                    previsoes[row.account_name].previsoes.cpl.tendencia === 'alta' ? "text-red-600" :
                                                                                    previsoes[row.account_name].previsoes.cpl.tendencia === 'baixa' ? "text-green-600" :
                                                                                    "text-slate-600"
                                                                                }>
                                                                                    {previsoes[row.account_name].previsoes.cpl.tendencia}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="bg-white rounded p-3">
                                                                            <p className="text-xs text-slate-500 mb-1">CTR Previsto</p>
                                                                            <p className="text-lg font-bold text-slate-900">
                                                                                {previsoes[row.account_name].previsoes.ctr.valor_previsto.toFixed(2)}%
                                                                            </p>
                                                                            <div className="flex items-center gap-1 text-xs mt-1">
                                                                                {previsoes[row.account_name].previsoes.ctr.tendencia === 'alta' ? (
                                                                                    <TrendingUp className="w-3 h-3 text-green-600" />
                                                                                ) : previsoes[row.account_name].previsoes.ctr.tendencia === 'baixa' ? (
                                                                                    <TrendingDown className="w-3 h-3 text-red-600" />
                                                                                ) : null}
                                                                                <span className={
                                                                                    previsoes[row.account_name].previsoes.ctr.tendencia === 'alta' ? "text-green-600" :
                                                                                    previsoes[row.account_name].previsoes.ctr.tendencia === 'baixa' ? "text-red-600" :
                                                                                    "text-slate-600"
                                                                                }>
                                                                                    {previsoes[row.account_name].previsoes.ctr.tendencia}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="bg-white rounded p-3">
                                                                            <p className="text-xs text-slate-500 mb-1">Conversões (7d)</p>
                                                                            <p className="text-lg font-bold text-slate-900">
                                                                                {Math.round(previsoes[row.account_name].previsoes.conversoes.total_previsto)}
                                                                            </p>
                                                                            <p className="text-xs text-slate-500 mt-1">
                                                                                ~{previsoes[row.account_name].previsoes.conversoes.media_dia.toFixed(1)}/dia
                                                                            </p>
                                                                        </div>

                                                                        <div className="bg-white rounded p-3">
                                                                            <p className="text-xs text-slate-500 mb-1">Frequência (7d)</p>
                                                                            <p className={cn(
                                                                                "text-lg font-bold",
                                                                                previsoes[row.account_name].previsoes.frequencia.status === 'saudavel' ? "text-green-600" :
                                                                                previsoes[row.account_name].previsoes.frequencia.status === 'alerta' ? "text-orange-600" :
                                                                                "text-red-600"
                                                                            )}>
                                                                                {previsoes[row.account_name].previsoes.frequencia.valor_previsto.toFixed(2)}
                                                                            </p>
                                                                            <Badge className={cn(
                                                                                "text-xs mt-1",
                                                                                previsoes[row.account_name].previsoes.frequencia.risco_saturacao === 'baixo' ? "bg-green-100 text-green-800" :
                                                                                previsoes[row.account_name].previsoes.frequencia.risco_saturacao === 'moderado' ? "bg-yellow-100 text-yellow-800" :
                                                                                "bg-red-100 text-red-800"
                                                                            )}>
                                                                                {previsoes[row.account_name].previsoes.frequencia.risco_saturacao}
                                                                            </Badge>
                                                                        </div>

                                                                        <div className="bg-white rounded p-3">
                                                                            <p className="text-xs text-slate-500 mb-1">Gasto Estimado</p>
                                                                            <p className="text-lg font-bold text-slate-900">
                                                                                {formatCurrency(previsoes[row.account_name].previsoes.gasto_estimado.total)}
                                                                            </p>
                                                                            <p className="text-xs text-slate-500 mt-1">
                                                                                {formatCurrency(previsoes[row.account_name].previsoes.gasto_estimado.diario)}/dia
                                                                            </p>
                                                                        </div>
                                                                    </div>

                                                                    {/* Riscos e Oportunidades */}
                                                                    {previsoes[row.account_name].analise.riscos.length > 0 && (
                                                                        <div className="bg-red-50 rounded p-3 border border-red-200 mb-3">
                                                                            <h4 className="font-semibold text-sm text-red-900 mb-2">⚠ Riscos Identificados</h4>
                                                                            <div className="space-y-2">
                                                                                {previsoes[row.account_name].analise.riscos.map((risco, idx) => (
                                                                                    <div key={idx} className="flex items-start gap-2">
                                                                                        <Badge className={cn(
                                                                                            "text-xs",
                                                                                            risco.severidade === 'critica' ? "bg-red-600 text-white" :
                                                                                            risco.severidade === 'alta' ? "bg-red-500 text-white" :
                                                                                            risco.severidade === 'media' ? "bg-orange-500 text-white" :
                                                                                            "bg-yellow-500 text-white"
                                                                                        )}>
                                                                                            {risco.severidade}
                                                                                        </Badge>
                                                                                        <p className="text-xs text-slate-700 flex-1">
                                                                                            <strong>{risco.tipo}:</strong> {risco.descricao}
                                                                                        </p>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {previsoes[row.account_name].analise.oportunidades.length > 0 && (
                                                                        <div className="bg-green-50 rounded p-3 border border-green-200 mb-3">
                                                                            <h4 className="font-semibold text-sm text-green-900 mb-2">✨ Oportunidades</h4>
                                                                            <div className="space-y-2">
                                                                                {previsoes[row.account_name].analise.oportunidades.map((op, idx) => (
                                                                                    <div key={idx} className="text-xs text-slate-700">
                                                                                        <strong>{op.tipo}:</strong> {op.descricao} 
                                                                                        <span className="text-green-600 ml-1">({op.impacto_potencial})</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : loadingPrevisoes[row.account_name] ? (
                                                            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                                                <div className="flex items-center gap-3">
                                                                    <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                                                                    <span className="text-sm text-slate-600">Gerando previsão com IA...</span>
                                                                </div>
                                                            </div>
                                                            ) : null}

                                                            {recommendations[row.account_name] ? (
                                                            recommendations[row.account_name].error ? (
                                                                <div className="text-red-600">{recommendations[row.account_name].error}</div>
                                                            ) : (
                                                                <div className="space-y-4">
                                                                    {/* Forecast Section Simplificado */}
                                                                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <Activity className="w-5 h-5 text-blue-600" />
                                                                            <h3 className="font-semibold text-lg text-blue-900">Previsão para os Próximos 7 Dias</h3>
                                                                        </div>
                                                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                                                            <div className="bg-white rounded p-3">
                                                                                <p className="text-xs text-slate-500 mb-1">Radar Score</p>
                                                                                <p className={cn(
                                                                                    "text-2xl font-bold",
                                                                                    row.forecast.delta > 10 ? "text-green-600" :
                                                                                    row.forecast.delta < -10 ? "text-red-600" :
                                                                                    "text-slate-900"
                                                                                )}>
                                                                                    {row.forecast.radarScore}
                                                                                </p>
                                                                                <p className="text-xs text-slate-600">
                                                                                    {row.forecast.delta > 0 ? '+' : ''}{row.forecast.delta} pts
                                                                                </p>
                                                                            </div>
                                                                            <div className="bg-white rounded p-3">
                                                                                <p className="text-xs text-slate-500 mb-1">CPL Projetado</p>
                                                                                <p className="text-lg font-bold text-slate-900">
                                                                                    {formatCurrency(row.forecast.cpl)}
                                                                                </p>
                                                                                <p className={cn(
                                                                                    "text-xs",
                                                                                    row.forecast.cpl < row.cplAtual ? "text-green-600" : "text-red-600"
                                                                                )}>
                                                                                    {row.forecast.cpl < row.cplAtual ? '↓' : '↑'} 
                                                                                    {Math.abs(((row.forecast.cpl - row.cplAtual) / row.cplAtual) * 100).toFixed(1)}%
                                                                                </p>
                                                                            </div>
                                                                            <div className="bg-white rounded p-3">
                                                                                <p className="text-xs text-slate-500 mb-1">CTR Projetado</p>
                                                                                <p className="text-lg font-bold text-slate-900">
                                                                                    {row.forecast.ctr.toFixed(2)}%
                                                                                </p>
                                                                                <p className={cn(
                                                                                    "text-xs",
                                                                                    row.forecast.ctr > row.ctrAtual ? "text-green-600" : "text-red-600"
                                                                                )}>
                                                                                    {row.forecast.ctr > row.ctrAtual ? '↑' : '↓'} 
                                                                                    {Math.abs(((row.forecast.ctr - row.ctrAtual) / row.ctrAtual) * 100).toFixed(1)}%
                                                                                </p>
                                                                            </div>
                                                                            <div className="bg-white rounded p-3">
                                                                                <p className="text-xs text-slate-500 mb-1">Leads/dia</p>
                                                                                <p className="text-lg font-bold text-slate-900">
                                                                                    {Math.round(row.forecast.leads)}
                                                                                </p>
                                                                                <p className={cn(
                                                                                    "text-xs",
                                                                                    row.forecast.leads > row.leadsOntem ? "text-green-600" : "text-red-600"
                                                                                )}>
                                                                                    {row.forecast.leads > row.leadsOntem ? '↑' : '↓'} 
                                                                                    {Math.abs(((row.forecast.leads - row.leadsOntem) / row.leadsOntem) * 100).toFixed(1)}%
                                                                                </p>
                                                                            </div>
                                                                            <div className="bg-white rounded p-3">
                                                                                <p className="text-xs text-slate-500 mb-1">Frequência</p>
                                                                                <p className={cn(
                                                                                    "text-lg font-bold",
                                                                                    row.forecast.frequencia > 3.0 ? "text-red-600" :
                                                                                    row.forecast.frequencia >= 2.5 ? "text-orange-600" :
                                                                                    row.forecast.frequencia >= 1.8 ? "text-green-600" :
                                                                                    "text-green-700"
                                                                                )}>
                                                                                    {row.forecast.frequencia.toFixed(2)}
                                                                                </p>
                                                                                <p className={cn(
                                                                                    "text-xs",
                                                                                    row.forecast.frequencia < row.frequencia7d ? "text-green-600" : "text-red-600"
                                                                                )}>
                                                                                    {row.forecast.frequencia < row.frequencia7d ? '↓' : '↑'} 
                                                                                    {Math.abs(((row.forecast.frequencia - row.frequencia7d) / row.frequencia7d) * 100).toFixed(1)}%
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-4">
                                                                    <div className="flex items-center justify-between mb-4">
                                                                       <div className="flex items-center gap-2">
                                                                           <Lightbulb className="w-5 h-5 text-amber-500" />
                                                                           <h3 className="font-semibold text-lg">Plano de Ação Recomendado</h3>
                                                                       </div>
                                                                       <Button
                                                                           onClick={() => {
                                                                               const conta = accounts.find(a => a.account_name === row.account_name);
                                                                               setSelectedAccountForOtimizacao(conta);
                                                                               setOtimizacaoModalOpen(true);
                                                                           }}
                                                                           className="bg-violet-600 hover:bg-violet-700"
                                                                           size="sm"
                                                                       >
                                                                           Adicionar Otimização
                                                                       </Button>
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

            {/* Modal de Otimização */}
            {selectedAccountForOtimizacao && (
                <AdicionarOtimizacaoModal
                    open={otimizacaoModalOpen}
                    onClose={() => {
                        setOtimizacaoModalOpen(false);
                        setSelectedAccountForOtimizacao(null);
                    }}
                    conta={selectedAccountForOtimizacao}
                />
            )}
        </div>
    );
}