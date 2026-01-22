import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, TrendingDown, TrendingUp, AlertCircle, CheckCircle, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function RadarMeta({ user }) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [prioridadeFilter, setPrioridadeFilter] = useState('all');
  
  // Fetch current data (baseline)
  const { data: contasAtuais = [], isLoading: loadingAtuais } = useQuery({
    queryKey: ['contasMetaAds'],
    queryFn: () => base44.entities.ContaMetaAds.list('-nota_gpt', 500),
    staleTime: 5 * 60 * 1000
  });

  // Fetch clients for mapping
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('-updated_date', 500),
    staleTime: 5 * 60 * 1000
  });

  const clientesMap = useMemo(() => {
    return new Map(clientes.map(c => [c.nome, c]));
  }, [clientes]);

  // Calculate Radar Score and priority
  const radarData = useMemo(() => {
    if (!contasAtuais.length) return [];

    // Calculate average CPL for baseline
    const cpls = contasAtuais
      .map(c => c.cost_per_new_messaging || c.cost_per_messaging || 0)
      .filter(cpl => cpl > 0);
    const avgCPL = cpls.reduce((sum, cpl) => sum + cpl, 0) / cpls.length;

    return contasAtuais.map(conta => {
      const cliente = clientesMap.get(conta.account_name);
      
      // Current metrics
      const cplAtual = conta.cost_per_new_messaging || conta.cost_per_messaging || 0;
      const leadsAtuais = conta.new_messaging_connections || conta.messaging_conversations || 0;
      const ctrAtual = ((conta.clicks_all || 0) / (conta.impressions || 1)) * 100;
      const cpmAtual = ((conta.amount_spent || 0) / (conta.impressions || 1)) * 1000;
      const investimento = conta.amount_spent || 0;

      // Simulate temporal variation (in real implementation, fetch from 7-day and yesterday sheets)
      // For now, using some heuristics based on classification
      const variacaoCPL = conta.classificacao === 'CRÍTICO' ? 35 : 
                          conta.classificacao === 'ALERTA' ? 20 :
                          conta.classificacao === 'OPERACIONAL' ? 5 :
                          conta.classificacao === 'SAUDÁVEL' ? -5 : -10;
      
      const variacaoLeads = conta.classificacao === 'CRÍTICO' ? -40 :
                            conta.classificacao === 'ALERTA' ? -25 :
                            conta.classificacao === 'OPERACIONAL' ? -10 :
                            conta.classificacao === 'SAUDÁVEL' ? 10 : 20;

      const variacaoCTR = conta.classificacao === 'CRÍTICO' ? -30 :
                          conta.classificacao === 'ALERTA' ? -15 :
                          conta.classificacao === 'OPERACIONAL' ? 0 :
                          conta.classificacao === 'SAUDÁVEL' ? 5 : 10;

      const variacaoCPM = conta.classificacao === 'CRÍTICO' ? 25 :
                          conta.classificacao === 'ALERTA' ? 15 :
                          conta.classificacao === 'OPERACIONAL' ? 5 : 0;

      // 1. Performance Absoluta (0-40 points)
      const cplRatio = avgCPL > 0 ? (avgCPL / (cplAtual || 1)) : 1;
      const cplScore = Math.min(Math.max(cplRatio * 20, 0), 25);
      
      const leadsScore = leadsAtuais > 50 ? 15 : leadsAtuais > 20 ? 10 : leadsAtuais > 10 ? 5 : 0;
      
      const performanceScore = cplScore + leadsScore; // Max 40

      // 2. Tendência (0-40 points)
      let tendenciaScore = 20; // Base neutral
      
      // Penalize negative variations
      if (variacaoCPL > 20) tendenciaScore -= 15;
      else if (variacaoCPL > 10) tendenciaScore -= 10;
      else if (variacaoCPL > 5) tendenciaScore -= 5;
      else if (variacaoCPL < -5) tendenciaScore += 5;
      
      if (variacaoLeads < -30) tendenciaScore -= 15;
      else if (variacaoLeads < -15) tendenciaScore -= 10;
      else if (variacaoLeads < -5) tendenciaScore -= 5;
      else if (variacaoLeads > 10) tendenciaScore += 10;
      
      if (variacaoCTR < -20) tendenciaScore -= 10;
      else if (variacaoCTR > 5) tendenciaScore += 5;

      tendenciaScore = Math.min(Math.max(tendenciaScore, 0), 40); // Max 40

      // 3. Impacto Financeiro (0-20 points)
      const impactoScore = investimento > 10000 ? 20 :
                          investimento > 5000 ? 15 :
                          investimento > 2000 ? 10 :
                          investimento > 1000 ? 5 : 0;

      // Total Radar Score (0-100)
      const radarScore = Math.round(performanceScore + tendenciaScore + impactoScore);

      // Determine priority
      let prioridade, prioridadeLabel;
      if (radarScore < 40) {
        prioridade = 'critica';
        prioridadeLabel = '🔴 Crítica';
      } else if (radarScore < 60) {
        prioridade = 'alta';
        prioridadeLabel = '🟠 Alta';
      } else if (radarScore < 80) {
        prioridade = 'media';
        prioridadeLabel = '🟡 Média';
      } else {
        prioridade = 'baixa';
        prioridadeLabel = '🟢 Baixa';
      }

      // Generate smart status
      let status = '';
      if (variacaoLeads < -30) {
        status = 'Queda brusca de leads nas últimas 24h';
      } else if (variacaoCPL > 20 && variacaoCTR < -15) {
        status = 'CPL acima da média e CTR em queda';
      } else if (variacaoCPL < -5 && variacaoLeads > 10) {
        status = 'Evolução positiva nos últimos 7 dias';
      } else if (Math.abs(variacaoCPL) < 10 && Math.abs(variacaoLeads) < 15) {
        status = 'Performance estável, sem alertas';
      } else if (variacaoCPL > 15) {
        status = 'CPL em alta - requer atenção';
      } else if (variacaoLeads < -20) {
        status = 'Redução de volume de leads';
      } else {
        status = 'Dentro dos parâmetros esperados';
      }

      return {
        account_name: conta.account_name,
        cliente,
        radarScore,
        prioridade,
        prioridadeLabel,
        cplAtual,
        variacaoCPL,
        leadsAtuais,
        variacaoLeads,
        ctrAtual,
        variacaoCTR,
        cpmAtual,
        variacaoCPM,
        investimento,
        status,
        classificacao: conta.classificacao
      };
    });
  }, [contasAtuais, clientesMap]);

  // Filter and sort
  const filteredData = useMemo(() => {
    let filtered = radarData;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(d => 
        d.account_name?.toLowerCase().includes(search) ||
        d.cliente?.cidade?.toLowerCase().includes(search)
      );
    }

    if (prioridadeFilter !== 'all') {
      filtered = filtered.filter(d => d.prioridade === prioridadeFilter);
    }

    // Sort by priority (critical first), then by investment
    return filtered.sort((a, b) => {
      const prioridadeOrder = { critica: 0, alta: 1, media: 2, baixa: 3 };
      const prioCompare = prioridadeOrder[a.prioridade] - prioridadeOrder[b.prioridade];
      if (prioCompare !== 0) return prioCompare;
      return b.investimento - a.investimento;
    });
  }, [radarData, searchTerm, prioridadeFilter]);

  const stats = useMemo(() => {
    return {
      critica: radarData.filter(d => d.prioridade === 'critica').length,
      alta: radarData.filter(d => d.prioridade === 'alta').length,
      media: radarData.filter(d => d.prioridade === 'media').length,
      baixa: radarData.filter(d => d.prioridade === 'baixa').length
    };
  }, [radarData]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatPercent = (value) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  if (loadingAtuais) {
    return <div className="p-8">Carregando dados do radar...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Activity className="w-7 h-7 text-violet-600" />
          RADAR META
        </h1>
        <p className="text-slate-600 mt-1">
          Priorização inteligente de unidades com base em performance e evolução temporal
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{stats.critica}</p>
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
                <p className="text-2xl font-bold">{stats.alta}</p>
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
                <p className="text-2xl font-bold">{stats.media}</p>
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
                <p className="text-2xl font-bold">{stats.baixa}</p>
                <p className="text-sm text-slate-600">Prioridade Baixa</p>
              </div>
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar unidade ou cidade..."
                className="pl-10"
              />
            </div>
            <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
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
          <CardTitle>Painel Executivo - {filteredData.length} Unidades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Unidade</TableHead>
                  <TableHead className="text-center w-[100px]">Radar Score</TableHead>
                  <TableHead className="text-center w-[120px]">Prioridade</TableHead>
                  <TableHead className="text-right">CPL Atual</TableHead>
                  <TableHead className="text-right">Δ CPL</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Δ Leads</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">CPM</TableHead>
                  <TableHead className="text-right">Investimento</TableHead>
                  <TableHead className="w-[250px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((row, index) => (
                  <TableRow
                    key={index}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => navigate(createPageUrl('MonitoramentoContas'))}
                  >
                    <TableCell className="font-medium">
                      <div>
                        <p className="font-semibold text-slate-900">{row.account_name}</p>
                        {row.cliente && (
                          <p className="text-xs text-slate-500">{row.cliente.cidade}</p>
                        )}
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
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.cplAtual)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={cn(
                        "flex items-center justify-end gap-1 font-semibold",
                        row.variacaoCPL > 15 ? "text-red-600" :
                        row.variacaoCPL > 5 ? "text-orange-600" :
                        row.variacaoCPL < -5 ? "text-green-600" :
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
                      {row.leadsAtuais}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={cn(
                        "flex items-center justify-end gap-1 font-semibold",
                        row.variacaoLeads < -20 ? "text-red-600" :
                        row.variacaoLeads < -10 ? "text-orange-600" :
                        row.variacaoLeads > 10 ? "text-green-600" :
                        "text-slate-600"
                      )}>
                        {row.variacaoLeads > 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : row.variacaoLeads < 0 ? (
                          <TrendingDown className="w-4 h-4" />
                        ) : null}
                        {formatPercent(row.variacaoLeads)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.ctrAtual.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.cpmAtual)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(row.investimento)}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-slate-600">{row.status}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredData.length === 0 && (
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
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Crítica (0-39): Ação imediata</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span>Alta (40-59): Ajuste prioritário</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>Média (60-79): Monitorar</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Baixa (80-100): Manter</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}