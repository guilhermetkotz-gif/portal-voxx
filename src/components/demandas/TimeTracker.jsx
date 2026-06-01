import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Play, Pause, CheckCircle2, RotateCcw, Clock } from 'lucide-react';

const TimeTracker = forwardRef(({ demandaId, onSaveTime, initialMinutes = 0, onRunningChange }, ref) => {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });
  
  const { data: demandaAtual } = useQuery({
    queryKey: ['demanda', demandaId],
    queryFn: () => base44.entities.Demanda.filter({ id: demandaId }).then(d => d[0]),
    enabled: !!demandaId,
    refetchInterval: 2000,
  });
  
  const [isRunning, setIsRunning] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(initialMinutes * 60);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const intervalRef = useRef(null);
  const autoStartedRef = useRef(false);
  
  // Notifica pai sobre mudança de estado
  useEffect(() => {
    if (onRunningChange) onRunningChange(isRunning);
  }, [isRunning]);

  // Restaurar cronômetro ativo ao montar ou quando demanda atualizar
  useEffect(() => {
    if (demandaAtual?.cronometro_ativo && demandaAtual?.cronometro_inicio) {
      const inicio = new Date(demandaAtual.cronometro_inicio).getTime();
      const agora = Date.now();
      const segundosDecorridos = Math.floor((agora - inicio) / 1000);
      
      setTotalSeconds(segundosDecorridos);
      setSessionSeconds(segundosDecorridos);
      setIsRunning(true);
    } else if (!demandaAtual?.cronometro_ativo && isRunning) {
      setIsRunning(false);
    } else if (demandaAtual && !demandaAtual?.cronometro_ativo && !isRunning && !autoStartedRef.current && user) {
      autoStartedRef.current = true;
      handleStart();
    }
  }, [demandaAtual?.cronometro_ativo, demandaAtual?.cronometro_inicio, demandaAtual?.id, user?.id]);

  // Atualiza a cada segundo
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTotalSeconds(prev => prev + 1);
        setSessionSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${minutes.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  };

  const handleStart = async () => {
    setIsRunning(true);
    try {
      await base44.entities.Demanda.update(demandaId, {
        cronometro_ativo: true,
        cronometro_inicio: new Date().toISOString(),
        cronometro_usuario_id: user?.id,
        cronometro_usuario_nome: user?.full_name || user?.email
      });
    } catch (error) {
      console.error('Erro ao ativar cronômetro:', error);
    }
  };
  
  const handleStop = async () => {
    setIsRunning(false);
    try {
      await base44.entities.Demanda.update(demandaId, {
        cronometro_ativo: false,
        cronometro_inicio: null,
        cronometro_usuario_id: null,
        cronometro_usuario_nome: null
      });
    } catch (error) {
      console.error('Erro ao pausar cronômetro:', error);
    }
  };

  const handleComplete = async () => {
    setIsRunning(false);
    const totalMinutes = Math.floor(totalSeconds / 60);
    if (onSaveTime) {
      await onSaveTime(totalMinutes);
    }
    try {
      await base44.entities.Demanda.update(demandaId, {
        cronometro_ativo: false,
        cronometro_inicio: null,
        cronometro_usuario_id: null,
        cronometro_usuario_nome: null
      });
    } catch (error) {
      console.error('Erro ao salvar tempo:', error);
    }
    setSessionSeconds(0);
  };

  const handleReset = async () => {
    setIsRunning(false);
    setTotalSeconds(0);
    setSessionSeconds(0);
    try {
      await base44.entities.Demanda.update(demandaId, {
        cronometro_ativo: false,
        cronometro_inicio: null,
        cronometro_usuario_id: null,
        cronometro_usuario_nome: null
      });
    } catch (error) {
      console.error('Erro ao resetar cronômetro:', error);
    }
  };

  // Expõe método pause para o componente pai via ref
  useImperativeHandle(ref, () => ({
    pause: handleStop
  }));

  return (
    <div className="border border-violet-200 bg-violet-50 rounded-lg px-4 py-2.5 flex items-center gap-3">
      <Clock className="w-5 h-5 text-violet-500 flex-shrink-0" />

      <div className="font-mono text-base font-semibold text-violet-800 min-w-[90px]">
        {formatTime(totalSeconds)}
      </div>

      <div className="flex-1">
        {isRunning ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-700">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> rodando
          </span>
        ) : totalSeconds > 0 ? (
          <span className="text-xs text-slate-500">pausado</span>
        ) : (
          <span className="text-xs text-slate-400">não iniciado</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button onClick={handleStart} disabled={isRunning} size="sm"
          className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700 text-white rounded">
          <Play className="w-3.5 h-3.5" />
        </Button>
        <Button onClick={handleStop} disabled={!isRunning} size="sm"
          className="h-7 w-7 p-0 bg-yellow-500 hover:bg-yellow-600 text-white rounded"
          variant={!isRunning ? 'outline' : 'default'}>
          <Pause className="w-3.5 h-3.5" />
        </Button>
        <Button onClick={handleComplete} disabled={totalSeconds === 0} size="sm"
          className="h-7 w-7 p-0 bg-violet-600 hover:bg-violet-700 text-white rounded">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </Button>
        <Button onClick={handleReset} variant="ghost" size="sm"
          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600">
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
});

export default TimeTracker;