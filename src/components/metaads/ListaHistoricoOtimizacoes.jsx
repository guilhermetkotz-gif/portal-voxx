import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Calendar, FileText, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import moment from 'moment-timezone';

export default function ListaHistoricoOtimizacoes() {
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const { data: contas = [], isLoading: loadingContas } = useQuery({
        queryKey: ['contasMetaAds'],
        queryFn: () => base44.entities.ContaMetaAds.list('-updated_date', 500),
        staleTime: 2 * 60 * 1000
    });

    const { data: todasOtimizacoes = [], isLoading: loadingOtimizacoes } = useQuery({
        queryKey: ['metaAdsOtimizacoes'],
        queryFn: () => base44.entities.MetaAdsOtimizacao.list('-data_acao', 1000),
        staleTime: 60 * 1000
    });

    // Agrupar otimizações por conta e pegar a última
    const contasComOtimizacoes = contas.map(conta => {
        const otimizacoesConta = todasOtimizacoes.filter(
            o => o.account_name === conta.account_name
        );
        
        const ultimaOtimizacao = otimizacoesConta.length > 0 ? otimizacoesConta[0] : null;
        
        return {
            ...conta,
            total_otimizacoes: otimizacoesConta.length,
            ultima_otimizacao: ultimaOtimizacao
        };
    });

    // Filtrar por termo de busca
    const contasFiltradas = contasComOtimizacoes.filter(conta => 
        conta.account_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Ordenar: primeiro as que têm otimizações (por data mais recente), depois as sem otimizações
    const contasOrdenadas = contasFiltradas.sort((a, b) => {
        if (a.ultima_otimizacao && !b.ultima_otimizacao) return -1;
        if (!a.ultima_otimizacao && b.ultima_otimizacao) return 1;
        if (a.ultima_otimizacao && b.ultima_otimizacao) {
            return new Date(b.ultima_otimizacao.data_acao) - new Date(a.ultima_otimizacao.data_acao);
        }
        return a.account_name.localeCompare(b.account_name);
    });

    const handleClickConta = (conta) => {
        navigate(createPageUrl('HistoricoOtimizacoesCliente') + `?conta_id=${conta.id}&conta_name=${encodeURIComponent(conta.account_name)}`);
    };

    if (loadingContas || loadingOtimizacoes) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Buscar por nome da conta..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Badge variant="outline" className="text-sm">
                    {contasOrdenadas.length} contas
                </Badge>
            </div>

            <div className="grid gap-4">
                {contasOrdenadas.map(conta => (
                    <Card 
                        key={conta.id}
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => handleClickConta(conta)}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-slate-900 mb-1">
                                        {conta.account_name}
                                    </h3>
                                    
                                    {conta.ultima_otimizacao ? (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <Calendar className="w-4 h-4" />
                                                <span>
                                                    Última ação: {moment(conta.ultima_otimizacao.data_acao).format('DD/MM/YYYY')}
                                                </span>
                                            </div>
                                            <div className="flex items-start gap-2 text-sm text-slate-600">
                                                <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                <p className="line-clamp-2">
                                                    {conta.ultima_otimizacao.resumo_acao}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-500 italic">
                                            Nenhuma otimização registrada
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-col items-end gap-2">
                                    <Badge 
                                        variant={conta.total_otimizacoes > 0 ? "default" : "outline"}
                                        className={conta.total_otimizacoes > 0 ? "bg-violet-600" : ""}
                                    >
                                        {conta.total_otimizacoes} {conta.total_otimizacoes === 1 ? 'ação' : 'ações'}
                                    </Badge>
                                    <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleClickConta(conta);
                                        }}
                                    >
                                        Ver histórico
                                        <ExternalLink className="w-3 h-3 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {contasOrdenadas.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-slate-500">Nenhuma conta encontrada</p>
                </div>
            )}
        </div>
    );
}