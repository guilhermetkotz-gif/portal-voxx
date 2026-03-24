import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
        }

        // Buscar todos os clientes com responsavel_google_ads definido
        const clientes = await base44.asServiceRole.entities.Cliente.list();
        const clientesComResponsavel = clientes.filter(c => c.responsavel_google_ads && c.google_ads_account_name);

        // Buscar todas as contas Google Ads
        const googleAdsAccounts = await base44.asServiceRole.entities.GoogleAdsAccount.list('-created_date', 1000);

        let restauradas = 0;
        let erros = [];

        // Para cada cliente com responsável, atualizar a conta Google Ads correspondente
        for (const cliente of clientesComResponsavel) {
            try {
                const accountName = cliente.google_ads_account_name.trim().toLowerCase();
                const account = googleAdsAccounts.find(a => 
                    a.account_name && a.account_name.trim().toLowerCase() === accountName
                );

                if (account) {
                    await base44.asServiceRole.entities.GoogleAdsAccount.update(account.id, {
                        responsavel_voxx: cliente.responsavel_google_ads
                    });
                    restauradas++;
                } else {
                    erros.push(`Conta não encontrada para cliente: ${cliente.nome}`);
                }
            } catch (error) {
                erros.push(`Erro ao restaurar ${cliente.nome}: ${error.message}`);
            }
        }

        return Response.json({
            success: true,
            message: `Restauradas ${restauradas} atribuições de responsáveis`,
            restauradas,
            erros: erros.length > 0 ? erros : null
        });

    } catch (error) {
        console.error('Error restoring Google Ads responsaveis:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});