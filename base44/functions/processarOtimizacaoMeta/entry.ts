import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { event, data } = body;

    if (!event?.entity_id) {
      return Response.json({ skipped: true, reason: 'no entity_id' });
    }

    const otimId = event.entity_id;
    const otim = data || await base44.asServiceRole.entities.MetaAdsOtimizacao.get(otimId);

    if (!otim) {
      return Response.json({ skipped: true, reason: 'otimizacao not found' });
    }

    // Todas as otimizações participam da comunicação com o cliente

    if (otim.comunicacao_enviada_fila) {
      return Response.json({ skipped: true, reason: 'ja na fila' });
    }

    // Verificar duplicata
    const existing = await base44.asServiceRole.entities.FilaComunicacaoCliente.filter({
      origem_id: otimId,
      status: 'aguardando'
    });
    if (existing.length > 0) {
      return Response.json({ skipped: true, reason: 'duplicata', fila_id: existing[0].id });
    }

    // Encontrar o cliente pelo account_name
    const clientes = await base44.asServiceRole.entities.Cliente.filter({
      meta_ads_account_name: otim.account_name
    });
    const cliente = clientes[0] || null;

    if (!cliente) {
      return Response.json({ skipped: true, reason: `cliente nao encontrado para account: ${otim.account_name}` });
    }

    const resumo = otim.resumo_para_cliente || otim.resumo_acao || otim.objetivo || 'Otimização realizada nas campanhas Meta Ads';
    const hoje = otim.data_acao || new Date().toISOString().split('T')[0];

    const item = await base44.asServiceRole.entities.FilaComunicacaoCliente.create({
      cliente_id: cliente.id,
      cliente_nome: cliente.nome,
      origem: 'meta_ads',
      origem_id: otimId,
      tipo_evento: 'otimizacao',
      tipo_entrega: 'Meta Ads',
      resumo,
      data_evento: hoje,
      usuario_responsavel: otim.created_by || '',
      usuario_responsavel_nome: '',
      anexos: [],
      status: 'aguardando'
    });

    // Marcar como enviada
    await base44.asServiceRole.entities.MetaAdsOtimizacao.update(otimId, {
      comunicacao_enviada_fila: true
    });

    return Response.json({ success: true, fila_id: item.id, cliente_nome: cliente.nome });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});