/**
 * Hook responsável por controlar o alarme sonoro do Radar WhatsApp.
 * - Toca som diferente por nível (alarme, alerta, critico, emergencial)
 * - Não repete para o mesmo grupo + nível + timestamp da última msg do cliente
 * - Respeita preferência de som salva no localStorage
 * - Respeita bloqueio do navegador (autoplay)
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const LS_KEY = 'radar_som_ativo';

// Gera beeps via Web Audio API
function criarAudioContext() {
  try {
    return new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return null;
  }
}

function tocarBeep(ctx, { frequencia = 880, duracao = 0.15, volume = 0.3, repeticoes = 1, intervalo = 0.2 } = {}) {
  if (!ctx) return;
  for (let i = 0; i < repeticoes; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = frequencia;
    gain.gain.setValueAtTime(0, ctx.currentTime + i * intervalo);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + i * intervalo + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * intervalo + duracao);
    osc.start(ctx.currentTime + i * intervalo);
    osc.stop(ctx.currentTime + i * intervalo + duracao + 0.05);
  }
}

const SONS_POR_NIVEL = {
  alarme:      { frequencia: 880, duracao: 0.2,  volume: 0.25, repeticoes: 1, intervalo: 0.3 },
  alerta:      { frequencia: 660, duracao: 0.2,  volume: 0.3,  repeticoes: 2, intervalo: 0.3 },
  critico:     { frequencia: 440, duracao: 0.25, volume: 0.35, repeticoes: 3, intervalo: 0.35 },
  emergencial: { frequencia: 330, duracao: 0.3,  volume: 0.4,  repeticoes: 4, intervalo: 0.4 },
};

export function useAlertaSomRadar(gruposEnriquecidos) {
  const [somAtivo, setSomAtivo] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === 'true'; } catch { return false; }
  });
  const [audioBloqueado, setAudioBloqueado] = useState(false);

  const audioCtxRef = useRef(null);
  // chave: `${grupo_id}|${nivel}|${tsUltimaMsgCliente}` → já disparou
  const disparadosRef = useRef(new Set());

  const toggleSom = useCallback(async () => {
    // Inicializa/retoma AudioContext na interação do usuário
    if (!audioCtxRef.current) {
      audioCtxRef.current = criarAudioContext();
    }
    if (audioCtxRef.current?.state === 'suspended') {
      try {
        await audioCtxRef.current.resume();
        setAudioBloqueado(false);
      } catch {
        setAudioBloqueado(true);
      }
    }

    const novoEstado = !somAtivo;
    setSomAtivo(novoEstado);
    try { localStorage.setItem(LS_KEY, String(novoEstado)); } catch {}

    // Toca um beep de confirmação ao ativar
    if (novoEstado && audioCtxRef.current) {
      tocarBeep(audioCtxRef.current, { frequencia: 1000, duracao: 0.1, volume: 0.2, repeticoes: 2, intervalo: 0.15 });
    }
  }, [somAtivo]);

  useEffect(() => {
    if (!somAtivo || !gruposEnriquecidos?.length) return;

    // Garante que o AudioContext existe
    if (!audioCtxRef.current) {
      audioCtxRef.current = criarAudioContext();
    }
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    gruposEnriquecidos.forEach(g => {
      if (!g.alertaNivel) return;

      // Só dispara som para mensagens genuinamente recebidas (não enviadas pelo portal VOXX)
      const ultimaMsg = g.ultimaClienteValida;
      if (!ultimaMsg || ultimaMsg.from_me === true || ultimaMsg.origem === 'enviada') return;

      // Chave única: grupo + nível + timestamp da última msg do cliente
      const tsCliente = ultimaMsg.received_at || '';
      const chave = `${g.grupo_id}|${g.alertaNivel}|${tsCliente}`;

      if (disparadosRef.current.has(chave)) return;

      // Marcar como disparado ANTES de tocar para evitar repetição em re-renders rápidos
      disparadosRef.current.add(chave);

      const config = SONS_POR_NIVEL[g.alertaNivel];
      if (!config) return;

      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          tocarBeep(ctx, config);
          setAudioBloqueado(false);
        }).catch(() => setAudioBloqueado(true));
      } else {
        tocarBeep(ctx, config);
      }
    });

    // Limpar chaves de grupos que voltaram a ser saudáveis (resolvidos)
    const chavesAtivas = new Set(
      gruposEnriquecidos
        .filter(g => g.alertaNivel)
        .map(g => {
          const tsCliente = g.ultimaClienteValida?.received_at || g.ultimaCliente?.received_at || '';
          return `${g.grupo_id}|${g.alertaNivel}|${tsCliente}`;
        })
    );
    // Remove apenas chaves do mesmo grupo que não estão mais ativas
    disparadosRef.current.forEach(chave => {
      const grupoId = chave.split('|')[0];
      const grupoAtivo = gruposEnriquecidos.find(g => g.grupo_id === grupoId && g.alertaNivel);
      if (!grupoAtivo) {
        disparadosRef.current.delete(chave);
      }
    });
  }, [somAtivo, gruposEnriquecidos]);

  return { somAtivo, toggleSom, audioBloqueado };
}