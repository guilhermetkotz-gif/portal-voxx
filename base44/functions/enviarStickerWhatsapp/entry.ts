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
    const { chatId, stickerUrl } = body;

    if (!chatId || !stickerUrl) {
      return Response.json({ error: 'chatId e stickerUrl são obrigatórios' }, { status: 400 });
    }

    const { zapiInstanceId, zapiToken, zapiClientToken } = await getZapiCredentials(base44);
    if (!zapiInstanceId) {
      return Response.json({ error: 'Z-API não configurada' }, { status: 503 });
    }

    const resp = await fetch(
      `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/send-sticker`,
      {
        method: 'POST',
        headers: {
          'Client-Token': zapiClientToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: chatId,
          stickerUrl,
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return Response.json({ success: false, erro: `Z-API HTTP ${resp.status}: ${errText}` }, { status: 502 });
    }

    const resultadoApi = await resp.json().catch(() => ({}));

    // Registrar envio
    try {
      await base44.entities.WhatsappMensagem.create({
        grupo_id: chatId,
        is_group: chatId.includes('@g.us') || chatId.includes('group'),
        remetente_nome: user.full_name || 'VOXX',
        remetente_tipo: 'voxx',
        origem: 'enviada',
        tipo_mensagem: 'sticker',
        mensagem: '[Sticker]',
        midia_url: stickerUrl,
        from_me: true,
        timestamp_mensagem: new Date().toISOString(),
        received_at: new Date().toISOString(),
        status_processamento: 'ok',
      });
    } catch (_) {
      // non-critical
    }

    return Response.json({ success: true, resultado_api: resultadoApi });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});