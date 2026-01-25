import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // IDs da planilha
    const spreadsheetId = '1aweubWBZdD71YvmBnDbq0xA6BUZCjL6_iuqmE2L9YA8';
    const sheetName = 'ontem meta ads';

    // Buscar os dados da planilha via Google Sheets
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`,
      {
        headers: {
          'Authorization': `Bearer ${await base44.asServiceRole.connectors.getAccessToken('googlesheets')}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Erro ao acessar planilha: ${response.status}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    // Encontrar índices das colunas
    const header = rows[0] || [];
    const accountNameIndex = header.findIndex(h => h?.toLowerCase().includes('account name'));
    const amountSpentIndex = header.findIndex(h => h?.toLowerCase().includes('amount spent'));

    if (accountNameIndex === -1 || amountSpentIndex === -1) {
      throw new Error('Colunas "Account Name" ou "Amount Spent" não encontradas');
    }

    // Extrair dados de gasto diário por conta
    const gastoDiarioByAccount = {};
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const accountName = row[accountNameIndex]?.trim();
      const amountSpent = parseFloat(
        String(row[amountSpentIndex] || '0')
          .replace('R$', '')
          .replace('.', '')
          .replace(',', '.')
          .trim()
      );

      if (accountName && !isNaN(amountSpent)) {
        gastoDiarioByAccount[accountName] = amountSpent;
      }
    }

    return Response.json({
      success: true,
      gastoDiarioByAccount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});