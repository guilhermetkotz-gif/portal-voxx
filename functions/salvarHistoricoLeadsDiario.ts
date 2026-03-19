import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today = new Date();
    // Use São Paulo timezone offset (-3h)
    const spOffset = -3 * 60;
    const localTime = new Date(today.getTime() + (spOffset - today.getTimezoneOffset()) * 60000);
    const dataSnapshot = localTime.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`Saving daily snapshot for date: ${dataSnapshot}`);

    // Fetch all clients
    const clientes = await base44.asServiceRole.entities.Cliente.list('-created_date', 500);
    const clientesAtivos = clientes.filter(c => c.status === 'ativo' || c.ativo !== false);

    // Fetch current Meta Ads accounts data
    const contasMeta = await base44.asServiceRole.entities.ContaMetaAds.list('-created_date', 1000);
    const metaByName = {};
    contasMeta.forEach(c => {
      if (c.account_name) metaByName[c.account_name.toLowerCase().trim()] = c;
    });

    // Fetch Google CRC Leads (google_sheet source) — count per client
    const allGoogleLeads = await base44.asServiceRole.entities.CrcLead.filter({ fonte_cadastro: 'google_sheet' });
    const googleLeadsByClient = {};
    allGoogleLeads.forEach(lead => {
      if (!lead.unidade_id) return;
      googleLeadsByClient[lead.unidade_id] = (googleLeadsByClient[lead.unidade_id] || 0) + 1;
    });

    // Check existing snapshots for today to avoid duplicates
    const existingSnapshots = await base44.asServiceRole.entities.HistoricoLeadsDiario.filter({ data_snapshot: dataSnapshot });
    const existingClienteIds = new Set(existingSnapshots.map(s => s.cliente_id));

    const snapshots = [];

    for (const cliente of clientesAtivos) {
      // Skip if already saved today
      if (existingClienteIds.has(cliente.id)) {
        console.log(`Skipping ${cliente.nome} — already saved for ${dataSnapshot}`);
        continue;
      }

      // Find Meta Ads data for this client
      const clienteNameLower = (cliente.meta_ads_account_name || cliente.nome || '').toLowerCase().trim();
      const contaMeta = metaByName[clienteNameLower] || 
        Object.values(metaByName).find(c => c.account_name?.toLowerCase().includes(clienteNameLower) || clienteNameLower.includes(c.account_name?.toLowerCase()));

      const leadsMetaCount = contaMeta?.cadastros_whats ?? contaMeta?.new_messaging_connections ?? contaMeta?.messaging_conversations ?? 0;
      const cplMeta = contaMeta?.cost_per_new_messaging ?? contaMeta?.cost_per_messaging ?? null;
      const investimentoMeta = contaMeta?.amount_spent ?? null;

      // Google leads count from CRC entity
      const leadsGoogleCount = googleLeadsByClient[cliente.id] || 0;

      snapshots.push({
        cliente_id: cliente.id,
        cliente_nome: cliente.nome,
        data_snapshot: dataSnapshot,
        leads_meta: leadsMetaCount,
        leads_google: leadsGoogleCount,
        leads_total: leadsMetaCount + leadsGoogleCount,
        cpl_meta: cplMeta,
        investimento_meta: investimentoMeta,
      });
    }

    if (snapshots.length > 0) {
      await base44.asServiceRole.entities.HistoricoLeadsDiario.bulkCreate(snapshots);
      console.log(`Saved ${snapshots.length} snapshots for ${dataSnapshot}`);
    }

    return Response.json({
      success: true,
      date: dataSnapshot,
      snapshotsSaved: snapshots.length,
      skipped: clientesAtivos.length - snapshots.length
    });

  } catch (error) {
    console.error('Error saving daily leads history:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});