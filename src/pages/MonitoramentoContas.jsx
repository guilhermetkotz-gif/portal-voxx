import React, { useState, useEffect, useMemo } from 'react';
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
import GamificacaoRadarV2 from '@/components/gamificacao/GamificacaoRadarV2';
import ConfigurarPlanilhaModal from '@/components/metaads/ConfigurarPlanilhaModal';
import PerformancePorOperador from '@/components/metaads/PerformancePorOperador';
import RadarTable from '@/components/monitoramento/RadarTable';

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
    const [activeTab, setActiveTab] = useState('monitoramento');
    const queryClient = useQueryClient();

    // Verificar se é voxx (admin, manager ou operacao)
    const isVoxx = user?.role === 'admin' || user?.tipo_acesso?.startsWith('voxx_');

    const { data: radarMetaData = [] } = useQuery({
        queryKey: ['radarMetaData'],
        queryFn: async () => {
            const data = await base44.entities.RadarMetaData.list('-created_date', 500);
            console.log('🔥🔥🔥 RADAR META - TOTAL DE REGISTROS:', data.length);
            console.log('🔥🔥🔥 RADAR META - ACCOUNT NAMES:', data.map(r => r.account_name));
            return data;
        },
        staleTime: 2 * 60 * 1000
    });

    const { data: accounts = [], isLoading } = useQuery({
        queryKey: ['metaAdsAccounts'],
        queryFn: async () => {
            const data = await base44.entities.ContaMetaAds.list('-created_date', 500);
            // Debug: Log primeira conta para verificar estrutura dos dados
            if (data.length > 0) {
                console.log('🔍 DEBUG CONTA META ADS:', {
                    account_name: data[0].account_name,
                    messaging_conversations: data[0].messaging_conversations,
                    new_messaging_connections: data[0].new_messaging_connections,
                    cost_per_messaging: data[0].cost_per_messaging,
                    cost_per_new_messaging: data[0].cost_per_new_messaging,
                    all_fields: Object.keys(data[0])
                });
            }
            return data;
        },
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

    const { data: voxxUsers = [], isLoading: loadingVoxxUsers, error: voxxUsersError } = useQuery({
        queryKey: ['voxxUsers'],
        queryFn: async () => {
            try {
                console.log('🟦 Buscando usuários voxx...');
                const response = await base44.functions.invoke('listVoxxUsers', {});
                console.log('🟦 Resposta completa:', response);
                console.log('🟦 Response.data:', response.data);
                console.log('🟦 Users array:', response.data?.users);
                console.log('🟦 Total de usuários voxx:', response.data?.users?.length || 0);
                
                // Se response.data for undefined ou null, retornar array vazio
                if (!response.data) {
                    console.warn('⚠️ Response.data é undefined ou null');
                    return [];
                }
                
                // Se response.data.users for undefined, retornar array vazio
                if (!response.data.users) {
                    console.warn('⚠️ Response.data.users é undefined');
                    return [];
                }
                
                return response.data.users;
            } catch (error) {
                console.error('❌ Erro ao buscar usuários voxx:', error);
                console.error('❌ Detalhes do erro:', error.message, error.stack);
                return [];
            }
        },
        enabled: !!isVoxx,
        staleTime: 5 * 60 * 1000,
        retry: 3,
        retryDelay: 1000
    });

    // Debug effect para monitorar voxxUsers
    useEffect(() => {
        console.log('🔍 Estado voxxUsers atualizado:', {
            total: voxxUsers.length,
            isLoading: loadingVoxxUsers,
            hasError: !!voxxUsersError,
            users: voxxUsers.map(u => ({ id: u.id, email: u.email, full_name: u.full_name }))
        });
    }, [voxxUsers, loadingVoxxUsers, voxxUsersError]);

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

    // Handler EXCLUSIVO para Meta Ads - NÃO TOCA EM GOOGLE ADS
    const handleAssignResponsavelMeta = async (accountName, userId) => {
        try {
            // 1. Atualizar ContaMetaAds.responsavel_voxx (se existir)
            const metaAccount = accounts.find(a => a.account_name === accountName);
            if (metaAccount?.id) {
                await base44.entities.ContaMetaAds.update(metaAccount.id, {
                    responsavel_voxx: userId
                });
            }

            // 2. Atualizar SOMENTE Cliente.responsavel_meta_ads (NUNCA responsavel_google_ads)
            const cliente = clientes.find(c => 
                c.nome === accountName || 
                c.meta_ads_account_name === accountName
            );
            
            if (cliente) {
                await base44.entities.Cliente.update(cliente.id, {
                    responsavel_meta_ads: userId
                });
            }

            // 3. Recarregar dados
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['metaAdsAccounts'] }),
                queryClient.invalidateQueries({ queryKey: ['clientes'] })
            ]);
            
            toast.success('Responsável Meta Ads atribuído com sucesso!');
        } catch (error) {
            toast.error('Erro ao atribuir responsável Meta: ' + error.message);
            throw error;
        }
    };

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
        const map = new Map();
        clientes.forEach(c => {
            // Mapear pelo nome do cliente
            if (c.nome) map.set(c.nome, c);
            // Mapear pelo nome da conta Meta Ads principal (campo legado)
            if (c.meta_ads_account_name) map.set(c.meta_ads_account_name, c);
            // Mapear por todas as contas Meta em contas_anuncio
            if (Array.isArray(c.contas_anuncio)) {
                c.contas_anuncio.forEach(conta => {
                    if (conta.plataforma === 'Meta' && conta.conta_nome) {
                        map.set(conta.conta_nome, c);
                    }
                });
            }
        });
        return map;
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
            // Run both independently - don't let one failure block the other
            const results = await Promise.allSettled([
                base44.functions.invoke('syncMetaAdsAccounts', {}),
                base44.functions.invoke('syncRadarMetaData', {})
            ]);
            const errors = results.filter(r => r.status === 'rejected').map(r => r.reason?.message);
            if (errors.length === 2) throw new Error(errors.join('; '));
            return results;
        },
        onSettled: () => {
            // Always invalidate queries regardless of success/failure
            queryClient.invalidateQueries({ queryKey: ['metaAdsAccounts'] });
            queryClient.invalidateQueries({ queryKey: ['radarMetaData'] });
        }
    });

    // Auto-sync on mount and tab changes
    useEffect(() => {
        if (!isLoading && accounts.length === 0) {
            syncMutation.mutate();
        }
    }, [isLoading, accounts.length]);

    // Auto-sync when switching tabs
    useEffect(() => {
        if (activeTab === 'monitoramento' || activeTab === 'radar') {
            syncMutation.mutate();
        }
    }, [activeTab]);

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
        console.log('🟢🟢🟢 PROCESSANDO RADAR DATA');
        console.log('🟢 RadarMetaData tem', radarMetaData.length, 'registros');
        console.log('🟢 Clientes tem', clientes.length, 'registros');
        console.log('🟢 ClientesMap tem', clientesMap.size, 'registros');
        
        if (!radarMetaData.length) {
            console.log('❌ NENHUM DADO EM RADARMETA');
            return [];
        }
        
        const resultado = radarMetaData.map(radar => {
            const cliente = clientesMap.get(radar.account_name);
            if (!cliente) {
                console.log('❌ SEM MATCH:', radar.account_name);
            }
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

            // CPM calculado dos dados do radar (ontem)
            const impressionsOntem = radar.impressions_ontem || 0;
            const cpmAtual = (impressionsOntem > 0 && radar.amount_spent_ontem > 0) 
                ? (radar.amount_spent_ontem / impressionsOntem) * 1000 
                : 0;
            
            // Investimento diário vem direto da planilha "ontem meta ads" (amount_spent do dia anterior)
            const investimentoDiario = radar.amount_spent_ontem || 0;

            // Variações (Ontem vs 7d)
            const variacaoCPL = radar.variacao_cpl || 0;
            const variacaoCTR = radar.variacao_ctr || 0;

            // ========== NOVO MODELO DE RADAR SCORE ==========
            let radarScore = 0;
            let gastoSemConversao = false;
            let sinaisTendencia = 0;

            // ========== 1. PERFORMANCE ABSOLUTA (60 pontos) ==========
            
            // 1.1 CPL (30 pontos) - Faixas absolutas
            let scoreCPL = 0;
            if (cpl7d > 0) {
                if (cpl7d <= 20) scoreCPL = 30;
                else if (cpl7d <= 25) scoreCPL = 27;
                else if (cpl7d <= 30) scoreCPL = 24;
                else if (cpl7d <= 35) scoreCPL = 20;
                else if (cpl7d <= 40) scoreCPL = 15;
                else if (cpl7d <= 50) scoreCPL = 10;
                else if (cpl7d <= 60) scoreCPL = 5;
                else scoreCPL = 0;
            }
            radarScore += scoreCPL;

            // 1.2 Frequência (15 pontos) - Menor é melhor
            let scoreFrequencia = 0;
            if (frequencia7d > 0) {
                if (frequencia7d < 1.5) scoreFrequencia = 15;
                else if (frequencia7d < 1.8) scoreFrequencia = 13;
                else if (frequencia7d < 2.0) scoreFrequencia = 11;
                else if (frequencia7d < 2.5) scoreFrequencia = 8;
                else if (frequencia7d < 3.0) scoreFrequencia = 4;
                else scoreFrequencia = 0;
            }
            radarScore += scoreFrequencia;

            // 1.3 CTR (15 pontos)
            let scoreCTR = 0;
            if (ctr7d > 0) {
                if (ctr7d >= 2.5) scoreCTR = 15;
                else if (ctr7d >= 2.0) scoreCTR = 13;
                else if (ctr7d >= 1.5) scoreCTR = 11;
                else if (ctr7d >= 1.0) scoreCTR = 8;
                else if (ctr7d >= 0.7) scoreCTR = 5;
                else scoreCTR = 2;
            }
            radarScore += scoreCTR;

            // ========== 2. TENDÊNCIA (25 pontos) ==========
            let scoreTendencia = 12.5; // Base neutra

            // 2.1 Δ CPL (validado com leads)
            if (leadsOntem === 0 && investimentoDiario > 0) {
                gastoSemConversao = true;
                scoreTendencia -= 8;
                sinaisTendencia -= 2;
            } else if (leadsOntem > 0 && cplAtual > 0 && cpl7d > 0) {
                if (cplAtual < cpl7d * 0.85) {
                    scoreTendencia += 8;
                    sinaisTendencia++;
                } else if (cplAtual > cpl7d * 1.15) {
                    scoreTendencia -= 8;
                    sinaisTendencia--;
                }
            }

            // 2.2 Δ CTR
            if (ctrAtual > 0 && ctr7d > 0) {
                if (ctrAtual > ctr7d * 1.15) {
                    scoreTendencia += 6;
                    sinaisTendencia++;
                } else if (ctrAtual < ctr7d * 0.85) {
                    scoreTendencia -= 6;
                    sinaisTendencia--;
                }
            }

            // 2.3 Leads ontem vs média 7d
            if (leadsOntem > 0 && leadsDia7d > 0) {
                if (leadsOntem > leadsDia7d * 1.3) {
                    scoreTendencia += 6;
                    sinaisTendencia++;
                } else if (leadsOntem < leadsDia7d * 0.7) {
                    scoreTendencia -= 6;
                    sinaisTendencia--;
                }
            }

            radarScore += Math.max(0, Math.min(25, scoreTendencia));

            // ========== 3. ESTABILIDADE (15 pontos) ==========
            let scoreEstabilidade = 0;

            // 3.1 Gasto sem lead (penalidade já aplicada em tendência, mas reforçar)
            if (!gastoSemConversao && investimentoDiario > 0 && leadsOntem > 0) {
                scoreEstabilidade += 5;
            }

            // 3.2 Frequência saudável
            if (frequencia7d > 0) {
                if (frequencia7d < 2.0) scoreEstabilidade += 5;
                else if (frequencia7d < 2.5) scoreEstabilidade += 3;
                else if (frequencia7d >= 3.0) scoreEstabilidade -= 5;
            }

            // 3.3 % Leads repetidos (buscar do conta se disponível)
            const leadsRepetidosPercent = conta?.leads_repetidos_percent || 0;
            if (leadsRepetidosPercent < 15) scoreEstabilidade += 5;
            else if (leadsRepetidosPercent < 22) scoreEstabilidade += 3;
            else if (leadsRepetidosPercent >= 30) scoreEstabilidade -= 3;

            radarScore += Math.max(0, Math.min(15, scoreEstabilidade));

            // ========== SCORE FINAL ==========
            radarScore = Math.round(Math.max(0, Math.min(100, radarScore)));

            // ========== CLASSIFICAÇÃO DE ESTADO E TENDÊNCIA (para UI) ==========
            let estadoLabel = 'Saudável';
            if (radarScore < 40) estadoLabel = 'Crítico';
            else if (radarScore < 60) estadoLabel = 'Atenção';
            else if (radarScore < 75) estadoLabel = 'Operacional';
            else estadoLabel = 'Saudável';

            let tendenciaLabel = 'Neutra';
            if (sinaisTendencia >= 2) tendenciaLabel = 'Positiva';
            else if (sinaisTendencia <= -2) tendenciaLabel = 'Negativa';

            // ========== SCORE DE IMPACTO (para mapa de risco) ==========
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

            const estadoScore = radarScore;
            const tendenciaScore = 50 + (sinaisTendencia * 10);

            // ========== PRIORIZAÇÃO (matriz ESTADO x TENDÊNCIA) ==========
            let prioridadeRaw;
            
            if (radarScore < 40) {
                if (tendenciaLabel === 'Negativa') prioridadeRaw = 'critica';
                else if (tendenciaLabel === 'Positiva') prioridadeRaw = 'media';
                else prioridadeRaw = 'alta';
            } else if (radarScore < 60) {
                if (tendenciaLabel === 'Negativa') prioridadeRaw = 'alta';
                else if (tendenciaLabel === 'Positiva') prioridadeRaw = 'baixa';
                else prioridadeRaw = 'media';
            } else {
                if (tendenciaLabel === 'Negativa') prioridadeRaw = 'media';
                else prioridadeRaw = 'baixa';
            }

            // Elevar prioridade se houver eventos críticos
            if (frequencia7d >= 3.0) {
                prioridadeRaw = 'critica';
            } else if (frequencia7d >= 2.5 && prioridadeRaw === 'media') {
                prioridadeRaw = 'alta';
            }

            if (gastoSemConversao) {
                if (prioridadeRaw === 'baixa') prioridadeRaw = 'media';
                else if (prioridadeRaw === 'media') prioridadeRaw = 'alta';
            }

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

            if (gastoSemConversao) {
                status = '⚠️ ALERTA: Ontem houve gasto sem geração de leads - Revisar campanha';
            } else if (leadsOntem === 0 && investimentoDiario === 0) {
                status = '➡️ NEUTRO: Sem dados relevantes no último dia';
            } else {
                if (radarScore >= 85) {
                    status = '✅ EXCELENTE: Performance de elite - Manter padrão';
                } else if (radarScore >= 75) {
                    status = '✓ SAUDÁVEL: Performance boa e estável';
                } else if (radarScore >= 60) {
                    if (tendenciaLabel === 'Positiva') {
                        status = '🟢 MELHORA: Performance em recuperação';
                    } else {
                        status = '🟡 OPERACIONAL: Performance moderada';
                    }
                } else if (radarScore >= 40) {
                    if (tendenciaLabel === 'Negativa') {
                        status = '🟠 ALERTA: Indicadores com sinais de queda';
                    } else {
                        status = '🟡 ATENÇÃO: Performance abaixo do ideal';
                    }
                } else {
                    if (tendenciaLabel === 'Negativa') {
                        status = '🔴 CRÍTICO: Performance crítica e em deterioração - Ação imediata';
                    } else if (tendenciaLabel === 'Positiva') {
                        status = '🟠 RECUPERAÇÃO: Conta crítica, porém em melhora';
                    } else {
                        status = '🔴 CRÍTICO: Performance crítica - Requer otimização urgente';
                    }
                }
            }

            if (frequencia7d >= 3.0) {
                status += ' [⚠️ Saturação crítica]';
            } else if (frequencia7d >= 2.5) {
                status += ' [⚠️ Saturação elevada]';
            }

            // ========== PREVISÃO 7 DIAS ==========
            const taxaCPL = (cpl7d > 0 && cplAtual > 0) ? (cplAtual - cpl7d) / cpl7d : 0;
            const taxaCTR = (ctr7d > 0 && ctrAtual > 0) ? (ctrAtual - ctr7d) / ctr7d : 0;
            const taxaLeads = (leadsDia7d > 0 && leadsOntem > 0) ? (leadsOntem - leadsDia7d) / leadsDia7d : 0;

            const cplPrevisao = cplAtual > 0 ? cplAtual * (1 + taxaCPL * 0.5) : cpl7d;
            const ctrPrevisao = ctrAtual > 0 ? ctrAtual * (1 + taxaCTR * 0.5) : ctr7d;
            const leadsPrevisao = leadsOntem > 0 ? leadsOntem * (1 + taxaLeads * 0.5) : leadsDia7d;
            const freqPrevisao = frequencia7d;

            // Calcular radar score projetado usando o novo modelo
            let radarScorePrevisao = 0;

            // CPL projetado
            if (cplPrevisao > 0) {
                if (cplPrevisao <= 20) radarScorePrevisao += 30;
                else if (cplPrevisao <= 25) radarScorePrevisao += 27;
                else if (cplPrevisao <= 30) radarScorePrevisao += 24;
                else if (cplPrevisao <= 35) radarScorePrevisao += 20;
                else if (cplPrevisao <= 40) radarScorePrevisao += 15;
                else if (cplPrevisao <= 50) radarScorePrevisao += 10;
                else if (cplPrevisao <= 60) radarScorePrevisao += 5;
            }

            // Frequência projetada
            if (freqPrevisao > 0) {
                if (freqPrevisao < 1.5) radarScorePrevisao += 15;
                else if (freqPrevisao < 1.8) radarScorePrevisao += 13;
                else if (freqPrevisao < 2.0) radarScorePrevisao += 11;
                else if (freqPrevisao < 2.5) radarScorePrevisao += 8;
                else if (freqPrevisao < 3.0) radarScorePrevisao += 4;
            }

            // CTR projetado
            if (ctrPrevisao > 0) {
                if (ctrPrevisao >= 2.5) radarScorePrevisao += 15;
                else if (ctrPrevisao >= 2.0) radarScorePrevisao += 13;
                else if (ctrPrevisao >= 1.5) radarScorePrevisao += 11;
                else if (ctrPrevisao >= 1.0) radarScorePrevisao += 8;
                else if (ctrPrevisao >= 0.7) radarScorePrevisao += 5;
                else radarScorePrevisao += 2;
            }

            // Tendência mantém contribuição
            radarScorePrevisao += Math.max(0, Math.min(25, scoreTendencia));

            radarScorePrevisao = Math.round(Math.max(0, Math.min(100, radarScorePrevisao)));

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
        });
        
        console.log('✅✅✅ RESULTADO FINAL:', resultado.length, 'contas processadas');
        
        return resultado;
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

        if (radarResponsavelFilter !== 'all') {
            filtered = filtered.filter(d => d.cliente?.responsavel_voxx_trafego === radarResponsavelFilter);
        }

        return filtered.sort((a, b) => {
            // 0. Separar contas sem investimento para o final
            const aSemInv = a.investimentoDiario === 0 ? 1 : 0;
            const bSemInv = b.investimentoDiario === 0 ? 1 : 0;
            if (aSemInv !== bSemInv) return aSemInv - bSemInv;

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
        const contasComCPL = filteredRadarData.filter(d => d.cplAtual > 0);
        const avgCPL = contasComCPL.length > 0 ? contasComCPL.reduce((sum, d) => sum + d.cplAtual, 0) / contasComCPL.length : 0;
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
            <Tabs defaultValue="monitoramento" className="w-full" onValueChange={setActiveTab}>
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
                                    <TableHead className="text-right">CADASTROS</TableHead>
                                    <TableHead className="text-right">CADASTROS + WHATS</TableHead>
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
                                            {(() => {
                                                const custoConv = account.cadastros_whats > 0
                                                    ? account.amount_spent / account.cadastros_whats
                                                    : null;
                                                return custoConv != null ? (
                                                    <span className={custoConv >= 30 ? 'text-red-600 font-semibold' : ''}>
                                                        R$ {custoConv.toFixed(2)}
                                                    </span>
                                                ) : <span className="text-slate-400">—</span>;
                                            })()}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            R$ {account.amount_spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {account.messaging_conversations?.toFixed?.(0) || account.messaging_conversations || 0}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {account.new_messaging_connections?.toFixed?.(0) || account.new_messaging_connections || 0}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {account.leads?.toFixed?.(0) || account.leads || 0}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {account.cadastros_whats?.toFixed?.(0) || account.cadastros_whats || 0}
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
                            <RadarTable
                                filteredRadarData={filteredRadarData}
                                expandedRows={expandedRows}
                                toggleRow={toggleRow}
                                recommendations={recommendations}
                                accounts={accounts}
                                setSelectedAccountForOtimizacao={setSelectedAccountForOtimizacao}
                                setOtimizacaoModalOpen={setOtimizacaoModalOpen}
                                voxxUsers={voxxUsers}
                                loadingVoxxUsers={loadingVoxxUsers}
                                handleAssignResponsavelMeta={handleAssignResponsavelMeta}
                            />
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
                    <GamificacaoRadarV2 user={user} />
                </TabsContent>

                {/* Tab: Contas/Operador */}
                <TabsContent value="operadores" className="space-y-6 mt-6">
                    {/* Performance por Operador */}
                    <PerformancePorOperador radarData={radarData} clientes={clientes} />

                    {/* Gerenciar Responsáveis */}
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
                                                    <Select
                                                        value={cliente.responsavel_voxx_trafego || '__NONE__'}
                                                        onValueChange={(value) => {
                                                            console.log('📝 Mudança de responsável:', { 
                                                                clienteId: cliente.id, 
                                                                clienteNome: cliente.nome,
                                                                valorSelecionado: value,
                                                                voxxUsersTotal: voxxUsers.length
                                                            });
                                                            updateClienteMutation.mutate({ 
                                                                clienteId: cliente.id, 
                                                                responsavel: value
                                                            });
                                                        }}
                                                        disabled={updateClienteMutation.isPending || loadingVoxxUsers}
                                                    >
                                                        <SelectTrigger className="w-64">
                                                            <SelectValue placeholder="Selecione um responsável">
                                                                {loadingVoxxUsers ? 'Carregando...' : (() => {
                                                                    if (!cliente.responsavel_voxx_trafego) return 'Nenhum responsável';
                                                                    const user = voxxUsers.find(u => u.email === cliente.responsavel_voxx_trafego);
                                                                    return user?.full_name || cliente.responsavel_voxx_trafego;
                                                                })()}
                                                            </SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="__NONE__">Nenhum responsável</SelectItem>
                                                            {loadingVoxxUsers ? (
                                                                <SelectItem value="__LOADING__" disabled>Carregando usuários...</SelectItem>
                                                            ) : voxxUsers.length === 0 ? (
                                                                <SelectItem value="__EMPTY__" disabled>Nenhum usuário disponível</SelectItem>
                                                            ) : (
                                                                voxxUsers.map((voxxUser) => (
                                                                    <SelectItem key={voxxUser.id} value={voxxUser.email}>
                                                                        {voxxUser.full_name} ({voxxUser.email})
                                                                    </SelectItem>
                                                                ))
                                                            )}
                                                        </SelectContent>
                                                    </Select>
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