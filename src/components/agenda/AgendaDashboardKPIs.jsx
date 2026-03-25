import React from 'react';
import { Calendar, CheckCircle, XCircle, RefreshCw, TrendingUp, Clock } from 'lucide-react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';

function hasRegistro(r) {
  return !!(r.summary || r.discussion_points || r.pending_items || r.next_steps);
}

function KPICard({ icon: Icon, label, value, sub, color = 'violet' }) {
  // Icon is the component passed as prop
  const colors = {
    violet: 'bg-violet-50 text-violet-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    slate: 'bg-slate-50 text-slate-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs font-medium text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AgendaDashboardKPIs({ reunioes }) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const hoje = reunioes.filter(r => {
    try { return isWithinInterval(parseISO(r.start_datetime), { start: todayStart, end: todayEnd }); } catch { return false; }
  });

  const semana = reunioes.filter(r => {
    try { return isWithinInterval(parseISO(r.start_datetime), { start: weekStart, end: weekEnd }); } catch { return false; }
  });

  const realizadas = reunioes.filter(r => r.status === 'realizada');
  const naoRealizadas = reunioes.filter(r => r.status === 'nao_realizada');
  const reagendadas = reunioes.filter(r => r.status === 'reagendada');
  const agendadas = reunioes.filter(r => ['agendada', 'reagendada', 'realizada', 'nao_realizada'].includes(r.status));
  const taxa = agendadas.length > 0 ? Math.round((realizadas.length / agendadas.length) * 100) : 0;
  const semRegistro = realizadas.filter(r => !hasRegistro(r));
  const qualidade = realizadas.length > 0 ? Math.round(((realizadas.length - semRegistro.length) / realizadas.length) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
      <div className="col-span-2 md:col-span-2 lg:col-span-2">
        <KPICard icon={Calendar} label="Hoje" value={hoje.length} sub={`${hoje.filter(r => r.status === 'realizada').length} realizadas`} color="blue" />
      </div>
      <div className="col-span-2 md:col-span-2 lg:col-span-2">
        <KPICard icon={Clock} label="Semana" value={semana.length} sub={`${semana.filter(r => r.status === 'realizada').length} realizadas`} color="violet" />
      </div>
      <div className="col-span-1 md:col-span-1 lg:col-span-1">
        <KPICard icon={CheckCircle} label="Realizadas" value={realizadas.length} color="green" />
      </div>
      <div className="col-span-1 md:col-span-1 lg:col-span-1">
        <KPICard icon={XCircle} label="Não realizadas" value={naoRealizadas.length} color="red" />
      </div>
      <div className="col-span-1 md:col-span-1 lg:col-span-1">
        <KPICard icon={RefreshCw} label="Reagendadas" value={reagendadas.length} color="amber" />
      </div>
      <div className="col-span-1 md:col-span-1 lg:col-span-1">
        <KPICard icon={TrendingUp} label="Taxa realização" value={`${taxa}%`} sub={`Qualidade: ${qualidade}%`} color={taxa >= 70 ? 'green' : taxa >= 50 ? 'amber' : 'red'} />
      </div>
    </div>
  );
}