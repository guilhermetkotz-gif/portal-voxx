import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SPREADSHEET_ID = '1aweubWBZdD71YvmBnDbq0xA6BUZCjL6_iuqmE2L9YA8';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get access token for Google Sheets
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    // Fetch both sheets
    const ranges = [
      '7 dias meta ads!A:Z',
      'ontem meta ads!A:Z'
    ];

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&')}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.statusText}`);
    }

    const data = await response.json();
    const [sheet7dias, sheetOntem] = data.valueRanges;

    // Function to extract amount spent by account name
    const extractAmountSpent = (sheet) => {
      const rows = sheet.values || [];
      if (rows.length < 2) return {};

      const headers = rows[0];
      const accountNameIndex = headers.findIndex(h => h === 'Account Name');
      const amountSpentIndex = headers.findIndex(h => h === 'Amount Spent');

      if (accountNameIndex === -1 || amountSpentIndex === -1) {
        return {};
      }

      const result = {};
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const accountName = row[accountNameIndex];
        const amountSpent = parseFloat(row[amountSpentIndex]) || 0;
        
        if (accountName && amountSpent > 0) {
          result[accountName] = amountSpent;
        }
      }

      return result;
    };

    const gastos7dias = extractAmountSpent(sheet7dias);
    const gastosOntem = extractAmountSpent(sheetOntem);

    // Get all account names
    const allAccountNames = new Set([...Object.keys(gastos7dias), ...Object.keys(gastosOntem)]);

    // Calculate max spending per account
    const gastoDiarioPorConta = {};
    for (const accountName of allAccountNames) {
      const gasto7 = gastos7dias[accountName] || 0;
      const gastoOntem = gastosOntem[accountName] || 0;
      gastoDiarioPorConta[accountName] = Math.max(gasto7, gastoOntem);
    }

    return Response.json({
      success: true,
      gastoDiarioPorConta,
      totalContas: allAccountNames.size
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});