import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const formatMinutes = (min) => {
  if (!min && min !== 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m`;
};

export default function TempoLimiteDemanda({ demanda }) {
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: configs = [] } = useQuery({
    queryKey: ['configTempoDemanda'],
    queryFn: () => base44.entities.ConfiguracaoTempoDemanda.filter({ ativo: true }),
    staleTime: 5 * 60 * 1000,
  });

  const config = React.useMemo(() => {
    if (!configs.length) return null;
    const ativas = configs.filter(c => c.ativo !== false);

    if (demanda.subcategoria) {
      const bySubcat = ativas.find(c => c.subcategoria && c.subcategoria.toLowerCase() === demanda.subcategoria.toLowerCase());
      if (bySubcat) return bySubcat;
    }
    if (demanda.setor) {
      const bySetor = ativas.find(c => c.setor_principal && c.setor_principal === demanda.setor && !c.subcategoria);
      if (bySetor) return bySetor;
    }
    if (demanda.setor_responsavel_original) {
      const byOriginal = ativas.find(c => c.setor_principal === demanda.setor_responsavel_original && !c.subcategoria);
      if (byOriginal) return byOriginal;
    }
    return null;
  }, [configs, demanda]);

  // Calcula o tempo ao vivo de todos os cronômetros ativos simultaneamente
  const liveSecondsFromAtivos = (demanda.cronometros_ativos || []).reduce((sum, c) => {
    if (!c.data_inicio) return sum;
    return sum + Math.max(0, Math.floor((nowMs - new Date(c.data_inicio).getTime()) / 1000));
  }, 0);

  const utilizado = (demanda.tempo_trabalho_minutos || 0) + Math.floor(liveSecondsFromAtivos / 60);
  const limite = config?.tempo_limite_minutos;
  const pct = limite ? Math.round((utilizado / limite) * 100) : null;
  const excedido = pct !== null && pct >= 100;
  const excesso = limite ? Math.max(0, utilizado - limite) : 0;

  const barColor = pct === null ? 'bg-slate-300'
    : pct <= 70 ? 'bg-green-500'
    : pct <= 99 ? 'bg-yellow-500'
    : 'bg-red-500';

  const ativosCount = (demanda.cronometros_ativos || []).length;

  return (
    <div className="mt-2 border border-slate-200 bg-white rounded-lg px-3 py-2 text-xs space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-slate-500 font-medium">
          <Clock className="w-3.5 h-3.5" />
          <span>Tempo da Demanda</span>
        </div>
        {ativosCount > 0 && (
          <div className="flex items-center gap-1 text-green-600 font-medium">
            <Users className="w-3 h-3" />
            <span>{ativosCount} rodando</span>
          </div>
        )}
      </div>

      {!config ? (
        <p className="text-slate-400 italic">Tempo limite não configurado para este tipo de demanda.</p>
      ) : (
        <>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={cn('h-2 rounded-full transition-all', barColor)}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span>Utilizado: <strong>{formatMinutes(utilizado)}</strong></span>
            <span className={cn('font-semibold', excedido ? 'text-red-600' : 'text-slate-500')}>
              {pct}%
            </span>
            <span>Limite: <strong>{formatMinutes(limite)}</strong></span>
          </div>

          {excedido && (
            <div className={cn(
              'flex items-start gap-1.5 rounded p-1.5',
              excesso > 0 ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
            )}>
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">
                  {excesso > 0 ? 'Tempo limite excedido.' : 'Tempo limite atingido.'}
                </p>
                {excesso > 0 && (
                  <p>Excedido em: <strong>{formatMinutes(excesso)}</strong></p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}