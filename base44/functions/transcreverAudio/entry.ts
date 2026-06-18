import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));

  // Suporta: automação {event, data} e chamada manual {mensagem_id}
  const isManualCall = !!body.mensagem_id && !body.event;

  if (isManualCall) {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let mensagemId = body.mensagem_id || body.event?.entity_id;
  let midiaUrl = body.data?.midia_url;
  let tipoMensagem = body.data?.tipo_mensagem;

  // Se chamada manual ou payload_too_large, buscar do banco
  if (!midiaUrl && mensagemId) {
    const msgs = await base44.asServiceRole.entities.WhatsappMensagem.filter({ id: mensagemId }, '-created_date', 1);
    if (!msgs.length) return Response.json({ error: 'Mensagem não encontrada' }, { status: 404 });
    midiaUrl = msgs[0].midia_url;
    tipoMensagem = msgs[0].tipo_mensagem;
    mensagemId = msgs[0].id;
  }

  if (!mensagemId || !midiaUrl || tipoMensagem !== 'audio') {
    return Response.json({ ok: true, skipped: true });
  }

  try {
    await base44.asServiceRole.entities.WhatsappMensagem.update(mensagemId, {
      transcricao_status: 'processando'
    });

    const transcricao = await base44.asServiceRole.integrations.Core.TranscribeAudio({
      audio_url: midiaUrl
    });

    await base44.asServiceRole.entities.WhatsappMensagem.update(mensagemId, {
      transcricao_audio: transcricao,
      transcricao_status: 'concluida'
    });

    console.log('[transcreverAudio] ✅ OK:', mensagemId, '| chars:', transcricao?.length);
    return Response.json({ ok: true, mensagem_id: mensagemId, transcricao });
  } catch (error) {
    console.error('[transcreverAudio] ❌ Erro:', error.message);
    try {
      await base44.asServiceRole.entities.WhatsappMensagem.update(mensagemId, {
        transcricao_status: 'erro'
      });
    } catch (_) {}
    return Response.json({ error: error.message }, { status: 500 });
  }
});