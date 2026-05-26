import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Calendar, TrendingUp, AlertTriangle, DollarSign, Target, ChevronDown, ChevronUp, Lock, Activity, CheckCircle, XCircle, Zap, Save, User, RefreshCw } from 'lucide-react';
import { format, differenceInDays, getDaysInMonth, startOfMonth, endOfMonth, startOfDay } from 'date-fns';
import { isVoxxAdmin, isVoxxOperacao } from '@/components/utils/auth';

const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function RecalculoMetaAds({ selectedClienteId, user }) {
  const queryClient = useQueryClient();
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1; // getMonth() retorna 0-11
  const currentMonth = `${ano}-${String(mes).padStart(2, '0')}`;
  
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [customConfigs, setCustomConfigs] = useState({}); // { clienteId: { enabled, percentage, cutoffDate, endDate } }
  const [savingConfigs, setSavingConfigs] = useState({}); // track saving state per cliente

  // Buscar todos os clientes
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientesRecalculo'],
    queryFn: () => base44.entities.Cliente.list('-nome', 500),
    staleTime: 2 * 60 * 1000
  });

  // Inicializar customConfigs quando clientes carregam (compatível com react-query v5)
  React.useEffect(() => {
    if (clientes.length > 0) {
      setCustomConfigs(prev => {
        const saved = {};
        clientes.forEach(c => {
          if (c.distribuicao_personalizada && !prev[c.id]) {
            saved[c.id] = c.distribuicao_personalizada;
          }
        });
        if (Object.keys(saved).length === 0) return prev;
        return { ...saved, ...prev };
      });
    }
  }, [clientes]);

  // Buscar planejamentos do mês atual
  const { data: planejamentos = [] } = useQuery({
    queryKey: ['planejamentosRecalculo', currentMonth],
    queryFn: () => base44.entities.PlanejamentoEstrategico.filter({
      mes_referencia: `${currentMonth}-01`
    }),
    staleTime: 30 * 1000
  });

  // Buscar valores investidos da planilha
  const { data: sheetData, isFetching: fetchingSheet, refetch: refetchSheet } = useQuery({
    queryKey: ['amountSpentFromSheet'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getAmountSpentFromSheet', {});
      return response.data;
    },
    staleTime: 0
  });

  const amountSpentByAccount = sheetData?.amountSpentByAccount || {};
  const diarioD1ByAccount = sheetData?.diarioD1ByAccount || {};

  // ClientAdAccount não está sendo usada, buscaremos direto do Cliente
  // const { data: clientAdAccounts = [] } = useQuery({
  //   queryKey: ['clientAdAccountsRecalculo'],
  //   queryFn: () => base44.entities.ClientAdAccount.filter({ platform: 'Meta' }),
  //   staleTime: 2 * 60 * 1000
  // });

  // Processar dados
  const dadosRecalculo = useMemo(() => {
    return clientes.map(cliente => {
      const planejamento = planejamentos.find(p => p.cliente_id === cliente.id);
      
      if (!planejamento) {
        return null;
      }

      // Buscar valor investido e diário D-1 diretamente do nome do cliente
      let valorInvestido = 0;
      let diarioD1 = 0;
      
      const nomeCliente = cliente.nome?.trim();
      const metaAccountName = cliente.meta_ads_account_name?.trim();
      const legacyKey = cliente.legacy_client_key?.trim();
      // Nomes das contas Meta Ads vinculadas (contas_anuncio)
      const contasMetaNomes = (cliente.contas_anuncio || [])
        .filter(c => c.plataforma === 'Meta' && c.conta_nome)
        .map(c => c.conta_nome.trim())
        .filter(Boolean);

      // Normalizar nome: remove prefixos numéricos, sufixos de versão/status, espaços e hífens
      const normalizeNome = (nome) => {
        return nome?.toLowerCase()
          .replace(/^\d+\s*[-–]\s*/, '')           // Remove "275 - " no início
          .replace(/\s*\(\d+\)\s*/g, ' ')          // Remove "(1)", "(2)", "(4)" etc.
          .replace(/\s*\[ativa\]\s*/gi, ' ')       // Remove "[ATIVA]"
          .replace(/\s*\(ativa\)\s*/gi, ' ')       // Remove "(ATIVA)"
          .replace(/\s*\(nova\)\s*/gi, ' ')        // Remove "(nova)"
          .replace(/\s*\[as\]\s*/gi, ' ')          // Remove "[AS]"
          .replace(/\s*[-–]\s*/g, ' ')             // Normaliza hífens
          .replace(/\s+/g, ' ')
          .trim() || '';
      };

      // Pré-processar chaves da planilha: trim e criar índice normalizado
      const sheetKeys = Object.keys(amountSpentByAccount);
      // Índice: chave trimmed -> chave original
      const sheetKeysTrimmed = {};
      sheetKeys.forEach(k => { sheetKeysTrimmed[k.trim()] = k; });

      const findInSheet = (chave) => {
        if (!chave) return null;
        const chaveTrimmed = chave.trim();
        // 1. Exato (com trim)
        if (sheetKeysTrimmed[chaveTrimmed] !== undefined) return sheetKeysTrimmed[chaveTrimmed];
        const chaveNorm = normalizeNome(chaveTrimmed);
        if (!chaveNorm) return null;
        // 2. Normalizado exato
        const exactNorm = sheetKeys.find(k => normalizeNome(k) === chaveNorm);
        if (exactNorm) return exactNorm;
        // 3. Parcial: um contém o outro (min 5 chars para evitar falsos positivos)
        if (chaveNorm.length >= 5) {
          const partial = sheetKeys.find(k => {
            const kNorm = normalizeNome(k);
            return kNorm.includes(chaveNorm) || chaveNorm.includes(kNorm);
          });
          if (partial) return partial;
        }
        return null;
      };

      // Ordem de prioridade: contas_anuncio > meta_ads_account_name > legacy_client_key > nome
      let matchKey = null;
      for (const contaNome of contasMetaNomes) {
        matchKey = findInSheet(contaNome);
        if (matchKey) break;
      }
      if (!matchKey) matchKey = findInSheet(metaAccountName);
      if (!matchKey) matchKey = findInSheet(legacyKey);
      if (!matchKey) matchKey = findInSheet(nomeCliente);

      if (matchKey) {
        valorInvestido = amountSpentByAccount[matchKey] || 0;
        diarioD1 = diarioD1ByAccount[matchKey] || 0;
      }

      // Cálculos base
      const investimentoTotal = (planejamento.meta_faturamento * planejamento.percentual_investimento_marketing) / 100;
      const totalMetaAds = investimentoTotal - (planejamento.investimento_google || 0) - (planejamento.investimento_tiktok || 0);
      const valorImpostos = (totalMetaAds * planejamento.percentual_impostos) / 100;
      const investimentoLeads = totalMetaAds - valorImpostos - (planejamento.investimento_feed || 0);
      
      const budgetMensal = investimentoLeads;
      const investimentoFeed = planejamento.investimento_feed || 0;
      const budgetRestante = budgetMensal - valorInvestido;

      // Data final e dias restantes
      const config = customConfigs[cliente.id] || {};
      // Usar o último dia do mês CORRENTE
      const mesReferencia = new Date(ano, mes - 1, 1);
      const ultimoDiaMes = endOfMonth(mesReferencia);
      const dataFinal = config.endDate || format(ultimoDiaMes, 'yyyy-MM-dd');
      const diasRestantes = Math.max(0, differenceInDays(startOfDay(new Date(dataFinal + 'T23:59:59')), startOfDay(hoje)));
      const totalDiasMes = getDaysInMonth(mesReferencia);

      // Calcular feed proporcional restante
      const feedProporcionalRestante = totalDiasMes > 0 && diasRestantes > 0 
        ? (investimentoFeed / totalDiasMes) * diasRestantes 
        : 0;

      // Budget restante ajustado (subtraindo o feed proporcional)
      const budgetRestanteAjustado = budgetRestante - feedProporcionalRestante;

      // Investimento diário
      let investimentoDiarioRecalculado = 0;
      let investimentoDiarioFase1 = 0;
      let investimentoDiarioFase2 = 0;
      let diasFase1 = 0;
      let diasFase2 = 0;

      if (config.enabled && config.percentage && config.cutoffDate) {
        // Distribuição personalizada
        const budgetFase1 = budgetMensal * (config.percentage / 100);
        const budgetFase2 = budgetMensal - budgetFase1;
        
        const dataCorte = new Date(config.cutoffDate);
        const hoje = new Date();
        
        if (hoje < dataCorte) {
          // Ainda estamos na fase 1
          diasFase1 = Math.max(0, differenceInDays(dataCorte, hoje));
          diasFase2 = Math.max(0, differenceInDays(new Date(dataFinal), dataCorte));
          
          if (diasFase1 > 0) {
            const budgetRestanteFase1 = Math.max(0, budgetFase1 - valorInvestido - feedProporcionalRestante);
            investimentoDiarioFase1 = budgetRestanteFase1 / diasFase1;
          }
          
          if (diasFase2 > 0) {
            investimentoDiarioFase2 = budgetFase2 / diasFase2;
          }
          
          investimentoDiarioRecalculado = investimentoDiarioFase1;
        } else {
          // Estamos na fase 2
          diasFase2 = Math.max(0, differenceInDays(new Date(dataFinal), hoje));
          
          if (diasFase2 > 0) {
            const budgetRestanteFase2 = Math.max(0, budgetMensal - valorInvestido - feedProporcionalRestante);
            investimentoDiarioFase2 = budgetRestanteFase2 / diasFase2;
          }
          
          investimentoDiarioRecalculado = investimentoDiarioFase2;
        }
      } else {
        // Cálculo padrão
        if (diasRestantes > 0 && budgetRestanteAjustado > 0) {
          investimentoDiarioRecalculado = budgetRestanteAjustado / diasRestantes;
        }
      }

      const investimentoDiarioMedio = totalDiasMes > 0 ? budgetMensal / totalDiasMes : 0;

      return {
        cliente,
        planejamento,
        budgetMensal,
        investimentoFeed,
        valorInvestido,
        budgetRestante,
        dataFinal,
        diasRestantes,
        investimentoDiarioRecalculado,
        investimentoDiarioMedio,
        config,
        investimentoDiarioFase1,
        investimentoDiarioFase2,
        diasFase1,
        diasFase2,
        diarioD1
      };
    }).filter(Boolean);
  }, [clientes, planejamentos, amountSpentByAccount, customConfigs, currentMonth]);

  // Filtrar por busca e status
  const dadosFiltrados = useMemo(() => {
    let filtered = dadosRecalculo;
    
    // Filtro de busca
    if (searchTerm.trim()) {
      filtered = filtered.filter(d => 
        d.cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.cliente.cidade?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filtro de status
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(d => {
        const diarioD1 = d.diarioD1 || 0;
        const recalculado = d.investimentoDiarioRecalculado || 0;
        const minimo = recalculado * 0.85;
        const maximo = recalculado * 1.15;
        
        switch (statusFilter) {
          case 'sem_investimento':
            return diarioD1 === 0;
          case 'abaixo':
            return diarioD1 > 0 && diarioD1 < minimo;
          case 'dentro':
            return diarioD1 >= minimo && diarioD1 <= maximo;
          case 'acima':
            return diarioD1 > maximo;
          default:
            return true;
        }
      });
    }
    
    return filtered;
  }, [dadosRecalculo, searchTerm, statusFilter]);

  // Ordenar por impacto (maior diferença entre D-1 e recalculado)
  const dadosOrdenados = [...dadosFiltrados].sort((a, b) => {
    const diferencaA = Math.abs(a.investimentoDiarioRecalculado - a.diarioD1);
    const diferencaB = Math.abs(b.investimentoDiarioRecalculado - b.diarioD1);
    return diferencaB - diferencaA;
  });

  // Métricas de Monitoramento
  const metricas = useMemo(() => {
    const totalD1 = dadosOrdenados.reduce((acc, d) => acc + d.diarioD1, 0);
    const totalRecalculado = dadosOrdenados.reduce((acc, d) => acc + d.investimentoDiarioRecalculado, 0);
    const diferenca = totalRecalculado - totalD1;
    
    const semD1 = dadosOrdenados.filter(d => d.diarioD1 === 0).length;
    const abaixoSugerido = dadosOrdenados.filter(d => d.diarioD1 > 0 && d.diarioD1 < d.investimentoDiarioRecalculado * 0.85).length;
    const dentroFaixa = dadosOrdenados.filter(d => {
      if (d.diarioD1 === 0) return false;
      const percentual = (d.diarioD1 / d.investimentoDiarioRecalculado) * 100;
      return percentual >= 85 && percentual <= 115;
    }).length;
    const acimaSugerido = dadosOrdenados.filter(d => d.diarioD1 > d.investimentoDiarioRecalculado * 1.15).length;
    
    const mediaVariacao = dadosOrdenados.length > 0
      ? dadosOrdenados.reduce((acc, d) => {
          if (d.investimentoDiarioRecalculado === 0) return acc;
          return acc + Math.abs(((d.diarioD1 - d.investimentoDiarioRecalculado) / d.investimentoDiarioRecalculado) * 100);
        }, 0) / dadosOrdenados.length
      : 0;

    return {
      totalD1,
      totalRecalculado,
      diferenca,
      semD1,
      abaixoSugerido,
      dentroFaixa,
      acimaSugerido,
      mediaVariacao
    };
  }, [dadosOrdenados]);

  const toggleCard = (clienteId) => {
    const newSet = new Set(expandedCards);
    if (newSet.has(clienteId)) {
      newSet.delete(clienteId);
    } else {
      newSet.add(clienteId);
    }
    setExpandedCards(newSet);
  };

  const handleConfigChange = (clienteId, field, value) => {
    setCustomConfigs(prev => ({
      ...prev,
      [clienteId]: {
        ...prev[clienteId],
        [field]: value
      }
    }));
  };

  const handleSaveConfig = async (clienteId) => {
    const config = customConfigs[clienteId] || {};
    setSavingConfigs(prev => ({ ...prev, [clienteId]: true }));
    try {
      await base44.entities.Cliente.update(clienteId, {
        distribuicao_personalizada: {
          ...config,
          atualizado_por_nome: user?.full_name || user?.email,
          atualizado_por_email: user?.email,
          atualizado_em: new Date().toISOString()
        }
      });
      queryClient.invalidateQueries({ queryKey: ['clientesRecalculo'] });
    } finally {
      setSavingConfigs(prev => ({ ...prev, [clienteId]: false }));
    }
  };

  const getImpactoColor = (recalculado, diarioD1) => {
    const diferenca = Math.abs(recalculado - diarioD1);
    const percentual = diarioD1 > 0 ? (diferenca / diarioD1) * 100 : 0;
    
    if (percentual > 30) return 'bg-red-50 border-red-300';
    if (percentual > 15) return 'bg-yellow-50 border-yellow-300';
    return 'bg-green-50 border-green-300';
  };

  if (!user || (!isVoxxAdmin(user) && !isVoxxOperacao(user))) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Lock className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Acesso Restrito</h2>
            <p className="text-slate-600">
              Esta página é acessível apenas para usuários da equipe Voxx.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Recálculo Meta Ads</h1>
          <p className="text-slate-500">
            Recalcule o investimento diário ideal com base no budget restante e dias disponíveis
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['amountSpentFromSheet'] });
            queryClient.invalidateQueries({ queryKey: ['clientesRecalculo'] });
            queryClient.invalidateQueries({ queryKey: ['planejamentosRecalculo'] });
            refetchSheet();
          }}
          disabled={fetchingSheet}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${fetchingSheet ? 'animate-spin' : ''}`} />
          {fetchingSheet ? 'Atualizando...' : 'Atualizar Dados'}
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-4">
        <Input
          placeholder="Buscar por cliente ou cidade..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="sem_investimento">Sem investimento</SelectItem>
            <SelectItem value="abaixo">Abaixo do sugerido</SelectItem>
            <SelectItem value="dentro">Dentro da faixa</SelectItem>
            <SelectItem value="acima">Acima do sugerido</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="px-3 py-2">
          <Calendar className="w-4 h-4 mr-2" />
          Mês: {mes}/{ano}
        </Badge>
      </div>

      {/* Resumo */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total de Unidades</p>
                <p className="text-2xl font-bold text-slate-900">{dadosOrdenados.length}</p>
              </div>
              <Target className="w-8 h-8 text-violet-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Budget Total Mensal</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(dadosOrdenados.reduce((acc, d) => acc + d.budgetMensal, 0))}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Já Investido</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(dadosOrdenados.reduce((acc, d) => acc + d.valorInvestido, 0))}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard de Monitoramento */}
      <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-violet-600" />
            <CardTitle className="text-lg">Monitoramento de Investimento Diário (D-1)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="text-2xl font-bold text-red-700">{metricas.semD1}</span>
                </div>
                <p className="text-xs text-red-700 font-medium">Sem Investimento D-1</p>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span className="text-2xl font-bold text-amber-700">{metricas.abaixoSugerido}</span>
                </div>
                <p className="text-xs text-amber-700 font-medium">Abaixo do Sugerido (&lt;85%)</p>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="text-2xl font-bold text-emerald-700">{metricas.dentroFaixa}</span>
                </div>
                <p className="text-xs text-emerald-700 font-medium">Dentro da Faixa (85-115%)</p>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  <span className="text-2xl font-bold text-blue-700">{metricas.acimaSugerido}</span>
                </div>
                <p className="text-xs text-blue-700 font-medium">Acima do Sugerido (&gt;115%)</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <Card className="bg-slate-50">
              <CardContent className="pt-4">
                <p className="text-xs text-slate-600 mb-1">Total Investido D-1</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(metricas.totalD1)}</p>
              </CardContent>
            </Card>

            <Card className="bg-violet-50">
              <CardContent className="pt-4">
                <p className="text-xs text-slate-600 mb-1">Total Diário Recalculado</p>
                <p className="text-xl font-bold text-violet-700">{formatCurrency(metricas.totalRecalculado)}</p>
              </CardContent>
            </Card>

            <Card className={metricas.diferenca >= 0 ? 'bg-green-50' : 'bg-red-50'}>
              <CardContent className="pt-4">
                <p className="text-xs text-slate-600 mb-1">Diferença (Recalc. - D-1)</p>
                <p className={`text-xl font-bold ${metricas.diferenca >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {metricas.diferenca >= 0 ? '+' : ''}{formatCurrency(metricas.diferenca)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-50">
              <CardContent className="pt-4">
                <p className="text-xs text-slate-600 mb-1">Variação Média</p>
                <p className="text-xl font-bold text-slate-900">{metricas.mediaVariacao.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Unidades */}
      <div className="space-y-4">
        {dadosOrdenados.length === 0 ? (
          <Card className="p-8">
            <p className="text-center text-slate-500">
              Nenhum planejamento encontrado para o mês atual.
            </p>
          </Card>
        ) : (
          dadosOrdenados.map(dados => {
            const isExpanded = expandedCards.has(dados.cliente.id);
            const impactoColor = getImpactoColor(dados.investimentoDiarioRecalculado, dados.diarioD1);
            
            return (
              <Card key={dados.cliente.id} className={`border-2 ${impactoColor}`}>
                <CardHeader 
                  className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => toggleCard(dados.cliente.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Calculator className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{dados.cliente.nome}</CardTitle>
                        <p className="text-sm text-slate-500">
                          {dados.cliente.cidade} - {dados.cliente.estado}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 mr-4">
                      <div className="text-right">
                        <p className="text-xs text-slate-600 mb-1">Diário (D-1)</p>
                        <p className="text-sm font-semibold text-blue-600">
                          {formatCurrency(dados.diarioD1)}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-xs text-slate-600 mb-1">Diário Atual</p>
                        <p className="text-sm font-semibold text-slate-700">
                          {formatCurrency(dados.investimentoDiarioMedio)}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-xs text-slate-600 mb-1">Diário Recalculado</p>
                        <p className="text-2xl font-bold text-violet-600">
                          {formatCurrency(dados.investimentoDiarioRecalculado)}
                        </p>
                      </div>

                      {dados.diasRestantes <= 0 || dados.budgetRestante <= 0 ? (
                        <Badge variant="destructive" className="ml-2">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Atenção
                        </Badge>
                      ) : null}
                    </div>

                    <Button variant="ghost" size="icon">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </Button>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-6 pt-0">
                    {/* Dados Gerais */}
                    <div className="grid md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-xs text-slate-600 mb-1">Budget Mensal (Leads)</p>
                        <p className="text-lg font-semibold text-slate-900">{formatCurrency(dados.budgetMensal)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 mb-1">Investimento em Feed</p>
                        <p className="text-lg font-semibold text-slate-900">{formatCurrency(dados.investimentoFeed)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 mb-1">Valor Investido no Mês</p>
                        <p className="text-lg font-semibold text-blue-700">{formatCurrency(dados.valorInvestido)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 mb-1">Budget Restante</p>
                        <p className="text-lg font-semibold text-green-700">{formatCurrency(dados.budgetRestante)}</p>
                      </div>
                    </div>

                    {/* Configuração de Datas */}
                    <div className="grid md:grid-cols-3 gap-4 p-4 border-2 border-violet-200 rounded-lg">
                      <div>
                        <Label htmlFor={`end-${dados.cliente.id}`} className="text-xs">Data Final do Planejamento</Label>
                        <Input
                          id={`end-${dados.cliente.id}`}
                          type="date"
                          value={dados.dataFinal}
                          onChange={(e) => handleConfigChange(dados.cliente.id, 'endDate', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Dias Restantes</Label>
                        <div className="mt-1 h-9 px-3 flex items-center bg-slate-100 rounded-md border">
                          <span className="text-lg font-bold text-slate-900">{dados.diasRestantes}</span>
                          <span className="text-xs text-slate-600 ml-2">dias</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Total de Dias do Mês</Label>
                        <div className="mt-1 h-9 px-3 flex items-center bg-slate-100 rounded-md border">
                          <span className="text-lg font-bold text-slate-900">
                            {getDaysInMonth(new Date(currentMonth + '-01'))}
                          </span>
                          <span className="text-xs text-slate-600 ml-2">dias</span>
                        </div>
                      </div>
                    </div>

                    {/* Alertas */}
                    {dados.diasRestantes <= 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription>
                          Sem dias restantes. Investimento diário definido como R$ 0,00
                        </AlertDescription>
                      </Alert>
                    )}

                    {dados.budgetRestante <= 0 && dados.diasRestantes > 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription>
                          Budget restante esgotado. Investimento diário definido como R$ 0,00
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Distribuição Personalizada */}
                    <div className="border-2 border-dashed border-violet-300 rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={dados.config.enabled || false}
                            onCheckedChange={(checked) => handleConfigChange(dados.cliente.id, 'enabled', checked)}
                          />
                          <Label className="font-semibold text-slate-900">
                            Usar Distribuição Personalizada
                          </Label>
                          {dados.config.atualizado_por_nome && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <User className="w-3 h-3" />
                              Último lançamento: <strong>{dados.config.atualizado_por_nome}</strong>
                              {dados.config.atualizado_em && (
                                <span className="text-slate-400">
                                  {' '}({format(new Date(dados.config.atualizado_em), 'dd/MM HH:mm')})
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-violet-700 border-violet-300 hover:bg-violet-50"
                          onClick={(e) => { e.stopPropagation(); handleSaveConfig(dados.cliente.id); }}
                          disabled={savingConfigs[dados.cliente.id]}
                        >
                          <Save className="w-3 h-3 mr-1" />
                          {savingConfigs[dados.cliente.id] ? 'Salvando...' : 'Salvar'}
                        </Button>
                      </div>

                      {dados.config.enabled && (
                        <div className="grid md:grid-cols-2 gap-4 pl-8">
                          <div>
                            <Label htmlFor={`perc-${dados.cliente.id}`} className="text-xs">
                              % do Budget para Fase 1
                            </Label>
                            <Input
                              id={`perc-${dados.cliente.id}`}
                              type="number"
                              min="0"
                              max="100"
                              value={dados.config.percentage || ''}
                              onChange={(e) => handleConfigChange(dados.cliente.id, 'percentage', parseFloat(e.target.value) || 0)}
                              placeholder="Ex: 60"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`cutoff-${dados.cliente.id}`} className="text-xs">
                              Data de Corte
                            </Label>
                            <Input
                              id={`cutoff-${dados.cliente.id}`}
                              type="date"
                              value={dados.config.cutoffDate || ''}
                              onChange={(e) => handleConfigChange(dados.cliente.id, 'cutoffDate', e.target.value)}
                              className="mt-1"
                            />
                          </div>

                          {dados.config.percentage && dados.config.cutoffDate && (
                            <div className="col-span-2 grid md:grid-cols-2 gap-4 p-3 bg-violet-50 rounded-lg">
                              <div>
                                <p className="text-xs text-slate-600 mb-1">Fase 1 (até {format(new Date(dados.config.cutoffDate), 'dd/MM')})</p>
                                <p className="text-sm font-semibold text-violet-700">
                                  {formatCurrency(dados.investimentoDiarioFase1)}/dia
                                </p>
                                <p className="text-xs text-slate-500">{dados.diasFase1} dias restantes</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-600 mb-1">Fase 2 (após {format(new Date(dados.config.cutoffDate), 'dd/MM')})</p>
                                <p className="text-sm font-semibold text-violet-700">
                                  {formatCurrency(dados.investimentoDiarioFase2)}/dia
                                </p>
                                <p className="text-xs text-slate-500">{dados.diasFase2} dias</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Resultado Final */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <Card className="bg-slate-50">
                        <CardContent className="pt-6">
                          <p className="text-sm text-slate-600 mb-2">Investimento Diário Médio do Mês</p>
                          <p className="text-3xl font-bold text-slate-700">
                            {formatCurrency(dados.investimentoDiarioMedio)}
                          </p>
                          <p className="text-xs text-slate-500 mt-2">
                            Budget / Total de dias
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-violet-500 to-violet-600 text-white">
                        <CardContent className="pt-6">
                          <p className="text-sm opacity-90 mb-2">✨ Investimento Diário Recalculado</p>
                          <p className="text-4xl font-bold">
                            {formatCurrency(dados.investimentoDiarioRecalculado)}
                          </p>
                          <p className="text-xs opacity-75 mt-2">
                            Valor ideal para os próximos {dados.diasRestantes} dias
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}