import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    // Z-API sends POST with message payload — no user auth required for webhooks
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const body = await req.json().catch(() => ({}));

    // Basic validation: Z-API payloads always contain a phone or instanceId
    if (!body.phone && !body.instanceId && !body.zaapId) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Log the received message for debugging
    console.log('[webhookZapiReceber] Mensagem recebida:', JSON.stringify({
      phone: body.phone,
      fromMe: body.fromMe,
      type: body.type,
      instanceId: body.instanceId,
      timestamp: new Date().toISOString()
    }));

    // Ignore messages sent by the bot itself
    if (body.fromMe === true) {
      return Response.json({ ok: true, ignored: 'fromMe' });
    }

    // Optionally: you can save received messages to an entity here
    // await base44.asServiceRole.entities.WhatsappMensagemRecebida.create({...body})

    return Response.json({ ok: true, received: true });
  } catch (error) {
    console.error('[webhookZapiReceber] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});