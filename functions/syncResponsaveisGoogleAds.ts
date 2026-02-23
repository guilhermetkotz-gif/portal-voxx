import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Buscar todas as contas Google Ads
    const googleAdsAccounts = await base44.asServiceRole.entities.GoogleAdsAccount.list();
    
    // Buscar todos os clientes
    const clientes = await base44.asServiceRole.entities.Cliente.list();

    let sincronizados = 0;
    let erros = 0;

    // Para cada conta Google Ads com responsavel_voxx preenchido
    for (const gAccount of googleAdsAccounts) {
      if (!gAccount.responsavel_voxx) continue;

      // Encontrar o cliente correspondente
      const cliente = clientes.find(c => 
        c.google_ads_account_name?.trim().toLowerCase() === gAccount.account_name?.trim().toLowerCase()
      );

      if (cliente && !cliente.responsavel_google_ads) {
        try {
          await base44.asServiceRole.entities.Cliente.update(cliente.id, {
            responsavel_google_ads: gAccount.responsavel_voxx
          });
          sincronizados++;
          console.log(`✓ Sincronizado: ${cliente.nome} → ${gAccount.responsavel_voxx}`);
        } catch (error) {
          erros++;
          console.error(`✗ Erro ao sincronizar ${cliente.nome}:`, error.message);
        }
      }
    }

    return Response.json({
      success: true,
      message: `Sincronização concluída: ${sincronizados} clientes atualizados, ${erros} erros`,
      sincronizados,
      erros
    });
  } catch (error) {
    console.error('Erro na sincronização:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});