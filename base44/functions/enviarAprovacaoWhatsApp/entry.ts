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
    const { entrega_id, mensagem, midia_url, tipo_midia = 'texto' } = body;

    if (!entrega_id || !mensagem?.trim()) {
      return Response.json({ error: 'entrega_id e mensagem são obrigatórios' }, { status: 400 });
    }

    // Buscar entrega
    const entregaResults = await base44.asServiceRole.entities.EntregaDemanda.filter({ id: entrega_id }, '-created_date', 1);
    const entrega = entregaResults[0];
    if (!entrega) return Response.json({ error: 'Entrega não encontrada' }, { status: 404 });

    if (!entrega.link_publico_aprovacao || !entrega.link_ativo) {
      return Response.json({ error: 'Entrega não possui link público ativo' }, { status: 400 });
    }

    // Buscar cliente
    const clienteResults = await base44.asServiceRole.entities.Cliente.filter({ id: entrega.cliente_id }, '-created_date', 1);
    const cliente = clienteResults[0];
    if (!cliente?.whatsapp_grupo_id) {
      return Response.json({ error: 'Cliente não possui whatsapp_grupo_id configurado' }, { status: 400 });
    }

    const grupoId = cliente.whatsapp_grupo_id;
    const agora = new Date().toISOString();

    // Buscar demanda para histórico
    const demandaResults = entrega.demanda_id
      ? await base44.asServiceRole.entities.Demanda.filter({ id: entrega.demanda_id }, '-created_date', 1).catch(() => [])
      : [];
    const demanda = demandaResults[0] || null;

    const { zapiInstanceId, zapiToken, zapiClientToken } = await getZapiCredentials(base44);

    if (!zapiInstanceId || !zapiToken || !zapiClientToken) {
      return Response.json({ error: 'Z-API não configurada. Configure os secrets ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN.' }, { status: 503 });
    }

    // Verificar status da instância Z-API
    const statusResp = await fetch(
      `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/status`,
      { headers: { 'Client-Token': zapiClientToken } }
    );
    const statusData = await statusResp.json().catch(() => ({}));

    if (!statusData.connected || !statusData.smartphoneConnected) {
      return Response.json({
        error: 'Instância Z-API desconectada. Abra o WhatsApp vinculado e escaneie o QR code novamente.',
        zapi_status: statusData
      }, { status: 503 });
    }

    // Enviar via Z-API
    let tipoEnvioFinal = tipo_midia;
    let statusEnvio = 'enviado';
    let erroEnvio = null;
    let resultadoEnvio = null;

    let zapiEndpoint, zapiBody;
    if (midia_url && tipo_midia === 'imagem') {
      tipoEnvioFinal = 'imagem';
      zapiEndpoint = `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/send-image`;
      zapiBody = { phone: grupoId, image: midia_url, caption: mensagem, viewOnce: false };
    } else {
      tipoEnvioFinal = 'texto';
      zapiEndpoint = `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
      zapiBody = { phone: grupoId, message: mensagem };
    }

    const sendResp = await fetch(zapiEndpoint, {
      method: 'POST',
      headers: { 'Client-Token': zapiClientToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(zapiBody)
    });

    if (!sendResp.ok) {
      const errText = await sendResp.text().catch(() => '');
      statusEnvio = 'erro';
      erroEnvio = `Z-API HTTP ${sendResp.status}: ${errText}`;
    } else {
      resultadoEnvio = await sendResp.json().catch(() => ({}));
    }

    // Registrar envio
    const registro = await base44.asServiceRole.entities.EnvioAprovacaoWhatsApp.create({
      cliente_id: cliente.id,
      cliente_nome: cliente.nome,
      demanda_id: entrega.demanda_id || null,
      demanda_titulo: demanda?.titulo || null,
      entrega_id: entrega.id,
      entrega_nome: entrega.nome_entrega,
      whatsapp_grupo_id: grupoId,
      mensagem,
      tipo_envio: tipoEnvioFinal,
      status_envio: statusEnvio,
      zapi_message_id: resultadoEnvio?.messageId || resultadoEnvio?.id || null,
      zapi_zaap_id: resultadoEnvio?.zaapId || null,
      erro_envio: erroEnvio || null,
      enviado_por: user.email,
      enviado_por_nome: user.full_name || user.email,
      enviado_em: agora,
      payload_enviado: { tipo: 'envio_aprovacao', ...zapiBody },
      link_aprovacao: entrega.link_publico_aprovacao
    });

    // Registrar mensagem enviada no WhatsappMensagem para aparecer no Radar WhatsApp
    if (statusEnvio === 'enviado') {
      try {
        const zapiId = resultadoEnvio?.messageId || resultadoEnvio?.id || null;
        await base44.asServiceRole.entities.WhatsappMensagem.create({
          message_id: zapiId || null,
          cliente_id: cliente.id,
          cliente_nome: cliente.nome,
          grupo_id: grupoId,
          grupo_nome: cliente.whatsapp_grupo_nome || null,
          is_group: true,
          remetente_nome: user.full_name || user.email,
          remetente_tipo: 'voxx',
          origem: 'enviada',
          mensagem,
          tipo_mensagem: tipoEnvioFinal === 'imagem' ? 'imagem' : 'texto',
          midia_url: tipoEnvioFinal === 'imagem' ? (midia_url || null) : null,
          received_at: agora,
          from_me: true,
          status_entrega: 'enviado',
          status_processamento: 'ok',
        });
      } catch (e) {
        console.error('Erro ao salvar WhatsappMensagem:', e.message);
      }
    }

    // Registrar no histórico da demanda (TimelineEvent)
    if (entrega.demanda_id && statusEnvio === 'enviado') {
      await base44.asServiceRole.entities.TimelineEvent.create({
        demanda_id: entrega.demanda_id,
        cliente_id: cliente.id,
        tipo: 'comentario',
        descricao: `📲 Material enviado para aprovação via WhatsApp.\nEntrega: ${entrega.nome_entrega}\nLink: ${entrega.link_publico_aprovacao}\nEnviado por: ${user.full_name || user.email}`,
        autor: user.full_name || user.email,
        autor_id: user.id
      }).catch(() => null);

      // Atualizar status da entrega para em_aprovacao
      await base44.asServiceRole.entities.EntregaDemanda.update(entrega.id, {
        status_entrega: 'em_aprovacao',
        retorno_cliente_tratado: true
      }).catch(() => null);

      // Limpar notificações de aprovação pendentes (nova versão enviada)
      await base44.asServiceRole.entities.NotificacaoAprovacao.updateMany(
        { entrega_id: entrega.id, lida: false },
        { $set: { lida: true, visualizada_em: agora } }
      ).catch(() => null);
      }

    return Response.json({
      success: statusEnvio === 'enviado',
      status_envio: statusEnvio,
      registro_id: registro.id,
      erro: erroEnvio || null,
      resultado_api: resultadoEnvio
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});