import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import EventoDetalhe from './EventoDetalhe';
import NovaReuniaoModal from './NovaReuniaoModal';

const STATUS_CONFIG = {
  agendada:      { label: 'Agendada',       cls: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  realizada:     { label: 'Realizada',      cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  nao_realizada: { label: 'Não realizada',  cls: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  cancelada:     { label: 'Cancelada',      cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

const TIPOS_LABEL = {
  comercial: 'Comercial', onboarding: 'Onboarding', alinhamento: 'Alinhamento',
  resultados: 'Resultados', estrategico: 'Estratégico', operacional: 'Operacional', retencao: 'Retenção',
};

function hasRegistro(r) {
  return !!(r.summary || r.discussion_points || r.pending_items || r.next_steps);
}

export default function HistoricoReunioes({ unidadeId }) {
  const [detalhe, setDetalhe] = useState(null);
  const [editando, setEditando] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const { data: reunioes = [], isLoading, refetch } = useQuery({
    queryKey: ['reunioes_unidade', unidadeId],
    queryFn: () => base44.entities.AgendaReuniao.filter({ unidade_id: unidadeId }, '-start_datetime', 100),
    enabled: !!unidadeId,
    staleTime: 60 * 1000,
  });

  const handleEdit = () => {
    setEditando(detalhe);
    setDetalhe(null);
    setEditModalOpen(true);
  };

  if (isLoading) {
    return <div className="py-10 text-center text-slate-400 text-sm">Carregando reuniões...</div>;
  }

  if (reunioes.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Nenhuma reunião registrada para esta unidade.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {reunioes.map(r => {
          const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.agendada;
          const start = parseISO(r.start_datetime);
          const semRegistro = r.status === 'realizada' && !hasRegistro(r);

          return (
            <button
              key={r.id}
              onClick={() => setDetalhe(r)}
              className="w-full text-left flex items-center gap-3 p-3 rounded-xl border hover:shadow-sm transition-shadow bg-white"
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${sc.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm text-slate-800 truncate">{r.titulo}</p>
                  {semRegistro && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-medium shrink-0">
                      <AlertTriangle className="w-2.5 h-2.5" /> Sem registro
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {TIPOS_LABEL[r.tipo_reuniao]} · {r.participantes_nomes?.join(', ')}
                </p>
                {r.summary && <p className="text-xs text-slate-400 mt-0.5 truncate">{r.summary}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium text-slate-700">{format(start, "dd/MM/yyyy", { locale: ptBR })}</p>
                <Badge className={`text-[10px] mt-1 ${sc.cls}`}>{sc.label}</Badge>
              </div>
            </button>
          );
        })}
      </div>

      <EventoDetalhe
        reuniao={detalhe}
        open={!!detalhe}
        onClose={() => setDetalhe(null)}
        onEdit={handleEdit}
        onStatusChange={() => { refetch(); setDetalhe(null); }}
      />

      <NovaReuniaoModal
        open={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditando(null); }}
        onSaved={() => { setEditModalOpen(false); setEditando(null); refetch(); }}
        reuniao={editando}
      />
    </>
  );
}