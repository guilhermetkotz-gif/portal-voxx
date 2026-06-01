import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ZAPI_BASE = 'https://api.z-api.io';

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

    let resultadoEnvio = null;
    let statusEnvio = 'enviado';
    let erroEnvio = null;
    let tipoEnvioFinal = tipo_midia;

    const endpointLovable = Deno.env.get('ENDPOINT_LOVABLE_ENVIO');
    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const zapiToken = Deno.env.get('ZAPI_TOKEN');
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

    const payloadLovable = {
      tipo: 'envio_aprovacao',
      cliente_id: cliente.id,
      demanda_id: entrega.demanda_id || null,
      entrega_id: entrega.id,
      grupo_whatsapp_id: grupoId,
      mensagem,
      link_aprovacao: entrega.link_publico_aprovacao,
      midia_url: midia_url || null,
      tipo_midia
    };

    // ROTA 1: Lovable como intermediário
    if (endpointLovable) {
      tipoEnvioFinal = 'lovable';
      const resp = await fetch(endpointLovable, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadLovable)
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        statusEnvio = 'erro';
        erroEnvio = `Lovable HTTP ${resp.status}: ${errText}`;
      } else {
        resultadoEnvio = await resp.json().catch(() => ({}));
      }
    }
    // ROTA 2: Z-API direto
    else if (zapiInstanceId && zapiToken && zapiClientToken) {
      // Verificar status da instância
      const statusResp = await fetch(
        `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/status`,
        { headers: { 'Client-Token': zapiClientToken } }
      );
      const statusData = await statusResp.json().catch(() => ({}));
      if (!statusData.connected || !statusData.smartphoneConnected) {
        return Response.json({
          error: 'Instância Z-API desconectada. Verifique o WhatsApp vinculado.',
          zapi_status: statusData
        }, { status: 503 });
      }

      // Decidir endpoint: imagem ou texto
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
    } else {
      // Sem API configurada: salvar como rascunho apenas (para teste de fluxo)
      statusEnvio = 'rascunho';
      erroEnvio = 'Nenhuma API de envio configurada (ZAPI ou Lovable). Configure os secrets.';
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
      payload_enviado: payloadLovable,
      link_aprovacao: entrega.link_publico_aprovacao
    });

    // Registrar no histórico da demanda (TimelineEvent)
    if (entrega.demanda_id && statusEnvio === 'enviado') {
      await base44.asServiceRole.entities.TimelineEvent.create({
        demanda_id: entrega.demanda_id,
        tipo: 'comentario',
        descricao: `📲 Material enviado para aprovação via WhatsApp.\nEntrega: ${entrega.nome_entrega}\nLink: ${entrega.link_publico_aprovacao}\nEnviado por: ${user.full_name || user.email}`,
        autor: user.full_name || user.email,
        autor_id: user.id
      }).catch(() => null);

      // Atualizar status da entrega para em_aprovacao
      await base44.asServiceRole.entities.EntregaDemanda.update(entrega.id, {
        status_entrega: 'em_aprovacao'
      }).catch(() => null);
    }

    return Response.json({
      success: statusEnvio === 'enviado' || statusEnvio === 'rascunho',
      status_envio: statusEnvio,
      registro_id: registro.id,
      erro: erroEnvio || null,
      resultado_api: resultadoEnvio
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});