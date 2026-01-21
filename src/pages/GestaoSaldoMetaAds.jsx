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
import { Wallet, AlertTriangle, CheckCircle2, TrendingUp, Calendar, ExternalLink, Edit2, Save } from 'lucide-react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';

export default function GestaoSaldoMetaAds({ user }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(currentDate, 'yyyy-MM-01'));
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRows, setEditingRows] = useState({});

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
      const mainAccount = getMainMetaAccount(c);
      if (!mainAccount) return false;
      
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return c.nome?.toLowerCase().includes(search) ||
               mainAccount.ad_account_id?.toLowerCase().includes(search);
      }
      
      return true;
    });

    return filtered.map(cliente => {
      const mainAccount = getMainMetaAccount(cliente);
      const balance = getBalanceControl(cliente.id);
      const planejamento = getPlanejamento(cliente.id);
      
      const valorPlanejado = planejamento?.investimento_meta_mes || 0;
      const saldo = balance?.saldo || 0;
      const valorPago = balance?.valor_pago || 0;
      const gastoDiario = balance?.gasto_diario || 0;
      const qtdTomadas = balance?.qtd_tomadas || 4;
      const tomadasPagas = balance?.tomadas_pagas || 0;
      
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
  }, [clientes, balanceControls, planejamentos, statusFilter, searchTerm]);

  const handleFieldChange = (clientId, field, value) => {
    setEditingRows(prev => ({
      ...prev,
      [clientId]: {
        ...(prev[clientId] || {}),
        [field]: value,
      }
    }));
  };

  const handleSave = (row) => {
    const edits = editingRows[row.cliente.id] || {};
    const balance = row.balance || {};
    
    const data = {
      client_id: row.cliente.id,
      client_name: row.cliente.nome,
      month_year: selectedMonth,
      ad_account_id: row.mainAccount.ad_account_id,
      saldo: edits.saldo !== undefined ? parseFloat(edits.saldo) : balance.saldo || 0,
      valor_planejado_meta: row.valorPlanejado,
      valor_pago: edits.valor_pago !== undefined ? parseFloat(edits.valor_pago) : balance.valor_pago || 0,
      gasto_diario: edits.gasto_diario !== undefined ? parseFloat(edits.gasto_diario) : balance.gasto_diario || 0,
      qtd_tomadas: edits.qtd_tomadas !== undefined ? parseInt(edits.qtd_tomadas) : balance.qtd_tomadas || 4,
      tomadas_pagas: edits.tomadas_pagas !== undefined ? parseInt(edits.tomadas_pagas) : balance.tomadas_pagas || 0,
      valor_enviado: edits.valor_enviado !== undefined ? parseFloat(edits.valor_enviado) : balance.valor_enviado || 0,
      data_ultima_tomada: edits.data_ultima_tomada || balance.data_ultima_tomada,
      metodo_pagamento: edits.metodo_pagamento || balance.metodo_pagamento,
      observacoes: edits.observacoes || balance.observacoes,
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

  return (
    <div className="max-w-[1600px] mx-auto p-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Wallet className="w-6 h-6 text-violet-600" />
                Gestão de Saldo Meta Ads
              </CardTitle>
              <p className="text-sm text-slate-500 mt-2">
                Controle financeiro operacional por cliente
              </p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
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

          {/* Lista */}
          {isLoading ? (
            <div className="text-center py-12">Carregando...</div>
          ) : dataRows.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              Nenhum cliente com conta Meta Ads principal encontrado.
            </div>
          ) : (
            <div className="space-y-2">
              {dataRows.map((row) => {
                const edits = editingRows[row.cliente.id] || {};
                const isEditing = Object.keys(edits).length > 0;
                
                return (
                  <div key={row.cliente.id} className="border rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="p-4 flex items-center gap-4">
                      {/* Cliente Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-slate-900 truncate">{row.cliente.nome}</h3>
                          {!row.planejamento && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs">
                              Sem planejamento
                            </Badge>
                          )}
                          {row.saldoAlert !== 'ok' && row.duracaoSaldoDias > 0 && (
                            <Badge className={`text-xs ${getSaldoAlertColor(row.saldoAlert)}`}>
                              Saldo: {row.duracaoSaldoDias.toFixed(1)} dias
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-mono">ID: {row.mainAccount.ad_account_id}</p>
                      </div>

                      {/* Resumo Financeiro */}
                      <div className="flex gap-6 text-sm">
                        <div>
                          <span className="text-slate-500 text-xs">Saldo:</span>
                          <div className="font-semibold text-slate-900">{formatCurrency(row.saldo)}</div>
                        </div>
                        <div>
                          <span className="text-slate-500 text-xs">Planejado:</span>
                          <div className="font-semibold text-slate-900">{formatCurrency(row.valorPlanejado)}</div>
                        </div>
                        <div>
                          <span className="text-slate-500 text-xs">Falta Pagar:</span>
                          <div className={`font-semibold ${row.valorFaltaPagar > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(row.valorFaltaPagar)}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500 text-xs">Gasto/Dia:</span>
                          <div className="font-semibold text-slate-900">{formatCurrency(row.gastoDiario)}</div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(createPageUrl('PlanejamentoEstrategico') + `?cliente=${row.cliente.id}`)}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        {isEditing ? (
                          <Button
                            size="sm"
                            onClick={() => handleSave(row)}
                            disabled={saveMutation.isPending}
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingRows(prev => ({ ...prev, [row.cliente.id]: {} }))}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Detalhes Completos */}
                    <div className="px-4 pb-4 border-t">
                      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-4">
                        <div>
                          <Label className="text-xs">Saldo (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={edits.saldo !== undefined ? edits.saldo : row.balance?.saldo || ''}
                            onChange={(e) => handleFieldChange(row.cliente.id, 'saldo', e.target.value)}
                            className="mt-1"
                            disabled={!isEditing}
                          />
                        </div>

                        <div>
                          <Label className="text-xs">Valor Planejado Meta</Label>
                          <div className="mt-1 px-3 py-2 bg-slate-50 rounded-md text-sm font-semibold text-slate-700 h-9 flex items-center">
                            {formatCurrency(row.valorPlanejado)}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Valor Pago (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={edits.valor_pago !== undefined ? edits.valor_pago : row.balance?.valor_pago || ''}
                            onChange={(e) => handleFieldChange(row.cliente.id, 'valor_pago', e.target.value)}
                            className="mt-1"
                            disabled={!isEditing}
                          />
                        </div>

                        <div>
                          <Label className="text-xs">Falta Pagar</Label>
                          <div className={`mt-1 px-3 py-2 rounded-md text-sm font-semibold h-9 flex items-center ${row.valorFaltaPagar > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            {formatCurrency(row.valorFaltaPagar)}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Gasto Diário (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={edits.gasto_diario !== undefined ? edits.gasto_diario : row.balance?.gasto_diario || ''}
                            onChange={(e) => handleFieldChange(row.cliente.id, 'gasto_diario', e.target.value)}
                            className="mt-1"
                            disabled={!isEditing}
                          />
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
                            onChange={(e) => handleFieldChange(row.cliente.id, 'qtd_tomadas', e.target.value)}
                            className="mt-1"
                            disabled={!isEditing}
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
                          <Input
                            type="number"
                            value={edits.tomadas_pagas !== undefined ? edits.tomadas_pagas : row.balance?.tomadas_pagas || 0}
                            onChange={(e) => handleFieldChange(row.cliente.id, 'tomadas_pagas', e.target.value)}
                            className="mt-1"
                            disabled={!isEditing}
                          />
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}