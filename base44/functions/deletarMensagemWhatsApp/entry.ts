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
    const { messageId, chatId, modo } = body; // modo: 'todos' | 'para_mim'

    if (!messageId || !chatId) {
      return Response.json({ error: 'messageId e chatId são obrigatórios' }, { status: 400 });
    }

    // Buscar mensagem no banco
    const mensagens = await base44.asServiceRole.entities.WhatsappMensagem.filter({ message_id: messageId });
    const msgRecord = mensagens?.[0];
    if (!msgRecord) {
      return Response.json({ error: 'Mensagem não encontrada' }, { status: 404 });
    }

    const agora = new Date().toISOString();

    // Excluir para todos: chamar Z-API + marcar como deletado
    if (modo !== 'para_mim') {
      const { zapiInstanceId, zapiToken, zapiClientToken } = await getZapiCredentials(base44);
      if (!zapiInstanceId) {
        return Response.json({ error: 'Z-API não configurada' }, { status: 503 });
      }

      const resp = await fetch(
        `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/delete-message`,
        {
          method: 'POST',
          headers: {
            'Client-Token': zapiClientToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ phone: chatId, messageId }),
        }
      );

      if (!resp.ok) {
        const erro = await resp.text().catch(() => '');
        return Response.json({ error: `Z-API HTTP ${resp.status}: ${erro}` }, { status: 502 });
      }
    }

    // Marcar como deletado no banco
    await base44.asServiceRole.entities.WhatsappMensagem.update(msgRecord.id, {
      deletado: true,
      deletado_por: user.email,
      deletado_em: agora,
    });

    return Response.json({
      success: true,
      modo: modo === 'para_mim' ? 'para_mim' : 'todos',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});