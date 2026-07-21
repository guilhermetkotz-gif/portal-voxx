/**
 * Módulo shared — Fase 2A: Versionamento imutável de entregas.
 *
 * Funções reutilizadas por gerenciarEntregaItem, entregaPublica e reconciliarVersoesEntrega.
 *
 * Regras canônicas:
 *  - A versão vigente é determinada pela ordenação (created_date ASC, versao_uid ASC).
 *  - numero_exibicao NÃO é fonte de verdade — é derivado da posição na ordenação.
 *  - Versões com status_canonico em [substituida, duplicada, invalidada, cancelada]
 *    não participam da escolha da versão vigente.
 *  - A operação canônica para uma combinação (idempotency_key, tipo_operacao,
 *    entrega_id, payload_hash) é a primeira por (created_date ASC, operacao_id ASC).
 *  - Funções de consulta NUNCA modificam dados.
 */

// Status canônicos que excluem uma versão da NUMERAÇÃO (não participam da sequência v1, v2, v3...)
export const STATUS_EXCLUIDOS_NUMERACAO = ['duplicada', 'invalidada', 'cancelada'];

// Status canônicos que excluem uma versão da ESCOLHA da vigente (participam da numeração mas não podem ser a versão vigente)
export const STATUS_EXCLUIDOS_ESCOLHA = ['substituida', 'duplicada', 'invalidada', 'cancelada'];

// Compatibilidade — usar STATUS_EXCLUIDOS_ESCOLHA
export const STATUS_CANONICO_EXCLUIDOS = STATUS_EXCLUIDOS_ESCOLHA;

// Status de versão que impedem resposta do cliente
export const STATUS_ACEITA_RESPOSTA = ['em_aprovacao', 'reenviado'];

/**
 * Gera um UUID v4 usando crypto.randomUUID() (disponível no Deno Deploy).
 */
export function gerarUUID() {
  return crypto.randomUUID();
}

/**
 * Gera um token público único para link de aprovação.
 * Usa crypto.randomUUID() — criptograficamente seguro.
 */
export function gerarTokenPublico() {
  return crypto.randomUUID();
}

/**
 * Ordena recursivamente as chaves de um objeto, preservando a ordem dos arrays.
 */
function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortObjectKeys(obj[key]);
  }
  return sorted;
}

/**
 * Gera um hash SHA-256 do payload para detecção de duplicação.
 * - Ordenação recursiva de chaves de objetos
 * - Preservação da ordem dos arrays
 * - SHA-256 com crypto.subtle.digest
 */
