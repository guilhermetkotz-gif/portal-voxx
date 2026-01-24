import React, { useState } from 'react';
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
  Clock, AlertCircle, CheckCircle, Loader2, RefreshCw 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CadastroLeadModal from '@/components/crc/CadastroLeadModal';
import LeadDetailDrawer from '@/components/crc/LeadDetailDrawer';
import RegistrarTentativaModal from '@/components/crc/RegistrarTentativaModal';

const statusColors = {
  sem_contato: 'bg-slate-100 text-slate-700',
  em_tratativa: 'bg-blue-100 text-blue-700',
  agendou: 'bg-purple-100 text-purple-700',
  compareceu: 'bg-green-100 text-green-700',
  interesse_futuro: 'bg-amber-100 text-amber-700',
  perda: 'bg-red-100 text-red-700'
};

const statusLabels = {
  sem_contato: 'Sem Contato',
  em_tratativa: 'Em Tratativa',
  agendou: 'Agendou',
  compareceu: 'Compareceu',
  interesse_futuro: 'Interesse Futuro',
  perda: 'Perda'
};

export default function CrcCaixaLeads({ currentCliente, user }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCadastroModal, setShowCadastroModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [showTentativaModal, setShowTentativaModal] = useState(false);
  const [activeTab, setActiveTab] = useState('novos');
  const [editingCell, setEditingCell] = useState(null);

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ['crcLeads', currentCliente?.id],
    queryFn: () => base44.entities.CrcLead.filter({ 
      unidade_id: currentCliente?.id 
    }, '-data_chegada', 500),
    enabled: !!currentCliente?.id,
    staleTime: 30 * 1000
  });

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

  const filteredLeads = leads.filter(lead => {
    const matchSearch = !searchTerm || 
      lead.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.telefone?.includes(searchTerm);
    
    const matchTab = {
      novos: lead.status === 'sem_contato' && !lead.sla_atrasado,
      tratativa: lead.status === 'em_tratativa',
      agendados: lead.status === 'agendou',
      futuro: lead.status === 'interesse_futuro',
      perdas: lead.status === 'perda',
      atrasados: lead.status === 'sem_contato' && lead.sla_atrasado,
      google: lead.fonte_cadastro === 'google_sheet'
    }[activeTab];

    return matchSearch && matchTab;
  });

  const handleCopyPhone = (phone) => {
    navigator.clipboard.writeText(phone);
  };

  const handleOpenDetail = (lead) => {
    setSelectedLead(lead);
    setShowDetailDrawer(true);
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

  const getProximaAcao = (lead) => {
    if (lead.status === 'sem_contato') return 'Tentar contato';
    if (lead.status === 'em_tratativa') return 'Nova tentativa';
    if (lead.status === 'agendou') return 'Confirmar agenda';
    if (lead.status === 'interesse_futuro') return `Retornar em ${format(new Date(lead.data_retorno), 'dd/MM')}`;
    return 'Encerrado';
  };

  const counts = {
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
            <Button variant="outline" onClick={refetch}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button onClick={() => setShowCadastroModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Lead Manual
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-7 w-full">
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
              <div className="text-center py-12 text-slate-500">
                Nenhum lead encontrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Nome</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Telefone</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Origem</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Tratamento</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Tentativas</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Próxima Ação</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm" onClick={() => handleOpenDetail(lead)}>
                          <div className="flex items-center gap-2">
                            {format(new Date(lead.data_chegada), 'dd/MM HH:mm')}
                            {lead.sla_atrasado && (
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium" onClick={() => handleOpenDetail(lead)}>
                          {lead.nome || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            {lead.telefone}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyPhone(lead.telefone);
                              }}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm" onClick={() => handleOpenDetail(lead)}>
                          <div className="flex items-center gap-1">
                            {lead.origem?.replace(/_/g, ' ')}
                            {lead.fonte_cadastro === 'google_sheet' && (
                              <Badge variant="outline" className="text-xs">Google</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm" onClick={(e) => {
                          e.stopPropagation();
                          setEditingCell({ leadId: lead.id, field: 'tratamento' });
                        }}>
                          {editingCell?.leadId === lead.id && editingCell?.field === 'tratamento' ? (
                            <Select 
                              value={lead.tratamento} 
                              onValueChange={(v) => handleFieldUpdate(lead.id, 'tratamento', v)}
                              open
                              onOpenChange={(open) => !open && setEditingCell(null)}
                            >
                              <SelectTrigger className="h-7 text-xs">
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
                            <span className="cursor-pointer hover:bg-slate-100 px-2 py-1 rounded">
                              {lead.tratamento?.replace(/_/g, ' ')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => {
                          e.stopPropagation();
                          setEditingCell({ leadId: lead.id, field: 'status' });
                        }}>
                          {editingCell?.leadId === lead.id && editingCell?.field === 'status' ? (
                            <Select 
                              value={lead.status} 
                              onValueChange={(v) => handleFieldUpdate(lead.id, 'status', v)}
                              open
                              onOpenChange={(open) => !open && setEditingCell(null)}
                            >
                              <SelectTrigger className="h-7 text-xs">
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
                            <Badge className={`${statusColors[lead.status]} cursor-pointer`}>
                              {statusLabels[lead.status]}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm" onClick={() => handleOpenDetail(lead)}>
                          {lead.qtd_tentativas || 0}x
                          {lead.ultima_tentativa_em && (
                            <div className="text-xs text-slate-500">
                              {format(new Date(lead.ultima_tentativa_em), 'dd/MM HH:mm')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600" onClick={() => handleOpenDetail(lead)}>
                          {getProximaAcao(lead)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRegistrarTentativa(lead);
                            }}
                          >
                            <Phone className="w-3 h-3 mr-1" />
                            Tentativa
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
    </div>
  );
}