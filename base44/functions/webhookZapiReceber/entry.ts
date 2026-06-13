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
  if (body.image?.imageUrl) return { midia_url: body.image.imageUrl, midia_mimetype: body.image.mimeType || 'image/jpeg' };
  if (body.audio?.audioUrl) return { midia_url: body.audio.audioUrl, midia_mimetype: body.audio.mimeType || 'audio/ogg' };
  if (body.video?.videoUrl) return { midia_url: body.video.videoUrl, midia_mimetype: body.video.mimeType || 'video/mp4' };
  if (body.document?.documentUrl) return { midia_url: body.document.documentUrl, midia_mimetype: body.document.mimeType || null, midia_nome: body.document.fileName || null };
  return null;
}

function extrairConteudo(body) {
  // Texto
  if (body.text?.message) return { mensagem: body.text.message, tipo: 'texto' };
  if (body.text?.text)    return { mensagem: body.text.text, tipo: 'texto' };
  if (typeof body.text === 'string' && body.text) return { mensagem: body.text, tipo: 'texto' };
  if (body.message?.text) return { mensagem: body.message.text, tipo: 'texto' };
  if (body.body && typeof body.body === 'string') return { mensagem: body.body, tipo: 'texto' };
  if (body.caption) return { mensagem: body.caption, tipo: 'texto' };
  // Mídia
  if (body.audio)   return { mensagem: '[Áudio]', tipo: 'audio' };
  if (body.image?.caption) return { mensagem: body.image.caption, tipo: 'imagem' };
  if (body.image)   return { mensagem: '[Imagem]', tipo: 'imagem' };
  if (body.video?.caption) return { mensagem: body.video.caption, tipo: 'video' };
  if (body.video)   return { mensagem: '[Vídeo]', tipo: 'video' };
  if (body.document?.fileName) return { mensagem: `[Documento: ${body.document.fileName}]`, tipo: 'documento' };
  if (body.document) return { mensagem: '[Documento]', tipo: 'documento' };
  if (body.sticker) return { mensagem: '[Sticker]', tipo: 'sticker' };
  if (body.mimetype) return { mensagem: `[Mídia: ${body.mimetype}]`, tipo: 'sem_conteudo' };
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
    const { mensagem, tipo } = extrairConteudo(body);
    const timestamp = body.momment
      ? new Date(body.momment * 1000).toISOString()
      : receivedAt;

    // PASSO 5 — Idempotência: evitar duplicatas por message_id
    if (messageId) {
      const existing = await base44.asServiceRole.entities.WhatsappMensagem.filter({ message_id: messageId });
      if (existing.length > 0) {
        console.log('[webhook] Duplicata ignorada:', messageId);
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