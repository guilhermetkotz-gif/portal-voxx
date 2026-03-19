import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import LeadCard from '@/components/comercial/LeadCard';
import LeadFichaModal from '@/components/comercial/LeadFichaModal';
import NovoLeadModal from '@/components/comercial/NovoLeadModal';
import AgendaComercial from '@/components/comercial/AgendaComercial';
import DashboardComercial from '@/components/comercial/DashboardComercial';
import { isVoxxAdmin, isVoxxOperacao } from '@/components/utils/auth';
import { Plus, Search, LayoutDashboard, KanbanSquare, Calendar, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pipeline');
  const [selectedLead, setSelectedLead] = useState(null);
  const [showNovoLead, setShowNovoLead] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('all');
  const [draggingLeadId, setDraggingLeadId] = useState(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leadsComercial'],
    queryFn: () => base44.entities.LeadComercial.list('-created_date', 500),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const updateEtapaMutation = useMutation({
    mutationFn: ({ id, etapa }) => base44.entities.LeadComercial.update(id, { etapa }),
    onSuccess: () => {
      queryClient.invalidateQueries(['leadsComercial']);
      toast.success('Etapa atualizada!');
    }
  });

  if (!user) return <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></div>;
  if (!isVoxxAdmin(user) && !isVoxxOperacao(user)) {
    return <div className="flex items-center justify-center h-96"><p className="text-lg text-red-500">Acesso negado. Esta página é apenas para usuários Voxx.</p></div>;
  }

  // Filtrar leads
  const responsaveis = [...new Set(leads.map(l => l.responsavel_voxx).filter(Boolean))];
  const leadsFiltrados = leads.filter(l => {
    const matchSearch = !search || l.nome_empresa?.toLowerCase().includes(search.toLowerCase()) || l.nome_contato?.toLowerCase().includes(search.toLowerCase());
    const matchResp = filtroResponsavel === 'all' || l.responsavel_voxx === filtroResponsavel;
    return matchSearch && matchResp;
  });

  const leadsPorEtapa = (etapa) => leadsFiltrados.filter(l => l.etapa === etapa);

  const totalAtivos = leads.filter(l => !['fechado_ganho', 'fechado_perdido'].includes(l.etapa)).length;
  const alertas = leads.filter(l => l.alerta_inatividade).length;

  const handleDrop = (e, etapa) => {
    e.preventDefault();
    if (draggingLeadId) {
      updateEtapaMutation.mutate({ id: draggingLeadId, etapa });
      setDraggingLeadId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Comercial</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Pipeline de vendas · {totalAtivos} leads ativos
            {alertas > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                {alertas} alerta{alertas !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowNovoLead(true)} className="bg-violet-600 hover:bg-violet-700">
          <Plus className="w-4 h-4 mr-2" /> Novo Lead
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="pipeline" className="gap-1.5">
            <KanbanSquare className="w-4 h-4" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-1.5">
            <Calendar className="w-4 h-4" /> Agenda
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5">
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </TabsTrigger>
        </TabsList>

        {/* PIPELINE KANBAN */}
        <TabsContent value="pipeline" className="mt-4">
          {/* Filtros */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar empresa ou contato..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos responsáveis</SelectItem>
                {responsaveis.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {ETAPAS.map(etapa => {
                const items = leadsPorEtapa(etapa.key);
                return (
                  <div
                    key={etapa.key}
                    className={`flex-shrink-0 w-64 bg-slate-50 rounded-xl border-t-4 ${etapa.color} flex flex-col`}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleDrop(e, etapa.key)}
                  >
                    <div className="p-3 border-b border-slate-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{etapa.label}</h3>
                        <Badge variant="outline" className="text-xs">{items.length}</Badge>
                      </div>
                    </div>
                    <div className="p-2 flex-1 space-y-2 min-h-[100px] max-h-[calc(100vh-280px)] overflow-y-auto">
                      {items.map(lead => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={() => setDraggingLeadId(lead.id)}
                          onDragEnd={() => setDraggingLeadId(null)}
                        >
                          <LeadCard lead={lead} onClick={setSelectedLead} />
                        </div>
                      ))}
                      {items.length === 0 && (
                        <div className="flex items-center justify-center h-16 text-xs text-slate-300">
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

        {/* AGENDA */}
        <TabsContent value="agenda" className="mt-4">
          <AgendaComercial user={user} />
        </TabsContent>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="mt-4">
          <DashboardComercial />
        </TabsContent>
      </Tabs>

      {/* Modais */}
      <LeadFichaModal
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        user={user}
      />
      <NovoLeadModal
        open={showNovoLead}
        onClose={() => setShowNovoLead(false)}
        user={user}
      />
    </div>
  );
}