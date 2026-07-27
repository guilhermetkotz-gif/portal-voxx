import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const extractSpreadsheetId = (url) => {
  const match = url?.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

const normalizePhone = (phone) => {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
};

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    const timeMatch = str.match(/(\d{2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : '00:00';
    return new Date(`${year}-${month}-${day}T${time}:00.000Z`).toISOString();
  }
  const date = new Date(str);
  if (!isNaN(date.getTime())) return date.toISOString();
  return null;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const BATCH_SIZE = 5; // Process 5 clients per run to avoid rate limits

async function processCliente(cliente, accessToken, existingPhoneKeys, base44) {
  const spreadsheetId = extractSpreadsheetId(cliente.google_leads_sheet_url);
  if (!spreadsheetId) {
    return { cliente: cliente.nome, error: 'Invalid Google Sheets URL', imported: 0 };
  }

  // Get CrcConfig for column mapping
  const configs = await base44.asServiceRole.entities.CrcConfig.filter({ unidade_id: cliente.id });
  const mapping = configs[0]?.mapeamento_planilha || {};

  const colNome = mapping.coluna_nome || 'Nome';
  const colTelefone = mapping.coluna_telefone || 'Telefone';
  const colData = mapping.coluna_data || 'Data';
  const colOrigem = mapping.coluna_origem || 'Origem';
  const colCampanha = mapping.coluna_campanha || 'Campanha';
  const colLinkAnuncio = mapping.coluna_link_anuncio || 'Link Anúncio';
  const colObservacao = mapping.coluna_observacao || 'Observação';

  // Get sheet metadata to find ALL sheet names
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!metaRes.ok) {
    const errBody = await metaRes.text();
    return { cliente: cliente.nome, error: `Sheet error: ${metaRes.status}`, imported: 0 };
  }

  const meta = await metaRes.json();
  const allSheets = meta.sheets || [];
  let imported = 0;

  for (const sheet of allSheets) {
    const sheetName = sheet.properties?.title;
    if (!sheetName) continue;

    await sleep(1000);

    const dataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!dataRes.ok) continue;

    const sheetData = await dataRes.json();
    const rows = sheetData.values || [];
    if (rows.length < 2) continue;

    const headers = rows[0];
    const findCol = (name) => headers.findIndex(h => h && h.toLowerCase().trim() === name.toLowerCase().trim());

    const idxNome = findCol(colNome);
    const idxTelefone = findCol(colTelefone);
    const idxData = findCol(colData);
    const idxOrigem = findCol(colOrigem);
    const idxCampanha = findCol(colCampanha);
    const idxLink = findCol(colLinkAnuncio);
    const idxObs = findCol(colObservacao);

    if (idxTelefone < 0) {
      console.log(`Sheet "${sheetName}" for ${cliente.nome}: no phone column. Headers: ${headers.slice(0,5).join(', ')}`);
      continue;
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const telefone = normalizePhone(row[idxTelefone]);
      if (!telefone) continue;

      const phoneKey = `${cliente.id}|${telefone}`;
      if (existingPhoneKeys.has(phoneKey)) continue;

      const origemRaw = (idxOrigem >= 0 ? row[idxOrigem] || '' : '').toLowerCase();
      const isLigacao = origemRaw.includes('liga') || origemRaw.includes('call');
      const origem = isLigacao ? 'google_ligacao' : 'google_cadastro';
      const dataChegada = parseDate(idxData >= 0 ? row[idxData] : '') || new Date().toISOString();
      const campanha = idxCampanha >= 0 ? row[idxCampanha] || '' : '';
      const obs = idxObs >= 0 ? row[idxObs] || '' : '';
      const observacoes = [campanha ? `Campanha: ${campanha}` : '', obs].filter(Boolean).join(' | ');

      await base44.asServiceRole.entities.CrcLead.create({
        unidade_id: cliente.id,
        nome: idxNome >= 0 ? row[idxNome] || '' : '',
        telefone,
        origem,
        canal: isLigacao ? 'ligacao' : 'formulario',
        tratamento: 'nao_informado',
        status: 'sem_contato',
        fonte_cadastro: 'google_sheet',
        external_source: 'google_sheets',
        external_row_id: `${spreadsheetId}_${sheetName}_row_${i}`,
        external_created_at: dataChegada,
        data_chegada: dataChegada,
        link_anuncio: idxLink >= 0 ? row[idxLink] || '' : '',
        observacoes
      });

      existingPhoneKeys.add(phoneKey);
      imported++;
    }
  }

  console.log(`${cliente.nome}: ${imported} leads imported from ${allSheets.length} sheets`);
  return { cliente: cliente.nome, imported, sheets: allSheets.length };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let body = {};
    try { body = await req.json(); } catch {}
    const filterClienteId = body.clienteId || null;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    const allClientes = await base44.asServiceRole.entities.Cliente.list('-created_date', 500);
    let clientesComPlanilha = allClientes.filter(c => c.google_leads_sheet_url && c.google_leads_sheet_url.trim() !== '');

    // If specific client requested (e.g. from UI button), process only that one
    if (filterClienteId) {
      clientesComPlanilha = clientesComPlanilha.filter(c => c.id === filterClienteId);
    } else {
      // Rotate through clients in batches to avoid rate limits
      // Use current minute to determine which batch to process
      const batchIndex = Math.floor(Date.now() / (30 * 60 * 1000)) % Math.ceil(clientesComPlanilha.length / BATCH_SIZE);
      const start = batchIndex * BATCH_SIZE;
      const batch = clientesComPlanilha.slice(start, start + BATCH_SIZE);
      console.log(`Batch ${batchIndex + 1}/${Math.ceil(clientesComPlanilha.length / BATCH_SIZE)}: processing clients ${start + 1}-${start + batch.length} of ${clientesComPlanilha.length}`);
      clientesComPlanilha = batch;
    }

    if (clientesComPlanilha.length === 0) {
      return Response.json({ success: true, message: 'No clients with Google Sheets URL configured', totalImported: 0 });
    }

    // Pre-load existing leads for these specific clients only (last 3 days to reduce payload)
    const clienteIds = clientesComPlanilha.map(c => c.id);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const existingLeads = await base44.asServiceRole.entities.CrcLead.filter(
      { created_date: { $gte: threeDaysAgo } },
      '-created_date',
      5000
    );
    const existingPhoneKeys = new Set(
      existingLeads
        .filter(l => clienteIds.includes(l.unidade_id))
        .map(l => l.unidade_id && l.telefone ? `${l.unidade_id}|${normalizePhone(l.telefone)}` : null)
        .filter(Boolean)
    );

    let totalImported = 0;
    const results = [];

    for (const cliente of clientesComPlanilha) {
      const result = await processCliente(cliente, accessToken, existingPhoneKeys, base44);
      results.push(result);
      totalImported += result.imported || 0;
      await sleep(2000);
    }

    return Response.json({ success: true, totalImported, processedClients: clientesComPlanilha.length, results });

  } catch (error) {
    console.error('syncCrcLeadsFromGoogle error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});