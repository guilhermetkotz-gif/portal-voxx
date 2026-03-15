import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function NovoPlanoModal({ open, onOpenChange, clientes, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    cliente_id: "",
    titulo_plano: "",
    objetivo_geral: "",
    descricao_resumida: "",
    data_abertura: format(new Date(), "yyyy-MM-dd"),
    observacoes: "",
    status_plano: "Aberto",
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const cliente = clientes.find((c) => c.id === data.cliente_id);
      return base44.entities.PlanoDeAcao.create({ ...data, cliente_nome: cliente?.nome || "" });
    },
    onSuccess: (plano) => {
      queryClient.invalidateQueries({ queryKey: ["planosDeAcao"] });
      onCreated(plano);
      onOpenChange(false);
      setForm({
        cliente_id: "", titulo_plano: "", objetivo_geral: "",
        descricao_resumida: "", data_abertura: format(new Date(), "yyyy-MM-dd"),
        observacoes: "", status_plano: "Aberto",
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.cliente_id || !form.titulo_plano || !form.objetivo_geral) return;
    mutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Plano de Ação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label>Cliente *</Label>
            <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Título do plano *</Label>
            <Input
              value={form.titulo_plano}
              onChange={(e) => setForm({ ...form, titulo_plano: e.target.value })}
              placeholder="Ex: Plano de otimização Meta Ads - Março"
            />
          </div>
          <div>
            <Label>Objetivo geral *</Label>
            <Textarea
              value={form.objetivo_geral}
              onChange={(e) => setForm({ ...form, objetivo_geral: e.target.value })}
              placeholder="Ex: Reduzir CPL abaixo de R$25 e aumentar volume de leads"
              rows={2}
            />
          </div>
          <div>
            <Label>Descrição resumida</Label>
            <Textarea
              value={form.descricao_resumida}
              onChange={(e) => setForm({ ...form, descricao_resumida: e.target.value })}
              placeholder="Contexto adicional do plano (opcional)"
              rows={2}
            />
          </div>
          <div>
            <Label>Data de abertura</Label>
            <Input
              type="date"
              value={form.data_abertura}
              onChange={(e) => setForm({ ...form, data_abertura: e.target.value })}
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Observações internas (opcional)"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-violet-600 hover:bg-violet-700">
              {mutation.isPending ? "Criando..." : "Criar Plano"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}