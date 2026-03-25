import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar, Clock, Building2, Users, Target, Edit2,
  CheckCircle, XCircle, X, AlertTriangle, UserCheck, Loader2, Save
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG = {
  agendada:      { label: 'Agendada',       cls: 'bg-blue-100 text-blue-700' },
  realizada:     { label: 'Realizada',      cls: 'bg-green-100 text-green-700' },
  nao_realizada: { label: 'Não realizada',  cls: 'bg-red-100 text-red-700' },
  cancelada:     { label: 'Cancelada',      cls: 'bg-slate-100 text-slate-600' },
};

const TIPOS_LABEL = {
  comercial: 'Comercial', onboarding: 'Onboarding', alinhamento: 'Alinhamento',
  resultados: 'Resultados', estrategico: 'Estratégico', operacional: 'Operacional', retencao: 'Retenção',
};

const MOTIVOS_NAO_REALIZACAO = [
  'Cliente não compareceu', 'Equipe não compareceu', 'Sem retorno',
  'Cancelada', 'Reagendamento necessário', 'Outro',
];

function hasRegistro(r) {
  return !!(r.summary || r.discussion_points || r.pending_items || r.next_steps);
}

export default function EventoDetalhe({ reuniao, open, onClose, onEdit, onStatusChange }) {
  const queryClient = useQueryClient();
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [savingRegistro, setSavingRegistro] = useState(false);

  // Registro pós-reunião realizada
  const [registro, setRegistro] = useState({
    summary: '', discussion_points: '', pending_items: '',
    next_steps: '', followup_owner_id: '', followup_owner_nome: '',
    followup_date: '', internal_notes: '',
  });

  // Registro não realizada
  const [naoRealizada, setNaoRealizada] = useState({
    non_completion_reason: '', non_completion_notes: '',
  });

  const [showRegistroForm, setShowRegistroForm] = useState(false);
  const [showNaoRealizadaForm, setShowNaoRealizadaForm] = useState(false);

  const { data: voxxUsers = [] } = useQuery({
    queryKey: ['voxx_users_agenda'],
    queryFn: async () => {
      const all = await base44.entities.User.list('-created_date', 200);
      return all.filter(u => {
        const tipo = u.tipo_usuario || u.tipo_acesso;
        return tipo && (tipo.startsWith('voxx_') || u.role === 'admin');
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (reuniao) {
      setRegistro({
        summary: reuniao.summary || '',
        discussion_points: reuniao.discussion_points || '',
        pending_items: reuniao.pending_items || '',
        next_steps: reuniao.next_steps || '',
        followup_owner_id: reuniao.followup_owner_id || '',
        followup_owner_nome: reuniao.followup_owner_nome || '',
        followup_date: reuniao.followup_date || '',
        internal_notes: reuniao.internal_notes || '',
      });
      setNaoRealizada({
        non_completion_reason: reuniao.non_completion_reason || '',
        non_completion_notes: reuniao.non_completion_notes || '',
      });
      setShowRegistroForm(false);
      setShowNaoRealizadaForm(false);
    }
  }, [reuniao?.id, open]);

  if (!reuniao) return null;

  const start = parseISO(reuniao.start_datetime);
  const end = parseISO(reuniao.end_datetime);
  const statusCfg = STATUS_CONFIG[reuniao.status] || STATUS_CONFIG.agendada;
  const semRegistro = reuniao.status === 'realizada' && !hasRegistro(reuniao);

  const changeStatus = async (status) => {
    setLoadingStatus(true);
    await base44.entities.AgendaReuniao.update(reuniao.id, { status });
    setLoadingStatus(false);
    if (status === 'realizada') setShowRegistroForm(true);
    if (status === 'nao_realizada') setShowNaoRealizadaForm(true);
    onStatusChange();
  };

  const saveRegistro = async () => {
    setSavingRegistro(true);
    const followupUser = voxxUsers.find(u => u.id === registro.followup_owner_id);
    await base44.entities.AgendaReuniao.update(reuniao.id, {
      ...registro,
      followup_owner_nome: followupUser?.full_name || '',
    });
    setSavingRegistro(false);
    setShowRegistroForm(false);
    queryClient.invalidateQueries({ queryKey: ['agenda_reunioes'] });
    onStatusChange();
  };

  const saveNaoRealizada = async () => {
    setSavingRegistro(true);
    await base44.entities.AgendaReuniao.update(reuniao.id, naoRealizada);
    setSavingRegistro(false);
    setShowNaoRealizadaForm(false);
    queryClient.invalidateQueries({ queryKey: ['agenda_reunioes'] });
    onStatusChange();
  };

  const setR = (k, v) => setRegistro(f => ({ ...f, [k]: v }));
  const setNR = (k, v) => setNaoRealizada(f => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-1">{TIPOS_LABEL[reuniao.tipo_reuniao] || reuniao.tipo_reuniao}</p>
              <DialogTitle className="text-lg leading-snug">{reuniao.titulo}</DialogTitle>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge className={statusCfg.cls}>{statusCfg.label}</Badge>
              {semRegistro && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3 h-3" /> Sem registro
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Informações da reunião */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{format(start, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{format(start, 'HH:mm')} – {format(end, 'HH:mm')}</span>
            </div>
            {reuniao.unidade_nome && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{reuniao.unidade_nome}</span>
              </div>
            )}
            {reuniao.participantes_nomes?.length > 0 && (
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <Users className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>{reuniao.participantes_nomes.join(', ')}</span>
              </div>
            )}
            {reuniao.objetivo && (
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <Target className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>{reuniao.objetivo}</span>
              </div>
            )}
            {reuniao.observacoes && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
                {reuniao.observacoes}
              </div>
            )}
          </div>

          {/* Ações de status */}
          {reuniao.status === 'agendada' && (
            <div className="border rounded-xl p-3 space-y-2 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ação rápida</p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => changeStatus('realizada')} disabled={loadingStatus}>
                  <CheckCircle className="w-3.5 h-3.5" /> Marcar como realizada
                </Button>
                <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => changeStatus('nao_realizada')} disabled={loadingStatus}>
                  <XCircle className="w-3.5 h-3.5" /> Não realizada
                </Button>
                <Button size="sm" variant="outline" className="text-slate-500" onClick={() => changeStatus('cancelada')} disabled={loadingStatus}>
                  <X className="w-3.5 h-3.5" /> Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Registro de não realização */}
          {reuniao.status === 'nao_realizada' && (
            <div className="border border-red-200 rounded-xl p-4 space-y-3 bg-red-50/50">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Registro — Não Realizada</p>
              {!showNaoRealizadaForm && (reuniao.non_completion_reason || reuniao.non_completion_notes) ? (
                <div className="space-y-1">
                  {reuniao.non_completion_reason && <p className="text-sm text-slate-700"><span className="font-medium">Motivo:</span> {reuniao.non_completion_reason}</p>}
                  {reuniao.non_completion_notes && <p className="text-sm text-slate-600">{reuniao.non_completion_notes}</p>}
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => setShowNaoRealizadaForm(true)}>Editar</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Motivo</Label>
                    <Select value={naoRealizada.non_completion_reason} onValueChange={v => setNR('non_completion_reason', v)}>
                      <SelectTrigger className="mt-1 bg-white">
                        <SelectValue placeholder="Selecionar motivo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {MOTIVOS_NAO_REALIZACAO.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Observação complementar</Label>
                    <Textarea className="mt-1 bg-white" rows={2} value={naoRealizada.non_completion_notes} onChange={e => setNR('non_completion_notes', e.target.value)} />
                  </div>
                  <Button size="sm" onClick={saveNaoRealizada} disabled={savingRegistro}>
                    {savingRegistro && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <Save className="w-3.5 h-3.5" /> Salvar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Registro pós-reunião realizada */}
          {reuniao.status === 'realizada' && (
            <div className="border border-green-200 rounded-xl p-4 space-y-4 bg-green-50/30">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">Registro da Reunião</p>
                {!showRegistroForm && hasRegistro(reuniao) && (
                  <Button size="sm" variant="outline" onClick={() => setShowRegistroForm(true)}>Editar</Button>
                )}
              </div>

              {!showRegistroForm && !hasRegistro(reuniao) ? (
                <div className="text-center py-3">
                  <p className="text-sm text-slate-500 mb-3">Reunião realizada. Registre o que aconteceu.</p>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setShowRegistroForm(true)}>
                    Preencher registro
                  </Button>
                </div>
              ) : !showRegistroForm && hasRegistro(reuniao) ? (
                <div className="space-y-3 text-sm text-slate-700">
                  {reuniao.summary && <div><p className="text-xs font-semibold text-slate-500 mb-0.5">Resumo</p><p>{reuniao.summary}</p></div>}
                  {reuniao.discussion_points && <div><p className="text-xs font-semibold text-slate-500 mb-0.5">Pontos discutidos</p><p>{reuniao.discussion_points}</p></div>}
                  {reuniao.pending_items && <div><p className="text-xs font-semibold text-slate-500 mb-0.5">Pendências</p><p>{reuniao.pending_items}</p></div>}
                  {reuniao.next_steps && <div><p className="text-xs font-semibold text-slate-500 mb-0.5">Próximos passos</p><p>{reuniao.next_steps}</p></div>}
                  {(reuniao.followup_owner_nome || reuniao.followup_date) && (
                    <div className="flex items-center gap-3 bg-white rounded-lg p-2 border">
                      <UserCheck className="w-4 h-4 text-violet-500 shrink-0" />
                      <div>
                        {reuniao.followup_owner_nome && <p className="text-xs font-medium">{reuniao.followup_owner_nome}</p>}
                        {reuniao.followup_date && <p className="text-xs text-slate-500">Follow-up: {reuniao.followup_date}</p>}
                      </div>
                    </div>
                  )}
                  {reuniao.internal_notes && <div><p className="text-xs font-semibold text-slate-500 mb-0.5">Observações internas</p><p className="text-slate-600">{reuniao.internal_notes}</p></div>}
                </div>
              ) : null}

              {showRegistroForm && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-semibold">Resumo da reunião</Label>
                    <Textarea className="mt-1 bg-white" rows={3} placeholder="Como foi a reunião? O que foi decidido?" value={registro.summary} onChange={e => setR('summary', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Principais pontos discutidos</Label>
                    <Textarea className="mt-1 bg-white" rows={2} placeholder="Liste os tópicos abordados..." value={registro.discussion_points} onChange={e => setR('discussion_points', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Pendências identificadas</Label>
                    <Textarea className="mt-1 bg-white" rows={2} placeholder="O que ficou pendente?" value={registro.pending_items} onChange={e => setR('pending_items', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Próximos passos</Label>
                    <Textarea className="mt-1 bg-white" rows={2} placeholder="O que acontece a partir de agora?" value={registro.next_steps} onChange={e => setR('next_steps', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Responsável pelo follow-up</Label>
                      <Select value={registro.followup_owner_id} onValueChange={v => setR('followup_owner_id', v)}>
                        <SelectTrigger className="mt-1 bg-white">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {voxxUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Data do follow-up</Label>
                      <Input type="date" className="mt-1 bg-white" value={registro.followup_date} onChange={e => setR('followup_date', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Observações internas (opcional)</Label>
                    <Textarea className="mt-1 bg-white" rows={2} value={registro.internal_notes} onChange={e => setR('internal_notes', e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveRegistro} disabled={savingRegistro} className="bg-green-600 hover:bg-green-700 text-white">
                      {savingRegistro && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <Save className="w-3.5 h-3.5" /> Salvar registro
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowRegistroForm(false)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit2 className="w-3.5 h-3.5" /> Editar reunião
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}