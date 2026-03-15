import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight, CheckCircle2, Clock, AlertTriangle, ListTodo } from "lucide-react";
import { calcularIndicadorPrazo } from "./PrazoIndicador";
import { cn } from "@/lib/utils";

const statusPlanoColor = {
  "Aberto": "bg-blue-100 text-blue-700",
  "Em andamento": "bg-yellow-100 text-yellow-700",
  "Concluído": "bg-green-100 text-green-700",
  "Arquivado": "bg-slate-100 text-slate-500",
};

export default function PlanoListagem({ planos, itensPorPlano, onVerPlano }) {
  if (planos.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="text-lg font-medium">Nenhum plano encontrado</p>
        <p className="text-sm mt-1">Crie o primeiro plano de ação clicando em "Novo Plano"</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {planos.map((plano) => {
        const itens = itensPorPlano[plano.id] || [];
        const concluidas = itens.filter((i) => i.status_acao === "Concluída").length;
        const emAndamento = itens.filter((i) => i.status_acao === "Em andamento").length;
        const atraso = itens.filter((i) => calcularIndicadorPrazo(i.prazo, i.status_acao) === "atraso").length;
        const total = itens.length;

        return (
          <Card key={plano.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onVerPlano(plano)}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-slate-900 text-sm">{plano.cliente_nome}</span>
                    <Badge className={cn("text-xs", statusPlanoColor[plano.status_plano])}>
                      {plano.status_plano}
                    </Badge>
                  </div>
                  <p className="font-medium text-slate-800">{plano.titulo_plano}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{plano.objetivo_geral}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 flex-wrap">
                    <span>📅 {plano.data_abertura ? format(parseISO(plano.data_abertura), "dd/MM/yyyy", { locale: ptBR }) : "—"}</span>
                    <span className="flex items-center gap-1"><ListTodo className="w-3 h-3" /> {total} ações</span>
                    {emAndamento > 0 && <span className="flex items-center gap-1 text-yellow-600"><Clock className="w-3 h-3" /> {emAndamento} em andamento</span>}
                    {concluidas > 0 && <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3 h-3" /> {concluidas} concluídas</span>}
                    {atraso > 0 && <span className="flex items-center gap-1 text-red-600"><AlertTriangle className="w-3 h-3" /> {atraso} em atraso</span>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </Button>
              </div>
              {total > 0 && (
                <div className="mt-3">
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${total > 0 ? (concluidas / total) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{concluidas}/{total} concluídas</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}