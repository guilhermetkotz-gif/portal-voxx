import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Phone, ExternalLink, Clock, Edit2, Save, X, CalendarCheck, CalendarX, CalendarClock } from 'lucide-react';
import RegistrarTentativaModal from './RegistrarTentativaModal';
import LeadHistoryTimeline from './LeadHistoryTimeline';
import LeadDataCard from './LeadDataCard';
import { format } from 'date-fns';

const statusAgendamentoConfig = {
  pendente: { label: 'Pendente', color: 'bg-slate-100 text-slate-700 border-slate-300', icon: Clock },
  compareceu: { label: 'Compareceu', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: CalendarCheck },
  faltou: { label: 'Faltou', color: 'bg-red-100 text-red-700 border-red-300', icon: CalendarX },
  desmarcou: { label: 'Desmarcou', color: 'bg-amber-100 text-amber-700 border-amber-300', icon: CalendarX },
  reagendou: { label: 'Reagendou', color: 'bg-violet-100 text-violet-700 border-violet-300', icon: CalendarClock }
};

const statusColors = {
  sem_contato: 'bg-slate-100 text-slate-700',
  em_tratativa: 'bg-blue-100 text-blue-700',
  agendou: 'bg-purple-100 text-purple-700',
  compareceu: 'bg-green-100 text-green-700',
  interesse_futuro: 'bg-amber-100 text-amber-700',
  perda: 'bg-red-100 text-red-700'
};

