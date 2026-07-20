/**
 * Feature flags do Portal VOXX.
 * Permite ativar/desativar funcionalidades sem deploy.
 *
 * Uso:
 *   import { isFeatureEnabled } from '@/lib/featureFlags';
 *   if (isFeatureEnabled('itensDemanda')) { ... }
 *
 * Para ativar via URL: ?feature_itens_demanda=true
 * Para desativar via URL: ?feature_itens_demanda=false
 * O valor é persistido em localStorage.
 */
const STORAGE_PREFIX = 'voxx_feature_';

const FEATURE_DEFAULTS = {
  // Fase 1 — Modelo Híbrido de Demandas Compostas
  itensDemanda: true,
};

const normalizeKey = (key) => {
  // Converte camelCase para snake_case lower
  return key.replace(/([A-Z])/g, '_$1').toLowerCase();
};

export const isFeatureEnabled = (flagName) => {
  if (typeof window === 'undefined') return FEATURE_DEFAULTS[flagName] ?? false;

  const storageKey = STORAGE_PREFIX + normalizeKey(flagName);
  const urlParams = new URLSearchParams(window.location.search);
  const urlKey = 'feature_' + normalizeKey(flagName);
  const urlValue = urlParams.get(urlKey);

  if (urlValue === 'true') {
    localStorage.setItem(storageKey, 'true');
    return true;
  }
  if (urlValue === 'false') {
    localStorage.setItem(storageKey, 'false');
    return false;
  }

  const stored = localStorage.getItem(storageKey);
  if (stored !== null) return stored === 'true';

  return FEATURE_DEFAULTS[flagName] ?? false;
};

export const FEATURES = {
  ITENS_DEMANDA: 'itensDemanda',
};