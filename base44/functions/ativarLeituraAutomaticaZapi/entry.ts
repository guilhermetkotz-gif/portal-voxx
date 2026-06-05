import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar configuração Z-API
    const config = await base44.asServiceRole.entities.ConfiguracaoZapi.list();
    const instanceConfig = config[0];
    
    if (!instanceConfig?.instance_id || !instanceConfig?.token_instancia) {
      return Response.json({ error: 'Configuração Z-API não encontrada' }, { status: 400 });
    }

    // Ativar leitura automática na Z-API
    const response = await fetch(`https://api.z-api.io/instances/${instanceConfig.instance_id}/token/${instanceConfig.token_instancia}/update-auto-read-message`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': instanceConfig.token_global || instanceConfig.token_instancia,
      },
      body: JSON.stringify({ value: true }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return Response.json({ 
        error: 'Erro ao ativar leitura automática', 
        details: errorData 
      }, { status: response.status });
    }

    console.log('[ativarLeituraAutomaticaZapi] ✅ Leitura automática ativada com sucesso');

    return Response.json({ 
      success: true, 
      message: 'Leitura automática ativada com sucesso',
      instance_id: instanceConfig.instance_id
    });

  } catch (error) {
    console.error('[ativarLeituraAutomaticaZapi] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});