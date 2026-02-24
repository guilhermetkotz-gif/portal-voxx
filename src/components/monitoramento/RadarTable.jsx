import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  ChevronDown, 
  ChevronRight, 
  Activity,
  Lightbulb,
  RefreshCw,
  User
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatPercent = (value) => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

export default function RadarTable({
  filteredRadarData,
  expandedRows,
  toggleRow,
  recommendations,
  accounts,
  setSelectedAccountForOtimizacao,
  setOtimizacaoModalOpen
}) {
  const queryClient = useQueryClient();

  const { data: voxxUsers = [] } = useQuery({
    queryKey: ['voxxUsers'],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('listVoxxUsers', {});
        return response.data?.users || [];
      } catch (error) {
        console.error('Erro ao buscar usuários voxx:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000
  });

  const updateResponsavelMutation = useMutation({
    mutationFn: async ({ accountName, responsavel }) => {
      const conta = accounts.find(a => a.account_name === accountName);
      if (!conta) throw new Error('Conta não encontrada');
      
      await base44.entities.ContaMetaAds.update(conta.id, {
        responsavel_voxx: responsavel === '__NONE__' ? null : responsavel
      });
      
      return { accountName, responsavel };
    },
    onSuccess: ({ responsavel }) => {
      queryClient.invalidateQueries({ queryKey: ['metaAdsAccounts'] });
      toast.success(`Responsável ${responsavel && responsavel !== '__NONE__' ? 'atualizado' : 'removido'} com sucesso!`);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar responsável: ' + error.message);
    }
  });
  return (
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
            <TableHead className="w-[200px]">Responsável</TableHead>
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
                <TableCell>
                  <Select
                    value={accounts.find(a => a.account_name === row.account_name)?.responsavel_voxx || '__NONE__'}
                    onValueChange={(value) => {
                      updateResponsavelMutation.mutate({
                        accountName: row.account_name,
                        responsavel: value
                      });
                    }}
                    disabled={updateResponsavelMutation.isPending}
                  >
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue>
                        {(() => {
                          const conta = accounts.find(a => a.account_name === row.account_name);
                          if (!conta?.responsavel_voxx) return 'Não atribuído';
                          const user = voxxUsers.find(u => u.email === conta.responsavel_voxx);
                          return user?.full_name || conta.responsavel_voxx;
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__NONE__">
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>Não atribuído</span>
                        </div>
                      </SelectItem>
                      {voxxUsers.map((voxxUser) => (
                        <SelectItem key={voxxUser.id} value={voxxUser.email}>
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-violet-600" />
                            <span>{voxxUser.full_name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <TableCell colSpan={15} className="bg-slate-50 p-6">
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
                            
                            {recommendations[row.account_name]?.recommendations?.map((rec, idx) => (
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
                            
                            {(!recommendations[row.account_name]?.recommendations || 
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
  );
}