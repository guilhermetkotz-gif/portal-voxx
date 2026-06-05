import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ZAPI_BASE = 'https://api.z-api.io';

async function getZapiCredentials(base44) {
  // Try entity config first
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

    const { zapiInstanceId, zapiToken, zapiClientToken } = await getZapiCredentials(base44);

    if (!zapiInstanceId || !zapiToken || !zapiClientToken) {
      return Response.json({
        configurado: false,
        mensagem: 'Configure as credenciais Z-API na seção "Credenciais Z-API" acima ou via secrets no Dashboard (ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN).'
      });
    }

    const headers = { 'Client-Token': zapiClientToken };

    const statusResp = await fetch(
      `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/status`,
      { headers }
    );
    const statusData = await statusResp.json().catch(() => ({}));

    let deviceData = null;
    try {
      const deviceResp = await fetch(
        `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/device-info`,
        { headers }
      );
      if (deviceResp.ok) {
        deviceData = await deviceResp.json().catch(() => null);
      }
    } catch {}

    return Response.json({
      configurado: true,
      instance_id: zapiInstanceId,
      connected: statusData.connected || false,
      smartphoneConnected: statusData.smartphoneConnected || false,
      error: statusData.error || null,
      status_raw: statusData,
      device: deviceData,
      verificado_em: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});