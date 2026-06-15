import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ZAPI_BASE = 'https://api.z-api.io';

async function getZapiCredentials(base44) {
  const configs = await base44.asServiceRole.entities.ConfiguracaoZapi.list('-created_date', 1).catch(() => []);
  const entityConfig = configs?.[0];
  return {
    zapiInstanceId: entityConfig?.instance_id || Deno.env.get('ZAPI_INSTANCE_ID'),
    zapiToken: entityConfig?.token_instancia || Deno.env.get('ZAPI_TOKEN'),
    zapiClientToken: entityConfig?.token_global || Deno.env.get('ZAPI_CLIENT_TOKEN'),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { chatId, messageId, reaction } = body;

    if (!chatId || !messageId || !reaction) {
      return Response.json({ error: 'chatId, messageId e reaction são obrigatórios' }, { status: 400 });
    }

    const { zapiInstanceId, zapiToken, zapiClientToken } = await getZapiCredentials(base44);
    if (!zapiInstanceId) {
      return Response.json({ error: 'Z-API não configurada' }, { status: 503 });
    }

    const resp = await fetch(
      `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/send-reaction`,
      {
        method: 'POST',
        headers: {
          'Client-Token': zapiClientToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: chatId,
          reactionMessageId: messageId,
          reaction,
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return Response.json({ success: false, erro: `Z-API HTTP ${resp.status}: ${errText}` }, { status: 502 });
    }

    const resultadoApi = await resp.json().catch(() => ({}));

    return Response.json({ success: true, resultado_api: resultadoApi });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});