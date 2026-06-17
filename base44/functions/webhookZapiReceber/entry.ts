import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Normaliza ID de grupo para todos os formatos ───────────────────────────
function normalizarGrupoId(id) {
  if (!id) return { raw: id, hyphen: id, atsign: id, numeric: id };
  // Remove sufixos conhecidos e pega só a parte numérica
  const numeric = id.replace(/@g\.us$/, '').replace(/-group$/, '').split('-')[0];
  return {
    raw: id,
    hyphen: `${numeric}-group`,
    atsign: `${numeric}@g.us`,
    numeric,
  };
}

// ─── Extrai conteúdo textual e tipo da mensagem ──────────────────────────────
// ─── Extrai URL da mídia do payload ──────────────────────────────
function extrairMidiaUrl(body) {
  // Nível raiz (formato legacy e ReceivedCallback direto)
  if (body.image?.imageUrl) return { midia_url: body.image.imageUrl, midia_mimetype: body.image.mimeType || 'image/jpeg' };
  if (body.audio?.audioUrl) return { midia_url: body.audio.audioUrl, midia_mimetype: body.audio.mimeType || 'audio/ogg' };
  if (body.video?.videoUrl) return { midia_url: body.video.videoUrl, midia_mimetype: body.video.mimeType || 'video/mp4' };
  if (body.document?.documentUrl) return { midia_url: body.document.documentUrl, midia_mimetype: body.document.mimeType || null, midia_nome: body.document.fileName || null };
  // Sticker / figurinha
  if (body.sticker) {
    const stickerUrl = typeof body.sticker === 'string' ? body.sticker : (body.sticker.stickerUrl || body.sticker.url || null);
    if (stickerUrl) return { midia_url: stickerUrl, midia_mimetype: body.sticker.mimeType || 'image/webp' };
  }
  // Nível aninhado body.message.* (formato alternativo usado em conversas diretas)
  if (body.message?.image?.imageUrl) return { midia_url: body.message.image.imageUrl, midia_mimetype: body.message.image.mimeType || 'image/jpeg' };
  if (body.message?.audio?.audioUrl) return { midia_url: body.message.audio.audioUrl, midia_mimetype: body.message.audio.mimeType || 'audio/ogg' };
  if (body.message?.video?.videoUrl) return { midia_url: body.message.video.videoUrl, midia_mimetype: body.message.video.mimeType || 'video/mp4' };
  if (body.message?.document?.documentUrl) return { midia_url: body.message.document.documentUrl, midia_mimetype: body.message.document.mimeType || null, midia_nome: body.message.document.fileName || null };
  if (body.message?.sticker) {
    const s = body.message.sticker;
    const stickerUrl = typeof s === 'string' ? s : (s.stickerUrl || s.url || null);
    if (stickerUrl) return { midia_url: stickerUrl, midia_mimetype: s.mimeType || 'image/webp' };
  }
  return null;
}

