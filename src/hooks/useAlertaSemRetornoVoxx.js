/**
 * Hook que detecta clientes com mensagem do cliente sem retorno VOXX,
 * calcula minutos úteis decorridos e emite toast + som na primeira vez que entra em alerta.
 *
 * Retorna: Map<clienteId, { nivel, minutosUteis, ultimaMsgCliente }>
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { calcularMinutosUteis, nivelAlerta } from '@/lib/minutosUteis';

// Mensagens que devem ser ignoradas na análise
function isMensagemValida(msg) {
  if (!msg) return false;
  const texto = (msg.mensagem || '').trim();
  if (!texto) return false;
  if (/^\[mensagem\]$/i.test(texto)) return false;
  if (/apagou uma mensagem/i.test(texto)) return false;
  if (/entrou usando o link/i.test(texto)) return false;
  if (/saiu do grupo/i.test(texto)) return false;
  if (/adicionou/i.test(texto) && /ao grupo/i.test(texto)) return false;
  if (/removeu/i.test(texto) && /do grupo/i.test(texto)) return false;
  // Apenas mídia sem legenda (tipo != texto e mensagem vazia)
  if (msg.tipo_envio && msg.tipo_envio !== 'texto' && !texto) return false;
  return true;
}

// Classifica se é VOXX ou não. Por ora usa o campo origem do log.
// Se vier 'voxx' no campo enviado_por, ou origem = 'resumo_diario' / 'aprovacao_entrega' => VOXX
function isVoxx(msg) {
  if (msg.origem === 'resumo_diario') return true;
  if (msg.origem === 'aprovacao_entrega') return true;
  if (msg.origem === 'manual') return true; // enviado pela equipe VOXX
  // Webhook externo = cliente
  if (msg.origem === 'webhook') return false;
  // Fallback: se tem enviado_por (email) => VOXX
  if (msg.enviado_por && msg.enviado_por.includes('@')) return true;
  return false;
}

const NIVEL_LABELS = {
  alerta:      'Sem retorno VOXX +30min úteis',
  critico:     'Sem retorno VOXX +1h útil',
  emergencial: 'Sem retorno VOXX +2h úteis',
};

const NIVEL_TOAST_COLOR = {
  alerta:      'warning',
  critico:     'error',
  emergencial: 'error',
};

function tocarSom() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (_) { /* silencia se bloqueado */ }
}

export function useAlertaSemRetornoVoxx(clientesIds = []) {
  // alertas: Map<clienteId, { nivel, minutosUteis, ultimaMsgCliente: ISO string }>
  const [alertas, setAlertas] = useState(new Map());
  // Rastreia quais clientes já tiveram toast/som disparado neste nível
  const notificadosRef = useRef(new Map()); // clienteId -> nivel notificado

  const { data: logsRecentes = [] } = useQuery({
    queryKey: ['alertaVoxxLogs'],
    queryFn: () => base44.entities.WhatsappEnvioLog.list('-enviado_em', 1000),
    refetchInterval: 60 * 1000, // atualiza a cada 1 minuto
    staleTime: 30 * 1000,
  });

  const calcular = useCallback(() => {
    if (!logsRecentes.length) return;

    const agora = new Date().toISOString();
    const novosAlertas = new Map();

    // Agrupar logs por cliente
    const porCliente = {};
    logsRecentes.forEach(log => {
      if (!log.cliente_id || !log.enviado_em) return;
      if (!porCliente[log.cliente_id]) porCliente[log.cliente_id] = [];
      porCliente[log.cliente_id].push(log);
    });

    Object.entries(porCliente).forEach(([clienteId, logs]) => {
      // Ordenar do mais recente para o mais antigo
      const ordenados = [...logs]
        .filter(isMensagemValida)
        .sort((a, b) => b.enviado_em.localeCompare(a.enviado_em));

      if (!ordenados.length) return;

      // Verificar se a última mensagem é do cliente (não VOXX)
      const ultimaMsg = ordenados[0];
      if (isVoxx(ultimaMsg)) return; // VOXX respondeu por último — sem alerta

      // Procurar se existe alguma mensagem VOXX POSTERIOR à última mensagem do cliente
      // (pode haver mensagens do cliente intercaladas — precisamos da última msg do cliente
      //  e verificar se há VOXX depois)
      const ultimaMsgCliente = ordenados.find(m => !isVoxx(m));
      if (!ultimaMsgCliente) return;

      const temRespostaPosterior = ordenados.some(
        m => isVoxx(m) && m.enviado_em > ultimaMsgCliente.enviado_em
      );
      if (temRespostaPosterior) return;

      // Calcular minutos úteis desde a última mensagem do cliente
      const minutos = calcularMinutosUteis(ultimaMsgCliente.enviado_em, agora);
      const nivel = nivelAlerta(minutos);

      if (nivel) {
        novosAlertas.set(clienteId, {
          nivel,
          minutosUteis: minutos,
          ultimaMsgCliente: ultimaMsgCliente.enviado_em,
          label: NIVEL_LABELS[nivel],
        });
      }
    });

    setAlertas(novosAlertas);

    // Disparar toast + som para novos alertas ou escaladas
    novosAlertas.forEach((info, clienteId) => {
      const anterior = notificadosRef.current.get(clienteId);
      const nivelOrdem = { alerta: 1, critico: 2, emergencial: 3 };
      const ordemAtual = nivelOrdem[info.nivel] || 0;
      const ordemAnterior = nivelOrdem[anterior] || 0;

      if (ordemAtual > ordemAnterior) {
        // Novo alerta ou escalada de nível
        tocarSom();
        toast[NIVEL_TOAST_COLOR[info.nivel] === 'error' ? 'error' : 'warning'](info.label, {
          description: `Cliente requer retorno imediato.`,
          duration: 8000,
        });
        notificadosRef.current.set(clienteId, info.nivel);
      }
    });

    // Limpar notificados que saíram do alerta
    notificadosRef.current.forEach((_, clienteId) => {
      if (!novosAlertas.has(clienteId)) {
        notificadosRef.current.delete(clienteId);
      }
    });
  }, [logsRecentes]);

  useEffect(() => {
    calcular();
  }, [calcular]);

  return alertas;
}