export default function LeadDetailDrawer({ lead, onClose, onUpdate }) {
  const queryClient = useQueryClient();
  const [editField, setEditField] = useState(null);
  const [showTentativaModal, setShowTentativaModal] = useState(false);

  // Busca sempre os dados mais recentes do lead — evita exibir dados desatualizados após salvar
  const { data: freshLead } = useQuery({
    queryKey: ['crcLead', lead.id],
    queryFn: () => base44.entities.CrcLead.get(lead.id),
    enabled: !!lead.id,
    initialData: lead,
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  const currentLead = freshLead || lead;
  const [editData, setEditData] = useState(currentLead);

  // Sincroniza editData quando o lead é atualizado no servidor
  useEffect(() => {
    setEditData(currentLead);
  }, [currentLead.updated_date]);

  const { data: tentativas = [] } = useQuery({
    queryKey: ['crcTentativas', lead.id],
    queryFn: () => base44.entities.CrcTentativa.filter({ lead_id: lead.id }, '-data_hora', 50),
    enabled: !!lead.id
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.CrcLead.update(lead.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['crcLeads']);
      queryClient.invalidateQueries(['crcTentativas']);
      queryClient.invalidateQueries(['crcLead', lead.id]);
      setEditField(null);
      onUpdate();
    }
  });

  const handleFieldSave = (field, value) => {
    const updates = { [field]: value };
    
    // Validations
    if (field === 'status' && value === 'perda' && !editData.motivo_perda) {
      return; // Will prompt for motivo_perda
    }
    if (field === 'status' && value === 'agendou' && !editData.data_agendamento) {
      return; // Will prompt for data_agendamento
    }
    if (field === 'status' && value === 'interesse_futuro' && !editData.data_retorno) {
      return; // Will prompt for data_retorno
    }

    updateMutation.mutate(updates);
  };

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Detalhes do Lead</SheetTitle>
            <Button
              onClick={() => setShowTentativaModal(true)}
              className="bg-violet-600 hover:bg-violet-700"
              size="sm"
            >
              <Phone className="w-4 h-4 mr-2" />
              Registrar Tentativa
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Identificação */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Identificação</h3>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                {editField === 'nome' ? (
                  <div className="flex gap-2">
                    <Input 
                      value={editData.nome || ''} 
                      onChange={(e) => setEditData({ ...editData, nome: e.target.value })}
                      autoFocus
                    />
                    <Button size="sm" onClick={() => { handleFieldSave('nome', editData.nome); }}>
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditData(currentLead); setEditField(null); }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <p 
                    className="text-sm font-medium cursor-pointer hover:bg-slate-50 p-2 rounded" 
                    onClick={() => setEditField('nome')}
                  >
                    {currentLead.nome || '-'}
                  </p>
                )}
              </div>
              <div>
                <Label>Telefone</Label>
                <p className="text-sm font-medium">{currentLead.telefone}</p>
              </div>
              <div>
                <Label>Data de Chegada</Label>
                <p className="text-sm">{currentLead.data_chegada ? format(new Date(currentLead.data_chegada), "dd/MM/yyyy 'às' HH:mm") : '-'}</p>
              </div>
              <div>
                <Label>Link da Origem (WhatsApp/Meta)</Label>
                {editField === 'link_anuncio' ? (
                  <div className="space-y-2">
                    <Input 
                      value={editData.link_anuncio || ''} 
                      onChange={(e) => setEditData({ ...editData, link_anuncio: e.target.value })}
                      placeholder="Cole aqui o link do anúncio ou conversa..."
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { handleFieldSave('link_anuncio', editData.link_anuncio); }}>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditData(currentLead); setEditField(null); }}>
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  currentLead.link_anuncio ? (
                    <div className="flex items-center gap-2 group">
                      <a href={currentLead.link_anuncio} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 flex items-center gap-1 hover:underline">
                        Ver anúncio <ExternalLink className="w-3 h-3" />
                      </a>
                      <Button size="sm" variant="ghost" className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setEditField('link_anuncio')}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <p 
                      className="text-sm text-slate-400 cursor-pointer hover:bg-slate-50 p-2 rounded"
                      onClick={() => setEditField('link_anuncio')}
                    >
                      Clique para adicionar o link da origem
                    </p>
                  )
                )}
              </div>
            </div>
          </Card>

          {/* Status e Tratamento */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Status e Tratamento</h3>
            <div className="space-y-3">
              <div>
                <Label>Status</Label>
                {editField === 'status' ? (
                  <Select 
                    value={editData.status || 'sem_contato'} 
                    onValueChange={(v) => { 
                      setEditData({ ...editData, status: v }); 
                      handleFieldSave('status', v);
                    }}
                    open={editField === 'status'}
                    onOpenChange={(open) => !open && setEditField(null)}
                  >
                    <SelectTrigger autoFocus>
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
                  <div onClick={() => setEditField('status')} className="cursor-pointer">
                    <Badge className={statusColors[currentLead.status] || 'bg-slate-100 text-slate-700'}>{(currentLead.status || 'sem_contato').replace(/_/g, ' ')}</Badge>
                  </div>
                )}
              </div>

              {currentLead.status === 'perda' && (
                <div>
                  <Label>Motivo da Perda</Label>
                  {editField === 'motivo_perda' ? (
                    <Select 
                      value={editData.motivo_perda || ''} 
                      onValueChange={(v) => { 
                        setEditData({ ...editData, motivo_perda: v }); 
                        handleFieldSave('motivo_perda', v);
                      }}
                      open={editField === 'motivo_perda'}
                      onOpenChange={(open) => !open && setEditField(null)}
                    >
                      <SelectTrigger autoFocus>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sem_interesse">Sem Interesse</SelectItem>
                        <SelectItem value="distancia">Distância</SelectItem>
                        <SelectItem value="sem_poder_aquisitivo">Sem Poder Aquisitivo</SelectItem>
                        <SelectItem value="fechou_em_outro_lugar">Fechou em Outro Lugar</SelectItem>
                        <SelectItem value="clicou_sem_querer">Clicou sem Querer</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p 
                      className="text-sm cursor-pointer hover:bg-slate-50 p-2 rounded"
                      onClick={() => setEditField('motivo_perda')}
                    >
                      {currentLead.motivo_perda?.replace(/_/g, ' ') || 'Clique para definir'}
                    </p>
                  )}
                </div>
              )}

              {(currentLead.status === 'agendou' || currentLead.data_agendamento) && (
                <>
                  <div>
                    <Label>Data de Agendamento</Label>
                    {editField === 'data_agendamento' ? (
                      <div className="flex gap-2">
                        <Input 
                          type="datetime-local" 
                          value={editData.data_agendamento || ''} 
                          onChange={(e) => setEditData({ ...editData, data_agendamento: e.target.value })}
                          autoFocus
                        />
                        <Button size="sm" onClick={() => { handleFieldSave('data_agendamento', editData.data_agendamento); }}>
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditData(currentLead); setEditField(null); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <p 
                        className="text-sm cursor-pointer hover:bg-slate-50 p-2 rounded"
                        onClick={() => setEditField('data_agendamento')}
                      >
                        {currentLead.data_agendamento ? format(new Date(currentLead.data_agendamento), "dd/MM/yyyy 'às' HH:mm") : 'Clique para definir'}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Status do Agendamento</Label>
                    {editField === 'status_agendamento' ? (
                      <Select 
                        value={editData.status_agendamento || 'pendente'} 
                        onValueChange={(v) => { 
                          setEditData({ ...editData, status_agendamento: v }); 
                          handleFieldSave('status_agendamento', v);
                        }}
                        open={editField === 'status_agendamento'}
                        onOpenChange={(open) => !open && setEditField(null)}
                      >
                        <SelectTrigger autoFocus>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="compareceu">Compareceu</SelectItem>
                          <SelectItem value="faltou">Faltou</SelectItem>
                          <SelectItem value="desmarcou">Desmarcou</SelectItem>
                          <SelectItem value="reagendou">Reagendou</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div onClick={() => setEditField('status_agendamento')} className="cursor-pointer">
                        {(() => {
                          const cfg = statusAgendamentoConfig[currentLead.status_agendamento || 'pendente'] || statusAgendamentoConfig.pendente;
                          const Icon = cfg.icon;
                          return (
                            <Badge className={`${cfg.color} border inline-flex items-center gap-1.5 px-3 py-1.5`}>
                              <Icon className="w-3.5 h-3.5" />
                              {cfg.label}
                            </Badge>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </>
              )}

              {currentLead.status === 'interesse_futuro' && (
                <div>
                  <Label>Data de Retorno</Label>
                  {editField === 'data_retorno' ? (
                    <div className="flex gap-2">
                      <Input 
                        type="date" 
                        value={editData.data_retorno || ''} 
                        onChange={(e) => setEditData({ ...editData, data_retorno: e.target.value })}
                        autoFocus
                      />
                      <Button size="sm" onClick={() => { handleFieldSave('data_retorno', editData.data_retorno); }}>
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditData(currentLead); setEditField(null); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <p 
                      className="text-sm cursor-pointer hover:bg-slate-50 p-2 rounded"
                      onClick={() => setEditField('data_retorno')}
                    >
                      {currentLead.data_retorno ? format(new Date(currentLead.data_retorno), 'dd/MM/yyyy') : 'Clique para definir'}
                    </p>
                  )}
                </div>
              )}

              <div>
                <Label>Tratamento</Label>
                {editField === 'tratamento' ? (
                  <Select 
                    value={editData.tratamento || 'nao_informado'} 
                    onValueChange={(v) => { 
                      setEditData({ ...editData, tratamento: v }); 
                      handleFieldSave('tratamento', v);
                    }}
                    open={editField === 'tratamento'}
                    onOpenChange={(open) => !open && setEditField(null)}
                  >
                    <SelectTrigger autoFocus>
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
                  <p 
                    className="text-sm cursor-pointer hover:bg-slate-50 p-2 rounded"
                    onClick={() => setEditField('tratamento')}
                  >
                    {currentLead.tratamento?.replace(/_/g, ' ') || '-'}
                  </p>
                )}
              </div>

              <div>
                <Label>Observações</Label>
                {editField === 'observacoes' ? (
                  <div className="space-y-2">
                    <Textarea 
                      value={editData.observacoes || ''} 
                      onChange={(e) => setEditData({ ...editData, observacoes: e.target.value })}
                      placeholder="Digite observações sobre o paciente..."
                      className="min-h-[100px]"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { handleFieldSave('observacoes', editData.observacoes); }}>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditData(currentLead); setEditField(null); }}>
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="text-sm cursor-pointer hover:bg-slate-50 p-2 rounded min-h-[40px] whitespace-pre-wrap"
                    onClick={() => setEditField('observacoes')}
                  >
                    {currentLead.observacoes || <span className="text-slate-400">Clique para adicionar observações</span>}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Dados do Lead */}
          <LeadDataCard lead={currentLead} />

          {/* Histórico Completo (linha do tempo unificada) */}
          <LeadHistoryTimeline lead={currentLead} tentativas={tentativas} />
        </div>
      </SheetContent>
      {showTentativaModal && (
        <RegistrarTentativaModal
          lead={currentLead}
          onClose={() => setShowTentativaModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['crcLeads']);
            queryClient.invalidateQueries(['crcTentativas', lead.id]);
            setShowTentativaModal(false);
            onUpdate();
          }}
        />
      )}
    </Sheet>
  );
}