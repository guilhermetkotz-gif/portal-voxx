import React from 'react';
import { Card } from '@/components/ui/card';
import { Layers, Clock, AlertTriangle, CalendarX, MessageSquareWarning, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

function MiniKPICard({ title, value, subtitle, icon: Icon, variant = 'default' }) {
  const iconStyles = {
    default: 'bg-slate-100 text-slate-600',
    success: 'bg-emerald-100 text-emerald-600',
    warning: 'bg-amber-100 text-amber-600',
    danger: 'bg-red-100 text-red-600',
    primary: 'bg-violet-100 text-violet-600',
  };

  const bgStyles = {
    default: 'bg-white border-slate-200',
    success: 'bg-emerald-50/50 border-emerald-200',
    warning: 'bg-amber-50/50 border-amber-200',
    danger: 'bg-red-50/50 border-red-200',
    primary: 'bg-violet-50/50 border-violet-200',
  };

  return (
    <Card className={cn('p-3 border', bgStyles[variant])}>
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className={cn('p-1.5 rounded-lg', iconStyles[variant])}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide leading-tight">{title}</p>
          <p className="text-lg font-bold text-slate-900 leading-tight">{value}</p>
          {subtitle && <p className="text-[10px] text-slate-400 leading-tight truncate">{subtitle}</p>}
        </div>
      </div>
    </Card>
  );
}

export default function KanbanKPIs({ data }) {
  if (!data) return null;

  const setoresEntries = Object.entries(data.vencidasPorSetor || {});
  const setor1 = setoresEntries[0];
  const setor2 = setoresEntries[1];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 mb-4">
      <MiniKPICard
        title="Ativas"
        value={data.totalAtivas}
        subtitle={`de ${data.totalDemandas} total`}
        icon={Layers}
        variant="primary"
      />
      <MiniKPICard
        title="Aguard. Aprov."
        value={data.aguardandoAprovacao}
        subtitle={data.aguardandoCliente > 0 ? `${data.aguardandoCliente} ag. cliente` : null}
        icon={Clock}
        variant="warning"
      />
      <MiniKPICard
        title="Com Alertas"
        value={data.demandasComAlertas}
        subtitle="Intervenção"
        icon={AlertTriangle}
        variant="danger"
      />
      <MiniKPICard
        title="Sem Movim."
        value={data.semMovimentacao}
        subtitle="+48h inativas"
        icon={Gauge}
        variant="warning"
      />
      <MiniKPICard
        title="Vencidas"
        value={data.vencidas}
        subtitle="Prazo expirado"
        icon={CalendarX}
        variant="danger"
      />
      <MiniKPICard
        title={`Atraso: ${setor1?.[0] ?? '-'}`}
        value={setor1?.[1] ?? 0}
        subtitle="Vencidas"
        icon={MessageSquareWarning}
        variant="danger"
      />
      <MiniKPICard
        title={`Atraso: ${setor2?.[0] ?? '-'}`}
        value={setor2?.[1] ?? 0}
        subtitle="Vencidas"
        icon={MessageSquareWarning}
        variant="warning"
      />
    </div>
  );
}