import React from 'react';
import KPICard from '@/components/ui/KPICard';
import { Layers, Clock, AlertTriangle, CalendarX, Users, MessageSquareWarning, Gauge } from 'lucide-react';

export default function KanbanKPIs({ data }) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
      <KPICard
        title="Ativas"
        value={data.totalAtivas}
        subtitle={`de ${data.totalDemandas} total`}
        icon={Layers}
        variant="primary"
      />

      <KPICard
        title="Aguard. Aprovação"
        value={data.aguardandoAprovacao}
        subtitle={data.aguardandoCliente > 0 ? `${data.aguardandoCliente} ag. cliente` : null}
        icon={Clock}
        variant="warning"
      />

      <KPICard
        title="Com Alertas"
        value={data.demandasComAlertas}
        subtitle="Intervenção necessária"
        icon={MessageSquareWarning}
        variant="danger"
      />

      <KPICard
        title="Sem Movimentação"
        value={data.semMovimentacao}
        subtitle="+48h inativas"
        icon={Gauge}
        variant="warning"
      />

      <KPICard
        title="Vencidas"
        value={data.vencidas}
        subtitle="Prazo expirado"
        icon={CalendarX}
        variant="danger"
      />

      <KPICard
        title="Setor #1"
        value={Object.entries(data.ativasPorSetor || {})[0]?.[1] ?? 0}
        subtitle={Object.entries(data.ativasPorSetor || {})[0]?.[0] ?? '-'}
        icon={Users}
        variant="default"
      />

      <KPICard
        title="Setor #2"
        value={Object.entries(data.ativasPorSetor || {})[1]?.[1] ?? 0}
        subtitle={Object.entries(data.ativasPorSetor || {})[1]?.[0] ?? '-'}
        icon={Users}
        variant="default"
      />
    </div>
  );
}