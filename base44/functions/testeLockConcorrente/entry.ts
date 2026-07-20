import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const sdk = createClientFromRequest(req);
    
    const { test_id, owner_id, label } = body;
    
    if (!test_id || !owner_id) {
      return Response.json({ error: 'test_id and owner_id required' }, { status: 400 });
    }
    
    const start = Date.now();
    
    try {
      const created = await sdk.asServiceRole.entities.WhatsappMensagem.create({
        id: test_id,
        received_at: new Date().toISOString(),
        message_id: test_id,
        mensagem: 'CONCURRENT_BACKEND_' + label,
        origem: 'sistema',
        remetente_nome: owner_id,
      });
      
      const duration = Date.now() - start;
      return Response.json({
        success: true,
        label,
        owner_id,
        returned_id: created.id,
        id_matches: created.id === test_id,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      const duration = Date.now() - start;
      return Response.json({
        success: false,
        label,
        owner_id,
        error: e.message,
        status: e.status || e.statusCode,
        errorType: e.constructor?.name,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});