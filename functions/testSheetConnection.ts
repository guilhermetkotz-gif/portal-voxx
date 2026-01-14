import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SPREADSHEET_ID = '1aweubWBZdD71YvmBnDbq0xA6BUZCjL6_iuqmE2L9YA8';
const SHEET_NAME = 'Planilha1';

Deno.serve(async (req) => {
    console.log('=== TESTE CONEXÃO SHEETS ===');
    
    try {
        const base44 = createClientFromRequest(req);
        console.log('Base44 client criado');
        
        const accessToken = await base44.asServiceRole.connectors.getAccessToken("googlesheets");
        console.log('Token obtido:', accessToken ? 'SIM' : 'NÃO');
        
        const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}`;
        console.log('URL:', sheetUrl);
        
        const response = await fetch(sheetUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        console.log('Status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('Erro:', errorText);
            return Response.json({ error: errorText, status: response.status }, { status: response.status });
        }
        
        const data = await response.json();
        console.log('Data recebida:', JSON.stringify(data).substring(0, 500));
        
        return Response.json({ 
            success: true, 
            rows: data.values?.length || 0,
            firstRow: data.values?.[0] || [],
            secondRow: data.values?.[1] || []
        });
        
    } catch (error) {
        console.error('Erro:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});