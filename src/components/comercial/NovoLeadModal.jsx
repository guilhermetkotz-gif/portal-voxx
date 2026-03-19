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

export default function NovoLeadModal({ open, onClose, user }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    nome_empresa: '', nome_contato: '', telefone: '', email: '',
    cidade: '', estado: '', segmento: '', origem: 'inbound',
    valor_estimado: '', etapa: 'novo_lead'
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const lead = await base44.entities.LeadComercial.create({
        ...data,
        valor_estimado: data.valor_estimado ? Number(data.valor_estimado) : 0,
        responsavel_voxx: user?.email,
        responsavel_nome: user?.full_name,
        ultima_interacao: new Date().toISOString()
      });
      await base44.entities.InteracaoComercial.create({
        lead_id: lead.id,
        tipo: 'status_change',
        descricao: 'Lead criado no pipeline comercial',
        autor: user?.email,
        autor_nome: user?.full_name
      });
      return lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['leadsComercial']);
      toast.success('Lead adicionado ao pipeline!');
      onClose();
      setForm({ nome_empresa: '', nome_contato: '', telefone: '', email: '', cidade: '', estado: '', segmento: '', origem: 'inbound', valor_estimado: '', etapa: 'novo_lead' });
    }
  });

  const f = (key) => ({ value: form[key], onChange: e => setForm({ ...form, [key]: e.target.value }) });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Empresa *</Label>
              <Input placeholder="Nome da empresa" {...f('nome_empresa')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contato *</Label>
              <Input placeholder="Nome do contato" {...f('nome_contato')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input placeholder="(11) 99999-9999" {...f('telefone')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">E-mail</Label>
              <Input placeholder="email@empresa.com" {...f('email')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cidade</Label>
              <Input placeholder="Cidade" {...f('cidade')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Input placeholder="UF" {...f('estado')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Segmento</Label>
              <Input placeholder="Ex: Odontologia" {...f('segmento')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor Estimado (R$)</Label>
              <Input type="number" placeholder="0" {...f('valor_estimado')} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Origem</Label>
            <Select value={form.origem} onValueChange={v => setForm({ ...form, origem: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[['indicacao','Indicação'],['inbound','Inbound'],['outbound','Outbound'],['evento','Evento'],['redes_sociais','Redes Sociais'],['outro','Outro']].map(([k,v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full bg-violet-600 hover:bg-violet-700"
            onClick={() => mutation.mutate(form)}
            disabled={!form.nome_empresa || !form.nome_contato || mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Criar Lead
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}