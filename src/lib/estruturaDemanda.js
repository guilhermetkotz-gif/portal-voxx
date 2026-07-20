/**
 * Helper centralizado para resolver estrutura_demanda com fallback.
 *
 * Estratégia adotada para cards legados: FALLBACK (Opção B).
 * null, undefined ou valor ausente = 'legada'.
 *
 * Regras de fallback:
 *  - null/undefined/'' → 'legada'
 *  - valor válido (unitaria/composta/legada) → retorna o valor
 *
 * Este fallback é aplicado em TODA a aplicação, garantindo que
 * demandas criadas antes do modelo híbrido funcionem sem alteração.
 */

export const getEstruturaDemanda = (demanda) => {
  if (!demanda) return 'legada';
  const val = demanda.estrutura_demanda;
  if (val === null || val === undefined || val === '') return 'legada';
  return val;
};

export const isDemandaComposta = (demanda) => {
  return getEstruturaDemanda(demanda) === 'composta';
};

export const isDemandaUnitaria = (demanda) => {
  return getEstruturaDemanda(demanda) === 'unitaria';
};

export const isDemandaLegada = (demanda) => {
  return getEstruturaDemanda(demanda) === 'legada';
};

export const ESTRUTURA_LABELS = {
  unitaria: 'Unitária',
  composta: 'Composta',
  legada: 'Legada',
};