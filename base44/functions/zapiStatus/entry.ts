import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ZAPI_BASE = 'https://api.z-api.io';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const zapiToken = Deno.env.get('ZAPI_TOKEN');
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!zapiInstanceId || !zapiToken || !zapiClientToken) {
      return Response.json({
        configurado: false,
        mensagem: 'Configure os secrets ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN no dashboard (Code → Functions → Settings).'
      });
    }

    const headers = { 'Client-Token': zapiClientToken };

    // Check instance status
    const statusResp = await fetch(
      `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/status`,
      { headers }
    );
    const statusData = await statusResp.json().catch(() => ({}));

    // Try device info
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