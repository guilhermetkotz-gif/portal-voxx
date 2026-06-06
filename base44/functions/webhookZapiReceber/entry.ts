import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Normaliza ID de grupo para múltiplos formatos
function normalizarGrupoId(id) {
  if (!id) return { raw: id, hyphen: id, atsign: id, numeric: id };
  const numeric = id.replace('@g.us', '').replace('-group', '').split('-')[0];
  return {
    raw: id,
    hyphen: `${numeric}-group`,
    atsign: `${numeric}@g.us`,
    numeric,
  };
}

// Detecta o tipo de mensagem e retorna conteúdo + tipo
function extrairConteudo(body) {
  if (body.text?.message) return { mensagem: body.text.message, tipo: 'texto' };
  if (body.text?.text) return { mensagem: body.text.text, tipo: 'texto' };
  if (typeof body.text === 'string' && body.text) return { mensagem: body.text, tipo: 'texto' };
  if (body.message?.text) return { mensagem: body.message.text, tipo: 'texto' };
  if (body.body && typeof body.body === 'string') return { mensagem: body.body, tipo: 'texto' };
  if (body.caption) return { mensagem: body.caption, tipo: 'texto' };
  if (body.audio) return { mensagem: '[Áudio]', tipo: 'audio' };
  if (body.image?.caption) return { mensagem: body.image.caption, tipo: 'imagem' };
  if (body.image) return { mensagem: '[Imagem]', tipo: 'imagem' };
  if (body.video?.caption) return { mensagem: body.video.caption, tipo: 'video' };
  if (body.video) return { mensagem: '[Vídeo]', tipo: 'video' };
  if (body.document?.fileName) return { mensagem: `[Documento: ${body.document.fileName}]`, tipo: 'documento' };
  if (body.document) return { mensagem: '[Documento]', tipo: 'documento' };
  if (body.sticker) return { mensagem: '[Sticker]', tipo: 'sticker' };
  if (body.mimetype) return { mensagem: `[Mídia: ${body.mimetype}]`, tipo: 'outro' };
  return { mensagem: '[Sem conteúdo textual]', tipo: 'sistema' };
}

