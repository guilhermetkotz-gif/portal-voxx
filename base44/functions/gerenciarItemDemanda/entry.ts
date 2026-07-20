import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Usuário autenticado
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Usuário não autenticado.' }, { status: 401 });
    }

    // 2. Permissões
    const tipoUsuario = user.tipo_usuario || user.tipo_acesso || '';
    const isVoxxUser = tipoUsuario.startsWith('voxx_') || user.role === 'admin';
    const isVoxxAdmin = tipoUsuario === 'voxx_admin' || user.role === 'admin';

    if (!isVoxxUser) {
      return Response.json({ error: 'Acesso negado. Apenas usuários VOXX podem gerenciar itens de demanda.' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    // Helper: resolve estrutura_demanda com fallback legada
    const getEstrutura = (d) => {
      if (!d) return 'legada';
      const v = d.estrutura_demanda;
      if (v === null || v === undefined || v === '') return 'legada';
      return v;
    };

    // Helper: valida acesso à demanda (cliente)
    const validateDemandaAccess = async (demandaId) => {
      let demandaArr;
      try {
        demandaArr = await base44.asServiceRole.entities.Demanda.filter({ id: demandaId });
      } catch (e) {
        return { ok: false, error: 'Demanda não encontrada (ID inválido).', status: 404 };
      }
      const demanda = demandaArr[0];
      if (!demanda) {
        return { ok: false, error: 'Demanda não encontrada.', status: 404 };
      }
      // Voxx users têm acesso a todos os clientes
      return { ok: true, demanda };
    };

    // Helper: busca item com tratamento de ID inválido
    const findItem = async (itemId) => {
      let itemArr;
      try {
        itemArr = await base44.asServiceRole.entities.ItemDemanda.filter({ id: itemId });
      } catch (e) {
        return null;
      }
      return itemArr[0] || null;
    };

    // Helper: valida enums
    const VALID_STATUS_PRODUCAO = ['nao_iniciado', 'em_fila', 'em_desenvolvimento', 'concluido'];
    const VALID_STATUS_APROVACAO = ['nao_enviado', 'aguardando', 'ajustes_solicitados', 'reenviado', 'aprovado'];
    const VALID_STATUS_PUBLICACAO = ['nao_programada', 'programada', 'vencida_sem_confirmacao', 'publicada', 'cancelada'];
    const VALID_STATUS_FINALIZACAO = ['ativo', 'concluido', 'finalizado', 'cancelado'];
    const VALID_ESTRUTURAS = ['unitaria', 'composta', 'legada'];

    // =====================================================
    // ACTION: list_items — Lista itens de uma demanda
    // =====================================================
    if (action === 'list_items') {
      const { demanda_id } = body;
      if (!demanda_id) {
        return Response.json({ error: 'demanda_id é obrigatório.' }, { status: 400 });
      }

      const access = await validateDemandaAccess(demanda_id);
      if (!access.ok) {
        return Response.json({ error: access.error }, { status: access.status });
      }

      // Fase 1: retorna itens mesmo para demandas não-compostas (para exibição)
      // A criação é bloqueada, mas listagem é permitida para auditoria
      const items = await base44.asServiceRole.entities.ItemDemanda.filter(
        { demanda_id },
        'ordem',
        200
      );

      return Response.json({ items, estrutura_demanda: getEstrutura(access.demanda) });
    }

    // =====================================================
    // ACTION: resumo_itens — Resumo agregado para Kanban
    // Recebe lista de demanda_ids e retorna mapa demanda_id → resumo
    // =====================================================
    if (action === 'resumo_itens') {
      const { demanda_ids } = body;
      if (!Array.isArray(demanda_ids) || demanda_ids.length === 0) {
        return Response.json({ resumo_map: {} });
      }

      // Filtrar apenas demandas compostas para otimizar
      // (evita consultar itens de demandas unitárias/legadas)
      const demandasArr = await base44.asServiceRole.entities.Demanda.filter({});
      const compostaIds = demandasArr
        .filter(d => demanda_ids.includes(d.id) && getEstrutura(d) === 'composta')
        .map(d => d.id);

      if (compostaIds.length === 0) {
        return Response.json({ resumo_map: {} });
      }

      // Busca itens apenas das demandas compostas visíveis
      const allItems = await base44.asServiceRole.entities.ItemDemanda.filter({});
      const visibleItems = allItems.filter(i => compostaIds.includes(i.demanda_id));

      const map = {};
      visibleItems.forEach(item => {
        if (!item.demanda_id) return;
        if (!map[item.demanda_id]) {
          map[item.demanda_id] = {
            total: 0, ativos: 0, concluidos: 0,
            em_dev: 0, nao_iniciado: 0, em_fila: 0, cancelados: 0,
          };
        }
        const r = map[item.demanda_id];
        r.total++;
        if (item.status_finalizacao === 'cancelado') {
          r.cancelados++;
        } else {
          r.ativos++;
          if (item.status_producao === 'concluido') r.concluidos++;
          else if (item.status_producao === 'em_desenvolvimento') r.em_dev++;
          else if (item.status_producao === 'em_fila') r.em_fila++;
          else if (item.status_producao === 'nao_iniciado') r.nao_iniciado++;
        }
      });

      return Response.json({ resumo_map: map });
    }

    // =====================================================
    // ACTION: create_item — Cria um item em demanda composta
    // =====================================================
    if (action === 'create_item') {
      const { demanda_id, titulo, descricao, tipo_material, formato, canal,
              data_prevista, prazo_data, responsavel_id, responsavel_nome,
              status_producao } = body;

      // Validações de campos obrigatórios
      if (!demanda_id) {
        return Response.json({ error: 'demanda_id é obrigatório.' }, { status: 400 });
      }
      if (!titulo || !titulo.trim()) {
        return Response.json({ error: 'titulo é obrigatório.' }, { status: 400 });
      }

      // Valida Demanda pai
      const access = await validateDemandaAccess(demanda_id);
      if (!access.ok) {
        return Response.json({ error: access.error }, { status: access.status });
      }
      const demanda = access.demanda;

      // Valida estrutura_demanda = composta
      const estrutura = getEstrutura(demanda);
      if (estrutura !== 'composta') {
        return Response.json({
          error: `Não é possível criar itens em demanda ${estrutura}. Apenas demandas compostas aceitam itens.`,
        }, { status: 400 });
      }

      // Valida enums
      if (status_producao && !VALID_STATUS_PRODUCAO.includes(status_producao)) {
        return Response.json({ error: 'status_producao inválido.' }, { status: 400 });
      }

      // Valida responsável: não pode ser "manual"
      if (responsavel_id === 'manual') {
        return Response.json({ error: 'responsavel_id não pode ser "manual". Use um ID de usuário real ou null.' }, { status: 400 });
      }

      // Calcula próxima ordem
      const existingItems = await base44.asServiceRole.entities.ItemDemanda.filter(
        { demanda_id },
        'ordem',
        200
      );
      const nextOrdem = existingItems.length > 0
        ? Math.max(...existingItems.map(i => i.ordem ?? 0)) + 1
        : 0;

      const newItem = await base44.asServiceRole.entities.ItemDemanda.create({
        demanda_id,
        titulo: titulo.trim(),
        descricao: descricao || null,
        tipo_material: tipo_material || null,
        formato: formato || null,
        canal: canal || null,
        ordem: nextOrdem,
        data_prevista: data_prevista || null,
        prazo_data: prazo_data || null,
        responsavel_id: responsavel_id || null,
        responsavel_nome: responsavel_nome || null,
        status_producao: status_producao || 'nao_iniciado',
        status_aprovacao: 'nao_enviado',
        status_publicacao: 'nao_programada',
        status_finalizacao: 'ativo',
      });

      return Response.json({ item: newItem });
    }

    // =====================================================
    // ACTION: update_item — Atualiza um item
    // =====================================================
    if (action === 'update_item') {
      const { item_id, updates } = body;
      if (!item_id) {
        return Response.json({ error: 'item_id é obrigatório.' }, { status: 400 });
      }

      const item = await findItem(item_id);
      if (!item) {
        return Response.json({ error: 'Item não encontrado.' }, { status: 404 });
      }

      // Valida acesso à demanda pai
      const access = await validateDemandaAccess(item.demanda_id);
      if (!access.ok) {
        return Response.json({ error: access.error }, { status: access.status });
      }

      // Impede alteração de demanda_id (integridade)
      if ('demanda_id' in updates && updates.demanda_id !== item.demanda_id) {
        return Response.json({ error: 'Não é permitido alterar o demanda_id de um item.' }, { status: 400 });
      }

      // Valida responsável: não pode ser "manual"
      if (updates.responsavel_id === 'manual') {
        return Response.json({ error: 'responsavel_id não pode ser "manual".' }, { status: 400 });
      }

      // Valida enums nos updates
      if (updates.status_producao && !VALID_STATUS_PRODUCAO.includes(updates.status_producao)) {
        return Response.json({ error: 'status_producao inválido.' }, { status: 400 });
      }
      if (updates.status_aprovacao && !VALID_STATUS_APROVACAO.includes(updates.status_aprovacao)) {
        return Response.json({ error: 'status_aprovacao inválido.' }, { status: 400 });
      }
      if (updates.status_publicacao && !VALID_STATUS_PUBLICACAO.includes(updates.status_publicacao)) {
        return Response.json({ error: 'status_publicacao inválido.' }, { status: 400 });
      }
      if (updates.status_finalizacao && !VALID_STATUS_FINALIZACAO.includes(updates.status_finalizacao)) {
        return Response.json({ error: 'status_finalizacao inválido.' }, { status: 400 });
      }

      // Quando responsavel_id é null, limpar responsavel_nome também
      const finalUpdates = { ...updates };
      if (finalUpdates.responsavel_id === null || finalUpdates.responsavel_id === '') {
        finalUpdates.responsavel_id = null;
        finalUpdates.responsavel_nome = null;
      }

      const updated = await base44.asServiceRole.entities.ItemDemanda.update(item_id, finalUpdates);
      return Response.json({ item: updated });
    }

    // =====================================================
    // ACTION: cancel_item — Cancela um item (operação padrão)
    // =====================================================
    if (action === 'cancel_item') {
      const { item_id } = body;
      if (!item_id) {
        return Response.json({ error: 'item_id é obrigatório.' }, { status: 400 });
      }

      const item = await findItem(item_id);
      if (!item) {
        return Response.json({ error: 'Item não encontrado.' }, { status: 404 });
      }

      const access = await validateDemandaAccess(item.demanda_id);
      if (!access.ok) {
        return Response.json({ error: access.error }, { status: access.status });
      }

      const updated = await base44.asServiceRole.entities.ItemDemanda.update(item_id, {
        status_finalizacao: 'cancelado',
      });

      return Response.json({ item: updated });
    }

    // =====================================================
    // ACTION: reactivate_item — Reativa um item cancelado
    // =====================================================
    if (action === 'reactivate_item') {
      const { item_id } = body;
      if (!item_id) {
        return Response.json({ error: 'item_id é obrigatório.' }, { status: 400 });
      }

      const item = await findItem(item_id);
      if (!item) {
        return Response.json({ error: 'Item não encontrado.' }, { status: 404 });
      }

      const access = await validateDemandaAccess(item.demanda_id);
      if (!access.ok) {
        return Response.json({ error: access.error }, { status: access.status });
      }

      const updated = await base44.asServiceRole.entities.ItemDemanda.update(item_id, {
        status_finalizacao: 'ativo',
      });

      return Response.json({ item: updated });
    }

    // =====================================================
    // ACTION: delete_item — Exclusão física (apenas admin)
    // Impede exclusão se houver atividade/histórico
    // =====================================================
    if (action === 'delete_item') {
      const { item_id, justificativa } = body;
      if (!item_id) {
        return Response.json({ error: 'item_id é obrigatório.' }, { status: 400 });
      }
      if (!isVoxxAdmin) {
        return Response.json({ error: 'Exclusão física restrita a administradores. Use o cancelamento.' }, { status: 403 });
      }
      if (!justificativa || !justificativa.trim()) {
        return Response.json({ error: 'Justificativa é obrigatória para exclusão definitiva.' }, { status: 400 });
      }

      const item = await findItem(item_id);
      if (!item) {
        return Response.json({ error: 'Item não encontrado.' }, { status: 404 });
      }

      // Impede exclusão se houver atividade (status alterado)
      if (item.status_producao !== 'nao_iniciado' || item.status_aprovacao !== 'nao_enviado') {
        return Response.json({
          error: 'Não é possível excluir fisicamente um item com atividade registrada. Use o cancelamento para preservar o histórico.',
        }, { status: 400 });
      }

      // Impede exclusão se já foi cancelado (preservar histórico)
      if (item.status_finalizacao !== 'ativo') {
        return Response.json({
          error: 'Não é possível excluir fisicamente um item já processado. Use o cancelamento.',
        }, { status: 400 });
      }

      await base44.asServiceRole.entities.ItemDemanda.delete(item_id);

      // Normaliza ordem dos itens restantes
      const remaining = await base44.asServiceRole.entities.ItemDemanda.filter(
        { demanda_id: item.demanda_id },
        'ordem',
        200
      );
      const sorted = [...remaining].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
      const reorderPayload = sorted.map((it, idx) => ({ id: it.id, ordem: idx }));
      if (reorderPayload.length > 0) {
        await base44.asServiceRole.entities.ItemDemanda.bulkUpdate(reorderPayload);
      }

      return Response.json({ success: true, normalized_count: reorderPayload.length });
    }

    // =====================================================
    // ACTION: reorder_items — Reordena itens de uma demanda
    // =====================================================
    if (action === 'reorder_items') {
      const { demanda_id, ordered_item_ids } = body;
      if (!demanda_id) {
        return Response.json({ error: 'demanda_id é obrigatório.' }, { status: 400 });
      }
      if (!Array.isArray(ordered_item_ids)) {
        return Response.json({ error: 'ordered_item_ids deve ser um array.' }, { status: 400 });
      }

      const access = await validateDemandaAccess(demanda_id);
      if (!access.ok) {
        return Response.json({ error: access.error }, { status: access.status });
      }

      // Busca itens atuais da demanda
      const currentItems = await base44.asServiceRole.entities.ItemDemanda.filter(
        { demanda_id },
        'ordem',
        200
      );

      // Valida que TODOS os item_ids pertencem à mesma demanda
      const currentIds = new Set(currentItems.map(i => i.id));
      const allBelong = ordered_item_ids.every(id => currentIds.has(id));
      if (!allBelong) {
        return Response.json({ error: 'Todos os itens devem pertencer à mesma demanda.' }, { status: 400 });
      }

      // Impede ordens duplicadas: reatribui sequência 0,1,2,... na ordem fornecida
      const reorderPayload = ordered_item_ids.map((id, idx) => ({ id, ordem: idx }));

      // Operação atômica via bulkUpdate
      await base44.asServiceRole.entities.ItemDemanda.bulkUpdate(reorderPayload);

      return Response.json({ success: true, reordered_count: reorderPayload.length });
    }

    // =====================================================
    // ACTION: duplicate_demanda — Duplica uma demanda composta
    // Cria nova demanda + novos itens (IDs novos, status resetado)
    // =====================================================
    if (action === 'duplicate_demanda') {
      const { demanda_id, novo_titulo } = body;
      if (!demanda_id) {
        return Response.json({ error: 'demanda_id é obrigatório.' }, { status: 400 });
      }

      const access = await validateDemandaAccess(demanda_id);
      if (!access.ok) {
        return Response.json({ error: access.error }, { status: access.status });
      }
      const original = access.demanda;

      // Cria nova demanda (cópia estrutural, sem dados operacionais)
      const novaDemanda = await base44.asServiceRole.entities.Demanda.create({
        cliente_id: original.cliente_id,
        cliente_nome: original.cliente_nome,
        setor: original.setor,
        setor_responsavel_original: original.setor_responsavel_original,
        subcategoria: original.subcategoria,
        titulo: novo_titulo || `${original.titulo} (cópia)`,
        descricao: original.descricao,
        status: 'recebida',
        prioridade: original.prioridade,
        previsao_entrega: null,
        anexos: original.anexos || [],
        campos_adicionais: original.campos_adicionais,
        urgente: false,
        estrutura_demanda: 'composta',
        comunicar_cliente: original.comunicar_cliente,
      });

      // Copia itens (novos IDs, status resetado, sem responsável, sem datas efetivas)
      const itemsOriginal = await base44.asServiceRole.entities.ItemDemanda.filter(
        { demanda_id },
        'ordem',
        200
      );

      const itemsToCreate = itemsOriginal
        .filter(i => i.status_finalizacao !== 'cancelado')
        .map(i => ({
          demanda_id: novaDemanda.id,
          titulo: i.titulo,
          descricao: i.descricao,
          tipo_material: i.tipo_material,
          formato: i.formato,
          canal: i.canal,
          ordem: i.ordem,
          data_prevista: i.data_prevista || null,
          prazo_data: i.prazo_data || null,
          // Resetar status e dados operacionais
          responsavel_id: null,
          responsavel_nome: null,
          status_producao: 'nao_iniciado',
          status_aprovacao: 'nao_enviado',
          status_publicacao: 'nao_programada',
          status_finalizacao: 'ativo',
          data_programada: null,
          data_publicacao: null,
          link_publicacao: null,
        }));

      let novosItens = [];
      if (itemsToCreate.length > 0) {
        novosItens = await base44.asServiceRole.entities.ItemDemanda.bulkCreate(itemsToCreate);
      }

      // Cria TimelineEvent de duplicação (na nova demanda)
      await base44.asServiceRole.entities.TimelineEvent.create({
        demanda_id: novaDemanda.id,
        cliente_id: novaDemanda.cliente_id,
        tipo: 'criacao',
        descricao: `Demanda duplicada de "${original.titulo}".`,
        autor: user.full_name || user.email,
        autor_tipo: 'voxx',
      });

      return Response.json({
        nova_demanda: novaDemanda,
        itens_criados: novosItens.length,
      });
    }

    // =====================================================
    // ACTION: convert_estrutura — Conversão de estrutura
    // =====================================================
    if (action === 'convert_estrutura') {
      const { demanda_id, nova_estrutura, confirmacao } = body;
      if (!demanda_id) {
        return Response.json({ error: 'demanda_id é obrigatório.' }, { status: 400 });
      }
      if (!VALID_ESTRUTURAS.includes(nova_estrutura)) {
        return Response.json({ error: 'nova_estrutura inválida.' }, { status: 400 });
      }

      const access = await validateDemandaAccess(demanda_id);
      if (!access.ok) {
        return Response.json({ error: access.error }, { status: access.status });
      }
      const demanda = access.demanda;
      const estruturaAtual = getEstrutura(demanda);

      // Legada não deve ser convertida automaticamente
      if (estruturaAtual === 'legada') {
        return Response.json({
          error: 'Demandas legadas não podem ser convertidas automaticamente. Conversão manual será tratada posteriormente.',
        }, { status: 400 });
      }

      // Unitária não pode receber itens (não converter para composta sem confirmação)
      if (estruturaAtual === 'unitaria' && nova_estrutura === 'composta') {
        return Response.json({
          error: 'Conversão de unitária para composta requer confirmação explícita.',
        }, { status: 400 });
      }

      // Composta com itens não pode virar unitária
      if (estruturaAtual === 'composta' && nova_estrutura === 'unitaria') {
        const items = await base44.asServiceRole.entities.ItemDemanda.filter(
          { demanda_id },
          'ordem',
          200
        );
        const activeItems = items.filter(i => i.status_finalizacao !== 'cancelado');
        if (activeItems.length > 0) {
          return Response.json({
            error: `Não é possível converter para unitária: existem ${activeItems.length} item(ns) ativo(s). Cancele todos os itens primeiro.`,
          }, { status: 400 });
        }
        // Composta vazia pode voltar para unitária somente com confirmação
        if (!confirmacao || confirmacao !== 'confirmo_conversao_vazia') {
          return Response.json({
            error: 'Confirmação explícita necessária para converter composta vazia em unitária.',
          }, { status: 400 });
        }
      }

      const updated = await base44.asServiceRole.entities.Demanda.update(demanda_id, {
        estrutura_demanda: nova_estrutura,
      });

      return Response.json({ demanda: updated });
    }

    return Response.json({ error: `Action "${action}" não reconhecida.` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});