import { useRef, useEffect, useCallback } from 'react';

const MIN_HEIGHT = 40;
const MAX_HEIGHT = 160;

/**
 * Hook que ajusta automaticamente a altura de um textarea conforme o conteúdo.
 *
 * - Recalcula quando o valor muda (incluindo inserção programática pelo Copilot)
 * - Altura mínima equivalente a ~2 linhas
 * - Altura máxima equivalente a ~8 linhas
 * - Após o máximo, habilita rolagem vertical interna
 */
export function useTextareaAutoHeight(value) {
  const ref = useRef(null);

  const adjustHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const scrollHeight = el.scrollHeight;
    el.style.height = `${Math.min(scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, []);

  // Recalcula sempre que o valor muda (cobre digitação, Copilot, paste, etc.)
  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return { ref, adjustHeight };
}