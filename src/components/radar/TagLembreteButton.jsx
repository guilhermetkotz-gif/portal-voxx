import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, XCircle, Bell, Loader2 } from 'lucide-react';
import moment from 'moment';
import 'moment-timezone';
import { toast } from 'sonner';

const TZ = 'America/Sao_Paulo';

const OPCOES_TEMPO = [
  { label: '1h', horas: 1 },
  { label: '2h', horas: 2 },
  { label: '3h', horas: 3 },
  { label: '4h', horas: 4 },
  { label: '5h', horas: 5 },
  { label: '6h', horas: 6 },
  { label: '1d', horas: 24 },
  { label: '2d', horas: 48 },
];

export default function TagLembreteButton({ grupoId, grupoNome, clienteId, clienteNome }) {
  const queryClient = useQueryClient();
  const [menuAberto, setMenuAberto] = useState(false);
  const [processando, setProcessando] = useState(false);

  const { data: tagAtiva, isLoading } = useQuery({
    queryKey: ['tagConversa', grupoId],
    queryFn: async () => {
      const tags = await base44.entities.TagConversa.filter({
        grupo_id: grupoId,
        status: 'ativa',
      }, '-created_date', 1);
      return tags[0] || null;
    },
    enabled: !!grupoId,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });

  const handleCriarTag = async (horas) => {
    if (!grupoId || processando) return;
    setProcessando(true);
    setMenuAberto(false);

    try {
      const user = await base44.auth.me();
      const dataLembrete = moment().tz(TZ).add(horas, 'hours').utc().format();

      await base44.entities.TagConversa.create({
        grupo_id: grupoId,
        grupo_nome: grupoNome || '',
        cliente_id: clienteId || '',
        cliente_nome: clienteNome || '',
        tag_nome: 'AGUARD. RETORNO',
        status: 'ativa',
        data_lembrete: dataLembrete,
        usuario_criador_nome: user?.full_name || 'Sistema',
        usuario_criador_id: user?.id || '',
      });

      queryClient.invalidateQueries({ queryKey: ['tagConversa', grupoId] });
      toast.success('Tag "AGUARD. RETORNO" criada');
    } catch (e) {
      toast.error('Erro ao criar tag');
    } finally {
      setProcessando(false);
    }
  };

  const handleConcluir = async () => {
    if (!tagAtiva || processando) return;
    setProcessando(true);
    try {
      await base44.entities.TagConversa.update(tagAtiva.id, { status: 'concluida' });
      queryClient.invalidateQueries({ queryKey: ['tagConversa', grupoId] });
      toast.success('Tag concluída');
    } catch (e) {
      toast.error('Erro ao concluir tag');
    } finally {
      setProcessando(false);
    }
  };

  const handleCancelar = async () => {
    if (!tagAtiva || processando) return;
    setProcessando(true);
    try {
      await base44.entities.TagConversa.update(tagAtiva.id, { status: 'cancelada' });
      queryClient.invalidateQueries({ queryKey: ['tagConversa', grupoId] });
      toast.success('Tag removida');
    } catch (e) {
      toast.error('Erro ao remover tag');
    } finally {
      setProcessando(false);
    }
  };

  if (isLoading) return null;

  // Tag ativa → mostrar status com opções de concluir/cancelar
  if (tagAtiva) {
    const dataLembrete = tagAtiva.data_lembrete
      ? moment.utc(tagAtiva.data_lembrete).tz(TZ).format('DD/MM HH:mm')
      : '—';

    return (
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          disabled={processando}
          onClick={() => setMenuAberto(!menuAberto)}
          className="h-7 px-2.5 text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 rounded-lg gap-1.5"
        >
          {processando ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Bell className="w-3 h-3" />
          )}
          AGUARD. RETORNO
        </Button>

        {menuAberto && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
            <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-3">
              <p className="text-xs text-slate-400 mb-1">Lembrete: {dataLembrete}</p>
              <p className="text-xs text-slate-500 mb-3">por {tagAtiva.usuario_criador_nome || 'Sistema'}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleConcluir}
                  className="flex-1 h-8 text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Concluir
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelar}
                  className="flex-1 h-8 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Excluir
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Sem tag → botão para criar
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        disabled={processando}
        onClick={() => setMenuAberto(!menuAberto)}
        className="h-7 px-2.5 text-[11px] text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg gap-1.5"
      >
        {processando ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Clock className="w-3 h-3" />
        )}
        AGUARD. RETORNO
      </Button>

      {menuAberto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-2">
            <p className="text-[10px] text-slate-500 px-2 mb-1.5">Lembrete em:</p>
            <div className="grid grid-cols-4 gap-1">
              {OPCOES_TEMPO.map(op => (
                <button
                  key={op.label}
                  onClick={() => handleCriarTag(op.horas)}
                  className="px-2 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}