import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, ListTodo } from "lucide-react";
import { calcularIndicadorPrazo } from "./PrazoIndicador";

export default function PlanoDeAcaoKPIs({ planos, itens }) {
  const planosAbertos = planos.filter((p) => p.status_plano !== "Arquivado" && p.status_plano !== "Concluído").length;
  const acoesAbertas = itens.filter((i) => i.status_acao !== "Concluída").length;
  const acoesConcluidas = itens.filter((i) => i.status_acao === "Concluída").length;
  const acoesAVencer = itens.filter((i) => calcularIndicadorPrazo(i.prazo, i.status_acao) === "a_vencer").length;
  const acoesAtraso = itens.filter((i) => calcularIndicadorPrazo(i.prazo, i.status_acao) === "atraso").length;

  const kpis = [
    { label: "Planos ativos", value: planosAbertos, icon: ClipboardList, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Ações abertas", value: acoesAbertas, icon: ListTodo, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Ações concluídas", value: acoesConcluidas, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
    { label: "A vencer (≤3 dias)", value: acoesAVencer, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Em atraso", value: acoesAtraso, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {kpis.map(({ label, value, icon: Icon, color, bg }) => (
        <Card key={label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`${bg} rounded-lg p-2`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}