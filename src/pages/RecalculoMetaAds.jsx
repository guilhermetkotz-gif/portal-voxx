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
import { Calculator, Calendar, TrendingUp, AlertTriangle, DollarSign, Target, ChevronDown, ChevronUp } from 'lucide-react';
import { format, differenceInDays, getDaysInMonth, startOfMonth, endOfMonth } from 'date-fns';

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
  const [customConfigs, setCustomConfigs] = useState({}); // { clienteId: { enabled, percentage, cutoffDate, endDate } }

  // Buscar todos os clientes
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientesRecalculo'],
    queryFn: () => base44.entities.Cliente.list('-nome', 500),
    staleTime: 2 * 60 * 1000
  });

  // Buscar planejamentos do mês atual
  const { data: planejamentos = [] } = useQuery({
    queryKey: ['planejamentosRecalculo', currentMonth],
    queryFn: () => base44.entities.PlanejamentoEstrategico.filter({
      mes_referencia: `${currentMonth}-01`
    }),
    staleTime: 30 * 1000
  });

  // Buscar valores investidos da planilha
  const { data: sheetData } = useQuery({
    queryKey: ['amountSpentFromSheet'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getAmountSpentFromSheet', {});
      return response.data;
    },
    staleTime: 2 * 60 * 1000
  });

  const amountSpentByAccount = sheetData?.amountSpentByAccount || {};

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

      // Buscar valor investido diretamente do nome do cliente
      // A planilha usa nomes como "Oral Sin - Castanhal (nova)"
      let valorInvestido = 0;
      
      // Tentar encontrar o nome exato primeiro
      const nomeCliente = cliente.nome?.trim();
      if (nomeCliente && amountSpentByAccount[nomeCliente] !== undefined) {
        valorInvestido = amountSpentByAccount[nomeCliente];
      } else {
        // Buscar por correspondência parcial (case-insensitive)
        const clienteNormalized = nomeCliente?.toLowerCase();
        const matchingKey = Object.keys(amountSpentByAccount).find(key => 
          key.toLowerCase() === clienteNormalized
        );
        
        if (matchingKey) {
          valorInvestido = amountSpentByAccount[matchingKey];
        }
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
      const dataFinal = config.endDate || format(endOfMonth(new Date(currentMonth + '-01')), 'yyyy-MM-dd');
      const diasRestantes = Math.max(0, differenceInDays(new Date(dataFinal), new Date()) + 1);
      const totalDiasMes = getDaysInMonth(new Date(currentMonth + '-01'));

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
            const budgetRestanteFase1 = Math.max(0, budgetFase1 - valorInvestido);
            investimentoDiarioFase1 = budgetRestanteFase1 / diasFase1;
          }
          
          if (diasFase2 > 0) {
            investimentoDiarioFase2 = budgetFase2 / diasFase2;
          }
          
          investimentoDiarioRecalculado = investimentoDiarioFase1;
        } else {
          // Estamos na fase 2
          diasFase2 = Math.max(0, differenceInDays(new Date(dataFinal), hoje) + 1);
          
          if (diasFase2 > 0) {
            const budgetRestanteFase2 = Math.max(0, budgetMensal - valorInvestido);
            investimentoDiarioFase2 = budgetRestanteFase2 / diasFase2;
          }
          
          investimentoDiarioRecalculado = investimentoDiarioFase2;
        }
      } else {
        // Cálculo padrão
        if (diasRestantes > 0 && budgetRestante > 0) {
          investimentoDiarioRecalculado = budgetRestante / diasRestantes;
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
        diasFase2
      };
    }).filter(Boolean);
  }, [clientes, planejamentos, amountSpentByAccount, clientAdAccounts, customConfigs, currentMonth]);

  // Filtrar por busca
  const dadosFiltrados = dadosRecalculo.filter(d => 
    d.cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.cliente.cidade?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Ordenar por impacto (maior diferença entre médio e recalculado)
  const dadosOrdenados = [...dadosFiltrados].sort((a, b) => {
    const diferencaA = Math.abs(a.investimentoDiarioRecalculado - a.investimentoDiarioMedio);
    const diferencaB = Math.abs(b.investimentoDiarioRecalculado - b.investimentoDiarioMedio);
    return diferencaB - diferencaA;
  });

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

  const getImpactoColor = (recalculado, medio) => {
    const diferenca = Math.abs(recalculado - medio);
    const percentual = medio > 0 ? (diferenca / medio) * 100 : 0;
    
    if (percentual > 30) return 'bg-red-50 border-red-300';
    if (percentual > 15) return 'bg-yellow-50 border-yellow-300';
    return 'bg-green-50 border-green-300';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Recálculo Meta Ads</h1>
        <p className="text-slate-500">
          Recalcule o investimento diário ideal com base no budget restante e dias disponíveis
        </p>
      </div>

      {/* Filtros */}
      <div className="flex gap-4">
        <Input
          placeholder="Buscar por cliente ou cidade..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
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
            const impactoColor = getImpactoColor(dados.investimentoDiarioRecalculado, dados.investimentoDiarioMedio);
            
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
                        </div>
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