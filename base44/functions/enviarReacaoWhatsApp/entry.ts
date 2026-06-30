import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ZAPI_BASE = 'https://api.z-api.io';

function isZapiError(resultado) {
  if (!resultado) return null;
  if (resultado.error) return `Z-API: ${resultado.error}${resultado.message ? ' - ' + resultado.message : ''}`;
  return null;
}

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

    const resultadoApi = await resp.json().catch(() => null);
    const apiError = isZapiError(resultadoApi);
    if (!resp.ok || apiError) {
      const erro = apiError || `Z-API HTTP ${resp.status}: ${JSON.stringify(resultadoApi).substring(0, 200)}`;
      return Response.json({ success: false, erro }, { status: 502 });
    }

    // Persistir a reação na mensagem alvo para exibição imediata no Radar
    try {
      const targetMsgs = await base44.asServiceRole.entities.WhatsappMensagem.filter({ message_id: messageId });
      if (targetMsgs.length > 0) {
        const target = targetMsgs[0];
        const reacoesAtuais = target.reacoes || [];
        // Toggle: remove reação anterior do mesmo usuário, adiciona a nova
        const reacoesFiltradas = reacoesAtuais.filter(r => r.remetente !== user.email && r.remetente_telefone !== user.email);
        reacoesFiltradas.push({
          emoji: reaction,
          remetente: user.full_name || user.email || 'Voxx',
          remetente_telefone: null,
          data: new Date().toISOString(),
        });
        await base44.asServiceRole.entities.WhatsappMensagem.update(target.id, { reacoes: reacoesFiltradas });
        console.log('[enviarReacao] ✅ Reação persistida na mensagem:', target.id);
      }
    } catch (persistErr) {
      console.error('[enviarReacao] ⚠️ Erro ao persistir reação:', persistErr.message);
    }

    return Response.json({ success: true, resultado_api: resultadoApi });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});