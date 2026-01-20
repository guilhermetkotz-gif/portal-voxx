import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const spreadsheetId = '1aweubWBZdD71YvmBnDbq0xA6BUZCjL6_iuqmE2L9YA8';
        const sheetName = 'Página 1';
        const range = `'${sheetName}'!A:V`;

        // Get access token for Google Sheets
        const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

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
        
        // Find column indices
        const getColIndex = (name) => headers.findIndex(h => h && h.toLowerCase().includes(name.toLowerCase()));
        
        const accountNameIdx = getColIndex('account name');
        const impressionsIdx = getColIndex('impressions');
        const costPerMessagingIdx = getColIndex('cost per messaging conversations started');
        const frequencyIdx = getColIndex('frequency');
        const costPerUniqueLinkIdx = getColIndex('cost per unique link click');
        const pageEngagementIdx = getColIndex('page engagement');
        const pageLikesIdx = getColIndex('page likes');
        const reachIdx = getColIndex('reach');
        const amountSpentIdx = getColIndex('amount spent');
        const clicksAllIdx = getColIndex('clicks (all)');
        const cpcIdx = getColIndex('cpc (cost per link click)');
        const messagingConversationsIdx = getColIndex('messaging conversations started');
        const costPerNewMessagingIdx = getColIndex('cost per new messaging connection');
        const newMessagingConnectionsIdx = getColIndex('new messaging connections');
        const custoEngajamentoIdx = getColIndex('custo por engajamento');
        const leadsRepetidosIdx = getColIndex('leads repetidos');
        const notaGPTIdx = getColIndex('nota gpt');

        const accounts = [];

        // Process each row
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const accountName = row[accountNameIdx] || '';
            if (!accountName.trim()) continue;

            // Parse numeric values
            const parseNumber = (val) => {
                if (!val) return 0;
                const str = typeof val === 'string' ? val.replace(/[^\d.-]/g, '') : val;
                const num = parseFloat(str);
                return isNaN(num) ? 0 : num;
            };

            const parsePercentage = (val) => {
                if (!val) return 0;
                const str = typeof val === 'string' ? val.replace(/[^\d.-]/g, '') : val;
                const num = parseFloat(str);
                return isNaN(num) ? 0 : num;
            };

            const notaGPT = parseNumber(row[notaGPTIdx]);
            const frequency = parseNumber(row[frequencyIdx]);
            const leadsRepetidos = parsePercentage(row[leadsRepetidosIdx]);
            const costPerMessaging = parseNumber(row[costPerMessagingIdx]);

            // Calculate Classificação
            let classificacao;
            if (notaGPT >= 90) classificacao = 'ELITE';
            else if (notaGPT >= 80) classificacao = 'SAUDÁVEL';
            else if (notaGPT >= 65) classificacao = 'OPERACIONAL';
            else if (notaGPT >= 50) classificacao = 'ALERTA';
            else classificacao = 'CRÍTICO';

            // Calculate Prioridade
            let prioridade;
            if (notaGPT < 50 || (frequency >= 3.2 && leadsRepetidos >= 22)) {
                prioridade = 'P1';
            } else if (notaGPT >= 50 && notaGPT < 65 || frequency >= 3.2 || leadsRepetidos >= 22) {
                prioridade = 'P2';
            } else {
                prioridade = 'P3';
            }

            // Calculate Main Issue
            let mainIssue;
            if (frequency >= 3.2) {
                mainIssue = 'Frequência alta (saturação / criativo cansado)';
            } else if (leadsRepetidos >= 22) {
                mainIssue = 'Leads repetidos (público pequeno / repetição)';
            } else if (costPerMessaging >= 30) {
                mainIssue = 'Custo por conversa alto (criativo/oferta/qualificação)';
            } else {
                mainIssue = 'Saudável (monitorar)';
            }

            accounts.push({
                account_name: accountName,
                impressions: parseNumber(row[impressionsIdx]),
                cost_per_messaging: costPerMessaging,
                frequency: frequency,
                cost_per_unique_link: parseNumber(row[costPerUniqueLinkIdx]),
                page_engagement: parseNumber(row[pageEngagementIdx]),
                page_likes: parseNumber(row[pageLikesIdx]),
                reach: parseNumber(row[reachIdx]),
                amount_spent: parseNumber(row[amountSpentIdx]),
                clicks_all: parseNumber(row[clicksAllIdx]),
                cpc: parseNumber(row[cpcIdx]),
                messaging_conversations: parseNumber(row[messagingConversationsIdx]),
                cost_per_new_messaging: parseNumber(row[costPerNewMessagingIdx]),
                new_messaging_connections: parseNumber(row[newMessagingConnectionsIdx]),
                custo_engajamento: parseNumber(row[custoEngajamentoIdx]),
                leads_repetidos_percent: leadsRepetidos,
                nota_gpt: notaGPT,
                classificacao: classificacao,
                prioridade: prioridade,
                main_issue: mainIssue
            });
        }

        // Delete all existing accounts and insert new ones
        const existingAccounts = await base44.asServiceRole.entities.ContaMetaAds.list('-created_date', 1000);
        for (const acc of existingAccounts) {
            await base44.asServiceRole.entities.ContaMetaAds.delete(acc.id);
        }

        // Bulk create new accounts
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