import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Extrai URL da mídia do payload bruto ──────────────────────────────
function extrairMidiaUrl(body) {
  if (body.image?.imageUrl) return { midia_url: body.image.imageUrl, midia_mimetype: body.image.mimeType || 'image/jpeg' };
  if (body.audio?.audioUrl) return { midia_url: body.audio.audioUrl, midia_mimetype: body.audio.mimeType || 'audio/ogg' };
  if (body.video?.videoUrl) return { midia_url: body.video.videoUrl, midia_mimetype: body.video.mimeType || 'video/mp4' };
  if (body.document?.documentUrl) return { midia_url: body.document.documentUrl, midia_mimetype: body.document.mimeType || null, midia_nome: body.document.fileName || null };
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas admin' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { limit = 200, apenasPendentes = true } = body;

    // Buscar mensagens com mídia mas sem midia_url
    const tiposMidia = ['imagem', 'video', 'audio', 'documento'];
    let todasMensagens = [];

    for (const tipo of tiposMidia) {
      let skip = 0;
      let temMais = true;
      while (temMais) {
        const query = { tipo_mensagem: tipo };
        if (apenasPendentes) query.midia_url = null; // só as que ainda não têm URL
        const batch = await base44.asServiceRole.entities.WhatsappMensagem.filter(
          query, '-received_at', 50, skip
        );
        todasMensagens = todasMensagens.concat(batch);
        skip += 50;
        if (batch.length < 50 || todasMensagens.length >= limit) temMais = false;
      }
    }

    // Limitar ao total solicitado
    const mensagens = todasMensagens.slice(0, limit);

    let atualizadas = 0;
    let rawNaoEncontrado = 0;
    let semMidia = 0;
    let erros = 0;

    for (const msg of mensagens) {
      try {
        // Buscar raw payload vinculado
        let rawPayload = null;
        if (msg.raw_id) {
          const raws = await base44.asServiceRole.entities.WhatsappWebhookRaw.filter({ id: msg.raw_id }, '-received_at', 1);
          if (raws.length > 0 && raws[0].raw_payload) {
            try {
              rawPayload = JSON.parse(raws[0].raw_payload);
            } catch (_) { /* ignorar */ }
          }
        }

        if (!rawPayload) {
          rawNaoEncontrado++;
          continue;
        }

        const midia = extrairMidiaUrl(rawPayload);
        if (!midia) {
          semMidia++;
          continue;
        }

        await base44.asServiceRole.entities.WhatsappMensagem.update(msg.id, {
          midia_url: midia.midia_url || null,
          midia_mimetype: midia.midia_mimetype || null,
          midia_nome: midia.midia_nome || null,
        });

        atualizadas++;
        // Pausa de 80ms para evitar rate limit
        await new Promise(r => setTimeout(r, 80));
      } catch (e) {
        erros++;
      }
    }

    return Response.json({
      success: true,
      total_processadas: mensagens.length,
      atualizadas,
      raw_nao_encontrado: rawNaoEncontrado,
      sem_midia_no_raw: semMidia,
      erros,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});