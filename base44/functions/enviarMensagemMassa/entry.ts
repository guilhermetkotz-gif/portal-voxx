import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ZAPI_BASE = 'https://api.z-api.io';

// Palavras-chave que indicam erro de assinatura/instância (falha全局, não por grupo)
const SUBSCRIPTION_ERROR_KEYWORDS = [
  'subscribe to this instance',
  'instance not found',
  'invalid token',
  'unauthorized',
  'plano',
  'assinatura',
];

function isSubscriptionError(erroMsg) {
  if (!erroMsg) return false;
  const lower = String(erroMsg).toLowerCase();
  return SUBSCRIPTION_ERROR_KEYWORDS.some(kw => lower.includes(kw));
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
    const { grupoIds = [], mensagem = '' } = body;

    if (!Array.isArray(grupoIds) || grupoIds.length === 0) {
      return Response.json({ error: 'grupoIds (array) é obrigatório' }, { status: 400 });
    }
    if (!mensagem?.trim()) {
      return Response.json({ error: 'mensagem é obrigatória' }, { status: 400 });
    }

    // ── Pré-verificação: checar status da instância Z-API antes de iniciar ──
    const { zapiInstanceId, zapiToken, zapiClientToken } = await getZapiCredentials(base44);
    if (!zapiInstanceId || !zapiToken || !zapiClientToken) {
      return Response.json({
        error: 'Z-API não configurada. Configure os secrets ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN.',
      }, { status: 503 });
    }

    let instanciaOnline = true;
    let erroInstancia = null;
    try {
      const statusResp = await fetch(
        `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/status`,
        { headers: { 'Client-Token': zapiClientToken } }
      );
      const statusData = await statusResp.json().catch(() => ({}));
      if (!statusData.connected || !statusData.smartphoneConnected) {
        instanciaOnline = false;
        erroInstancia = 'Instância Z-API desconectada. Abra o WhatsApp vinculado e escaneie o QR code novamente.';
      }
    } catch (e) {
      // Se não conseguir verificar status, segue tentando o envio
    }

    if (!instanciaOnline) {
      return Response.json({
        error: erroInstancia,
        total: grupoIds.length,
        enviados: 0,
        erros: grupoIds.length,
        resultados: [],
      }, { status: 503 });
    }

    const resultados = [];
    let enviados = 0;
    let erros = 0;
    let pararPorAssinatura = false;
    let erroAssinaturaMsg = null;

    for (const chatId of grupoIds) {
      // Se detectou erro de assinatura, interrompe o loop
      if (pararPorAssinatura) {
        resultados.push({
          chatId,
          success: false,
          status_envio: 'erro',
          erro: 'Envio interrompido — assinatura Z-API expirada',
        });
        erros++;
        continue;
      }

      try {
        const res = await base44.functions.invoke('enviarMensagemGeral', {
          chatId,
          mensagem,
          tipo: 'texto',
          incluirAssinatura: true,
        });

        const success = res?.data?.success === true;
        const erroMsg = res?.data?.erro || null;

        if (success) {
          enviados++;
        } else {
          erros++;
          // Detecta erro de assinatura para interromper cedo
          if (isSubscriptionError(erroMsg)) {
            pararPorAssinatura = true;
            erroAssinaturaMsg = erroMsg;
          }
        }
        resultados.push({
          chatId,
          success,
          status_envio: res?.data?.status_envio || 'erro',
          erro: erroMsg,
        });
      } catch (e) {
        erros++;
        if (isSubscriptionError(e.message)) {
          pararPorAssinatura = true;
          erroAssinaturaMsg = e.message;
        }
        resultados.push({ chatId, success: false, error: e.message });
      }

      // Delay de 1.5s entre envios para evitar rate limit da Z-API
      if (grupoIds.length > 1 && !pararPorAssinatura) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    return Response.json({
      total: grupoIds.length,
      enviados,
      erros,
      resultados,
      erro_assinatura: erroAssinaturaMsg,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});