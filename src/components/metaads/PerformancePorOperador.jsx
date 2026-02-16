import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp, Target, DollarSign, Activity, ChevronRight, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function PerformancePorOperador({ radarData, clientes }) {
  const [periodo, setPeriodo] = useState('7d');
  const [sortBy, setSortBy] = useState('radarScore');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedOperador, setSelectedOperador] = useState(null);

  // Agregar dados por responsável
  const performancePorOperador = useMemo(() => {
    if (!radarData || radarData.length === 0) {
      return [];
    }

    // Map para agrupar por responsável
    const operadoresMap = new Map();

    radarData.forEach((conta) => {
      const responsavel = conta.cliente?.responsavel_voxx_trafego;
      
      // Só incluir contas que têm responsável definido
      if (!responsavel || responsavel === '__NONE__') return;

      if (!operadoresMap.has(responsavel)) {
        operadoresMap.set(responsavel, {
          responsavel,
          responsavel_nome: responsavel, // Pode ser melhorado com lookup de nome
          contas: [],
          totalContas: 0,
          radarScoreTotal: 0,
          cplTotal: 0,
          ctrTotal: 0,
          frequenciaTotal: 0,
          investimentoTotal: 0,
          leadsTotal: 0,
          // Para média ponderada
          cplPonderado: 0,
          ctrPonderado: 0,
          pesoLeads: 0,
          pesoInvestimento: 0,
        });
      }

      const operador = operadoresMap.get(responsavel);
      operador.contas.push(conta);
      operador.totalContas++;

      // Somar métricas
      operador.radarScoreTotal += conta.radarScore || 0;
      operador.investimentoTotal += conta.investimentoDiario || 0;
      
      // Para CPL, CTR e Frequência - preparar para média ponderada
      const leads = parseFloat(conta.leadsDia7d) || 0;
      const investimento = conta.investimentoDiario || 0;
      
      operador.leadsTotal += leads;
      operador.pesoLeads += leads;
      operador.pesoInvestimento += investimento;

      // Acumular valores ponderados
      if (leads > 0) {
        operador.cplPonderado += (conta.cplAtual || 0) * leads;
      }
      if (investimento > 0) {
        operador.ctrPonderado += (conta.ctrAtual || 0) * investimento;
      }
      operador.frequenciaTotal += conta.frequencia7d || 0;
    });

    // Calcular médias
    const operadores = Array.from(operadoresMap.values()).map((op) => {
      const radarScoreMedio = op.totalContas > 0 ? op.radarScoreTotal / op.totalContas : 0;
      
      // CPL médio ponderado por leads (se houver leads)
      const cplMedio = op.pesoLeads > 0 
        ? op.cplPonderado / op.pesoLeads 
        : op.contas.filter(c => (c.cplAtual || 0) > 0).length > 0
          ? op.contas.reduce((sum, c) => sum + (c.cplAtual || 0), 0) / op.contas.filter(c => (c.cplAtual || 0) > 0).length
          : 0;

      // CTR médio ponderado por investimento (se houver investimento)
      const ctrMedio = op.pesoInvestimento > 0
        ? op.ctrPonderado / op.pesoInvestimento
        : op.totalContas > 0
          ? op.contas.reduce((sum, c) => sum + (c.ctrAtual || 0), 0) / op.totalContas
          : 0;

      const frequenciaMedio = op.totalContas > 0 ? op.frequenciaTotal / op.totalContas : 0;
      
      // Calcular distribuição de prioridades
      const contasCriticas = op.contas.filter(c => c.prioridade === 'critica').length;
      const contasAlta = op.contas.filter(c => c.prioridade === 'alta').length;
      const contasMedia = op.contas.filter(c => c.prioridade === 'media').length;
      const contasBaixa = op.contas.filter(c => c.prioridade === 'baixa').length;

      return {
        ...op,
        radarScoreMedio: Math.round(radarScoreMedio),
        cplMedio: cplMedio,
        ctrMedio: ctrMedio,
        frequenciaMedio: frequenciaMedio,
        investimentoMedioDiario: op.totalContas > 0 ? op.investimentoTotal / op.totalContas : 0,
        leadsMedioDia: op.totalContas > 0 ? op.leadsTotal / op.totalContas : 0,
        contasCriticas,
        contasAlta,
        contasMedia,
        contasBaixa,
      };
    });

    // Ordenar
    return operadores.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'radarScore':
          comparison = a.radarScoreMedio - b.radarScoreMedio;
          break;
        case 'contas':
          comparison = a.totalContas - b.totalContas;
          break;
        case 'cpl':
          comparison = a.cplMedio - b.cplMedio;
          break;
        case 'ctr':
          comparison = a.ctrMedio - b.ctrMedio;
          break;
        case 'frequencia':
          comparison = a.frequenciaMedio - b.frequenciaMedio;
          break;
        case 'investimento':
          comparison = a.investimentoTotal - b.investimentoTotal;
          break;
        case 'criticas':
          comparison = a.contasCriticas - b.contasCriticas;
          break;
        default:
          comparison = a.radarScoreMedio - b.radarScoreMedio;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [radarData, sortBy, sortOrder]);

  const formatCurrency = (value) => {
    if (value === 0 || !value) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'radarScore' || field === 'criticas' ? 'asc' : 'desc');
    }
  };

  const getRadarScoreColor = (score) => {
    if (score >= 80) return 'text-green-700 bg-green-50';
    if (score >= 60) return 'text-yellow-700 bg-yellow-50';
    if (score >= 40) return 'text-orange-700 bg-orange-50';
    return 'text-red-700 bg-red-50';
  };

  return (
    <div className="space-y-6">
      {/* Header com filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-violet-600" />
                Performance por Operador (Responsáveis no Radar Meta)
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Comparação de performance baseada nas contas atribuídas no RADAR META
              </p>
            </div>
            <div className="flex gap-3">
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="ontem">Ontem</SelectItem>
                  <SelectItem value="mes">Mês atual</SelectItem>
                </SelectContent>
              </Select>
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
              <p className="text-sm mt-2">Certifique-se de que há responsáveis atribuídos às contas no RADAR META</p>
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
                      onClick={() => handleSort('radarScore')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Radar Score Médio
                        {sortBy === 'radarScore' && (
                          sortOrder === 'asc' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-slate-50"
                      onClick={() => handleSort('cpl')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        CPL Médio
                        {sortBy === 'cpl' && (
                          sortOrder === 'asc' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-slate-50"
                      onClick={() => handleSort('ctr')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        CTR Médio
                        {sortBy === 'ctr' && (
                          sortOrder === 'asc' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-slate-50"
                      onClick={() => handleSort('frequencia')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Frequência Média
                        {sortBy === 'frequencia' && (
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
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-slate-50"
                      onClick={() => handleSort('criticas')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Críticas
                        {sortBy === 'criticas' && (
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
                        idx < 3 && sortBy === 'radarScore' && sortOrder === 'desc' && "bg-green-50/50",
                        idx >= performancePorOperador.length - 3 && sortBy === 'radarScore' && sortOrder === 'desc' && "bg-red-50/50"
                      )}
                    >
                      <TableCell className="font-medium">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {operador.responsavel_nome}
                          </p>
                          <p className="text-xs text-slate-500">{operador.responsavel}</p>
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
                          getRadarScoreColor(operador.radarScoreMedio)
                        )}>
                          {operador.radarScoreMedio}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {operador.cplMedio > 0 ? formatCurrency(operador.cplMedio) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {operador.ctrMedio > 0 ? `${operador.ctrMedio.toFixed(2)}%` : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "font-semibold px-2 py-1 rounded",
                          operador.frequenciaMedio >= 3.0 ? "text-red-600" :
                          operador.frequenciaMedio >= 2.5 ? "text-orange-600" :
                          operador.frequenciaMedio >= 1.8 ? "text-green-600" :
                          "text-green-700"
                        )}>
                          {operador.frequenciaMedio > 0 ? operador.frequenciaMedio.toFixed(2) : '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(operador.investimentoTotal)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          {operador.contasCriticas > 0 && (
                            <Badge className="bg-red-100 text-red-800 font-semibold">
                              {operador.contasCriticas}
                            </Badge>
                          )}
                          {operador.contasAlta > 0 && (
                            <Badge className="bg-orange-100 text-orange-800 text-xs">
                              +{operador.contasAlta}
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
                <p className="text-xl font-bold">{selectedOperador?.responsavel_nome}</p>
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
                    <p className="text-xs text-slate-500 mb-1">Radar Score Médio</p>
                    <p className="text-2xl font-bold">{selectedOperador.radarScoreMedio}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 mb-1">CPL Médio</p>
                    <p className="text-lg font-bold">
                      {selectedOperador.cplMedio > 0 ? formatCurrency(selectedOperador.cplMedio) : '—'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 mb-1">CTR Médio</p>
                    <p className="text-lg font-bold">
                      {selectedOperador.ctrMedio > 0 ? `${selectedOperador.ctrMedio.toFixed(2)}%` : '—'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 mb-1">Investimento Total</p>
                    <p className="text-lg font-bold">{formatCurrency(selectedOperador.investimentoTotal)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Lista de Contas */}
              <div>
                <h3 className="font-semibold text-lg mb-4">Contas Atribuídas</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-center">Radar Score</TableHead>
                      <TableHead className="text-center">Prioridade</TableHead>
                      <TableHead className="text-right">CPL</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                      <TableHead className="text-right">Frequência</TableHead>
                      <TableHead className="text-right">Inv. Diário</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOperador.contas
                      .sort((a, b) => {
                        const prioOrder = { critica: 0, alta: 1, media: 2, baixa: 3 };
                        const prioCompare = prioOrder[a.prioridade] - prioOrder[b.prioridade];
                        if (prioCompare !== 0) return prioCompare;
                        return a.radarScore - b.radarScore;
                      })
                      .map((conta) => (
                        <TableRow key={conta.account_name}>
                          <TableCell className="font-medium">
                            <div>
                              <p className="font-semibold text-slate-900">{conta.account_name}</p>
                              {conta.cliente && (
                                <p className="text-xs text-slate-500">{conta.cliente.cidade}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={cn(
                              "inline-flex items-center justify-center w-12 h-12 rounded-full font-bold",
                              getRadarScoreColor(conta.radarScore)
                            )}>
                              {conta.radarScore}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={cn(
                              conta.prioridade === 'critica' ? "bg-red-100 text-red-800" :
                              conta.prioridade === 'alta' ? "bg-orange-100 text-orange-800" :
                              conta.prioridade === 'media' ? "bg-yellow-100 text-yellow-800" :
                              "bg-green-100 text-green-800"
                            )}>
                              {conta.prioridadeLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {conta.cplAtual > 0 ? formatCurrency(conta.cplAtual) : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {conta.ctrAtual > 0 ? `${conta.ctrAtual.toFixed(2)}%` : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              "font-semibold",
                              conta.frequencia7d >= 3.0 ? "text-red-600" :
                              conta.frequencia7d >= 2.5 ? "text-orange-600" :
                              "text-green-600"
                            )}>
                              {conta.frequencia7d > 0 ? conta.frequencia7d.toFixed(2) : '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(conta.investimentoDiario)}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 max-w-xs">
                            {conta.status?.substring(0, 50)}...
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