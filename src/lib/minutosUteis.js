/**
 * Calcula minutos úteis entre duas datas, respeitando:
 * - Segunda a sexta
 * - 08:00 às 12:00
 * - 13:13 às 18:00
 * - Fuso: America/Sao_Paulo
 */

import moment from 'moment';
import 'moment-timezone';

const TZ = 'America/Sao_Paulo';

// Intervalos do dia em minutos desde 00:00
const BLOCOS = [
  { inicio: 8 * 60,       fim: 12 * 60 },     // 08:00–12:00
  { inicio: 13 * 60 + 13, fim: 18 * 60 },     // 13:13–18:00
];
const MINS_UTEIS_POR_DIA = BLOCOS.reduce((acc, b) => acc + (b.fim - b.inicio), 0); // 287 min

function minutosUteisNoDia(minutosDesde0000) {
  let total = 0;
  for (const bloco of BLOCOS) {
    const inicio = Math.max(minutosDesde0000, bloco.inicio);
    const fim = bloco.fim;
    if (inicio < fim) total += fim - inicio;
  }
  return total;
}

function minutosDesde0000(m) {
  return m.hours() * 60 + m.minutes();
}

/**
 * Retorna minutos úteis entre `de` e `ate` (strings ISO ou objetos Date/moment).
 */
export function calcularMinutosUteis(de, ate) {
  const inicio = moment(de).tz(TZ);
  const fim = moment(ate).tz(TZ);

  if (!inicio.isValid() || !fim.isValid() || fim.isSameOrBefore(inicio)) return 0;

  let cursor = inicio.clone();
  let total = 0;

  while (cursor.isBefore(fim)) {
    const diaDaSemana = cursor.isoWeekday(); // 1=seg, 7=dom
    const eFimDeSemana = diaDaSemana >= 6;

    if (!eFimDeSemana) {
      // Fim do mesmo dia ou fim do período — o que vier primeiro
      const fimDoDia = cursor.clone().endOf('day');
      const limiteHoje = fim.isBefore(fimDoDia) ? fim : fimDoDia;

      // Minutos desde 00:00 até cursor e até limite
      const minsCursor = minutosDesde0000(cursor);
      const msLimite = minutosDesde0000(limiteHoje.clone().subtract(1, 'second'));

      for (const bloco of BLOCOS) {
        const inicioBloco = Math.max(minsCursor, bloco.inicio);
        const fimBloco = Math.min(msLimite + 1, bloco.fim);
        if (inicioBloco < fimBloco) total += fimBloco - inicioBloco;
      }
    }

    // Avança para o próximo dia às 00:00
    cursor = cursor.clone().add(1, 'day').startOf('day');
  }

  return total;
}

export const LIMITES_ALERTA = {
  alerta:      30,   // +30min úteis
  critico:     60,   // +1h útil
  emergencial: 120,  // +2h úteis
};

/**
 * Dado quantos minutos úteis sem retorno, retorna o nível do alerta ou null.
 */
export function nivelAlerta(minutosUteis) {
  if (minutosUteis >= LIMITES_ALERTA.emergencial) return 'emergencial';
  if (minutosUteis >= LIMITES_ALERTA.critico)     return 'critico';
  if (minutosUteis >= LIMITES_ALERTA.alerta)       return 'alerta';
  return null;
}