Deno.serve(async (req) => {
  const receivedAt = new Date().toISOString();

  // Ler body bruto primeiro — NUNCA descartar antes de salvar
  let bodyRaw = '';
  let body = {};
  try {
    bodyRaw = await req.text();
    body = JSON.parse(bodyRaw);
  } catch (e) {
    body = {};
  }

  // Capturar headers relevantes
  const headersObj = {};
  for (const [k, v] of req.headers.entries()) {
    headersObj[k] = v;
  }

  const base44 = createClientFromRequest(req);

  // 1. SALVAR RAW IMEDIATAMENTE — antes de qualquer validação
  let rawId = null;
  try {
    const rawEntry = await base44.asServiceRole.entities.WhatsappWebhookRaw.create({
      raw_payload: bodyRaw.substring(0, 50000), // limitar tamanho
      headers: JSON.stringify(headersObj).substring(0, 2000),
      method: req.method,
      received_at: receivedAt,
      phone: body.phone || body.chatId || '',
      is_group: body.isGroup === true || String(body.phone || '').includes('-group') || String(body.phone || '').includes('@g.us'),
      participant_phone: body.participantPhone || body.participant || '',
      sender_name: body.senderName || body.pushName || '',
      chat_name: body.chatName || body.groupName || '',
      message_id: body.messageId || body.id || '',
      event_type: body.type || '',
      processed: false,
      processing_status: 'pendente',
    });
    rawId = rawEntry.id;
    console.log('[webhookZapiReceber] ✅ Raw salvo:', rawId);
  } catch (rawErr) {
    console.error('[webhookZapiReceber] ❌ Erro ao salvar raw:', rawErr.message);
    // Continuar mesmo se falhar ao salvar raw
  }

  // 2. Validar método
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // 3. Extrair campos do payload
    const isGroup = body.isGroup === true || String(body.phone || '').includes('-group') || String(body.phone || '').includes('@g.us') || String(body.chatId || '').includes('@g.us');
    const grupoIdRaw = body.phone || body.chatId || '';
    const ids = normalizarGrupoId(grupoIdRaw);
    const candidatos = [ids.raw, ids.hyphen, ids.atsign, ids.numeric].filter(Boolean);

    const participantPhone = body.participantPhone || body.participant || '';
    const senderName = body.senderName || body.pushName || 'Desconhecido';
    const chatName = body.chatName || body.groupName || '';
    const isFromMe = body.fromMe === true;
    const messageId = body.messageId || body.id || '';

    const { mensagem, tipo } = extrairConteudo(body);
    const timestamp = body.momment ? new Date(body.momment * 1000).toISOString() : receivedAt;

    // 4. Idempotência — verificar se message_id já existe
    if (messageId) {
      const existing = await base44.asServiceRole.entities.WhatsappMensagem.filter({ message_id: messageId });
      if (existing.length > 0) {
        console.log('[webhookZapiReceber] Mensagem já existe, ignorando duplicata:', messageId);
        if (rawId) {
          await base44.asServiceRole.entities.WhatsappWebhookRaw.update(rawId, {
            processed: true,
            processing_status: 'ignorado',
            processing_error: 'Duplicata: message_id já existe',
          });
        }
        return Response.json({ ok: true, duplicate: true, messageId });
      }
    }

    // 5. Buscar cliente vinculado ao grupo
    let clienteId = null;
    let clienteNome = null;
    let grupoNome = chatName || '';
    let grupoIdFinal = grupoIdRaw;
    let grupoRecord = null;

    for (const candidato of candidatos) {
      if (!candidato) continue;
      const grupos = await base44.asServiceRole.entities.WhatsappGrupo.filter({ grupo_id: candidato });
      if (grupos.length > 0) {
        grupoRecord = grupos[0];
        clienteId = grupos[0].cliente_id || null;
        clienteNome = grupos[0].cliente_nome || null;
        grupoNome = grupos[0].nome_grupo || chatName;
        grupoIdFinal = candidato;
        break;
      }
    }

    // Fallback: buscar pelo cliente diretamente
    if (!grupoRecord) {
      for (const candidato of candidatos) {
        if (!candidato) continue;
        const clientes = await base44.asServiceRole.entities.Cliente.filter({ whatsapp_grupo_id: candidato });
        if (clientes.length > 0) {
          clienteId = clientes[0].id;
          clienteNome = clientes[0].nome;
          grupoNome = clientes[0].whatsapp_grupo_nome || chatName || candidato;
          grupoIdFinal = candidato;
          break;
        }
      }
    }

    // 6. Criar ou atualizar WhatsappGrupo
    if (isGroup && grupoIdRaw) {
      const grupoIdParaUsar = ids.hyphen; // padronizar para -group
      if (!grupoRecord) {
        // Criar grupo automaticamente
        try {
          await base44.asServiceRole.entities.WhatsappGrupo.create({
            grupo_id: grupoIdParaUsar,
            nome_grupo: chatName || grupoIdParaUsar,
            ultima_mensagem: mensagem,
            ultima_atividade: receivedAt,
            cliente_id: clienteId || null,
            cliente_nome: clienteNome || null,
            status_vinculo: clienteId ? 'vinculado' : 'nao_vinculado',
            origem: 'webhook',
          });
          console.log('[webhookZapiReceber] ✅ Novo grupo criado:', grupoIdParaUsar);
        } catch (grupoErr) {
          console.error('[webhookZapiReceber] ⚠️ Erro ao criar grupo:', grupoErr.message);
        }
      } else {
        // Atualizar última atividade do grupo
        try {
          await base44.asServiceRole.entities.WhatsappGrupo.update(grupoRecord.id, {
            ultima_mensagem: mensagem,
            ultima_atividade: receivedAt,
          });
        } catch (updateErr) {
          console.error('[webhookZapiReceber] ⚠️ Erro ao atualizar grupo:', updateErr.message);
        }
      }
    }

    // 7. Salvar WhatsappMensagem
    const remetenteTipo = isFromMe ? 'voxx' : 'cliente';
    const origem = isFromMe ? 'enviada' : 'recebida';

    await base44.asServiceRole.entities.WhatsappMensagem.create({
      message_id: messageId || null,
      cliente_id: clienteId || null,
      cliente_nome: clienteNome || chatName || null,
      grupo_id: grupoIdFinal || null,
      grupo_nome: grupoNome || chatName || null,
      is_group: isGroup,
      remetente_telefone: participantPhone || null,
      remetente_nome: senderName,
      remetente_tipo: remetenteTipo,
      origem,
      mensagem,
      tipo_mensagem: tipo,
      timestamp_mensagem: timestamp,
      received_at: receivedAt,
      from_me: isFromMe,
      raw_id: rawId || null,
    });

    console.log('[webhookZapiReceber] ✅ WhatsappMensagem criada:', {
      cliente: clienteNome || 'sem vínculo',
      grupo: grupoNome,
      mensagem: mensagem.substring(0, 80),
      remetente: senderName,
    });

    // 8. Atualizar raw como processado
    if (rawId) {
      await base44.asServiceRole.entities.WhatsappWebhookRaw.update(rawId, {
        processed: true,
        processing_status: 'processado',
        cliente_id: clienteId || null,
        cliente_nome: clienteNome || null,
        grupo_id: grupoIdFinal || null,
        grupo_nome: grupoNome || null,
      });
    }

    // NOTA: leitura automática desativada temporariamente para não interferir no fluxo

    return Response.json({ ok: true, saved: true, clienteId, clienteNome, rawId });

  } catch (error) {
    console.error('[webhookZapiReceber] ❌ Erro:', error.message);
    if (rawId) {
      try {
        await base44.asServiceRole.entities.WhatsappWebhookRaw.update(rawId, {
          processed: true,
          processing_status: 'erro',
          processing_error: error.message,
        });
      } catch (_) {}
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});