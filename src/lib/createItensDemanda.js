import { base44 } from '@/api/base44Client';

/**
 * Cria itens de uma demanda composta via backend gerenciarItemDemanda.
 *
 * @param {string} demandaId - ID da Demanda pai já criada
 * @param {Array} itens - Lista de itens vindos do ItensDemandaInlineEditor
 * @returns {Promise<{ created: number, errors: Array, total: number }>}
 *   - created: quantidade de itens criados com sucesso
 *   - errors: array de { item, error } para itens que falharam
 *   - total: total de itens válidos processados
 *
 * Estratégia: tenta criar todos os itens. Se algum falhar, retorna o estado
 * explícito de criação incompleta para o chamador decidir o que fazer.
 */
export async function createItensDemanda(demandaId, itens) {
  const validItems = itens.filter(i => i.titulo?.trim());
  const errors = [];
  let created = 0;

  for (let i = 0; i < validItems.length; i++) {
    const item = validItems[i];
    try {
      await base44.functions.invoke('gerenciarItemDemanda', {
        action: 'create_item',
        demanda_id: demandaId,
        titulo: item.titulo.trim(),
        descricao: item.descricao || null,
        tipo_material: item.tipo_material || null,
        formato: item.formato || null,
        canal: item.canal || null,
        data_prevista: item.data_prevista ? new Date(item.data_prevista).toISOString() : null,
        prazo_data: item.prazo_data ? new Date(item.prazo_data).toISOString() : null,
        responsavel_id: item.responsavel_id || null,
        responsavel_nome: item.responsavel_nome || null,
        ordem: i,
      });
      created++;
    } catch (err) {
      errors.push({ item, error: err });
    }
  }

  return { created, errors, total: validItems.length };
}