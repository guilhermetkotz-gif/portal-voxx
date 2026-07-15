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
    const {
      chatId, mensagem, tipo = 'texto', midiaUrl, fileName,
      incluirAssinatura = true, clienteId, clienteNome, chatName,
      origem: origemEnvio = 'manual', demandaId, comentarioOriginal,
    } = body;

    if (!chatId) return Response.json({ error: 'chatId é obrigatório' }, { status: 400 });

    const { zapiInstanceId, zapiToken, zapiClientToken } = await getZapiCredentials(base44);
    if (!zapiInstanceId) return Response.json({ error: 'Z-API não configurada' }, { status: 503 });

    // Buscar remetente VOXX vinculado ao usuário logado
    let remetenteVoxx = null;
    try {
      const remetentes = await base44.asServiceRole.entities.WhatsappRemetenteVoxx.filter(
        { usuario_id: user.id, ativo: true },
        '-created_date',
        1
      );
      remetenteVoxx = remetentes?.[0] || null;
    } catch (_) { /* ignora falha na busca */ }

    // Nome para assinatura: prioriza remetente VOXX > full_name > fallback
    const nomeRemetente = remetenteVoxx?.nome || user.full_name?.split(' ')[0] || 'Equipe Voxx';
    const telefoneRemetente = remetenteVoxx?.telefone_normalizado || null;

    // Mensagem limpa (sem assinatura) para armazenar no banco
    let mensagemFinal = mensagem || '';

    // Mensagem com assinatura para envio ao WhatsApp (visível no app do cliente)
    let mensagemWhatsApp = mensagemFinal;
    if (incluirAssinatura && mensagemFinal.trim()) {
      mensagemWhatsApp = mensagemFinal.trim() + `\n\n— ${nomeRemetente} | Voxx`;
    }

    const agora = new Date().toISOString();
    const tipoMsgMap = { texto: 'texto', imagem: 'imagem', video: 'video', audio: 'audio', documento: 'documento' };

    // Salvar mensagem IMEDIATAMENTE (antes do Z-API) com status 'pendente'
    // Status será atualizado para 'enviado' ou 'erro' após resposta real do Z-API
    const msgRecord = await base44.asServiceRole.entities.WhatsappMensagem.create({
      message_id: null,
      cliente_id: clienteId || null,
      cliente_nome: clienteNome || null,
      grupo_id: chatId,
      grupo_nome: chatName || null,
      is_group: (String(chatId).includes('-group') || String(chatId).includes('@g.us')) && !String(chatId).includes('@lid') && !String(chatId).includes('@c.us'),
      remetente_nome: nomeRemetente,
      remetente_telefone: telefoneRemetente,
      remetente_tipo: 'voxx',
      usuario_id: user.id,
      usuario_nome: nomeRemetente,
      origem: 'enviada',
      mensagem: mensagemFinal || '[Mídia]',
      tipo_mensagem: tipoMsgMap[tipo] || 'texto',
      midia_url: midiaUrl || null,
      midia_nome: fileName || null,
      received_at: agora,
      from_me: true,
      status_entrega: 'pendente',
      status_processamento: 'ok',
    }).catch(() => null);

    // Enviar via Z-API
    let resultadoApi = null;
    let statusEnvio = 'enviado';
    let erroEnvio = null;

    const headers = { 'Client-Token': zapiClientToken, 'Content-Type': 'application/json' };

    if (tipo === 'texto') {
      const textoEnvio = mensagemWhatsApp || mensagemFinal;
      if (!textoEnvio?.trim()) return Response.json({ error: 'Mensagem vazia' }, { status: 400 });
      const resp = await fetch(`${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/send-text`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: chatId, message: textoEnvio }),
      });
      resultadoApi = await resp.json().catch(() => null);
      const apiError = isZapiError(resultadoApi);
      if (!resp.ok || apiError) {
        statusEnvio = 'erro';
        erroEnvio = apiError || `Z-API HTTP ${resp.status}: ${JSON.stringify(resultadoApi).substring(0, 200)}`;
      }
    } else if (tipo === 'imagem' && midiaUrl) {
      const captionEnvio = mensagemWhatsApp || mensagemFinal || '';
      const resp = await fetch(`${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/send-image`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: chatId, image: midiaUrl, caption: captionEnvio }),
      });
      resultadoApi = await resp.json().catch(() => null);
      const apiError = isZapiError(resultadoApi);
      if (!resp.ok || apiError) {
        statusEnvio = 'erro';
        erroEnvio = apiError || `Z-API HTTP ${resp.status}: ${JSON.stringify(resultadoApi).substring(0, 200)}`;
      }
    } else if (tipo === 'video' && midiaUrl) {
      const captionEnvio = mensagemWhatsApp || mensagemFinal || '';
      const resp = await fetch(`${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/send-video`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: chatId, video: midiaUrl, caption: captionEnvio }),
      });
      resultadoApi = await resp.json().catch(() => null);
      const apiError = isZapiError(resultadoApi);
      if (!resp.ok || apiError) {
        statusEnvio = 'erro';
        erroEnvio = apiError || `Z-API HTTP ${resp.status}: ${JSON.stringify(resultadoApi).substring(0, 200)}`;
      }
    } else if (tipo === 'audio' && midiaUrl) {
      // Tentar send-audio primeiro (envia como áudio reproduzível / nota de voz)
      const audioResp = await fetch(`${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/send-audio`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: chatId, audio: midiaUrl, waveform: true }),
      });
      const audioResult = await audioResp.json().catch(() => null);
      const audioError = isZapiError(audioResult);

      if (audioResp.ok && !audioError) {
        resultadoApi = audioResult;
      } else {
        // Fallback: se send-audio falhar, enviar como documento
        const audioExt = (fileName || midiaUrl || '').split('.').pop()?.toLowerCase() || 'mp3';
        const fallbackResp = await fetch(`${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/send-document/${audioExt}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: chatId, document: midiaUrl, fileName: fileName || 'audio.' + audioExt }),
        });
        resultadoApi = await fallbackResp.json().catch(() => null);
        const fallbackError = isZapiError(resultadoApi);
        if (!fallbackResp.ok || fallbackError) {
          statusEnvio = 'erro';
          erroEnvio = fallbackError || `Z-API HTTP ${fallbackResp.status}: ${JSON.stringify(resultadoApi).substring(0, 200)}`;
        }
      }
    } else if (tipo === 'documento' && midiaUrl) {
      const ext = (fileName || midiaUrl || '').split('.').pop()?.toLowerCase() || 'pdf';
      const resp = await fetch(`${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/send-document/${ext}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: chatId, document: midiaUrl, fileName: fileName || 'documento' }),
      });
      resultadoApi = await resp.json().catch(() => null);
      const apiError = isZapiError(resultadoApi);
      if (!resp.ok || apiError) {
        statusEnvio = 'erro';
        erroEnvio = apiError || `Z-API HTTP ${resp.status}: ${JSON.stringify(resultadoApi).substring(0, 200)}`;
      }
    } else {
      return Response.json({ error: `Tipo "${tipo}" não suportado ou midiaUrl ausente` }, { status: 400 });
    }

    // Registrar log
    await base44.asServiceRole.entities.WhatsappEnvioLog.create({
      cliente_id: clienteId || '',
      cliente_nome: clienteNome || '',
      grupo_id: chatId,
      grupo_nome: chatName || '',
      tipo_envio: tipo,
      origem: origemEnvio || 'manual',
      mensagem: mensagemFinal,
      midia_url: midiaUrl || null,
      status_envio: statusEnvio,
      retorno_zapi: resultadoApi ? JSON.stringify(resultadoApi) : null,
      erro: erroEnvio || null,
      enviado_por: user.email,
      enviado_em: agora,
      remetente_nome: nomeRemetente,
      demanda_id: demandaId || null,
      comentario_original: comentarioOriginal || null,
    });

    // Atualizar mensagem com status real e messageId do Z-API
    if (msgRecord?.id) {
      const zapiId = resultadoApi?.messageId || resultadoApi?.id || null;
      await base44.asServiceRole.entities.WhatsappMensagem.update(msgRecord.id, {
        status_entrega: statusEnvio,
        ...(zapiId ? { message_id: zapiId } : {}),
      }).catch(() => null);
    }

    return Response.json({
      success: statusEnvio === 'enviado',
      status_envio: statusEnvio,
      erro: erroEnvio,
      resultado_api: resultadoApi,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});