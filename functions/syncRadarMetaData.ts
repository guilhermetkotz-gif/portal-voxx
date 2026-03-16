import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get active config for radar
        const configs = await base44.asServiceRole.entities.MetaAdsSheetConfig.filter({ 
            tipo: 'radar', 
            ativo: true 
        });

        if (!configs || configs.length === 0) {
            return Response.json({ 
                error: 'Nenhuma configuração ativa encontrada para RADAR META. Configure em Monitoramento de Contas > RADAR META > Configurar Origem dos Dados' 
            }, { status: 400 });
        }

        const config = configs[0];
        const spreadsheetId = config.spreadsheet_id;
        const ontemSheetName = config.aba_ontem;
        const seteDiasSheetName = config.aba_7dias;
        const colMap = config.mapeamento_colunas;

        const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

        // Fetch data from both sheets
        const fetchSheetData = async (sheetName) => {
            const range = `${sheetName}!A:V`;
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
                throw new Error(`Failed to fetch ${sheetName}: ${response.statusText}`);
            }

            const data = await response.json();
            return data.values || [];
        };

        const ontemData = await fetchSheetData(ontemSheetName);
        const seteDiasData = await fetchSheetData(seteDiasSheetName);

        if (ontemData.length < 2 || seteDiasData.length < 2) {
            return Response.json({ error: 'No data found in sheets' }, { status: 404 });
        }

        // Process data
        const parseNumber = (val) => {
            if (!val || val === '') return null;
            // Remove espaços e outros caracteres, mantém apenas números, ponto e vírgula
            const str = String(val).trim().replace(/\s/g, '');
            // Trata formato brasileiro (1.234,56) ou americano (1,234.56)
            const hasComma = str.includes(',');
            const hasDot = str.includes('.');
            
            let cleaned = str;
            if (hasComma && hasDot) {
                // Ambos presentes - determinar qual é decimal
                const commaPos = str.lastIndexOf(',');
                const dotPos = str.lastIndexOf('.');
                if (dotPos > commaPos) {
                    // Formato: 1.234,56 -> remove ponto, troca vírgula por ponto
                    cleaned = str.replace(/\./g, '').replace(',', '.');
                } else {
                    // Formato: 1,234.56 -> remove vírgula
                    cleaned = str.replace(/,/g, '');
                }
            } else if (hasComma) {
                // Só vírgula - trocar por ponto
                cleaned = str.replace(',', '.');
            }
            
            // Remove tudo exceto números e ponto decimal
            cleaned = cleaned.replace(/[^\d.]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? null : num;
        };

        const processSheet = (rows) => {
            const headers = rows[0];
            
            // Find column indices using config mapping
            const getColIndex = (configKey) => {
                const columnName = colMap[configKey];
                if (!columnName) return -1;
                return headers.findIndex(h => h && h.trim().toLowerCase() === columnName.trim().toLowerCase());
            };

            const accountNameIdx = getColIndex('account_name');
            const cplIdx = getColIndex('cost_per_messaging');
            const leadsIdx = getColIndex('cadastros_whats'); // CADASTROS + WHATS (nova fonte)
            const clicksIdx = getColIndex('clicks_all');
            const impressionsIdx = getColIndex('impressions');
            const frequencyIdx = getColIndex('frequency');
            const amountSpentIdx = getColIndex('amount_spent');

            console.error('=== MAPEAMENTO DE COLUNAS ===');
            console.error('Config mapping messaging_conversations:', colMap.messaging_conversations);
            console.error('Headers encontrados:', headers);
            console.error('LEADS coluna encontrada (index', leadsIdx, '):', headers[leadsIdx]);
            console.error('Valor esperado:', colMap.messaging_conversations);
            
            if (leadsIdx === -1) {
                console.error('ERRO: Coluna de leads não encontrada! Verificar mapeamento.');
            }

            const result = {};

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                const accountName = (row[accountNameIdx] || '').trim();
                if (!accountName) continue;

                const cpl = parseNumber(row[cplIdx]);
                const leads = parseNumber(row[leadsIdx]);
                const clicks = parseNumber(row[clicksIdx]);
                const impressions = parseNumber(row[impressionsIdx]);
                const frequency = parseNumber(row[frequencyIdx]);
                const amountSpent = parseNumber(row[amountSpentIdx]);
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

                // Log primeiras 5 linhas para debug
                if (i <= 5) {
                    console.error(`ROW ${i} - ${accountName}:`);
                    console.error(`  LEADS col[${leadsIdx}] = "${row[leadsIdx]}" → parsed: ${leads}`);
                }

                result[accountName] = {
                    cpl,
                    leads,
                    ctr,
                    frequency,
                    amountSpent,
                    impressions
                };
            }

            return result;
        };

        const ontemProcessed = processSheet(ontemData);
        const seteDiasProcessed = processSheet(seteDiasData);

        // Get all unique account names from BOTH sheets (LEFT JOIN)
        const allAccountNames = new Set([
            ...Object.keys(ontemProcessed),
            ...Object.keys(seteDiasProcessed)
        ]);

        // Calculate deltas for each account
        const radarData = [];
        
        for (const accountName of allAccountNames) {
            const ontem = ontemProcessed[accountName] || { cpl: null, leads: null, ctr: null, frequency: null, amountSpent: null, impressions: null };
            const seteDias = seteDiasProcessed[accountName] || { cpl: null, leads: null, ctr: null, frequency: null, amountSpent: null, impressions: null };

            // Calculate 7-day daily average using CADASTROS + WHATS / 7 (null-safe)
            const leads7dMediaDia = seteDias.leads != null ? seteDias.leads / 7 : null;

            // Calculate deltas (null-safe)
            let variacaoCPL = null;
            if (ontem.cpl != null && seteDias.cpl != null && seteDias.cpl > 0) {
                variacaoCPL = ((ontem.cpl - seteDias.cpl) / seteDias.cpl) * 100;
            }

            let variacaoCTR = null;
            if (ontem.ctr != null && seteDias.ctr != null && seteDias.ctr > 0) {
                variacaoCTR = ((ontem.ctr - seteDias.ctr) / seteDias.ctr) * 100;
            }

            let variacaoFrequencia = null;
            if (ontem.frequency != null && seteDias.frequency != null && seteDias.frequency > 0) {
                variacaoFrequencia = ((ontem.frequency - seteDias.frequency) / seteDias.frequency) * 100;
            }

            radarData.push({
                account_name: accountName,
                cpl_ontem: ontem.cpl,
                leads_ontem: ontem.leads,
                ctr_ontem: ontem.ctr,
                frequencia_ontem: ontem.frequency,
                amount_spent_ontem: ontem.amountSpent,
                impressions_ontem: ontem.impressions,
                cpl_7d: seteDias.cpl,
                leads_7d: seteDias.leads,
                leads_7d_media_dia: leads7dMediaDia,
                ctr_7d: seteDias.ctr,
                frequencia_7d: seteDias.frequency,
                impressions_7d: seteDias.impressions,
                variacao_cpl: variacaoCPL,
                variacao_ctr: variacaoCTR,
                variacao_frequencia: variacaoFrequencia
            });
        }

        // Delete existing radar data and insert new
        const existing = await base44.asServiceRole.entities.RadarMetaData?.list('-created_date', 1000).catch(() => []);
        
        if (existing && existing.length > 0) {
            const deletePromises = existing.map(item => 
                base44.asServiceRole.entities.RadarMetaData.delete(item.id)
            );
            await Promise.all(deletePromises);
        }

        // Insert new data
        if (radarData.length > 0) {
            await base44.asServiceRole.entities.RadarMetaData.bulkCreate(radarData);
        }

        return Response.json({ 
            success: true, 
            accountsProcessed: radarData.length,
            message: `Successfully synced ${radarData.length} radar data records`
        });

    } catch (error) {
        console.error('Error syncing Radar Meta data:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});