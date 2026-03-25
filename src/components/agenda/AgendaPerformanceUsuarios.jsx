import React from 'react';
import { Users, AlertTriangle, Trophy } from 'lucide-react';

function hasRegistro(r) {
  return !!(r.summary || r.discussion_points || r.pending_items || r.next_steps);
}

function getScoreCor(taxa) {
  if (taxa >= 80) return 'text-green-600 bg-green-50';
  if (taxa >= 50) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

export default function AgendaPerformanceUsuarios({ reunioes, voxxUsers }) {
  const stats = voxxUsers.map(u => {
    const minhas = reunioes.filter(r => r.participantes_ids?.includes(u.id));
    const realizadas = minhas.filter(r => r.status === 'realizada');
    const semReg = realizadas.filter(r => !hasRegistro(r));
    const taxa = minhas.length > 0 ? Math.round((realizadas.length / minhas.filter(r => ['agendada','reagendada','realizada','nao_realizada'].includes(r.status)).length) * 100) : 0;
    const score = realizadas.length * 15 + (realizadas.length - semReg.length) * 5
      - semReg.length * 3
      - minhas.filter(r => r.status === 'nao_realizada').length * 5;
    return { user: u, total: minhas.length, realizadas: realizadas.length, semRegistro: semReg.length, taxa: isNaN(taxa) ? 0 : taxa, score };
  }).filter(s => s.total > 0).sort((a, b) => b.realizadas - a.realizadas);

  if (stats.length === 0) return (
    <div className="text-center py-8 text-slate-400 text-sm">Nenhum dado de usuário disponível</div>
  );

  return (
    <div className="space-y-2">
      {stats.map((s, i) => (
        <div key={s.user.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
          <div className="w-7 h-7 flex items-center justify-center shrink-0">
            {i === 0 ? <span className="text-lg">🥇</span> : i === 1 ? <span className="text-lg">🥈</span> : i === 2 ? <span className="text-lg">🥉</span> : <span className="text-sm text-slate-400 font-bold">{i + 1}</span>}
          </div>
          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-violet-700">{s.user.full_name?.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{s.user.full_name}</p>
            <p className="text-xs text-slate-500">{s.total} reuniões · {s.realizadas} realizadas</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {s.semRegistro > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {s.semRegistro} sem reg.
              </span>
            )}
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${getScoreCor(s.taxa)}`}>{s.taxa}%</span>
            <span className="text-xs text-slate-400 font-medium w-16 text-right">{s.score > 0 ? '+' : ''}{s.score} pts</span>
          </div>
        </div>
      ))}
    </div>
  );
}