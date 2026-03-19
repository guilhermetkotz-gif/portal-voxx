import React, { useState } from 'react';
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
import { Phone, ExternalLink, Clock, Edit2, Save, X } from 'lucide-react';
import RegistrarTentativaModal from './RegistrarTentativaModal';
import { format } from 'date-fns';

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
  const [editData, setEditData] = useState(lead);

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
          <SheetTitle>Detalhes do Lead</SheetTitle>
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
                      value={editData.nome} 
                      onChange={(e) => setEditData({ ...editData, nome: e.target.value })}
                      autoFocus
                    />
                    <Button size="sm" onClick={() => { handleFieldSave('nome', editData.nome); }}>
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditData(lead); setEditField(null); }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <p 
                    className="text-sm font-medium cursor-pointer hover:bg-slate-50 p-2 rounded" 
                    onClick={() => setEditField('nome')}
                  >
                    {lead.nome || '-'}
                  </p>
                )}
              </div>
              <div>
                <Label>Telefone</Label>
                <p className="text-sm font-medium">{lead.telefone}</p>
              </div>
              <div>
                <Label>Data de Chegada</Label>
                <p className="text-sm">{format(new Date(lead.data_chegada), "dd/MM/yyyy 'às' HH:mm")}</p>
              </div>
              {lead.link_anuncio && (
                <div>
                  <Label>Link do Anúncio</Label>
                  <a href={lead.link_anuncio} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 flex items-center gap-1">
                    Ver anúncio <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
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
                    value={editData.status} 
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
                    <Badge className={statusColors[lead.status]}>{lead.status.replace(/_/g, ' ')}</Badge>
                  </div>
                )}
              </div>

              {lead.status === 'perda' && (
                <div>
                  <Label>Motivo da Perda</Label>
                  {editField === 'motivo_perda' ? (
                    <Select 
                      value={editData.motivo_perda} 
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
                      {lead.motivo_perda?.replace(/_/g, ' ') || 'Clique para definir'}
                    </p>
                  )}
                </div>
              )}

              {lead.status === 'agendou' && (
                <div>
                  <Label>Data de Agendamento</Label>
                  {editField === 'data_agendamento' ? (
                    <div className="flex gap-2">
                      <Input 
                        type="datetime-local" 
                        value={editData.data_agendamento} 
                        onChange={(e) => setEditData({ ...editData, data_agendamento: e.target.value })}
                        autoFocus
                      />
                      <Button size="sm" onClick={() => { handleFieldSave('data_agendamento', editData.data_agendamento); }}>
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditData(lead); setEditField(null); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <p 
                      className="text-sm cursor-pointer hover:bg-slate-50 p-2 rounded"
                      onClick={() => setEditField('data_agendamento')}
                    >
                      {lead.data_agendamento ? format(new Date(lead.data_agendamento), "dd/MM/yyyy 'às' HH:mm") : 'Clique para definir'}
                    </p>
                  )}
                </div>
              )}

              {lead.status === 'interesse_futuro' && (
                <div>
                  <Label>Data de Retorno</Label>
                  {editField === 'data_retorno' ? (
                    <div className="flex gap-2">
                      <Input 
                        type="date" 
                        value={editData.data_retorno} 
                        onChange={(e) => setEditData({ ...editData, data_retorno: e.target.value })}
                        autoFocus
                      />
                      <Button size="sm" onClick={() => { handleFieldSave('data_retorno', editData.data_retorno); }}>
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditData(lead); setEditField(null); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <p 
                      className="text-sm cursor-pointer hover:bg-slate-50 p-2 rounded"
                      onClick={() => setEditField('data_retorno')}
                    >
                      {lead.data_retorno ? format(new Date(lead.data_retorno), 'dd/MM/yyyy') : 'Clique para definir'}
                    </p>
                  )}
                </div>
              )}

              <div>
                <Label>Tratamento</Label>
                {editField === 'tratamento' ? (
                  <Select 
                    value={editData.tratamento} 
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
                    {lead.tratamento?.replace(/_/g, ' ') || '-'}
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
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { handleFieldSave('observacoes', editData.observacoes); }}>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditData(lead); setEditField(null); }}>
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p 
                    className="text-sm cursor-pointer hover:bg-slate-50 p-2 rounded min-h-[40px]"
                    onClick={() => setEditField('observacoes')}
                  >
                    {lead.observacoes || 'Clique para adicionar'}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Timeline de Tentativas */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Timeline de Tentativas ({tentativas.length})</h3>
            <div className="space-y-3">
              {tentativas.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma tentativa registrada</p>
              ) : (
                tentativas.map((t) => (
                  <div key={t.id} className="flex gap-3 pb-3 border-b last:border-0">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Phone className="w-4 h-4 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{t.canal}</span>
                        <span className="text-xs text-slate-500">{format(new Date(t.data_hora), "dd/MM 'às' HH:mm")}</span>
                      </div>
                      <Badge variant="outline" className="text-xs mb-1">{t.resultado?.replace(/_/g, ' ')}</Badge>
                      {t.nota && <p className="text-sm text-slate-600">{t.nota}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}