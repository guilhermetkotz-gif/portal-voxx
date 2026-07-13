import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Zap, AlertTriangle, Clock, MoonStar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import moment from 'moment';
import 'moment-timezone';

const TZ = 'America/Sao_Paulo';

const ALERT_META = {
  emergencial: { label: 'Emergencial +2h', icon: Zap, color: 'text-red-400' },
  critico:     { label: 'Crítico +1h', icon: AlertTriangle, color: 'text-orange-400' },
  alerta:      { label: 'Alerta +30min', icon: AlertTriangle, color: 'text-yellow-400' },
  alarme:      { label: 'Sem resposta +15min', icon: Clock, color: 'text-amber-400' },
};

export default function AlertaNovoRadar({ gruposEnriquecidos }) {
  const [dismissedCount, setDismissedCount] = useState(0);
  const prevCountRef = useRef(0);

  // Conta alertas ativos: tempo de resposta + inatividade
  const alertasAtivos = gruposEnriquecidos.filter(g =>
    g.alertaNivel || g.inativo72h || g.status_vinculo === 'inativo'
  );

  const totalAlertas = alertasAtivos.length;

  // Sempre que o total aumenta, reseta o dismiss para o banner reaparecer
  useEffect(() => {
    if (totalAlertas > prevCountRef.current) {
      setDismissedCount(prevCountRef.current);
    }
    prevCountRef.current = totalAlertas;
  }, [totalAlertas]);

  const novosAlertas = totalAlertas - dismissedCount;

  if (novosAlertas <= 0) return null;

  // Agrupa por tipo
  const porTipo = {
    emergencial: alertasAtivos.filter(g => g.alertaNivel === 'emergencial').length,
    critico:     alertasAtivos.filter(g => g.alertaNivel === 'critico').length,
    alerta:      alertasAtivos.filter(g => g.alertaNivel === 'alerta').length,
    alarme:      alertasAtivos.filter(g => g.alertaNivel === 'alarme').length,
    inativo:     alertasAtivos.filter(g => g.inativo72h || g.status_vinculo === 'inativo').length,
  };

  return (
    <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 animate-pulse-once">
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-red-500/20 rounded-lg shrink-0">
          <Bell className="w-5 h-5 text-red-400 animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-400 text-sm">
            {novosAlertas === 1 ? 'Novo alerta detectado' : `${novosAlertas} alertas ativos`}
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            {porTipo.emergencial > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-red-400">
                <Zap className="w-3 h-3" /> {porTipo.emergencial} Emergencial
              </span>
            )}
            {porTipo.critico > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-orange-400">
                <AlertTriangle className="w-3 h-3" /> {porTipo.critico} Crítico
              </span>
            )}
            {porTipo.alerta > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-yellow-400">
                <AlertTriangle className="w-3 h-3" /> {porTipo.alerta} Alerta
              </span>
            )}
            {porTipo.alarme > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-amber-400">
                <Clock className="w-3 h-3" /> {porTipo.alarme} Sem resposta +15min
              </span>
            )}
            {porTipo.inativo > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-purple-400">
                <MoonStar className="w-3 h-3" /> {porTipo.inativo} Inativo
              </span>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDismissedCount(totalAlertas)}
          className="text-red-400 hover:text-white hover:bg-red-500/20 text-xs shrink-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}