import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import moment from 'npm:moment@2.30.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Apenas admins podem gerar missões
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const hoje = moment().format('YYYY-MM-DD');

        // 1. Buscar dados do RADAR META
        const radarData = await base44.asServiceRole.entities.RadarMetaData.list('-created_date', 500);
        const clientes = await base44.asServiceRole.entities.Cliente.list('-updated_date', 500);
        const accounts = await base44.asServiceRole.entities.ContaMetaAds.list('-created_date', 500);

        // 2. Criar mapa de clientes
        const clientesMap = new Map(clientes.map(c => [c.nome, c]));
        const radarMap = new Map(radarData.map(r => [r.account_name, r]));

        // 3. Processar RADAR e gerar missões
        const missoesCriadas = [];
        const missoesExistentes = await base44.asServiceRole.entities.GamificacaoMissaoRadar.filter({
            data_missao: hoje
        });
        const jaExistenteSet = new Set(missoesExistentes.map(m => m.unidade_nome));

        for (const account of accounts) {
            const accountName = account.account_name;
            
            // Pular se já tem missão gerada hoje
            if (jaExistenteSet.has(accountName)) continue;

            const cliente = clientesMap.get(accountName);
            if (!cliente) continue;

            // Pular se não tem responsável definido
            if (!cliente.responsavel_voxx_trafego) continue;

            const radar = radarMap.get(accountName);
            if (!radar) continue;

            // ========== LÓGICA DO RADAR (simplificada) ==========
            const leadsOntem = radar.leads_ontem || 0;
            const leads7d = radar.leads_7d || 0;
            const leadsDia7d = leads7d > 0 ? leads7d / 7 : 0;

            const cplAtual = radar.cpl_ontem || 0;
            const cpl7d = radar.cpl_7d || 0;

            const ctrAtual = radar.ctr_ontem || 0;
            const ctr7d = radar.ctr_7d || 0;

            const frequencia7d = radar.frequencia_7d || 0;
            const investimentoDiario = radar.amount_spent_ontem || 0;

            // ========== ESTADO ESTRUTURAL (7d) ==========
            let estadoScore = 100;
            
            if (cpl7d > 50) estadoScore -= 40;
            else if (cpl7d > 35) estadoScore -= 25;
            else if (cpl7d > 25) estadoScore -= 15;

            if (ctr7d < 0.5) estadoScore -= 30;
            else if (ctr7d < 1.0) estadoScore -= 20;
            else if (ctr7d < 1.5) estadoScore -= 10;

            if (frequencia7d >= 3.0) estadoScore -= 35;
            else if (frequencia7d >= 2.5) estadoScore -= 20;
            else if (frequencia7d >= 1.8) estadoScore -= 5;
            else estadoScore += 10;

            estadoScore = Math.max(0, Math.min(100, estadoScore));

            let estadoLabel;
            if (estadoScore < 40) estadoLabel = 'critico';
            else if (estadoScore < 60) estadoLabel = 'atencao';
            else if (estadoScore < 80) estadoLabel = 'operacional';
            else estadoLabel = 'saudavel';

            // ========== TENDÊNCIA (ontem vs 7d) ==========
            let tendenciaScore = 50;
            let sinaisTendencia = 0;
            let gastoSemConversao = false;

            // Validação CPL
            if (leadsOntem === 0 && investimentoDiario > 0) {
                gastoSemConversao = true;
                tendenciaScore -= 20;
                sinaisTendencia -= 2;
            } else if (leadsOntem > 0) {
                if (cplAtual < cpl7d * 0.9) {
                    tendenciaScore += 10;
                    sinaisTendencia++;
                } else if (cplAtual > cpl7d * 1.1) {
                    tendenciaScore -= 10;
                    sinaisTendencia--;
                }
            }

            // CTR
            if (ctrAtual > ctr7d * 1.1) {
                tendenciaScore += 10;
                sinaisTendencia++;
            } else if (ctrAtual < ctr7d * 0.9) {
                tendenciaScore -= 10;
                sinaisTendencia--;
            }

            // Leads/dia
            if (leadsOntem > leadsDia7d * 1.2) {
                tendenciaScore += 10;
                sinaisTendencia++;
            } else if (leadsOntem < leadsDia7d * 0.7) {
                tendenciaScore -= 10;
                sinaisTendencia--;
            }

            let tendenciaLabel = 'neutra';
            if (sinaisTendencia >= 2) tendenciaLabel = 'positiva';
            else if (sinaisTendencia <= -2) tendenciaLabel = 'negativa';

            // ========== PRIORIDADE (Estado x Tendência) ==========
            let prioridadeRaw;
            
            if (estadoScore < 40) {
                if (tendenciaLabel === 'negativa') prioridadeRaw = 'critica';
                else if (tendenciaLabel === 'positiva') prioridadeRaw = 'media';
                else prioridadeRaw = 'alta';
            } else if (estadoScore < 60) {
                if (tendenciaLabel === 'negativa') prioridadeRaw = 'alta';
                else if (tendenciaLabel === 'positiva') prioridadeRaw = 'baixa';
                else prioridadeRaw = 'media';
            } else {
                if (tendenciaLabel === 'negativa') prioridadeRaw = 'media';
                else prioridadeRaw = 'baixa';
            }

            // Elevar prioridade por eventos críticos
            if (frequencia7d >= 3.0) {
                prioridadeRaw = 'critica';
            } else if (frequencia7d >= 2.5 && prioridadeRaw === 'media') {
                prioridadeRaw = 'alta';
            }

            if (gastoSemConversao) {
                if (prioridadeRaw === 'baixa') prioridadeRaw = 'media';
                else if (prioridadeRaw === 'media') prioridadeRaw = 'alta';
            }

            const radarScore = Math.round(
                (estadoScore * 0.4) + (tendenciaScore * 0.3) + (50 * 0.3) // impacto simplificado
            );

            // ========== PREVISÃO 7D ==========
            const taxaCPL = cpl7d > 0 ? (cplAtual - cpl7d) / cpl7d : 0;
            const cplPrevisao = cplAtual * (1 + taxaCPL * 0.5);
            
            let estadoPrevisao = 100;
            if (cplPrevisao > 50) estadoPrevisao -= 40;
            else if (cplPrevisao > 35) estadoPrevisao -= 25;
            else if (cplPrevisao > 25) estadoPrevisao -= 15;

            const radarScorePrevisao = Math.round(estadoPrevisao * 0.6);
            const delta = radarScorePrevisao - radarScore;
            
            // Confiança da previsão (baixa se freq. crítica ou gasto sem lead)
            let confiancaPrevisao = 'alta';
            if (frequencia7d >= 3.0 || gastoSemConversao) confiancaPrevisao = 'baixa';
            else if (frequencia7d >= 2.5) confiancaPrevisao = 'media';

            // ========== GERAR MOTIVO ==========
            let motivo = '';
            if (gastoSemConversao) {
                motivo = '🚨 ALERTA: Ontem houve gasto sem geração de leads - Revisar campanha urgentemente';
            } else if (estadoScore < 40 && tendenciaLabel === 'negativa') {
                motivo = '🔴 Performance crítica e em deterioração - Ação imediata necessária';
            } else if (estadoScore < 40) {
                motivo = '🔴 Performance crítica - Requer otimização estrutural';
            } else if (estadoScore < 60 && tendenciaLabel === 'negativa') {
                motivo = '🟠 Performance moderada com sinais de queda - Ajustar estratégia';
            } else if (frequencia7d >= 3.0) {
                motivo = '⚠️ Saturação crítica detectada (freq. ≥3.0) - Renovar criativo/público';
            } else if (estadoScore >= 60 && tendenciaLabel === 'negativa') {
                motivo = '🟡 Conta saudável com sinais iniciais de queda - Monitorar';
            } else {
                motivo = '✓ Manter monitoramento de rotina';
            }

            // ========== ALERTAS ESPECIAIS ==========
            const alertas = [];
            if (gastoSemConversao) alertas.push('Gasto sem conversão');
            if (frequencia7d >= 3.0) alertas.push('Saturação crítica');
            else if (frequencia7d >= 2.5) alertas.push('Atenção: Frequência elevada');

            // ========== CRIAR MISSÃO (apenas se prioridade não for "baixa" sem problemas) ==========
            // Gerar missões apenas para prioridade >= média OU se houver alerta
            if (prioridadeRaw !== 'baixa' || alertas.length > 0) {
                const missao = {
                    data_missao: hoje,
                    responsavel_user_id: cliente.responsavel_voxx_trafego, // email como ID
                    responsavel_nome: cliente.responsavel_voxx_trafego,
                    responsavel_email: cliente.responsavel_voxx_trafego,
                    unidade_id: cliente.id,
                    unidade_nome: accountName,
                    prioridade_radar: prioridadeRaw,
                    estado_estrutural: estadoLabel,
                    tendencia_recente: tendenciaLabel,
                    radar_score: radarScore,
                    motivo,
                    alertas_especiais: alertas,
                    metricas_radar: {
                        cpl_atual: cplAtual,
                        cpl_7d: cpl7d,
                        ctr_atual: ctrAtual,
                        frequencia_7d: frequencia7d,
                        leads_ontem: leadsOntem,
                        investimento_diario: investimentoDiario
                    },
                    previsao_7d: {
                        radar_score: radarScorePrevisao,
                        delta,
                        confianca: confiancaPrevisao
                    },
                    status: 'pendente'
                };

                await base44.asServiceRole.entities.GamificacaoMissaoRadar.create(missao);
                missoesCriadas.push(accountName);
            }
        }

        return Response.json({
            success: true,
            data_missao: hoje,
            total_missoes_criadas: missoesCriadas.length,
            missoes_criadas: missoesCriadas
        });
    } catch (error) {
        console.error('Erro ao gerar missões:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});