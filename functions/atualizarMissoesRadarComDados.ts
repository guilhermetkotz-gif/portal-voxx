import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Apenas admins podem atualizar missões
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Buscar todas as missões que têm dados zerados ou null
        const missoes = await base44.asServiceRole.entities.GamificacaoMissaoRadar.list('-created_date', 500);
        const radarData = await base44.asServiceRole.entities.RadarMetaData.list('-created_date', 500);

        // Criar mapa de radar data por account_name
        const radarMap = new Map(radarData.map(r => [r.account_name, r]));

        const missoesAtualizadas = [];
        const updates = [];

        for (const missao of missoes) {
            // Verificar se a missão tem dados zerados ou null
            const temDadosZerados = !missao.metricas_radar || 
                                    missao.metricas_radar.cpl_atual === 0 || 
                                    missao.metricas_radar.cpl_atual === null;

            if (temDadosZerados) {
                const radar = radarMap.get(missao.unidade_nome);
                
                if (radar) {
                    // Calcular previsão 7d
                    const leadsOntem = radar.leads_ontem || 0;
                    const leads7d = radar.leads_7d || 0;
                    const leadsDia7d = leads7d > 0 ? leads7d / 7 : 0;

                    const cplAtual = radar.cpl_ontem || 0;
                    const cpl7d = radar.cpl_7d || 0;

                    const ctrAtual = radar.ctr_ontem || 0;
                    const ctr7d = radar.ctr_7d || 0;

                    const frequencia7d = radar.frequencia_7d || 0;
                    const investimentoDiario = radar.amount_spent_ontem || 0;

                    // Calcular score base
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

                    // Tendência
                    let tendenciaScore = 50;
                    let gastoSemConversao = false;

                    if (leadsOntem === 0 && investimentoDiario > 0) {
                        gastoSemConversao = true;
                        tendenciaScore -= 20;
                    } else if (leadsOntem > 0) {
                        if (cplAtual < cpl7d * 0.9) {
                            tendenciaScore += 10;
                        } else if (cplAtual > cpl7d * 1.1) {
                            tendenciaScore -= 10;
                        }
                    }

                    if (ctrAtual > ctr7d * 1.1) {
                        tendenciaScore += 10;
                    } else if (ctrAtual < ctr7d * 0.9) {
                        tendenciaScore -= 10;
                    }

                    const radarScore = Math.round(
                        (estadoScore * 0.4) + (tendenciaScore * 0.3) + (50 * 0.3)
                    );

                    // Previsão 7d
                    const taxaCPL = cpl7d > 0 ? (cplAtual - cpl7d) / cpl7d : 0;
                    const cplPrevisao = cplAtual * (1 + taxaCPL * 0.5);
                    
                    let estadoPrevisao = 100;
                    if (cplPrevisao > 50) estadoPrevisao -= 40;
                    else if (cplPrevisao > 35) estadoPrevisao -= 25;
                    else if (cplPrevisao > 25) estadoPrevisao -= 15;

                    const radarScorePrevisao = Math.round(estadoPrevisao * 0.6);
                    const delta = radarScorePrevisao - radarScore;
                    
                    let confiancaPrevisao = 'alta';
                    if (frequencia7d >= 3.0 || gastoSemConversao) confiancaPrevisao = 'baixa';
                    else if (frequencia7d >= 2.5) confiancaPrevisao = 'media';

                    // Preparar atualização
                    updates.push({
                        id: missao.id,
                        data: {
                            radar_score: radarScore,
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
                            }
                        }
                    });

                    missoesAtualizadas.push(missao.unidade_nome);
                }
            }
        }

        // Executar updates em lotes de 10 para evitar rate limit
        for (let i = 0; i < updates.length; i += 10) {
            const batch = updates.slice(i, i + 10);
            await Promise.all(
                batch.map(update => 
                    base44.asServiceRole.entities.GamificacaoMissaoRadar.update(update.id, update.data)
                )
            );
            // Pequeno delay entre lotes
            if (i + 10 < updates.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return Response.json({
            success: true,
            total_missoes_atualizadas: missoesAtualizadas.length,
            missoes_atualizadas: missoesAtualizadas
        });
    } catch (error) {
        console.error('Erro ao atualizar missões:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});