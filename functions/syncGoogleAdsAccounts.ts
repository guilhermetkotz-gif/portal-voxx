import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get active config for Google Ads
        const configs = await base44.asServiceRole.entities.MetaAdsSheetConfig.filter({ 
            tipo: 'google_ads', 
            ativo: true 
        });

        if (!configs || configs.length === 0) {
            return Response.json({ 
                error: 'Nenhuma configuração ativa encontrada para Google Ads' 
            }, { status: 400 });
        }

        const config = configs[0];
        const spreadsheetId = config.spreadsheet_id;
        const sheetName = config.aba_ontem;
        const colMap = config.mapeamento_colunas;

        console.log('Using Google Ads config:', {
            nome: config.nome_configuracao,
            spreadsheetId,
            sheetName
        });

        // Get access token for Google Sheets
        const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

        const range = `${sheetName}!A:Z`;

        // Fetch data from Google Sheets
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google Sheets API Error:', errorText);
            throw new Error(`Failed to fetch sheet data: ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const rows = data.values || [];

        if (rows.length < 2) {
            return Response.json({ error: 'No data found in sheet' }, { status: 404 });
        }

        // Header row
        const headers = rows[0];
        
        // Find column indices using config mapping
        const getColIndex = (configKey) => {
            const columnName = colMap[configKey];
            if (!columnName) return -1;
            return headers.findIndex(h => h && h.toLowerCase().includes(columnName.toLowerCase()));
        };
        
        const accountNameIdx = getColIndex('account_name');
        const clicksIdx = getColIndex('clicks');
        const conversionsIdx = getColIndex('conversions');
        const allConversionsIdx = getColIndex('all_conversions');
        const costIdx = getColIndex('cost');
        const avgCpcIdx = getColIndex('avg_cpc');
        const avgCpmIdx = getColIndex('avg_cpm');
        const optimizationScoreIdx = getColIndex('optimization_score');
        
        console.log('Column indices:', {
            accountNameIdx,
            clicksIdx,
            conversionsIdx,
            costIdx,
            header_sample: headers.slice(0, 15)
        });

        const accounts = [];
        const processedNames = new Set();

        // Parse numeric values
        const parseNumber = (val) => {
            if (!val) return 0;
            const str = typeof val === 'string' ? val.replace(/[^\d.,-]/g, '').replace(',', '.') : val;
            const num = parseFloat(str);
            return isNaN(num) ? 0 : num;
        };

        // Process each row
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const accountName = (row[accountNameIdx] || '').trim();
            if (!accountName) continue;

            const normalizedName = accountName.toLowerCase().replace(/\s+/g, ' ');
            if (processedNames.has(normalizedName)) {
                console.log('Skipping duplicate account:', accountName);
                continue;
            }
            processedNames.add(normalizedName);

            const clicks = parseNumber(row[clicksIdx]);
            const conversions = parseNumber(row[conversionsIdx]);
            const allConversions = parseNumber(row[allConversionsIdx]) || conversions;
            const cost = parseNumber(row[costIdx]);
            const avgCpc = parseNumber(row[avgCpcIdx]);
            const avgCpm = parseNumber(row[avgCpmIdx]);
            const optimizationScore = parseNumber(row[optimizationScoreIdx]);

            // Extract unidade_nome from account name (e.g., "Oral Sin - Conselheiro Lafaiete" -> "Conselheiro Lafaiete")
            let unidadeNome = accountName;
            if (accountName.includes(' - ')) {
                const parts = accountName.split(' - ');
                unidadeNome = parts[parts.length - 1].trim();
            }

            // Determine if account has no data
            const contaSemDados = clicks === 0 && conversions === 0 && cost === 0;

            // Debug log for first few accounts
            if (i <= 3) {
                console.log(`Account ${i} debug:`, {
                    accountName,
                    clicks,
                    conversions,
                    cost,
                    avgCpc
                });
            }

            accounts.push({
                account_name: accountName,
                unidade_nome: unidadeNome,
                cliente_nome: accountName.includes('Oral Sin') ? 'Oral Sin' : 'Outro',
                clicks: clicks,
                conversions: conversions,
                all_conversions: allConversions,
                cost: cost,
                avg_cpc: avgCpc,
                avg_cpm: avgCpm,
                optimization_score: optimizationScore,
                account_status: 'Ativa',
                conta_sem_dados: contaSemDados,
                data_atualizacao: new Date().toISOString(),
                fonte_dados: 'Google Ads Sheet'
            });
        }

        // Delete all existing Google Ads accounts and insert new ones
        const existingAccounts = await base44.asServiceRole.entities.GoogleAdsAccount.list('-created_date', 1000);
        
        const deletePromises = existingAccounts.map(acc => 
            base44.asServiceRole.entities.GoogleAdsAccount.delete(acc.id)
        );
        await Promise.all(deletePromises);

        // Bulk create new accounts
        if (accounts.length > 0) {
            await base44.asServiceRole.entities.GoogleAdsAccount.bulkCreate(accounts);
        }

        return Response.json({ 
            success: true, 
            accountsProcessed: accounts.length,
            message: `Successfully synced ${accounts.length} Google Ads accounts`
        });

    } catch (error) {
        console.error('Error syncing Google Ads accounts:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});