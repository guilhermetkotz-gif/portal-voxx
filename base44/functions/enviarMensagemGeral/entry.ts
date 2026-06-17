import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ZAPI_BASE = 'https://api.z-api.io';

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

    // ═══ Salvar mensagem IMEDIATAMENTE (antes do Z-API) ═══
    // Assim o frontend mostra a mensagem na hora, sem esperar o delay do Z-API
    const msgRecord = await base44.asServiceRole.entities.WhatsappMensagem.create({
      message_id: null, // será atualizado após Z-API
      cliente_id: clienteId || null,
      cliente_nome: clienteNome || null,
      grupo_id: chatId,
      grupo_nome: chatName || null,
      is_group: (String(chatId).includes('-group') || String(chatId).includes('@g.us')) && !String(chatId).includes('@lid') && !String(chatId).includes('@c.us'),
      remetente_nome: nomeRemetente,
      remetente_telefone: telefoneRemetente,
      remetente_tipo: 'voxx',
      origem: 'enviada',
      mensagem: mensagemFinal || '[Mídia]',
      tipo_mensagem: tipoMsgMap[tipo] || 'texto',
      midia_url: midiaUrl || null,
      midia_nome: fileName || null,
      received_at: agora,
      from_me: true,
      status_entrega: 'enviado',
      status_processamento: 'ok',
    }).catch(() => null);

    // ═══ Enviar via Z-API ═══
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
      if (!resp.ok) {
        statusEnvio = 'erro';
        erroEnvio = `Z-API HTTP ${resp.status}: ${await resp.text().catch(() => '')}`;
      } else {
        resultadoApi = await resp.json().catch(() => ({}));
      }
    } else if (tipo === 'imagem' && midiaUrl) {
      const captionEnvio = mensagemWhatsApp || mensagemFinal || '';
      const resp = await fetch(`${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/send-image`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: chatId, image: midiaUrl, caption: captionEnvio }),
      });
      if (!resp.ok) {
        statusEnvio = 'erro';
        erroEnvio = `Z-API HTTP ${resp.status}: ${await resp.text().catch(() => '')}`;
      } else {
        resultadoApi = await resp.json().catch(() => ({}));
      }
    } else if (tipo === 'video' && midiaUrl) {
      const captionEnvio = mensagemWhatsApp || mensagemFinal || '';
      const resp = await fetch(`${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/send-video`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: chatId, video: midiaUrl, caption: captionEnvio }),
      });
      if (!resp.ok) {
        statusEnvio = 'erro';
        erroEnvio = `Z-API HTTP ${resp.status}: ${await resp.text().catch(() => '')}`;
      } else {
        resultadoApi = await resp.json().catch(() => ({}));
      }
    } else if (tipo === 'audio' && midiaUrl) {
      const resp = await fetch(`${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/send-ptt`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: chatId, ptt: midiaUrl }),
      });
      if (!resp.ok) {
        statusEnvio = 'erro';
        erroEnvio = `Z-API HTTP ${resp.status}: ${await resp.text().catch(() => '')}`;
      } else {
        resultadoApi = await resp.json().catch(() => ({}));
      }
    } else if (tipo === 'documento' && midiaUrl) {
      const resp = await fetch(`${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/send-document`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: chatId, document: midiaUrl, fileName: fileName || 'documento' }),
      });
      if (!resp.ok) {
        statusEnvio = 'erro';
        erroEnvio = `Z-API HTTP ${resp.status}: ${await resp.text().catch(() => '')}`;
      } else {
        resultadoApi = await resp.json().catch(() => ({}));
      }
    } else {
      return Response.json({ error: `Tipo "${tipo}" não suportado ou midiaUrl ausente` }, { status: 400 });
    }

    // ═══ Registrar log e atualizar mensagem com ID do Z-API ═══
    await base44.asServiceRole.entities.WhatsappEnvioLog.create({
      cliente_id: clienteId || '',
      cliente_nome: clienteNome || '',
      grupo_id: chatId,
      grupo_nome: chatName || '',
      tipo_envio: tipo,
      origem: 'manual',
      mensagem: mensagemFinal,
      midia_url: midiaUrl || null,
      status_envio: statusEnvio,
      retorno_zapi: resultadoApi ? JSON.stringify(resultadoApi) : null,
      erro: erroEnvio || null,
      enviado_por: user.email,
      enviado_em: agora,
      remetente_nome: nomeRemetente,
    });

    // Atualizar mensagem com o messageId real do Z-API
    if (msgRecord?.id && resultadoApi) {
      const zapiId = resultadoApi?.messageId || resultadoApi?.id || null;
      if (zapiId) {
        await base44.asServiceRole.entities.WhatsappMensagem.update(msgRecord.id, {
          message_id: zapiId,
        }).catch(() => null);
      }
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