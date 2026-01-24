import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Admin only
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { clienteId } = await req.json();
    
    if (!clienteId) {
      return Response.json({ error: 'clienteId é obrigatório' }, { status: 400 });
    }

    // Get cliente with Google Sheets URL
    const cliente = await base44.asServiceRole.entities.Cliente.get(clienteId);
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

      // Check if already imported
      const existing = await base44.asServiceRole.entities.CrcLead.filter({
        unidade_id: clienteId,
        external_row_id: rowId,
        fonte_cadastro: 'google_sheet'
      });

      if (existing.length > 0) {
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

      // Parse date
      let dataChegada = new Date().toISOString();
      if (dateIdx >= 0 && row[dateIdx]) {
        try {
          dataChegada = new Date(row[dateIdx]).toISOString();
        } catch {
          // Use current date if parse fails
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

    return Response.json({ 
      imported,
      skipped,
      total: rows.length,
      message: `${imported} leads importados, ${skipped} ignorados`
    });

  } catch (error) {
    console.error('Error in syncCrcLeadsFromGoogle:', error);
    return Response.json({ 
      error: error.message,
      imported: 0
    }, { status: 500 });
  }
});