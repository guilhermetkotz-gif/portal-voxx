import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const TIPOS = [
  { value: 'ligacao', label: '📞 Ligação' },
  { value: 'whatsapp', label: '💬 WhatsApp' },
  { value: 'email', label: '✉️ E-mail' },
  { value: 'reuniao', label: '🎯 Reunião' },
  { value: 'proposta', label: '📄 Proposta' },
  { value: 'nota', label: '📝 Nota Interna' },
];

export default function RegistrarInteracaoModal({ leadId, open, onClose, user }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    tipo: 'ligacao',
    descricao: '',
    proximo_passo: '',
    data_hora: new Date().toISOString().slice(0, 16),
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      await base44.entities.InteracaoComercial.create({
        lead_id: leadId,
        tipo: data.tipo,
        descricao: `${data.descricao}${data.proximo_passo ? `\n\n📌 Próximo passo: ${data.proximo_passo}` : ''}`,
        autor: user?.email,
        autor_nome: user?.full_name,
      });
      await base44.entities.LeadComercial.update(leadId, {
        ultima_interacao: new Date().toISOString(),
        alerta_inatividade: false,
      });
      if (data.proximo_passo) {
        const prazo = new Date();
        prazo.setDate(prazo.getDate() + 3);
        await base44.entities.TarefaComercial.create({
          lead_id: leadId,
          titulo: data.proximo_passo,
          tipo: 'follow_up',
          data_prazo: prazo.toISOString().split('T')[0],
          responsavel_voxx: user?.email,
          responsavel_nome: user?.full_name,
          automatica: true,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interacoesComercial', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leadsComercial'] });
      queryClient.invalidateQueries({ queryKey: ['tarefasLead', leadId] });
      toast.success('Interação registrada!');
      onClose();
      setForm({ tipo: 'ligacao', descricao: '', proximo_passo: '', data_hora: new Date().toISOString().slice(0, 16) });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Interação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo de Interação *</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data e Hora</Label>
              <Input type="datetime-local" value={form.data_hora} onChange={e => setForm({ ...form, data_hora: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">O que aconteceu? *</Label>
            <Textarea
              placeholder="Descreva o que foi discutido, decidido ou observado..."
              value={form.descricao}
              onChange={e => setForm({ ...form, descricao: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Próximo Passo <span className="text-slate-400">(recomendado)</span></Label>
            <Input
              placeholder="Ex: Ligar na quinta com retorno da proposta"
              value={form.proximo_passo}
              onChange={e => setForm({ ...form, proximo_passo: e.target.value })}
            />
            <p className="text-xs text-slate-400">Uma tarefa será criada automaticamente se preenchido.</p>
          </div>

          <Button
            className="w-full bg-violet-600 hover:bg-violet-700"
            onClick={() => mutation.mutate(form)}
            disabled={!form.descricao.trim() || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Salvar Interação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}