import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, X, AlertTriangle } from 'lucide-react';
import { parseISO, areIntervalsOverlapping } from 'date-fns';

const TIPOS_REUNIAO = [
  { value: 'comercial', label: 'Comercial' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'alinhamento', label: 'Alinhamento' },
  { value: 'resultados', label: 'Resultados' },
  { value: 'estrategico', label: 'Estratégico' },
  { value: 'operacional', label: 'Operacional' },
  { value: 'retencao', label: 'Retenção' },
];

const toDatetimeLocal = (dt) => {
  if (!dt) return '';
  return new Date(dt).toISOString().slice(0, 16);
};

const fromDatetimeLocal = (str) => str ? new Date(str).toISOString() : '';

export default function NovaReuniaoModal({ open, onClose, onSaved, reuniao = null, defaultDate = null, cloneFrom = null }) {
  const isEdit = !!reuniao;

  const defaultStart = defaultDate
    ? new Date(defaultDate).toISOString().slice(0, 16)
    : new Date().toISOString().slice(0, 16);
  const defaultEnd = defaultDate
    ? (() => { const d = new Date(defaultDate); d.setHours(d.getHours() + 1); return d.toISOString().slice(0, 16); })()
    : (() => { const d = new Date(); d.setHours(d.getHours() + 1); return d.toISOString().slice(0, 16); })();

  const [form, setForm] = useState({
    titulo: '',
    unidade_id: '',
    tipo_reuniao: 'alinhamento',
    participantes_ids: [],
    start_datetime: defaultStart,
    end_datetime: defaultEnd,
    objetivo: '',
    observacoes: '',
    recurrence_type: 'nao_recorrente',
  });
  const [saving, setSaving] = useState(false);
  const [conflitos, setConflitos] = useState([]);
  const [ignorarConflito, setIgnorarConflito] = useState(false);

  useEffect(() => {
    if (reuniao) {
      setForm({
        titulo: reuniao.titulo || '',
        unidade_id: reuniao.unidade_id || '',
        tipo_reuniao: reuniao.tipo_reuniao || 'alinhamento',
        participantes_ids: reuniao.participantes_ids || [],
        start_datetime: toDatetimeLocal(reuniao.start_datetime),
        end_datetime: toDatetimeLocal(reuniao.end_datetime),
        objetivo: reuniao.objetivo || '',
        observacoes: reuniao.observacoes || '',
        recurrence_type: reuniao.recurrence_type || 'nao_recorrente',
      });
    } else if (cloneFrom) {
      setForm(f => ({
        ...f,
        titulo: cloneFrom.titulo || '',
        unidade_id: cloneFrom.unidade_id || '',
        tipo_reuniao: cloneFrom.tipo_reuniao || 'alinhamento',
        participantes_ids: cloneFrom.participantes_ids || [],
        start_datetime: defaultStart,
        end_datetime: defaultEnd,
        objetivo: cloneFrom.objetivo || '',
        observacoes: '',
        recurrence_type: 'nao_recorrente',
      }));
    } else {
      setForm(f => ({ ...f, start_datetime: defaultStart, end_datetime: defaultEnd, recurrence_type: 'nao_recorrente' }));
    }
    setConflitos([]);
    setIgnorarConflito(false);
  }, [reuniao, cloneFrom, open]);

  const { data: todasReunioes = [] } = useQuery({
    queryKey: ['agenda_reunioes_conflito'],
    queryFn: () => base44.entities.AgendaReuniao.list('-start_datetime', 500),
    staleTime: 2 * 60 * 1000,
    enabled: open,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes_agenda'],
    queryFn: () => base44.entities.Cliente.list('nome', 500),
    staleTime: 5 * 60 * 1000,
  });

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

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (k === 'start_datetime' || k === 'end_datetime' || k === 'participantes_ids') {
      setIgnorarConflito(false);
    }
  };

  // Detectar conflitos ao alterar horários ou participantes
  useEffect(() => {
    if (!form.start_datetime || !form.end_datetime || form.participantes_ids.length === 0) {
      setConflitos([]);
      return;
    }
    const start = new Date(form.start_datetime);
    const end = new Date(form.end_datetime);
    if (isNaN(start) || isNaN(end)) return;

    const conflitosEncontrados = [];
    todasReunioes.forEach(r => {
      if (reuniao && r.id === reuniao.id) return; // ignorar si mesmo
      if (!['agendada', 'reagendada'].includes(r.status)) return;
      const rStart = parseISO(r.start_datetime);
      const rEnd = parseISO(r.end_datetime);
      const overlap = areIntervalsOverlapping({ start, end }, { start: rStart, end: rEnd });
      if (overlap) {
        const participantesConflito = form.participantes_ids.filter(id => r.participantes_ids?.includes(id));
        if (participantesConflito.length > 0) {
          const nomes = voxxUsers.filter(u => participantesConflito.includes(u.id)).map(u => u.full_name);
          conflitosEncontrados.push({ reuniao: r, nomes });
        }
      }
    });
    setConflitos(conflitosEncontrados);
  }, [form.start_datetime, form.end_datetime, form.participantes_ids, todasReunioes]);

  const toggleParticipante = (id) => {
    setForm(f => ({
      ...f,
      participantes_ids: f.participantes_ids.includes(id)
        ? f.participantes_ids.filter(x => x !== id)
        : [...f.participantes_ids, id]
    }));
  };

  const handleSave = async () => {
    if (!form.titulo || !form.unidade_id || !form.start_datetime || !form.end_datetime) return;
    if (conflitos.length > 0 && !ignorarConflito) {
      setIgnorarConflito(true); // pede confirmação
      return;
    }
    setSaving(true);
    const unidade = clientes.find(c => c.id === form.unidade_id);
    const participantesNomes = voxxUsers
      .filter(u => form.participantes_ids.includes(u.id))
      .map(u => u.full_name);

    const payload = {
      titulo: form.titulo,
      unidade_id: form.unidade_id,
      unidade_nome: unidade?.nome || '',
      tipo_reuniao: form.tipo_reuniao,
      participantes_ids: form.participantes_ids,
      participantes_nomes: participantesNomes,
      start_datetime: fromDatetimeLocal(form.start_datetime),
      end_datetime: fromDatetimeLocal(form.end_datetime),
      objetivo: form.objetivo,
      observacoes: form.observacoes,
      recurrence_type: form.recurrence_type,
      is_recurring: form.recurrence_type !== 'nao_recorrente',
    };

    if (isEdit) {
      await base44.entities.AgendaReuniao.update(reuniao.id, payload);
    } else {
      const created = await base44.entities.AgendaReuniao.create(payload);
      // Gerar reuniões recorrentes
      if (form.recurrence_type !== 'nao_recorrente') {
        const offsets = { semanal: 7, quinzenal: 14, mensal: 30 };
        const days = offsets[form.recurrence_type] || 7;
        const instances = 5; // 5 futuras
        const promises = [];
        for (let i = 1; i <= instances; i++) {
          const s = new Date(fromDatetimeLocal(form.start_datetime));
          const e = new Date(fromDatetimeLocal(form.end_datetime));
          s.setDate(s.getDate() + days * i);
          e.setDate(e.getDate() + days * i);
          promises.push(base44.entities.AgendaReuniao.create({
            ...payload,
            start_datetime: s.toISOString(),
            end_datetime: e.toISOString(),
            original_meeting_id: created.id,
          }));
        }
        await Promise.all(promises);
      }
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Reunião' : 'Nova Reunião'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Bloco 1 — Informações */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Informações principais</p>
            <div>
              <Label>Título <span className="text-red-500">*</span></Label>
              <Input value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex: Alinhamento mensal Oral Sin Curitiba" className="mt-1" />
            </div>
            <div>
              <Label>Unidade <span className="text-red-500">*</span></Label>
              <Select value={form.unidade_id} onValueChange={v => set('unidade_id', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecionar unidade..." />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de reunião</Label>
              <Select value={form.tipo_reuniao} onValueChange={v => set('tipo_reuniao', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_REUNIAO.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bloco 2 — Participantes */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Participantes VOXX</p>
            <div className="max-h-40 overflow-y-auto border rounded-lg p-3 space-y-2">
              {voxxUsers.map(u => (
                <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded p-1">
                  <Checkbox
                    checked={form.participantes_ids.includes(u.id)}
                    onCheckedChange={() => toggleParticipante(u.id)}
                  />
                  <span className="text-sm">{u.full_name}</span>
                  <span className="text-xs text-slate-400">{u.email}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Bloco 3 — Data e horário */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Data e horário</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início <span className="text-red-500">*</span></Label>
                <Input type="datetime-local" value={form.start_datetime} onChange={e => set('start_datetime', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Término <span className="text-red-500">*</span></Label>
                <Input type="datetime-local" value={form.end_datetime} onChange={e => set('end_datetime', e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>

          {/* Bloco 4 — Recorrência */}
          {!isEdit && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recorrência</p>
              <Select value={form.recurrence_type} onValueChange={v => set('recurrence_type', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_recorrente">Não recorrente</SelectItem>
                  <SelectItem value="semanal">Semanal (gerar 5 próximas)</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal (gerar 5 próximas)</SelectItem>
                  <SelectItem value="mensal">Mensal (gerar 5 próximas)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Bloco 5 — Info adicional */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Informações adicionais</p>
            <div>
              <Label>Objetivo da reunião</Label>
              <Input value={form.objetivo} onChange={e => set('objetivo', e.target.value)} placeholder="Qual o objetivo principal?" className="mt-1" />
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Observações iniciais..." className="mt-1" rows={2} />
            </div>
          </div>

          {/* Alertas de conflito */}
          {conflitos.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-sm font-semibold text-amber-700">Conflito de agenda detectado</p>
              </div>
              {conflitos.map((c, i) => (
                <p key={i} className="text-xs text-amber-700 ml-6">
                  ⚠️ {c.nomes.join(', ')} já {c.nomes.length > 1 ? 'possuem' : 'possui'} reunião "{c.reuniao.titulo}" neste horário
                </p>
              ))}
              {ignorarConflito && (
                <p className="text-xs text-amber-600 ml-6 font-medium">Clique em Salvar novamente para confirmar mesmo assim.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.titulo || !form.unidade_id}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Salvar alterações' : 'Salvar reunião'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}