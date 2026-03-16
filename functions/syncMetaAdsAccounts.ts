import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get active config for monitoramento
        const configs = await base44.asServiceRole.entities.MetaAdsSheetConfig.filter({ 
            tipo: 'monitoramento', 
            ativo: true 
        });

        if (!configs || configs.length === 0) {
            return Response.json({ 
                error: 'Nenhuma configuração ativa encontrada para Monitoramento. Configure em Monitoramento de Contas > Configurar Origem dos Dados' 
            }, { status: 400 });
        }

        const config = configs[0];
        const spreadsheetId = config.spreadsheet_id;
        const sheetName = config.aba_ontem;
        const colMap = config.mapeamento_colunas;

        console.log('Using config:', { nome: config.nome_configuracao, spreadsheetId, sheetName });

        // Get access token for Google Sheets
        const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

        const encodedSheet = encodeURIComponent(sheetName);
        const range = `${encodedSheet}!A:V`;

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

        const headers = rows[0];
        console.log('Headers:', headers);
        
        const getColIndex = (configKey) => {
            const columnName = colMap[configKey];
            if (!columnName) return -1;
            return headers.findIndex(h => h && h.toLowerCase().includes(columnName.toLowerCase()));
        };
        
        const accountNameIdx = getColIndex('account_name');
        const impressionsIdx = getColIndex('impressions');
        const costPerMessagingIdx = getColIndex('cost_per_messaging');
        const frequencyIdx = getColIndex('frequency');
        const costPerUniqueLinkIdx = getColIndex('cost_per_unique_link');
        const pageEngagementIdx = getColIndex('page_engagement');
        const pageLikesIdx = getColIndex('page_likes');
        const reachIdx = getColIndex('reach');
        const amountSpentIdx = getColIndex('amount_spent');
        const clicksAllIdx = getColIndex('clicks_all');
        const cpcIdx = getColIndex('cpc');
        const messagingConversationsIdx = getColIndex('messaging_conversations');
        const costPerNewMessagingIdx = getColIndex('cost_per_new_messaging');
        const newMessagingConnectionsIdx = getColIndex('new_messaging_connections');
        const custoEngajamentoIdx = getColIndex('custo_engajamento');
        const leadsRepetidosIdx = getColIndex('leads_repetidos');
        const notaGPTIdx = getColIndex('nota_gpt');
        
        console.log('Column indices:', { accountNameIdx, amountSpentIdx, frequencyIdx, notaGPTIdx });

        const parseNumber = (val) => {
            if (!val) return 0;
            if (typeof val === 'number') return val;
            // Remove R$, currency symbols, spaces, and non-breaking spaces
            let str = String(val).replace(/R\$\s*/g, '').replace(/\u00a0/g, '').trim();
            // pt-BR format with dot as thousands separator and comma as decimal:
            // e.g. "23.957,66" or "1.234.567,89"
            // Detect: has comma AND has dot, comma comes after the last dot → pt-BR
            const hasDot = str.includes('.');
            const hasComma = str.includes(',');
            if (hasDot && hasComma) {
                const lastDot = str.lastIndexOf('.');
                const lastComma = str.lastIndexOf(',');
                if (lastComma > lastDot) {
                    // pt-BR: remove dots (thousands), replace comma with dot
                    str = str.replace(/\./g, '').replace(',', '.');
                } else {
                    // US format: remove commas (thousands)
                    str = str.replace(/,/g, '');
                }
            } else if (hasComma && !hasDot) {
                // Only comma → decimal separator: "23,96"
                str = str.replace(',', '.');
            }
            // If only dot → already valid float
            const num = parseFloat(str);
            return isNaN(num) ? 0 : num;
        };

        const parsePercentage = (val) => {
            if (!val) return 0;
            const str = typeof val === 'string' ? val.replace(/[^\d.,]/g, '').replace(',', '.') : String(val);
            const num = parseFloat(str);
            return isNaN(num) ? 0 : num;
        };

        const accounts = [];
        const processedNames = new Set();

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const accountName = (row[accountNameIdx] || '').trim();
            if (!accountName) continue;

            const normalizedName = accountName.toLowerCase().replace(/\s+/g, ' ');
            if (processedNames.has(normalizedName)) continue;
            processedNames.add(normalizedName);

            const notaGPT = parseNumber(row[notaGPTIdx]);
            const frequency = parseNumber(row[frequencyIdx]);
            const leadsRepetidos = parsePercentage(row[leadsRepetidosIdx]);
            const costPerMessaging = parseNumber(row[costPerMessagingIdx]);
            const investimento = parseNumber(row[amountSpentIdx]);

            let classificacao;
            if (notaGPT >= 90) classificacao = 'ELITE';
            else if (notaGPT >= 80) classificacao = 'SAUDÁVEL';
            else if (notaGPT >= 65) classificacao = 'OPERACIONAL';
            else if (notaGPT >= 50) classificacao = 'ALERTA';
            else classificacao = 'CRÍTICO';

            const isCriticalMetrics = frequency >= 4.6 || leadsRepetidos >= 28 || costPerMessaging >= 55;
            const isHighSpend = investimento >= 2000;

            let prioridade;
            if (notaGPT < 50 || (isCriticalMetrics && isHighSpend)) prioridade = 'P1';
            else if ((notaGPT >= 50 && notaGPT < 65) || isCriticalMetrics) prioridade = 'P2';
            else prioridade = 'P3';

            let mainIssue;
            if (frequency >= 4.6) mainIssue = 'Frequência alta (saturação / criativo cansado)';
            else if (leadsRepetidos >= 28) mainIssue = 'Leads repetidos (público pequeno / repetição)';
            else if (costPerMessaging >= 55) mainIssue = 'Custo por conversa alto (criativo/oferta/qualificação)';
            else mainIssue = 'Saudável (monitorar)';

            accounts.push({
                account_name: accountName,
                impressions: parseNumber(row[impressionsIdx]),
                cost_per_messaging: costPerMessaging,
                frequency,
                cost_per_unique_link: parseNumber(row[costPerUniqueLinkIdx]),
                page_engagement: parseNumber(row[pageEngagementIdx]),
                page_likes: parseNumber(row[pageLikesIdx]),
                reach: parseNumber(row[reachIdx]),
                amount_spent: investimento,
                clicks_all: parseNumber(row[clicksAllIdx]),
                cpc: parseNumber(row[cpcIdx]),
                messaging_conversations: parseNumber(row[messagingConversationsIdx]),
                cost_per_new_messaging: parseNumber(row[costPerNewMessagingIdx]),
                new_messaging_connections: parseNumber(row[newMessagingConnectionsIdx]),
                custo_engajamento: parseNumber(row[custoEngajamentoIdx]),
                leads_repetidos_percent: leadsRepetidos,
                nota_gpt: notaGPT,
                classificacao,
                prioridade,
                main_issue: mainIssue
            });
        }

        console.log(`Processed ${accounts.length} accounts`);

        // Delete all existing and insert new
        const existingAccounts = await base44.asServiceRole.entities.ContaMetaAds.list('-created_date', 1000);
        await Promise.all(existingAccounts.map(acc => base44.asServiceRole.entities.ContaMetaAds.delete(acc.id)));

        if (accounts.length > 0) {
            await base44.asServiceRole.entities.ContaMetaAds.bulkCreate(accounts);
        }

        return Response.json({ 
            success: true, 
            accountsProcessed: accounts.length,
            message: `Successfully synced ${accounts.length} Meta Ads accounts`
        });

    } catch (error) {
        console.error('Error syncing Meta Ads accounts:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});