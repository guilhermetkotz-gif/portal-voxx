import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pause, Clock, User, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment-timezone';

export default function ActiveTimersPanel({ open, onClose, user }) {
  const queryClient = useQueryClient();
  const [pausando, setPausando] = useState({});
  const isAdmin = user?.role === 'admin';

  const { data: demandasComTimer = [], isLoading } = useQuery({
    queryKey: ['allActiveTimers'],
    queryFn: async () => {
      const todas = await base44.entities.Demanda.list('-updated_date', 500);
      return todas.filter(d => d.cronometros_ativos && d.cronometros_ativos.length > 0);
    },
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });

  const now = Date.now();
  const [tick, setTick] = useState(now);
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [open]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    return `${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  const handlePause = async (demandaId, usuarioId, usuarioNome) => {
    setPausando(prev => ({ ...prev, [usuarioId]: true }));
    try {
      const resp = await base44.functions.invoke('pausarCronometroUsuario', {
        demanda_id: demandaId,
        usuario_id: usuarioId
      });
      if (resp.data?.success) {
        toast.success(`Cronômetro de ${usuarioNome} pausado (${resp.data.minutos_adicionados}min)`);
        queryClient.invalidateQueries({ queryKey: ['allActiveTimers'] });
        queryClient.invalidateQueries({ queryKey: ['demandasKanban'] });
      }
    } catch (e) {
      toast.error('Erro ao pausar cronômetro');
    } finally {
      setPausando(prev => ({ ...prev, [usuarioId]: false }));
    }
  };

  if (!open) return null;

  const totalAtivos = demandasComTimer.reduce((sum, d) => sum + (d.cronometros_ativos?.length || 0), 0);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-5 py-4 z-10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-600" />
              Cronômetros Ativos
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {totalAtivos} cronômetro{totalAtivos !== 1 ? 's' : ''} rodando em {demandasComTimer.length} demanda{demandasComTimer.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : demandasComTimer.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Clock className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">Nenhum cronômetro ativo no momento</p>
            </div>
          ) : (
            demandasComTimer.map(demanda => (
              <Card key={demanda.id} className="border-violet-200 bg-violet-50/40">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs">
                      {demanda.cliente_nome}
                    </Badge>
                    <span className="text-sm font-medium text-slate-700 truncate flex-1">
                      {demanda.titulo}
                    </span>
                  </div>

                  {demanda.cronometros_ativos.map((c, i) => {
                    const segundos = c.data_inicio
                      ? Math.floor((tick - new Date(c.data_inicio).getTime()) / 1000)
                      : 0;
                    const isMe = c.usuario_id === user?.id;

                    return (
                      <div key={i} className="flex items-center justify-between py-1.5 px-2 bg-white rounded border border-violet-100 mt-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
                          <User className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
                          <span className="text-sm text-slate-700 truncate">
                            {c.usuario_nome}
                            {isMe && <span className="text-xs text-violet-500 ml-1">(você)</span>}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                          <span className="font-mono text-sm font-semibold text-violet-700 tabular-nums">
                            {formatTime(segundos)}
                          </span>
                          {isAdmin && !isMe && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0 border-yellow-300 hover:bg-yellow-50"
                              onClick={() => handlePause(demanda.id, c.usuario_id, c.usuario_nome)}
                              disabled={pausando[c.usuario_id]}
                              title={`Pausar ${c.usuario_nome}`}
                            >
                              {pausando[c.usuario_id] ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Pause className="h-3 w-3 text-yellow-600" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}