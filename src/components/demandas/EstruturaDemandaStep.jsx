import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Package, Layers, AlertCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

/**
 * Etapa inicial comum — "Estrutura da solicitação".
 * Reutilizada por todos os wizards (Criação, Edição de Vídeo, Oral Sin, Universal)
 * e pelo formulário normal (via EstruturaDemandaSelector).
 *
 * Props:
 *  - onSelect: (value: 'unitaria' | 'composta') => void
 *  - onCancel: () => void
 *  - accentColor: 'violet' | 'blue' (default: violet)
 */
export default function EstruturaDemandaStep({ onSelect, onCancel, accentColor = 'violet' }) {
  const [selected, setSelected] = useState(null);

  const accentMap = {
    violet: {
      active: 'border-violet-600 bg-violet-50',
      radio: 'text-violet-600',
      icon: 'text-violet-600',
      btn: 'bg-violet-600 hover:bg-violet-700',
    },
    blue: {
      active: 'border-blue-600 bg-blue-50',
      radio: 'text-blue-600',
      icon: 'text-blue-600',
      btn: 'bg-blue-600 hover:bg-blue-700',
    },
  };
  const a = accentMap[accentColor] || accentMap.violet;

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-slate-700">Etapa Inicial: Estrutura da solicitação</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={cn("h-full transition-all duration-300", accentColor === 'blue' ? 'bg-blue-600' : 'bg-violet-600')} style={{ width: '5%' }} />
        </div>
      </div>

      <Card className="p-6 min-h-[300px]">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Estrutura da solicitação</h3>
            <p className="text-sm text-slate-500">Esta solicitação possui:</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Uma entrega */}
            <label className={cn(
              "flex flex-col gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all",
              selected === 'unitaria' ? a.active : "border-slate-200 hover:border-slate-300"
            )}>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="estrutura-demanda"
                  checked={selected === 'unitaria'}
                  onChange={() => setSelected('unitaria')}
                  className={cn("w-4 h-4", a.radio)}
                />
                <Package className={cn("w-5 h-5", a.icon)} />
                <span className="font-semibold text-slate-900">Uma entrega</span>
              </div>
              <p className="text-sm text-slate-500 pl-6">
                Uma peça, vídeo ou material tratado e aprovado como uma única entrega.
              </p>
            </label>

            {/* Várias entregas */}
            <label className={cn(
              "flex flex-col gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all",
              selected === 'composta' ? a.active : "border-slate-200 hover:border-slate-300"
            )}>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="estrutura-demanda"
                  checked={selected === 'composta'}
                  onChange={() => setSelected('composta')}
                  className={cn("w-4 h-4", a.radio)}
                />
                <Layers className={cn("w-5 h-5", a.icon)} />
                <span className="font-semibold text-slate-900">Várias entregas independentes</span>
              </div>
              <p className="text-sm text-slate-500 pl-6">
                Um cronograma, campanha ou conjunto de materiais que podem possuir formatos, prazos e etapas diferentes.
              </p>
            </label>
          </div>

          {/* Aviso sobre o que NÃO é composta */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Carrosséis com vários slides, versões da mesma peça, cortes do mesmo vídeo ou adaptações aprovadas conjuntamente
                <strong> não são</strong> entregas independentes — use "Uma entrega".
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Navegação */}
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          <ChevronLeft className="w-4 h-4 mr-2" /> Cancelar
        </Button>
        <Button
          type="button"
          onClick={() => selected && onSelect(selected)}
          disabled={!selected}
          className={cn("flex-1", a.btn)}
        >
          Continuar <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}