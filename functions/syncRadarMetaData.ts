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

        console.log('Aba Ontem:', ontemSheetName, '- Linhas:', ontemData.length);
        console.log('Aba 7 Dias:', seteDiasSheetName, '- Linhas:', seteDiasData.length);

        if (ontemData.length < 2) {
            return Response.json({ error: `Aba "${ontemSheetName}" vazia ou sem dados` }, { status: 404 });
        }
        
        if (seteDiasData.length < 2) {
            return Response.json({ error: `Aba "${seteDiasSheetName}" vazia ou sem dados` }, { status: 404 });
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
            
            // Find column indices using config mapping
            const getColIndex = (configKey) => {
                const columnName = colMap[configKey];
                if (!columnName) return -1;
                return headers.findIndex(h => h && h.toLowerCase().includes(columnName.toLowerCase()));
            };

            const accountNameIdx = getColIndex('account_name');
            const cplIdx = getColIndex('cost_per_messaging');
            const leadsIdx = getColIndex('messaging_conversations');
            const clicksIdx = getColIndex('clicks_all');
            const impressionsIdx = getColIndex('impressions');
            const frequencyIdx = getColIndex('frequency');
            const amountSpentIdx = getColIndex('amount_spent');

            console.log('Column indices:', {
                accountName: accountNameIdx,
                cpl: cplIdx,
                leads: leadsIdx,
                clicks: clicksIdx,
                impressions: impressionsIdx,
                frequency: frequencyIdx,
                amountSpent: amountSpentIdx
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
                const amountSpent = parseNumber(row[amountSpentIdx]);
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

                // Log São Sebastião for debugging
                if (accountName.toLowerCase().includes('sebastião')) {
                    console.log('São Sebastião do Paraíso data:', {
                        accountName,
                        amount_spent_raw: row[amountSpentIdx],
                        amount_spent_parsed: amountSpent,
                        cpl_raw: row[cplIdx],
                        leads_raw: row[leadsIdx],
                        row_length: row.length,
                        full_row: row
                    });
                }

                result[accountName] = {
                    cpl,
                    leads,
                    ctr,
                    frequency,
                    amountSpent
                };
            }

            return result;
        };

        const ontemProcessed = processSheet(ontemData);
        const seteDiasProcessed = processSheet(seteDiasData);

        // Calculate deltas for each account
        const radarData = [];
        
        // Usar todas as contas da aba 7 dias como base (estado estrutural)
        for (const accountName in seteDiasProcessed) {
            const seteDias = seteDiasProcessed[accountName];
            const ontem = ontemProcessed[accountName] || { 
                cpl: 0, 
                leads: 0, 
                ctr: 0, 
                frequency: 0, 
                amountSpent: 0 
            };

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

            // ========== STATUS DE VEICULAÇÃO ==========
            const gastoSemanal = seteDias.amountSpent;
            const statusVeiculacao = gastoSemanal > 0 ? 'ATIVA' : 'SEM_VEICULACAO';
            
            let radarScore = 0;
            let classificacao = 'SEM_DADOS';
            
            // Só calcular score se houver veiculação
            if (statusVeiculacao === 'ATIVA') {
                // ========== NOVO RADAR SCORE (0-100) ==========
                
                // 2.1 SAÚDE ESTRUTURAL (0-50) — Aba 7 dias
                let saudeEstrutural = 0;
                
                // A) CPL (0-25 pts) — FAIXAS FIXAS
                const cpl7d = seteDias.cpl;
                let scoreCPL = 0;
                if (cpl7d <= 25) scoreCPL = 1.0;
                else if (cpl7d <= 30) scoreCPL = 0.85;
                else if (cpl7d <= 36) scoreCPL = 0.70;
                else if (cpl7d <= 39) scoreCPL = 0.50;
                else if (cpl7d <= 45) scoreCPL = 0.25;
                else scoreCPL = 0.0;
                saudeEstrutural += scoreCPL * 25;
                
                // B) Frequência (0-10 pts) — SOMENTE estrutural
                const freq7d = seteDias.frequency;
                let scoreFreq = 0;
                if (freq7d <= 2.5) scoreFreq = 1.0;
                else if (freq7d <= 3.0) scoreFreq = 0.90;
                else if (freq7d <= 4.5) scoreFreq = 0.70;
                else if (freq7d <= 4.8) scoreFreq = 0.40;
                else if (freq7d <= 6.0) scoreFreq = 0.20;
                else scoreFreq = 0.0;
                saudeEstrutural += scoreFreq * 10;
                
                // C) % Leads repetidos (0-10 pts) - assumir 0 por enquanto (sem dados)
                // Pode ser implementado futuramente
                saudeEstrutural += 5; // neutro
                
                // D) CTR médio (0-5 pts) - neutro por enquanto
                saudeEstrutural += 2.5;
                
                // 2.2 TENDÊNCIA RECENTE (0-30) — Ontem vs 7 dias
                let tendenciaRecente = 0;
                
                // A) CPL Tendência (0-10 pts)
                const leadsOntem = ontem.leads;
                const gastoOntem = ontem.amountSpent;
                const cplOntem = ontem.cpl;
                
                if (leadsOntem === 0 && gastoOntem > 0) {
                    // Gasto sem conversão = 0 pontos
                    tendenciaRecente += 0;
                } else if (leadsOntem > 0) {
                    const variacao = ((cplOntem - cpl7d) / cpl7d) * 100;
                    if (variacao < -10) tendenciaRecente += 10; // Melhorou
                    else if (variacao > 10) tendenciaRecente += 0; // Piorou
                    else tendenciaRecente += 5; // Estável
                } else {
                    tendenciaRecente += 5; // Neutro
                }
                
                // B) CTR Tendência (0-10)
                const ctrOntem = ontem.ctr;
                const ctr7d = seteDias.ctr;
                if (ctr7d > 0) {
                    const variacaoCTR = ((ctrOntem - ctr7d) / ctr7d) * 100;
                    if (variacaoCTR > 10) tendenciaRecente += 10;
                    else if (variacaoCTR < -10) tendenciaRecente += 0;
                    else tendenciaRecente += 5;
                } else {
                    tendenciaRecente += 5;
                }
                
                // C) Leads Tendência (0-10)
                const mediaLeadsDia = leads7dMediaDia;
                if (mediaLeadsDia > 0) {
                    if (leadsOntem > mediaLeadsDia * 1.2) tendenciaRecente += 10;
                    else if (leadsOntem < mediaLeadsDia * 0.7) tendenciaRecente += 0;
                    else tendenciaRecente += 5;
                } else {
                    tendenciaRecente += 5;
                }
                
                // 2.3 ESTABILIDADE & CONSISTÊNCIA (0-20)
                let estabilidade = 10; // Base
                
                // Penalizar gasto sem conversão
                if (leadsOntem === 0 && gastoOntem > 0) {
                    estabilidade -= 10;
                }
                
                // Penalizar frequência alta
                if (freq7d >= 3.0) estabilidade -= 5;
                
                // Bonificar conta saudável
                if (cpl7d <= 30 && freq7d < 2.5) estabilidade += 5;
                
                estabilidade = Math.max(0, Math.min(20, estabilidade));
                
                // Radar Score Base
                radarScore = Math.round(saudeEstrutural + tendenciaRecente + estabilidade);
                
                // 2.4 BÔNUS DE EXCELÊNCIA (+0 a +10)
                if (cpl7d <= 25 && freq7d < 2.0 && tendenciaRecente >= 20) {
                    radarScore += 10;
                } else if (cpl7d <= 30 && freq7d < 2.5 && tendenciaRecente >= 15) {
                    radarScore += 5;
                }
                
                radarScore = Math.min(100, radarScore);
                
                // Classificação
                if (radarScore >= 90) classificacao = 'ELITE';
                else if (radarScore >= 80) classificacao = 'FORTE';
                else if (radarScore >= 70) classificacao = 'BOA';
                else if (radarScore >= 60) classificacao = 'OPERACIONAL';
                else if (radarScore >= 40) classificacao = 'ATENCAO';
                else classificacao = 'CRITICA';
            }

            radarData.push({
                account_name: accountName,
                cpl_ontem: ontem.cpl,
                leads_ontem: ontem.leads,
                ctr_ontem: ontem.ctr,
                frequencia_ontem: ontem.frequency,
                amount_spent_ontem: ontem.amountSpent,
                cpl_7d: seteDias.cpl,
                leads_7d: seteDias.leads,
                leads_7d_media_dia: leads7dMediaDia,
                ctr_7d: seteDias.ctr,
                frequencia_7d: seteDias.frequency,
                amount_spent_7d: seteDias.amountSpent,
                variacao_cpl: variacaoCPL,
                variacao_ctr: variacaoCTR,
                variacao_frequencia: variacaoFrequencia,
                radar_score: radarScore,
                classificacao: classificacao,
                status_veiculacao: statusVeiculacao
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