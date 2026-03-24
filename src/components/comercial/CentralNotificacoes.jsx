import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CentralNotificacoes({ leads }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('notif_dismissed') || '[]'); } catch { return []; }
  });

  const leadsEmRisco = useMemo(() => {
    return leads.filter(l => {
      if (['fechado_ganho', 'fechado_perdido'].includes(l.etapa)) return false;
      const ref = l.ultima_interacao || l.created_date;
      if (!ref) return true;
      const dias = Math.floor((Date.now() - new Date(ref)) / (1000 * 60 * 60 * 24));
      return dias > 7;
    });
  }, [leads]);

  const notificacoes = leadsEmRisco.filter(l => !dismissed.includes(l.id));
  const count = notificacoes.length;

  const dismiss = (e, id) => {
    e.stopPropagation();
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem('notif_dismissed', JSON.stringify(next));
  };

  const dismissAll = () => {
    const ids = notificacoes.map(l => l.id);
    const next = [...dismissed, ...ids];
    setDismissed(next);
    localStorage.setItem('notif_dismissed', JSON.stringify(next));
    setOpen(false);
  };

  const navigate = useNavigate();

  return (
    <div className="relative">
      {/* Botão sino */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
          count > 0
            ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
        }`}
      >
        <Bell className={`w-4 h-4 ${count > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
        <span>Notificações</span>
        {count > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-[11px] font-bold bg-red-500 text-white rounded-full">
            {count > 9 ? '9+' : count}
          </span>
        )}
        {open ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
      </button>

      {/* Painel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-sm text-slate-800">Leads em Risco</span>
              {count > 0 && <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5">{count}</Badge>}
            </div>
            <div className="flex items-center gap-2">
              {count > 0 && (
                <button onClick={dismissAll} className="text-[11px] text-slate-400 hover:text-slate-600 underline">
                  Dispensar todos
                </button>
              )}
              <button onClick={() => setOpen(false)}>
                <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {notificacoes.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nenhum alerta no momento</p>
              </div>
            ) : (
              notificacoes.map(lead => {
                const ref = lead.ultima_interacao || lead.created_date;
                const dias = ref ? Math.floor((Date.now() - new Date(ref)) / (1000 * 60 * 60 * 24)) : null;
                return (
                  <div
                    key={lead.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-amber-50 cursor-pointer transition-colors"
                    onClick={() => { navigate(`/LeadDetalhe?id=${lead.id}`); setOpen(false); }}
                  >
                    <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{lead.nome_empresa}</p>
                      <p className="text-xs text-slate-500">
                        {lead.ultima_interacao
                          ? `Sem contato há ${dias} dias`
                          : 'Nunca foi contatado'}
                      </p>
                      <p className="text-[11px] text-slate-400 capitalize mt-0.5">
                        {lead.etapa?.replace(/_/g, ' ')}
                        {lead.fit_classificacao === 'alto_fit' && (
                          <span className="ml-1 text-emerald-600 font-semibold">· Alto Fit</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={(e) => dismiss(e, lead.id)}
                      className="text-slate-300 hover:text-slate-500 flex-shrink-0 mt-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {count > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 rounded-b-xl">
              <p className="text-[11px] text-slate-400 text-center">
                Clique em um lead para ver detalhes e registrar contato
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}