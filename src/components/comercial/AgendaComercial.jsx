import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, CheckCircle, XCircle, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  agendada: { label: 'Agendada', color: 'bg-blue-100 text-blue-700', icon: Clock },
  realizada: { label: 'Realizada', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  nao_compareceu: { label: 'Não Compareceu', color: 'bg-red-100 text-red-700', icon: XCircle },
  reagendada: { label: 'Reagendada', color: 'bg-amber-100 text-amber-700', icon: RefreshCw },
  cancelada: { label: 'Cancelada', color: 'bg-slate-100 text-slate-600', icon: XCircle },
};

export default function AgendaComercial({ user }) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [form, setForm] = useState({ titulo: '', lead_id: '', data_hora: '', duracao_minutos: 60, tipo: 'diagnostico', local_link: '', notas: '' });

  const weekStart = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: reunioes = [], isLoading } = useQuery({
    queryKey: ['reunioesComercial'],
    queryFn: () => base44.entities.ReuniaoComercial.list('-data_hora', 200),
    staleTime: 60 * 1000
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leadsComercialAgenda'],
    queryFn: () => base44.entities.LeadComercial.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const lead = leads.find(l => l.id === data.lead_id);
      return base44.entities.ReuniaoComercial.create({
        ...data,
        lead_nome: lead?.nome_empresa || '',
        responsavel_voxx: user?.email,
        responsavel_nome: user?.full_name
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reunioesComercial']);
      toast.success('Reunião agendada!');
      setShowModal(false);
      setForm({ titulo: '', lead_id: '', data_hora: '', duracao_minutos: 60, tipo: 'diagnostico', local_link: '', notas: '' });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.ReuniaoComercial.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(['reunioesComercial']);
      toast.success('Status atualizado!');
    }
  });

  const getReunioesDia = (day) => reunioes.filter(r => r.data_hora && isSameDay(parseISO(r.data_hora), day));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w - 1)}>←</Button>
          <span className="text-sm font-medium text-slate-700">
            {format(weekStart, "'Semana de' d 'de' MMM", { locale: ptBR })}
          </span>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w + 1)}>→</Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-xs text-slate-500">Hoje</Button>
        </div>
        <Button onClick={() => setShowModal(true)} className="bg-violet-600 hover:bg-violet-700">
          <Plus className="w-4 h-4 mr-2" /> Agendar Reunião
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(day => {
          const reunioesDia = getReunioesDia(day);
          const isHoje = isSameDay(day, new Date());
          return (
            <div key={day.toISOString()} className={`min-h-[120px] rounded-lg border p-2 ${isHoje ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white'}`}>
              <p className={`text-xs font-semibold mb-2 ${isHoje ? 'text-violet-700' : 'text-slate-500'}`}>
                {format(day, 'EEE', { locale: ptBR }).toUpperCase()}<br />
                <span className={`text-base ${isHoje ? 'text-violet-800' : 'text-slate-800'}`}>{format(day, 'd')}</span>
              </p>
              <div className="space-y-1">
                {reunioesDia.map(r => {
                  const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.agendada;
                  return (
                    <div key={r.id} className={`text-xs px-1.5 py-1 rounded ${cfg.color} cursor-pointer`}>
                      <p className="font-medium truncate">{r.titulo}</p>
                      <p className="opacity-75">{r.data_hora ? format(parseISO(r.data_hora), 'HH:mm') : ''}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lista de próximas reuniões */}
      <Card className="p-4">
        <h3 className="font-semibold text-slate-800 mb-3 text-sm">Próximas Reuniões</h3>
        <div className="space-y-2">
          {reunioes.filter(r => r.status === 'agendada').slice(0, 10).map(r => {
            const cfg = STATUS_CONFIG[r.status];
            return (
              <div key={r.id} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                <div>
                  <p className="font-medium text-slate-800">{r.titulo}</p>
                  <p className="text-xs text-slate-500">{r.lead_nome} · {r.data_hora ? format(parseISO(r.data_hora), "dd/MM 'às' HH:mm", { locale: ptBR }) : '-'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`${cfg.color} text-xs`}>{cfg.label}</Badge>
                  <Select value={r.status} onValueChange={v => updateStatusMutation.mutate({ id: r.id, status: v })}>
                    <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
          {reunioes.filter(r => r.status === 'agendada').length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">Nenhuma reunião agendada.</p>
          )}
        </div>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Agendar Reunião</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Lead *</Label>
              <Select value={form.lead_id} onValueChange={v => setForm({ ...form, lead_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar lead" /></SelectTrigger>
                <SelectContent>
                  {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.nome_empresa}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Título *</Label>
              <Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Reunião de diagnóstico" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data e Hora *</Label>
              <Input type="datetime-local" value={form.data_hora} onChange={e => setForm({ ...form, data_hora: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[['diagnostico','Diagnóstico'],['apresentacao','Apresentação'],['negociacao','Negociação'],['follow_up','Follow-up'],['outro','Outro']].map(([k,v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Duração (min)</Label>
                <Input type="number" value={form.duracao_minutos} onChange={e => setForm({ ...form, duracao_minutos: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Local / Link</Label>
              <Input value={form.local_link} onChange={e => setForm({ ...form, local_link: e.target.value })} placeholder="Meet, Zoom, endereço..." />
            </div>
            <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => createMutation.mutate(form)} disabled={!form.titulo || !form.lead_id || !form.data_hora || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Agendar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}