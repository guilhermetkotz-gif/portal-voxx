import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar autenticação
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obter token de acesso do Google Sheets
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');
    
    // ID da planilha correta
    const SPREADSHEET_ID = '1aweubWBZdD71YvmBnDbq0xA6BUZCjL6_iuqmE2L9YA8';
    
    // Primeiro buscar metadata para obter o nome correto da sheet
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
    const metadataResponse = await fetch(metadataUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!metadataResponse.ok) {
      return Response.json({ 
        error: 'Failed to fetch sheet metadata', 
        details: await metadataResponse.text() 
      }, { status: metadataResponse.status });
    }
    
    const metadata = await metadataResponse.json();
    
    // Buscar a aba "ontem meta Ads"
    const targetSheet = metadata.sheets.find(sheet => 
      sheet.properties.title.toLowerCase().includes('ontem') && 
      sheet.properties.title.toLowerCase().includes('meta')
    );
    
    const sheetName = targetSheet?.properties?.title || 'ontem meta Ads';
    
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}`;
    
    const response = await fetch(sheetsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json({ 
        error: 'Failed to fetch sheet data', 
        details: errorText 
      }, { status: response.status });
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length === 0) {
      return Response.json({ amountSpentByAccount: {} });
    }

    // Primeira linha são os headers
    const headers = rows[0];
    
    // Encontrar índices das colunas
    const accountNameIndex = headers.findIndex(h => 
      h && (h.toLowerCase().includes('account') && h.toLowerCase().includes('name'))
    );
    const amountSpentIndex = headers.findIndex(h => 
      h && (h.toLowerCase().includes('amount') && h.toLowerCase().includes('spent'))
    );
    
    console.log('Headers:', headers);
    console.log('Account Name Index:', accountNameIndex);
    console.log('Amount Spent Index:', amountSpentIndex);

    if (accountNameIndex === -1 || amountSpentIndex === -1) {
      return Response.json({ 
        error: 'Could not find required columns (Account Name, Amount Spent)', 
        headers 
      }, { status: 400 });
    }

    // Processar dados
    const amountSpentByAccount = {};
    const diarioD1ByAccount = {};
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const accountName = row[accountNameIndex];
      const amountSpentRaw = row[amountSpentIndex];
      
      // Limpar o valor e converter (remover R$, pontos e vírgulas)
      let amountSpent = 0;
      if (amountSpentRaw) {
        const cleanValue = String(amountSpentRaw)
          .replace(/R\$/g, '')
          .replace(/\./g, '') // Remove separador de milhares
          .replace(/,/g, '.') // Troca vírgula por ponto
          .trim();
        amountSpent = parseFloat(cleanValue) || 0;
      }
      
      if (accountName) {
        amountSpentByAccount[accountName] = amountSpent;
        // Amount Spent é o mesmo que Diário D-1
        diarioD1ByAccount[accountName] = amountSpent;
      }
    }

    return Response.json({ 
      amountSpentByAccount,
      diarioD1ByAccount,
      totalAccounts: Object.keys(amountSpentByAccount).length
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});