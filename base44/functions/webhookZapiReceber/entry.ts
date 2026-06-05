import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    console.log('[webhookZapiReceber] Requisição recebida:', { method: req.method });
    
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const body = await req.json().catch((e) => {
      console.error('[webhookZapiReceber] Erro ao fazer parse JSON:', e.message);
      return {};
    });

    if (!body.phone && !body.instanceId && !body.zaapId) {
      console.log('[webhookZapiReceber] Payload inválido:', JSON.stringify(body));
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Ignorar apenas notificações de sistema vazias (ex: participante entrou/saiu sem conteúdo)
    if (body.type === 'ReceivedCallback' && !body.text && !body.image && !body.video && !body.audio && !body.document) {
      return Response.json({ ok: true, ignored: 'no_content' });
    }

    // Nova estrutura Z-API para grupos:
    // - isGroup: true indica que é grupo
    // - phone: ID do grupo (ex: "120363019502650977-group")
    // - participantPhone: número de quem enviou (ex: "5544999999999")
    // - senderName: nome do participante
    // - chatName: nome do grupo
    const isGroup = body.isGroup === true || body.phone?.includes('-group') || body.phone?.includes('@g.us');
    
    if (!isGroup) {
      return Response.json({ ok: true, ignored: 'not_group' });
    }

    const grupoIdRaw = body.phone || body.chatId || '';
    if (!grupoIdRaw) {
      console.log('[webhookZapiReceber] Grupo sem ID:', JSON.stringify(body));
      return Response.json({ ok: true, ignored: 'no_group_id' });
    }

    // Extrair a parte numérica base (sem @g.us, sem -group, sem timestamp)
    const numericBase = grupoIdRaw.replace('@g.us', '').replace('-group', '').split('-')[0];

    // Candidatos de ID para tentar o match no banco
    const candidatos = [
      grupoIdRaw,
      `${numericBase}-group`,
      `${numericBase}@g.us`,
    ];

    // Capturar informações do participante (quem enviou a mensagem no grupo)
    const participantPhone = body.participantPhone || body.participant || '';
    const senderName = body.senderName || body.pushName || 'Desconhecido';
    const chatName = body.chatName || body.groupName || '';

    console.log('[webhookZapiReceber] Mensagem de grupo recebida:', JSON.stringify({
      isGroup: true,
      grupoIdRaw,
      numericBase,
      candidatos,
      participantPhone,
      senderName,
      chatName,
      text: body.text?.message || body.text,
      timestamp: body.momment,
      fromMe: body.fromMe,
    }));

    // Buscar o cliente vinculado a esse grupo tentando todos os formatos
    let clienteId = null;
    let clienteNome = null;
    let grupoNome = null;
    let grupoIdFinal = grupoIdRaw;

    for (const candidato of candidatos) {
      const grupos = await base44.asServiceRole.entities.WhatsappGrupo.filter({ grupo_id: candidato });
      if (grupos.length > 0) {
        clienteId = grupos[0].cliente_id;
        clienteNome = grupos[0].cliente_nome;
        grupoNome = grupos[0].nome_grupo;
        grupoIdFinal = candidato;
        break;
      }
    }

    // Se não achou no WhatsappGrupo, tentar pelo campo whatsapp_grupo_id no Cliente
    if (!clienteId) {
      for (const candidato of candidatos) {
        const clientes = await base44.asServiceRole.entities.Cliente.filter({ whatsapp_grupo_id: candidato });
        if (clientes.length > 0) {
          clienteId = clientes[0].id;
          clienteNome = clientes[0].nome;
          grupoNome = clientes[0].whatsapp_grupo_nome || candidato;
          grupoIdFinal = candidato;
          break;
        }
      }
    }

    if (!clienteId) {
      console.log('[webhookZapiReceber] Grupo não vinculado a cliente:', grupoIdRaw, '| candidatos:', candidatos);
      return Response.json({ ok: true, ignored: 'no_client_linked', grupoIdRaw, candidatos });
    }

    // Extrair conteúdo da mensagem
    let conteudo = '[Mensagem]';
    if (body.text?.message) conteudo = body.text.message;
    else if (body.image?.caption) conteudo = body.image.caption;
    else if (body.video?.caption) conteudo = body.video.caption;
    else if (body.document?.fileName) conteudo = body.document.fileName;
    else if (body.audio) conteudo = '[Áudio]';
    else if (body.sticker) conteudo = '[Sticker]';

    const tipoEnvio = body.image ? 'imagem' : 'texto';
    const timestamp = body.momment
      ? new Date(body.momment * 1000).toISOString()
      : new Date().toISOString();
    
    // Detectar se é mensagem da VOXX (fromMe=true) ou do cliente/outros
    const isFromMe = body.fromMe === true;
    const remetenteTipo = isFromMe ? 'voxx' : 'cliente';
    
    // Usar nome do grupo do chatName se disponível, senão usar do banco
    const grupoNomeFinal = chatName || grupoNome || 'Grupo WhatsApp';

    await base44.asServiceRole.entities.WhatsappEnvioLog.create({
      cliente_id: clienteId,
      cliente_nome: clienteNome,
      grupo_id: grupoIdFinal,
      grupo_nome: grupoNomeFinal,
      tipo_envio: tipoEnvio,
      origem: 'recebida',
      mensagem: conteudo,
      status_envio: 'enviado',
      remetente_nome: senderName,
      remetente_tipo: remetenteTipo,
      enviado_em: timestamp,
      enviado_por: isFromMe ? 'voxx_bot' : senderName,
      // Campos adicionais para rastreabilidade
      midia_url: body.image?.url || body.video?.url || body.document?.url || null,
      retorno_zapi: JSON.stringify({
        participantPhone,
        chatName,
        fromMe: isFromMe,
        type: body.type,
      }),
    });

    console.log('[webhookZapiReceber] Mensagem salva:', {
      cliente: clienteNome,
      grupo: grupoNomeFinal,
      participante: senderName,
      participantPhone,
      fromMe: isFromMe,
      tipo: remetenteTipo,
      conteudo: conteudo.substring(0, 50)
    });

    console.log('[webhookZapiReceber] Mensagem salva:', {
      cliente: clienteNome,
      remetente: remetenteNome,
      fromMe: isFromMe,
      tipo: remetenteTipo,
      conteudo: conteudo.substring(0, 50)
    });

    console.log('[webhookZapiReceber] Mensagem salva para cliente:', clienteNome);
    return Response.json({ ok: true, saved: true, clienteId, clienteNome });

  } catch (error) {
    console.error('[webhookZapiReceber] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});