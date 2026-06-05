import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Settings2 } from 'lucide-react';

export default function AnalisesParametrizacao({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-violet-400" />
            <h2 className="text-base font-semibold text-slate-100">Parametrização</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="py-8 text-center">
          <p className="text-slate-500 text-sm">Em breve: configuração dos pesos e critérios de análise.</p>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}