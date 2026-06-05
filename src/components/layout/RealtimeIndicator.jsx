import React from 'react';
import { useRealtime } from '@/lib/RealtimeContext';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const CONFIG = {
  online: {
    label: 'Online em tempo real',
    icon: Wifi,
    dot: 'bg-green-500',
    text: 'text-green-400',
    pulse: true,
  },
  reconnecting: {
    label: 'Reconectando...',
    icon: RefreshCw,
    dot: 'bg-amber-500',
    text: 'text-amber-400',
    pulse: false,
    spin: true,
  },
  offline: {
    label: 'Sem conexão em tempo real',
    icon: WifiOff,
    dot: 'bg-slate-500',
    text: 'text-slate-500',
    pulse: false,
  },
  connecting: {
    label: 'Conectando...',
    icon: RefreshCw,
    dot: 'bg-slate-600',
    text: 'text-slate-500',
    pulse: false,
    spin: true,
  },
};

export default function RealtimeIndicator() {
  const { status, reconnect } = useRealtime();
  const cfg = CONFIG[status] || CONFIG.offline;
  const Icon = cfg.icon;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={status === 'offline' ? reconnect : undefined}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-800/50 transition-colors group"
          >
            {/* Dot pulsante */}
            <span className="relative flex items-center justify-center w-2 h-2">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {cfg.pulse && (
                <span className={`absolute inline-flex w-2 h-2 rounded-full ${cfg.dot} opacity-75 animate-ping`} />
              )}
            </span>
            {/* Ícone */}
            <Icon className={`w-3 h-3 ${cfg.text} ${cfg.spin ? 'animate-spin' : ''}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-slate-800 border-slate-700 text-slate-200 text-xs">
          {cfg.label}
          {status === 'offline' && <span className="block text-slate-400 mt-0.5">Clique para reconectar</span>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}