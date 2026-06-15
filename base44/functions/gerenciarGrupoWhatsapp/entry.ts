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
    const { acao, grupoId } = body;

    if (!grupoId) return Response.json({ error: 'grupoId é obrigatório' }, { status: 400 });
    if (!acao) return Response.json({ error: 'acao é obrigatória' }, { status: 400 });

    const { zapiInstanceId, zapiToken, zapiClientToken } = await getZapiCredentials(base44);
    if (!zapiInstanceId) return Response.json({ error: 'Z-API não configurada' }, { status: 503 });

    const headers = { 'Client-Token': zapiClientToken, 'Content-Type': 'application/json' };

    // ── GET GROUP INFO ──
    if (acao === 'info') {
      const resp = await fetch(
        `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/group/${encodeURIComponent(grupoId)}`,
        { method: 'GET', headers }
      );
      if (!resp.ok) {
        return Response.json({ error: `Z-API HTTP ${resp.status}`, details: await resp.text().catch(() => '') }, { status: 502 });
      }
      const data = await resp.json().catch(() => ({}));
      return Response.json({
        success: true,
        group: {
          id: data.id || grupoId,
          subject: data.subject || '',
          description: data.description || '',
          owner: data.owner || null,
          participants: (data.participants || []).map(p => ({
            phone: p.phone || p.id || '',
            name: p.name || p.pushName || p.short || '',
            isAdmin: p.isAdmin || p.isSuperAdmin || false,
            isSuperAdmin: p.isSuperAdmin || false,
          })),
          totalParticipants: (data.participants || []).length,
          creation: data.creation || null,
        },
      });
    }

    // ── UPDATE DESCRIPTION ──
    if (acao === 'atualizarDescricao') {
      const { descricao } = body;
      if (!descricao && descricao !== '') return Response.json({ error: 'descricao é obrigatória' }, { status: 400 });

      const resp = await fetch(
        `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/update-group-description`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({ phone: grupoId, description: descricao }),
        }
      );
      if (!resp.ok) {
        return Response.json({ error: `Z-API HTTP ${resp.status}`, details: await resp.text().catch(() => '') }, { status: 502 });
      }
      const data = await resp.json().catch(() => ({}));
      return Response.json({ success: true, result: data });
    }

    // ── UPDATE SUBJECT ──
    if (acao === 'atualizarAssunto') {
      const { assunto } = body;
      if (!assunto) return Response.json({ error: 'assunto é obrigatório' }, { status: 400 });

      const resp = await fetch(
        `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/update-group-subject`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({ phone: grupoId, subject: assunto }),
        }
      );
      if (!resp.ok) {
        return Response.json({ error: `Z-API HTTP ${resp.status}`, details: await resp.text().catch(() => '') }, { status: 502 });
      }
      const data = await resp.json().catch(() => ({}));
      return Response.json({ success: true, result: data });
    }

    // ── ADD PARTICIPANT ──
    if (acao === 'adicionarMembro') {
      const { telefone } = body;
      if (!telefone) return Response.json({ error: 'telefone é obrigatório' }, { status: 400 });

      const resp = await fetch(
        `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/add-participant`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: grupoId, participant: telefone }),
        }
      );
      if (!resp.ok) {
        return Response.json({ error: `Z-API HTTP ${resp.status}`, details: await resp.text().catch(() => '') }, { status: 502 });
      }
      const data = await resp.json().catch(() => ({}));
      return Response.json({ success: true, result: data });
    }

    // ── REMOVE PARTICIPANT ──
    if (acao === 'removerMembro') {
      const { telefone } = body;
      if (!telefone) return Response.json({ error: 'telefone é obrigatório' }, { status: 400 });

      const resp = await fetch(
        `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/remove-participant`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: grupoId, participant: telefone }),
        }
      );
      if (!resp.ok) {
        return Response.json({ error: `Z-API HTTP ${resp.status}`, details: await resp.text().catch(() => '') }, { status: 502 });
      }
      const data = await resp.json().catch(() => ({}));
      return Response.json({ success: true, result: data });
    }

    // ── LEAVE GROUP ──
    if (acao === 'sairGrupo') {
      const resp = await fetch(
        `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/leave-group`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: grupoId }),
        }
      );
      if (!resp.ok) {
        return Response.json({ error: `Z-API HTTP ${resp.status}`, details: await resp.text().catch(() => '') }, { status: 502 });
      }
      const data = await resp.json().catch(() => ({}));
      return Response.json({ success: true, result: data });
    }

    return Response.json({ error: `Ação "${acao}" não suportada` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});