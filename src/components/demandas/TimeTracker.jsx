import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Play, Pause, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';

const TimeTracker = forwardRef(({ demandaId }, ref) => {
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: demandaAtual, refetch } = useQuery({
    queryKey: ['demanda', demandaId],
    queryFn: () => base44.entities.Demanda.filter({ id: demandaId }).then(d => d[0]),
    enabled: !!demandaId,
    refetchInterval: 5000,
  });

  const [nowMs, setNowMs] = useState(Date.now());
  const intervalRef = useRef(null);

  // Tick a cada segundo para atualizar exibição em tempo real
  useEffect(() => {
    intervalRef.current = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Meu cronômetro ativo
  const meuCronometro = (demandaAtual?.cronometros_ativos || []).find(c => c.usuario_id === user?.id);
  const isRunning = !!meuCronometro;

  // Auto-start: inicia automaticamente ao abrir o modal (se não houver cronômetro ativo)
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (demandaAtual && user && !meuCronometro && !autoStartedRef.current) {
      autoStartedRef.current = true;
      handleStart();
    }
  }, [demandaAtual?.id, user?.id]); // eslint-disable-line

  // Segundos decorridos desde que eu iniciei
  const mySeconds = meuCronometro?.data_inicio
    ? Math.floor((nowMs - new Date(meuCronometro.data_inicio).getTime()) / 1000)
    : 0;

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    return `${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  const handleStart = async () => {
    if (!user || isRunning) return;

    const cronometrosAtivos = demandaAtual?.cronometros_ativos || [];
    const novoCronometro = {
      usuario_id: user.id,
      usuario_nome: user.full_name || user.email,
      data_inicio: new Date().toISOString()
    };

    await base44.entities.Demanda.update(demandaId, {
      cronometros_ativos: [...cronometrosAtivos, novoCronometro]
    });
    refetch();
  };

  const handleStop = async () => {
    if (!user || !isRunning) return;

    const resp = await base44.functions.invoke('pausarCronometroUsuario', {
      demanda_id: demandaId,
      usuario_id: user.id
    });

    if (resp.data?.success) {
      if (resp.data.minutos_adicionados > 0) {
        toast.success(`${resp.data.minutos_adicionados}min registrados!`);
      }
      queryClient.invalidateQueries({ queryKey: ['demanda', demandaId] });
    }
  };

  // Expõe pause via ref para componentes pai
  useImperativeHandle(ref, () => ({ pause: handleStop }));

  const outrosCronometros = (demandaAtual?.cronometros_ativos || []).filter(c => c.usuario_id !== user?.id);

  return (
    <div className="border border-violet-200 bg-violet-50 rounded-lg px-4 py-2.5">
      <div className="flex items-center gap-3">
        <Clock className="w-5 h-5 text-violet-500 flex-shrink-0" />

        <div className="font-mono text-base font-semibold text-violet-800 min-w-[90px]">
          {formatTime(mySeconds)}
        </div>

        <div className="flex-1">
          {isRunning ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> rodando
            </span>
          ) : (
            <span className="text-xs text-slate-400">pausado</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            onClick={handleStart}
            disabled={isRunning}
            size="sm"
            className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700 text-white rounded"
          >
            <Play className="w-3.5 h-3.5" />
          </Button>
          <Button
            onClick={handleStop}
            disabled={!isRunning}
            size="sm"
            className="h-7 w-7 p-0 bg-yellow-500 hover:bg-yellow-600 text-white rounded"
          >
            <Pause className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Outros usuários trabalhando simultaneamente */}
      {outrosCronometros.length > 0 && (
        <div className="mt-2 pt-2 border-t border-violet-200">
          <div className="flex items-center gap-1.5 text-xs text-violet-600 mb-1">
            <Users className="w-3.5 h-3.5" />
            <span className="font-medium">Também trabalhando:</span>
          </div>
          {outrosCronometros.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-violet-700">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
              <span>{c.usuario_nome}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default TimeTracker;