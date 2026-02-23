import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp, Target, DollarSign, Activity, ChevronRight, X, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function PerformancePorOperadorGoogleAds({ googleAdsAccounts, voxxUsers, clientes }) {
  const [sortBy, setSortBy] = useState('healthScore');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedOperador, setSelectedOperador] = useState(null);

  // Agregar dados por responsável
  const performancePorOperador = useMemo(() => {
    if (!googleAdsAccounts || googleAdsAccounts.length === 0) {
      return [];
    }

    // Map para agrupar por responsável
    const operadoresMap = new Map();

    googleAdsAccounts.forEach((conta) => {
      const responsavel = conta.responsavel_voxx;
      
      // Só incluir contas que têm responsável definido
      if (!responsavel || responsavel === '__NONE__') return;
      // Pular contas sem dados
      if (conta.conta_sem_dados) return;

      if (!operadoresMap.has(responsavel)) {
        operadoresMap.set(responsavel, {
          responsavel,
          responsavel_nome: responsavel,
          contas: [],
          totalContas: 0,
          healthScoreTotal: 0,
          conversionsTotal: 0,
          costTotal: 0,
          clicksTotal: 0,
          cpaTotal: 0,
          cpcTotal: 0,
          // Para médias ponderadas
          cpaPonderado: 0,
          cpcPonderado: 0,
          pesoConversions: 0,
          pesoClicks: 0,
        });
      }

      const operador = operadoresMap.get(responsavel);
      operador.contas.push(conta);
      operador.totalContas++;

      // Somar métricas
      operador.healthScoreTotal += conta.health_score || 0;
      operador.conversionsTotal += conta.conversions || 0;
      operador.costTotal += conta.cost || 0;
      operador.clicksTotal += conta.clicks || 0;
      operador.pesoConversions += conta.conversions || 0;
      operador.pesoClicks += conta.clicks || 0;

      // Acumular valores ponderados
      if (conta.conversions > 0 && conta.cost_per_conversion > 0) {
        operador.cpaPonderado += conta.cost_per_conversion * conta.conversions;
      }
      if (conta.clicks > 0 && conta.avg_cpc > 0) {
        operador.cpcPonderado += conta.avg_cpc * conta.clicks;
      }
    });

    // Calcular médias
    const operadores = Array.from(operadoresMap.values()).map((op) => {
      const healthScoreMedio = op.totalContas > 0 ? op.healthScoreTotal / op.totalContas : 0;
      
      // CPA médio ponderado por conversões
      const cpaMedio = op.pesoConversions > 0 
        ? op.cpaPonderado / op.pesoConversions 
        : op.contas.filter(c => c.cost_per_conversion > 0).length > 0
          ? op.contas.reduce((sum, c) => sum + (c.cost_per_conversion || 0), 0) / op.contas.filter(c => c.cost_per_conversion > 0).length
          : 0;

      // CPC médio ponderado por cliques
      const cpcMedio = op.pesoClicks > 0
        ? op.cpcPonderado / op.pesoClicks
        : op.totalContas > 0
          ? op.contas.reduce((sum, c) => sum + (c.avg_cpc || 0), 0) / op.totalContas
          : 0;

      // Optimization Score médio
      const optimizationScoreMedio = op.totalContas > 0
        ? op.contas.reduce((sum, c) => sum + (c.optimization_score || 0), 0) / op.totalContas
        : 0;
      
      // Calcular distribuição de health status
      const contasUrgentes = op.contas.filter(c => c.health_status === 'Urgente').length;
      const contasCriticas = op.contas.filter(c => c.health_status === 'Crítico').length;
      const contasAtencao = op.contas.filter(c => c.health_status === 'Atenção').length;
      const contasSaudaveis = op.contas.filter(c => c.health_status === 'Saudável').length;

      return {
        ...op,
        healthScoreMedio: Math.round(healthScoreMedio),
        cpaMedio: cpaMedio,
        cpcMedio: cpcMedio,
        optimizationScoreMedio: Math.round(optimizationScoreMedio),
        conversoesMedioDia: op.totalContas > 0 ? op.conversionsTotal / op.totalContas : 0,
        contasUrgentes,
        contasCriticas,
        contasAtencao,
        contasSaudaveis,
      };
    });

    // Ordenar
    const operadoresFiltrados = operadores.filter(op => op.totalContas > 0);

    return operadoresFiltrados.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'healthScore':
          comparison = a.healthScoreMedio - b.healthScoreMedio;
          break;
        case 'contas':
          comparison = a.totalContas - b.totalContas;
          break;
        case 'cpa':
          comparison = a.cpaMedio - b.cpaMedio;
          break;
        case 'cpc':
          comparison = a.cpcMedio - b.cpcMedio;
          break;
        case 'conversions':
          comparison = a.conversionsTotal - b.conversionsTotal;
          break;
        case 'investimento':
          comparison = a.costTotal - b.costTotal;
          break;
        case 'urgentes':
          comparison = a.contasUrgentes - b.contasUrgentes;
          break;
        default:
          comparison = a.healthScoreMedio - b.healthScoreMedio;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [googleAdsAccounts, sortBy, sortOrder]);

  const formatCurrency = (value) => {
    if (value === 0 || !value) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'healthScore' || field === 'urgentes' ? 'asc' : 'desc');
    }
  };

  const getHealthScoreColor = (score) => {
    if (score >= 85) return 'text-green-700 bg-green-50';
    if (score >= 70) return 'text-yellow-700 bg-yellow-50';
    if (score >= 50) return 'text-orange-700 bg-orange-50';
    return 'text-red-700 bg-red-50';
  };

  const getHealthStatusBadge = (status) => {
    const colors = {
      'Saudável': 'bg-green-600 text-white',
      'Atenção': 'bg-yellow-600 text-white',
      'Crítico': 'bg-orange-600 text-white',
      'Urgente': 'bg-red-600 text-white',
      'Sem dados': 'bg-gray-400 text-white'
    };
    return colors[status] || 'bg-gray-400 text-white';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-violet-600" />
                Performance por Operador (Google Ads)
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Comparação de performance baseada nas contas Google Ads atribuídas
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabela de Performance */}
      <Card>
        <CardContent className="pt-6">
          {performancePorOperador.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-lg font-medium">Nenhum operador encontrado</p>
              <p className="text-sm mt-2">Certifique-se de que há responsáveis atribuídos às contas Google Ads</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">
                      Operador
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-slate-50"
                      onClick={() => handleSort('contas')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Contas
                        {sortBy === 'contas' && (
                          sortOrder === 'asc' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-slate-50"
                      onClick={() => handleSort('healthScore')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Health Score Médio
                        {sortBy === 'healthScore' && (
                          sortOrder === 'asc' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-slate-50"
                      onClick={() => handleSort('cpa')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        CPA Médio
                        {sortBy === 'cpa' && (
                          sortOrder === 'asc' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-slate-50"
                      onClick={() => handleSort('cpc')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        CPC Médio
                        {sortBy === 'cpc' && (
                          sortOrder === 'asc' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-slate-50"
                      onClick={() => handleSort('conversions')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Total Conversões
                        {sortBy === 'conversions' && (
                          sortOrder === 'asc' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-slate-50"
                      onClick={() => handleSort('investimento')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Investimento Total
                        {sortBy === 'investimento' && (
                          sortOrder === 'asc' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Opt. Score</TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-slate-50"
                      onClick={() => handleSort('urgentes')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Urgentes
                        {sortBy === 'urgentes' && (
                          sortOrder === 'asc' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performancePorOperador.map((operador, idx) => (
                    <TableRow 
                      key={operador.responsavel}
                      className={cn(
                        "hover:bg-slate-50",
                        idx < 3 && sortBy === 'healthScore' && sortOrder === 'desc' && "bg-green-50/50",
                        idx >= performancePorOperador.length - 3 && sortBy === 'healthScore' && sortOrder === 'desc' && "bg-red-50/50"
                      )}
                    >
                      <TableCell className="font-medium">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {voxxUsers?.find(u => u.id === operador.responsavel)?.full_name || operador.responsavel_nome}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-semibold">
                          {operador.totalContas}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className={cn(
                          "inline-flex items-center justify-center w-16 h-16 rounded-full font-bold text-lg",
                          getHealthScoreColor(operador.healthScoreMedio)
                        )}>
                          {operador.healthScoreMedio}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {operador.cpaMedio > 0 ? formatCurrency(operador.cpaMedio) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {operador.cpcMedio > 0 ? formatCurrency(operador.cpcMedio) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {operador.conversionsTotal}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(operador.costTotal)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-semibold">{operador.optimizationScoreMedio}%</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          {operador.contasUrgentes > 0 && (
                            <Badge className="bg-red-100 text-red-800 font-semibold">
                              {operador.contasUrgentes}
                            </Badge>
                          )}
                          {operador.contasCriticas > 0 && (
                            <Badge className="bg-orange-100 text-orange-800 text-xs">
                              +{operador.contasCriticas}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedOperador(operador)}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes do Operador */}
      <Dialog open={!!selectedOperador} onOpenChange={() => setSelectedOperador(null)}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold">
                  {voxxUsers?.find(u => u.id === selectedOperador?.responsavel)?.full_name || selectedOperador?.responsavel_nome}
                </p>
                <p className="text-sm text-slate-500 font-normal mt-1">
                  {selectedOperador?.totalContas} contas sob responsabilidade
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedOperador(null)}>
                <X className="w-5 h-5" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          {selectedOperador && (
            <div className="space-y-6 mt-4">
              {/* KPIs Resumidos */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 mb-1">Health Score Médio</p>
                    <p className="text-2xl font-bold">{selectedOperador.healthScoreMedio}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 mb-1">CPA Médio</p>
                    <p className="text-lg font-bold">
                      {selectedOperador.cpaMedio > 0 ? formatCurrency(selectedOperador.cpaMedio) : '—'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 mb-1">CPC Médio</p>
                    <p className="text-lg font-bold">
                      {selectedOperador.cpcMedio > 0 ? formatCurrency(selectedOperador.cpcMedio) : '—'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 mb-1">Investimento Total</p>
                    <p className="text-lg font-bold">{formatCurrency(selectedOperador.costTotal)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Lista de Contas */}
              <div>
                <h3 className="font-semibold text-lg mb-4">Contas Atribuídas</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conta</TableHead>
                      <TableHead className="text-center">Health Score</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Conversões</TableHead>
                      <TableHead className="text-right">CPA</TableHead>
                      <TableHead className="text-right">CPC</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-center">Opt. Score</TableHead>
                      <TableHead>Alertas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOperador.contas
                      .sort((a, b) => {
                        const statusOrder = { 'Urgente': 0, 'Crítico': 1, 'Atenção': 2, 'Saudável': 3 };
                        const statusCompare = statusOrder[a.health_status] - statusOrder[b.health_status];
                        if (statusCompare !== 0) return statusCompare;
                        return a.health_score - b.health_score;
                      })
                      .map((conta) => (
                        <TableRow key={conta.id}>
                          <TableCell className="font-medium">
                            <div>
                              <p className="font-semibold text-slate-900">{conta.account_name}</p>
                              <p className="text-xs text-slate-500">{conta.unidade_nome}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={cn(
                              "inline-flex items-center justify-center w-12 h-12 rounded-full font-bold",
                              getHealthScoreColor(conta.health_score || 0)
                            )}>
                              {conta.health_score || 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={getHealthStatusBadge(conta.health_status || 'Sem dados')}>
                              {conta.health_status || 'Sem dados'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {conta.conversions || 0}
                          </TableCell>
                          <TableCell className="text-right">
                            {conta.cost_per_conversion > 0 ? formatCurrency(conta.cost_per_conversion) : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {conta.avg_cpc > 0 ? formatCurrency(conta.avg_cpc) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(conta.cost)}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-sm font-semibold">{conta.optimization_score || 0}%</span>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {(conta.alertas || []).map((alerta, idx) => (
                                <Badge key={idx} variant="outline" className="bg-red-50 text-red-700 text-xs block">
                                  {alerta}
                                </Badge>
                              ))}
                              {(!conta.alertas || conta.alertas.length === 0) && (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}