export async function hashPayload(payload) {
  if (!payload) return 'empty';
  const sorted = sortObjectKeys(payload);
  const str = JSON.stringify(sorted);
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Determina a versão canônica (vigente) de uma EntregaDemanda.
 *
 * @param {object} sdk - base44.asServiceRole SDK
 * @param {string} entregaDemandaId - ID da EntregaDemanda
 * @returns {Promise<{
 *   versao_canonica: object | null,
 *   versoes_validas: array,
 *   versoes_excluidas: array,
 *   tem_concorrencia: boolean,
 *   total_versoes: number,
 *   total_validas: number,
 *   numero_versao_canonica: number | null,
 * }>}
 *
 * NUNCA modifica dados. Apenas consulta e ordena.
 */
export async function determinarVersaoCanonica(sdk, entregaDemandaId) {
  const todasVersoes = await sdk.entities.VersaoEntregaDemanda.filter(
    { entrega_demanda_id: entregaDemandaId },
    'created_date',
    500
  );

  // Separar versões por status canônico
  const versoesExcluidas = []; // excluídas da numeração (duplicada, invalidada, cancelada)
  const versoesNumeraveis = []; // participam da numeração (inclui substituidas)
  for (const v of todasVersoes) {
    const sc = v.status_canonico || 'ativa';
    if (STATUS_EXCLUIDOS_NUMERACAO.includes(sc)) {
      versoesExcluidas.push(v);
    } else {
      versoesNumeraveis.push(v);
    }
  }

  // Ordenar por created_date ASC, versao_uid ASC (desempate)
  const ordenadas = [...versoesNumeraveis].sort((a, b) => {
    const cmp = (a.created_date || '').localeCompare(b.created_date || '');
    if (cmp !== 0) return cmp;
    return (a.versao_uid || '').localeCompare(b.versao_uid || '');
  });

  // Calcular numero_exibicao derivado da posição (inclui substituidas na contagem)
  const comNumeros = ordenadas.map((v, idx) => ({
    ...v,
    numero_exibicao_calculado: idx + 1,
  }));

  // Versões escolhíveis = numeráveis exceto substituidas
  const versoesEscolhiveis = comNumeros.filter(
    (v) => !STATUS_EXCLUIDOS_ESCOLHA.includes(v.status_canonico || 'ativa')
  );

  // A versão canônica é a ÚLTIMA versão escolhível na ordenação
  const versaoCanonica = versoesEscolhiveis.length > 0
    ? comNumeros.find(v => v.versao_uid === versoesEscolhiveis[versoesEscolhiveis.length - 1].versao_uid)
    : null;
  const numeroVersaoCanonica = versaoCanonica ? versaoCanonica.numero_exibicao_calculado : null;

  // Detectar concorrência: múltiplas versões ativas sem substituicao
  const ativasNaoSubstituidas = comNumeros.filter(
    (v) => !v.substituida_em && (v.status_canonico || 'ativa') === 'ativa'
  );
  const temConcorrencia = ativasNaoSubstituidas.length > 1;

  return {
    versao_canonica: versaoCanonica,
    versoes_validas: comNumeros,
    versoes_excluidas: versoesExcluidas,
    tem_concorrencia: temConcorrencia,
    total_versoes: todasVersoes.length,
    total_validas: comNumeros.length,
    numero_versao_canonica: numeroVersaoCanonica,
  };
}

/**
 * Determina a operação canônica para uma combinação de idempotência.
 *
 * @param {object} sdk - base44.asServiceRole SDK
 * @param {{idempotency_key: string, tipo_operacao: string, entrega_id?: string, payload_hash?: string}} params
 * @returns {Promise<{operacao_canonica: object | null, operacoes_duplicadas: array, total: number}>}
 */
export async function determinarOperacaoCanonica(sdk, params) {
  const filter = {
    idempotency_key: params.idempotency_key,
    tipo_operacao: params.tipo_operacao,
  };
  if (params.entrega_id) filter.entrega_id = params.entrega_id;
  if (params.payload_hash) filter.payload_hash = params.payload_hash;
  if (params.versao_uid) filter.versao_uid = params.versao_uid;

  const operacoes = await sdk.entities.OperacaoEntrega.filter(filter, 'created_date', 100);

  // Ordenar por created_date ASC, operacao_id ASC
  const ordenadas = [...operacoes].sort((a, b) => {
    const cmp = (a.created_date || '').localeCompare(b.created_date || '');
    if (cmp !== 0) return cmp;
    return (a.operacao_id || '').localeCompare(b.operacao_id || '');
  });

  const canonica = ordenadas[0] || null;
  const duplicadas = ordenadas.slice(1);

  return {
    operacao_canonica: canonica,
    operacoes_duplicadas: duplicadas,
    total: operacoes.length,
  };
}

/**
 * Verifica se uma operação com a mesma idempotency_key já foi concluída.
 * Retorna o resultado cacheado se sim, para resposta idempotente.
 *
 * @param {object} sdk
 * @param {string} idempotencyKey
 * @returns {Promise<{existe: boolean, operacao: object | null, resultado: object | null}>}
 */
export async function verificarOperacaoExistente(sdk, idempotencyKey, tipoOperacao = null, entregaId = null, payloadHash = null) {
  if (!idempotencyKey) return { existe: false, operacao: null, resultado: null };

  const filter = { idempotency_key: idempotencyKey };
  if (tipoOperacao) filter.tipo_operacao = tipoOperacao;
  if (entregaId) filter.entrega_id = entregaId;
  if (payloadHash) filter.payload_hash = payloadHash;

  const existentes = await sdk.entities.OperacaoEntrega.filter(
    filter,
    'created_date',
    10
  );

  if (!existentes || existentes.length === 0) {
    return { existe: false, operacao: null, resultado: null };
  }

  // Ordenar para pegar a primeira
  const ordenadas = [...existentes].sort((a, b) => {
    const cmp = (a.created_date || '').localeCompare(b.created_date || '');
    if (cmp !== 0) return cmp;
    return (a.operacao_id || '').localeCompare(b.operacao_id || '');
  });

  const operacao = ordenadas[0];
  return {
    existe: true,
    operacao,
    resultado: operacao.resultado || null,
    status: operacao.status_operacao,
  };
}

/**
 * Mapeia status da VersaoEntregaDemanda para status_aprovacao do ItemDemanda.
 */
export function versaoStatusToItemStatus(statusVersao) {
  const map = {
    rascunho: 'nao_enviado',
    em_aprovacao: 'aguardando',
    solicitacao_alteracao: 'ajustes_solicitados',
    reenviado: 'reenviado',
    aprovado: 'aprovado',
    cancelada: 'nao_enviado',
  };
  return map[statusVersao] || 'nao_enviado';
}

/**
 * Mapeia status da VersaoEntregaDemanda para status_entrega do EntregaDemanda (cache).
 */
export function versaoStatusToEntregaStatus(statusVersao) {
  const map = {
    rascunho: 'rascunho',
    em_aprovacao: 'em_aprovacao',
    solicitacao_alteracao: 'solicitacao_alteracao',
    reenviado: 'reenviado',
    aprovado: 'aprovado',
    cancelada: 'arquivado',
  };
  return map[statusVersao] || 'rascunho';
}