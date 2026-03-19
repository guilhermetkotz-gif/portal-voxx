import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

const CRITERIOS = [
  { key: 'potencial_ticket', label: 'Potencial de Ticket', desc: '0 = baixo | 10 = muito alto' },
  { key: 'segmento_score', label: 'Segmento do Cliente', desc: '0 = fora do perfil | 10 = perfil ideal' },
  { key: 'maturidade_marketing', label: 'Maturidade em Marketing', desc: '0 = nenhuma | 10 = muito avançada' },
  { key: 'estrutura_operacional', label: 'Estrutura Operacional', desc: '0 = fraca | 10 = muito estruturada' },
  { key: 'urgencia_contratacao', label: 'Urgência de Contratação', desc: '0 = sem urgência | 10 = imediato' },
];

export function calcularFitScore(qualificacao = {}) {
  const valores = CRITERIOS.map(c => Number(qualificacao[c.key] || 0));
  const total = valores.reduce((a, b) => a + b, 0);
  const score = Math.round((total / (CRITERIOS.length * 10)) * 100);
  const classificacao = score >= 70 ? 'alto_fit' : score >= 40 ? 'medio_fit' : 'baixo_fit';
  return { score, classificacao };
}

export function FitScoreDisplay({ score, classificacao, size = 'md' }) {
  const cor = classificacao === 'alto_fit' ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : classificacao === 'medio_fit' ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-red-600 bg-red-50 border-red-200';
  const label = classificacao === 'alto_fit' ? 'Alto Fit' : classificacao === 'medio_fit' ? 'Médio Fit' : 'Baixo Fit';
  const textSize = size === 'sm' ? 'text-sm' : 'text-lg';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-semibold ${cor} ${textSize}`}>
      <span>{score}</span>
      <span className="text-xs font-medium opacity-80">{label}</span>
    </span>
  );
}

export default function FitScoreCalculator({ qualificacao = {}, onChange }) {
  const handleChange = (key, value) => {
    const updated = { ...qualificacao, [key]: value };
    onChange(updated);
  };

  const { score, classificacao } = calcularFitScore(qualificacao);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">Pontuação calculada:</p>
        <FitScoreDisplay score={score} classificacao={classificacao} />
      </div>
      {CRITERIOS.map(c => (
        <div key={c.key} className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Label className="text-sm">{c.label}</Label>
            <span className="text-sm font-bold text-slate-700">{qualificacao[c.key] || 0}/10</span>
          </div>
          <p className="text-xs text-slate-400">{c.desc}</p>
          <Slider
            min={0}
            max={10}
            step={1}
            value={[Number(qualificacao[c.key] || 0)]}
            onValueChange={([v]) => handleChange(c.key, v)}
            className="w-full"
          />
        </div>
      ))}
    </div>
  );
}