import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const spreadsheetId = '1aweubWBZdD71YvmBnDbq0xA6BUZCjL6_iuqmE2L9YA8';
        const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

        // Get sheet metadata to find "Ontem Meta Ads" and "7 dias Meta Ads" sheets
        const metaResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!metaResponse.ok) {
            throw new Error(`Failed to fetch sheet metadata: ${metaResponse.statusText}`);
        }

        const metadata = await metaResponse.json();
        const sheets = metadata.sheets;

        // Find the sheets
        const ontemSheet = sheets.find(s => 
            s.properties.title.toLowerCase().includes('ontem') && 
            s.properties.title.toLowerCase().includes('meta')
        );
        const seteDiasSheet = sheets.find(s => 
            s.properties.title.toLowerCase().includes('7') && 
            s.properties.title.toLowerCase().includes('dia') &&
            s.properties.title.toLowerCase().includes('meta')
        );

        if (!ontemSheet || !seteDiasSheet) {
            return Response.json({ 
                error: 'Sheets not found',
                available: sheets.map(s => s.properties.title)
            }, { status: 404 });
        }

        console.log('Found sheets:', {
            ontem: ontemSheet.properties.title,
            seteDias: seteDiasSheet.properties.title
        });

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

        const ontemData = await fetchSheetData(ontemSheet.properties.title);
        const seteDiasData = await fetchSheetData(seteDiasSheet.properties.title);

        if (ontemData.length < 2 || seteDiasData.length < 2) {
            return Response.json({ error: 'No data found in sheets' }, { status: 404 });
        }

        // Process data
        const parseNumber = (val) => {
            if (!val) return 0;
            const str = typeof val === 'string' ? val.replace(/[^\d.,-]/g, '').replace(',', '.') : val;
            const num = parseFloat(str);
            return isNaN(num) ? 0 : num;
        };

        const processSheet = (rows) => {
            const headers = rows[0];
            const getColIndex = (name) => headers.findIndex(h => h && h.toLowerCase().includes(name.toLowerCase()));

            const accountNameIdx = getColIndex('account name');
            
            // Find "Cost per Messaging Conversations Started" column
            const cplIdx = headers.findIndex(h => 
                h && h.toLowerCase().includes('cost per messaging conversations started')
            );
            
            // Find "Messaging Conversations Started" column (not the cost per)
            const leadsIdx = headers.findIndex(h => 
                h && h.toLowerCase().includes('messaging conversations started') &&
                !h.toLowerCase().includes('cost per')
            );
            
            const clicksIdx = getColIndex('clicks (all)');
            const impressionsIdx = getColIndex('impressions');
            const frequencyIdx = getColIndex('frequency');

            console.log('Column indices:', {
                accountName: accountNameIdx,
                cpl: cplIdx,
                leads: leadsIdx,
                clicks: clicksIdx,
                impressions: impressionsIdx,
                frequency: frequencyIdx
            });

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
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

                // Log Votuporanga for debugging
                if (accountName.toLowerCase().includes('votuporanga')) {
                    console.log('Votuporanga data:', {
                        accountName,
                        cpl_raw: row[cplIdx],
                        cpl_parsed: cpl,
                        leads_raw: row[leadsIdx],
                        leads_parsed: leads,
                        ctr_calculated: ctr,
                        row_length: row.length
                    });
                }

                result[accountName] = {
                    cpl,
                    leads,
                    ctr,
                    frequency
                };
            }

            return result;
        };

        const ontemProcessed = processSheet(ontemData);
        const seteDiasProcessed = processSheet(seteDiasData);

        // Calculate deltas for each account
        const radarData = [];
        
        for (const accountName in ontemProcessed) {
            const ontem = ontemProcessed[accountName];
            const seteDias = seteDiasProcessed[accountName];

            if (!seteDias) continue; // Skip if account not in 7-day data

            // Calculate 7-day daily average
            const leads7dMediaDia = seteDias.leads / 7;

            // Calculate deltas
            let variacaoCPL = 0;
            if (seteDias.cpl > 0) {
                variacaoCPL = ((ontem.cpl - seteDias.cpl) / seteDias.cpl) * 100;
            }

            let variacaoCTR = 0;
            if (seteDias.ctr > 0) {
                variacaoCTR = ((ontem.ctr - seteDias.ctr) / seteDias.ctr) * 100;
            }

            let variacaoFrequencia = 0;
            if (seteDias.frequency > 0) {
                variacaoFrequencia = ((ontem.frequency - seteDias.frequency) / seteDias.frequency) * 100;
            }

            radarData.push({
                account_name: accountName,
                cpl_ontem: ontem.cpl,
                leads_ontem: ontem.leads,
                ctr_ontem: ontem.ctr,
                frequencia_ontem: ontem.frequency,
                cpl_7d: seteDias.cpl,
                leads_7d: seteDias.leads,
                leads_7d_media_dia: leads7dMediaDia,
                ctr_7d: seteDias.ctr,
                frequencia_7d: seteDias.frequency,
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