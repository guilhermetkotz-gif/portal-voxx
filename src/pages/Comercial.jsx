import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import LeadCard from '@/components/comercial/LeadCard';
import NovoLeadModal from '@/components/comercial/NovoLeadModal';
import AgendaComercial from '@/components/comercial/AgendaComercial';
import DashboardComercial from '@/components/comercial/DashboardComercial';
import { isVoxxAdmin, isVoxxOperacao, isVoxxManager } from '@/components/utils/auth';
import { Plus, Search, LayoutDashboard, KanbanSquare, Calendar, AlertTriangle, Loader2, Users, DollarSign, TrendingUp, Filter, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { isSameDay, parseISO } from 'date-fns';

const ETAPAS = [
  { key: 'novo_lead', label: 'Novo Lead', color: 'border-t-slate-400' },
  { key: 'contato_iniciado', label: 'Contato Iniciado', color: 'border-t-blue-400' },
  { key: 'diagnostico_reuniao', label: 'Diagnóstico / Reunião', color: 'border-t-indigo-400' },
  { key: 'qualificado', label: 'Qualificado', color: 'border-t-violet-400' },
  { key: 'proposta_enviada', label: 'Proposta Enviada', color: 'border-t-amber-400' },
  { key: 'negociacao', label: 'Negociação', color: 'border-t-orange-400' },
  { key: 'fechado_ganho', label: 'Fechado (Ganho)', color: 'border-t-emerald-500' },
  { key: 'fechado_perdido', label: 'Fechado (Perdido)', color: 'border-t-red-400' },
];

export default function Comercial({ user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pipeline');
  const [showNovoLead, setShowNovoLead] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('all');
  const [filtroOrigem, setFiltroOrigem] = useState('all');
  const [filtroFit, setFiltroFit] = useState('all');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [showFiltros, setShowFiltros] = useState(false);
  const [draggingLeadId, setDraggingLeadId] = useState(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leadsComercial'],
    queryFn: () => base44.entities.LeadComercial.list('-created_date', 500),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: reunioes = [] } = useQuery({
    queryKey: ['reunioesComercialHoje'],
    queryFn: () => base44.entities.ReuniaoComercial.filter({ status: 'agendada' }, 'data_hora', 50),
    staleTime: 60 * 1000,
  });

  const updateEtapaMutation = useMutation({
    mutationFn: ({ id, etapa }) => base44.entities.LeadComercial.update(id, { etapa }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leadsComercial'] });
      toast.success('Etapa atualizada!');
    }
  });

  if (!user) return <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></div>;
  if (!isVoxxAdmin(user) && !isVoxxOperacao(user) && !isVoxxManager(user) && user?.role !== 'admin') {
    return <div className="flex items-center justify-center h-96"><p className="text-lg text-red-500">Acesso negado. Esta página é apenas para usuários Voxx.</p></div>;
  }

  // KPIs
  const ativos = leads.filter(l => !['fechado_ganho','fechado_perdido'].includes(l.etapa));
  const valorPotencial = ativos.reduce((s, l) => s + (l.valor_estimado || 0), 0);
  const ganhos = leads.filter(l => l.etapa === 'fechado_ganho');
  const taxaConversao = leads.length > 0 ? ((ganhos.length / leads.length) * 100).toFixed(0) : 0;
  const reunioesHoje = reunioes.filter(r => r.data_hora && isSameDay(parseISO(r.data_hora), new Date()));
  const alertas = leads.filter(l => l.alerta_inatividade).length;

  // Filtros
  const responsaveis = [...new Set(leads.map(l => l.responsavel_voxx).filter(Boolean))];
  const origens = [...new Set(leads.map(l => l.origem).filter(Boolean))];

  const getStatusLead = (l) => {
    if (!l.ultima_interacao) return 'parado';
    const dias = Math.floor((Date.now() - new Date(l.ultima_interacao)) / (1000 * 60 * 60 * 24));
    if (dias <= 3) return 'ativo';
    if (dias <= 7) return 'aguardando';
    return 'parado';
  };

  const leadsFiltrados = leads.filter(l => {
    const matchSearch = !search || l.nome_empresa?.toLowerCase().includes(search.toLowerCase()) || l.nome_contato?.toLowerCase().includes(search.toLowerCase());
    const matchResp = filtroResponsavel === 'all' || l.responsavel_voxx === filtroResponsavel;
    const matchOrigem = filtroOrigem === 'all' || l.origem === filtroOrigem;
    const matchFit = filtroFit === 'all' || l.fit_classificacao === filtroFit;
    const matchStatus = filtroStatus === 'all' || getStatusLead(l) === filtroStatus;
    return matchSearch && matchResp && matchOrigem && matchFit && matchStatus;
  });

  const leadsPorEtapa = (etapa) => leadsFiltrados.filter(l => l.etapa === etapa);

  const handleDropEtapa = (e, etapa) => {
    e.preventDefault();
    if (draggingLeadId) {
      updateEtapaMutation.mutate({ id: draggingLeadId, etapa });
      setDraggingLeadId(null);
    }
  };

  const handleLeadClick = (lead) => {
    navigate(`/LeadDetalhe?id=${lead.id}`);
  };

  return (
    <div className="space-y-5">
      {/* HEADER KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg"><Users className="w-5 h-5 text-violet-600" /></div>
          <div>
            <p className="text-xs text-slate-500">Leads Ativos</p>
            <p className="text-2xl font-bold text-slate-900">{ativos.length}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
          <div>
            <p className="text-xs text-slate-500">Valor Potencial</p>
            <p className="text-xl font-bold text-slate-900">R$ {Math.round(valorPotencial / 1000)}k</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
          <div>
            <p className="text-xs text-slate-500">Taxa de Conversão</p>
            <p className="text-2xl font-bold text-slate-900">{taxaConversao}%</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg"><Calendar className="w-5 h-5 text-indigo-600" /></div>
          <div>
            <p className="text-xs text-slate-500">Reuniões Hoje</p>
            <p className="text-2xl font-bold text-slate-900">{reunioesHoje.length}</p>
          </div>
        </Card>
      </div>

      {/* Alerta global */}
      {alertas > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span><strong>{alertas} lead{alertas !== 1 ? 's' : ''}</strong> com alerta de inatividade.</span>
        </div>
      )}

      {/* TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="pipeline" className="gap-1.5"><KanbanSquare className="w-4 h-4" /> Pipeline</TabsTrigger>
            <TabsTrigger value="agenda" className="gap-1.5"><Calendar className="w-4 h-4" /> Agenda</TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-1.5"><LayoutDashboard className="w-4 h-4" /> Dashboard</TabsTrigger>
          </TabsList>
          {activeTab === 'pipeline' && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowNovoLead(true)} className="gap-1.5">
                <Plus className="w-4 h-4" /> Novo Lead
              </Button>
            </div>
          )}
        </div>

        {/* PIPELINE */}
        <TabsContent value="pipeline" className="mt-4 space-y-3">
          {/* Filtros */}
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Buscar empresa ou contato..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFiltros(!showFiltros)}
              className={`gap-1.5 h-9 ${showFiltros ? 'bg-violet-50 border-violet-300 text-violet-700' : ''}`}
            >
              <Filter className="w-3.5 h-3.5" /> Filtros
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFiltros ? 'rotate-180' : ''}`} />
            </Button>
          </div>

          {showFiltros && (
            <div className="flex gap-2 flex-wrap p-3 bg-slate-50 rounded-xl border">
              <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
                <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos responsáveis</SelectItem>
                  {responsaveis.map(r => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Origem" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas origens</SelectItem>
                  {origens.map(o => <SelectItem key={o} value={o} className="text-xs capitalize">{o}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtroFit} onValueChange={setFiltroFit}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Fit Score" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos fit scores</SelectItem>
                  <SelectItem value="alto_fit">Alto Fit</SelectItem>
                  <SelectItem value="medio_fit">Médio Fit</SelectItem>
                  <SelectItem value="baixo_fit">Baixo Fit</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="ativo">🟢 Ativo</SelectItem>
                  <SelectItem value="aguardando">🟡 Aguardando</SelectItem>
                  <SelectItem value="parado">🔴 Parado</SelectItem>
                </SelectContent>
              </Select>
              {(filtroResponsavel !== 'all' || filtroOrigem !== 'all' || filtroFit !== 'all' || filtroStatus !== 'all') && (
                <Button size="sm" variant="ghost" className="h-8 text-xs text-slate-500"
                  onClick={() => { setFiltroResponsavel('all'); setFiltroOrigem('all'); setFiltroFit('all'); setFiltroStatus('all'); }}>
                  Limpar
                </Button>
              )}
            </div>
          )}

          {/* Kanban */}
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {ETAPAS.map(etapa => {
                const items = leadsPorEtapa(etapa.key);
                return (
                  <div
                    key={etapa.key}
                    className={`flex-shrink-0 w-60 bg-slate-50 rounded-xl border-t-4 ${etapa.color} flex flex-col`}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleDropEtapa(e, etapa.key)}
                  >
                    <div className="p-3 border-b border-slate-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{etapa.label}</h3>
                        <Badge variant="outline" className="text-xs">{items.length}</Badge>
                      </div>
                    </div>
                    <div className="p-2 flex-1 space-y-2 min-h-[80px] max-h-[calc(100vh-320px)] overflow-y-auto">
                      {items.map(lead => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={() => setDraggingLeadId(lead.id)}
                          onDragEnd={() => setDraggingLeadId(null)}
                          onClick={() => handleLeadClick(lead)}
                          className="cursor-pointer"
                        >
                          <LeadCard lead={lead} onClick={() => {}} />
                        </div>
                      ))}
                      {items.length === 0 && (
                        <div className="flex items-center justify-center h-14 text-xs text-slate-300">
                          Sem leads
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="agenda" className="mt-4">
          <AgendaComercial user={user} />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4">
          <DashboardComercial />
        </TabsContent>
      </Tabs>

      <NovoLeadModal open={showNovoLead} onClose={() => setShowNovoLead(false)} user={user} />
    </div>
  );
}