import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SPREADSHEET_ID = '1aweubWBZdD71YvmBnDbq0xA6BUZCjL6_iuqmE2L9YA8';
const SALDOS_SPREADSHEET_ID = '1wn0BplK_-735LDcochYWeWHYx_7GhsyZ8aVKMkv2bEs';
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
        
        // Fetch SALDOS - FACE sheet
        console.log('Fetching SALDOS sheet...');
        const saldosSheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SALDOS_SPREADSHEET_ID}/values/${encodeURIComponent('SALDOS -FACE')}`;
        const saldosResponse = await fetch(saldosSheetUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        let saldosRows = [];
        if (!saldosResponse.ok) {
            console.log('Warning: Failed to fetch SALDOS sheet:', saldosResponse.statusText);
            // Continue without saldos data
        } else {
            const saldosData = await saldosResponse.json();
            saldosRows = saldosData.values || [];
            console.log('Saldos rows fetched:', saldosRows.length);
        }
        
        // Build saldos map using IDENTIFICADOR (account ID) as key
        const saldosMapByNome = {};
        const saldosMapById = {};
        if (saldosRows.length > 1) {
            const saldosHeaders = saldosRows[0];
            const nomeColIdx = saldosHeaders.findIndex(h => h && (h.toLowerCase().includes('unidade') || h.toLowerCase().includes('nome')));
            const saldoColIdx = saldosHeaders.findIndex(h => h && h.toLowerCase().includes('saldo'));
            const idColIdx = saldosHeaders.findIndex(h => h && (h.toLowerCase().includes('identificador') || h.toLowerCase().includes('account id')));
            
            console.log('Saldos columns:', { nomeColIdx, saldoColIdx, idColIdx });
            
            for (let i = 1; i < saldosRows.length; i++) {
                const row = saldosRows[i];
                const nome = row[nomeColIdx]?.trim();
                const saldo = row[saldoColIdx];
                const identifier = row[idColIdx]?.trim();
                
                if (saldo) {
                    const parseNumber = (val) => {
                        if (!val) return null;
                        const cleaned = val.toString().replace(/[^\d,.-]/g, '').replace(',', '.');
                        const num = parseFloat(cleaned);
                        return isNaN(num) ? null : num;
                    };
                    const parsedSaldo = parseNumber(saldo);
                    
                    if (parsedSaldo !== null && parsedSaldo > 0) {
                        // Map by nome
                        if (nome && nome !== '#REF!') {
                            saldosMapByNome[nome.toLowerCase().trim()] = parsedSaldo;
                        }
                        // Map by identifier (account ID from sheet 1)
                        if (identifier) {
                            saldosMapById[identifier] = parsedSaldo;
                            console.log(`Saldo by ID: ${identifier} -> ${parsedSaldo}`);
                        }
                    }
                }
            }
            console.log('Saldos map built:', Object.keys(saldosMapByNome).length, 'by name,', Object.keys(saldosMapById).length, 'by ID');
        }
        
        if (rows.length < 2) {
            return Response.json({ error: 'Planilha vazia ou sem dados' }, { status: 400 });
        }
        
        // First row is headers
        const headers = rows[0];
        console.log('Headers:', headers);
        
        // Map column names to indices
        const getColumnIndex = (name) => headers.findIndex(h => h && h.toLowerCase().includes(name.toLowerCase()));
        
        // Nova planilha tem diferentes nomes de colunas
        const nomeIdx = headers.findIndex(h => h && h.toLowerCase() === 'account name');
        const impressionsIdx = headers.findIndex(h => h && h.toLowerCase() === 'impressions');
        const costPerMessagingIdx = headers.findIndex(h => h && h.toLowerCase() === 'cost per messaging conversations started');
        const pageEngagementIdx = headers.findIndex(h => h && h.toLowerCase() === 'page engagement');
        const pageLikesIdx = headers.findIndex(h => h && h.toLowerCase() === 'page likes');
        const reachIdx = headers.findIndex(h => h && h.toLowerCase() === 'reach');
        const amountSpentIdx = headers.findIndex(h => h && h.toLowerCase() === 'amount spent');
        const clicksAllIdx = headers.findIndex(h => h && h.toLowerCase() === 'clicks (all)');
        const cpcLinkClickIdx = headers.findIndex(h => h && h.toLowerCase() === 'cpc (cost per link click)');
        const cpcAllIdx = headers.findIndex(h => h && h.toLowerCase() === 'cpc (all)');
        const messagingConversationsIdx = headers.findIndex(h => h && h.toLowerCase() === 'messaging conversations started');
        const costPerNewMessagingIdx = headers.findIndex(h => h && h.toLowerCase() === 'cost per new messaging connection');
        const costPerUniqueLinkIdx = headers.findIndex(h => h && h.toLowerCase() === 'cost per unique link click');
        const newMessagingConnectionsIdx = headers.findIndex(h => h && h.toLowerCase() === 'new messaging connections');
        
        console.log('Indices encontrados:', { nomeIdx, messagingConversationsIdx, costPerMessagingIdx, amountSpentIdx });
        
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
            
            // Get account ID from first column of performance sheet (row[0])
            const accountId = row[0];
            
            // Try to match saldo by account ID first, then by name
            let saldoMeta = null;
            if (accountId && saldosMapById[accountId]) {
                saldoMeta = saldosMapById[accountId];
                console.log(`Matched by ID: ${accountId} -> ${saldoMeta}`);
            } else {
                // Try name matching as fallback
                const cleanNome = nome.toLowerCase().trim();
                saldoMeta = saldosMapByNome[cleanNome] || null;
                
                if (!saldoMeta) {
                    // Try partial match
                    for (const [saldoNome, saldo] of Object.entries(saldosMapByNome)) {
                        if (cleanNome.includes(saldoNome) || saldoNome.includes(cleanNome)) {
                            saldoMeta = saldo;
                            console.log(`Partial match: "${nome}" -> ${saldo}`);
                            break;
                        }
                    }
                }
            }
            
            const clienteData = {
                nome,
                cidade,
                estado,
                // Mapeando novos campos da planilha
                leads_meta_mes: messagingConversationsIdx >= 0 ? parseNumber(row[messagingConversationsIdx]) : null,
                custo_por_lead_meta: costPerMessagingIdx >= 0 ? parseNumber(row[costPerMessagingIdx]) : null,
                investimento_meta_mes: amountSpentIdx >= 0 ? parseNumber(row[amountSpentIdx]) : null,
                saldo_meta: saldoMeta,
                // Campos adicionais da nova planilha
                impressions: impressionsIdx >= 0 ? parseNumber(row[impressionsIdx]) : null,
                page_engagement: pageEngagementIdx >= 0 ? parseNumber(row[pageEngagementIdx]) : null,
                page_likes: pageLikesIdx >= 0 ? parseNumber(row[pageLikesIdx]) : null,
                reach: reachIdx >= 0 ? parseNumber(row[reachIdx]) : null,
                clicks_all: clicksAllIdx >= 0 ? parseNumber(row[clicksAllIdx]) : null,
                cpc_link_click: cpcLinkClickIdx >= 0 ? parseNumber(row[cpcLinkClickIdx]) : null,
                cpc_all: cpcAllIdx >= 0 ? parseNumber(row[cpcAllIdx]) : null,
                new_messaging_connections: newMessagingConnectionsIdx >= 0 ? parseNumber(row[newMessagingConnectionsIdx]) : null,
                cost_per_new_messaging: costPerNewMessagingIdx >= 0 ? parseNumber(row[costPerNewMessagingIdx]) : null,
                cost_per_unique_link: costPerUniqueLinkIdx >= 0 ? parseNumber(row[costPerUniqueLinkIdx]) : null
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