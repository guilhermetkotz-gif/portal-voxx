import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown,
  Target, 
  DollarSign, 
  Activity, 
  Zap,
  AlertTriangle,
  Award,
  Medal
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function RankingOperadoresRadar({ radarData, periodo }) {
  const [rankingSort, setRankingSort] = useState('performance');
  const [selectedOperador, setSelectedOperador] = useState(null);

  // Calcular estatísticas globais para comparação
  const globalStats = useMemo(() => {
    if (!radarData || radarData.length === 0) return null;

    const totalRadar = radarData.reduce((sum, c) => sum + (c.radarScore || 0), 0);
    const totalCpl = radarData.filter(c => c.cplAtual > 0).reduce((sum, c) => sum + c.cplAtual, 0);
    const totalCtr = radarData.filter(c => c.ctrAtual > 0).reduce((sum, c) => sum + c.ctrAtual, 0);
    const totalFreq = radarData.filter(c => c.frequencia7d > 0).reduce((sum, c) => sum + c.frequencia7d, 0);

    return {
      avgRadarScore: totalRadar / radarData.length,
      avgCpl: totalCpl / radarData.filter(c => c.cplAtual > 0).length,
      avgCtr: totalCtr / radarData.filter(c => c.ctrAtual > 0).length,
      avgFrequencia: totalFreq / radarData.filter(c => c.frequencia7d > 0).length,
    };
  }, [radarData]);

  // Calcular performance score e ranking
  const operadoresRanking = useMemo(() => {
    if (!radarData || radarData.length === 0 || !globalStats) return [];

    const operadoresMap = new Map();

    radarData.forEach((conta) => {
      const responsavel = conta.cliente?.responsavel_voxx_trafego;
      if (!responsavel || responsavel === '__NONE__') return;

      if (!operadoresMap.has(responsavel)) {
        operadoresMap.set(responsavel, {
          responsavel,
          responsavel_nome: responsavel,
          contas: [],
          totalContas: 0,
          radarScoreTotal: 0,
          cplTotal: 0,
          ctrTotal: 0,
          frequenciaTotal: 0,
          investimentoTotal: 0,
          contasCriticas: 0,
          contasAlta: 0,
          pesoLeads: 0,
          cplPonderado: 0,
        });
      }

      const operador = operadoresMap.get(responsavel);
      operador.contas.push(conta);
      operador.totalContas++;

      // Dados baseados no período
      let cpl, ctr, leads, investimento, frequencia;
      
      if (periodo === 'ontem') {
        cpl = conta.cplAtual || 0;
        ctr = conta.ctrAtual || 0;
        leads = conta.leadsOntem || 0;
        investimento = conta.investimentoDiario || 0;
        frequencia = conta.frequenciaOntem || conta.frequencia7d || 0;
      } else if (periodo === '7d') {
        cpl = conta.cpl7d || 0;
        ctr = conta.ctr7d || 0;
        leads = parseFloat(conta.leadsDia7d) || 0;
        investimento = (conta.investimentoDiario || 0) * 7;
        frequencia = conta.frequencia7d || 0;
      } else {
        cpl = conta.cpl7d || 0;
        ctr = conta.ctr7d || 0;
        leads = parseFloat(conta.leadsDia7d) || 0;
        investimento = (conta.investimentoDiario || 0) * 30;
        frequencia = conta.frequencia7d || 0;
      }

      operador.radarScoreTotal += conta.radarScore || 0;
      operador.investimentoTotal += investimento;
      operador.frequenciaTotal += frequencia;

      if (leads > 0) {
        operador.cplPonderado += cpl * leads;
        operador.pesoLeads += leads;
      }
      operador.ctrTotal += ctr;

      if (conta.prioridade === 'critica') operador.contasCriticas++;
      if (conta.prioridade === 'alta') operador.contasAlta++;
    });

    // Calcular médias e performance score
    const operadores = Array.from(operadoresMap.values()).map((op) => {
      const radarScoreMedio = op.totalContas > 0 ? op.radarScoreTotal / op.totalContas : 0;
      const cplMedio = op.pesoLeads > 0 ? op.cplPonderado / op.pesoLeads : 0;
      const ctrMedio = op.totalContas > 0 ? op.ctrTotal / op.totalContas : 0;
      const frequenciaMedio = op.totalContas > 0 ? op.frequenciaTotal / op.totalContas : 0;
      const percContasCriticas = (op.contasCriticas / op.totalContas) * 100;

      // PERFORMANCE SCORE (0-100)
      let performanceScore = 0;

      // 1. Radar Score (peso 40%)
      const radarNormalizado = (radarScoreMedio / 100) * 40;
      performanceScore += radarNormalizado;

      // 2. CPL vs média global (peso 25%)
      if (cplMedio > 0 && globalStats.avgCpl > 0) {
        const cplRatio = globalStats.avgCpl / cplMedio;
        const cplScore = Math.min(cplRatio, 2) * 12.5; // Max 25 pontos
        performanceScore += cplScore;
      } else {
        performanceScore += 12.5;
      }

      // 3. CTR vs média global (peso 15%)
      if (ctrMedio > 0 && globalStats.avgCtr > 0) {
        const ctrRatio = ctrMedio / globalStats.avgCtr;
        const ctrScore = Math.min(ctrRatio, 2) * 7.5;
        performanceScore += ctrScore;
      } else {
        performanceScore += 7.5;
      }

      // 4. Frequência (peso 10% - penalização se alta)
      if (frequenciaMedio > 0) {
        if (frequenciaMedio < 2.0) performanceScore += 10;
        else if (frequenciaMedio < 2.5) performanceScore += 7;
        else if (frequenciaMedio < 3.0) performanceScore += 4;
        else performanceScore += 0;
      }

      // 5. % Contas Críticas (peso 10% - penalização)
      if (percContasCriticas === 0) performanceScore += 10;
      else if (percContasCriticas < 20) performanceScore += 7;
      else if (percContasCriticas < 40) performanceScore += 4;
      else performanceScore += 0;

      performanceScore = Math.round(Math.min(performanceScore, 100));

      // Classificação
      let classificacao, classeColor;
      if (performanceScore >= 90) {
        classificacao = 'Elite';
        classeColor = 'from-purple-500 to-pink-500';
      } else if (performanceScore >= 75) {
        classificacao = 'Forte';
        classeColor = 'from-green-500 to-emerald-500';
      } else if (performanceScore >= 60) {
        classificacao = 'Operacional';
        classeColor = 'from-yellow-500 to-orange-500';
      } else {
        classificacao = 'Atenção';
        classeColor = 'from-red-500 to-rose-500';
      }

      return {
        ...op,
        radarScoreMedio: Math.round(radarScoreMedio),
        cplMedio,
        ctrMedio,
        frequenciaMedio,
        percContasCriticas,
        performanceScore,
        classificacao,
        classeColor,
      };
    });

    // Ordenar
    return operadores
      .filter(op => op.totalContas > 0)
      .sort((a, b) => {
        switch (rankingSort) {
          case 'performance':
            return b.performanceScore - a.performanceScore;
          case 'radarScore':
            return b.radarScoreMedio - a.radarScoreMedio;
          case 'cpl':
            return a.cplMedio - b.cplMedio;
          case 'criticas':
            return b.contasCriticas - a.contasCriticas;
          case 'investimento':
            return b.investimentoTotal - a.investimentoTotal;
          default:
            return b.performanceScore - a.performanceScore;
        }
      });
  }, [radarData, globalStats, rankingSort, periodo]);

  const formatCurrency = (value) => {
    if (value === 0 || !value) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getMedalIcon = (index) => {
    if (index === 0) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (index === 1) return <Medal className="w-6 h-6 text-slate-400" />;
    if (index === 2) return <Award className="w-6 h-6 text-amber-600" />;
    return null;
  };

  if (!radarData || radarData.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-2 border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Ranking Inteligente de Performance
                </h3>
                <p className="text-sm text-slate-600">
                  Operadores Radar Meta - Classificação dinâmica e gamificada
                </p>
              </div>
            </div>
            <Select value={rankingSort} onValueChange={setRankingSort}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="performance">🏆 Performance Score</SelectItem>
                <SelectItem value="radarScore">📊 Radar Score</SelectItem>
                <SelectItem value="cpl">💰 Menor CPL</SelectItem>
                <SelectItem value="criticas">⚠️ Contas Críticas</SelectItem>
                <SelectItem value="investimento">💵 Maior Investimento</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Operadores */}
      <div className="grid grid-cols-1 gap-4">
        {operadoresRanking.map((operador, index) => (
          <Card
            key={operador.responsavel}
            className={cn(
              "overflow-hidden transition-all hover:shadow-xl cursor-pointer border-2",
              index < 3 && "border-violet-300",
              operador.classificacao === 'Elite' && "bg-gradient-to-r from-purple-50 to-pink-50",
              operador.classificacao === 'Forte' && "bg-gradient-to-r from-green-50 to-emerald-50",
              operador.classificacao === 'Operacional' && "bg-gradient-to-r from-yellow-50 to-orange-50",
              operador.classificacao === 'Atenção' && "bg-gradient-to-r from-red-50 to-rose-50"
            )}
            onClick={() => setSelectedOperador(operador)}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                {/* Ranking e Medalha */}
                <div className="flex flex-col items-center gap-2 min-w-[80px]">
                  {getMedalIcon(index)}
                  <Badge 
                    variant="outline" 
                    className="text-lg font-bold px-3 py-1 bg-white"
                  >
                    #{index + 1}
                  </Badge>
                </div>

                {/* Info Principal */}
                <div className="flex-1 space-y-4">
                  {/* Nome e Performance Score */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xl font-bold text-slate-900">
                        {operador.responsavel_nome}
                      </h4>
                      <p className="text-sm text-slate-500">
                        {operador.totalContas} {operador.totalContas === 1 ? 'conta' : 'contas'} sob gestão
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "inline-block px-4 py-2 rounded-xl font-bold text-white text-2xl bg-gradient-to-r",
                        operador.classeColor
                      )}>
                        {operador.performanceScore}
                      </div>
                      <Badge className={cn(
                        "mt-2 text-xs font-semibold",
                        operador.classificacao === 'Elite' && "bg-purple-600",
                        operador.classificacao === 'Forte' && "bg-green-600",
                        operador.classificacao === 'Operacional' && "bg-yellow-600",
                        operador.classificacao === 'Atenção' && "bg-red-600"
                      )}>
                        {operador.classificacao}
                      </Badge>
                    </div>
                  </div>

                  {/* Barra de Performance */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">Performance Score</span>
                      <span className="text-slate-700 font-semibold">{operador.performanceScore}/100</span>
                    </div>
                    <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full bg-gradient-to-r transition-all", operador.classeColor)}
                        style={{ width: `${operador.performanceScore}%` }}
                      />
                    </div>
                  </div>

                  {/* KPIs em Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {/* Radar Score */}
                    <div className="flex items-center gap-2 bg-white/70 rounded-lg p-3 border border-slate-200">
                      <Target className={cn(
                        "w-5 h-5",
                        operador.radarScoreMedio >= 80 ? "text-green-600" :
                        operador.radarScoreMedio >= 60 ? "text-yellow-600" :
                        "text-red-600"
                      )} />
                      <div>
                        <p className="text-xs text-slate-500">Radar Score</p>
                        <p className="text-lg font-bold text-slate-900">{operador.radarScoreMedio}</p>
                      </div>
                    </div>

                    {/* CPL */}
                    <div className="flex items-center gap-2 bg-white/70 rounded-lg p-3 border border-slate-200">
                      <DollarSign className={cn(
                        "w-5 h-5",
                        operador.cplMedio <= globalStats.avgCpl ? "text-green-600" : "text-red-600"
                      )} />
                      <div>
                        <p className="text-xs text-slate-500">CPL Médio</p>
                        <p className="text-sm font-bold text-slate-900">
                          {operador.cplMedio > 0 ? formatCurrency(operador.cplMedio) : '—'}
                        </p>
                      </div>
                    </div>

                    {/* CTR */}
                    <div className="flex items-center gap-2 bg-white/70 rounded-lg p-3 border border-slate-200">
                      <Activity className={cn(
                        "w-5 h-5",
                        operador.ctrMedio >= globalStats.avgCtr ? "text-green-600" : "text-orange-600"
                      )} />
                      <div>
                        <p className="text-xs text-slate-500">CTR Médio</p>
                        <p className="text-sm font-bold text-slate-900">
                          {operador.ctrMedio > 0 ? `${operador.ctrMedio.toFixed(2)}%` : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Frequência */}
                    <div className="flex items-center gap-2 bg-white/70 rounded-lg p-3 border border-slate-200">
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold",
                        operador.frequenciaMedio < 2.5 ? "bg-green-600" :
                        operador.frequenciaMedio < 3.0 ? "bg-orange-600" :
                        "bg-red-600"
                      )}>
                        F
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Frequência</p>
                        <p className="text-sm font-bold text-slate-900">
                          {operador.frequenciaMedio > 0 ? operador.frequenciaMedio.toFixed(2) : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Investimento */}
                    <div className="flex items-center gap-2 bg-white/70 rounded-lg p-3 border border-slate-200">
                      <DollarSign className="w-5 h-5 text-violet-600" />
                      <div>
                        <p className="text-xs text-slate-500">Investimento</p>
                        <p className="text-sm font-bold text-slate-900">
                          {formatCurrency(operador.investimentoTotal)}
                        </p>
                      </div>
                    </div>

                    {/* Contas */}
                    <div className="flex items-center gap-2 bg-white/70 rounded-lg p-3 border border-slate-200">
                      <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                        {operador.totalContas}
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-sm font-bold text-slate-900">Contas</p>
                      </div>
                    </div>

                    {/* Críticas */}
                    <div className="flex items-center gap-2 bg-white/70 rounded-lg p-3 border border-slate-200">
                      <AlertTriangle className={cn(
                        "w-5 h-5",
                        operador.contasCriticas === 0 ? "text-green-600" :
                        operador.contasCriticas <= 2 ? "text-orange-600" :
                        "text-red-600"
                      )} />
                      <div>
                        <p className="text-xs text-slate-500">Críticas</p>
                        <p className="text-lg font-bold text-red-600">{operador.contasCriticas}</p>
                      </div>
                    </div>
                  </div>

                  {/* Tendência (placeholder) */}
                  {operador.performanceScore >= 75 && (
                    <div className="flex items-center gap-2 text-green-600">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-medium">Performance em alta</span>
                    </div>
                  )}
                  {operador.performanceScore < 60 && (
                    <div className="flex items-center gap-2 text-red-600">
                      <TrendingDown className="w-4 h-4" />
                      <span className="text-xs font-medium">Requer atenção</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal de Detalhes */}
      <Dialog open={!!selectedOperador} onOpenChange={() => setSelectedOperador(null)}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {selectedOperador?.responsavel_nome}
            </DialogTitle>
            <p className="text-slate-500">
              Performance Score: <span className="font-bold text-violet-600">{selectedOperador?.performanceScore}/100</span>
              {' • '}
              Classificação: <span className="font-bold">{selectedOperador?.classificacao}</span>
            </p>
          </DialogHeader>

          {selectedOperador && (
            <div className="space-y-6 mt-4">
              {/* KPIs Detalhados */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-600 mb-1">Radar Score Médio</p>
                    <p className="text-3xl font-bold text-violet-600">{selectedOperador.radarScoreMedio}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-600 mb-1">CPL Médio</p>
                    <p className="text-xl font-bold text-green-700">
                      {selectedOperador.cplMedio > 0 ? formatCurrency(selectedOperador.cplMedio) : '—'}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-600 mb-1">CTR Médio</p>
                    <p className="text-xl font-bold text-blue-700">
                      {selectedOperador.ctrMedio > 0 ? `${selectedOperador.ctrMedio.toFixed(2)}%` : '—'}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-600 mb-1">Investimento Total</p>
                    <p className="text-xl font-bold text-amber-700">
                      {formatCurrency(selectedOperador.investimentoTotal)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Lista de Contas */}
              <div>
                <h4 className="font-bold text-lg mb-4">
                  Contas sob Gestão ({selectedOperador.totalContas})
                </h4>
                <div className="grid gap-3">
                  {selectedOperador.contas
                    .sort((a, b) => {
                      const prioOrder = { critica: 0, alta: 1, media: 2, baixa: 3 };
                      return prioOrder[a.prioridade] - prioOrder[b.prioridade];
                    })
                    .map((conta) => (
                      <Card key={conta.account_name} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg",
                                  conta.radarScore >= 80 ? "bg-green-100 text-green-700" :
                                  conta.radarScore >= 60 ? "bg-yellow-100 text-yellow-700" :
                                  "bg-red-100 text-red-700"
                                )}>
                                  {conta.radarScore}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-900">{conta.account_name}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge className={cn(
                                      "text-xs",
                                      conta.prioridade === 'critica' && "bg-red-600",
                                      conta.prioridade === 'alta' && "bg-orange-600",
                                      conta.prioridade === 'media' && "bg-yellow-600",
                                      conta.prioridade === 'baixa' && "bg-green-600"
                                    )}>
                                      {conta.prioridadeLabel}
                                    </Badge>
                                    {conta.cliente && (
                                      <span className="text-xs text-slate-500">{conta.cliente.cidade}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-4 text-sm">
                              <div className="text-right">
                                <p className="text-xs text-slate-500">CPL</p>
                                <p className="font-semibold">
                                  {conta.cplAtual > 0 ? formatCurrency(conta.cplAtual) : '—'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-slate-500">CTR</p>
                                <p className="font-semibold">
                                  {conta.ctrAtual > 0 ? `${conta.ctrAtual.toFixed(2)}%` : '—'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-slate-500">Freq.</p>
                                <p className={cn(
                                  "font-semibold",
                                  conta.frequencia7d >= 3.0 ? "text-red-600" :
                                  conta.frequencia7d >= 2.5 ? "text-orange-600" :
                                  "text-green-600"
                                )}>
                                  {conta.frequencia7d > 0 ? conta.frequencia7d.toFixed(2) : '—'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}