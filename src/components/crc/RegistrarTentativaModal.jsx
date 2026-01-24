import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from 'lucide-react';

export default function RegistrarTentativaModal({ lead, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    canal: 'whatsapp',
    resultado: 'sem_resposta',
    nota: ''
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Create tentativa
      await base44.entities.CrcTentativa.create({
        lead_id: lead.id,
        data_hora: new Date().toISOString(),
        ...data
      });

      // Update lead
      const updates = {
        qtd_tentativas: (lead.qtd_tentativas || 0) + 1,
        ultima_tentativa_em: new Date().toISOString()
      };

      // If first contact made, calculate response time
      if (data.resultado === 'contato_feito' && !lead.tempo_primeira_resposta_min) {
        const diffMin = Math.floor((Date.now() - new Date(lead.data_chegada).getTime()) / (1000 * 60));
        updates.tempo_primeira_resposta_min = diffMin;
      }

      await base44.entities.CrcLead.update(lead.id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['crcLeads']);
      queryClient.invalidateQueries(['crcTentativas']);
      onSuccess();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Tentativa</DialogTitle>
        </DialogHeader>

        <div className="mb-4">
          <p className="text-sm text-slate-600">
            Lead: <strong>{lead.nome || lead.telefone}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Canal</Label>
            <Select value={formData.canal} onValueChange={(v) => setFormData({ ...formData, canal: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="ligacao">Ligação</SelectItem>
                <SelectItem value="messenger">Messenger</SelectItem>
                <SelectItem value="direct">Direct</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Resultado</Label>
            <Select value={formData.resultado} onValueChange={(v) => setFormData({ ...formData, resultado: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sem_resposta">Sem Resposta</SelectItem>
                <SelectItem value="contato_feito">Contato Feito</SelectItem>
                <SelectItem value="retornar">Retornar</SelectItem>
                <SelectItem value="ocupado">Ocupado</SelectItem>
                <SelectItem value="caixa_postal">Caixa Postal</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notas (opcional)</Label>
            <Textarea
              value={formData.nota}
              onChange={(e) => setFormData({ ...formData, nota: e.target.value })}
              placeholder="Adicione observações sobre a tentativa..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}