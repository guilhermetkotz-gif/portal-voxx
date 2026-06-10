import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ZAPI_BASE = 'https://api.z-api.io';

const DEFAULT_MENSAGENS = [
  'Olá {{cliente}}! 👋\n\nPassando para lembrar que enviamos a entrega *"{{entrega}}"* para sua aprovação.\n\n📎 Link para aprovar: {{link}}\n\nQualquer dúvida, estamos à disposição!',
  '*{{cliente}}*, tudo bem?\n\nAinda não recebemos sua aprovação para a entrega *"{{entrega}}"*.\n\nSabemos que a rotina é corrida, mas sua aprovação é importante para darmos continuidade ao projeto.\n\n📎 Aprove aqui: {{link}}\n\nPrecisa de algum ajuste? É só nos avisar!',
];

function formatarMensagem(template, clienteNome, entregaNome, link) {
  return template
    .replace(/\{\{cliente\}\}/g, clienteNome)
    .replace(/\{\{entrega\}\}/g, entregaNome)
    .replace(/\{\{link\}\}/g, link);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { envio_id } = body;
    if (!envio_id) return Response.json({ error: 'envio_id obrigatório' }, { status: 400 });

    const sdk = base44.asServiceRole;
    const agora = new Date().toISOString();

    // Buscar o envio de aprovação
    const envios = await sdk.entities.EnvioAprovacaoWhatsApp.filter({ id: envio_id }, '-enviado_em', 1);
    const envio = envios[0];
    if (!envio) return Response.json({ error: 'Envio não encontrado' }, { status: 404 });

    const clienteNome = envio.cliente_nome || 'Cliente';
    const entregaNome = envio.entrega_nome || 'entrega';
    const link = envio.link_aprovacao || '';

    // Buscar configuração de lembretes
    const configs = await sdk.entities.ConfiguracaoLembreteAprovacao.list('-created_date', 1).catch(() => []);
    const cfg = configs[0];
    const templates = (cfg?.mensagens_lembrete?.length > 0) ? cfg.mensagens_lembrete : DEFAULT_MENSAGENS;

    // Buscar ou criar TarefaAcompanhamento
    const tarefasExistentes = await sdk.entities.TarefaAcompanhamento.filter(
      { envio_aprovacao_id: envio.id }, '-created_date', 1
    );
    let tarefa = tarefasExistentes[0] || null;
    let seq;

    if (!tarefa) {
      seq = 1;
      const template = templates[0] || DEFAULT_MENSAGENS[0];
      const mensagem = formatarMensagem(template, clienteNome, entregaNome, link);

      const creds = await getZapiCredentials(base44);
      const enviado = await enviarWhatsApp(base44, envio.whatsapp_grupo_id, mensagem, creds);

      tarefa = await sdk.entities.TarefaAcompanhamento.create({
        cliente_id: envio.cliente_id,
        cliente_nome: envio.cliente_nome,
        entrega_id: envio.entrega_id,
        entrega_nome: envio.entrega_nome,
        demanda_id: envio.demanda_id || null,
        demanda_titulo: envio.demanda_titulo || null,
        envio_aprovacao_id: envio.id,
        whatsapp_grupo_id: envio.whatsapp_grupo_id,
        sequencia_lembrete: seq,
        status: 'pendente',
        data_ultimo_lembrete: agora,
        mensagem_enviada: mensagem,
        link_aprovacao: link,
      });

      await sdk.entities.WhatsappEnvioLog.create({
        cliente_id: envio.cliente_id,
        cliente_nome: envio.cliente_nome,
        grupo_id: envio.whatsapp_grupo_id,
        tipo_envio: 'texto',
        origem: 'aprovacao_entrega',
        origem_id: envio.id,
        mensagem,
        status_envio: enviado ? 'enviado' : 'erro',
        enviado_por: user.email || 'manual',
        enviado_em: agora,
      });

      return Response.json({ success: true, sequencia: seq, enviado });
    }

    // Já existe tarefa — avançar sequência
    seq = tarefa.sequencia_lembrete + 1;
    const idxTemplate = Math.min(seq - 1, templates.length - 1);
    const template = templates[idxTemplate] || DEFAULT_MENSAGENS[Math.min(idxTemplate, DEFAULT_MENSAGENS.length - 1)];
    const mensagem = formatarMensagem(template, clienteNome, entregaNome, link);

    const creds = await getZapiCredentials(base44);
    const enviado = await enviarWhatsApp(base44, envio.whatsapp_grupo_id, mensagem, creds);

    await sdk.entities.TarefaAcompanhamento.update(tarefa.id, {
      sequencia_lembrete: seq,
      status: 'pendente',
      data_ultimo_lembrete: agora,
      mensagem_enviada: mensagem,
    });

    await sdk.entities.WhatsappEnvioLog.create({
      cliente_id: envio.cliente_id,
      cliente_nome: envio.cliente_nome,
      grupo_id: envio.whatsapp_grupo_id,
      tipo_envio: 'texto',
      origem: 'aprovacao_entrega',
      origem_id: envio.id,
      mensagem,
      status_envio: enviado ? 'enviado' : 'erro',
      enviado_por: user.email || 'manual',
      enviado_em: agora,
    });

    return Response.json({ success: true, sequencia: seq, enviado });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function getZapiCredentials(base44) {
  const configs = await base44.asServiceRole.entities.ConfiguracaoZapi.list('-created_date', 1).catch(() => []);
  const entityConfig = configs?.[0];
  return {
    zapiInstanceId: entityConfig?.instance_id || Deno.env.get('ZAPI_INSTANCE_ID'),
    zapiToken: entityConfig?.token_instancia || Deno.env.get('ZAPI_TOKEN'),
    zapiClientToken: entityConfig?.token_global || Deno.env.get('ZAPI_CLIENT_TOKEN'),
  };
}

async function enviarWhatsApp(base44, grupoId, mensagem, zapiCreds) {
  const endpointLovable = Deno.env.get('ENDPOINT_LOVABLE_ENVIO');
  const { zapiInstanceId, zapiToken, zapiClientToken } = zapiCreds;

  if (endpointLovable) {
    const resp = await fetch(endpointLovable, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'envio_aprovacao', grupo_whatsapp_id: grupoId, mensagem, tipo_midia: 'texto' })
    });
    return resp.ok;
  }

  if (zapiInstanceId && zapiToken && zapiClientToken) {
    const statusResp = await fetch(`${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/status`, {
      headers: { 'Client-Token': zapiClientToken }
    });
    const statusData = await statusResp.json().catch(() => ({}));
    if (!statusData.connected) return false;

    const sendResp = await fetch(`${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/send-text`, {
      method: 'POST',
      headers: { 'Client-Token': zapiClientToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: grupoId, message: mensagem })
    });
    return sendResp.ok;
  }
  return false;
}