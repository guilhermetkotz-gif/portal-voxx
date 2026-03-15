import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

const defaultForm = (planoId, clienteId) => ({
  plano_id: planoId,
  cliente_id: clienteId,
  problema_identificado: "",
  acao_proposta: "",
  responsavel: "Agência Voxx",
  data_abertura: format(new Date(), "yyyy-MM-dd"),
  prazo: "",
  status_acao: "Nova",
  observacoes: "",
  demanda_id_relacionada: "",
});

export default function NovaAcaoModal({ open, onOpenChange, planoId, clienteId, itemParaEditar, onSaved }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultForm(planoId, clienteId));

  useEffect(() => {
    if (itemParaEditar) {
      setForm({ ...defaultForm(planoId, clienteId), ...itemParaEditar });
    } else {
      setForm(defaultForm(planoId, clienteId));
    }
  }, [itemParaEditar, planoId, clienteId, open]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (itemParaEditar?.id) {
        return base44.entities.PlanoDeAcaoItem.update(itemParaEditar.id, data);
      }
      return base44.entities.PlanoDeAcaoItem.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planoItens", planoId] });
      queryClient.invalidateQueries({ queryKey: ["planosDeAcao"] });
      onSaved?.();
      onOpenChange(false);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.problema_identificado || !form.acao_proposta || !form.prazo) return;
    mutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{itemParaEditar ? "Editar Ação" : "Nova Ação"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label>Problema identificado *</Label>
            <Textarea
              value={form.problema_identificado}
              onChange={(e) => setForm({ ...form, problema_identificado: e.target.value })}
              placeholder="Ex: CPL acima de R$40 nos últimos 7 dias"
              rows={2}
            />
          </div>
          <div>
            <Label>Ação proposta *</Label>
            <Textarea
              value={form.acao_proposta}
              onChange={(e) => setForm({ ...form, acao_proposta: e.target.value })}
              placeholder="Ex: Trocar criativos da campanha de WhatsApp"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Responsável *</Label>
              <Select value={form.responsavel} onValueChange={(v) => setForm({ ...form, responsavel: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Agência Voxx">Agência Voxx</SelectItem>
                  <SelectItem value="Unidade">Unidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status_acao} onValueChange={(v) => setForm({ ...form, status_acao: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Nova">Nova</SelectItem>
                  <SelectItem value="Em andamento">Em andamento</SelectItem>
                  <SelectItem value="Concluída">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de abertura</Label>
              <Input
                type="date"
                value={form.data_abertura}
                onChange={(e) => setForm({ ...form, data_abertura: e.target.value })}
              />
            </div>
            <div>
              <Label>Prazo *</Label>
              <Input
                type="date"
                value={form.prazo}
                onChange={(e) => setForm({ ...form, prazo: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Detalhes adicionais (opcional)"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-violet-600 hover:bg-violet-700">
              {mutation.isPending ? "Salvando..." : "Salvar Ação"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}