function extrairConteudo(body) {
  // Reação (reaction) — múltiplos formatos Z-API
  // Z-API moderno: type="ReceivedCallback" com body.reaction = { value: "👍", referencedMessage: { messageId: "..." } }
  // Z-API legado: type="ReactionMessage" com body.reaction.text ou body.reactionMessage
  const reactionTypes = ['ReactionMessage', 'MessageReaction', 'reaction', 'messageReaction', 'reaction_message'];
  const hasReactionObj = body.reaction && typeof body.reaction === 'object' && !Array.isArray(body.reaction);
  
  if (reactionTypes.includes(body.type) || hasReactionObj || body.reactionMessage || body.messageReaction) {
    // Tentar extrair emoji de várias fontes
    let emoji = '';
    if (typeof body.reaction === 'string') emoji = body.reaction;
    else if (body.reaction?.value) emoji = body.reaction.value;  // formato moderno Z-API
    else if (body.reaction?.text) emoji = body.reaction.text;
    else if (body.reaction?.emoji) emoji = body.reaction.emoji;
    else if (body.reactionMessage?.text) emoji = body.reactionMessage.text;
    else if (body.reactionMessage?.emoji) emoji = body.reactionMessage.emoji;
    else if (body.messageReaction?.text) emoji = body.messageReaction.text;
    else if (body.message?.reaction) emoji = body.message.reaction;
    
    // Tentar extrair targetMsgId de várias fontes
    let targetMsgId = '';
    if (body.reaction?.referencedMessage?.messageId) targetMsgId = body.reaction.referencedMessage.messageId; // formato moderno Z-API
    else if (body.reactionMessage?.key?.id) targetMsgId = body.reactionMessage.key.id;
    else if (body.msgId) targetMsgId = body.msgId;
    else if (body.reactedMessageId) targetMsgId = body.reactedMessageId;
    else if (body.messageId) targetMsgId = body.messageId;
    else if (body.reactionMessage?.id) targetMsgId = body.reactionMessage.id;
    else if (body.message?.id) targetMsgId = body.message.id;
    else if (body.reactedMessage?.id) targetMsgId = body.reactedMessage.id;
    
    if (emoji || targetMsgId) {
      return { mensagem: emoji, tipo: 'reacao', dadosReacao: { emoji, targetMsgId } };
    }
  }
  // Texto
  if (body.text?.message) return { mensagem: body.text.message, tipo: 'texto' };
  if (body.text?.text)    return { mensagem: body.text.text, tipo: 'texto' };
  if (typeof body.text === 'string' && body.text) return { mensagem: body.text, tipo: 'texto' };
  if (body.message?.text) return { mensagem: body.message.text, tipo: 'texto' };
  if (body.body && typeof body.body === 'string') return { mensagem: body.body, tipo: 'texto' };
  if (body.caption) return { mensagem: body.caption, tipo: 'texto' };
  // Mídia (nível raiz)
  if (body.audio)   return { mensagem: '[Áudio]', tipo: 'audio' };
  if (body.image?.caption) return { mensagem: body.image.caption, tipo: 'imagem' };
  if (body.image)   return { mensagem: '[Imagem]', tipo: 'imagem' };
  if (body.video?.caption) return { mensagem: body.video.caption, tipo: 'video' };
  if (body.video)   return { mensagem: '[Vídeo]', tipo: 'video' };
  if (body.document?.fileName) return { mensagem: `[Documento: ${body.document.fileName}]`, tipo: 'documento' };
  if (body.document) return { mensagem: '[Documento]', tipo: 'documento' };
  if (body.sticker) return { mensagem: '[Sticker]', tipo: 'sticker' };
  // Mídia aninhada em body.message.* (formato alternativo usado em conversas diretas)
  if (body.message?.audio)   return { mensagem: '[Áudio]', tipo: 'audio' };
  if (body.message?.image?.caption) return { mensagem: body.message.image.caption, tipo: 'imagem' };
  if (body.message?.image)   return { mensagem: '[Imagem]', tipo: 'imagem' };
  if (body.message?.video?.caption) return { mensagem: body.message.video.caption, tipo: 'video' };
  if (body.message?.video)   return { mensagem: '[Vídeo]', tipo: 'video' };
  if (body.message?.document?.fileName) return { mensagem: `[Documento: ${body.message.document.fileName}]`, tipo: 'documento' };
  if (body.message?.document) return { mensagem: '[Documento]', tipo: 'documento' };
  if (body.message?.sticker) return { mensagem: '[Sticker]', tipo: 'sticker' };
  if (body.mimetype || body.message?.mimetype) return { mensagem: `[Mídia: ${body.mimetype || body.message?.mimetype}]`, tipo: 'sem_conteudo' };
  return { mensagem: '[Sem conteúdo]', tipo: 'sem_conteudo' };
}

