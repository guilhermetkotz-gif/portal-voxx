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

    // Verificar se já existe avaliação para esta otimização
    const existing = await base44.asServiceRole.entities.AvaliacaoEficaciaOtimizacao.filter({
      otimizacao_id: otimId
    });
    if (existing.length > 0) {
      return Response.json({ skipped: true, reason: 'ja existe avaliacao' });
    }

    const accountName = otim.account_name;
    if (!accountName) {
      return Response.json({ skipped: true, reason: 'sem account_name' });
    }

    // Buscar RadarMetaData no momento T0
    const radarData = await base44.asServiceRole.entities.RadarMetaData.filter({
      account_name: accountName
    });
    const radar = radarData[0] || null;

    // Buscar ContaMetaAds no momento T0
    const contasMeta = await base44.asServiceRole.entities.ContaMetaAds.filter({
      account_name: accountName
    });
    const contaMeta = contasMeta[0] || null;

    // Buscar cliente para ter cliente_id
    let clienteId = otim.cliente_id || '';
    let clienteNome = otim.cliente_nome || '';
    if (!clienteId) {
      const clientes = await base44.asServiceRole.entities.Cliente.filter({
        meta_ads_account_name: accountName
      });
      if (clientes[0]) {
        clienteId = clientes[0].id;
        clienteNome = clientes[0].nome;
      }
    }

    // Montar snapshot T0
    const snapshotT0 = {
      cpl_7d: radar?.cpl_7d || 0,
      leads_7d: radar?.leads_7d || 0,
      leads_7d_media_dia: radar?.leads_7d_media_dia || 0,
      ctr_7d: radar?.ctr_7d || 0,
      frequencia_7d: radar?.frequencia_7d || 0,
      amount_spent_ontem: radar?.amount_spent_ontem || 0,
      leads_ontem: radar?.leads_ontem || 0,
      cpl_ontem: radar?.cpl_ontem || 0,
      ctr_ontem: radar?.ctr_ontem || 0,
      frequencia_ontem: radar?.frequencia_ontem || 0,
      nota_gpt: contaMeta?.nota_gpt || 0,
      classificacao: contaMeta?.classificacao || '',
      cpl_meta_ads: contaMeta?.cpl_meta_ads || 0,
      messaging_conversations: contaMeta?.messaging_conversations || 0,
      new_messaging_connections: contaMeta?.new_messaging_connections || 0,
      leads: contaMeta?.leads || 0,
      cadastros_whats: contaMeta?.cadastros_whats || 0,
      amount_spent: contaMeta?.amount_spent || 0,
      coletado_em: new Date().toISOString()
    };

    // Criar registro de avaliação pendente
    const avaliacao = await base44.asServiceRole.entities.AvaliacaoEficaciaOtimizacao.create({
      otimizacao_id: otimId,
      cliente_id: clienteId,
      cliente_nome: clienteNome,
      account_name: accountName,
      data_otimizacao: otim.data_acao || new Date().toISOString().split('T')[0],
      status: 'pendente',
      snapshot_t0: snapshotT0,
      total_mensagens_whatsapp: 0
    });

    return Response.json({
      success: true,
      avaliacao_id: avaliacao.id,
      snapshot_t0: snapshotT0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});