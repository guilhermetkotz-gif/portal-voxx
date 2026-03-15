import { Badge } from "@/components/ui/badge";
import { differenceInDays, parseISO } from "date-fns";

export function calcularIndicadorPrazo(prazo, status) {
  if (status === "Concluída") return "concluida";
  if (!prazo) return "sem_prazo";
  const hoje = new Date();
  const dataPrazo = parseISO(prazo);
  const diff = differenceInDays(dataPrazo, hoje);
  if (diff < 0) return "atraso";
  if (diff <= 3) return "a_vencer";
  return "ok";
}

const config = {
  concluida: { label: "Concluída", className: "bg-green-100 text-green-700 border-green-200" },
  ok: { label: "Prazo OK", className: "bg-blue-100 text-blue-700 border-blue-200" },
  a_vencer: { label: "A vencer", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  atraso: { label: "Em atraso", className: "bg-red-100 text-red-700 border-red-200" },
  sem_prazo: { label: "Sem prazo", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

export default function PrazoIndicador({ prazo, status }) {
  const indicador = calcularIndicadorPrazo(prazo, status);
  const { label, className } = config[indicador];
  return (
    <Badge variant="outline" className={`text-xs font-medium ${className}`}>
      {label}
    </Badge>
  );
}