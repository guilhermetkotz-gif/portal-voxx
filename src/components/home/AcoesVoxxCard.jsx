import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, Target, Pause, BarChart3, Lightbulb, Sparkles, CheckCircle2 } from 'lucide-react';
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

export default function AcoesVoxxCard({ acoes = [], otimizacoes = [], demandasConcluidas = [] }) {
  // Combinar acoes, otimizacoes e demandas concluídas em uma lista unificada
  const todasAcoes = [
    ...acoes.map(a => ({ ...a, tipo_item: 'acao' })),
    ...otimizacoes.map(o => ({ ...o, tipo_item: 'otimizacao' })),
    ...demandasConcluidas.map(d => ({ ...d, tipo_item: 'demanda' }))
  ].sort((a, b) => {
    const dateA = new Date(a.data_acao || a.updated_date || a.created_date);
    const dateB = new Date(b.data_acao || b.updated_date || b.created_date);
    return dateB - dateA;
  }).slice(0, 5);

  if (todasAcoes.length === 0) {
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
        {todasAcoes.map((item) => {
          if (item.tipo_item === 'otimizacao') {
            return (
              <div 
                key={item.id}
                className="flex gap-3 p-3 rounded-lg bg-violet-50 border border-violet-100"
              >
                <div className="p-2 bg-white rounded-lg border border-violet-200 h-fit">
                  <Sparkles className="w-4 h-4 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-slate-900">Otimização Meta Ads</p>
                    <Badge className="bg-violet-600 text-white text-[10px]">META</Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{item.resumo_acao}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {format(new Date(item.data_acao), "dd 'de' MMM", { locale: ptBR })}
                  </p>
                </div>
              </div>
            );
          }

          if (item.tipo_item === 'demanda') {
            const setorBadgeColors = {
              TRAFEGO_META: 'bg-blue-600',
              TRAFEGO_GOOGLE: 'bg-red-600',
              TRAFEGO_TIKTOK: 'bg-slate-900',
              CRIACAO: 'bg-purple-600',
              EDICAO: 'bg-pink-600',
              BI_RELATORIO: 'bg-amber-600',
              IMPLANTACAO: 'bg-green-600',
              FINANCEIRO: 'bg-emerald-600',
              ALTERACAO_CRIACAO: 'bg-indigo-600',
              AUTOMACAO: 'bg-cyan-600',
              SALDOS: 'bg-orange-600'
            };
            
            return (
              <div 
                key={item.id}
                className="flex gap-3 p-3 rounded-lg bg-green-50 border border-green-100"
              >
                <div className="p-2 bg-white rounded-lg border border-green-200 h-fit">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-slate-900">{item.titulo}</p>
                    <Badge className={`${setorBadgeColors[item.setor] || 'bg-slate-600'} text-white text-[10px]`}>
                      {item.setor?.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{item.descricao || 'Demanda concluída'}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Concluída em {format(new Date(item.updated_date), "dd 'de' MMM", { locale: ptBR })}
                  </p>
                </div>
              </div>
            );
          }
          
          const Icon = tipoIcons[item.tipo] || Zap;
          return (
            <div 
              key={item.id}
              className="flex gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
            >
              <div className="p-2 bg-white rounded-lg border border-slate-200 h-fit">
                <Icon className="w-4 h-4 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{item.titulo}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${plataformaBadge[item.plataforma]}`}>
                    {item.plataforma?.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.descricao}</p>
                {item.impacto && (
                  <p className="text-xs text-emerald-600 mt-1 font-medium">↑ {item.impacto}</p>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  {format(new Date(item.data_acao || item.created_date), "dd 'de' MMM", { locale: ptBR })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}