// ────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const receivedAt = new Date().toISOString();

  // PASSO 1 — Ler body bruto ANTES de qualquer coisa
  let bodyRaw = '';
  let body = {};
  try {
    bodyRaw = await req.text();
    body = JSON.parse(bodyRaw);
  } catch (_) {
    body = {};
  }

  const headersObj = {};
  for (const [k, v] of req.headers.entries()) headersObj[k] = v;

  const base44 = createClientFromRequest(req);

  // PASSO 2 — Extrair campos básicos para o raw
  const phoneRaw      = body.phone || body.chatId || '';
  const isGroupRaw    = body.isGroup === true
    || String(phoneRaw).includes('-group')
    || String(phoneRaw).includes('@g.us')
    || String(body.chatId || '').includes('@g.us');
  const participantPhone = body.participantPhone || body.participant || '';
  const senderName       = body.senderName || body.pushName || 'Desconhecido';
  const chatName         = body.chatName   || body.groupName || '';
  const messageId        = body.messageId  || body.id || '';
  const eventType        = body.type       || '';
  const { mensagem: textExtraido } = extrairConteudo(body);

  // PASSO 3 — Salvar payload bruto IMEDIATAMENTE
  let rawId = null;
  try {
    const raw = await base44.asServiceRole.entities.WhatsappWebhookRaw.create({
      raw_payload:       bodyRaw.substring(0, 50000),
      headers:           JSON.stringify(headersObj).substring(0, 2000),
      method:            req.method,
      received_at:       receivedAt,
      phone:             phoneRaw,
      is_group:          isGroupRaw,
      participant_phone: participantPhone,
      sender_name:       senderName,
      chat_name:         chatName,
      message_id:        messageId || null,
      event_type:        eventType,
      text_message:      textExtraido,
      processed:         false,
      processing_status: 'pendente',
    });
    rawId = raw.id;
    console.log('[webhook] ✅ Raw salvo:', rawId, '| phone:', phoneRaw, '| isGroup:', isGroupRaw);
  } catch (rawErr) {
    console.error('[webhook] ❌ Falha ao salvar raw:', rawErr.message);
    // Continua mesmo assim
  }

  // Rejeitar métodos não-POST (mas raw já foi salvo)
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // PASSO 4 — Detectar grupo e extrair conteúdo completo
    const ids = normalizarGrupoId(phoneRaw);
    const candidatos = [ids.raw, ids.hyphen, ids.atsign, ids.numeric].filter(Boolean);
    const isFromMe = body.fromMe === true;
    const { mensagem, tipo, dadosReacao } = extrairConteudo(body);
    const timestamp = body.momment
      ? new Date(body.momment * 1000).toISOString()
      : receivedAt;

    // PASSO 4b — Tratar reações: atualizar mensagem original, não criar nova
    if (tipo === 'reacao' && dadosReacao?.targetMsgId && dadosReacao?.emoji) {
      const targetMsgs = await base44.asServiceRole.entities.WhatsappMensagem.filter({ message_id: dadosReacao.targetMsgId });
      if (targetMsgs.length > 0) {
        const target = targetMsgs[0];
        const reacoesAtuais = target.reacoes || [];
        // Remover reação anterior do mesmo remetente (toggle behavior)
        const reacoesFiltradas = reacoesAtuais.filter(r => r.remetente_telefone !== participantPhone);
        // Se a reação não for de remoção, adicionar
        if (dadosReacao.emoji && dadosReacao.emoji !== '') {
          reacoesFiltradas.push({
            emoji: dadosReacao.emoji,
            remetente: senderName,
            remetente_telefone: participantPhone || null,
            data: receivedAt,
          });
        }
        await base44.asServiceRole.entities.WhatsappMensagem.update(target.id, { reacoes: reacoesFiltradas });
        console.log('[webhook] ✅ Reação processada:', dadosReacao.emoji, '→ msg:', dadosReacao.targetMsgId);

        // Marcar raw como processado
        if (rawId) {
          await base44.asServiceRole.entities.WhatsappWebhookRaw.update(rawId, {
            processed: true,
            processing_status: 'processado',
          });
        }
        return Response.json({ ok: true, tipo: 'reacao', targetMsgId: dadosReacao.targetMsgId });
      } else {
        console.log('[webhook] ⚠️ Reação para mensagem não encontrada:', dadosReacao.targetMsgId);
        if (rawId) {
          await base44.asServiceRole.entities.WhatsappWebhookRaw.update(rawId, {
            processed: true,
            processing_status: 'ignorado',
            processing_error: 'Mensagem alvo da reação não encontrada',
          });
        }
        return Response.json({ ok: true, tipo: 'reacao_ignorada' });
      }
    }

    // PASSO 4c — Se for reação mas sem dados completos, ignorar (não criar mensagem)
    if (tipo === 'reacao') {
      console.log('[webhook] ⚠️ Reação com dados incompletos ignorada:', JSON.stringify(dadosReacao));
      if (rawId) {
        await base44.asServiceRole.entities.WhatsappWebhookRaw.update(rawId, {
          processed: true,
          processing_status: 'ignorado',
          processing_error: 'Reação com dados incompletos (emoji ou targetMsgId ausente)',
        });
      }
      return Response.json({ ok: true, tipo: 'reacao_ignorada_incompleta' });
    }

    // PASSO 5 — Idempotência: evitar duplicatas
    // 5a: por message_id (preciso)
    if (messageId) {
      const existing = await base44.asServiceRole.entities.WhatsappMensagem.filter({ message_id: messageId });
      if (existing.length > 0) {
        console.log('[webhook] Duplicata ignorada (message_id):', messageId);
        if (rawId) {
          await base44.asServiceRole.entities.WhatsappWebhookRaw.update(rawId, {
            processed: true,
            processing_status: 'ignorado',
            processing_error: 'Duplicata: message_id já existe',
          });
        }
        return Response.json({ ok: true, duplicate: true });
      }
    }

    // PASSO 6 — Buscar cliente vinculado ao grupo
    let clienteId   = null;
    let clienteNome = null;
    let grupoNome   = chatName;
    let grupoIdFinal = ids.hyphen; // padronizar para -group
    let grupoRecord  = null;

    // Busca em WhatsappGrupo pelos candidatos de ID
    for (const candidato of candidatos) {
      if (!candidato) continue;
      const grupos = await base44.asServiceRole.entities.WhatsappGrupo.filter({ grupo_id: candidato });
      if (grupos.length > 0) {
        grupoRecord  = grupos[0];
        clienteId    = grupos[0].cliente_id   || null;
        clienteNome  = grupos[0].cliente_nome || null;
        grupoNome    = grupos[0].nome_grupo   || chatName;
        grupoIdFinal = candidato;
        break;
      }
    }

    // Fallback: buscar pelo campo whatsapp_grupo_id no Cliente
    if (!grupoRecord) {
      for (const candidato of candidatos) {
        if (!candidato) continue;
        const clientes = await base44.asServiceRole.entities.Cliente.filter({ whatsapp_grupo_id: candidato });
        if (clientes.length > 0) {
          clienteId    = clientes[0].id;
          clienteNome  = clientes[0].nome;
          grupoNome    = clientes[0].whatsapp_grupo_nome || chatName || candidato;
          grupoIdFinal = candidato;
          break;
        }
      }
    }

    // PASSO 6b — Idempotência por similaridade para mensagens enviadas
    // O enviarMensagemGeral já salva a mensagem antes do webhook chegar
    if (isFromMe && grupoIdFinal) {
      const recentes = await base44.asServiceRole.entities.WhatsappMensagem.filter({
        grupo_id: grupoIdFinal,
        from_me: true,
        origem: 'enviada',
      }, '-received_at', 5);
      
      const msgNormalizada = (mensagem || '').trim().substring(0, 100);
      const duplicata = recentes.find(m => {
        const mNorm = (m.mensagem || '').trim().substring(0, 100);
        return mNorm === msgNormalizada && m.tipo_mensagem === tipo;
      });
      
      if (duplicata) {
        console.log('[webhook] Duplicata ignorada (from_me similar):', duplicata.id);
        if (rawId) {
          await base44.asServiceRole.entities.WhatsappWebhookRaw.update(rawId, {
            processed: true,
            processing_status: 'ignorado',
            processing_error: 'Duplicata: mensagem similar já existe (criada pelo enviarMensagemGeral)',
          });
        }
        return Response.json({ ok: true, duplicate: true });
      }
    }

    // PASSO 7 — Criar ou atualizar WhatsappGrupo
    if (isGroupRaw && phoneRaw) {
      const dadosGrupoUpdate = {
        ultima_mensagem:       mensagem,
        ultima_atividade:      receivedAt,
      };

      if (!grupoRecord) {
        // Criar novo grupo
        try {
          await base44.asServiceRole.entities.WhatsappGrupo.create({
            grupo_id:       grupoIdFinal,
            nome_grupo:     chatName || grupoIdFinal,
            ultima_mensagem: mensagem,
            ultima_atividade: receivedAt,
            cliente_id:     clienteId || null,
            cliente_nome:   clienteNome || null,
            status_vinculo: clienteId ? 'vinculado' : 'nao_vinculado',
            origem:         'webhook',
          });
          console.log('[webhook] ✅ Novo grupo criado:', grupoIdFinal);
        } catch (ge) {
          console.error('[webhook] ⚠️ Erro ao criar grupo:', ge.message);
        }
      } else {
        // Atualizar grupo existente
        try {
          await base44.asServiceRole.entities.WhatsappGrupo.update(grupoRecord.id, dadosGrupoUpdate);
        } catch (ge) {
          console.error('[webhook] ⚠️ Erro ao atualizar grupo:', ge.message);
        }
      }
    }

    // PASSO 8 — Classificar remetente usando WhatsappRemetenteVoxx
    let remetenteTipo = isFromMe ? 'voxx' : 'desconhecido';

    if (!isFromMe && participantPhone) {
      const telNorm = participantPhone.replace(/\D/g, '');
      // Buscar remetentes VOXX ativos
      const remVoxx = await base44.asServiceRole.entities.WhatsappRemetenteVoxx.filter({ ativo: true });
      const telefonesVoxx = new Set(remVoxx.map(r => r.telefone_normalizado).filter(Boolean));

      const isVoxxByPhone = telefonesVoxx.has(telNorm) ||
        (telNorm.length === 13 && telefonesVoxx.has(telNorm.slice(0, 4) + telNorm.slice(5))) ||
        (telNorm.length === 12 && telefonesVoxx.has(telNorm.slice(0, 4) + '9' + telNorm.slice(4)));

      remetenteTipo = isVoxxByPhone ? 'voxx' : 'cliente';
    }

    const origem = (isFromMe || remetenteTipo === 'voxx') ? 'enviada' : 'recebida';
    const statusProc    = clienteId ? 'ok' : 'sem_vinculo';
    const midia = extrairMidiaUrl(body);

    // Extrai dados da mensagem citada (reply/quoted message)
    let citacaoId = null;
    let citacaoTexto = null;
    let citacaoRemetente = null;
    let citacaoTipo = null;
    let citacaoMidiaUrl = null;
    
    const quotedMsg = body.quotedMsg || body.quotedMessage || body.message?.quotedMsg || body.message?.quotedMessage || null;
    if (quotedMsg) {
      citacaoId = quotedMsg.messageId || quotedMsg.id || null;
      citacaoRemetente = quotedMsg.senderName || quotedMsg.pushName || null;
      
      // Extrai texto citado
      if (quotedMsg.body) {
        citacaoTexto = typeof quotedMsg.body === 'string' ? quotedMsg.body : null;
      } else if (quotedMsg.text?.message) {
        citacaoTexto = quotedMsg.text.message;
      } else if (quotedMsg.caption) {
        citacaoTexto = quotedMsg.caption;
      }
      
      // Detecta tipo da mensagem citada
      if (quotedMsg.image) {
        citacaoTipo = 'imagem';
        citacaoMidiaUrl = quotedMsg.image.imageUrl || null;
        if (!citacaoTexto && quotedMsg.image.caption) citacaoTexto = quotedMsg.image.caption;
      } else if (quotedMsg.video) {
        citacaoTipo = 'video';
        citacaoMidiaUrl = quotedMsg.video.videoUrl || null;
        if (!citacaoTexto && quotedMsg.video.caption) citacaoTexto = quotedMsg.video.caption;
      } else if (quotedMsg.audio) {
        citacaoTipo = 'audio';
        citacaoMidiaUrl = quotedMsg.audio.audioUrl || null;
      } else if (quotedMsg.document) {
        citacaoTipo = 'documento';
        citacaoMidiaUrl = quotedMsg.document.documentUrl || null;
        if (!citacaoTexto && quotedMsg.document.fileName) citacaoTexto = quotedMsg.document.fileName;
      } else if (quotedMsg.sticker) {
        citacaoTipo = 'sticker';
        citacaoMidiaUrl = quotedMsg.sticker.stickerUrl || quotedMsg.sticker || null;
      } else if (citacaoTexto) {
        citacaoTipo = 'texto';
      }
    }

    await base44.asServiceRole.entities.WhatsappMensagem.create({
      message_id:          messageId || null,
      raw_id:              rawId     || null,
      cliente_id:          clienteId || null,
      cliente_nome:        clienteNome || chatName || null,
      grupo_id:            grupoIdFinal || null,
      grupo_id_normalizado: ids.hyphen  || null,
      grupo_nome:          grupoNome   || chatName || null,
      is_group:            isGroupRaw,
      remetente_nome:      senderName,
      remetente_telefone:  participantPhone || null,
      remetente_tipo:      remetenteTipo,
      origem,
      mensagem,
      tipo_mensagem:       tipo,
      midia_url:           midia?.midia_url || null,
      midia_mimetype:      midia?.midia_mimetype || null,
      midia_nome:          midia?.midia_nome || null,
      timestamp_mensagem:  timestamp,
      received_at:         receivedAt,
      from_me:             isFromMe,
      status_processamento: statusProc,
      citacao_id:          citacaoId,
      citacao_texto:       citacaoTexto,
      citacao_remetente:   citacaoRemetente,
      citacao_tipo:        citacaoTipo,
      citacao_midia_url:   citacaoMidiaUrl,
    });

    console.log('[webhook] ✅ WhatsappMensagem criada | cliente:', clienteNome || 'sem vínculo', '| grupo:', grupoNome, '| msg:', mensagem.substring(0, 60));

    // PASSO 9 — Marcar raw como processado
    if (rawId) {
      await base44.asServiceRole.entities.WhatsappWebhookRaw.update(rawId, {
        processed:         true,
        processing_status: 'processado',
        cliente_id:        clienteId   || null,
        cliente_nome:      clienteNome || null,
        grupo_id:          grupoIdFinal || null,
        grupo_nome:        grupoNome   || null,
      });
    }

    return Response.json({ ok: true, rawId, clienteId, clienteNome, statusProc });

  } catch (error) {
    console.error('[webhook] ❌ Erro geral:', error.message);
    if (rawId) {
      try {
        await base44.asServiceRole.entities.WhatsappWebhookRaw.update(rawId, {
          processed:         true,
          processing_status: 'erro',
          processing_error:  error.message,
        });
      } catch (_) {}
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});