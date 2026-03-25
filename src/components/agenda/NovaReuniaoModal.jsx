import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, X } from 'lucide-react';

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

export default function NovaReuniaoModal({ open, onClose, onSaved, reuniao = null, defaultDate = null }) {
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
  });
  const [saving, setSaving] = useState(false);

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
      });
    } else {
      setForm(f => ({ ...f, start_datetime: defaultStart, end_datetime: defaultEnd }));
    }
  }, [reuniao, open]);

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

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
    };

    if (isEdit) {
      await base44.entities.AgendaReuniao.update(reuniao.id, payload);
    } else {
      await base44.entities.AgendaReuniao.create(payload);
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

          {/* Bloco 4 — Info adicional */}
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