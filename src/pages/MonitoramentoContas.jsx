import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Search, AlertTriangle, TrendingUp, DollarSign, Target } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function MonitoramentoContas({ user }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [prioridadeFilter, setPrioridadeFilter] = useState('all');
    const [classificacaoFilter, setClassificacaoFilter] = useState('all');
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

    const syncMutation = useMutation({
        mutationFn: () => base44.functions.invoke('syncMetaAdsAccounts', {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['metaAdsAccounts'] });
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

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
        </div>
    );
}