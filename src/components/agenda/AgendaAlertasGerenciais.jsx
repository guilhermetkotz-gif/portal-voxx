import React from 'react';
import { AlertTriangle, Clock, UserX, FileX } from 'lucide-react';
import { startOfWeek, endOfWeek, isWithinInterval, parseISO, isBefore } from 'date-fns';

function hasRegistro(r) {
  return !!(r.summary || r.discussion_points || r.pending_items || r.next_steps);
}

export default function AgendaAlertasGerenciais({ reunioes, voxxUsers }) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const alerts = [];

  // Reuniões realizadas sem registro
  const semRegistro = reunioes.filter(r => r.status === 'realizada' && !hasRegistro(r));
  if (semRegistro.length > 0) {
    alerts.push({
      cor: 'red', icone: <FileX className="w-4 h-4" />,
      titulo: `${semRegistro.length} reunião${semRegistro.length > 1 ? 'ões' : ''} sem registro`,
      descricao: semRegistro.slice(0, 3).map(r => r.titulo).join(', '),
    });
  }

  // Follow-ups atrasados
  const followupsAtrasados = reunioes.filter(r => r.followup_date && isBefore(new Date(r.followup_date), now) && r.status === 'realizada');
  if (followupsAtrasados.length > 0) {
    alerts.push({
      cor: 'red', icone: <Clock className="w-4 h-4" />,
      titulo: `${followupsAtrasados.length} follow-up${followupsAtrasados.length > 1 ? 's' : ''} vencido${followupsAtrasados.length > 1 ? 's' : ''}`,
      descricao: followupsAtrasados.slice(0, 2).map(r => r.titulo).join(', '),
    });
  }

  // Reuniões não realizadas esta semana
  const naoRealizadasSemana = reunioes.filter(r => {
    try { return r.status === 'nao_realizada' && isWithinInterval(parseISO(r.start_datetime), { start: weekStart, end: weekEnd }); } catch { return false; }
  });
  if (naoRealizadasSemana.length > 0) {
    alerts.push({
      cor: 'orange', icone: <AlertTriangle className="w-4 h-4" />,
      titulo: `${naoRealizadasSemana.length} não realizada${naoRealizadasSemana.length > 1 ? 's' : ''} esta semana`,
      descricao: naoRealizadasSemana.slice(0, 2).map(r => r.unidade_nome || r.titulo).join(', '),
    });
  }

  // Usuários com baixa atividade (< 1 reunião na semana)
  voxxUsers.forEach(u => {
    const semanaU = reunioes.filter(r => {
      try { return r.participantes_ids?.includes(u.id) && isWithinInterval(parseISO(r.start_datetime), { start: weekStart, end: weekEnd }); } catch { return false; }
    });
    // Só alerta se o usuário tem histórico mas sumiu esta semana
    const total = reunioes.filter(r => r.participantes_ids?.includes(u.id));
    if (total.length > 2 && semanaU.length === 0) {
      alerts.push({
        cor: 'yellow', icone: <UserX className="w-4 h-4" />,
        titulo: `${u.full_name} sem atividade esta semana`,
        descricao: `${total.length} reuniões no histórico`,
      });
    }
  });

  if (alerts.length === 0) return (
    <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
      <span className="text-2xl">✅</span>
      <div>
        <p className="text-sm font-semibold text-green-700">Tudo em ordem</p>
        <p className="text-xs text-green-600">Nenhum alerta crítico identificado</p>
      </div>
    </div>
  );

  const corMap = {
    red: 'border-red-200 bg-red-50',
    orange: 'border-orange-200 bg-orange-50',
    yellow: 'border-yellow-200 bg-yellow-50',
  };
  const textMap = { red: 'text-red-700', orange: 'text-orange-700', yellow: 'text-yellow-700' };
  const iconMap = { red: 'text-red-500', orange: 'text-orange-500', yellow: 'text-yellow-500' };

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${corMap[a.cor]}`}>
          <div className={`shrink-0 mt-0.5 ${iconMap[a.cor]}`}>{a.icone}</div>
          <div>
            <p className={`text-sm font-semibold ${textMap[a.cor]}`}>{a.titulo}</p>
            <p className="text-xs text-slate-500 truncate">{a.descricao}</p>
          </div>
        </div>
      ))}
    </div>
  );
}