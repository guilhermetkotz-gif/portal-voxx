import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get Google Sheets access token via connector
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // Get all Oral Sin clients with a Google Leads Sheet configured
    const allClientes = await base44.asServiceRole.entities.Cliente.list('-created_date', 500);
    const oralSinClientes = allClientes.filter(c =>
      c.tipo_cliente === 'oral_sin' && c.google_leads_sheet_url
    );

    if (oralSinClientes.length === 0) {
      return Response.json({ success: true, message: 'No Oral Sin clients with Google Sheets configured', totalImported: 0 });
    }

    // Pre-load existing leads to check for duplicates
    const existingLeads = await base44.asServiceRole.entities.CrcLead.filter(
      { fonte_cadastro: 'google_sheet' },
      '-created_date',
      10000
    );
    const existingRowIds = new Set(existingLeads.map(l => l.external_row_id).filter(Boolean));

    let totalImported = 0;
    const results = [];

    for (const cliente of oralSinClientes) {
      const spreadsheetId = extractSpreadsheetId(cliente.google_leads_sheet_url);
      if (!spreadsheetId) {
        results.push({ cliente: cliente.nome, error: 'Invalid Google Sheets URL' });
        continue;
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

      // Get sheet metadata to find first sheet name
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!metaRes.ok) {
        results.push({ cliente: cliente.nome, error: `Sheet metadata error: ${metaRes.status}` });
        continue;
      }

      const meta = await metaRes.json();
      const sheetName = meta.sheets[0]?.properties?.title || 'Sheet1';

      // Fetch sheet data
      const dataRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (!dataRes.ok) {
        results.push({ cliente: cliente.nome, error: `Sheet data error: ${dataRes.status}` });
        continue;
      }

      const sheetData = await dataRes.json();
      const rows = sheetData.values || [];

      if (rows.length < 2) {
        results.push({ cliente: cliente.nome, imported: 0, message: 'No data rows' });
        continue;
      }

      const headers = rows[0];
      const findCol = (name) => headers.findIndex(h => h && h.toLowerCase().trim() === name.toLowerCase().trim());

      const idxNome = findCol(colNome);
      const idxTelefone = findCol(colTelefone);
      const idxData = findCol(colData);
      const idxOrigem = findCol(colOrigem);
      const idxCampanha = findCol(colCampanha);
      const idxLink = findCol(colLinkAnuncio);
      const idxObs = findCol(colObservacao);

      let imported = 0;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowId = `${spreadsheetId}_row_${i}`;

        if (existingRowIds.has(rowId)) continue;

        const telefone = normalizePhone(idxTelefone >= 0 ? row[idxTelefone] : '');
        if (!telefone) continue;

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
          external_row_id: rowId,
          external_created_at: dataChegada,
          data_chegada: dataChegada,
          link_anuncio: idxLink >= 0 ? row[idxLink] || '' : '',
          observacoes
        });

        existingRowIds.add(rowId);
        imported++;
        totalImported++;
      }

      console.log(`Cliente ${cliente.nome}: ${imported} leads imported`);
      results.push({ cliente: cliente.nome, imported });
    }

    return Response.json({
      success: true,
      totalImported,
      processedClients: oralSinClientes.length,
      results
    });

  } catch (error) {
    console.error('syncCrcLeadsFromGoogle error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});