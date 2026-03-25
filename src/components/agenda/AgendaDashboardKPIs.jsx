import React from 'react';
import { Calendar, CheckCircle, XCircle, RefreshCw, TrendingUp, FileCheck, ArrowRight } from 'lucide-react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';

function hasRegistro(r) {
  return !!(r.summary || r.discussion_points || r.pending_items || r.next_steps);
}

function hasProximoPasso(r) {
  return !!(r.next_steps && r.next_steps.trim().length > 0);
}

function MetricCard({ label, value, sub, color = 'slate', highlight = false }) {
  const colors = {
    green: 'text-green-600', red: 'text-red-500', amber: 'text-amber-500',
    violet: 'text-violet-600', blue: 'text-blue-600', slate: 'text-slate-800',
  };
  return (
    <div className={`bg-white rounded-xl border p-4 ${highlight ? 'border-violet-200 bg-violet-50/30' : 'border-slate-200'}`}>
      <p className={`text-2xl font-bold leading-none ${colors[color]}`}>{value}</p>
      <p className="text-xs text-slate-600 font-medium mt-1">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AgendaDashboardKPIs({ reunioes }) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const hoje = reunioes.filter(r => {
    try { return isWithinInterval(parseISO(r.start_datetime), { start: startOfDay(now), end: endOfDay(now) }); } catch { return false; }
  });
  const semana = reunioes.filter(r => {
    try { return isWithinInterval(parseISO(r.start_datetime), { start: weekStart, end: weekEnd }); } catch { return false; }
  });

  const realizadas = reunioes.filter(r => r.status === 'realizada');
  const naoRealizadas = reunioes.filter(r => r.status === 'nao_realizada');
  const reagendadas = reunioes.filter(r => r.status === 'reagendada');
  const agendadas = reunioes.filter(r => ['agendada', 'reagendada', 'realizada', 'nao_realizada'].includes(r.status));

  // Produção
  const taxaRealizacao = agendadas.length > 0 ? Math.round((realizadas.length / agendadas.length) * 100) : 0;

  // Qualidade
  const semRegistro = realizadas.filter(r => !hasRegistro(r));
  const comRegistro = realizadas.length - semRegistro.length;
  const taxaQualidade = realizadas.length > 0 ? Math.round((comRegistro / realizadas.length) * 100) : 0;
  const comProximoPasso = realizadas.filter(r => hasProximoPasso(r));
  const taxaProximoPasso = realizadas.length > 0 ? Math.round((comProximoPasso.length / realizadas.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Produção */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">📊 Produção — Volume</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Hoje" value={hoje.length} sub={`${hoje.filter(r => r.status === 'realizada').length} realizadas`} color="blue" />
          <MetricCard label="Esta semana" value={semana.length} sub={`${semana.filter(r => r.status === 'realizada').length} realizadas`} color="violet" />
          <MetricCard label="Realizadas" value={realizadas.length} sub={`${taxaRealizacao}% de realização`} color={taxaRealizacao >= 70 ? 'green' : taxaRealizacao >= 50 ? 'amber' : 'red'} />
          <MetricCard label="Não realizadas" value={naoRealizadas.length} sub={`${reagendadas.length} reagendadas`} color={naoRealizadas.length > 5 ? 'red' : naoRealizadas.length > 2 ? 'amber' : 'slate'} />
        </div>
      </div>

      {/* Qualidade */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">🎯 Qualidade — Registro & Follow-up</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Com registro" value={`${taxaQualidade}%`} sub={`${comRegistro} de ${realizadas.length}`} color={taxaQualidade >= 80 ? 'green' : taxaQualidade >= 50 ? 'amber' : 'red'} highlight />
          <MetricCard label="Sem registro" value={semRegistro.length} sub="reuniões realizadas" color={semRegistro.length > 3 ? 'red' : semRegistro.length > 0 ? 'amber' : 'slate'} />
          <MetricCard label="Próximo passo" value={`${taxaProximoPasso}%`} sub={`${comProximoPasso.length} com N.P. definido`} color={taxaProximoPasso >= 70 ? 'green' : taxaProximoPasso >= 40 ? 'amber' : 'red'} highlight />
          <MetricCard label="Comparecimento" value={`${taxaRealizacao}%`} sub="agendada → realizada" color={taxaRealizacao >= 70 ? 'green' : taxaRealizacao >= 50 ? 'amber' : 'red'} />
        </div>
      </div>
    </div>
  );
}