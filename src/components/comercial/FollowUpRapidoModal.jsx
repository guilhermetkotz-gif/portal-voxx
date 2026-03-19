import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function FollowUpRapidoModal({ lead, open, onClose, user }) {
  const queryClient = useQueryClient();
  const [diasAgendamento, setDiasAgendamento] = useState('3');
  const [descricao, setDescricao] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const prazo = new Date();
      prazo.setDate(prazo.getDate() + parseInt(diasAgendamento));

      // Criar tarefa automática de follow-up
      await base44.entities.TarefaComercial.create({
        lead_id: lead.id,
        lead_nome: lead.nome_empresa,
        titulo: descricao || `Follow-up - ${lead.nome_empresa}`,
        tipo: 'follow_up',
        data_prazo: prazo.toISOString().split('T')[0],
        responsavel_voxx: user?.email,
        responsavel_nome: user?.full_name,
        status: 'pendente',
        automatica: true,
      });

      // Registrar interação
      await base44.entities.InteracaoComercial.create({
        lead_id: lead.id,
        tipo: 'nota',
        descricao: `Follow-up agendado para ${prazo.toLocaleDateString('pt-BR')}. ${descricao ? `Nota: ${descricao}` : ''}`,
        autor: user?.email,
        autor_nome: user?.full_name,
      });

      // Atualizar último contato do lead
      await base44.entities.LeadComercial.update(lead.id, {
        ultima_interacao: new Date().toISOString(),
        alerta_inatividade: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leadsComercial'] });
      queryClient.invalidateQueries({ queryKey: ['tarefasComercial', lead.id] });
      toast.success(`Follow-up agendado para ${diasAgendamento} dias!`);
      onClose();
      setDescricao('');
      setDiasAgendamento('3');
    },
    onError: () => {
      toast.error('Erro ao agendar follow-up');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            ⚡ Follow-up Rápido
            <span className="text-sm font-normal text-slate-500">{lead?.nome_empresa}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Agendar para</Label>
            <div className="flex gap-2">
              {['1', '3', '7'].map(dias => (
                <Button
                  key={dias}
                  variant={diasAgendamento === dias ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setDiasAgendamento(dias)}
                >
                  {dias}d
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">Observação (opcional)</Label>
            <Input
              placeholder="Ex: Enviar orçamento, confirmar reunião..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={80}
            />
            <p className="text-xs text-slate-400">{descricao.length}/80</p>
          </div>

          <Button
            className="w-full bg-violet-600 hover:bg-violet-700"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Agendar Follow-up
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}