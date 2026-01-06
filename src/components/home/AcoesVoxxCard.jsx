import React from 'react';
import { Card } from "@/components/ui/card";
import { Zap, TrendingUp, Target, Pause, BarChart3, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const tipoIcons = {
  otimizacao: TrendingUp,
  teste_criativo: Lightbulb,
  ajuste_segmentacao: Target,
  pausa_anuncio: Pause,
  analise: BarChart3,
  recomendacao: Zap
};

const plataformaBadge = {
  meta: "bg-blue-100 text-blue-700",
  google: "bg-red-100 text-red-700",
  tiktok: "bg-slate-900 text-white",
  geral: "bg-slate-100 text-slate-700"
};

export default function AcoesVoxxCard({ acoes = [] }) {
  if (acoes.length === 0) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-violet-100 rounded-lg">
            <Zap className="w-4 h-4 text-violet-600" />
          </div>
          <h3 className="font-semibold text-slate-900">O que a Voxx fez por você</h3>
        </div>
        <p className="text-sm text-slate-500 text-center py-6">
          Ações e otimizações realizadas aparecerão aqui.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-violet-100 rounded-lg">
          <Zap className="w-4 h-4 text-violet-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">O que a Voxx fez por você</h3>
          <p className="text-xs text-slate-500">Últimas ações e otimizações</p>
        </div>
      </div>

      <div className="space-y-3">
        {acoes.slice(0, 5).map((acao) => {
          const Icon = tipoIcons[acao.tipo] || Zap;
          return (
            <div 
              key={acao.id}
              className="flex gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
            >
              <div className="p-2 bg-white rounded-lg border border-slate-200 h-fit">
                <Icon className="w-4 h-4 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{acao.titulo}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${plataformaBadge[acao.plataforma]}`}>
                    {acao.plataforma?.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{acao.descricao}</p>
                {acao.impacto && (
                  <p className="text-xs text-emerald-600 mt-1 font-medium">↑ {acao.impacto}</p>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  {format(new Date(acao.data_acao || acao.created_date), "dd 'de' MMM", { locale: ptBR })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}