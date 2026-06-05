/**
 * Hook para gerenciar som de alertas.
 * - Persiste preferência em localStorage
 * - Respeita bloqueios de autoplay do navegador
 * - Expõe botão/estado para ativar/desativar
 * - Toca sons distintos por nível
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const STORAGE_KEY = 'voxx_alerta_som_ativado';

// Sons diferentes por nível (frequência + duração)
const SONS = {
  alerta:      { freq: 660, duracao: 0.25, volume: 0.12, repeticoes: 1 },
  critico:     { freq: 880, duracao: 0.2,  volume: 0.15, repeticoes: 2 },
  emergencial: { freq: 1100, duracao: 0.18, volume: 0.18, repeticoes: 3 },
  mensagem:    { freq: 520, duracao: 0.3,  volume: 0.1,  repeticoes: 1 },
};

function tocarBeep(config) {
  return new Promise((resolve) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      let delay = 0;
      const { freq, duracao, volume, repeticoes } = config;

      for (let i = 0; i < repeticoes; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duracao);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duracao);
        delay += duracao + 0.08; // pausa entre beeps
      }

      setTimeout(() => {
        ctx.close().catch(() => {});
        resolve();
      }, (delay + 0.1) * 1000);
    } catch (_) {
      resolve(); // silencia se bloqueado
    }
  });
}

export function useAlertaSound() {
  // Lê preferência salva; padrão = false (aguarda interação do usuário)
  const [somAtivado, setSomAtivado] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (_) {
      return false;
    }
  });

  // Rastreia se o contexto de áudio já foi desbloqueado via interação
  const audioDesbloqueadoRef = useRef(false);

  // Tenta desbloquear o AudioContext em interação do usuário
  useEffect(() => {
    const desbloquear = () => {
      if (audioDesbloqueadoRef.current) return;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume().then(() => {
          audioDesbloqueadoRef.current = true;
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
      const novoValor = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(novoValor));
      } catch (_) {}
      return novoValor;
    });
  }, []);

  /**
   * Toca um som se o som estiver ativado.
   * @param {'alerta'|'critico'|'emergencial'|'mensagem'} nivel
   */
  const tocarSom = useCallback((nivel = 'alerta') => {
    if (!somAtivado) return;
    const config = SONS[nivel] || SONS.alerta;
    tocarBeep(config);
  }, [somAtivado]);

  return { somAtivado, toggleSom, tocarSom };
}