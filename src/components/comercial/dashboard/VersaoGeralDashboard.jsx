import React from 'react';
import { Card } from '@/components/ui/card';
import { Users, CheckCircle, TrendingUp, Target, Frown, DollarSign } from 'lucide-react';

export default function VersaoGeralDashboard({ leads, periodo }) {
  const ativosFiltrados = leads.filter(l => !['fechado_ganho', 'fechado_perdido'].includes(l.etapa));
  const qualificados = leads.filter(l => ['qualificado', 'proposta_enviada', 'negociacao'].includes(l.etapa));
  const emNegociacao = leads.filter(l => l.etapa === 'negociacao');
  const ganhos = leads.filter(l => l.etapa === 'fechado_ganho');
  const perdidos = leads.filter(l => l.etapa === 'fechado_perdido');
  const valorPotencial = ativosFiltrados.reduce((s, l) => s + (l.valor_estimado || 0), 0);
  const receita = ganhos.reduce((s, l) => s + (l.valor_estimado || 0), 0);

  const kpis = [
    { label: 'Leads Ativos', value: ativosFiltrados.length, icon: Users, color: 'violet' },
    { label: 'Qualificados', value: qualificados.length, icon: CheckCircle, color: 'emerald' },
    { label: 'Em Negociação', value: emNegociacao.length, icon: TrendingUp, color: 'blue' },
    { label: 'Ganhos', value: ganhos.length, icon: Target, color: 'green' },
    { label: 'Perdidos', value: perdidos.length, icon: Frown, color: 'red' },
    { label: 'Valor Potencial', value: `R$ ${Math.round(valorPotencial / 1000)}k`, icon: DollarSign, color: 'amber' },
  ];

  const colorMap = {
    violet: { bg: 'bg-violet-50', text: 'text-violet-600' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
    green: { bg: 'bg-green-50', text: 'text-green-600' },
    red: { bg: 'bg-red-50', text: 'text-red-600' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-slate-900 text-sm">📊 VISÃO GERAL</h3>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          const colors = colorMap[kpi.color];
          return (
            <Card key={idx} className={`p-3 ${colors.bg} border-0`}>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${colors.text}`} />
                  <p className="text-xs text-slate-600">{kpi.label}</p>
                </div>
                <p className={`text-lg font-bold ${colors.text}`}>{kpi.value}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}