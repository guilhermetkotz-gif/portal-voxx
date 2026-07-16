import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { event, data } = body;

    if (!event?.entity_id) {
      return Response.json({ skipped: true, reason: 'no entity_id' });
    }

    const timelineEvent = data;
    if (!timelineEvent) {
      return Response.json({ skipped: true, reason: 'no data' });
    }

    // Only process comments and attachments (not status changes etc.)
    if (timelineEvent.tipo !== 'comentario' && timelineEvent.tipo !== 'anexo') {
      return Response.json({ skipped: true, reason: 'tipo nao relevante' });
    }

    // Only process voxx team comments
    if (timelineEvent.autor_tipo !== 'voxx') {
      return Response.json({ skipped: true, reason: 'autor nao e voxx' });
    }

    const timelineEventId = timelineEvent.id || event.entity_id;
    const demandaId = timelineEvent.demanda_id;
    if (!demandaId) {
      return Response.json({ skipped: true, reason: 'sem demanda_id' });
    }

    // Dedup: skip if this TimelineEvent was already mirrored
    const existing = await base44.asServiceRole.entities.MetaAdsOtimizacao.filter({
      timeline_event_id: timelineEventId,
      origem_registro: 'kanban'
    });
    if (existing.length > 0) {
      return Response.json({ skipped: true, reason: 'ja espelhado', otimizacao_id: existing[0].id });
    }

    // Fetch the demanda (use try/catch — invalid id formats throw before querying)
    let demanda = null;
    try {
      const demandas = await base44.asServiceRole.entities.Demanda.filter({ id: demandaId });
      demanda = demandas[0] || null;
    } catch (e) {
      return Response.json({ skipped: true, reason: 'demanda nao encontrada (id invalido)' });
    }
    if (!demanda) {
      return Response.json({ skipped: true, reason: 'demanda nao encontrada' });
    }

    // Check if setor (original or current) is TRAFEGO_META
    const setorOriginal = demanda.setor_responsavel_original;
    const setorAtual = demanda.setor;
    if (setorOriginal !== 'TRAFEGO_META' && setorAtual !== 'TRAFEGO_META') {
      return Response.json({ skipped: true, reason: 'setor nao e TRAFEGO_META' });
    }

    // Fetch the cliente to get meta_ads_account_name
    let clienteId = demanda.cliente_id || timelineEvent.cliente_id || '';
    let clienteNome = demanda.cliente_nome || '';
    let accountName = demanda.account_name || '';

    if (!accountName || !clienteId) {
      try {
        const clientes = await base44.asServiceRole.entities.Cliente.filter({ id: clienteId });
        const cliente = clientes[0];
        if (cliente) {
          clienteId = clienteId || cliente.id;
          clienteNome = clienteNome || cliente.nome;
          accountName = accountName || cliente.meta_ads_account_name || '';
        }
      } catch (e) {
        // cliente lookup failed — will skip if accountName is still empty
      }
    }

    if (!accountName) {
      return Response.json({ skipped: true, reason: 'cliente sem meta_ads_account_name' });
    }

    // Find ContaMetaAds by account_name
    const contasMeta = await base44.asServiceRole.entities.ContaMetaAds.filter({ account_name: accountName });
    const contaMeta = contasMeta[0] || null;
    const contaMetaAdsId = contaMeta?.id || accountName;

    // Build the optimization record
    const comentarioTexto = timelineEvent.descricao || '(sem texto)';
    const resumo = comentarioTexto.length > 120
      ? comentarioTexto.substring(0, 120) + '...'
      : comentarioTexto;
    const today = new Date().toISOString().split('T')[0];

    const otim = await base44.asServiceRole.entities.MetaAdsOtimizacao.create({
      cliente_id: clienteId,
      cliente_nome: clienteNome,
      conta_meta_ads_id: contaMetaAdsId,
      account_name: accountName,
      data_acao: today,
      status_cliente: 'sem_dados',
      problema: 'Ação registrada via demanda no Kanban',
      objetivo: 'Otimização solicitada via Kanban',
      acoes_implementadas: comentarioTexto,
      resumo_acao: resumo,
      usuario_nome: timelineEvent.autor || '',
      usuario_email: '',
      comunicar_cliente: false,
      comunicacao_enviada_fila: false,
      origem_registro: 'kanban',
      demanda_id: demandaId,
      timeline_event_id: timelineEventId
    });

    // Note: The existing "Snapshot T0 - Eficácia Otimização" entity automation
    // on MetaAdsOtimizacao create will automatically trigger salvarSnapshotT0.

    return Response.json({
      success: true,
      otimizacao_id: otim.id,
      origem: 'kanban'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});