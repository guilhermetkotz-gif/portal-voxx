import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Wallet, AlertTriangle, CheckCircle2, TrendingUp, Calendar, ExternalLink, Edit2, Save, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { isVoxxAdmin, isVoxxOperacao } from '@/components/utils/auth';
import ListaSaldoMetaAdsSimples from '@/components/metaads/ListaSaldoMetaAdsSimples';
import { Checkbox } from '@/components/ui/checkbox';
import ModalNovaTomada from '@/components/saldos/ModalNovaTomada';

export default function GestaoSaldoMetaAds({ user }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(currentDate, 'yyyy-MM-01'));
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRows, setEditingRows] = useState({});
  const [editingClients, setEditingClients] = useState(new Set());
  const [viewMode, setViewMode] = useState('detailed');
  const [selectedClienteDetail, setSelectedClienteDetail] = useState(null);
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [modalNovaTomada, setModalNovaTomada] = useState({ open: false, clienteId: null, clienteNome: null, valorSugerido: 0 });

  // Fetch clientes
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('-updated_date', 500),
  });

  // Fetch planejamentos do mês selecionado
  const { data: planejamentos = [] } = useQuery({
    queryKey: ['planejamentos', selectedMonth],
    queryFn: () => base44.entities.PlanejamentoEstrategico.filter({ mes_referencia: selectedMonth }),
    enabled: !!selectedMonth,
  });

  // Fetch controles de saldo do mês
  const { data: balanceControls = [], isLoading } = useQuery({
    queryKey: ['metaAdsBalance', selectedMonth],
    queryFn: () => base44.entities.MetaAdsBalanceControl.filter({ month_year: selectedMonth }),
    enabled: !!selectedMonth,
  });

  // Buscar gastos diários da planilha (D-1)
  const { data: sheetData } = useQuery({
    queryKey: ['amountSpentFromSheet'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getAmountSpentFromSheet', {});
      return response.data;
    },
    staleTime: 2 * 60 * 1000
  });

  const diarioD1ByAccount = sheetData?.diarioD1ByAccount || {};

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const existing = balanceControls.find(
        b => b.client_id === data.client_id && b.month_year === data.month_year
      );
      
      if (existing) {
        return base44.entities.MetaAdsBalanceControl.update(existing.id, data);
      } else {
        return base44.entities.MetaAdsBalanceControl.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['metaAdsBalance']);
      toast({ title: 'Sucesso', description: 'Dados salvos com sucesso.' });
    },
  });

  // Get main Meta Ad Account for client
  const getMainMetaAccount = (cliente) => {
    return cliente.contas_anuncio?.find(
      c => c.plataforma === 'Meta' && c.conta_principal
    );
  };

  // Get balance control for client
  const getBalanceControl = (clientId) => {
    return balanceControls.find(b => b.client_id === clientId);
  };

  // Get planejamento for client
  const getPlanejamento = (clientId) => {
    return planejamentos.find(p => p.cliente_id === clientId);
  };

  // Prepare data rows
  const dataRows = useMemo(() => {
    let filtered = clientes.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const mainAccount = getMainMetaAccount(c);
        return c.nome?.toLowerCase().includes(search) ||
               c.cidade?.toLowerCase().includes(search) ||
               mainAccount?.ad_account_id?.toLowerCase().includes(search);
      }
      
      return true;
    });

    return filtered.map(cliente => {
      const mainAccount = getMainMetaAccount(cliente);
      const balance = getBalanceControl(cliente.id);
      const planejamento = getPlanejamento(cliente.id);
      
      // Calcular valor planejado Meta Ads
      let valorPlanejado = 0;
      if (planejamento) {
        // Usar campo direto se existir, senão calcular
        if (planejamento.investimento_meta_mes) {
          valorPlanejado = planejamento.investimento_meta_mes;
        } else {
          // Calcular: Feed + (Investimento Total - Feed - Google - TikTok)
          const investimentoTotal = (planejamento.meta_faturamento * planejamento.percentual_investimento_marketing) / 100;
          const investimentoLeads = investimentoTotal - (planejamento.investimento_feed || 0) - (planejamento.investimento_google || 0) - (planejamento.investimento_tiktok || 0);
          valorPlanejado = (planejamento.investimento_feed || 0) + investimentoLeads;
        }
      }
      const saldo = balance?.saldo || 0;
      
      // Calcular valor pago baseado no histórico de tomadas pagas
      const edits = editingRows[cliente.id] || {};
      const historico = edits.historico_tomadas || balance?.historico_tomadas || [];
      const valorPago = historico
        .filter(t => t.pago)
        .reduce((sum, t) => sum + (parseFloat(t.valor) || 0), 0);
      
      // Buscar gasto diário da planilha (D-1) usando o nome do cliente
      let gastoDiario = 0;
      const nomeCliente = cliente.nome?.trim();
      
      // Normalizar nome para comparação (remover espaços extras, hífens, tornar minúsculo)
      const normalizeNome = (nome) => {
        return nome?.toLowerCase()
          .replace(/\s+/g, ' ')
          .replace(/\s*-\s*/g, '')
          .trim() || '';
      };
      
      const clienteNormalizado = normalizeNome(nomeCliente);
      
      // Buscar correspondência exata primeiro
      if (nomeCliente && diarioD1ByAccount[nomeCliente] !== undefined) {
        gastoDiario = diarioD1ByAccount[nomeCliente];
      } else {
        // Buscar por correspondência normalizada
        const matchingKey = Object.keys(diarioD1ByAccount).find(key => 
          normalizeNome(key) === clienteNormalizado
        );
        if (matchingKey) {
          gastoDiario = diarioD1ByAccount[matchingKey];
        }
      }
      const qtdTomadas = edits.qtd_tomadas !== undefined ? parseInt(edits.qtd_tomadas) : (balance?.qtd_tomadas || 4);
      const tomadasPagas = historico.filter(t => t.pago).length;
      
      // Cálculos
      const valorFaltaPagar = valorPlanejado - valorPago;
      const duracaoSaldoDias = gastoDiario > 0 ? saldo / gastoDiario : 0;
      const valorTomada = qtdTomadas > 0 ? valorPlanejado / qtdTomadas : 0;
      const tomadasFaltaPagar = qtdTomadas - tomadasPagas;
      
      // Alertas
      let saldoAlert = 'ok';
      if (duracaoSaldoDias < 3) saldoAlert = 'critical';
      else if (duracaoSaldoDias < 7) saldoAlert = 'warning';
      
      return {
        cliente,
        mainAccount,
        balance,
        planejamento,
        valorPlanejado,
        saldo,
        valorPago,
        gastoDiario,
        qtdTomadas,
        tomadasPagas,
        valorFaltaPagar,
        duracaoSaldoDias,
        valorTomada,
        tomadasFaltaPagar,
        saldoAlert,
      };
    });
  }, [clientes, balanceControls, planejamentos, statusFilter, searchTerm, editingRows]);

  const handleFieldChange = (clientId, field, value) => {
    setEditingRows(prev => ({
      ...prev,
      [clientId]: {
        ...(prev[clientId] || {}),
        [field]: value,
      }
    }));
  };

  const handleAddTomada = (clientId, tomadaData) => {
    const edits = editingRows[clientId] || {};
    const balance = getBalanceControl(clientId);
    const historico = edits.historico_tomadas || balance?.historico_tomadas || [];
    
    const novaTomada = {
      numero: historico.length + 1,
      ...tomadaData
    };

    handleFieldChange(clientId, 'historico_tomadas', [...historico, novaTomada]);
  };

  const handleRemoveTomada = (clientId, index) => {
    const edits = editingRows[clientId] || {};
    const balance = getBalanceControl(clientId);
    const historico = edits.historico_tomadas || balance?.historico_tomadas || [];
    const novoHistorico = historico.filter((_, i) => i !== index);
    handleFieldChange(clientId, 'historico_tomadas', novoHistorico);
  };

  const handleTomadaChange = (clientId, index, field, value) => {
    const edits = editingRows[clientId] || {};
    const balance = getBalanceControl(clientId);
    const historico = [...(edits.historico_tomadas || balance?.historico_tomadas || [])];
    historico[index] = { ...historico[index], [field]: value };
    handleFieldChange(clientId, 'historico_tomadas', historico);
  };

  const handleSave = (row) => {
    const edits = editingRows[row.cliente.id] || {};
    const balance = row.balance || {};
    
    // Calcular valor_pago e tomadas_pagas baseado no histórico
    const historico = edits.historico_tomadas || balance.historico_tomadas || [];
    const valorPagoCalculado = historico
      .filter(t => t.pago)
      .reduce((sum, t) => sum + (parseFloat(t.valor) || 0), 0);
    const tomadasPagasCalculado = historico.filter(t => t.pago).length;
    
    // Puxar valor planejado do planejamento estratégico automaticamente
    const valorPlanejadoMeta = row.planejamento?.investimento_meta_mes || row.valorPlanejado;
    
    const data = {
      client_id: row.cliente.id,
      client_name: row.cliente.nome,
      month_year: selectedMonth,
      ad_account_id: row.mainAccount?.ad_account_id || '',
      saldo: edits.saldo !== undefined ? parseFloat(edits.saldo) : balance.saldo || 0,
      valor_planejado_meta: valorPlanejadoMeta,
      valor_pago: valorPagoCalculado,
      gasto_diario: edits.gasto_diario !== undefined ? parseFloat(edits.gasto_diario) : balance.gasto_diario || 0,
      qtd_tomadas: edits.qtd_tomadas !== undefined ? parseInt(edits.qtd_tomadas) : balance.qtd_tomadas || 4,
      tomadas_pagas: tomadasPagasCalculado,
      valor_enviado: edits.valor_enviado !== undefined ? parseFloat(edits.valor_enviado) : balance.valor_enviado || 0,
      data_ultima_tomada: edits.data_ultima_tomada || balance.data_ultima_tomada,
      metodo_pagamento: edits.metodo_pagamento || balance.metodo_pagamento,
      observacoes: edits.observacoes || balance.observacoes,
      historico_tomadas: historico,
    };
    
    saveMutation.mutate(data);
    setEditingRows(prev => {
      const newState = { ...prev };
      delete newState[row.cliente.id];
      return newState;
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const getSaldoAlertColor = (alert) => {
    switch (alert) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  const isUpdatedToday = (dateString) => {
    if (!dateString) return false;
    const today = new Date().toDateString();
    const date = new Date(dateString).toDateString();
    return today === date;
  };

  return (
    <div className="max-w-[1600px] mx-auto p-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Wallet className="w-6 h-6 text-violet-600" />
                Gestão de Saldo Meta Ads
                {selectedClienteDetail && (
                  <span className="text-lg font-normal text-slate-500">
                    - {clientes.find(c => c.id === selectedClienteDetail)?.nome}
                  </span>
                )}
              </CardTitle>
              <p className="text-sm text-slate-500 mt-2">
                Controle financeiro operacional por cliente
              </p>
            </div>
            {selectedClienteDetail && (
              <Button
                variant="outline"
                onClick={() => setSelectedClienteDetail(null)}
                className="gap-2"
              >
                ← Voltar
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          {/* Modo de Visualização */}
          <div className="mb-6 flex gap-2">
            <Button
              variant={viewMode === 'detailed' ? 'default' : 'outline'}
              onClick={() => setViewMode('detailed')}
              className="gap-2"
            >
              Visualização Detalhada
            </Button>
            <Button
              variant={viewMode === 'simple' ? 'default' : 'outline'}
              onClick={() => setViewMode('simple')}
              className="gap-2"
            >
              Visualização Simplificada
            </Button>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <Label>Mês de Referência</Label>
              <Input
                type="month"
                value={selectedMonth.substring(0, 7)}
                onChange={(e) => setSelectedMonth(e.target.value + '-01')}
              />
            </div>
            
            <div>
              <Label>Status do Cliente</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="md:col-span-2">
              <Label>Buscar Cliente</Label>
              <Input
                placeholder="Nome do cliente ou ID da conta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Visualização */}
          {viewMode === 'simple' ? (
            <ListaSaldoMetaAdsSimples 
              balanceControls={balanceControls}
              clientes={clientes}
              selectedMonth={selectedMonth}
              user={user}
              onClienteClick={(cliente) => {
                setSelectedClienteDetail(cliente.id);
                setViewMode('detailed');
              }}
            />
          ) : (
            <>
          {/* Lista Detalhada */}
          {isLoading ? (
            <div className="text-center py-12">Carregando...</div>
          ) : dataRows.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              Nenhum cliente com conta Meta Ads principal encontrado.
            </div>
          ) : (
            <div className="space-y-2">
              {dataRows.filter(row => !selectedClienteDetail || row.cliente.id === selectedClienteDetail).map((row) => {
                const edits = editingRows[row.cliente.id] || {};
                const isEditing = editingClients.has(row.cliente.id);
                const isExpanded = expandedCards.has(row.cliente.id);
                
                return (
                  <div key={row.cliente.id} className={`border rounded-lg transition-colors ${isUpdatedToday(row.balance?.updated_date) ? 'bg-green-50 border-green-300' : 'hover:bg-slate-50'}`}>
                    <div className="p-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                        setExpandedCards(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(row.cliente.id)) {
                            newSet.delete(row.cliente.id);
                          } else {
                            newSet.add(row.cliente.id);
                          }
                          return newSet;
                        });
                      }}>
                        {/* Cliente Info e Badges */}
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="font-semibold text-slate-900">{row.cliente.nome}</h3>
                          {isUpdatedToday(row.balance?.updated_date) && (
                            <Badge className="bg-green-600 text-white text-xs h-5">✓ Dados atualizados</Badge>
                          )}
                          {!row.planejamento && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs h-5">Sem planejamento</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-mono mb-2">
                          {row.mainAccount ? `ID: ${row.mainAccount.ad_account_id}` : `${row.cliente.cidade}, ${row.cliente.estado}`}
                        </p>

                        {/* Resumo Financeiro Compacto */}
                        <div className="flex gap-4 text-xs">
                          <div>
                            <span className="text-slate-500">Saldo:</span>
                            <span className="ml-1 font-semibold text-slate-900">{formatCurrency(row.saldo)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Planejado:</span>
                            <span className="ml-1 font-semibold text-slate-900">{formatCurrency(row.valorPlanejado)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Falta Pagar:</span>
                            <span className={`ml-1 font-semibold ${row.valorFaltaPagar > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatCurrency(row.valorFaltaPagar)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Gasto/Dia:</span>
                            <span className="ml-1 font-semibold text-slate-900">{formatCurrency(row.gastoDiario)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions no canto superior direito */}
                      <div className="flex gap-1.5 items-start flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {(isVoxxAdmin(user) || isVoxxOperacao(user)) && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalNovaTomada({ 
                                open: true, 
                                clienteId: row.cliente.id,
                                clienteNome: row.cliente.nome,
                                valorSugerido: row.valorTomada
                              });
                            }}
                            className="gap-1 h-8 text-xs"
                          >
                            <Plus className="w-3 h-3" />
                            Nova Tomada
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(createPageUrl('PlanejamentoEstrategico') + `?cliente=${row.cliente.id}`)}
                          className="h-8 w-8 p-0"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        {(isVoxxAdmin(user) || isVoxxOperacao(user)) && (
                          <>
                            {isEditing ? (
                              <Button
                                size="sm"
                                onClick={() => {
                                  handleSave(row);
                                  setEditingClients(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(row.cliente.id);
                                    return newSet;
                                  });
                                }}
                                disabled={saveMutation.isPending}
                                className="h-8 w-8 p-0"
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingClients(prev => new Set(prev).add(row.cliente.id))}
                                className="h-8 w-8 p-0"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            )}
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedCards(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(row.cliente.id)) {
                                newSet.delete(row.cliente.id);
                              } else {
                                newSet.add(row.cliente.id);
                              }
                              return newSet;
                            });
                          }}
                          className="h-8 w-8 p-0"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Detalhes Completos */}
                    {isExpanded && (
                    <div className="px-4 pb-4 border-t">
                      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-4">
                        <div>
                          <Label className="text-xs">Saldo (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={edits.saldo !== undefined ? edits.saldo : row.balance?.saldo || ''}
                            onChange={(e) => handleFieldChange(row.cliente.id, 'saldo', e.target.value)}
                            onBlur={() => handleSave(row)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSave(row);
                                e.target.blur();
                              }
                            }}
                            className="mt-1"
                            placeholder="0,00"
                          />
                        </div>

                        <div>
                          <Label className="text-xs flex items-center gap-1">
                            Valor Planejado Meta
                            {row.planejamento ? (
                              <Badge className="bg-blue-100 text-blue-700 text-[10px] h-4">Auto</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 text-[10px] h-4">Sem planj.</Badge>
                            )}
                          </Label>
                          <div className={`mt-1 px-3 py-2 rounded-md text-sm font-semibold h-9 flex items-center ${row.planejamento ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-700'}`}>
                            {formatCurrency(row.valorPlanejado)}
                          </div>
                          {row.planejamento && (
                            <p className="text-xs text-blue-600 mt-1">Do planejamento estratégico</p>
                          )}
                        </div>

                        <div>
                          <Label className="text-xs">Valor Pago (R$)</Label>
                          <div className="mt-1 px-3 py-2 bg-green-50 rounded-md text-sm font-semibold text-green-700 h-9 flex items-center">
                            {formatCurrency(row.valorPago)}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">Calculado do histórico</p>
                        </div>

                        <div>
                          <Label className="text-xs">Falta Pagar</Label>
                          <div className={`mt-1 px-3 py-2 rounded-md text-sm font-semibold h-9 flex items-center ${row.valorFaltaPagar > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            {formatCurrency(row.valorFaltaPagar)}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs flex items-center gap-1">
                            Gasto Diário (D-1)
                            <Badge className="bg-blue-100 text-blue-700 text-[10px] h-4">Auto</Badge>
                          </Label>
                          <div className="mt-1 px-3 py-2 bg-blue-50 rounded-md text-sm font-semibold text-blue-700 h-9 flex items-center">
                            {formatCurrency(row.gastoDiario)}
                          </div>
                          <p className="text-xs text-blue-600 mt-1">Da planilha "ontem meta Ads"</p>
                        </div>

                        <div>
                          <Label className="text-xs">Duração do Saldo</Label>
                          <div className="mt-1 px-3 py-2 bg-slate-50 rounded-md text-sm font-mono text-slate-700 h-9 flex items-center">
                            {row.gastoDiario > 0 ? `${row.duracaoSaldoDias.toFixed(1)} dias` : '—'}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Qtd. Tomadas</Label>
                          <Input
                            type="number"
                            value={edits.qtd_tomadas !== undefined ? edits.qtd_tomadas : row.balance?.qtd_tomadas || 4}
                            onChange={(e) => {
                              handleFieldChange(row.cliente.id, 'qtd_tomadas', e.target.value);
                              if (!isEditing) {
                                setEditingClients(prev => new Set(prev).add(row.cliente.id));
                              }
                            }}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-xs">Valor de Tomada</Label>
                          <div className="mt-1 px-3 py-2 bg-slate-50 rounded-md text-sm font-semibold text-slate-700 h-9 flex items-center">
                            {formatCurrency(row.valorTomada)}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Tomadas Pagas</Label>
                          <div className="mt-1 px-3 py-2 bg-slate-50 rounded-md text-sm font-semibold text-slate-700 h-9 flex items-center">
                            {row.tomadasPagas}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">Calculado do histórico</p>
                        </div>

                        <div>
                          <Label className="text-xs">Faltam Pagar</Label>
                          <div className="mt-1 px-3 py-2 bg-slate-50 rounded-md text-sm font-mono text-slate-700 h-9 flex items-center">
                            {row.tomadasFaltaPagar}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Valor Enviado (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={edits.valor_enviado !== undefined ? edits.valor_enviado : row.balance?.valor_enviado || ''}
                            onChange={(e) => handleFieldChange(row.cliente.id, 'valor_enviado', e.target.value)}
                            className="mt-1"
                            disabled={!isEditing}
                          />
                        </div>

                        <div>
                          <Label className="text-xs">Data Última Tomada</Label>
                          <Input
                            type="date"
                            value={edits.data_ultima_tomada || row.balance?.data_ultima_tomada || ''}
                            onChange={(e) => handleFieldChange(row.cliente.id, 'data_ultima_tomada', e.target.value)}
                            className="mt-1"
                            disabled={!isEditing}
                          />
                        </div>

                        <div>
                          <Label className="text-xs">Método de Pagamento</Label>
                          <Select
                            value={edits.metodo_pagamento || row.balance?.metodo_pagamento || 'Pix'}
                            onValueChange={(value) => handleFieldChange(row.cliente.id, 'metodo_pagamento', value)}
                            disabled={!isEditing}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pix">Pix</SelectItem>
                              <SelectItem value="Boleto">Boleto</SelectItem>
                              <SelectItem value="Cartão">Cartão</SelectItem>
                              <SelectItem value="Outro">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="md:col-span-2">
                          <Label className="text-xs">Observações</Label>
                          <Textarea
                            value={edits.observacoes !== undefined ? edits.observacoes : row.balance?.observacoes || ''}
                            onChange={(e) => handleFieldChange(row.cliente.id, 'observacoes', e.target.value)}
                            className="mt-1"
                            rows={2}
                            placeholder="Notas e observações..."
                            disabled={!isEditing}
                          />
                        </div>
                      </div>

                      {/* Histórico de Tomadas */}
                      <div className="mt-6 pt-4 border-t">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="text-sm font-semibold text-slate-900">Histórico de Tomadas</Label>
                          {isEditing && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddTomada(row.cliente.id)}
                              className="gap-1 h-7"
                            >
                              <Plus className="w-3 h-3" />
                              Adicionar Tomada
                            </Button>
                          )}
                        </div>
                        
                        {(() => {
                          const historico = edits.historico_tomadas || row.balance?.historico_tomadas || [];
                          
                          if (historico.length === 0) {
                            return (
                              <div className="text-center py-6 text-slate-400 text-sm">
                                Nenhuma tomada registrada para este mês
                              </div>
                            );
                          }
                          
                          return (
                            <div className="space-y-2">
                              {historico.map((tomada, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={tomada.pago}
                                      onCheckedChange={(checked) => {
                                        if (!editingClients.has(row.cliente.id)) {
                                          setEditingClients(prev => new Set(prev).add(row.cliente.id));
                                        }
                                        handleTomadaChange(row.cliente.id, index, 'pago', checked);
                                        if (checked && !tomada.data_pagamento) {
                                          handleTomadaChange(row.cliente.id, index, 'data_pagamento', format(new Date(), 'yyyy-MM-dd'));
                                        }
                                      }}
                                    />
                                    <span className={`text-sm font-medium ${tomada.pago ? 'text-green-700 line-through' : 'text-slate-700'}`}>
                                      Tomada #{tomada.numero}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 flex-1">
                                    <div className="w-32">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={tomada.valor || ''}
                                        onChange={(e) => handleTomadaChange(row.cliente.id, index, 'valor', parseFloat(e.target.value) || 0)}
                                        placeholder="Valor"
                                        className="h-8 text-xs"
                                        disabled={!isEditing}
                                      />
                                    </div>
                                    
                                    <div className="w-36">
                                      <Input
                                        type="date"
                                        value={tomada.data_envio || ''}
                                        onChange={(e) => handleTomadaChange(row.cliente.id, index, 'data_envio', e.target.value)}
                                        className="h-8 text-xs"
                                        disabled={!isEditing}
                                      />
                                    </div>
                                    
                                    {tomada.pago && (
                                      <div className="w-36">
                                        <Input
                                          type="date"
                                          value={tomada.data_pagamento || ''}
                                          onChange={(e) => {
                                            if (!editingClients.has(row.cliente.id)) {
                                              setEditingClients(prev => new Set(prev).add(row.cliente.id));
                                            }
                                            handleTomadaChange(row.cliente.id, index, 'data_pagamento', e.target.value);
                                          }}
                                          className="h-8 text-xs"
                                        />
                                      </div>
                                    )}
                                    
                                    {tomada.pago && tomada.data_pagamento && (
                                      <Badge className="bg-green-100 text-green-800 text-xs whitespace-nowrap">
                                        Pago: {format(new Date(tomada.data_pagamento), 'dd/MM/yy')}
                                      </Badge>
                                    )}
                                    
                                    {isEditing && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleRemoveTomada(row.cliente.id, index)}
                                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                              
                              {historico.length > 0 && (
                                <div className="flex justify-between items-center pt-2 mt-2 border-t text-sm">
                                  <span className="text-slate-600">Total registrado:</span>
                                  <span className="font-semibold text-slate-900">
                                    {formatCurrency(historico.reduce((sum, t) => sum + (t.valor || 0), 0))}
                                  </span>
                                  <span className="text-slate-600">
                                    {historico.filter(t => t.pago).length} de {historico.length} pagas
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Nova Tomada */}
      <ModalNovaTomada
        open={modalNovaTomada.open}
        onOpenChange={(open) => setModalNovaTomada({ open, clienteId: null, clienteNome: null, valorSugerido: 0 })}
        onSave={(tomadaData) => {
          if (modalNovaTomada.clienteId) {
            // Ativa edição e expande card
            setEditingClients(prev => new Set(prev).add(modalNovaTomada.clienteId));
            setExpandedCards(prev => new Set(prev).add(modalNovaTomada.clienteId));
            handleAddTomada(modalNovaTomada.clienteId, tomadaData);
          }
        }}
        clienteNome={modalNovaTomada.clienteNome}
        valorSugerido={modalNovaTomada.valorSugerido}
      />
    </div>
  );
}