import React from 'react';
import { avaliarTriggers, calcularTemperaturaLead, calcularScorePrioridade } from '@/lib/comercial/inteligencia';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Zap, Target, TrendingUp } from 'lucide-react';

const NIVEL_CONFIG = {
  critico: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-100 text-red-700' },
  alto: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', badge: 'bg-orange-100 text-orange-700' },
  medio: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700' },
  aviso: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-700' },
  oportunidade: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
  info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700' },
  baixo: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-600' },
};

export default function InteligenciaLeadPanel({ lead, interacoes = [], onRegistrarInteracao, onTabChange }) {
  const triggers = avaliarTriggers(lead, interacoes);
  const temperatura = calcularTemperaturaLead(lead, interacoes);
  const score = calcularScorePrioridade(lead, interacoes);

  if (triggers.length === 0 && temperatura.label !== 'Quente') return null;

  const handleAcaoTrigger = (trigger) => {
    if (!trigger.acao) return;
    if (trigger.acao === 'registrar_interacao') onRegistrarInteracao?.();
    else if (trigger.acao === 'plano_acao') window.open('/PlanoDeAcao', '_blank');
    else onTabChange?.(trigger.acao);
  };

  return (
    <div className="space-y-2 p-4">
      {/* Header: temperatura + score */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">{temperatura.emoji}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${temperatura.bg} ${temperatura.border} ${temperatura.cor}`}>
              Lead {temperatura.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500">Prioridade</span>
          <div className="flex items-center gap-1">
            <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-700">{score}</span>
          </div>
        </div>
      </div>

      {/* Triggers */}
      {triggers.map((trigger, i) => {
        const config = NIVEL_CONFIG[trigger.nivel] || NIVEL_CONFIG.info;
        return (
          <div
            key={i}
            className={`flex items-start gap-3 p-3 rounded-xl border ${config.bg} ${config.border}`}
          >
            <span className="text-base flex-shrink-0 mt-0.5">{trigger.icone}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold ${config.text}`}>{trigger.titulo}</p>
              <p className={`text-xs mt-0.5 ${config.text} opacity-80`}>{trigger.descricao}</p>
            </div>
            {trigger.acao && (
              <button
                onClick={() => handleAcaoTrigger(trigger)}
                className={`text-xs font-medium px-2.5 py-1 rounded-lg border flex-shrink-0 transition-colors ${config.badge} ${config.border} hover:opacity-80`}
              >
                Agir
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}