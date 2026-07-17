import React from 'react';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle, AlertCircle, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function IndicadoresCards({ orientacoes = [] }) {
  const ativas = orientacoes.filter(o => o.ativa).length;
  const inativas = orientacoes.filter(o => !o.ativa).length;
  const obrigatorias = orientacoes.filter(o => o.obrigatoria).length;
  const exigemVerificacao = orientacoes.filter(o => o.exige_verificacao).length;
  const substituidas = orientacoes.filter(o => o.substituiu_orientacao_id).length;

  const cards = [
    { label: 'Ativas', value: ativas, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Inativas', value: inativas, icon: XCircle, color: 'text-slate-500', bg: 'bg-slate-50' },
    { label: 'Obrigatórias', value: obrigatorias, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Exigem verificação', value: exigemVerificacao, icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Substituídas', value: substituidas, icon: AlertTriangle, color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', c.bg)}>
              <Icon className={cn('w-5 h-5', c.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-slate-900 leading-none">{c.value}</p>
              <p className="text-xs text-slate-500 mt-1 truncate">{c.label}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}