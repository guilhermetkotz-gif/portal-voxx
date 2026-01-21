import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, TrendingUp, DollarSign, Target, Users, Calendar, AlertTriangle, CheckCircle2, BarChart3, FileText, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InfograficoExecutivo from '@/components/planejamento/InfograficoExecutivo';
import { isVoxxAdmin, isVoxxOperacao } from '@/components/utils/auth';

const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatNumber = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return Math.round(value).toLocaleString('pt-BR');
};

export default function PlanejamentoEstrategico({ currentCliente, selectedClienteId, user }) {
  const queryClient = useQueryClient();
  const currentMonth = format(new Date(), 'yyyy-MM');
  
  const urlParams = new URLSearchParams(window.location.search);
  const clienteIdFromUrl = urlParams.get('cliente_id');
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [viewingClienteId, setViewingClienteId] = useState(clienteIdFromUrl || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('todos');
  const [formData, setFormData] = useState({
    meta_faturamento: 0,
    ticket_medio: 0,
    percentual_investimento_marketing: 0,
    percentual_impostos: 0,
    investimento_feed: 0,
    investimento_google: 0,
    investimento_tiktok: 0,
    cpl_planejado: 0,
    conversao_leads_contatos: 0,
    conversao_contatos_agendamento: 0,
    conversao_agendamento_comparecimento: 0,
    conversao_comparecimento_fechamento: 0
  });

  // Buscar todos os clientes disponíveis para o usuário
  const { data: todosOsClientes = [] } = useQuery({
    queryKey: ['todosClientesPlanejamento', user?.id],
    queryFn: async () => {
      if (user?.role === 'admin' || isVoxxAdmin(user)) {
        return base44.entities.Cliente.list('-updated_date', 500);
      }
      
      if (isVoxxOperacao(user)) {
        const allClientes = await base44.entities.Cliente.list('-updated_date', 500);
        return allClientes.filter(c => user?.clientes_atribuidos?.includes(c.id));
      }
      
      const userAccess = await base44.entities.UserClientAccess.filter({
        usuario_id: user.id,
        status: 'ativo'
      });
      const clienteIds = userAccess.map(a => a.cliente_id);
      const allClientes = await base44.entities.Cliente.list('-updated_date', 500);
      return allClientes.filter(c => clienteIds.includes(c.id));
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000
  });

  // Buscar todos os planejamentos para filtro
  const { data: todosOsPlanejamentosGeral = [] } = useQuery({
    queryKey: ['todosOsPlanejamentosGeral'],
    queryFn: () => base44.entities.PlanejamentoEstrategico.list('-mes_referencia', 1000),
    enabled: !viewingClienteId,
    staleTime: 2 * 60 * 1000
  });

  // Buscar todos os planejamentos do cliente
  const { data: todosOsPlanejamentos = [] } = useQuery({
    queryKey: ['todosOsPlanejamentos', viewingClienteId],
    queryFn: () => base44.entities.PlanejamentoEstrategico.filter({
      cliente_id: viewingClienteId
    }, '-mes_referencia'),
    enabled: !!viewingClienteId,
    staleTime: 30 * 1000
  });

  // Buscar planejamento existente para o mês selecionado
  const { data: planejamentos = [] } = useQuery({
    queryKey: ['planejamentos', viewingClienteId, selectedMonth],
    queryFn: () => base44.entities.PlanejamentoEstrategico.filter({
      cliente_id: viewingClienteId,
      mes_referencia: `${selectedMonth}-01`
    }),
    enabled: !!viewingClienteId,
    staleTime: 30 * 1000
  });

  const planejamentoAtual = planejamentos[0];

  // Carregar dados do planejamento quando encontrado
  useEffect(() => {
    if (planejamentoAtual) {
      setFormData({
        meta_faturamento: planejamentoAtual.meta_faturamento || 0,
        ticket_medio: planejamentoAtual.ticket_medio || 0,
        percentual_investimento_marketing: planejamentoAtual.percentual_investimento_marketing || 0,
        percentual_impostos: planejamentoAtual.percentual_impostos || 0,
        investimento_feed: planejamentoAtual.investimento_feed || 0,
        investimento_google: planejamentoAtual.investimento_google || 0,
        investimento_tiktok: planejamentoAtual.investimento_tiktok || 0,
        cpl_planejado: planejamentoAtual.cpl_planejado || 0,
        conversao_leads_contatos: planejamentoAtual.conversao_leads_contatos || 0,
        conversao_contatos_agendamento: planejamentoAtual.conversao_contatos_agendamento || 0,
        conversao_agendamento_comparecimento: planejamentoAtual.conversao_agendamento_comparecimento || 0,
        conversao_comparecimento_fechamento: planejamentoAtual.conversao_comparecimento_fechamento || 0
      });
    } else {
      setFormData({
        meta_faturamento: 0,
        ticket_medio: 0,
        percentual_investimento_marketing: 0,
        percentual_impostos: 0,
        investimento_feed: 0,
        investimento_google: 0,
        investimento_tiktok: 0,
        cpl_planejado: 0,
        conversao_leads_contatos: 0,
        conversao_contatos_agendamento: 0,
        conversao_agendamento_comparecimento: 0,
        conversao_comparecimento_fechamento: 0
      });
    }
  }, [planejamentoAtual]);

  // Cálculos automáticos
  const investimentoTotal = (formData.meta_faturamento * formData.percentual_investimento_marketing) / 100;
  const investimentoLeads = investimentoTotal - formData.investimento_feed - formData.investimento_google - formData.investimento_tiktok;
  const totalMetaAds = formData.investimento_feed + investimentoLeads;
  const valorImpostos = (totalMetaAds * formData.percentual_impostos) / 100;
  
  const alertaInvestimento = (formData.investimento_feed + formData.investimento_google + formData.investimento_tiktok) > investimentoTotal;
  
  // Funil
  const projecaoLeads = formData.cpl_planejado > 0 ? investimentoLeads / formData.cpl_planejado : 0;
  const projecaoContatos = projecaoLeads * (formData.conversao_leads_contatos / 100);
  const projecaoAgendamentos = projecaoContatos * (formData.conversao_contatos_agendamento / 100);
  const projecaoComparecimentos = projecaoAgendamentos * (formData.conversao_agendamento_comparecimento / 100);
  const projecaoFechamentos = projecaoComparecimentos * (formData.conversao_comparecimento_fechamento / 100);
  
  const metaOnline = projecaoFechamentos * formData.ticket_medio;
  const participacaoDigital = formData.meta_faturamento > 0 ? (metaOnline / formData.meta_faturamento) * 100 : 0;

  const getParticipacaoColor = (perc) => {
    if (perc >= 60) return 'text-green-600 bg-green-50';
    if (perc >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (planejamentoAtual) {
        return base44.entities.PlanejamentoEstrategico.update(planejamentoAtual.id, data);
      } else {
        return base44.entities.PlanejamentoEstrategico.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['planejamentos']);
      queryClient.invalidateQueries(['todosOsPlanejamentos']);
    }
  });

  const handleSave = () => {
    const clienteAtual = todosOsClientes.find(c => c.id === viewingClienteId);
    const dataToSave = {
      cliente_id: viewingClienteId,
      cliente_nome: clienteAtual?.nome,
      mes_referencia: `${selectedMonth}-01`,
      ...formData
    };
    saveMutation.mutate(dataToSave);
  };

  const handleSelectCliente = (clienteId) => {
    setViewingClienteId(clienteId);
    window.history.pushState({}, '', `?cliente_id=${clienteId}`);
  };

  const handleBackToList = () => {
    setViewingClienteId(null);
    window.history.pushState({}, '', window.location.pathname);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  };

  // Gerar opções de mês (últimos 6 meses + próximos 6 meses)
  const generateMonthOptions = () => {
    const options = [];
    const today = new Date();
    for (let i = -6; i <= 6; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const value = format(date, 'yyyy-MM');
      const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return options;
  };

  // Se não estiver visualizando nenhum cliente específico, mostrar lista
  if (!viewingClienteId) {
    // Filtrar clientes
    const clientesFiltrados = todosOsClientes.filter((cliente) => {
      const matchesSearch = cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           cliente.cidade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           cliente.estado?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (filterMonth === 'todos') return matchesSearch;
      
      // Verificar se cliente tem planejamento no mês selecionado
      const hasPlanejamentoNoMes = todosOsPlanejamentosGeral.some(p => 
        p.cliente_id === cliente.id && 
        p.mes_referencia?.startsWith(filterMonth)
      );
      
      return matchesSearch && hasPlanejamentoNoMes;
    });

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Planejamento Estratégico</h1>
          <p className="text-slate-500 mt-1">Selecione uma unidade para gerenciar o planejamento</p>
        </div>

        {/* Filtros */}
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nome, cidade ou estado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as unidades</SelectItem>
              {generateMonthOptions().map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  Com planejamento em {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {clientesFiltrados.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Nenhuma unidade encontrada com os filtros aplicados.
              </div>
            ) : (
              <div className="divide-y">
                {clientesFiltrados.map((cliente) => {
                  const planejamentosCount = todosOsPlanejamentosGeral.filter(p => p.cliente_id === cliente.id).length;
                  
                  return (
                    <div
                      key={cliente.id}
                      className="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => handleSelectCliente(cliente.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Target className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{cliente.nome}</h3>
                          <p className="text-sm text-slate-500">
                            {cliente.cidade} - {cliente.estado}
                            {planejamentosCount > 0 && (
                              <span className="ml-2 text-violet-600">• {planejamentosCount} planejamento{planejamentosCount !== 1 ? 's' : ''}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        Ver Planejamentos →
                      </Button>
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

  const clienteAtual = todosOsClientes.find(c => c.id === viewingClienteId);

  if (!clienteAtual) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Cliente não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleBackToList}
              className="hover:bg-slate-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Planejamento Estratégico</h1>
              <p className="text-slate-500 mt-1">{clienteAtual.nome}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {generateMonthOptions().map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-violet-600 hover:bg-violet-700">
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Salvando...' : 'Salvar Planejamento'}
          </Button>
        </div>
      </div>

      {/* Toggle Tabela / Infográfico / Lista */}
      <Tabs defaultValue="lista" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="lista" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Todos os Planejamentos
          </TabsTrigger>
          <TabsTrigger value="tabela" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Tabela
          </TabsTrigger>
          <TabsTrigger value="infografico" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Infográfico
          </TabsTrigger>
        </TabsList>

        {/* View Lista */}
        <TabsContent value="lista" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Planejamentos Cadastrados</CardTitle>
            </CardHeader>
            <CardContent>
              {todosOsPlanejamentos.length === 0 ? (
                <p className="text-slate-500 text-center py-8">Nenhum planejamento cadastrado ainda.</p>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {todosOsPlanejamentos.map((plan) => {
                    const mesRef = new Date(plan.mes_referencia + 'T00:00:00');
                    const mesFormatado = format(mesRef, "MMMM 'de' yyyy", { locale: ptBR }).charAt(0).toUpperCase() + format(mesRef, "MMMM 'de' yyyy", { locale: ptBR }).slice(1);
                    
                    return (
                      <Card 
                        key={plan.id} 
                        className="hover:shadow-lg transition-shadow cursor-pointer border-violet-200" 
                        onClick={() => setSelectedMonth(format(mesRef, 'yyyy-MM'))}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Calendar className="w-5 h-5 text-violet-600" />
                            <h3 className="font-semibold text-slate-900">{mesFormatado}</h3>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600">Meta:</span>
                              <span className="font-semibold">{formatCurrency(plan.meta_faturamento)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Investimento:</span>
                              <span className="font-semibold">{formatCurrency((plan.meta_faturamento * plan.percentual_investimento_marketing) / 100)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">TKM:</span>
                              <span className="font-semibold">{formatCurrency(plan.ticket_medio)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* View Tabela */}
        <TabsContent value="tabela" className="space-y-6 mt-6">

      {/* BLOCO 1 - Identificação e Metas Financeiras */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-violet-600" />
            Metas Financeiras
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Meta de Faturamento (R$)</Label>
              <Input
                type="number"
                value={formData.meta_faturamento}
                onChange={(e) => handleInputChange('meta_faturamento', e.target.value)}
                placeholder="0.00"
                className="text-lg font-semibold"
              />
            </div>
            <div>
              <Label>Ticket Médio da Unidade - TKM (R$)</Label>
              <Input
                type="number"
                value={formData.ticket_medio}
                onChange={(e) => handleInputChange('ticket_medio', e.target.value)}
                placeholder="0.00"
                className="text-lg font-semibold"
              />
            </div>
            <div>
              <Label>% de Investimento em Marketing</Label>
              <Input
                type="number"
                value={formData.percentual_investimento_marketing}
                onChange={(e) => handleInputChange('percentual_investimento_marketing', e.target.value)}
                placeholder="0"
                min="0"
                max="100"
              />
            </div>
            <div>
              <Label>% Impostos Meta Ads</Label>
              <Input
                type="number"
                value={formData.percentual_impostos}
                onChange={(e) => handleInputChange('percentual_impostos', e.target.value)}
                placeholder="0"
                min="0"
                max="100"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
            <Card className="bg-violet-50 border-violet-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Investimento Total em Marketing</p>
                    <p className="text-2xl font-bold text-violet-700">{formatCurrency(investimentoTotal)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-violet-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Valor de Impostos sobre a Meta</p>
                    <p className="text-2xl font-bold text-slate-700">{formatCurrency(valorImpostos)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-slate-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* BLOCO 2 - Planejamento de Investimentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-violet-600" />
            Planejamento de Investimentos em Mídia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Investimento em Feed / Engajamento (R$)</Label>
              <Input
                type="number"
                value={formData.investimento_feed}
                onChange={(e) => handleInputChange('investimento_feed', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Investimento em Google Ads (R$)</Label>
              <Input
                type="number"
                value={formData.investimento_google}
                onChange={(e) => handleInputChange('investimento_google', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Investimento em TikTok Ads (R$)</Label>
              <Input
                type="number"
                value={formData.investimento_tiktok}
                onChange={(e) => handleInputChange('investimento_tiktok', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>CPL Planejado – Leads (R$)</Label>
              <Input
                type="number"
                value={formData.cpl_planejado}
                onChange={(e) => handleInputChange('cpl_planejado', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {alertaInvestimento && (
            <Alert className="bg-red-50 border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <AlertDescription className="text-red-700 font-medium">
                Os investimentos cadastrados ultrapassam o investimento total planejado.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Investimento em Leads (restante)</p>
                    <p className="text-2xl font-bold text-blue-700">{formatCurrency(investimentoLeads)}</p>
                  </div>
                  <Target className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-indigo-50 border-indigo-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Total Investimento Meta Ads</p>
                    <p className="text-2xl font-bold text-indigo-700">{formatCurrency(totalMetaAds)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-indigo-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* BLOCO 3 - Funil de Projeção */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-600" />
            Funil de Projeção de Entrega
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Leads */}
            <div className="p-4 bg-violet-50 rounded-lg border-2 border-violet-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-900">1. Aquisição – Leads</h3>
                <span className="text-3xl font-bold text-violet-600">{formatNumber(projecaoLeads)}</span>
              </div>
              <p className="text-sm text-slate-600">
                Investimento em Leads: {formatCurrency(investimentoLeads)} ÷ CPL: {formatCurrency(formData.cpl_planejado)}
              </p>
            </div>

            {/* Contatos */}
            <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-2">2. Contatos Únicos</h3>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Conversão Leads → Contatos (%)</Label>
                    <Input
                      type="number"
                      value={formData.conversao_leads_contatos}
                      onChange={(e) => handleInputChange('conversao_leads_contatos', e.target.value)}
                      className="w-24 h-8"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
                <span className="text-3xl font-bold text-blue-600">{formatNumber(projecaoContatos)}</span>
              </div>
            </div>

            {/* Agendamentos */}
            <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-2">3. Agendamentos</h3>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Conversão Contatos → Agendamento (%)</Label>
                    <Input
                      type="number"
                      value={formData.conversao_contatos_agendamento}
                      onChange={(e) => handleInputChange('conversao_contatos_agendamento', e.target.value)}
                      className="w-24 h-8"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
                <span className="text-3xl font-bold text-green-600">{formatNumber(projecaoAgendamentos)}</span>
              </div>
            </div>

            {/* Comparecimentos */}
            <div className="p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-2">4. Comparecimentos</h3>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Conversão Agendamento → Comparecimento (%)</Label>
                    <Input
                      type="number"
                      value={formData.conversao_agendamento_comparecimento}
                      onChange={(e) => handleInputChange('conversao_agendamento_comparecimento', e.target.value)}
                      className="w-24 h-8"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
                <span className="text-3xl font-bold text-amber-600">{formatNumber(projecaoComparecimentos)}</span>
              </div>
            </div>

            {/* Fechamentos */}
            <div className="p-4 bg-emerald-50 rounded-lg border-2 border-emerald-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-2">5. Fechamentos</h3>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Conversão Comparecimento → Fechamento (%)</Label>
                    <Input
                      type="number"
                      value={formData.conversao_comparecimento_fechamento}
                      onChange={(e) => handleInputChange('conversao_comparecimento_fechamento', e.target.value)}
                      className="w-24 h-8"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
                <span className="text-3xl font-bold text-emerald-600">{formatNumber(projecaoFechamentos)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BLOCO FINAL - Resultados e Indicadores */}
      <Card className="border-2 border-violet-200">
        <CardHeader className="bg-violet-50">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-violet-600" />
            Resultados e Indicadores Estratégicos
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-gradient-to-br from-violet-500 to-violet-600 text-white">
              <CardContent className="pt-6">
                <p className="text-sm opacity-90 mb-2">Meta Online de Faturamento</p>
                <p className="text-4xl font-bold">{formatCurrency(metaOnline)}</p>
                <p className="text-xs opacity-75 mt-2">
                  {formatNumber(projecaoFechamentos)} fechamentos × {formatCurrency(formData.ticket_medio)} TKM
                </p>
              </CardContent>
            </Card>

            <Card className={`${getParticipacaoColor(participacaoDigital)} border-2`}>
              <CardContent className="pt-6">
                <p className="text-sm mb-2 font-medium">% de Participação Digital no Faturamento</p>
                <p className="text-4xl font-bold">{participacaoDigital.toFixed(1)}%</p>
                <div className="mt-3 pt-3 border-t border-current/20">
                  <p className="text-xs">
                    Meta Online: {formatCurrency(metaOnline)}
                  </p>
                  <p className="text-xs">
                    Meta Total: {formatCurrency(formData.meta_faturamento)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Rodapé */}
      <Alert>
        <AlertDescription className="text-xs text-slate-600 text-center">
          Este planejamento é uma projeção estratégica. Os resultados reais podem variar conforme execução, mercado e engajamento operacional da unidade.
        </AlertDescription>
      </Alert>

        </TabsContent>

        {/* View Infográfico */}
        <TabsContent value="infografico" className="mt-6">
          {planejamentoAtual ? (
            <InfograficoExecutivo 
              planejamento={planejamentoAtual} 
              clienteNome={clienteAtual.nome}
            />
          ) : (
            <Card className="p-12 text-center">
              <p className="text-slate-500">Nenhum planejamento cadastrado para este mês.</p>
              <p className="text-sm text-slate-400 mt-2">Preencha os dados na aba "Tabela" e salve para visualizar o infográfico.</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}