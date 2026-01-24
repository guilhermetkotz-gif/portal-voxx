import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clienteId } = await req.json();
    
    if (!clienteId) {
      return Response.json({ error: 'clienteId é obrigatório' }, { status: 400 });
    }

    // Get cliente
    const cliente = await base44.asServiceRole.entities.Cliente.get(clienteId);
    if (!cliente || !cliente.google_leads_sheet_url) {
      return Response.json({ 
        error: 'Cliente não encontrado ou planilha não configurada',
        leads: 0 
      }, { status: 404 });
    }

    // Extract spreadsheet ID from URL
    const urlMatch = cliente.google_leads_sheet_url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!urlMatch) {
      return Response.json({ 
        error: 'URL da planilha inválida',
        leads: 0 
      }, { status: 400 });
    }
    
    const spreadsheetId = urlMatch[1];

    // Get current month name in Portuguese
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const currentMonth = monthNames[new Date().getMonth()];

    // Get access token from connector
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
      const errorText = await response.text();
      console.error('Google Sheets API error:', errorText);
      
      // If sheet not found, return 0 leads
      if (response.status === 400 || response.status === 404) {
        return Response.json({ 
          leads: 0,
          message: `Aba "${currentMonth}" não encontrada na planilha`
        });
      }
      
      return Response.json({ 
        error: 'Erro ao acessar Google Sheets',
        leads: 0 
      }, { status: response.status });
    }

    const data = await response.json();
    
    // Count rows (excluding header)
    const rowCount = data.values ? data.values.length - 1 : 0;
    const leadsCount = Math.max(0, rowCount);

    // Get last 5 leads (excluding header)
    const lastLeads = [];
    if (data.values && data.values.length > 1) {
      const headers = data.values[0];
      const nameIndex = headers.findIndex(h => h && h.toLowerCase().includes('nome'));
      const phoneIndex = headers.findIndex(h => h && (h.toLowerCase().includes('telefone') || h.toLowerCase().includes('whatsapp')));
      
      // Get last 5 rows (most recent leads)
      const recentRows = data.values.slice(-5).reverse();
      
      for (const row of recentRows) {
        if (row.length > 0) {
          lastLeads.push({
            nome: nameIndex >= 0 ? row[nameIndex] : 'N/A',
            telefone: phoneIndex >= 0 ? row[phoneIndex] : 'N/A'
          });
        }
      }
    }

    return Response.json({ 
      leads: leadsCount,
      month: currentMonth,
      spreadsheetId,
      lastLeads
    });

  } catch (error) {
    console.error('Error in getGoogleLeadsFromSheet:', error);
    return Response.json({ 
      error: error.message,
      leads: 0 
    }, { status: 500 });
  }
});