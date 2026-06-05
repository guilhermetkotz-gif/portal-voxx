import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ZAPI_BASE = 'https://api.z-api.io';

async function getZapiCredentials(base44) {
  const configs = await base44.asServiceRole.entities.ConfiguracaoZapi.list('-created_date', 1).catch(() => []);
  const entityConfig = configs?.[0];

  const zapiInstanceId = entityConfig?.instance_id || Deno.env.get('ZAPI_INSTANCE_ID');
  const zapiToken = entityConfig?.token_instancia || Deno.env.get('ZAPI_TOKEN');
  const zapiClientToken = entityConfig?.token_global || Deno.env.get('ZAPI_CLIENT_TOKEN');

  return { zapiInstanceId, zapiToken, zapiClientToken };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { resumo_id, mensagem } = body;

    if (!resumo_id) {
      return Response.json({ error: 'resumo_id é obrigatório' }, { status: 400 });
    }

    const resumos = await base44.asServiceRole.entities.ResumoDiarioCliente.filter({ id: resumo_id }, '-created_date', 1);
    const resumo = resumos[0];
    if (!resumo) return Response.json({ error: 'Resumo não encontrado' }, { status: 404 });

    const clienteList = await base44.asServiceRole.entities.Cliente.filter({ id: resumo.cliente_id }, '-created_date', 1);
    const cliente = clienteList[0];
    if (!cliente?.whatsapp_grupo_id) {
      return Response.json({ error: 'Cliente não possui whatsapp_grupo_id configurado. Vincule um grupo na página WhatsApp Clientes.' }, { status: 400 });
    }

    const mensagemFinal = mensagem || resumo.mensagem_editada || resumo.mensagem_gerada;
    if (!mensagemFinal?.trim()) {
      return Response.json({ error: 'Mensagem vazia' }, { status: 400 });
    }

    const { zapiInstanceId, zapiToken, zapiClientToken } = await getZapiCredentials(base44);
    const endpointLovable = Deno.env.get('ENDPOINT_LOVABLE_ENVIO');

    if (!zapiInstanceId && !endpointLovable) {
      return Response.json({ error: 'Nenhuma API configurada. Configure as credenciais Z-API na página WhatsApp Clientes.' }, { status: 503 });
    }

    const agora = new Date().toISOString();
    let resultadoApi = null;
    let statusEnvio = 'enviado';
    let erroEnvio = null;

    if (endpointLovable) {
      const resp = await fetch(endpointLovable, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'resumo_diario',
          cliente_id: cliente.id,
          resumo_id: resumo.id,
          grupo_whatsapp_id: cliente.whatsapp_grupo_id,
          mensagem: mensagemFinal,
          tipo_midia: 'texto'
        })
      });
      if (!resp.ok) {
        statusEnvio = 'erro';
        erroEnvio = `Lovable HTTP ${resp.status}: ${await resp.text().catch(() => '')}`;
      } else {
        resultadoApi = await resp.json().catch(() => ({}));
      }
    } else {
      const statusResp = await fetch(
        `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/status`,
        { headers: { 'Client-Token': zapiClientToken } }
      );
      const statusData = await statusResp.json().catch(() => ({}));
      if (!statusData.connected || !statusData.smartphoneConnected) {
        return Response.json({
          error: 'Instância Z-API desconectada. Verifique o WhatsApp vinculado na página WhatsApp Clientes.',
          zapi_status: statusData
        }, { status: 503 });
      }

      const sendResp = await fetch(
        `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
        {
          method: 'POST',
          headers: { 'Client-Token': zapiClientToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cliente.whatsapp_grupo_id, message: mensagemFinal })
        }
      );
      if (!sendResp.ok) {
        statusEnvio = 'erro';
        erroEnvio = `Z-API HTTP ${sendResp.status}: ${await sendResp.text().catch(() => '')}`;
      } else {
        resultadoApi = await sendResp.json().catch(() => ({}));
      }
    }

    await base44.asServiceRole.entities.WhatsappEnvioLog.create({
      cliente_id: cliente.id,
      cliente_nome: cliente.nome,
      grupo_id: cliente.whatsapp_grupo_id,
      grupo_nome: cliente.whatsapp_grupo_nome || '',
      tipo_envio: 'texto',
      origem: 'resumo_diario',
      origem_id: resumo.id,
      mensagem: mensagemFinal,
      status_envio: statusEnvio,
      retorno_zapi: resultadoApi ? JSON.stringify(resultadoApi) : null,
      erro: erroEnvio || null,
      enviado_por: user.email,
      enviado_em: agora
    });

    if (statusEnvio === 'enviado') {
      await base44.asServiceRole.entities.ResumoDiarioCliente.update(resumo.id, {
        status_envio: 'enviado'
      }).catch(() => null);
    }

    return Response.json({
      success: statusEnvio === 'enviado',
      status_envio: statusEnvio,
      erro: erroEnvio,
      resultado_api: resultadoApi
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});