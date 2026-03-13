import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const parseNumber = (val) => {
  if (!val) return 0;
  const str = typeof val === 'string' ? val.replace(/[R$\s]/g, '').replace(',', '.') : String(val);
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const parsePercentage = (val) => {
  if (!val) return 0;
  const str = typeof val === 'string' ? val.replace(/[^\d.,]/g, '').replace(',', '.') : String(val);
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

async function fetchSheet(spreadsheetId, sheetName, accessToken) {
  const range = encodeURIComponent(sheetName) + '!A:Z';
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error(`Failed to fetch sheet "${sheetName}": ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.values || [];
}

async function syncMeta(base44, accessToken) {
  const configs = await base44.asServiceRole.entities.MetaAdsSheetConfig.filter({ tipo: 'monitoramento', ativo: true });
  if (!configs || configs.length === 0) return { error: 'No active monitoramento config found' };

  const config = configs[0];
  const colMap = config.mapeamento_colunas;
  const rows = await fetchSheet(config.spreadsheet_id, config.aba_ontem, accessToken);
  if (rows.length < 2) return { error: 'No data in Meta sheet' };

  const headers = rows[0];
  const getIdx = (key) => {
    const col = colMap[key];
    if (!col) return -1;
    return headers.findIndex(h => h && h.toLowerCase().includes(col.toLowerCase()));
  };

  const accountNameIdx = getIdx('account_name');
  const impressionsIdx = getIdx('impressions');
  const costPerMessagingIdx = getIdx('cost_per_messaging');
  const frequencyIdx = getIdx('frequency');
  const costPerUniqueLinkIdx = getIdx('cost_per_unique_link');
  const pageEngagementIdx = getIdx('page_engagement');
  const pageLikesIdx = getIdx('page_likes');
  const reachIdx = getIdx('reach');
  const amountSpentIdx = getIdx('amount_spent');
  const clicksAllIdx = getIdx('clicks_all');
  const cpcIdx = getIdx('cpc');
  const messagingConversationsIdx = getIdx('messaging_conversations');
  const costPerNewMessagingIdx = getIdx('cost_per_new_messaging');
  const newMessagingConnectionsIdx = getIdx('new_messaging_connections');
  const custoEngajamentoIdx = getIdx('custo_engajamento');
  const leadsRepetidosIdx = getIdx('leads_repetidos');
  const notaGPTIdx = getIdx('nota_gpt');

  const accounts = [];
  const seen = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const accountName = (row[accountNameIdx] || '').trim();
    if (!accountName) continue;
    const key = accountName.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);

    const notaGPT = parseNumber(row[notaGPTIdx]);
    const frequency = parseNumber(row[frequencyIdx]);
    const leadsRepetidos = parsePercentage(row[leadsRepetidosIdx]);
    const costPerMessaging = parseNumber(row[costPerMessagingIdx]);
    const investimento = parseNumber(row[amountSpentIdx]);

    let classificacao;
    if (notaGPT >= 90) classificacao = 'ELITE';
    else if (notaGPT >= 80) classificacao = 'SAUDÁVEL';
    else if (notaGPT >= 65) classificacao = 'OPERACIONAL';
    else if (notaGPT >= 50) classificacao = 'ALERTA';
    else classificacao = 'CRÍTICO';

    const isCritical = frequency >= 4.6 || leadsRepetidos >= 28 || costPerMessaging >= 55;
    const isHighSpend = investimento >= 2000;
    let prioridade;
    if (notaGPT < 50 || (isCritical && isHighSpend)) prioridade = 'P1';
    else if ((notaGPT >= 50 && notaGPT < 65) || isCritical) prioridade = 'P2';
    else prioridade = 'P3';

    let mainIssue;
    if (frequency >= 4.6) mainIssue = 'Frequência alta (saturação / criativo cansado)';
    else if (leadsRepetidos >= 28) mainIssue = 'Leads repetidos (público pequeno / repetição)';
    else if (costPerMessaging >= 55) mainIssue = 'Custo por conversa alto (criativo/oferta/qualificação)';
    else mainIssue = 'Saudável (monitorar)';

    const messagingConversations = parseNumber(row[messagingConversationsIdx]);
    const newMessagingConnections = parseNumber(row[newMessagingConnectionsIdx]);

    // Debug para primeira conta
    if (accounts.length === 0) {
      console.log('🔍 DEBUG PRIMEIRA CONTA:', {
        accountName,
        messagingConversationsIdx,
        newMessagingConnectionsIdx,
        messagingConversations_raw: row[messagingConversationsIdx],
        newMessagingConnections_raw: row[newMessagingConnectionsIdx],
        messagingConversations,
        newMessagingConnections
      });
    }

    accounts.push({
      account_name: accountName,
      impressions: parseNumber(row[impressionsIdx]),
      cost_per_messaging: costPerMessaging,
      frequency,
      cost_per_unique_link: parseNumber(row[costPerUniqueLinkIdx]),
      page_engagement: parseNumber(row[pageEngagementIdx]),
      page_likes: parseNumber(row[pageLikesIdx]),
      reach: parseNumber(row[reachIdx]),
      amount_spent: investimento,
      clicks_all: parseNumber(row[clicksAllIdx]),
      cpc: parseNumber(row[cpcIdx]),
      messaging_conversations: messagingConversations,
      cost_per_new_messaging: parseNumber(row[costPerNewMessagingIdx]),
      new_messaging_connections: newMessagingConnections,
      custo_engajamento: parseNumber(row[custoEngajamentoIdx]),
      leads_repetidos_percent: leadsRepetidos,
      nota_gpt: notaGPT,
      classificacao,
      prioridade,
      main_issue: mainIssue
    });
  }

  const existing = await base44.asServiceRole.entities.ContaMetaAds.list('-created_date', 1000);
  await Promise.all(existing.map(a => base44.asServiceRole.entities.ContaMetaAds.delete(a.id)));
  if (accounts.length > 0) {
    await base44.asServiceRole.entities.ContaMetaAds.bulkCreate(accounts);
  }

  console.log(`Meta sync: ${accounts.length} accounts processed`);
  return { accountsProcessed: accounts.length };
}

async function syncGoogle(base44, accessToken) {
  const configs = await base44.asServiceRole.entities.MetaAdsSheetConfig.filter({ tipo: 'google_ads', ativo: true });
  if (!configs || configs.length === 0) return { error: 'No active Google Ads config found' };

  const config = configs[0];
  const colMap = config.mapeamento_colunas;
  const rows = await fetchSheet(config.spreadsheet_id, config.aba_ontem, accessToken);
  if (rows.length < 2) return { error: 'No data in Google Ads sheet' };

  const headers = rows[0];
  const getIdx = (key) => {
    const col = colMap[key];
    if (!col) return -1;
    return headers.findIndex(h => h && h.trim().includes(col));
  };

  const accountNameIdx = getIdx('account_name');
  const clicksIdx = getIdx('clicks');
  const conversionsIdx = getIdx('conversions');
  const allConversionsIdx = getIdx('all_conversions');
  const costIdx = getIdx('cost');
  const costPerConversionIdx = getIdx('cost_per_conversion');
  const avgCpcIdx = getIdx('avg_cpc');
  const avgCpmIdx = getIdx('avg_cpm');
  const optimizationScoreIdx = getIdx('optimization_score');

  const accounts = [];
  const seen = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const accountName = (row[accountNameIdx] || '').trim();
    if (!accountName) continue;
    const key = accountName.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);

    let unidadeNome = accountName;
    if (accountName.includes(' - ')) {
      const parts = accountName.split(' - ');
      unidadeNome = parts[parts.length - 1].trim();
    }

    const clicks = parseNumber(row[clicksIdx]);
    const conversions = parseNumber(row[conversionsIdx]);
    const cost = parseNumber(row[costIdx]);

    accounts.push({
      account_name: accountName,
      unidade_nome: unidadeNome,
      cliente_nome: accountName.includes('Oral Sin') ? 'Oral Sin' : 'Outro',
      clicks,
      conversions,
      all_conversions: parseNumber(row[allConversionsIdx]) || conversions,
      cost,
      cost_per_conversion: parseNumber(row[costPerConversionIdx]),
      avg_cpc: parseNumber(row[avgCpcIdx]),
      avg_cpm: parseNumber(row[avgCpmIdx]),
      optimization_score: parseNumber(row[optimizationScoreIdx]),
      account_status: 'Ativa',
      conta_sem_dados: clicks === 0 && conversions === 0 && cost === 0,
      data_atualizacao: new Date().toISOString(),
      fonte_dados: 'Google Ads Sheet'
    });
  }

  const existingAccounts = await base44.asServiceRole.entities.GoogleAdsAccount.list('-created_date', 1000);
  const clientes = await base44.asServiceRole.entities.Cliente.list('-created_date', 1000);

  const existingMap = new Map(existingAccounts.map(a => [a.account_name?.trim().toLowerCase(), a]));
  const clienteMap = new Map(clientes.filter(c => c.google_ads_account_name)
    .map(c => [c.google_ads_account_name.trim().toLowerCase(), c]));

  await Promise.all(accounts.map(async (newAcc) => {
    const key = newAcc.account_name.trim().toLowerCase();
    const existing = existingMap.get(key);
    const cliente = clienteMap.get(key);
    const updateData = { ...newAcc };
    if (cliente?.responsavel_google_ads) updateData.responsavel_voxx = cliente.responsavel_google_ads;
    else if (existing?.responsavel_voxx) updateData.responsavel_voxx = existing.responsavel_voxx;

    if (existing) {
      return base44.asServiceRole.entities.GoogleAdsAccount.update(existing.id, updateData);
    } else {
      return base44.asServiceRole.entities.GoogleAdsAccount.create(updateData);
    }
  }));

  console.log(`Google Ads sync: ${accounts.length} accounts processed`);
  return { accountsProcessed: accounts.length };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('syncClientesFromSheets: starting...');

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    const [metaResult, googleResult] = await Promise.allSettled([
      syncMeta(base44, accessToken),
      syncGoogle(base44, accessToken)
    ]);

    const meta = metaResult.status === 'fulfilled' ? metaResult.value : { error: metaResult.reason?.message };
    const google = googleResult.status === 'fulfilled' ? googleResult.value : { error: googleResult.reason?.message };

    console.log('Sync complete:', { meta, google });

    return Response.json({ success: true, meta, google });

  } catch (error) {
    console.error('syncClientesFromSheets error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});