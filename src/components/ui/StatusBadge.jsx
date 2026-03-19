import React from 'react';
import { cn } from "@/lib/utils";

const statusConfig = {
  recebida: { label: "Recebida", color: "bg-blue-100 text-blue-700 border-blue-200" },
  em_triagem: { label: "Em Triagem", color: "bg-slate-100 text-slate-700 border-slate-200" },
  em_execucao: { label: "Em Execução", color: "bg-violet-100 text-violet-700 border-violet-200" },
  aguardando_cliente: { label: "Aguardando Cliente", color: "bg-amber-100 text-amber-700 border-amber-200" },
  em_revisao: { label: "Em Revisão", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  concluida: { label: "Concluída", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  finalizada: { label: "Finalizada", color: "bg-slate-200 text-slate-700 border-slate-300" }
};

const prioridadeConfig = {
  alta: { label: "Alta", color: "bg-red-100 text-red-700 border-red-200" },
  media: { label: "Média", color: "bg-amber-100 text-amber-700 border-amber-200" },
  baixa: { label: "Baixa", color: "bg-slate-100 text-slate-600 border-slate-200" }
};

const setorConfig = {
  ATENDIMENTO: { label: "Atendimento", color: "bg-cyan-100 text-cyan-700" },
  TRAFEGO_META: { label: "Tráfego Meta", color: "bg-blue-100 text-blue-700" },
  TRAFEGO_GOOGLE: { label: "Tráfego Google", color: "bg-red-100 text-red-700" },
  TRAFEGO_TIKTOK: { label: "Tráfego TikTok", color: "bg-slate-900 text-white" },
  ALTERACAO_CRIACAO: { label: "Alteração Criação", color: "bg-fuchsia-100 text-fuchsia-700" },
  CRIACAO: { label: "Criação", color: "bg-pink-100 text-pink-700" },
  EDICAO: { label: "Edição", color: "bg-purple-100 text-purple-700" },
  BI_RELATORIO: { label: "BI / Relatório", color: "bg-emerald-100 text-emerald-700" },
  IMPLANTACAO: { label: "Implantação", color: "bg-orange-100 text-orange-700" },
  FINANCEIRO: { label: "Financeiro", color: "bg-lime-100 text-lime-700" },
  AUTOMACAO: { label: "Automação", color: "bg-indigo-100 text-indigo-700" },
  SALDOS: { label: "Saldos", color: "bg-yellow-100 text-yellow-700" }
};

export default function StatusBadge({ type = "status", value, size = "sm", className }) {
  if (!value) return null;
  
  const config = type === "status" ? statusConfig : type === "prioridade" ? prioridadeConfig : setorConfig;
  const item = config[value] || { label: String(value).replace(/_/g, ' '), color: "bg-slate-100 text-slate-600 border-slate-200" };
  
  const sizeStyles = {
    xs: "text-[10px] px-1.5 py-0.5",
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5"
  };

  return (
    <span className={cn(
      "inline-flex items-center font-medium rounded-full border",
      item.color,
      sizeStyles[size],
      className
    )}>
      {item.label}
    </span>
  );
}