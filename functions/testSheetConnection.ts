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
        
        // Fetch metadata to get actual sheet name
        const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
        console.log('Fetching metadata:', metadataUrl);
        const metadataResponse = await fetch(metadataUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!metadataResponse.ok) {
            throw new Error(`Failed to fetch metadata: ${metadataResponse.statusText}`);
        }
        
        const metadata = await metadataResponse.json();
        const firstSheetName = metadata.sheets[0]?.properties?.title;
        console.log('First sheet name:', firstSheetName);
        
        const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(firstSheetName)}`;
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