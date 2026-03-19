import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, Search, Phone, Copy, ExternalLink, 
  Clock, AlertCircle, CheckCircle, Loader2, RefreshCw,
  MessageCircle, Edit2, Calendar, XCircle, UserCheck, Hourglass, LayoutGrid, List
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CadastroLeadModal from '@/components/crc/CadastroLeadModal';
import RegistrarTentativaModal from '@/components/crc/RegistrarTentativaModal';
import CrcKanbanBoard from '@/components/crc/CrcKanbanBoard';
import LeadDetailDrawer from '@/components/crc/LeadDetailDrawer';

const statusColors = {
  sem_contato: 'bg-gray-100 text-gray-700 border-gray-300',
  em_tratativa: 'bg-sky-100 text-sky-700 border-sky-300',
  agendou: 'bg-violet-100 text-violet-700 border-violet-300',
  compareceu: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  interesse_futuro: 'bg-orange-100 text-orange-700 border-orange-300',
  perda: 'bg-rose-100 text-rose-700 border-rose-300'
};

const statusLabels = {
  sem_contato: 'Sem Contato',
  em_tratativa: 'Em Tratativa',
  agendou: 'Agendou',
  compareceu: 'Compareceu',
  interesse_futuro: 'Interesse Futuro',
  perda: 'Perda'
};

const statusIcons = {
  sem_contato: Clock,
  em_tratativa: MessageCircle,
  agendou: Calendar,
  compareceu: UserCheck,
  interesse_futuro: Hourglass,
  perda: XCircle
};

