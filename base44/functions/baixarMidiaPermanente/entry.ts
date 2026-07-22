import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const TEMP_DOMAINS = ['backblazeb2.com', 'z-api.io'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function isTempUrl(url) {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return TEMP_DOMAINS.some(d => hostname.includes(d));
  } catch (_) {
    return false;
  }
}

function getExtFromName(nome) {
  if (!nome) return 'bin';
  const parts = nome.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : 'bin';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { mensagem_id, limit = 15 } = body;

    // Auth: aceita chamada manual (com auth) ou do webhook (service role)
    const isManual = !!mensagem_id || body.manual === true;
    if (isManual) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let mensagens = [];

    if (mensagem_id) {
      const msgs = await base44.asServiceRole.entities.WhatsappMensagem.filter(
        { id: mensagem_id }, '-created_date', 1
      );
      mensagens = msgs.filter(m => m.midia_url && isTempUrl(m.midia_url));
    } else {
      // Buscar mensagens com mídia que ainda têm URLs temporárias
      const tipos = ['documento', 'imagem', 'video', 'audio', 'sticker'];
      for (const tipo of tipos) {
        if (mensagens.length >= limit) break;
        const batch = await base44.asServiceRole.entities.WhatsappMensagem.filter(
          { tipo_mensagem: tipo }, '-received_at', 30
        );
        for (const m of batch) {
          if (m.midia_url && isTempUrl(m.midia_url)) {
            mensagens.push(m);
            if (mensagens.length >= limit) break;
          }
        }
      }
    }

    let baixados = 0;
    let erros = 0;
    let jaPermanente = 0;

    for (const msg of mensagens) {
      try {
        const tempUrl = msg.midia_url;
        if (!isTempUrl(tempUrl)) {
          jaPermanente++;
          continue;
        }

        // Download do arquivo temporário
        const fetchRes = await fetch(tempUrl);
        if (!fetchRes.ok) {
          console.error('[baixarMidia] fetch falhou:', fetchRes.status, msg.id);
          erros++;
          continue;
        }

        const contentLength = fetchRes.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
          console.error('[baixarMidia] arquivo muito grande:', contentLength, msg.id);
          erros++;
          continue;
        }

        const blob = await fetchRes.blob();
        if (blob.size > MAX_FILE_SIZE) {
          console.error('[baixarMidia] blob muito grande:', blob.size, msg.id);
          erros++;
          continue;
        }

        // Nome do arquivo
        const ext = getExtFromName(msg.midia_nome);
        const nomeArquivo = msg.midia_nome || `midia_${msg.id}.${ext}`;
        const file = new File([blob], nomeArquivo, { type: blob.type || 'application/octet-stream' });

        // Upload permanente
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });
        const permanentUrl = uploadRes?.file_url;

        if (!permanentUrl) {
          console.error('[baixarMidia] upload sem file_url:', msg.id);
          erros++;
          continue;
        }

        // Atualizar mensagem com URL permanente
        await base44.asServiceRole.entities.WhatsappMensagem.update(msg.id, {
          midia_url: permanentUrl,
        });

        baixados++;
        console.log('[baixarMidia] ✅ Re-hosted:', msg.id, '|', tempUrl.substring(0, 50), '→', permanentUrl.substring(0, 50));

        // Pausa entre downloads
        await new Promise(r => setTimeout(r, 150));
      } catch (e) {
        console.error('[baixarMidia] erro msg:', msg.id, e.message);
        erros++;
      }
    }

    return Response.json({
      success: true,
      total_processadas: mensagens.length,
      baixados,
      erros,
      ja_permanente: jaPermanente,
    });
  } catch (error) {
    console.error('[baixarMidia] erro geral:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});