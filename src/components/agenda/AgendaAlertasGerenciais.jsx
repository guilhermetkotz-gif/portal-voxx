import React from 'react';
import { AlertTriangle, Clock, FileX, CheckCircle2, Zap } from 'lucide-react';
import { startOfWeek, endOfWeek, isWithinInterval, parseISO, isBefore, isToday, startOfDay } from 'date-fns';

function hasRegistro(r) {
  return !!(r.summary || r.discussion_points || r.pending_items || r.next_steps);
}

const NIVEL_CONFIG = {
  critico: { label: 'Crítico', border: 'border-red-200 bg-red-50', icon: 'text-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  atencao: { label: 'Atenção', border: 'border-amber-200 bg-amber-50', icon: 'text-amber-500', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  ok:      { label: 'OK',      border: 'border-green-200 bg-green-50', icon: 'text-green-500', text: 'text-green-700', badge: 'bg-green-100 text-green-700' },
};

export default function AgendaAlertasGerenciais({ reunioes, voxxUsers }) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const todayStart = startOfDay(now);

  // Reuniões sem registro
  const semRegistro = reunioes.filter(r => r.status === 'realizada' && !hasRegistro(r));

  // Follow-ups vencendo hoje ou já atrasados
  const followupsVencendo = reunioes.filter(r =>
    r.followup_date && isBefore(new Date(r.followup_date), now) && r.status === 'realizada'
  );

  // Reuniões não realizadas esta semana
  const naoRealizadasSemana = reunioes.filter(r => {
    try { return r.status === 'nao_realizada' && isWithinInterval(parseISO(r.start_datetime), { start: weekStart, end: weekEnd }); }
    catch { return false; }
  });

  // Meta do dia: reuniões hoje
  const reunioesHoje = reunioes.filter(r => {
    try { return isWithinInterval(parseISO(r.start_datetime), { start: todayStart, end: new Date(todayStart.getTime() + 86400000 - 1) }); }
    catch { return false; }
  });
  const realizadasHoje = reunioesHoje.filter(r => r.status === 'realizada').length;
  const metaDia = Math.max(reunioesHoje.length, 1);
  const progressoPct = Math.min(Math.round((realizadasHoje / metaDia) * 100), 100);

  const acoes = [];

  if (semRegistro.length > 0) {
    acoes.push({
      nivel: 'critico',
      icone: <FileX className="w-4 h-4" />,
      titulo: `${semRegistro.length} reunião${semRegistro.length > 1 ? 'ões' : ''} sem registro`,
      descricao: semRegistro.slice(0, 3).map(r => r.titulo).join(', '),
      acao: 'Registrar agora',
    });
  }

  if (followupsVencendo.length > 0) {
    acoes.push({
      nivel: 'critico',
      icone: <Clock className="w-4 h-4" />,
      titulo: `${followupsVencendo.length} follow-up${followupsVencendo.length > 1 ? 's' : ''} vencido${followupsVencendo.length > 1 ? 's' : ''}`,
      descricao: followupsVencendo.slice(0, 2).map(r => r.titulo).join(', '),
      acao: 'Resolver hoje',
    });
  }

  if (naoRealizadasSemana.length > 0) {
    acoes.push({
      nivel: 'atencao',
      icone: <AlertTriangle className="w-4 h-4" />,
      titulo: `${naoRealizadasSemana.length} não realizada${naoRealizadasSemana.length > 1 ? 's' : ''} esta semana`,
      descricao: naoRealizadasSemana.slice(0, 2).map(r => r.unidade_nome || r.titulo).join(', '),
      acao: 'Reagendar',
    });
  }

  voxxUsers.forEach(u => {
    const semanaU = reunioes.filter(r => {
      try { return r.participantes_ids?.includes(u.id) && isWithinInterval(parseISO(r.start_datetime), { start: weekStart, end: weekEnd }); }
      catch { return false; }
    });
    const total = reunioes.filter(r => r.participantes_ids?.includes(u.id));
    if (total.length > 2 && semanaU.length === 0) {
      acoes.push({
        nivel: 'atencao',
        icone: <AlertTriangle className="w-4 h-4" />,
        titulo: `${u.full_name?.split(' ')[0]} sem atividade esta semana`,
        descricao: `${total.length} reuniões no histórico`,
        acao: null,
      });
    }
  });

  return (
    <div className="space-y-4">
      {/* Meta do dia */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-violet-500" />
            Meta do dia — {realizadasHoje}/{metaDia} realizadas
          </p>
          <span className={`text-xs font-bold ${progressoPct === 100 ? 'text-green-600' : progressoPct >= 50 ? 'text-amber-600' : 'text-slate-500'}`}>
            {progressoPct}%
          </span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progressoPct === 100 ? 'bg-green-500' : progressoPct >= 50 ? 'bg-amber-500' : 'bg-violet-500'}`}
            style={{ width: `${progressoPct}%` }}
          />
        </div>
      </div>

      {/* Ações recomendadas */}
      {acoes.length === 0 ? (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-700">Ações recomendadas hoje</p>
            <p className="text-xs text-green-600">Nenhuma pendência crítica identificada ✓</p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Ações recomendadas hoje</p>
          <div className="space-y-2">
            {acoes.map((a, i) => {
              const cfg = NIVEL_CONFIG[a.nivel];
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.border}`}>
                  <div className={`shrink-0 mt-0.5 ${cfg.icon}`}>{a.icone}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-semibold ${cfg.text}`}>{a.titulo}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{a.descricao}</p>
                  </div>
                  {a.acao && (
                    <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg ${cfg.badge}`}>{a.acao}</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}