export default function CrcCaixaLeads({ currentCliente, user }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCadastroModal, setShowCadastroModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  const [showTentativaModal, setShowTentativaModal] = useState(false);
  const [activeTab, setActiveTab] = useState('todos');
  const [editingCell, setEditingCell] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ['crcLeads', currentCliente?.id],
    queryFn: () => base44.entities.CrcLead.filter({ 
      unidade_id: currentCliente?.id 
    }),
    enabled: !!currentCliente?.id,
    staleTime: 5 * 1000,
    refetchOnWindowFocus: true
  });

  // Sync from Google Sheets on page load (once per client session)
  const syncedRef = useRef(null);
  useEffect(() => {
    if (!currentCliente?.id) return;
    if (syncedRef.current === currentCliente.id) return; // already synced for this client
    syncedRef.current = currentCliente.id;
    base44.functions.invoke('syncCrcLeadsFromGoogle', { clienteId: currentCliente.id })
      .then(() => refetch())
      .catch(() => {}); // silently fail if sync errors
  }, [currentCliente?.id]);

  const { data: config } = useQuery({
    queryKey: ['crcConfig', currentCliente?.id],
    queryFn: async () => {
      const configs = await base44.entities.CrcConfig.filter({ 
        unidade_id: currentCliente?.id 
      });
      return configs[0] || { sla_primeira_tentativa_min: 30 };
    },
    enabled: !!currentCliente?.id
  });

  const filteredLeads = leads
    .filter(lead => {
      const matchSearch = !searchTerm || 
        lead.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.telefone?.includes(searchTerm);
      
      const matchTab = {
        todos: true,
        novos: lead.status === 'sem_contato' && !lead.sla_atrasado,
        tratativa: lead.status === 'em_tratativa',
        agendados: lead.status === 'agendou',
        futuro: lead.status === 'interesse_futuro',
        perdas: lead.status === 'perda',
        atrasados: lead.status === 'sem_contato' && lead.sla_atrasado,
        google: lead.fonte_cadastro === 'google_sheet'
      }[activeTab];

      return matchSearch && matchTab;
    })
    .sort((a, b) => new Date(b.data_chegada) - new Date(a.data_chegada));

  const handleCopyPhone = (phone) => {
    navigator.clipboard.writeText(phone);
  };



  const handleRegistrarTentativa = (lead) => {
    setSelectedLead(lead);
    setShowTentativaModal(true);
  };

  const updateMutation = useMutation({
    mutationFn: ({ leadId, data }) => base44.entities.CrcLead.update(leadId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['crcLeads']);
      setEditingCell(null);
    }
  });

  const handleFieldUpdate = (leadId, field, value) => {
    updateMutation.mutate({ leadId, data: { [field]: value } });
  };

  const handleStatusChange = (leadId, newStatus) => {
    updateMutation.mutate({ 
      leadId, 
      data: { status: newStatus }
    });
  };

  const handleLeadClick = (lead) => {
    setSelectedLead(lead);
    setShowDetailDrawer(true);
  };

  const getProximaAcao = (lead) => {
    if (lead.status === 'sem_contato') return 'Tentar contato';
    if (lead.status === 'em_tratativa') return 'Nova tentativa';
    if (lead.status === 'agendou') return 'Confirmar agenda';
    if (lead.status === 'interesse_futuro') return `Retornar em ${format(new Date(lead.data_retorno), 'dd/MM')}`;
    return 'Encerrado';
  };

  const counts = {
    todos: leads.length,
    novos: leads.filter(l => l.status === 'sem_contato' && !l.sla_atrasado).length,
    tratativa: leads.filter(l => l.status === 'em_tratativa').length,
    agendados: leads.filter(l => l.status === 'agendou').length,
    futuro: leads.filter(l => l.status === 'interesse_futuro').length,
    perdas: leads.filter(l => l.status === 'perda').length,
    atrasados: leads.filter(l => l.status === 'sem_contato' && l.sla_atrasado).length,
    google: leads.filter(l => l.fonte_cadastro === 'google_sheet').length
  };

  if (!currentCliente) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Selecione uma unidade</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">CRC - Caixa de Leads</h2>
            <p className="text-sm text-slate-600 mt-1">
              Gestão de leads desde captação até agendamento
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex border rounded-lg overflow-hidden">
              <Button 
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                onClick={() => setViewMode('list')}
                className="rounded-none h-9"
              >
                <List className="w-4 h-4 mr-2" />
                Lista
              </Button>
              <Button 
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                onClick={() => setViewMode('kanban')}
                className="rounded-none h-9"
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                Kanban
              </Button>
            </div>
            <Button variant="outline" onClick={async () => {
              await base44.functions.invoke('syncCrcLeadsFromGoogle', { clienteId: currentCliente?.id });
              queryClient.invalidateQueries(['crcLeads']);
              refetch();
            }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button onClick={() => setShowCadastroModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Lead Manual
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 text-base border-slate-300 focus:border-violet-500 focus:ring-violet-500"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-8 w-full">
            <TabsTrigger value="todos">
              Todos {counts.todos > 0 && `(${counts.todos})`}
            </TabsTrigger>
            <TabsTrigger value="novos">
              Novos {counts.novos > 0 && `(${counts.novos})`}
            </TabsTrigger>
            <TabsTrigger value="tratativa">
              Tratativa {counts.tratativa > 0 && `(${counts.tratativa})`}
            </TabsTrigger>
            <TabsTrigger value="agendados">
              Agendados {counts.agendados > 0 && `(${counts.agendados})`}
            </TabsTrigger>
            <TabsTrigger value="futuro">
              Futuro {counts.futuro > 0 && `(${counts.futuro})`}
            </TabsTrigger>
            <TabsTrigger value="perdas">
              Perdas {counts.perdas > 0 && `(${counts.perdas})`}
            </TabsTrigger>
            <TabsTrigger value="atrasados" className="text-red-600">
              Atrasados {counts.atrasados > 0 && `(${counts.atrasados})`}
            </TabsTrigger>
            <TabsTrigger value="google">
              Google {counts.google > 0 && `(${counts.google})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-24 h-24 bg-gradient-to-br from-violet-50 to-purple-50 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-12 h-12 text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Nenhum lead encontrado</h3>
                <p className="text-sm text-slate-500 mb-6">Cadastre seu primeiro lead para começar</p>
                <Button onClick={() => setShowCadastroModal(true)} className="bg-violet-600 hover:bg-violet-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar Novo Lead
                </Button>
              </div>
            ) : viewMode === 'kanban' ? (
              <CrcKanbanBoard 
                leads={filteredLeads}
                onLeadClick={handleLeadClick}
                onStatusChange={handleStatusChange}
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Nome</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Telefone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Origem</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Tratamento</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Tentativas</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Próxima Ação</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wide">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredLeads.map((lead, idx) => (
                      <tr key={lead.id} className={`transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-violet-50/50`}>
                        <td className="px-4 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">{format(new Date(lead.data_chegada), 'dd/MM/yyyy')}</span>
                            <span className="text-slate-500 text-xs">{format(new Date(lead.data_chegada), 'HH:mm')}</span>
                            {lead.sla_atrasado && (
                              <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm" onClick={() => setEditingCell({ leadId: lead.id, field: 'nome' })}>
                          {editingCell?.leadId === lead.id && editingCell?.field === 'nome' ? (
                            <Input
                              value={lead.nome}
                              onChange={(e) => handleFieldUpdate(lead.id, 'nome', e.target.value)}
                              onBlur={() => setEditingCell(null)}
                              autoFocus
                              className="h-8 text-sm"
                            />
                          ) : (
                            <div className="flex items-center gap-2 group cursor-pointer">
                              <span className="font-semibold text-slate-900">{lead.nome || '-'}</span>
                              <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-slate-700">{lead.telefone}</span>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyPhone(lead.telefone)}
                                className="h-7 w-7 p-0 hover:bg-slate-200"
                                title="Copiar"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(`https://wa.me/55${lead.telefone.replace(/\D/g, '')}`, '_blank')}
                                className="h-7 w-7 p-0 hover:bg-green-100"
                                title="WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                              </Button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-700">{lead.origem?.replace(/_/g, ' ')}</span>
                            {lead.fonte_cadastro === 'google_sheet' && (
                              <Badge variant="outline" className="text-xs w-fit border-blue-300 text-blue-700 bg-blue-50">
                                Google Sheets
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm" onClick={() => setEditingCell({ leadId: lead.id, field: 'tratamento' })}>
                          {editingCell?.leadId === lead.id && editingCell?.field === 'tratamento' ? (
                            <Select 
                              value={lead.tratamento} 
                              onValueChange={(v) => handleFieldUpdate(lead.id, 'tratamento', v)}
                              open
                              onOpenChange={(open) => !open && setEditingCell(null)}
                            >
                              <SelectTrigger className="h-8 text-xs border-violet-300 focus:border-violet-500">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="nao_informado">Não informado</SelectItem>
                                <SelectItem value="implante">Implante</SelectItem>
                                <SelectItem value="protese">Prótese</SelectItem>
                                <SelectItem value="protese_protocolo">Prótese Protocolo</SelectItem>
                                <SelectItem value="zigomatico">Zigomático</SelectItem>
                                <SelectItem value="tratamento_clinico">Tratamento Clínico</SelectItem>
                                <SelectItem value="lentes_de_contato">Lentes de Contato</SelectItem>
                                <SelectItem value="ortodontia">Ortodontia</SelectItem>
                                <SelectItem value="rof">ROF</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="group cursor-pointer">
                              <span className="px-3 py-1.5 rounded-md bg-slate-100 group-hover:bg-violet-100 transition-colors text-slate-700 group-hover:text-violet-700 text-xs font-medium inline-flex items-center gap-1">
                                {lead.tratamento?.replace(/_/g, ' ')}
                                <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4" onClick={() => setEditingCell({ leadId: lead.id, field: 'status' })}>
                          {editingCell?.leadId === lead.id && editingCell?.field === 'status' ? (
                            <Select 
                              value={lead.status} 
                              onValueChange={(v) => handleFieldUpdate(lead.id, 'status', v)}
                              open
                              onOpenChange={(open) => !open && setEditingCell(null)}
                            >
                              <SelectTrigger className="h-8 text-xs border-violet-300 focus:border-violet-500">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sem_contato">Sem Contato</SelectItem>
                                <SelectItem value="em_tratativa">Em Tratativa</SelectItem>
                                <SelectItem value="agendou">Agendou</SelectItem>
                                <SelectItem value="compareceu">Compareceu</SelectItem>
                                <SelectItem value="interesse_futuro">Interesse Futuro</SelectItem>
                                <SelectItem value="perda">Perda</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={`${statusColors[lead.status]} cursor-pointer border hover:shadow-sm transition-all inline-flex items-center gap-1.5 px-3 py-1.5`}>
                              {React.createElement(statusIcons[lead.status], { className: "w-3.5 h-3.5" })}
                              {statusLabels[lead.status]}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${(lead.qtd_tentativas || 0) > 3 ? 'text-amber-600' : 'text-slate-700'}`}>
                              {lead.qtd_tentativas || 0}x
                            </span>
                            {lead.ultima_tentativa_em && (
                              <div className="text-xs text-slate-500">
                                {format(new Date(lead.ultima_tentativa_em), 'dd/MM HH:mm')}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span className="text-slate-600 font-medium">{getProximaAcao(lead)}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Button
                            size="sm"
                            onClick={() => handleRegistrarTentativa(lead)}
                            className="bg-violet-600 hover:bg-violet-700 shadow-sm"
                          >
                            <Phone className="w-3.5 h-3.5 mr-1.5" />
                            Registrar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {showCadastroModal && (
        <CadastroLeadModal
          unidadeId={currentCliente.id}
          onClose={() => setShowCadastroModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['crcLeads']);
            setShowCadastroModal(false);
          }}
        />
      )}



      {showTentativaModal && selectedLead && (
        <RegistrarTentativaModal
          lead={selectedLead}
          onClose={() => {
            setShowTentativaModal(false);
            setSelectedLead(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries(['crcLeads']);
            setShowTentativaModal(false);
            setSelectedLead(null);
          }}
        />
      )}

      {showDetailDrawer && selectedLead && (
        <LeadDetailDrawer
          lead={selectedLead}
          onClose={() => {
            setShowDetailDrawer(false);
            setSelectedLead(null);
          }}
          onUpdate={() => {
            queryClient.invalidateQueries(['crcLeads']);
          }}
        />
      )}
    </div>
  );
}