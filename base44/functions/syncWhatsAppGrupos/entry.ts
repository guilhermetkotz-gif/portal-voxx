import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function getZapiCredentials(base44) {
  const configs = await base44.asServiceRole.entities.ConfiguracaoZapi.list('-created_date', 1);
  if (configs?.[0]) {
    return {
      instanceId: configs[0].instance_id,
      token: configs[0].token_instancia,
      clientToken: configs[0].token_global
    };
  }
  return {
    instanceId: Deno.env.get('ZAPI_INSTANCE_ID'),
    token: Deno.env.get('ZAPI_TOKEN'),
    clientToken: Deno.env.get('ZAPI_CLIENT_TOKEN')
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow cron calls (no user) or admin calls
    let isAuthorized = false;
    try {
      const user = await base44.auth.me();
      isAuthorized = user?.role === 'admin';
    } catch {
      // Called from automation (no user session) — allowed
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const creds = await getZapiCredentials(base44);
    if (!creds.instanceId || !creds.token) {
      return Response.json({ error: 'Credenciais Z-API não configuradas' }, { status: 400 });
    }

    const baseUrl = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(creds.clientToken ? { 'Client-Token': creds.clientToken } : {})
    };

    // 1. Check connection status
    const statusRes = await fetch(`${baseUrl}/status`, { headers });
    const statusData = await statusRes.json();

    if (statusData?.connected !== true && statusData?.status !== 'Connected') {
      console.log('[syncWhatsAppGrupos] Z-API desconectada, abortando sync');
      return Response.json({ ok: false, reason: 'Z-API desconectada', status: statusData });
    }

    // 2. Fetch all chats/groups from Z-API
    const chatsRes = await fetch(`${baseUrl}/chats`, { headers });
    const chatsData = await chatsRes.json();

    const grupos = Array.isArray(chatsData) 
      ? chatsData.filter(c => c.isGroup || c.id?.endsWith('@g.us'))
      : [];

    if (grupos.length === 0) {
      return Response.json({ ok: true, synced: 0, message: 'Nenhum grupo encontrado' });
    }

    // 3. Load existing groups from DB (normalizando IDs para evitar duplicatas)
    const existentes = await base44.asServiceRole.entities.WhatsappGrupo.list('-created_date', 500);
    const existentesMap = {};
    const existentesPorIdNormalizado = {};
    for (const g of existentes) {
      existentesMap[g.grupo_id] = g;
      // Também indexa por ID normalizado para fallback
      if (g.grupo_id) {
        const normalizado = normalizarGrupoId(g.grupo_id);
        if (normalizado && normalizado !== g.grupo_id) {
          existentesPorIdNormalizado[normalizado] = g;
        }
      }
    }

    let criados = 0;
    let atualizados = 0;

    // Normaliza ID do grupo (mantém consistência com webhookZapiReceber)
    function normalizarGrupoId(id) {
      if (!id) return id;
      const numeric = id.replace(/@g\.us$/, '').replace(/-group$/, '').split('-')[0];
      return `${numeric}-group`;
    }

    for (const grupo of grupos) {
      const grupoIdRaw = grupo.id || grupo.phone;
      if (!grupoIdRaw) continue;
      const grupoId = normalizarGrupoId(grupoIdRaw);

      const nomeGrupo = grupo.name || grupo.subject || grupo.id || grupoId;
      const ultimaAtividade = grupo.timestamp 
        ? new Date(grupo.timestamp * 1000).toISOString() 
        : new Date().toISOString();
      const ultimaMensagem = grupo.lastMessage?.text || grupo.lastMessageText || '';

      const grupoExistente = existentesMap[grupoId] || existentesMap[grupoIdRaw] || existentesPorIdNormalizado[grupoId];
      if (grupoExistente) {
        // Update existing
        await base44.asServiceRole.entities.WhatsappGrupo.update(grupoExistente.id, {
          nome_grupo: nomeGrupo,
          ultima_atividade: ultimaAtividade,
          ultima_mensagem: ultimaMensagem
        });
        atualizados++;
      } else {
        // Create new
        await base44.asServiceRole.entities.WhatsappGrupo.create({
          grupo_id: grupoId,
          nome_grupo: nomeGrupo,
          ultima_atividade: ultimaAtividade,
          ultima_mensagem: ultimaMensagem,
          status_vinculo: 'nao_vinculado',
          origem: 'webhook'
        });
        criados++;
      }
    }

    console.log(`[syncWhatsAppGrupos] Sync concluído: ${criados} criados, ${atualizados} atualizados`);
    return Response.json({ 
      ok: true, 
      total_grupos: grupos.length, 
      criados, 
      atualizados,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[syncWhatsAppGrupos] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});