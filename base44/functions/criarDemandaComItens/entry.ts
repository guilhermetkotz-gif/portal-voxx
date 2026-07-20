import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Usuário autenticado
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Usuário não autenticado.' }, { status: 401 });
    }

    // 2. Permissões — apenas usuários VOXX
    const tipoUsuario = user.tipo_usuario || user.tipo_acesso || '';
    const isVoxxUser = tipoUsuario.startsWith('voxx_') || user.role === 'admin';

    if (!isVoxxUser) {
      return Response.json({ error: 'Acesso negado. Apenas usuários VOXX podem criar demandas compostas.' }, { status: 403 });
    }

    const body = await req.json();
    const { demanda: demandaData, itens: itensData } = body;

    // 3. Validar dados da demanda
    if (!demandaData) {
      return Response.json({ error: 'Dados da demanda são obrigatórios.' }, { status: 400 });
    }
    if (!demandaData.cliente_id) {
      return Response.json({ error: 'Cliente é obrigatório.' }, { status: 400 });
    }
    if (!demandaData.setor) {
      return Response.json({ error: 'Setor é obrigatório.' }, { status: 400 });
    }
    if (!demandaData.titulo || !demandaData.titulo.trim()) {
      return Response.json({ error: 'Título da demanda é obrigatório.' }, { status: 400 });
    }

    // 4. Validar itens
    if (!itensData || !Array.isArray(itensData)) {
      return Response.json({ error: 'Lista de entregas é obrigatória.' }, { status: 400 });
    }

    const validItems = itensData.filter(i => i.titulo && i.titulo.trim());
    if (validItems.length < 2) {
      return Response.json({
        error: 'Demanda composta deve possuir no mínimo 2 entregas com título preenchido.',
        code: 'MIN_ITEMS_NOT_MET',
        valid_count: validItems.length,
      }, { status: 400 });
    }

    if (validItems.length < itensData.length) {
      const incomplete = itensData.length - validItems.length;
      return Response.json({
        error: `${incomplete} entrega(s) sem título. Todas as entregas devem possuir título preenchido.`,
        code: 'INCOMPLETE_ITEMS',
      }, { status: 400 });
    }

    // 5. Criar a Demanda
    const demandaPayload = {
      ...demandaData,
      titulo: demandaData.titulo.trim(),
      estrutura_demanda: 'composta',
      status: demandaData.status || 'recebida',
      prioridade: demandaData.prioridade || 'media',
      created_by_id: user.id,
    };

    let demanda;
    try {
      demanda = await base44.asServiceRole.entities.Demanda.create(demandaPayload);
    } catch (err) {
      return Response.json({
        error: 'Falha ao criar demanda: ' + (err.message || 'erro desconhecido'),
        code: 'DEMANDA_CREATE_FAILED',
      }, { status: 500 });
    }

    // 6. Criar todos os ItemDemanda — preservar ordem
    const createdItems = [];
    const errors = [];

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      try {
        const created = await base44.asServiceRole.entities.ItemDemanda.create({
          demanda_id: demanda.id,
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
          status_producao: 'nao_iniciado',
          status_aprovacao: 'nao_enviado',
          status_publicacao: 'nao_programada',
          status_finalizacao: 'ativo',
        });
        createdItems.push(created);
      } catch (err) {
        errors.push({ item_titulo: item.titulo, error: err.message || 'erro desconhecido' });
      }
    }

    // 7. Falha parcial — rollback (deletar demanda + itens criados)
    if (errors.length > 0) {
      // Deletar itens que foram criados
      for (const item of createdItems) {
        try {
          await base44.asServiceRole.entities.ItemDemanda.delete(item.id);
        } catch {
          // melhor esforço
        }
      }
      // Deletar a demanda
      try {
        await base44.asServiceRole.entities.Demanda.delete(demanda.id);
      } catch {
        // melhor esforço
      }

      return Response.json({
        error: `Falha ao criar ${errors.length} de ${validItems.length} entregas. Operação cancelada — nenhum registro foi mantido.`,
        code: 'PARTIAL_FAILURE_ROLLBACK',
        details: errors,
        demanda_id: null,
      }, { status: 500 });
    }

    // 8. Sucesso
    return Response.json({
      success: true,
      demanda_id: demanda.id,
      itens_criados: createdItems.length,
      itens: createdItems.map((it, i) => ({
        id: it.id,
        titulo: it.titulo,
        ordem: i,
      })),
    });

  } catch (error) {
    return Response.json({
      error: 'Erro interno: ' + (error.message || 'erro desconhecido'),
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
});