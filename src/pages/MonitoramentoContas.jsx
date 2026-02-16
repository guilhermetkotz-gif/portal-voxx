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
import { RefreshCw, Search, AlertTriangle, TrendingUp, DollarSign, Target, Activity, TrendingDown, CheckCircle, Clock, ChevronDown, ChevronRight, Lightbulb, Settings } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend, ScatterChart, Scatter, ZAxis } from 'recharts';
import ListaHistoricoOtimizacoes from '@/components/metaads/ListaHistoricoOtimizacoes';
import AdicionarOtimizacaoModal from '@/components/metaads/AdicionarOtimizacaoModal';
import PainelGamificacao from '@/components/gamificacao/PainelGamificacao';
import ConfigurarPlanilhaModal from '@/components/metaads/ConfigurarPlanilhaModal';

export default function MonitoramentoContas({ user }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [prioridadeFilter, setPrioridadeFilter] = useState('all');
    const [classificacaoFilter, setClassificacaoFilter] = useState('all');
    const [responsavelFilter, setResponsavelFilter] = useState('all');
    const [radarSearchTerm, setRadarSearchTerm] = useState('');
    const [radarPrioridadeFilter, setRadarPrioridadeFilter] = useState('all');
    const [radarResponsavelFilter, setRadarResponsavelFilter] = useState('all');
    const [configModalOpen, setConfigModalOpen] = useState(false);
    const [configModalTipo, setConfigModalTipo] = useState(null);
    const [editingConfig, setEditingConfig] = useState(null);
    const queryClient = useQueryClient();

    // Verificar se é voxx (admin, manager ou operacao)
    const isVoxx = user?.role === 'admin' || user?.tipo_usuario?.startsWith('voxx_');

    if (!isVoxx) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Card className="max-w-md w-full p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Acesso Restrito</h2>
                    <p className="text-slate-600">Esta página é exclusiva para a equipe Voxx.</p>
                </Card>
            </div>
        );
    }

    const { data: radarMetaData = [] } = useQuery({
        queryKey: ['radarMetaData'],
        queryFn: async () => {
            const data = await base44.entities.RadarMetaData.list('-created_date', 500);
            console.log('=== RADAR META DATA QUERY ===');
            console.log('Total registros RadarMetaData:', data.length);
            console.log('Contas no RadarMetaData:', data.map(r => r.account_name));
            return data;
        },
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

    const { data: sheetConfigs = [] } = useQuery({
        queryKey: ['metaAdsSheetConfigs'],
        queryFn: () => base44.entities.MetaAdsSheetConfig.filter({ ativo: true }),
        staleTime: 5 * 60 * 1000
    });

    const { data: voxxUsers = [], isLoading: loadingVoxxUsers } = useQuery({
        queryKey: ['voxxUsers'],
        queryFn: async () => {
            try {
                const response = await base44.functions.invoke('listVoxxUsers', {});
                console.log('Voxx Users Response:', response.data);
                return response.data?.users || [];
            } catch (error) {
                console.error('Erro ao buscar usuários voxx:', error);
                return [];
            }
        },
        enabled: !!isVoxx,
        staleTime: 5 * 60 * 1000,
        retry: 2
    });

    const updateClienteMutation = useMutation({
            mutationFn: async ({ clienteId, responsavel }) => {
                const response = await base44.functions.invoke('updateClienteResponsavel', {
                    clienteId,
                    responsavel
                });
                return { responsavel, clienteId };
            },
            onSuccess: async ({ responsavel, clienteId }) => {
                await queryClient.invalidateQueries({ queryKey: ['clientes'] });
                await queryClient.refetchQueries({ queryKey: ['clientes'] });
                toast.success(`Responsável ${responsavel && responsavel !== '__NONE__' ? 'atualizado' : 'removido'} com sucesso!`);
            },
            onError: (error) => {
                toast.error('Erro ao atualizar responsável: ' + error.message);
            }
        });

    const [expandedRows, setExpandedRows] = useState(new Set());
    const [recommendations, setRecommendations] = useState({});
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

    // Lista de responsáveis únicos que estão atribuídos a pelo menos uma unidade
    const responsaveisAtivos = React.useMemo(() => {
        const responsaveisSet = new Set();
        clientes.forEach(cliente => {
            if (cliente.responsavel_voxx_trafego) {
                responsaveisSet.add(cliente.responsavel_voxx_trafego);
            }
        });
        console.log('=== DEBUG RESPONSAVEIS ===');
        console.log('Total clientes:', clientes.length);
        console.log('Responsáveis atribuídos:', Array.from(responsaveisSet));
        console.log('Total voxxUsers:', voxxUsers.length);
        console.log('Emails dos voxxUsers:', voxxUsers.map(u => u.email));
        const filtrados = voxxUsers.filter(user => responsaveisSet.has(user.email));
        console.log('Responsáveis ativos filtrados:', filtrados.length);
        return filtrados;
    }, [clientes, voxxUsers]);

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
            const cliente = clientesMap.get(acc.account_name);
            const matchesSearch = acc.account_name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesPrioridade = prioridadeFilter === 'all' || acc.prioridade === prioridadeFilter;
            const matchesClassificacao = classificacaoFilter === 'all' || acc.classificacao === classificacaoFilter;
            const matchesResponsavel = responsavelFilter === 'all' || cliente?.responsavel_voxx_trafego === responsavelFilter;
            return matchesSearch && matchesPrioridade && matchesClassificacao && matchesResponsavel;
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

    // Calculate KPIs based on filtered accounts
    const totalContas = filteredAccounts.length;
    const contasP1 = filteredAccounts.filter(acc => acc.prioridade === 'P1').length;
    const contasCritico = filteredAccounts.filter(acc => acc.classificacao === 'CRÍTICO').length;
    const mediaNotaGPT = filteredAccounts.length > 0 
        ? (filteredAccounts.reduce((sum, acc) => sum + acc.nota_gpt, 0) / filteredAccounts.length).toFixed(1)
        : 0;
    const totalGasto = filteredAccounts.reduce((sum, acc) => sum + acc.amount_spent, 0);

    // Distribuição por classificação (based on filtered accounts)
    const distribuicaoClassificacao = [
        { name: 'CRÍTICO', count: filteredAccounts.filter(acc => acc.classificacao === 'CRÍTICO').length, color: '#DC2626' },
        { name: 'ALERTA', count: filteredAccounts.filter(acc => acc.classificacao === 'ALERTA').length, color: '#F97316' },
        { name: 'OPERACIONAL', count: filteredAccounts.filter(acc => acc.classificacao === 'OPERACIONAL').length, color: '#EAB308' },
        { name: 'SAUDÁVEL', count: filteredAccounts.filter(acc => acc.classificacao === 'SAUDÁVEL').length, color: '#22C55E' },
        { name: 'ELITE', count: filteredAccounts.filter(acc => acc.classificacao === 'ELITE').length, color: '#15803D' }
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
        console.log('=== DEBUG RADAR META MEMO ===');
        console.log('radarMetaData.length:', radarMetaData.length);
        console.log('clientes.length:', clientes.length);
        console.log('clientesMap.size:', clientesMap.size);
        
        if (!radarMetaData.length) {
            console.log('⚠️ Nenhum dado em RadarMetaData - retornando array vazio');
            return [];
        }

        console.log('RadarMetaData account_names:', radarMetaData.map(r => r.account_name));
        console.log('Clientes no mapa:', Array.from(clientesMap.keys()));

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
            // Investimento diário vem direto da planilha "ontem meta ads" (amount_spent do dia anterior)
            const investimentoDiario = radar.amount_spent_ontem || 0;

            // Variações (Ontem vs 7d)
            const variacaoCPL = radar.variacao_cpl || 0;
            const variacaoCTR = radar.variacao_ctr || 0;

            // ========== EIXO 1: ESTADO ESTRUTURAL DA CONTA (baseado 7d) ==========
            // Avalia a saúde CONSOLIDADA considerando métricas dos últimos 7 dias
            let estadoScore = 100;
            let estadoLabel = 'Saudável';

            // Penalizar CPL alto
            if (cpl7d > 50) estadoScore -= 40;
            else if (cpl7d > 35) estadoScore -= 25;
            else if (cpl7d > 25) estadoScore -= 15;

            // Penalizar CTR baixo
            if (ctr7d < 0.5) estadoScore -= 30;
            else if (ctr7d < 1.0) estadoScore -= 20;
            else if (ctr7d < 1.5) estadoScore -= 10;

            // Frequência como INDICADOR DE ESTADO ESTRUTURAL (não de tendência)
            // Classificação por faixas estruturais
            let frequenciaEstado = 0;
            if (frequencia7d >= 3.0) {
                estadoScore -= 35;
                frequenciaEstado = 'Muito Crítica';
            } else if (frequencia7d >= 2.5) {
                estadoScore -= 20;
                frequenciaEstado = 'Crítica';
            } else if (frequencia7d >= 1.8) {
                estadoScore -= 5;
                frequenciaEstado = 'Atenção';
            } else {
                estadoScore += 10; // Bonus para < 1.8
                frequenciaEstado = 'Saudável';
            }

            estadoScore = Math.max(0, Math.min(100, estadoScore));

            // Classificar o ESTADO por faixas
            if (estadoScore < 40) estadoLabel = 'Crítico';
            else if (estadoScore < 60) estadoLabel = 'Atenção';
            else if (estadoScore < 80) estadoLabel = 'Operacional';
            else estadoLabel = 'Saudável';

            // ========== EIXO 2: TENDÊNCIA RECENTE (ontem vs 7d) ==========
            // Apenas métricas PONTUAIS que fazem sentido em comparação diária
            // FREQUÊNCIA NÃO entra aqui
            let tendenciaScore = 50; // Base neutra
            let sinaisTendencia = 0; // Contador de sinais positivos/negativos
            let gastoSemConversao = false; // Flag para "gasto sem leads"

            // ========== VALIDAÇÃO DE CPL (com regra de leads) ==========
            // CPL só é válido quando há leads entregues
            if (leadsOntem === 0 && investimentoDiario > 0) {
                // Gasto sem conversão - é NEGATIVO
                gastoSemConversao = true;
                tendenciaScore -= 20; // Penalidade forte
                sinaisTendencia -= 2;
            } else if (leadsOntem > 0) {
                // CPL é válido - comparar normalmente
                if (cplAtual < cpl7d * 0.9) {
                    tendenciaScore += 10; // CPL caiu 10%+
                    sinaisTendencia++;
                } else if (cplAtual > cpl7d * 1.1) {
                    tendenciaScore -= 10; // CPL subiu 10%+
                    sinaisTendencia--;
                }
            }
            // Se leadsOntem = 0 e gastoOntem = 0, não penaliza (estado neutro)

            // CTR: melhorando vs piorando
            if (ctrAtual > ctr7d * 1.1) {
                tendenciaScore += 10; // CTR subiu 10%+
                sinaisTendencia++;
            } else if (ctrAtual < ctr7d * 0.9) {
                tendenciaScore -= 10; // CTR caiu 10%+
                sinaisTendencia--;
            }

            // Leads/dia: melhorando vs piorando
            if (leadsOntem > leadsDia7d * 1.2) {
                tendenciaScore += 10; // +20% leads
                sinaisTendencia++;
            } else if (leadsOntem < leadsDia7d * 0.7) {
                tendenciaScore -= 10; // -30% leads
                sinaisTendencia--;
            }

            // Nota: Frequência NÃO entra na tendência (apenas no estado estrutural)

            tendenciaScore = Math.max(0, Math.min(100, tendenciaScore));

            // Classificar tendência
            let tendenciaLabel = 'Neutra';
            if (sinaisTendencia >= 2) tendenciaLabel = 'Positiva';
            else if (sinaisTendencia <= -2) tendenciaLabel = 'Negativa';

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
            // Matriz de decisão: ESTADO x TENDÊNCIA
            let prioridadeRaw;
            
            if (estadoScore < 40) {
                // ESTADO CRÍTICO
                if (tendenciaLabel === 'Negativa') {
                    prioridadeRaw = 'critica'; // Crítica + Piora = CRÍTICA
                } else if (tendenciaLabel === 'Positiva') {
                    prioridadeRaw = 'media'; // Crítica + Melhora = MÉDIA
                } else {
                    prioridadeRaw = 'alta'; // Crítica + Neutra = ALTA
                }
            } else if (estadoScore < 60) {
                // ESTADO ATENÇÃO
                if (tendenciaLabel === 'Negativa') {
                    prioridadeRaw = 'alta'; // Atenção + Piora = ALTA
                } else if (tendenciaLabel === 'Positiva') {
                    prioridadeRaw = 'baixa'; // Atenção + Melhora = BAIXA
                } else {
                    prioridadeRaw = 'media'; // Atenção + Neutra = MÉDIA
                }
            } else {
                // ESTADO SAUDÁVEL
                if (tendenciaLabel === 'Negativa') {
                    prioridadeRaw = 'media'; // Saudável + Piora = MÉDIA (alerta preventivo)
                } else {
                    prioridadeRaw = 'baixa'; // Saudável + Melhora/Neutra = BAIXA
                }
            }

            // Elevar prioridade se houver eventos críticos
            if (frequencia7d >= 3.0) {
                prioridadeRaw = 'critica';
            } else if (frequencia7d >= 2.5 && prioridadeRaw === 'media') {
                prioridadeRaw = 'alta';
            }

            // Elevar prioridade se houver "gasto sem conversão" (leads=0 mas gasto>0)
            if (gastoSemConversao) {
                if (prioridadeRaw === 'baixa') {
                    prioridadeRaw = 'media'; // Elevar de baixa para média
                } else if (prioridadeRaw === 'media') {
                    prioridadeRaw = 'alta'; // Elevar de média para alta
                }
                // Se já for alta ou crítica, mantém
            }

            const radarScore = Math.round(
                (estadoScore * 0.4) + (tendenciaScore * 0.3) + (impactoScore * 0.3)
            );

            // ========== PRIORIDADE ==========
            let prioridade, prioridadeLabel;

            if (prioridadeRaw === 'critica') {
                prioridade = 'critica';
                prioridadeLabel = '🔴 Crítica';
            } else if (prioridadeRaw === 'alta') {
                prioridade = 'alta';
                prioridadeLabel = '🟠 Alta';
            } else if (prioridadeRaw === 'media') {
                prioridade = 'media';
                prioridadeLabel = '🟡 Média';
            } else {
                prioridade = 'baixa';
                prioridadeLabel = '🟢 Baixa';
            }

            // ========== STATUS DESCRITIVO ==========
            let status = '';

            // Primeiro, verificar "gasto sem conversão" que sobrescreve tudo
            if (gastoSemConversao) {
                status = '⚠️ ALERTA: Ontem houve gasto sem geração de leads - Revisar campanha';
            } else if (leadsOntem === 0 && investimentoDiario === 0) {
                // Nenhum gasto, nenhum lead - estado neutro
                status = '➡️ NEUTRO: Sem dados relevantes no último dia';
            } else {
                // Textos interpretativos claros baseados em ESTADO + TENDÊNCIA
                if (estadoScore < 40) {
                    if (tendenciaLabel === 'Negativa') {
                        status = '🔴 CRÍTICO: Performance crítica e em deterioração - Ação imediata';
                    } else if (tendenciaLabel === 'Positiva') {
                        status = '🟠 RECUPERAÇÃO: Conta estruturalmente crítica, porém em melhora recente';
                    } else {
                        status = '🔴 ALERTA: Performance crítica e estável - Requer otimização';
                    }
                } else if (estadoScore < 60) {
                    if (tendenciaLabel === 'Negativa') {
                        status = '🟠 ALERTA: Indicadores moderados com sinais iniciais de queda';
                    } else if (tendenciaLabel === 'Positiva') {
                        status = '🟢 MELHORA: Performance em recuperação - Manter tendência';
                    } else {
                        status = '🟡 ESTÁVEL: Performance operacional sem grandes variações';
                    }
                } else {
                    if (tendenciaLabel === 'Negativa') {
                        status = '🟡 MONITORAR: Indicadores saudáveis com sinais iniciais de queda';
                    } else if (tendenciaLabel === 'Positiva') {
                        status = '✅ EXCELENTE: Performance ótima e em contínua melhora';
                    } else {
                        status = '✓ SAUDÁVEL: Performance boa e estável - Manter padrão';
                    }
                }
            }

            // Adicionar indicador de frequência se crítico
            if (frequencia7d >= 3.0) {
                status += ` [⚠️ Saturação ${frequenciaEstado.toLowerCase()}]`;
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

            // Projetar novo ESTADO para os próximos 7 dias
            let estadoPrevisao = 100;
            if (cplPrevisao > 50) estadoPrevisao -= 40;
            else if (cplPrevisao > 35) estadoPrevisao -= 25;
            else if (cplPrevisao > 25) estadoPrevisao -= 15;

            if (ctrPrevisao < 0.5) estadoPrevisao -= 30;
            else if (ctrPrevisao < 1.0) estadoPrevisao -= 20;
            else if (ctrPrevisao < 1.5) estadoPrevisao -= 10;

            if (freqPrevisao >= 3.0) estadoPrevisao -= 35;
            else if (freqPrevisao >= 2.5) estadoPrevisao -= 20;
            else if (freqPrevisao >= 1.8) estadoPrevisao -= 5;
            else estadoPrevisao += 10;

            estadoPrevisao = Math.max(0, Math.min(100, estadoPrevisao));

            const radarScorePrevisao = Math.round(
                (estadoPrevisao * 0.4) + (tendenciaScore * 0.3) + (impactoScore * 0.3)
            );

            return {
                account_name: radar.account_name,
                cliente,
                radarScore,
                estadoScore,
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
        }); // Retorna TODAS as contas
    }, [radarMetaData, accounts, clientesMap]);

    const filteredRadarData = React.useMemo(() => {
        console.log('=== FILTROS RADAR META ===');
        console.log('radarData.length (antes dos filtros):', radarData.length);
        console.log('radarSearchTerm:', radarSearchTerm);
        console.log('radarPrioridadeFilter:', radarPrioridadeFilter);
        console.log('radarResponsavelFilter:', radarResponsavelFilter);
        
        let filtered = radarData;

        if (radarSearchTerm) {
            const search = radarSearchTerm.toLowerCase();
            filtered = filtered.filter(d => 
                d.account_name?.toLowerCase().includes(search) ||
                d.cliente?.cidade?.toLowerCase().includes(search)
            );
            console.log('Após filtro de busca:', filtered.length);
        }

        if (radarPrioridadeFilter !== 'all') {
            filtered = filtered.filter(d => d.prioridade === radarPrioridadeFilter);
            console.log('Após filtro de prioridade:', filtered.length);
        }

        if (radarResponsavelFilter !== 'all') {
            const antes = filtered.length;
            filtered = filtered.filter(d => d.cliente?.responsavel_voxx_trafego === radarResponsavelFilter);
            console.log(`Após filtro de responsável (${radarResponsavelFilter}):`, filtered.length, '(era', antes, ')');
        }
        
        console.log('filteredRadarData.length (final):', filtered.length);

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
    }, [radarData, radarSearchTerm, radarPrioridadeFilter, radarResponsavelFilter]);

    const radarStats = React.useMemo(() => {
        const totalContas = filteredRadarData.length;
        const avgCPL = totalContas > 0 ? filteredRadarData.reduce((sum, d) => sum + d.cplAtual, 0) / totalContas : 0;
        const avgCTR = totalContas > 0 ? filteredRadarData.reduce((sum, d) => sum + d.ctrAtual, 0) / totalContas : 0;
        const avgFreq = totalContas > 0 ? filteredRadarData.reduce((sum, d) => sum + d.frequencia7d, 0) / totalContas : 0;
        const avgRadarScore = totalContas > 0 ? filteredRadarData.reduce((sum, d) => sum + d.radarScore, 0) / totalContas : 0;
        const totalInvestimento = filteredRadarData.reduce((sum, d) => sum + d.investimentoDiario, 0);
        const totalLeads = filteredRadarData.reduce((sum, d) => sum + parseFloat(d.leadsDia7d), 0);

        // Top melhorias e pioras (baseado em tendenciaScore)
        const sorted = [...filteredRadarData].sort((a, b) => b.tendenciaScore - a.tendenciaScore);
        const topMelhorias = sorted.slice(0, 5);
        const topPioras = sorted.slice(-5).reverse();

        return {
            critica: filteredRadarData.filter(d => d.prioridade === 'critica').length,
            alta: filteredRadarData.filter(d => d.prioridade === 'alta').length,
            media: filteredRadarData.filter(d => d.prioridade === 'media').length,
            baixa: filteredRadarData.filter(d => d.prioridade === 'baixa').length,
            avgCPL,
            avgCTR,
            avgFreq,
            avgRadarScore,
            totalInvestimento,
            totalLeads,
            topMelhorias,
            topPioras
        };
    }, [filteredRadarData]);

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
                <div className="flex gap-2">
                    <Button 
                        onClick={() => syncMutation.mutate()}
                        disabled={syncMutation.isPending}
                        className="bg-violet-600 hover:bg-violet-700"
                    >
                        <RefreshCw className={cn("w-4 h-4 mr-2", syncMutation.isPending && "animate-spin")} />
                        Sincronizar
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="monitoramento" className="w-full">
                <TabsList className="grid w-full max-w-5xl grid-cols-5">
                    <TabsTrigger value="monitoramento">Monitoramento de Contas</TabsTrigger>
                    <TabsTrigger value="radar">RADAR META</TabsTrigger>
                    <TabsTrigger value="gamificacao">Gamificação</TabsTrigger>
                    <TabsTrigger value="operadores">Contas/Operador</TabsTrigger>
                    <TabsTrigger value="otimizacoes">Histórico de Otimizações</TabsTrigger>
                </TabsList>

                {/* Tab: Monitoramento de Contas */}
                <TabsContent value="monitoramento" className="space-y-6 mt-6">
                    
                    {/* Configuração da Planilha */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-700">Configuração da Planilha</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {sheetConfigs.find(c => c.tipo === 'monitoramento') ? (
                                            <>
                                                <span className="font-medium">
                                                    {sheetConfigs.find(c => c.tipo === 'monitoramento').nome_configuracao}
                                                </span>
                                                {' • Aba: '}{sheetConfigs.find(c => c.tipo === 'monitoramento').aba_ontem}{' (Dados do Mês)'}
                                            </>
                                        ) : (
                                            'Nenhuma configuração ativa'
                                        )}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const existingConfig = sheetConfigs.find(c => c.tipo === 'monitoramento');
                                        setEditingConfig(existingConfig || null);
                                        setConfigModalTipo('monitoramento');
                                        setConfigModalOpen(true);
                                    }}
                                >
                                    <Settings className="w-4 h-4 mr-2" />
                                    Configurar Origem dos Dados
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

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
                        <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
                            <SelectTrigger className="w-full md:w-64">
                                <SelectValue placeholder="Todos Responsáveis" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos Responsáveis</SelectItem>
                                {responsaveisAtivos.map((voxxUser) => (
                                    <SelectItem key={voxxUser.id} value={voxxUser.email}>
                                        {voxxUser.full_name}
                                    </SelectItem>
                                ))}
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
                    
                    {/* Configuração da Planilha RADAR */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-700">Configuração da Planilha RADAR</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {sheetConfigs.find(c => c.tipo === 'radar') ? (
                                            <>
                                                <span className="font-medium">
                                                    {sheetConfigs.find(c => c.tipo === 'radar').nome_configuracao}
                                                </span>
                                                {' • Abas: '}{sheetConfigs.find(c => c.tipo === 'radar').aba_ontem}
                                                {' e '}{sheetConfigs.find(c => c.tipo === 'radar').aba_7dias}
                                            </>
                                        ) : (
                                            'Nenhuma configuração ativa'
                                        )}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const existingConfig = sheetConfigs.find(c => c.tipo === 'radar');
                                        setEditingConfig(existingConfig || null);
                                        setConfigModalTipo('radar');
                                        setConfigModalOpen(true);
                                    }}
                                >
                                    <Settings className="w-4 h-4 mr-2" />
                                    Configurar Origem dos Dados
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
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
                            <div className="flex gap-4 flex-wrap">
                                <div className="flex-1 min-w-[200px] relative">
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
                                <Select value={radarResponsavelFilter} onValueChange={setRadarResponsavelFilter}>
                                    <SelectTrigger className="w-64">
                                        <SelectValue placeholder="Todos Responsáveis" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos Responsáveis</SelectItem>
                                        {responsaveisAtivos.map((voxxUser) => (
                                            <SelectItem key={voxxUser.id} value={voxxUser.email}>
                                                {voxxUser.full_name}
                                            </SelectItem>
                                        ))}
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
                                          <React.Fragment key={`radar-${row.account_name}-${index}`}>
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
                                                        {recommendations[row.account_name] ? (
                                                            recommendations[row.account_name].error ? (
                                                                <div className="text-red-600">{recommendations[row.account_name].error}</div>
                                                            ) : (
                                                                <div className="space-y-6">
                                                                    {/* Forecast Section */}
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

                {/* Tab: Gamificação */}
                <TabsContent value="gamificacao" className="mt-6">
                    <PainelGamificacao user={user} />
                </TabsContent>

                {/* Tab: Contas/Operador */}
                <TabsContent value="operadores" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Gerenciar Responsáveis de Tráfego</CardTitle>
                            <p className="text-sm text-slate-500 mt-2">
                                Atribua um responsável de tráfego/operação para cada cliente
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Cidade/Estado</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Responsável Tráfego/Operação</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {clientes
                                            .sort((a, b) => a.nome.localeCompare(b.nome))
                                            .map((cliente) => (
                                            <TableRow key={cliente.id}>
                                                <TableCell className="font-medium">
                                                    {cliente.nome}
                                                </TableCell>
                                                <TableCell className="text-slate-600">
                                                    {cliente.cidade}, {cliente.estado}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={cn(
                                                        cliente.status === 'ativo' ? 'bg-green-100 text-green-800' :
                                                        cliente.status === 'implantacao' ? 'bg-blue-100 text-blue-800' :
                                                        cliente.status === 'pausado' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-slate-100 text-slate-800'
                                                    )}>
                                                        {cliente.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <select
                                                        value={cliente.responsavel_voxx_trafego || '__NONE__'}
                                                        onChange={(e) => {
                                                            console.log('=== SELECT CHANGE ===');
                                                            console.log('clienteId:', cliente.id);
                                                            console.log('selected value:', e.target.value);
                                                            console.log('voxxUsers disponíveis:', voxxUsers.length);
                                                            updateClienteMutation.mutate({ 
                                                                clienteId: cliente.id, 
                                                                responsavel: e.target.value
                                                            });
                                                        }}
                                                        className="w-64 h-9 px-3 rounded-md border border-input bg-background text-sm"
                                                        disabled={updateClienteMutation.isPending || loadingVoxxUsers}
                                                    >
                                                        <option value="__NONE__">
                                                            {loadingVoxxUsers ? 'Carregando...' : 'Nenhum responsável'}
                                                        </option>
                                                        {voxxUsers.length === 0 && !loadingVoxxUsers && (
                                                            <option disabled>Nenhum usuário disponível</option>
                                                        )}
                                                        {voxxUsers.map((voxxUser) => (
                                                            <option key={voxxUser.id} value={voxxUser.email}>
                                                                {voxxUser.full_name} ({voxxUser.email})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {clientes.length === 0 && (
                                    <div className="text-center py-12 text-slate-500">
                                        Nenhum cliente cadastrado
                                    </div>
                                )}
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
                    onOpenChange={(isOpen) => {
                        setOtimizacaoModalOpen(isOpen);
                        if (!isOpen) setSelectedAccountForOtimizacao(null);
                    }}
                    conta={selectedAccountForOtimizacao}
                />
            )}

            {/* Modal de Configuração */}
            <ConfigurarPlanilhaModal
                open={configModalOpen}
                onOpenChange={(isOpen) => {
                    setConfigModalOpen(isOpen);
                    if (!isOpen) {
                        setEditingConfig(null);
                        setConfigModalTipo(null);
                    }
                }}
                config={editingConfig}
                tipo={configModalTipo}
            />
        </div>
    );
}