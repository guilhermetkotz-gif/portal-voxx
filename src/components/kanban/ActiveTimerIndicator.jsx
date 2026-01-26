import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ActiveTimerIndicator({ cronometro_inicio, cronometro_usuario_nome }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!cronometro_inicio) return;

    const updateElapsed = () => {
      const start = new Date(cronometro_inicio).getTime();
      const now = Date.now();
      const seconds = Math.floor((now - start) / 1000);
      setElapsed(seconds);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [cronometro_inicio]);

  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2 py-1 rounded">
      <Clock className="h-3 w-3 animate-pulse" />
      <span className="text-xs font-mono font-semibold">{formatTime(elapsed)}</span>
      {cronometro_usuario_nome && (
        <span className="text-xs text-green-700">• {cronometro_usuario_nome}</span>
      )}
    </div>
  );
}