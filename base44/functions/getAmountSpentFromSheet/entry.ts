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
    
    // Buscar a aba "Página 1 (mês)" para Amount Spent (investido no mês)
    const mesSheet = metadata.sheets.find(sheet => 
      sheet.properties.title.toLowerCase().includes('página 1') || 
      sheet.properties.title.toLowerCase().includes('pagina 1') ||
      sheet.properties.title.toLowerCase().includes('mês')
    );
    const mesSheetName = mesSheet?.properties?.title || metadata.sheets[0]?.properties?.title;
    
    // Buscar a aba "ontem meta Ads" para Diário D-1
    const ontemSheet = metadata.sheets.find(sheet => 
      sheet.properties.title.toLowerCase().includes('ontem') && 
      sheet.properties.title.toLowerCase().includes('meta')
    );
    const ontemSheetName = ontemSheet?.properties?.title;
    
    if (!ontemSheetName) {
      return Response.json({ 
        error: 'Sheet "ontem meta Ads" not found',
        availableSheets: metadata.sheets.map(s => s.properties.title)
      }, { status: 400 });
    }
    
    // Buscar dados da aba do mês
    const mesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(mesSheetName)}`;
    const mesResponse = await fetch(mesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!mesResponse.ok) {
      return Response.json({ 
        error: 'Failed to fetch monthly sheet data', 
        details: await mesResponse.text() 
      }, { status: mesResponse.status });
    }

    const mesData = await mesResponse.json();
    const mesRows = mesData.values || [];
    
    // Buscar dados da aba de ontem
    const ontemUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(ontemSheetName)}`;
    const ontemResponse = await fetch(ontemUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!ontemResponse.ok) {
      return Response.json({ 
        error: 'Failed to fetch yesterday sheet data', 
        details: await ontemResponse.text() 
      }, { status: ontemResponse.status });
    }

    const ontemData = await ontemResponse.json();
    const ontemRows = ontemData.values || [];

    // Processar dados do mês (Amount Spent total)
    const amountSpentByAccount = {};
    if (mesRows.length > 0) {
      const mesHeaders = mesRows[0];
      const mesAccountNameIndex = mesHeaders.findIndex(h => 
        h && (h.toLowerCase().includes('account') && h.toLowerCase().includes('name'))
      );
      const mesAmountSpentIndex = mesHeaders.findIndex(h => 
        h && (h.toLowerCase().includes('amount') && h.toLowerCase().includes('spent'))
      );
      
      console.log('MES - Headers:', mesHeaders);
      console.log('MES - Account Name Index:', mesAccountNameIndex);
      console.log('MES - Amount Spent Index:', mesAmountSpentIndex);
      console.log('MES - Total Rows:', mesRows.length);
      
      if (mesAccountNameIndex !== -1 && mesAmountSpentIndex !== -1) {
        for (let i = 1; i < mesRows.length; i++) {
          const row = mesRows[i];
          const accountName = row[mesAccountNameIndex];
          const amountSpentRaw = row[mesAmountSpentIndex];
          
          let amountSpent = 0;
          if (amountSpentRaw) {
            const cleanValue = String(amountSpentRaw)
              .replace(/R\$/g, '')
              .replace(/\./g, '')
              .replace(/,/g, '.')
              .trim();
            amountSpent = parseFloat(cleanValue) || 0;
          }
          
          if (accountName) {
            amountSpentByAccount[accountName] = amountSpent;
            if (i < 5) {
              console.log(`MES - Sample [${i}]:`, accountName, '=', amountSpent, '(raw:', amountSpentRaw, ')');
            }
          }
        }
      }
    }
    
    // Processar dados de ontem (Diário D-1)
    const diarioD1ByAccount = {};
    if (ontemRows.length > 0) {
      const ontemHeaders = ontemRows[0];
      const ontemAccountNameIndex = ontemHeaders.findIndex(h => 
        h && (h.toLowerCase().includes('account') && h.toLowerCase().includes('name'))
      );
      const ontemAmountSpentIndex = ontemHeaders.findIndex(h => 
        h && (h.toLowerCase().includes('amount') && h.toLowerCase().includes('spent'))
      );
      
      console.log('ONTEM - Headers:', ontemHeaders);
      console.log('ONTEM - Account Name Index:', ontemAccountNameIndex);
      console.log('ONTEM - Amount Spent Index:', ontemAmountSpentIndex);
      console.log('ONTEM - Total Rows:', ontemRows.length);
      
      if (ontemAccountNameIndex !== -1 && ontemAmountSpentIndex !== -1) {
        for (let i = 1; i < ontemRows.length; i++) {
          const row = ontemRows[i];
          const accountName = row[ontemAccountNameIndex];
          const amountSpentRaw = row[ontemAmountSpentIndex];
          
          let amountSpent = 0;
          if (amountSpentRaw) {
            const cleanValue = String(amountSpentRaw)
              .replace(/R\$/g, '')
              .replace(/\./g, '')
              .replace(/,/g, '.')
              .trim();
            amountSpent = parseFloat(cleanValue) || 0;
          }
          
          if (accountName) {
            diarioD1ByAccount[accountName] = amountSpent;
            if (i < 5) {
              console.log(`ONTEM - Sample [${i}]:`, accountName, '=', amountSpent, '(raw:', amountSpentRaw, ')');
            }
          }
        }
      }
    }

    return Response.json({ 
      amountSpentByAccount,
      diarioD1ByAccount,
      totalAccounts: Math.max(Object.keys(amountSpentByAccount).length, Object.keys(diarioD1ByAccount).length)
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});