import React from 'react';
import { cn } from "@/lib/utils";

export default function HealthScore({ score = 0, percentil = null, size = "md", showLabel = true }) {
  const getColor = (score) => {
    if (score >= 80) return { stroke: "#10b981", bg: "bg-emerald-50", text: "text-emerald-600", label: "Excelente" };
    if (score >= 60) return { stroke: "#3b82f6", bg: "bg-blue-50", text: "text-blue-600", label: "Bom" };
    if (score >= 40) return { stroke: "#f59e0b", bg: "bg-amber-50", text: "text-amber-600", label: "Atenção" };
    return { stroke: "#ef4444", bg: "bg-red-50", text: "text-red-600", label: "Crítico" };
  };

  const config = getColor(score);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const sizes = {
    sm: { width: 80, fontSize: "text-lg", labelSize: "text-[10px]" },
    md: { width: 120, fontSize: "text-2xl", labelSize: "text-xs" },
    lg: { width: 160, fontSize: "text-4xl", labelSize: "text-sm" }
  };

  const sizeConfig = sizes[size];

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative" style={{ width: sizeConfig.width, height: sizeConfig.width }}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={config.stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {percentil !== null && percentil >= 60 ? (
            <>
              <span className={cn("font-bold text-3xl", config.text)}>
                {percentil}%
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                PERCENTIL
              </span>
            </>
          ) : (
            <span className={cn("font-bold", sizeConfig.fontSize, config.text)}>
              {score}
            </span>
          )}
        </div>
      </div>
      
      {percentil !== null && (
        <div className="mt-4 text-center px-2">
          {percentil >= 60 ? (
            <>
              <p className="text-sm font-semibold text-slate-900 mb-1">
                Esta unidade performa melhor do que {percentil}% das unidades ativas neste período.
              </p>
              <p className="text-xs text-slate-500">
                Comparativo baseado em indicadores técnicos de mídia e eficiência de campanhas.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-900 mb-1">
                Estamos trabalhando neste momento para melhorar o desempenho da sua conta.
              </p>
              <p className="text-xs text-slate-500">
                Nossa equipe já está atuando nos principais pontos de otimização.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}