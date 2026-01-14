import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SPREADSHEET_ID = '1aweubWBZdD71YvmBnDbq0xA6BUZCjL6_iuqmE2L9YA8';
const SHEET_NAME = 'Planilha1';

Deno.serve(async (req) => {
    try {
        console.log('=== INÍCIO DA SINCRONIZAÇÃO ===');
        const base44 = createClientFromRequest(req);
        
        // Get access token for Google Sheets
        const accessToken = await base44.asServiceRole.connectors.getAccessToken("googlesheets");
        console.log('Access token obtido');
        
        // Fetch data from Google Sheets - get all sheets first
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
        console.log('Fetching:', sheetUrl);
        const response = await fetch(sheetUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        console.log('Response status:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.log('Error response:', errorText);
            throw new Error(`Failed to fetch sheet data: ${response.statusText}`);
        }
        
        const data = await response.json();
        const rows = data.values || [];
        console.log('Rows fetched:', rows.length);
        
        if (rows.length < 2) {
            return Response.json({ error: 'Planilha vazia ou sem dados' }, { status: 400 });
        }
        
        // First row is headers
        const headers = rows[0];
        console.log('Headers:', headers);
        
        // Map column names to indices
        const getColumnIndex = (name) => headers.findIndex(h => h && h.toLowerCase().includes(name.toLowerCase()));
        
        const nomeIdx = getColumnIndex('cliente');
        const leadsMetaIdx = getColumnIndex('leads entregues este mês meta');
        const cplMetaIdx = getColumnIndex('custo por lead meta');
        const investimentoMetaIdx = getColumnIndex('investimento no meta');
        const saldoMetaIdx = getColumnIndex('saldo meta');
        const investimentoDiaMetaIdx = getColumnIndex('investimento por dia meta');
        const dataProximoInvestimentoMetaIdx = getColumnIndex('data proximo investimento meta');
        
        const leadsGoogleCadastroIdx = getColumnIndex('leads entregues google cadastro');
        const leadsGoogleLigacaoIdx = getColumnIndex('leads entregues google ligação');
        const cliquesWhatsAppIdx = getColumnIndex('cliques google whatsapp');
        const cpcGoogleIdx = getColumnIndex('cpc google');
        const investimentoGoogleIdx = getColumnIndex('investimento no google');
        const saldoGoogleIdx = getColumnIndex('saldo google');
        const investimentoDiaGoogleIdx = getColumnIndex('investimento por dia google');
        const dataProximoInvestimentoGoogleIdx = getColumnIndex('data proximo investimento google');
        
        console.log('Indices encontrados:', { nomeIdx, leadsMetaIdx, cplMetaIdx, saldoMetaIdx });
        
        let updatedCount = 0;
        let createdCount = 0;
        
        // Get all existing clientes
        const existingClientes = await base44.asServiceRole.entities.Cliente.list('nome', 500);
        
        // Process each row (skip header)
        console.log('Total rows:', rows.length, 'nomeIdx:', nomeIdx);
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            console.log('Row', i, ':', row);

            const nome = row[nomeIdx]?.trim();
            console.log('Nome encontrado:', nome);
            if (!nome) {
                console.log('Skipping row', i, '- no name');
                continue; // Skip empty rows
            }
            
            // Parse numeric values
            const parseNumber = (val) => {
                if (!val) return null;
                const cleaned = val.toString().replace(/[^\d,.-]/g, '').replace(',', '.');
                const num = parseFloat(cleaned);
                return isNaN(num) ? null : num;
            };
            
            // Extract cidade and estado from nome (format: "NOME - CIDADE - UF")
            const parts = nome.split('-').map(p => p.trim());
            const cidade = parts.length > 1 ? parts[parts.length - 2] : 'N/A';
            const estado = parts.length > 1 ? parts[parts.length - 1] : 'N/A';
            
            const clienteData = {
                nome,
                cidade,
                estado,
                leads_meta_mes: leadsMetaIdx >= 0 ? parseNumber(row[leadsMetaIdx]) : null,
                custo_por_lead_meta: cplMetaIdx >= 0 ? parseNumber(row[cplMetaIdx]) : null,
                investimento_meta_mes: investimentoMetaIdx >= 0 ? parseNumber(row[investimentoMetaIdx]) : null,
                saldo_meta: saldoMetaIdx >= 0 ? parseNumber(row[saldoMetaIdx]) : null,
                investimento_dia_meta: investimentoDiaMetaIdx >= 0 ? parseNumber(row[investimentoDiaMetaIdx]) : null,
                leads_google_cadastro: leadsGoogleCadastroIdx >= 0 ? parseNumber(row[leadsGoogleCadastroIdx]) : null,
                leads_google_ligacao: leadsGoogleLigacaoIdx >= 0 ? parseNumber(row[leadsGoogleLigacaoIdx]) : null,
                cliques_google_whatsapp: cliquesWhatsAppIdx >= 0 ? parseNumber(row[cliquesWhatsAppIdx]) : null,
                cpc_google: cpcGoogleIdx >= 0 ? parseNumber(row[cpcGoogleIdx]) : null,
                investimento_google_mes: investimentoGoogleIdx >= 0 ? parseNumber(row[investimentoGoogleIdx]) : null,
                saldo_google: saldoGoogleIdx >= 0 ? parseNumber(row[saldoGoogleIdx]) : null,
                investimento_dia_google: investimentoDiaGoogleIdx >= 0 ? parseNumber(row[investimentoDiaGoogleIdx]) : null
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

            console.log('Processing:', nome, 'Existing:', !!existingCliente, 'Data:', clienteData);

            if (existingCliente) {
                // Update existing cliente
                await base44.asServiceRole.entities.Cliente.update(existingCliente.id, clienteData);
                updatedCount++;
                console.log('Updated:', nome);
            } else {
                // Create new cliente
                await base44.asServiceRole.entities.Cliente.create(clienteData);
                createdCount++;
                console.log('Created:', nome);
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