import React from 'react';
import { Building2, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG = {
  agendada: { label: 'Agendada', cls: 'bg-blue-100 text-blue-700' },
  realizada: { label: 'Realizada', cls: 'bg-green-100 text-green-700' },
  nao_realizada: { label: 'Não realizada', cls: 'bg-red-100 text-red-700' },
  cancelada: { label: 'Cancelada', cls: 'bg-slate-100 text-slate-600' },
  reagendada: { label: 'Reagendada', cls: 'bg-amber-100 text-amber-700' },
};

export default function AgendaAtividadeUnidades({ reunioes }) {
  const byUnidade = {};
  reunioes.forEach(r => {
    if (!r.unidade_id) return;
    if (!byUnidade[r.unidade_id]) byUnidade[r.unidade_id] = { nome: r.unidade_nome || r.unidade_id, reunioes: [] };
    byUnidade[r.unidade_id].reunioes.push(r);
  });

  const unidades = Object.values(byUnidade)
    .map(u => {
      const sorted = [...u.reunioes].sort((a, b) => new Date(b.start_datetime) - new Date(a.start_datetime));
      const ultima = sorted[0];
      const realizadas = u.reunioes.filter(r => r.status === 'realizada').length;
      const lastStatus = ultima?.status;
      return { ...u, ultima, realizadas, lastStatus };
    })
    .sort((a, b) => new Date(b.ultima?.start_datetime || 0) - new Date(a.ultima?.start_datetime || 0));

  if (unidades.length === 0) return (
    <div className="text-center py-8 text-slate-400 text-sm">Nenhuma unidade com reuniões</div>
  );

  return (
    <div className="space-y-2">
      {unidades.map((u, i) => {
        const cfg = STATUS_CONFIG[u.lastStatus] || STATUS_CONFIG.agendada;
        return (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{u.nome}</p>
              <p className="text-xs text-slate-500">{u.reunioes.length} reuniões · {u.realizadas} realizadas</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-right">
              {u.ultima && (
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>{format(parseISO(u.ultima.start_datetime), "dd/MM", { locale: ptBR })}</span>
                </div>
              )}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}