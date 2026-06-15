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

    // ── GET GROUP METADATA ──
    if (acao === 'info') {
      const resp = await fetch(
        `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/group-metadata/${encodeURIComponent(grupoId)}`,
        { method: 'GET', headers }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return Response.json({ error: `Z-API HTTP ${resp.status}`, details: data }, { status: 502 });
      }
      return Response.json({
        success: true,
        group: {
          id: data.phone || grupoId,
          subject: data.subject || '',
          description: data.description || '',
          owner: data.owner || null,
          creation: data.creation || null,
          invitationLink: data.invitationLink || null,
          adminOnlyMessage: data.adminOnlyMessage || false,
          adminOnlySettings: data.adminOnlySettings || false,
          requireAdminApproval: data.requireAdminApproval || false,
          isGroupAnnouncement: data.isGroupAnnouncement || false,
          participants: (data.participants || []).map(p => ({
            phone: p.phone || '',
            name: p.name || p.short || '',
            isAdmin: p.isAdmin || false,
            isSuperAdmin: p.isSuperAdmin || false,
          })),
          totalParticipants: (data.participants || []).length,
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
          method: 'POST',
          headers,
          body: JSON.stringify({ groupId: grupoId, groupDescription: descricao }),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return Response.json({ error: `Z-API HTTP ${resp.status}`, details: data }, { status: 502 });
      }
      return Response.json({ success: true, result: data });
    }

    // ── UPDATE SUBJECT ──
    if (acao === 'atualizarAssunto') {
      const { assunto } = body;
      if (!assunto) return Response.json({ error: 'assunto é obrigatório' }, { status: 400 });

      const resp = await fetch(
        `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/update-group-subject`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ groupId: grupoId, subject: assunto }),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return Response.json({ error: `Z-API HTTP ${resp.status}`, details: data }, { status: 502 });
      }
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
          body: JSON.stringify({ autoInvite: true, groupId: grupoId, phones: [telefone] }),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return Response.json({ error: `Z-API HTTP ${resp.status}`, details: data }, { status: 502 });
      }
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
          body: JSON.stringify({ groupId: grupoId, phones: [telefone] }),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return Response.json({ error: `Z-API HTTP ${resp.status}`, details: data }, { status: 502 });
      }
      return Response.json({ success: true, result: data });
    }

    // ── LEAVE GROUP ──
    if (acao === 'sairGrupo') {
      const resp = await fetch(
        `${ZAPI_BASE}/instances/${zapiInstanceId}/token/${zapiToken}/leave-group`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ groupId: grupoId }),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return Response.json({ error: `Z-API HTTP ${resp.status}`, details: data }, { status: 502 });
      }
      return Response.json({ success: true, result: data });
    }

    return Response.json({ error: `Ação "${acao}" não suportada` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});