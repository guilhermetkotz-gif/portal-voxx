import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get clienteId from request body (manual call) or fetch all clientes (automation)
    let payload = {};
    try {
      payload = await req.json();
    } catch {
      // No body - running from automation
    }

    const { clienteId } = payload;
    
    // If no clienteId, sync all clientes with google_leads_sheet_url
    let clientesToSync = [];
    if (clienteId) {
      const cliente = await base44.asServiceRole.entities.Cliente.get(clienteId);
      if (cliente) clientesToSync = [cliente];
    } else {
      // Get all clientes with google_leads_sheet_url configured
      const allClientes = await base44.asServiceRole.entities.Cliente.list('-updated_date', 500);
      clientesToSync = allClientes.filter(c => c.google_leads_sheet_url);
    }

    if (clientesToSync.length === 0) {
      return Response.json({ 
        error: 'Nenhum cliente com planilha configurada',
        imported: 0
      });
    }

    let totalImported = 0;
    let totalSkipped = 0;
    const results = [];

    for (const cliente of clientesToSync) {
      try {
        const result = await syncClienteLeads(base44, cliente);
        totalImported += result.imported;
        totalSkipped += result.skipped;
        results.push({ cliente: cliente.nome, ...result });
      } catch (error) {
        results.push({ cliente: cliente.nome, error: error.message, imported: 0, skipped: 0 });
      }
    }

    return Response.json({ 
      totalImported,
      totalSkipped,
      clientesSynced: clientesToSync.length,
      results
    });

  } catch (error) {
    console.error('Error in syncCrcLeadsFromGoogle:', error);
    return Response.json({ 
      error: error.message,
      imported: 0
    }, { status: 500 });
  }
});

async function syncClienteLeads(base44, cliente) {
  const clienteId = cliente.id;
    if (!cliente || !cliente.google_leads_sheet_url) {
      return Response.json({ 
        error: 'Cliente não encontrado ou planilha não configurada',
        imported: 0
      }, { status: 404 });
    }

    // Get config with column mapping
    const configs = await base44.asServiceRole.entities.CrcConfig.filter({ 
      unidade_id: clienteId 
    });
    const config = configs[0];
    
    if (!config?.mapeamento_planilha) {
      return Response.json({ 
        error: 'Mapeamento de planilha não configurado',
        imported: 0
      }, { status: 400 });
    }

    const mapping = config.mapeamento_planilha;

    // Extract spreadsheet ID from URL
    const urlMatch = cliente.google_leads_sheet_url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!urlMatch) {
      return Response.json({ 
        error: 'URL da planilha inválida',
        imported: 0
      }, { status: 400 });
    }
    
    const spreadsheetId = urlMatch[1];

    // Get current month name
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const currentMonth = monthNames[new Date().getMonth()];

    // Get access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    // Fetch sheet data
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(currentMonth)}!A:Z`;
    const response = await fetch(sheetsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return Response.json({ 
        error: 'Erro ao acessar Google Sheets',
        imported: 0
      }, { status: response.status });
    }

    const data = await response.json();
    
    if (!data.values || data.values.length <= 1) {
      return Response.json({ 
        imported: 0,
        message: 'Nenhum lead encontrado na planilha'
      });
    }

    const headers = data.values[0];
    const rows = data.values.slice(1);

    // Find column indexes
    const getColumnIndex = (colName) => {
      if (!colName) return -1;
      return headers.findIndex(h => h && h.toLowerCase().includes(colName.toLowerCase()));
    };

    const nameIdx = getColumnIndex(mapping.coluna_nome);
    const phoneIdx = getColumnIndex(mapping.coluna_telefone);
    const dateIdx = getColumnIndex(mapping.coluna_data);
    const origemIdx = getColumnIndex(mapping.coluna_origem);

    if (phoneIdx === -1) {
      return Response.json({ 
        error: 'Coluna de telefone não encontrada',
        imported: 0
      }, { status: 400 });
    }

    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowId = `row_${i + 2}`; // Row number (header is 1)
      
      const telefone = phoneIdx >= 0 ? row[phoneIdx] : null;
      if (!telefone) {
        skipped++;
        continue;
      }

      // Parse date BEFORE checking existing (we need it for comparison)
      // Parse date with proper timezone handling (Brazil timezone = UTC-3)
      let dataChegada = new Date().toISOString();
      if (dateIdx >= 0 && row[dateIdx]) {
        try {
          const dateStr = row[dateIdx].trim();
          console.log('🔍 [ROW', rowId, '] Raw date from sheet:', dateStr);
          
          // Handle DD/MM/YYYY HH:MM:SS format (common in Brazilian sheets)
          if (dateStr.includes('/')) {
            const [datePart, timePart] = dateStr.split(' ');
            const parts = datePart.split('/');
            
            // DD/MM/YYYY format
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2]?.length === 2 ? `20${parts[2]}` : parts[2];
            
            // Parse time - handle both HH:MM and HH:MM:SS
            const time = timePart || '12:00:00';
            const timeParts = time.split(':');
            const hours = timeParts[0].padStart(2, '0');
            const minutes = timeParts[1].padStart(2, '0');
            const seconds = timeParts[2]?.padStart(2, '0') || '00';
            
            // Build ISO date string correctly: YYYY-MM-DD
            const isoDateStr = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
            console.log('📅 [ROW', rowId, '] Converted to ISO:', isoDateStr);
            dataChegada = new Date(isoDateStr).toISOString();
            console.log('✅ [ROW', rowId, '] Final UTC timestamp:', dataChegada);
          } else {
            dataChegada = new Date(dateStr).toISOString();
          }
        } catch (error) {
          console.error('❌ Date parse error:', error, 'for input:', row[dateIdx]);
          // Use current date if parse fails
        }
      }

      // Check if already imported
      const existing = await base44.asServiceRole.entities.CrcLead.filter({
        unidade_id: clienteId,
        external_row_id: rowId,
        fonte_cadastro: 'google_sheet'
      });

      if (existing.length > 0) {
        // Update the date if it's different (fixing previously imported leads)
        const existingLead = existing[0];
        if (existingLead.data_chegada !== dataChegada) {
          await base44.asServiceRole.entities.CrcLead.update(existingLead.id, {
            data_chegada: dataChegada,
            external_created_at: dataChegada
          });
          console.log('Updated date for existing lead:', existingLead.id, 'from', existingLead.data_chegada, 'to', dataChegada);
        }
        skipped++;
        continue;
      }

      // Determine origem
      let origem = 'google_cadastro';
      if (origemIdx >= 0) {
        const origemVal = row[origemIdx]?.toLowerCase();
        if (origemVal?.includes('ligacao') || origemVal?.includes('ligação')) {
          origem = 'google_ligacao';
        }
      }

      // Create lead
      await base44.asServiceRole.entities.CrcLead.create({
        unidade_id: clienteId,
        nome: nameIdx >= 0 ? row[nameIdx] : 'Lead Google',
        telefone,
        origem,
        tratamento: 'nao_informado',
        status: 'sem_contato',
        fonte_cadastro: 'google_sheet',
        external_source: 'google_sheets',
        external_row_id: rowId,
        external_created_at: dataChegada,
        data_chegada: dataChegada,
        qtd_tentativas: 0,
        sla_atrasado: false
      });

      imported++;
    }

    return { 
      imported,
      skipped,
      total: rows.length,
      message: `${imported} leads importados, ${skipped} ignorados`
    };
}