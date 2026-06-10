import React from 'react';
import { Layers, Clock, AlertTriangle, CalendarX, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

const SETOR_LABELS = {
  ATENDIMENTO: 'Atend.',
  TRAFEGO_META: 'Meta',
  TRAFEGO_GOOGLE: 'Google',
  TRAFEGO_TIKTOK: 'TikTok',
  ALTERACAO_CRIACAO: 'Alt.Criação',
  CRIACAO: 'Criação',
  EDICAO: 'Edição',
  BI_RELATORIO: 'BI',
  IMPLANTACAO: 'Implant.',
  FINANCEIRO: 'Financeiro',
  AUTOMACAO: 'Automação',
  SALDOS: 'Saldos',
  sem_setor: 'Sem Setor',
};

function Badge({ icon: Icon, label, value, variant = 'default' }) {
  const styles = {
    primary: 'bg-violet-50 text-violet-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    default: 'bg-slate-50 text-slate-600',
  };

  return (
    <div className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium', styles[variant])}>
      {Icon && <Icon className="w-3 h-3" />}
      <span className="tabular-nums">{value}</span>
      <span className="text-slate-400 font-normal">{label}</span>
    </div>
  );
}

export default function KanbanKPIs({ data }) {
  if (!data) return null;

  const setores = data.vencidasPorSetor || [];

  return (
    <div className="flex items-center gap-1.5 mb-3 flex-wrap">
      <Badge icon={Layers} label="ativas" value={data.totalAtivas} variant="primary" />
      <Badge icon={Clock} label="aguard. aprov." value={data.aguardandoAprovacao} variant="warning" />
      <Badge icon={AlertTriangle} label="alertas" value={data.demandasComAlertas} variant="danger" />
      <Badge icon={Gauge} label="+48h paradas" value={data.semMovimentacao} variant="warning" />
      <Badge icon={CalendarX} label="vencidas" value={data.vencidas} variant="danger" />

      {setores.length > 0 && (
        <span className="text-slate-300 mx-1 text-xs">|</span>
      )}

      {setores.map(({ setor, qtd }) => (
        <Badge
          key={setor}
          icon={CalendarX}
          label={`venc. ${SETOR_LABELS[setor] || setor}`}
          value={qtd}
          variant="danger"
        />
      ))}
    </div>
  );
}