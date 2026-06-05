/**
 * Motor único de tempo real — gerencia todas as subscriptions em um único lugar.
 * Expõe status de conexão e invalida queries do React Query automaticamente.
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const RealtimeContext = createContext(null);

// Entidades monitoradas e quais queryKeys invalidar quando mudam
const SUBSCRIPTIONS = [
  {
    entity: 'Cliente',
    queryKeys: [['clientesAnalises'], ['clientes'], ['clientesGerenciar']],
    onEvent: (event) => {
      if (event.type === 'update') return; // silencioso
      return null; // sem toast para clientes
    },
  },
  {
    entity: 'WhatsappGrupo',
    queryKeys: [['analisesGrupos'], ['whatsappGrupos']],
    onEvent: (event) => {
      if (event.type === 'create') {
        return { msg: 'Novo grupo WhatsApp vinculado', tipo: 'info' };
      }
      return null;
    },
  },
  {
    entity: 'WhatsappEnvioLog',
    queryKeys: [['analisesLogsEnvio'], ['alertaVoxxLogs'], ['whatsappLogs']],
    onEvent: (event) => {
      if (event.type === 'create') {
        return { msg: 'Nova mensagem WhatsApp recebida', tipo: 'info' };
      }
      return null;
    },
  },
  {
    entity: 'Notificacao',
    queryKeys: [['analisesNotificacoes'], ['notificacoes']],
    onEvent: (event) => {
      if (event.type === 'create' && event.data?.lida === false) {
        return { msg: event.data?.titulo || 'Novo alerta VOXX', tipo: 'warning' };
      }
      return null;
    },
  },
  {
    entity: 'ResumoDiarioCliente',
    queryKeys: [['analisesResumos'], ['resumosDiarios']],
    onEvent: (event) => {
      if (event.type === 'create') {
        return { msg: 'Nova análise gerada', tipo: 'success' };
      }
      return null;
    },
  },
  {
    entity: 'Demanda',
    queryKeys: [['analisesDemandasAguardando'], ['pendingDemandas'], ['demandas']],
    onEvent: () => null,
  },
  {
    entity: 'FilaComunicacaoCliente',
    queryKeys: [['filaComunicacao']],
    onEvent: (event) => {
      if (event.type === 'create') {
        return { msg: 'Novo item na fila de comunicação', tipo: 'info' };
      }
      return null;
    },
  },
  {
    entity: 'ContaMetaAds',
    queryKeys: [['contasMetaAds'], ['dashboardMeta']],
    onEvent: (event) => {
      if (event.type === 'update') {
        return { msg: 'Indicadores Meta Ads recalculados', tipo: 'info' };
      }
      return null;
    },
  },
  {
    entity: 'RadarMetaData',
    queryKeys: [['radarMetaData']],
    onEvent: () => null,
  },
];

// Debounce por queryKey — evita invalidações em rajada
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function RealtimeProvider({ children }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('connecting'); // 'online' | 'reconnecting' | 'offline'
  const unsubscribesRef = useRef([]);
  const mountedRef = useRef(true);
  const reconnectTimerRef = useRef(null);
  const toastCooldownRef = useRef({}); // evitar spam de toast

  // Invalida queryKeys com debounce de 500ms
  const invalidateKeys = useCallback(
    debounce((keys) => {
      if (!mountedRef.current) return;
      keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
    }, 500),
    [queryClient]
  );

  const emitToast = useCallback((msg, tipo) => {
    if (!msg) return;
    const now = Date.now();
    const last = toastCooldownRef.current[msg] || 0;
    if (now - last < 5000) return; // cooldown 5s por mensagem igual
    toastCooldownRef.current[msg] = now;

    if (tipo === 'success') toast.success(msg, { duration: 3000 });
    else if (tipo === 'warning') toast.warning(msg, { duration: 4000 });
    else if (tipo === 'error') toast.error(msg, { duration: 4000 });
    else toast.info(msg, { duration: 3000 });
  }, []);

  const setupSubscriptions = useCallback(() => {
    // Limpar subscriptions anteriores
    unsubscribesRef.current.forEach(unsub => { try { unsub(); } catch (_) {} });
    unsubscribesRef.current = [];

    let successCount = 0;

    SUBSCRIPTIONS.forEach(({ entity, queryKeys, onEvent }) => {
      try {
        if (!base44.entities[entity]) return;

        const unsub = base44.entities[entity].subscribe((event) => {
          if (!mountedRef.current) return;

          // Invalidar queries relacionadas
          invalidateKeys(queryKeys);

          // Emitir toast se necessário
          const notification = onEvent(event);
          if (notification) {
            emitToast(notification.msg, notification.tipo);
          }
        });

        unsubscribesRef.current.push(unsub);
        successCount++;
      } catch (err) {
        console.warn(`[Realtime] Falha ao assinar ${entity}:`, err);
      }
    });

    if (successCount > 0) {
      setStatus('online');
    } else {
      setStatus('offline');
    }
  }, [invalidateKeys, emitToast]);

  const reconnect = useCallback(() => {
    if (!mountedRef.current) return;
    setStatus('reconnecting');
    clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setupSubscriptions();
    }, 3000);
  }, [setupSubscriptions]);

  useEffect(() => {
    mountedRef.current = true;
    setupSubscriptions();

    // Detectar offline/online do navegador
    const handleOnline = () => {
      setStatus('reconnecting');
      setTimeout(() => {
        if (mountedRef.current) setupSubscriptions();
      }, 1000);
    };
    const handleOffline = () => setStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      unsubscribesRef.current.forEach(unsub => { try { unsub(); } catch (_) {} });
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setupSubscriptions]);

  return (
    <RealtimeContext.Provider value={{ status, reconnect }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) return { status: 'offline', reconnect: () => {} };
  return ctx;
}