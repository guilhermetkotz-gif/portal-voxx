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
  console.log('🚀 INICIANDO syncMeta...');
  
  const configs = await base44.asServiceRole.entities.MetaAdsSheetConfig.filter({ tipo: 'monitoramento', ativo: true });
  console.log('📋 Configs encontradas:', configs.length);
  
  if (!configs || configs.length === 0) {
    console.error('❌ Nenhuma config de monitoramento ativa encontrada!');
    return { error: 'No active monitoramento config found' };
  }

  const config = configs[0];
  console.log('✅ Usando config:', config.nome_configuracao);
  console.log('📊 Spreadsheet ID:', config.spreadsheet_id);
  console.log('📄 Aba:', config.aba_ontem);
  console.log('🗺️ Mapeamento de colunas:', config.mapeamento_colunas);
  
  const colMap = config.mapeamento_colunas;
  
  console.log('📥 Buscando dados da planilha...');
  const rows = await fetchSheet(config.spreadsheet_id, config.aba_ontem, accessToken);
  console.log('📦 Total de linhas:', rows.length);
  
  if (rows.length < 2) {
    console.error('❌ Sem dados na planilha Meta!');
    return { error: 'No data in Meta sheet' };
  }

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

  console.log('📊 ÍNDICES DAS COLUNAS META ADS:', {
    messagingConversationsIdx,
    newMessagingConnectionsIdx,
    costPerMessagingIdx,
    col_names: {
      messaging_conversations: colMap['messaging_conversations'],
      new_messaging_connections: colMap['new_messaging_connections'],
      cost_per_messaging: colMap['cost_per_messaging']
    }
  });
  
  console.log('📋 TODOS OS HEADERS DA PLANILHA:', headers);
  
  if (messagingConversationsIdx === -1) {
    console.error('❌ COLUNA messaging_conversations NÃO ENCONTRADA!');
    console.error('   Procurando por:', colMap['messaging_conversations']);
  }
  
  if (newMessagingConnectionsIdx === -1) {
    console.error('❌ COLUNA new_messaging_connections NÃO ENCONTRADA!');
    console.error('   Procurando por:', colMap['new_messaging_connections']);
  }

  // Build cliente map for matching
  const clientes = await base44.asServiceRole.entities.Cliente.list('-created_date', 1000);
  const clienteMap = new Map();
  
  clientes.forEach(c => {
    const keys = [];
    if (c.meta_ads_account_name) keys.push(c.meta_ads_account_name.trim().toLowerCase());
    if (c.nome) keys.push(c.nome.trim().toLowerCase());
    
    keys.forEach(key => {
      const normalized = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
      clienteMap.set(key, c);
      if (key !== normalized) clienteMap.set(normalized, c);
    });
  });

  const accounts = [];
  const seen = new Set();
  const matchLog = [];

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
    
    const keyNormalized = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    const cliente = clienteMap.get(key) || clienteMap.get(keyNormalized);
    
    if (!cliente) {
      matchLog.push(`❌ Meta - SEM MATCH: ${accountName}`);
    } else {
      matchLog.push(`✅ Meta - MATCH: ${accountName} → ${cliente.nome}`);
    }

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

    if (accounts.length === 0) {
      console.log('🔍 DEBUG PRIMEIRA CONTA META:', {
        accountName,
        messagingConversationsIdx,
        newMessagingConnectionsIdx,
        messagingConversations_raw: row[messagingConversationsIdx],
        newMessagingConnections_raw: row[newMessagingConnectionsIdx],
        messagingConversations,
        newMessagingConnections,
        cost_per_messaging: costPerMessaging
      });
    }
    
    if (accountName.includes('Fortaleza')) {
      console.log('🔥 DEBUG FORTALEZA COMPLETO:', {
        accountName,
        indices: {
          messagingConversationsIdx,
          newMessagingConnectionsIdx,
          costPerMessagingIdx
        },
        valores_raw: {
          messaging_conversations: row[messagingConversationsIdx],
          new_messaging_connections: row[newMessagingConnectionsIdx],
          cost_per_messaging: row[costPerMessagingIdx]
        },
        valores_parsed: {
          messagingConversations,
          newMessagingConnections,
          costPerMessaging
        },
        row_completa: row
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

  if (matchLog.length > 0) {
    console.log('📊 MATCHING META ADS:\n' + matchLog.slice(0, 10).join('\n'));
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

  // Build cliente map for matching
  const clientes = await base44.asServiceRole.entities.Cliente.list('-created_date', 1000);
  
  console.log('🔍 TOTAL DE CLIENTES:', clientes.length);
  console.log('🔍 EXEMPLOS DE NOMES:', clientes.slice(0, 5).map(c => ({
    nome: c.nome,
    google_ads_account_name: c.google_ads_account_name,
    meta_ads_account_name: c.meta_ads_account_name
  })));
  
  const clienteMap = new Map();
  
  clientes.forEach(c => {
    const keys = [];
    
    // 1. google_ads_account_name (exato)
    if (c.google_ads_account_name) {
      keys.push(c.google_ads_account_name.trim().toLowerCase());
    }
    
    // 2. nome do cliente (exato)
    if (c.nome) {
      keys.push(c.nome.trim().toLowerCase());
    }
    
    // 3. Extrair parte "cidade" dos account_names com formato "XXX - Oral Sin - Cidade"
    if (c.google_ads_account_name && c.google_ads_account_name.includes(' - ')) {
      const parts = c.google_ads_account_name.split(' - ');
      const lastPart = parts[parts.length - 1].trim().toLowerCase();
      keys.push(lastPart);
      keys.push(`oral sin - ${lastPart}`);
    }
    
    keys.forEach(key => {
      const normalized = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
      clienteMap.set(key, c);
      if (key !== normalized) clienteMap.set(normalized, c);
    });
  });
  
  console.log('🔍 TOTAL DE CHAVES NO MAPA:', clienteMap.size);

  const accounts = [];
  const seen = new Set();
  const matchLog = [];

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
    
    // Tentar múltiplas variações para matching
    const keyNormalized = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    
    // Variações de matching
    const matchKeys = [key, keyNormalized];
    
    // Se tiver formato "XXX - Oral Sin - Cidade", extrair variações
    if (accountName.includes(' - ')) {
      const parts = accountName.split(' - ');
      
      // Última parte (Cidade)
      const cidade = parts[parts.length - 1].trim().toLowerCase();
      matchKeys.push(cidade);
      
      // "Oral Sin - Cidade" (sem o número)
      if (parts.length >= 3) {
        const semNumero = parts.slice(1).join(' - ').trim().toLowerCase();
        matchKeys.push(semNumero);
        matchKeys.push(semNumero.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim());
      }
      
      // Também tentar com "oral sin - cidade"
      matchKeys.push(`oral sin - ${cidade}`);
      matchKeys.push(`oral sin - ${cidade}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim());
    }
    
    let cliente = null;
    for (const k of matchKeys) {
      cliente = clienteMap.get(k);
      if (cliente) break;
    }
    
    if (!cliente) {
      matchLog.push(`❌ Google - SEM MATCH: ${accountName}`);
      if (matchLog.length <= 3) {
        console.log(`  🔎 Account: "${accountName}"`);
        console.log(`  🔎 Tentativas:`, matchKeys.slice(0, 6));
      }
    } else {
      matchLog.push(`✅ Google - MATCH: ${accountName} → ${cliente.nome}`);
    }

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

  if (matchLog.length > 0) {
    console.log('📊 MATCHING GOOGLE ADS:\n' + matchLog.slice(0, 10).join('\n'));
  }

  const existingAccounts = await base44.asServiceRole.entities.GoogleAdsAccount.list('-created_date', 1000);
  const existingMap = new Map(existingAccounts.map(a => [a.account_name?.trim().toLowerCase(), a]));
  
  await Promise.all(accounts.map(async (newAcc) => {
    const key = newAcc.account_name.trim().toLowerCase();
    const keyNormalized = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    const existing = existingMap.get(key);
    const cliente = clienteMap.get(key) || clienteMap.get(keyNormalized);
    
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