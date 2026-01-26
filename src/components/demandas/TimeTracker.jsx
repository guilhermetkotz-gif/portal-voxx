import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, CheckCircle2, RotateCcw, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const TimeTracker = ({ demandaId, onSaveTime, initialMinutes = 0 }) => {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });
  const [isRunning, setIsRunning] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(initialMinutes * 60);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const intervalRef = useRef(null);

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

  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const displayMinutes = totalMinutes % 60;

  return (
    <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-violet-600" />
          Cronômetro de Trabalho
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Display Principal */}
        <div className="text-center py-6 bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg">
          <div className="text-5xl font-bold text-white font-mono tracking-tight">
            {formatTime(totalSeconds)}
          </div>
          <p className="text-violet-100 text-sm mt-2">
            {totalHours > 0 ? `${totalHours}h ${displayMinutes}m` : `${totalMinutes}m`}
          </p>
        </div>

        {/* Status */}
        <div className="flex items-center justify-center gap-2">
          {isRunning ? (
            <Badge className="bg-green-100 text-green-800 animate-pulse">
              <span className="inline-block w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse" />
              Cronômetro rodando
            </Badge>
          ) : totalSeconds > 0 ? (
            <Badge className="bg-blue-100 text-blue-800">
              <Clock className="w-3 h-3 mr-1" />
              {totalSeconds > 0 ? 'Pausado' : 'Não iniciado'}
            </Badge>
          ) : (
            <Badge variant="outline">Não iniciado</Badge>
          )}
        </div>

        {/* Controles */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={handleStart}
            disabled={isRunning}
            className="bg-green-600 hover:bg-green-700 text-white"
            size="sm"
          >
            <Play className="w-4 h-4 mr-1" />
            Iniciar
          </Button>
          <Button
            onClick={handleStop}
            disabled={!isRunning}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
            variant={!isRunning ? 'outline' : 'default'}
            size="sm"
          >
            <Pause className="w-4 h-4 mr-1" />
            Pausar
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            size="sm"
            className="text-slate-600"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
        </div>

        {/* Botão Completar */}
        <Button
          onClick={handleComplete}
          className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
          size="lg"
          disabled={totalSeconds === 0}
        >
          <CheckCircle2 className="w-5 h-5 mr-2" />
          Salvar Tempo de Trabalho
        </Button>

        {/* Info */}
        <p className="text-xs text-slate-500 text-center">
          Tempo total registrado: <span className="font-semibold text-slate-700">{totalMinutes} minutos</span>
        </p>
      </CardContent>
    </Card>
  );
};

export default TimeTracker;