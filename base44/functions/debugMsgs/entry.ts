import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (_req) => {
  try {
    const base44 = createClientFromRequest(_req);
    const sdk = base44.asServiceRole;

    const msgs = await sdk.entities.WhatsappMensagem.list('-received_at', 5);
    
    const sample = msgs.length > 0 ? {
      length: msgs.length,
      keys: Object.keys(msgs[0]),
      remetente_tipo: msgs[0].remetente_tipo,
      remetente_telefone: msgs[0].remetente_telefone,
      has_data: !!msgs[0].data,
      data_keys: msgs[0].data ? Object.keys(msgs[0].data).slice(0, 5) : null,
    } : { length: 0 };

    return Response.json({ sample, total_msgs: msgs.length });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});