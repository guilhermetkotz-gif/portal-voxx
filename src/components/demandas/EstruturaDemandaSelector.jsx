import React from 'react';
import { Label } from '@/components/ui/label';
import { Package, Layers } from 'lucide-react';

/**
 * Seletor de estrutura da demanda (modelo híbrido).
 * Renderiza duas opções: "Uma entrega" (unitaria) e "Várias entregas independentes" (composta).
 * Controlado pela feature flag FEATURES.ITENS_DEMANDA no componente pai.
 */
export default function EstruturaDemandaSelector({ value, onChange }) {
  const options = [
    {
      value: 'unitaria',
      icon: Package,
      title: 'Uma entrega',
      description: 'Uma arte, vídeo, landing page ou outro material tratado e aprovado como uma única entrega.',
    },
    {
      value: 'composta',
      icon: Layers,
      title: 'Várias entregas independentes',
      description: 'Um cronograma, campanha ou conjunto de materiais que podem possuir prazos e etapas diferentes.',
    },
  ];

  return (
    <div className="space-y-2">
      <Label>Esta solicitação possui:</Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map(opt => {
          const Icon = opt.icon;
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`p-4 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-300'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${isSelected ? 'text-violet-600' : 'text-slate-400'}`} />
                <p className={`font-medium text-sm ${isSelected ? 'text-violet-900' : 'text-slate-800'}`}>
                  {opt.title}
                </p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{opt.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}