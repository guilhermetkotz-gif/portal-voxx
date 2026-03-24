import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch all Google Ads accounts
        const accounts = await base44.asServiceRole.entities.GoogleAdsAccount.list('-created_date', 1000);

        if (!accounts || accounts.length === 0) {
            return Response.json({ 
                success: true,
                message: 'Nenhuma conta encontrada',
                accountsProcessed: 0
            });
        }

        // Helper functions for score calculation
        const normalizeOptScore = (score) => {
            return score && score > 0 ? score : 50;
        };

        const getCPAScore = (costPerConv) => {
            if (!costPerConv || costPerConv === 0) return 10;
            if (costPerConv <= 5) return 100;
            if (costPerConv <= 10) return 85;
            if (costPerConv <= 20) return 70;
            if (costPerConv <= 40) return 50;
            return 20;
        };

        const getVolumeScore = (conversions) => {
            if (conversions >= 200) return 100;
            if (conversions >= 100) return 85;
            if (conversions >= 50) return 70;
            if (conversions >= 10) return 50;
            if (conversions >= 1) return 30;
            return 10;
        };

        const getCPCScore = (cpc) => {
            if (cpc <= 1.00) return 100;
            if (cpc <= 2.00) return 80;
            if (cpc <= 4.00) return 60;
            if (cpc <= 6.00) return 40;
            return 20;
        };

        const getStatusScore = (status) => {
            if (status === 'Ativa') return 100;
            if (status === 'Pausada') return 40;
            return 20;
        };

        const calculateHealthScore = (account) => {
            // Se conta sem dados, retorna 0
            if (account.conta_sem_dados) {
                return 0;
            }

            const optScoreNorm = normalizeOptScore(account.optimization_score);
            const cpScore = getCPAScore(account.cost_per_conversion);
            const volumeScore = getVolumeScore(account.conversions);
            const cpcScore = getCPCScore(account.avg_cpc);
            const statusScore = getStatusScore(account.account_status);

            const finalScore = 
                (optScoreNorm * 0.35) +
                (cpScore * 0.30) +
                (volumeScore * 0.20) +
                (cpcScore * 0.10) +
                (statusScore * 0.05);

            return Math.round(finalScore);
        };

        const getHealthStatus = (score, contaSemDados) => {
            if (contaSemDados) return 'Sem dados';
            if (score >= 85) return 'Saudável';
            if (score >= 70) return 'Atenção';
            if (score >= 50) return 'Crítico';
            return 'Urgente';
        };

        const generateAlertas = (account) => {
            const alertas = [];

            // ALERTA 1 — Conta sem dados
            if (account.conta_sem_dados) {
                alertas.push('Conta sem entrega');
            }

            // ALERTA 2 — CPA alto
            if (account.cost_per_conversion > 30) {
                alertas.push('CPA elevado');
            }

            // ALERTA 3 — Zero conversões com gasto
            if (account.conversions === 0 && account.cost > 200) {
                alertas.push('Gasto sem conversão');
            }

            // ALERTA 4 — Optimization baixo
            if (account.optimization_score < 70 && account.optimization_score > 0) {
                alertas.push('Optimization baixo');
            }

            // ALERTA 5 — CPC caro
            if (account.avg_cpc > 4) {
                alertas.push('CPC acima do ideal');
            }

            return alertas;
        };

        const getPrioridadeAcao = (healthStatus) => {
            const prioridadeMap = {
                'Urgente': 'Atuar hoje',
                'Crítico': 'Alta prioridade',
                'Atenção': 'Monitorar',
                'Saudável': 'Escalar',
                'Sem dados': 'Investigar'
            };
            return prioridadeMap[healthStatus] || 'Monitorar';
        };

        // Calculate scores for all accounts
        const accountsWithScores = accounts.map(account => ({
            id: account.id,
            health_score: calculateHealthScore(account),
            account
        }));

        // Sort by health_score DESC for ranking
        accountsWithScores.sort((a, b) => b.health_score - a.health_score);

        // Update accounts with all derived fields
        const updatePromises = accountsWithScores.map((item, index) => {
            const account = item.account;
            const healthScore = item.health_score;
            const healthStatus = getHealthStatus(healthScore, account.conta_sem_dados);
            const alertas = generateAlertas(account);
            const prioridadeAcao = getPrioridadeAcao(healthStatus);
            const rankingPosicao = index + 1;

            return base44.asServiceRole.entities.GoogleAdsAccount.update(account.id, {
                health_score: healthScore,
                health_status: healthStatus,
                ranking_posicao: rankingPosicao,
                alertas: alertas,
                prioridade_acao: prioridadeAcao
            });
        });

        await Promise.all(updatePromises);

        return Response.json({
            success: true,
            accountsProcessed: accounts.length,
            message: `Health scores calculados para ${accounts.length} contas`
        });

    } catch (error) {
        console.error('Error calculating health scores:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});