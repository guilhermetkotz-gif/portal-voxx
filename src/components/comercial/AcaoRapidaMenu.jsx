import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Zap, X } from 'lucide-react';

export default function AcaoRapidaMenu({ onNovoLead, onRegistrarInteracao, onAgendarReuniao, onFollowUp }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="fixed bottom-6 right-6 z-40">
        <Button 
          onClick={() => setOpen(true)}
          className="w-14 h-14 rounded-full shadow-lg bg-violet-600 hover:bg-violet-700"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
    );
  }

  const acoes = [
    { icon: Plus, label: 'Novo Lead', action: onNovoLead },
    { icon: Zap, label: 'Registrar Interação', action: onRegistrarInteracao },
    { icon: Plus, label: 'Agendar Reunião', action: onAgendarReuniao },
    { icon: Plus, label: 'Follow-up', action: onFollowUp },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40 space-y-2">
      <div className="flex flex-col gap-2 items-end">
        {acoes.map((acao, idx) => {
          const Icon = acao.icon;
          return (
            <Card key={idx} className="p-3 bg-white shadow-lg">
              <button
                onClick={() => {
                  acao.action?.();
                  setOpen(false);
                }}
                className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-violet-600 transition-colors"
              >
                <Icon className="w-4 h-4" />
                {acao.label}
              </button>
            </Card>
          );
        })}
      </div>
      <Button 
        onClick={() => setOpen(false)}
        className="w-14 h-14 rounded-full shadow-lg bg-slate-200 hover:bg-slate-300 text-slate-700"
      >
        <X className="w-6 h-6" />
      </Button>
    </div>
  );
}