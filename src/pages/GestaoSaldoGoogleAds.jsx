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
import { Wallet, AlertTriangle, CheckCircle2, TrendingUp, Edit2, Save, Plus, Trash2, ChevronDown, ChevronUp, Users, DollarSign } from 'lucide-react';
import KPICard from '@/components/ui/KPICard';
import { format } from 'date-fns';
import { isVoxxAdmin, isVoxxOperacao } from '@/components/utils/auth';
import { Checkbox } from '@/components/ui/checkbox';
import GoogleSaldoModalNovaTomada from '@/components/googleads/GoogleSaldoModalNovaTomada.jsx';

export default function GestaoSaldoGoogleAds({ user }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(currentDate, 'yyyy-MM-01'));
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRows, setEditingRows] = useState({});
  const [editingClients, setEditingClients] = useState(new Set());
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [modalNovaTomada, setModalNovaTomada] = useState({ open: false, accountName: null, valorSugerido: 0 });

  // GOOGLE-ONLY: Fetch contas Google Ads
  const { data: googleAccounts = [] } = useQuery({
    queryKey: ['googleads-saldo-accounts'],
    queryFn: () => base44.entities.GoogleAdsAccount.list('-account_name', 500),
    staleTime: 5 * 60 * 1000,
  });

  // GOOGLE-ONLY: Fetch saldos Google do mês
  const { data: googleSaldos = [], isLoading } = useQuery({
    queryKey: ['googleSaldo_list', selectedMonth],
    queryFn: () => base44.entities.GoogleAdsSaldo.filter({ month_year: selectedMonth }),
    enabled: !!selectedMonth,
  });

  // GOOGLE-ONLY: Fetch usuários VOXX para responsável
  const { data: voxxUsers = [] } = useQuery({
    queryKey: ['voxx-users-google-saldo'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 5 * 60 * 1000,
  });

  const voxxUsersList = voxxUsers.filter(u =>
    u.tipo_usuario === 'voxx_admin' ||
    u.tipo_usuario === 'voxx_operacao' ||
    u.tipo_usuario === 'voxx_manager' ||
    u.role === 'admin'
  );

  // GOOGLE-ONLY: Save mutation — só toca em GoogleAdsSaldo
  const googleSaldo_update = useMutation({
    mutationFn: async (data) => {
      const existing = googleSaldos.find(
        s => s.account_name === data.account_name && s.month_year === data.month_year
      );
      if (existing) {
        return base44.entities.GoogleAdsSaldo.update(existing.id, data);
      } else {
        return base44.entities.GoogleAdsSaldo.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['googleSaldo_list']);
      toast({ title: 'Sucesso', description: 'Dados Google Ads salvos.' });
    },
  });

  // GOOGLE-ONLY: Assign responsável — só toca em GoogleAdsSaldo
  const googleSaldo_assignResponsavel = async (accountName, userId) => {
    const existing = googleSaldos.find(
      s => s.account_name === accountName && s.month_year === selectedMonth
    );
    if (existing) {
      await base44.entities.GoogleAdsSaldo.update(existing.id, { responsavel_voxx_google: userId });
    } else {
      await base44.entities.GoogleAdsSaldo.create({
        account_name: accountName,
        month_year: selectedMonth,
        responsavel_voxx_google: userId,
      });
    }
    queryClient.invalidateQueries(['googleSaldo_list']);
    toast({ title: 'Responsável atribuído', description: 'Responsável Google Ads atualizado.' });
  };

  const getSaldo = (accountName) =>
    googleSaldos.find(s => s.account_name === accountName && s.month_year === selectedMonth);

  const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const isUpdatedToday = (dateString) => {
    if (!dateString) return false;
    return new Date().toDateString() === new Date(dateString).toDateString();
  };

  // Build rows from GoogleAdsAccount
  const dataRows = useMemo(() => {
    const accounts = googleAccounts.filter(a => a.account_status === 'Ativa' || !a.account_status);

    return accounts
      .filter(a => {
        if (!searchTerm) return true;
        const t = searchTerm.toLowerCase();
        return a.account_name?.toLowerCase().includes(t) || a.unidade_nome?.toLowerCase().includes(t);
      })
      .map(account => {
        const saldo = getSaldo(account.account_name);
        const edits = editingRows[account.account_name] || {};

        const historico = edits.historico_tomadas || saldo?.historico_tomadas || [];
        const saldoAtual = edits.saldo_atual !== undefined ? parseFloat(edits.saldo_atual) : (saldo?.saldo_atual || 0);
        const valorPlanejado = edits.valor_planejado_google !== undefined
          ? parseFloat(edits.valor_planejado_google)
          : (saldo?.valor_planejado_google || 0);
        const gastoDiario = edits.gasto_diario !== undefined
          ? parseFloat(edits.gasto_diario)
          : (saldo?.gasto_diario || account.cost || 0);
        const qtdTomadas = edits.qtd_tomadas !== undefined ? parseInt(edits.qtd_tomadas) : (saldo?.qtd_tomadas || 4);
        const valorPago = historico.filter(t => t.pago).reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
        const tomadasPagas = historico.filter(t => t.pago).length;
        const valorFaltaPagar = valorPlanejado - valorPago;
        const duracaoSaldoDias = gastoDiario > 0 ? saldoAtual / gastoDiario : 0;
        const valorTomada = qtdTomadas > 0 ? valorPlanejado / qtdTomadas : 0;

        let saldoAlert = 'ok';
        if (duracaoSaldoDias > 0 && duracaoSaldoDias < 3) saldoAlert = 'critical';
        else if (duracaoSaldoDias > 0 && duracaoSaldoDias < 7) saldoAlert = 'warning';

        // Responsável: APENAS GoogleAdsSaldo.responsavel_voxx_google
        const responsavel = saldo?.responsavel_voxx_google || null;

        return {
          account,
          saldo,
          edits,
          saldoAtual,
          valorPlanejado,
          gastoDiario,
          qtdTomadas,
          valorPago,
          tomadasPagas,
          valorFaltaPagar,
          duracaoSaldoDias,
          valorTomada,
          tomadasFaltaPagar: qtdTomadas - tomadasPagas,
          saldoAlert,
          historico,
          responsavel,
        };
      });
  }, [googleAccounts, googleSaldos, editingRows, searchTerm, selectedMonth]);

  const dashboardMetrics = useMemo(() => {
    const totalSaldo = dataRows.reduce((s, r) => s + r.saldoAtual, 0);
    const totalGasto = dataRows.reduce((s, r) => s + r.gastoDiario, 0);
    const totalPlanejado = dataRows.reduce((s, r) => s + r.valorPlanejado, 0);
    const comAlerta = dataRows.filter(r => r.saldoAlert !== 'ok').length;
    const duracaoMedia = totalGasto > 0 ? totalSaldo / totalGasto : 0;
    return { totalSaldo, totalGasto, totalPlanejado, comAlerta, duracaoMedia, total: dataRows.length };
  }, [dataRows]);

  const handleFieldChange = (key, field, value) => {
    setEditingRows(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: value } }));
  };

  const handleSave = (row) => {
    const edits = editingRows[row.account.account_name] || {};
    const historico = edits.historico_tomadas || row.saldo?.historico_tomadas || [];
    const valorPagoCalc = historico.filter(t => t.pago).reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);

    const data = {
      account_name: row.account.account_name,
      cliente_nome: row.account.unidade_nome || row.account.cliente_nome,
      month_year: selectedMonth,
      saldo_atual: row.saldoAtual,
      valor_planejado_google: row.valorPlanejado,
      valor_pago: valorPagoCalc,
      gasto_diario: row.gastoDiario,
      qtd_tomadas: row.qtdTomadas,
      tomadas_pagas: historico.filter(t => t.pago).length,
      valor_enviado: edits.valor_enviado !== undefined ? parseFloat(edits.valor_enviado) : row.saldo?.valor_enviado || 0,
      data_ultima_tomada: edits.data_ultima_tomada || row.saldo?.data_ultima_tomada,
      metodo_pagamento: edits.metodo_pagamento || row.saldo?.metodo_pagamento,
      observacoes: edits.observacoes !== undefined ? edits.observacoes : row.saldo?.observacoes || '',
      historico_tomadas: historico,
      responsavel_voxx_google: row.saldo?.responsavel_voxx_google || null,
    };
    googleSaldo_update.mutate(data);
    setEditingRows(prev => { const n = { ...prev }; delete n[row.account.account_name]; return n; });
    setEditingClients(prev => { const n = new Set(prev); n.delete(row.account.account_name); return n; });
  };

  const handleAddTomada = (key, tomadaData) => {
    const edits = editingRows[key] || {};
    const saldo = getSaldo(key);
    const historico = edits.historico_tomadas || saldo?.historico_tomadas || [];
    handleFieldChange(key, 'historico_tomadas', [...historico, { numero: historico.length + 1, ...tomadaData }]);
  };

  const handleRemoveTomada = (key, index) => {
    const edits = editingRows[key] || {};
    const saldo = getSaldo(key);
    const historico = (edits.historico_tomadas || saldo?.historico_tomadas || []).filter((_, i) => i !== index);
    handleFieldChange(key, 'historico_tomadas', historico);
  };

  const handleTomadaChange = (key, index, field, value) => {
    const edits = editingRows[key] || {};
    const saldo = getSaldo(key);
    const historico = [...(edits.historico_tomadas || saldo?.historico_tomadas || [])];
    historico[index] = { ...historico[index], [field]: value };
    handleFieldChange(key, 'historico_tomadas', historico);
  };

  const toggleExpand = (key) => {
    setExpandedCards(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  return (
    <div className="max-w-[1600px] mx-auto p-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Wallet className="w-6 h-6 text-blue-600" />
            Gestão de Saldo Google Ads
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">Controle financeiro operacional — Google Ads (isolado do Meta)</p>
        </CardHeader>

        <CardContent className="pt-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard title="Contas Google" value={dashboardMetrics.total} subtitle="contas ativas" icon={Users} variant="primary" />
            <KPICard
              title="Saldo Total Disponível"
              value={formatCurrency(dashboardMetrics.totalSaldo)}
              subtitle={`~${dashboardMetrics.duracaoMedia.toFixed(1)} dias em média`}
              icon={Wallet}
              variant="success"
            />
            <KPICard title="Gasto Diário Total" value={formatCurrency(dashboardMetrics.totalGasto)} subtitle="Estimado" icon={TrendingUp} variant="default" />
            <KPICard title="Total Planejado" value={formatCurrency(dashboardMetrics.totalPlanejado)} subtitle="Google Ads" icon={DollarSign} variant="default" />
          </div>

          {/* Alerta */}
          {dashboardMetrics.comAlerta > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-900">
                  {dashboardMetrics.comAlerta} {dashboardMetrics.comAlerta === 1 ? 'conta precisa' : 'contas precisam'} de atenção
                </p>
                <p className="text-xs text-red-700 mt-0.5">Saldo baixo detectado</p>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <Label>Mês de Referência</Label>
              <Input
                type="month"
                value={selectedMonth.substring(0, 7)}
                onChange={(e) => setSelectedMonth(e.target.value + '-01')}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Buscar Conta</Label>
              <Input
                placeholder="Nome da conta ou unidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Lista */}
          {isLoading ? (
            <div className="text-center py-12">Carregando...</div>
          ) : dataRows.length === 0 ? (
            <div className="text-center py-12 text-slate-500">Nenhuma conta Google Ads encontrada.</div>
          ) : (
            <div className="space-y-2">
              {dataRows.map((row) => {
                const key = row.account.account_name;
                const isEditing = editingClients.has(key);
                const isExpanded = expandedCards.has(key);
                const edits = editingRows[key] || {};

                return (
                  <div
                    key={key}
                    className={`border rounded-lg transition-colors ${
                      isUpdatedToday(row.saldo?.updated_date)
                        ? 'bg-green-50 border-green-300'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="p-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(key)}>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="font-semibold text-slate-900">{row.account.account_name}</h3>
                          {row.account.unidade_nome && (
                            <span className="text-xs text-slate-500">{row.account.unidade_nome}</span>
                          )}
                          {row.saldoAlert === 'critical' && (
                            <Badge className="bg-red-600 text-white text-xs h-5">
                              <AlertTriangle className="w-3 h-3 mr-1" />Saldo Crítico
                            </Badge>
                          )}
                          {row.saldoAlert === 'warning' && (
                            <Badge className="bg-yellow-600 text-white text-xs h-5">
                              <AlertTriangle className="w-3 h-3 mr-1" />Saldo Baixo
                            </Badge>
                          )}
                          {/* Responsável Google — APENAS GoogleAdsSaldo.responsavel_voxx_google */}
                          <Select
                            value={row.responsavel || '__NONE__'}
                            onValueChange={(v) => googleSaldo_assignResponsavel(key, v === '__NONE__' ? null : v)}
                          >
                            <SelectTrigger className="h-6 text-xs w-40 border-dashed" onClick={e => e.stopPropagation()}>
                              <SelectValue placeholder="Responsável Google" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__NONE__">Não atribuído</SelectItem>
                              {voxxUsersList.map(u => (
                                <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex gap-4 text-xs flex-wrap">
                          <div><span className="text-slate-500">Saldo:</span> <span className="font-semibold">{formatCurrency(row.saldoAtual)}</span></div>
                          <div><span className="text-slate-500">Planejado:</span> <span className="font-semibold">{formatCurrency(row.valorPlanejado)}</span></div>
                          <div>
                            <span className="text-slate-500">Falta Pagar:</span>
                            <span className={`ml-1 font-semibold ${row.valorFaltaPagar > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatCurrency(row.valorFaltaPagar)}
                            </span>
                          </div>
                          <div><span className="text-slate-500">Gasto/Dia:</span> <span className="font-semibold">{formatCurrency(row.gastoDiario)}</span></div>
                          {row.duracaoSaldoDias > 0 && (
                            <div><span className="text-slate-500">Duração:</span> <span className="font-semibold">{row.duracaoSaldoDias.toFixed(1)} dias</span></div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-1.5 items-start flex-shrink-0" onClick={e => e.stopPropagation()}>
                        {(isVoxxAdmin(user) || isVoxxOperacao(user)) && (
                          <Button
                            size="sm"
                            onClick={() => setModalNovaTomada({ open: true, accountName: key, valorSugerido: row.valorTomada })}
                            className="gap-1 h-8 text-xs"
                          >
                            <Plus className="w-3 h-3" />Nova Tomada
                          </Button>
                        )}
                        {(isVoxxAdmin(user) || isVoxxOperacao(user)) && (
                          isEditing ? (
                            <Button size="sm" onClick={() => handleSave(row)} disabled={googleSaldo_update.isPending} className="h-8 w-8 p-0">
                              <Save className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => setEditingClients(prev => new Set(prev).add(key))} className="h-8 w-8 p-0">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )
                        )}
                        <Button size="sm" variant="ghost" onClick={() => toggleExpand(key)} className="h-8 w-8 p-0">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Detalhes Expandidos */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-4">
                          <div>
                            <Label className="text-xs">Saldo Atual (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={edits.saldo_atual !== undefined ? edits.saldo_atual : row.saldo?.saldo_atual || ''}
                              onChange={(e) => handleFieldChange(key, 'saldo_atual', e.target.value)}
                              onBlur={() => handleSave(row)}
                              className="mt-1"
                              placeholder="0,00"
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Valor Planejado Google (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={edits.valor_planejado_google !== undefined ? edits.valor_planejado_google : row.saldo?.valor_planejado_google || ''}
                              onChange={(e) => handleFieldChange(key, 'valor_planejado_google', e.target.value)}
                              className="mt-1"
                              disabled={!isEditing}
                              placeholder="0,00"
                            />
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
                            <Label className="text-xs">Gasto Diário (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={edits.gasto_diario !== undefined ? edits.gasto_diario : row.saldo?.gasto_diario || ''}
                              onChange={(e) => handleFieldChange(key, 'gasto_diario', e.target.value)}
                              className="mt-1"
                              disabled={!isEditing}
                              placeholder="0,00"
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Qtd. Tomadas</Label>
                            <Input
                              type="number"
                              value={edits.qtd_tomadas !== undefined ? edits.qtd_tomadas : row.saldo?.qtd_tomadas || 4}
                              onChange={(e) => {
                                handleFieldChange(key, 'qtd_tomadas', e.target.value);
                                if (!isEditing) setEditingClients(prev => new Set(prev).add(key));
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
                          </div>

                          <div>
                            <Label className="text-xs">Faltam Pagar</Label>
                            <div className="mt-1 px-3 py-2 bg-slate-50 rounded-md text-sm font-mono text-slate-700 h-9 flex items-center">
                              {row.tomadasFaltaPagar}
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs">Data Última Tomada</Label>
                            <Input
                              type="date"
                              value={edits.data_ultima_tomada || row.saldo?.data_ultima_tomada || ''}
                              onChange={(e) => handleFieldChange(key, 'data_ultima_tomada', e.target.value)}
                              className="mt-1"
                              disabled={!isEditing}
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Método de Pagamento</Label>
                            <Select
                              value={edits.metodo_pagamento || row.saldo?.metodo_pagamento || 'Pix'}
                              onValueChange={(v) => handleFieldChange(key, 'metodo_pagamento', v)}
                              disabled={!isEditing}
                            >
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
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
                              value={edits.observacoes !== undefined ? edits.observacoes : row.saldo?.observacoes || ''}
                              onChange={(e) => handleFieldChange(key, 'observacoes', e.target.value)}
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
                              <Button size="sm" variant="outline" onClick={() => handleAddTomada(key, {})} className="gap-1 h-7">
                                <Plus className="w-3 h-3" />Adicionar Tomada
                              </Button>
                            )}
                          </div>

                          {row.historico.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-sm">Nenhuma tomada registrada para este mês</div>
                          ) : (
                            <div className="space-y-2">
                              {row.historico.map((tomada, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={tomada.pago}
                                      onCheckedChange={(checked) => {
                                        if (!editingClients.has(key)) setEditingClients(prev => new Set(prev).add(key));
                                        handleTomadaChange(key, index, 'pago', checked);
                                        if (checked && !tomada.data_pagamento) {
                                          handleTomadaChange(key, index, 'data_pagamento', format(new Date(), 'yyyy-MM-dd'));
                                        }
                                      }}
                                    />
                                    <span className={`text-sm font-medium ${tomada.pago ? 'text-green-700 line-through' : 'text-slate-700'}`}>
                                      Tomada #{tomada.numero}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-1">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={tomada.valor || ''}
                                      onChange={(e) => handleTomadaChange(key, index, 'valor', parseFloat(e.target.value) || 0)}
                                      placeholder="Valor"
                                      className="h-8 text-xs w-32"
                                      disabled={!isEditing}
                                    />
                                    <Input
                                      type="date"
                                      value={tomada.data_envio || ''}
                                      onChange={(e) => handleTomadaChange(key, index, 'data_envio', e.target.value)}
                                      className="h-8 text-xs w-36"
                                      disabled={!isEditing}
                                    />
                                    {tomada.pago && (
                                      <Input
                                        type="date"
                                        value={tomada.data_pagamento || ''}
                                        onChange={(e) => {
                                          if (!editingClients.has(key)) setEditingClients(prev => new Set(prev).add(key));
                                          handleTomadaChange(key, index, 'data_pagamento', e.target.value);
                                        }}
                                        className="h-8 text-xs w-36"
                                      />
                                    )}
                                    {tomada.pago && tomada.data_pagamento && (
                                      <Badge className="bg-green-100 text-green-800 text-xs whitespace-nowrap">
                                        Pago: {format(new Date(tomada.data_pagamento), 'dd/MM/yy')}
                                      </Badge>
                                    )}
                                    {isEditing && (
                                      <Button size="sm" variant="ghost" onClick={() => handleRemoveTomada(key, index)} className="h-7 w-7 p-0 text-red-600 hover:bg-red-50">
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                              <div className="flex justify-between items-center pt-2 mt-2 border-t text-sm">
                                <span className="text-slate-600">Total registrado:</span>
                                <span className="font-semibold">{formatCurrency(row.historico.reduce((s, t) => s + (t.valor || 0), 0))}</span>
                                <span className="text-slate-600">{row.tomadasPagas} de {row.historico.length} pagas</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <GoogleSaldoModalNovaTomada
        open={modalNovaTomada.open}
        onOpenChange={(open) => setModalNovaTomada({ open, accountName: null, valorSugerido: 0 })}
        onSave={(tomadaData) => {
          if (modalNovaTomada.accountName) {
            setEditingClients(prev => new Set(prev).add(modalNovaTomada.accountName));
            setExpandedCards(prev => new Set(prev).add(modalNovaTomada.accountName));
            handleAddTomada(modalNovaTomada.accountName, tomadaData);
          }
        }}
        accountName={modalNovaTomada.accountName}
        valorSugerido={modalNovaTomada.valorSugerido}
      />
    </div>
  );
}