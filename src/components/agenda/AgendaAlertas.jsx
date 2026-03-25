import React, { useState, useMemo } from 'react';
import { parseISO, isPast, isToday, isTomorrow, addHours } from 'date-fns';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Clock, CheckCircle, Calendar, ChevronDown, ChevronUp, X } from 'lucide-react';

function hasRegistro(r) {
  return !!(r.summary || r.discussion_points || r.pending_items || r.next_steps);
}

function calcAlertas(reunioes) {
  const now = new Date();
  const alertas = [];

  reunioes.forEach(r => {
    const start = parseISO(r.start_datetime);
    const end = parseISO(r.end_datetime);

    // Reunião passada sem atualização de status (ainda "agendada")
    if (r.status === 'agendada' && isPast(end)) {
      alertas.push({
        tipo: 'sem_atualizacao',
        cor: 'red',
        icone: '🔴',
        titulo: 'Reunião sem atualização',
        descricao: `"${r.titulo}" (${r.unidade_nome}) — ${format(start, "dd/MM 'às' HH:mm", { locale: ptBR })}`,
        reuniao: r,
      });
    }

    // Realizada sem registro
    if (r.status === 'realizada' && !hasRegistro(r)) {
      alertas.push({
        tipo: 'sem_registro',
        cor: 'red',
        icone: '🔴',
        titulo: 'Realizada sem registro',
        descricao: `"${r.titulo}" (${r.unidade_nome}) — preencha o registro`,
        reuniao: r,
      });
    }

    // Follow-up pendente (data passou e não foi registrado como resolvido)
    if (r.followup_date && r.followup_owner_id) {
      const followupDate = new Date(r.followup_date + 'T23:59:59');
      if (isPast(followupDate) && r.status !== 'cancelada') {
        alertas.push({
          tipo: 'followup_pendente',
          cor: 'orange',
          icone: '🟠',
          titulo: 'Follow-up pendente',
          descricao: `"${r.titulo}" — Responsável: ${r.followup_owner_nome} (${r.followup_date})`,
          reuniao: r,
        });
      }
    }

    // Reunião hoje
    if (r.status === 'agendada' && isToday(start)) {
      alertas.push({
        tipo: 'hoje',
        cor: 'blue',
        icone: '⏰',
        titulo: 'Reunião hoje',
        descricao: `"${r.titulo}" (${r.unidade_nome}) às ${format(start, 'HH:mm')}`,
        reuniao: r,
      });
    }

    // Reunião amanhã
    if (r.status === 'agendada' && isTomorrow(start)) {
      alertas.push({
        tipo: 'amanha',
        cor: 'yellow',
        icone: '🟡',
        titulo: 'Reunião amanhã',
        descricao: `"${r.titulo}" (${r.unidade_nome}) às ${format(start, 'HH:mm')}`,
        reuniao: r,
      });
    }
  });

  return alertas;
}

const COR_CONFIG = {
  red:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700' },
};

export default function AgendaAlertas({ reunioes, onClickReuniao }) {
  const [expanded, setExpanded] = useState(true);
  const alertas = useMemo(() => calcAlertas(reunioes), [reunioes]);

  if (alertas.length === 0) return null;

  const criticos = alertas.filter(a => a.cor === 'red').length;
  const pendentes = alertas.filter(a => a.cor === 'orange').length;

  return (
    <div className="mx-4 lg:mx-8 mt-3 border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 text-white"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold">Alertas Operacionais</span>
          <div className="flex gap-2">
            {criticos > 0 && (
              <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">{criticos} crítico{criticos > 1 ? 's' : ''}</span>
            )}
            {pendentes > 0 && (
              <span className="text-[10px] bg-orange-400 text-white px-2 py-0.5 rounded-full font-bold">{pendentes} pendente{pendentes > 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="bg-white divide-y divide-slate-100">
          {alertas.map((a, i) => {
            const cfg = COR_CONFIG[a.cor];
            return (
              <button
                key={i}
                onClick={() => onClickReuniao(a.reuniao)}
                className={`w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors`}
              >
                <span className="text-base shrink-0">{a.icone}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${cfg.text}`}>{a.titulo}</p>
                  <p className="text-xs text-slate-500 truncate">{a.descricao}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}