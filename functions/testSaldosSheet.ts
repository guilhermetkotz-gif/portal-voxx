import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SALDOS_SPREADSHEET_ID = '1wn0BplK_-735LDcochYWeWHYx_7GhsyZ8aVKMkv2bEs';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const accessToken = await base44.asServiceRole.connectors.getAccessToken("googlesheets");
        
        // Fetch SALDOS - FACE sheet
        const saldosSheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SALDOS_SPREADSHEET_ID}/values/${encodeURIComponent('SALDOS -FACE')}`;
        console.log('Fetching:', saldosSheetUrl);
        
        const saldosResponse = await fetch(saldosSheetUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!saldosResponse.ok) {
            return Response.json({ error: 'Failed to fetch saldos sheet', status: saldosResponse.status });
        }
        
        const saldosData = await saldosResponse.json();
        const saldosRows = saldosData.values || [];
        
        console.log('Total rows:', saldosRows.length);
        console.log('Headers:', saldosRows[0]);
        console.log('First 5 data rows:');
        for (let i = 1; i <= Math.min(5, saldosRows.length - 1); i++) {
            console.log(`Row ${i}:`, saldosRows[i]);
        }
        
        return Response.json({
            success: true,
            totalRows: saldosRows.length,
            headers: saldosRows[0],
            firstRows: saldosRows.slice(1, 6)
        });
        
    } catch (error) {
        console.error('Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});