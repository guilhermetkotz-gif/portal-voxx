import React from 'react';
import { Building2, Clock } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function getSemContatoLabel(days) {
  if (days === 0) return { label: 'Hoje', cls: 'text-green-600 bg-green-50' };
  if (days === 1) return { label: 'Ontem', cls: 'text-green-600 bg-green-50' };
  if (days <= 7) return { label: `${days}d atrás`, cls: 'text-blue-600 bg-blue-50' };
  if (days <= 14) return { label: `${days}d atrás`, cls: 'text-amber-600 bg-amber-50' };
  return { label: `${days}d atrás`, cls: 'text-red-600 bg-red-50' };
}

export default function AgendaAtividadeUnidades({ reunioes }) {
  const now = new Date();
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
      const diasSemContato = ultima ? differenceInDays(now, parseISO(ultima.start_datetime)) : 999;
      return { ...u, ultima, realizadas, diasSemContato };
    })
    .sort((a, b) => b.diasSemContato - a.diasSemContato); // mais tempo sem contato primeiro

  if (unidades.length === 0) return (
    <div className="text-center py-8 text-slate-400 text-sm">Nenhuma unidade com reuniões</div>
  );

  return (
    <div className="space-y-2">
      {unidades.map((u, i) => {
        const semContato = getSemContatoLabel(u.diasSemContato);
        return (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{u.nome}</p>
              <p className="text-xs text-slate-400">{u.reunioes.length} reuniões · {u.realizadas} realizadas</p>
            </div>
            <div className="shrink-0 text-right">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${semContato.cls}`}>
                {semContato.label}
              </span>
              {u.ultima && (
                <p className="text-[10px] text-slate-400 flex items-center gap-0.5 justify-end mt-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {format(parseISO(u.ultima.start_datetime), "dd/MM", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}