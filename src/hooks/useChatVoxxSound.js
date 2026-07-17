/**
 * Som de notificação do Chat Voxx (estilo Twitter — "pop" curto e agradável).
 * - Persiste preferência em localStorage
 * - Respeita bloqueios de autoplay
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const STORAGE_KEY = 'voxx_chat_som_ativado';

/**
 * Toca um som curto tipo "pop" (dois tons descendentes) via Web Audio API.
 */
function playPopSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const now = ctx.currentTime;

    // Primeiro tom (mais agudo) — 0.08s
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318, now); // ~E6
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.1);

    // Segundo tom (mais grave) — sobreposto, 0.14s
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987, now + 0.06); // ~B5
    gain2.gain.setValueAtTime(0.0001, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.12, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.21);

    setTimeout(() => ctx.close().catch(() => {}), 300);
  } catch (_) {
    // silencia se bloqueado
  }
}

export function useChatVoxxSound() {
  const [somAtivado, setSomAtivado] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'false'; // padrão: ligado
    } catch (_) {
      return true;
    }
  });

  const desbloqueadoRef = useRef(false);

  // Desbloqueia AudioContext na primeira interação
  useEffect(() => {
    const desbloquear = () => {
      if (desbloqueadoRef.current) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        ctx.resume().then(() => {
          desbloqueadoRef.current = true;
          ctx.close();
        });
      } catch (_) {}
    };
    document.addEventListener('click', desbloquear, { once: true });
    document.addEventListener('keydown', desbloquear, { once: true });
    return () => {
      document.removeEventListener('click', desbloquear);
      document.removeEventListener('keydown', desbloquear);
    };
  }, []);

  const toggleSom = useCallback(() => {
    setSomAtivado(prev => {
      const novo = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(novo)); } catch (_) {}
      return novo;
    });
  }, []);

  const tocarSom = useCallback(() => {
    if (!somAtivado) return;
    playPopSound();
  }, [somAtivado]);

  return { somAtivado, toggleSom, tocarSom };
}