import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SPREADSHEET_ID = '1aweubWBZdD71YvmBnDbq0xA6BUZCjL6_iuqmE2L9YA8';
const SALDOS_SPREADSHEET_ID = '1wn0BplK_-735LDcochYWeWHYx_7GhsyZ8aVKMkv2bEs';

Deno.serve(async (req) => {
    try {
        console.log('=== INÍCIO DA SINCRONIZAÇÃO ===');
        const base44 = createClientFromRequest(req);
        
        // Get access token for Google Sheets
        const accessToken = await base44.asServiceRole.connectors.getAccessToken("googlesheets");
        console.log('Access token obtido');
        
        // Fetch data from Google Sheets - get all sheets first
        const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
        const metadataResponse = await fetch(metadataUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!metadataResponse.ok) {
            throw new Error(`Failed to fetch metadata: ${metadataResponse.statusText}`);
        }
        
        const metadata = await metadataResponse.json();
        const firstSheetName = metadata.sheets[0]?.properties?.title;
        console.log('First sheet name:', firstSheetName);
        
        const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(firstSheetName)}`;
        const response = await fetch(sheetUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch sheet data: ${response.statusText}`);
        }
        
        const data = await response.json();
        const rows = data.values || [];
        console.log('Performance rows fetched:', rows.length);
        
        // Fetch SALDOS - FACE sheet
        console.log('Fetching SALDOS sheet...');
        const saldosSheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SALDOS_SPREADSHEET_ID}/values/${encodeURIComponent('SALDOS -FACE')}`;
        
        const saldosResponse = await fetch(saldosSheetUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const saldosRows = saldosResponse.ok ? (await saldosResponse.json()).values || [] : [];
        console.log('Saldos rows fetched:', saldosRows.length);
        
        // Build saldos map using Account ID as key
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
                
                // Log linha 59 especificamente (índice 58 + 1 header = 59)
                if (i === 58) {
                    console.log('LINHA 59 da planilha SALDOS:', { nome, saldo, identifier, row });
                }
                
                if (saldo) {
                    const parseNumber = (val) => {
                        if (!val) return null;
                        // Remove R$, espaços, e outros caracteres não numéricos exceto . e ,
                        let cleaned = val.toString().replace(/[^\d,.]/g, '');
                        // Remove pontos (separadores de milhar)
                        cleaned = cleaned.replace(/\./g, '');
                        // Substitui vírgula por ponto (separador decimal)
                        cleaned = cleaned.replace(',', '.');
                        const num = parseFloat(cleaned);
                        return isNaN(num) ? null : num;
                    };
                    const parsedSaldo = parseNumber(saldo);
                    
                    if (parsedSaldo !== null && parsedSaldo > 0) {
                        if (nome && nome !== '#REF!') {
                            saldosMapByNome[nome.toLowerCase().trim()] = parsedSaldo;
                        }
                        if (identifier) {
                            // Normalizar ID: remover pontos e espaços
                            const normalizedId = identifier.replace(/[.\s]/g, '');
                            saldosMapById[normalizedId] = parsedSaldo;
                            // Log se contém "londrina" ou "bandeirantes"
                            if (nome && (nome.toLowerCase().includes('londrina') || nome.toLowerCase().includes('bandeirantes'))) {
                                console.log(`Saldo Londrina mapeado: ${nome} -> ID: ${identifier} (normalized: ${normalizedId}) -> ${parsedSaldo}`);
                            }
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
        console.log('Sheet Headers:', headers);
        
        // Map column indices
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
        
        let updatedCount = 0;
        let createdCount = 0;
        
        const existingClientes = await base44.asServiceRole.entities.Cliente.list('nome', 500);
        
        // Process each row
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const nome = row[nomeIdx]?.trim();
            
            if (!nome) {
                console.log(`Row ${i+1}: Skipping - empty name`);
                continue;
            }
            
            // Log Terra Boa specifically
            if (nome.toLowerCase().includes('terra boa')) {
                console.log(`Row ${i+1}: Found Terra Boa - "${nome}"`);
            }
            
            // Log clientes de Londrina da planilha de performance
            if (nome.toLowerCase().includes('londrina')) {
                console.log(`Cliente Londrina na planilha performance: "${nome}" (Account ID: ${row[0]})`);
            }
            
            const parseNumber = (val) => {
                if (!val) return null;
                // Remove R$, espaços, e outros caracteres não numéricos exceto . e ,
                let cleaned = val.toString().replace(/[^\d,.]/g, '');
                // Remove pontos (separadores de milhar)
                cleaned = cleaned.replace(/\./g, '');
                // Substitui vírgula por ponto (separador decimal)
                cleaned = cleaned.replace(',', '.');
                const num = parseFloat(cleaned);
                return isNaN(num) ? null : num;
            };
            
            const parts = nome.split('-').map(p => p.trim());
            const cidade = parts.length > 1 ? parts[parts.length - 2] : 'N/A';
            const estado = parts.length > 1 ? parts[parts.length - 1] : 'N/A';
            
            // Get account ID from first column
            const accountId = row[0];
            // Normalizar ID: remover pontos e espaços
            const normalizedAccountId = accountId ? accountId.toString().replace(/[.\s]/g, '') : null;
            
            // Match saldo by account ID first, then by name
            let saldoMeta = null;
            if (normalizedAccountId && saldosMapById[normalizedAccountId]) {
                saldoMeta = saldosMapById[normalizedAccountId];
                console.log(`✓ Saldo matched by ID for "${nome}": ${accountId} (normalized: ${normalizedAccountId}) -> ${saldoMeta}`);
            } else {
                const cleanNome = nome.toLowerCase().trim();
                saldoMeta = saldosMapByNome[cleanNome] || null;
                
                if (!saldoMeta) {
                    for (const [saldoNome, saldo] of Object.entries(saldosMapByNome)) {
                        if (cleanNome.includes(saldoNome) || saldoNome.includes(cleanNome)) {
                            saldoMeta = saldo;
                            console.log(`✓ Saldo matched by partial name for "${nome}": ${saldoNome} -> ${saldo}`);
                            break;
                        }
                    }
                }
                
                if (!saldoMeta) {
                    console.log(`✗ NO MATCH for "${nome}" (Account ID: ${accountId})`);
                }
            }
            
            const clienteData = {
                nome,
                cidade,
                estado,
                leads_meta_mes: messagingConversationsIdx >= 0 ? parseNumber(row[messagingConversationsIdx]) : null,
                custo_por_lead_meta: costPerMessagingIdx >= 0 ? parseNumber(row[costPerMessagingIdx]) : null,
                investimento_meta_mes: amountSpentIdx >= 0 ? parseNumber(row[amountSpentIdx]) : null,
                saldo_meta: saldoMeta,
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
            
            // Remove null values
            Object.keys(clienteData).forEach(key => {
                if (clienteData[key] === null || clienteData[key] === undefined || clienteData[key] === '') {
                    delete clienteData[key];
                }
            });
            
            const existingCliente = existingClientes.find(c => 
                c.nome?.toLowerCase() === nome.toLowerCase()
            );

            if (existingCliente) {
                if (nome.toLowerCase().includes('terra boa')) {
                    console.log(`Terra Boa - Updating existing ID ${existingCliente.id}:`, clienteData);
                }
                await base44.asServiceRole.entities.Cliente.update(existingCliente.id, clienteData);
                updatedCount++;
            } else {
                if (nome.toLowerCase().includes('terra boa')) {
                    console.log(`Terra Boa - Creating new client:`, clienteData);
                }
                await base44.asServiceRole.entities.Cliente.create(clienteData);
                createdCount++;
            }
        }
        
        console.log('=== FIM DA SINCRONIZAÇÃO ===');
        console.log(`Total processado: ${rows.length - 1} linhas`);
        console.log(`Criados: ${createdCount}, Atualizados: ${updatedCount}`);
        
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