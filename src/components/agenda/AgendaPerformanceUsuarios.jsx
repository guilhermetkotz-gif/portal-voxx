import React from 'react';
import { AlertTriangle, TrendingUp } from 'lucide-react';

function hasRegistro(r) {
  return !!(r.summary || r.discussion_points || r.pending_items || r.next_steps);
}

function hasProximoPasso(r) {
  return !!(r.next_steps && r.next_steps.trim().length > 0);
}

function getNivel(score, realizadas, taxa) {
  if (realizadas >= 10 && score >= 150 && taxa >= 70) return { label: 'Fechador', cls: 'bg-violet-100 text-violet-700', emoji: '🏆' };
  if (realizadas >= 5 && score >= 60 && taxa >= 50) return { label: 'Consultivo', cls: 'bg-blue-100 text-blue-700', emoji: '💼' };
  return { label: 'Operacional', cls: 'bg-slate-100 text-slate-600', emoji: '⚙️' };
}

function BarPercent({ value, color = 'violet' }) {
  const colors = { violet: 'bg-violet-500', green: 'bg-green-500', amber: 'bg-amber-500', red: 'bg-red-400' };
  const bar = color === 'violet' ? 'bg-violet-500' : value >= 70 ? 'bg-green-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-[10px] text-slate-500">{value}%</span>
    </div>
  );
}

export default function AgendaPerformanceUsuarios({ reunioes, voxxUsers }) {
  const stats = voxxUsers.map(u => {
    const minhas = reunioes.filter(r => r.participantes_ids?.includes(u.id));
    const realizadas = minhas.filter(r => r.status === 'realizada');
    const semReg = realizadas.filter(r => !hasRegistro(r));
    const comProximoPasso = realizadas.filter(r => hasProximoPasso(r));
    const agendadas = minhas.filter(r => ['agendada', 'reagendada', 'realizada', 'nao_realizada'].includes(r.status));
    const taxa = agendadas.length > 0 ? Math.round((realizadas.length / agendadas.length) * 100) : 0;
    const score = realizadas.length * 15
      + (realizadas.length - semReg.length) * 5
      - semReg.length * 3
      - minhas.filter(r => r.status === 'nao_realizada').length * 5
      + comProximoPasso.length * 3;
    return {
      user: u, total: minhas.length, realizadas: realizadas.length,
      semRegistro: semReg.length, taxa: isNaN(taxa) ? 0 : taxa, score,
      comerciais: realizadas.filter(r => r.tipo_reuniao === 'comercial').length,
      propostas: realizadas.filter(r => r.meeting_result === 'proposta_enviada' || r.meeting_result === 'avancou').length,
      fechamentos: realizadas.filter(r => r.meeting_result === 'fechado').length,
    };
  }).filter(s => s.total > 0).sort((a, b) => b.score - a.score);

  if (stats.length === 0) return (
    <div className="text-center py-8 text-slate-400 text-sm">Nenhum dado de usuário disponível</div>
  );

  const topScore = stats[0]?.score || 1;

  return (
    <div className="space-y-2">
      {stats.map((s, i) => {
        const nivel = getNivel(s.score, s.realizadas, s.taxa);
        const distanciaTop = i === 0 ? null : topScore - s.score;
        return (
          <div key={s.user.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
            {/* Posição */}
            <div className="w-7 h-7 flex items-center justify-center shrink-0">
              {i === 0 ? <span className="text-lg">🥇</span> : i === 1 ? <span className="text-lg">🥈</span> : i === 2 ? <span className="text-lg">🥉</span>
                : <span className="text-sm text-slate-400 font-bold">{i + 1}</span>}
            </div>

            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-violet-700">{s.user.full_name?.charAt(0)}</span>
            </div>

            {/* Nome + nível */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-800 truncate">{s.user.full_name}</p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${nivel.cls}`}>{nivel.emoji} {nivel.label}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-slate-500">{s.realizadas} realizadas</span>
                {s.comerciais > 0 && <span className="text-[10px] text-slate-400">💼 {s.comerciais} comercial</span>}
                {s.fechamentos > 0 && <span className="text-[10px] text-green-600 font-semibold">✓ {s.fechamentos} fechamentos</span>}
              </div>
              <BarPercent value={s.taxa} />
            </div>

            {/* Métricas */}
            <div className="flex items-center gap-2 shrink-0 text-right">
              {s.semRegistro > 0 && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {s.semRegistro}
                </span>
              )}
              <div className="text-right">
                <p className="text-sm font-bold text-violet-600">{s.score > 0 ? '+' : ''}{s.score}</p>
                {distanciaTop !== null && (
                  <p className="text-[10px] text-slate-400 flex items-center gap-0.5 justify-end">
                    <TrendingUp className="w-3 h-3" /> -{distanciaTop} p/ topo
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}