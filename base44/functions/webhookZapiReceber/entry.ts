import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const body = await req.json().catch(() => ({}));

    if (!body.phone && !body.instanceId && !body.zaapId) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Ignorar mensagens enviadas pelo próprio bot
    if (body.fromMe === true) {
      return Response.json({ ok: true, ignored: 'fromMe' });
    }

    // Ignorar notificações de sistema (ex: participante entrou/saiu)
    if (body.type === 'ReceivedCallback' && !body.text && !body.image && !body.video && !body.audio && !body.document) {
      return Response.json({ ok: true, ignored: 'no_content' });
    }

    const grupoId = body.phone || body.chatId;
    if (!grupoId || !grupoId.includes('-')) {
      // Não é grupo (grupos têm o formato XXXXXXXXXXX-XXXXXXXXXX@g.us ou número-timestamp)
      return Response.json({ ok: true, ignored: 'not_group' });
    }

    console.log('[webhookZapiReceber] Mensagem de grupo recebida:', JSON.stringify({
      grupoId,
      fromMe: body.fromMe,
      type: body.type,
      senderName: body.senderName || body.pushName,
    }));

    // Buscar o cliente vinculado a esse grupo
    const grupos = await base44.asServiceRole.entities.WhatsappGrupo.filter({ grupo_id: grupoId });
    let clienteId = null;
    let clienteNome = null;
    let grupoNome = null;

    if (grupos.length > 0) {
      const grupo = grupos[0];
      clienteId = grupo.cliente_id;
      clienteNome = grupo.cliente_nome;
      grupoNome = grupo.nome_grupo;
    } else {
      // Tentar buscar pelo campo whatsapp_grupo_id no Cliente
      const clientes = await base44.asServiceRole.entities.Cliente.filter({ whatsapp_grupo_id: grupoId });
      if (clientes.length > 0) {
        clienteId = clientes[0].id;
        clienteNome = clientes[0].nome;
        grupoNome = clientes[0].whatsapp_grupo_nome || grupoId;
      }
    }

    if (!clienteId) {
      console.log('[webhookZapiReceber] Grupo não vinculado a cliente:', grupoId);
      return Response.json({ ok: true, ignored: 'no_client_linked', grupoId });
    }

    // Extrair conteúdo da mensagem
    const conteudo =
      body.text?.message ||
      body.image?.caption ||
      body.video?.caption ||
      body.document?.fileName ||
      body.audio ? '[Áudio]' : null ||
      body.sticker ? '[Sticker]' : null ||
      '[Mensagem]';

    const tipoEnvio = body.image ? 'imagem' : 'texto';
    const remetenteNome = body.senderName || body.pushName || 'Desconhecido';
    const timestamp = body.momment
      ? new Date(body.momment * 1000).toISOString()
      : new Date().toISOString();

    await base44.asServiceRole.entities.WhatsappEnvioLog.create({
      cliente_id: clienteId,
      cliente_nome: clienteNome,
      grupo_id: grupoId,
      grupo_nome: grupoNome,
      tipo_envio: tipoEnvio,
      origem: 'recebida',
      mensagem: conteudo,
      status_envio: 'enviado',
      remetente_nome: remetenteNome,
      enviado_em: timestamp,
    });

    console.log('[webhookZapiReceber] Mensagem salva para cliente:', clienteNome);
    return Response.json({ ok: true, saved: true, clienteId, clienteNome });

  } catch (error) {
    console.error('[webhookZapiReceber] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});