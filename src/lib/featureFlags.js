/**
 * Feature flags do Portal VOXX.
 * Permite ativar/desativar funcionalidades sem deploy.
 *
 * Estratégia de ativação centralizada (camada 1 — ambiente):
 *  - Produção: feature DESATIVADA por padrão.
 *  - Homologação/staging/localhost: feature ATIVADA por padrão.
 *
 * Camada 2 — URL (override explícito):
 *  - ?feature_itens_demanda=true  → ativa e persiste
 *  - ?feature_itens_demanda=false → desativa e persiste
 *
 * Camada 3 — localStorage (memória persistente do override):
 *  - Após um override via URL, a escolha persiste entre sessões.
 *
 * Quando desativada, NENHUMA consulta a ItemDemanda deve ser executada.
 * A desativação não exclui dados já criados — apenas esconde a UI e bloqueia queries.
 */
const STORAGE_PREFIX = 'voxx_feature_';

const HOMOLOGATION_HOSTS = ['localhost', '127.0.0.1', 'homolog', 'staging', 'dev.'];

const isHomologationEnv = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return HOMOLOGATION_HOSTS.some(h => host.includes(h));
};

const FEATURE_DEFAULTS = {
  // Fase 1 — Modelo Híbrido de Demandas Compostas
  // Ativado apenas em homologação; em produção, requer override via URL.
  itensDemanda: isHomologationEnv(),
};

const normalizeKey = (key) => {
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