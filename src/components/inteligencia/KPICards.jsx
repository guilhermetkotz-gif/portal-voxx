import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, TicketCheck, Activity, DollarSign, TrendingUp, BarChart2 } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const fmtN = (v) => new Intl.NumberFormat('pt-BR').format(v);

export default function KPICards({ kpis, loading }) {
  const cards = [
    {
      label: 'Clientes Ativos',
      value: loading ? '...' : fmtN(kpis.clientesAtivos),
      sub: 'operacionalmente no período',
      icon: Users,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      label: 'Total de Demandas',
      value: loading ? '...' : fmtN(kpis.totalDemandas),
      sub: 'demandas no período',
      icon: TicketCheck,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Participações Op.',
      value: loading ? '...' : fmtN(kpis.totalParticipacoes),
      sub: 'interações de equipe',
      icon: Activity,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Custo Op. Estimado',
      value: loading ? '...' : fmt(kpis.totalCusto),
      sub: 'estimativa operacional total',
      icon: DollarSign,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Média por Cliente',
      value: loading ? '...' : fmt(kpis.mediaPorCliente),
      sub: 'custo médio operacional',
      icon: TrendingUp,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'Custo por Demanda',
      value: loading ? '...' : fmt(kpis.custoPorDemanda),
      sub: 'custo médio por demanda',
      icon: BarChart2,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((c, i) => (
        <Card key={i} className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
              <c.icon className={`w-5 h-5 ${c.color}`} />
            </div>
            <p className="text-2xl font-bold text-slate-900 leading-tight">{c.value}</p>
            <p className="text-xs text-slate-500 mt-1 leading-snug">{c.label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{c.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}