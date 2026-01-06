import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SPREADSHEET_ID = '1wn0BplK_-735LDcochYWeWHYx_7GhsyZ8aVKMkv2bEs';
const SHEET_NAME = 'beta voxx';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Get access token for Google Sheets
        const accessToken = await base44.asServiceRole.connectors.getAccessToken("googlesheets");
        
        // Fetch data from Google Sheets
        const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}`;
        const response = await fetch(sheetUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch sheet data: ${response.statusText}`);
        }
        
        const data = await response.json();
        const rows = data.values || [];
        
        if (rows.length < 2) {
            return Response.json({ error: 'Planilha vazia ou sem dados' }, { status: 400 });
        }
        
        // First row is headers
        const headers = rows[0];
        
        // Map column names to indices
        const getColumnIndex = (name) => headers.findIndex(h => h && h.toLowerCase().includes(name.toLowerCase()));
        
        const nomeIdx = getColumnIndex('unidade');
        const cidadeIdx = getColumnIndex('cidade');
        const estadoIdx = getColumnIndex('estado');
        const statusIdx = getColumnIndex('status');
        const leadsMetaIdx = getColumnIndex('leads meta');
        const cplMetaIdx = getColumnIndex('cpl meta');
        const investimentoMetaIdx = getColumnIndex('investimento meta');
        const saldoMetaIdx = getColumnIndex('saldo meta');
        const leadsGoogleCadastroIdx = getColumnIndex('leads google cadastro');
        const leadsGoogleLigacaoIdx = getColumnIndex('leads google ligação');
        const cliquesWhatsAppIdx = getColumnIndex('cliques whatsapp');
        const cpcGoogleIdx = getColumnIndex('cpc google');
        const investimentoGoogleIdx = getColumnIndex('investimento google');
        const saldoGoogleIdx = getColumnIndex('saldo google');
        const healthScoreIdx = getColumnIndex('health score');
        
        let updatedCount = 0;
        let createdCount = 0;
        
        // Get all existing clientes
        const existingClientes = await base44.asServiceRole.entities.Cliente.list('nome', 500);
        
        // Process each row (skip header)
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            
            const nome = row[nomeIdx]?.trim();
            if (!nome) continue; // Skip empty rows
            
            // Parse numeric values
            const parseNumber = (val) => {
                if (!val) return null;
                const cleaned = val.toString().replace(/[^\d,.-]/g, '').replace(',', '.');
                const num = parseFloat(cleaned);
                return isNaN(num) ? null : num;
            };
            
            const clienteData = {
                nome,
                cidade: row[cidadeIdx]?.trim() || '',
                estado: row[estadoIdx]?.trim() || '',
                status: row[statusIdx]?.toLowerCase()?.trim() || 'ativo',
                leads_meta_mes: parseNumber(row[leadsMetaIdx]),
                custo_por_lead_meta: parseNumber(row[cplMetaIdx]),
                investimento_meta_mes: parseNumber(row[investimentoMetaIdx]),
                saldo_meta: parseNumber(row[saldoMetaIdx]),
                leads_google_cadastro: parseNumber(row[leadsGoogleCadastroIdx]),
                leads_google_ligacao: parseNumber(row[leadsGoogleLigacaoIdx]),
                cliques_google_whatsapp: parseNumber(row[cliquesWhatsAppIdx]),
                cpc_google: parseNumber(row[cpcGoogleIdx]),
                investimento_google_mes: parseNumber(row[investimentoGoogleIdx]),
                saldo_google: parseNumber(row[saldoGoogleIdx]),
                health_score: parseNumber(row[healthScoreIdx])
            };
            
            // Remove null/undefined values
            Object.keys(clienteData).forEach(key => {
                if (clienteData[key] === null || clienteData[key] === undefined || clienteData[key] === '') {
                    delete clienteData[key];
                }
            });
            
            // Check if cliente already exists
            const existingCliente = existingClientes.find(c => 
                c.nome?.toLowerCase() === nome.toLowerCase()
            );
            
            if (existingCliente) {
                // Update existing cliente
                await base44.asServiceRole.entities.Cliente.update(existingCliente.id, clienteData);
                updatedCount++;
            } else {
                // Create new cliente
                await base44.asServiceRole.entities.Cliente.create(clienteData);
                createdCount++;
            }
        }
        
        return Response.json({
            success: true,
            message: `Sincronização concluída: ${createdCount} criados, ${updatedCount} atualizados`,
            created: createdCount,
            updated: updatedCount,
            total: rows.length - 1
        });
        
    } catch (error) {
        console.error('Erro na sincronização:', error);
        return Response.json({ 
            error: error.message,
            details: error.toString()
        }, { status: 500 });
    }
});