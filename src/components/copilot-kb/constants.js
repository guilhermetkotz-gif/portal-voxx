export const CATEGORIAS = [
  { value: 'padrao_comunicacao', label: 'Padrão de Comunicação' },
  { value: 'campanhas_trafego', label: 'Campanhas & Tráfego' },
  { value: 'criacao_artes', label: 'Criação de Artes' },
  { value: 'conteudo_redes_sociais', label: 'Conteúdo Redes Sociais' },
  { value: 'operacao_atendimento', label: 'Operação & Atendimento' },
  { value: 'reclamacoes_sensiveis', label: 'Reclamações Sensíveis' },
  { value: 'contratos_financeiro', label: 'Contratos & Financeiro' },
];

export const TIPOS_ORIENTACAO = [
  { value: 'tom_linguagem', label: 'Tom e linguagem', desc: 'Direciona o estilo da resposta' },
  { value: 'regra_operacional', label: 'Regra operacional', desc: 'Procedimento interno da VOXX, não comunicado ao cliente' },
  { value: 'restricao', label: 'Restrição', desc: 'Nunca deve ser violada' },
  { value: 'procedimento', label: 'Procedimento', desc: 'Como responder ou proceder' },
  { value: 'info_autorizada', label: 'Informação autorizada', desc: 'Pode ser comunicada quando relevante' },
  { value: 'info_exige_confirmacao', label: 'Informação que exige confirmação', desc: 'Não apresentar como fato confirmado' },
  { value: 'revisao_obrigatoria', label: 'Revisão obrigatória', desc: 'Exige revisão humana obrigatória' },
];

export const ESCOPOS = [
  { value: 'global', label: 'Global' },
  { value: 'segmento', label: 'Segmento' },
  { value: 'marca', label: 'Marca' },
  { value: 'cliente', label: 'Cliente' },
];

export const TIPOS_EXIGEM_CHAVE = [
  'regra_operacional', 'restricao', 'info_autorizada',
  'info_exige_confirmacao', 'revisao_obrigatoria'
];

export const SEGMENTOS_CLIENTE = [
  { value: 'oral_sin', label: 'Oral Sin' },
  { value: 'particular', label: 'Particular' },
  { value: 'franquia', label: 'Franquia' },
  { value: 'outro', label: 'Outro' },
];

export function labelCategoria(value) {
  return CATEGORIAS.find(c => c.value === value)?.label || value || '—';
}

export function labelTipoOrientacao(value) {
  return TIPOS_ORIENTACAO.find(t => t.value === value)?.label || value || '—';
}

export function descTipoOrientacao(value) {
  return TIPOS_ORIENTACAO.find(t => t.value === value)?.desc || '';
}

export function labelEscopo(value) {
  return ESCOPOS.find(e => e.value === value)?.label || value || '—';
}

export function escopoAlvoText(o) {
  if (!o) return '—';
  switch (o.escopo_tipo) {
    case 'global': return 'Global';
    case 'segmento': return o.escopo_segmento || '—';
    case 'marca': return o.escopo_marca || '—';
    case 'cliente': return o.escopo_cliente_nome || '—';
    default: return '—';
  }
}

export function badgeEscopoVariant(escopoTipo) {
  switch (escopoTipo) {
    case 'global': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'segmento': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    case 'marca': return 'bg-violet-100 text-violet-700 border-violet-200';
    case 'cliente': return 'bg-amber-100 text-amber-700 border-amber-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}