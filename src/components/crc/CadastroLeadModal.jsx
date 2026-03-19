import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from 'lucide-react';

export default function CadastroLeadModal({ unidadeId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    origem: 'whats_sem_origem',
    tratamento: 'nao_informado',
    link_anuncio: '',
    data_chegada: new Date().toISOString()
  });
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Check for duplicates
  const { data: existingLeads } = useQuery({
    queryKey: ['checkDuplicate', formData.telefone, unidadeId],
    queryFn: async () => {
      if (!formData.telefone || formData.telefone.length < 8) return [];
      const leads = await base44.entities.CrcLead.filter({
        unidade_id: unidadeId,
        telefone: formData.telefone
      }, '-created_date', 5);
      return leads;
    },
    enabled: formData.telefone.length >= 8
  });

  React.useEffect(() => {
    if (existingLeads && existingLeads.length > 0) {
      const recent = existingLeads[0];
      const daysSince = Math.floor((Date.now() - new Date(recent.created_date).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince <= 30) {
        setDuplicateWarning(recent);
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
  }, [existingLeads]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.CrcLead.create({
        ...data,
        unidade_id: unidadeId,
        fonte_cadastro: 'manual',
        status: 'sem_contato',
        qtd_tentativas: 0,
        sla_atrasado: false
      });
    },
    onSuccess
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nome || !formData.telefone) {
      alert('Preencha os campos obrigatórios');
      return;
    }
    if (duplicateWarning) {
      if (!window.confirm('Este telefone já está cadastrado. Deseja cadastrar mesmo assim?')) return;
    }
    createMutation.mutate(formData);
  };

  const handleOpenExisting = () => {
    window.open(`#/lead/${duplicateWarning.id}`, '_blank');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Lead Manual</DialogTitle>
        </DialogHeader>

        {duplicateWarning && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <div className="font-medium mb-2">⚠️ Telefone já cadastrado!</div>
              <div className="text-sm mb-2">
                Lead existente: <strong>{duplicateWarning.nome}</strong> • 
                Cadastrado há {Math.floor((Date.now() - new Date(duplicateWarning.created_date).getTime()) / (1000 * 60 * 60 * 24))} dias
              </div>
              <Button size="sm" variant="outline" onClick={handleOpenExisting}>
                Abrir Lead Existente
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome do lead"
                required
              />
            </div>

            <div>
              <Label>Telefone *</Label>
              <Input
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
                required
              />
            </div>

            <div>
              <Label>Origem *</Label>
              <Select value={formData.origem} onValueChange={(v) => setFormData({ ...formData, origem: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whats_sem_origem">WhatsApp sem origem</SelectItem>
                  <SelectItem value="facebook_whats">Facebook WhatsApp</SelectItem>
                  <SelectItem value="instagram_whats">Instagram WhatsApp</SelectItem>
                  <SelectItem value="meta_ads_cadastro">Meta Ads Cadastro</SelectItem>
                  <SelectItem value="google_cadastro">Google Cadastro</SelectItem>
                  <SelectItem value="google_ligacao">Google Ligação</SelectItem>
                  <SelectItem value="messenger_direct">Messenger Direct</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tratamento *</Label>
              <Select value={formData.tratamento} onValueChange={(v) => setFormData({ ...formData, tratamento: v })}>
                <SelectTrigger>
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
            </div>

            <div className="col-span-2">
              <Label>Link do Anúncio (opcional)</Label>
              <Input
                value={formData.link_anuncio}
                onChange={(e) => setFormData({ ...formData, link_anuncio: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cadastrar Lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}