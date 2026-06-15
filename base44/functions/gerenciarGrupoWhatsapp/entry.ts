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
      const rawParticipants = (data.participants || []).map(p => ({
        phone: p.phone || '',
        name: p.name || p.short || '',
        isAdmin: p.isAdmin || false,
        isSuperAdmin: p.isSuperAdmin || false,
      }));

      // Cross-reference: look up names from our database for participants without names
      const phonesSemNome = rawParticipants.filter(p => !p.name).map(p => p.phone);
      if (phonesSemNome.length > 0) {
        // 1) Look up names from WhatsappMensagem for this group
        const msgsWithNames = await base44.asServiceRole.entities.WhatsappMensagem.filter(
          { grupo_id: grupoId, remetente_telefone: { $in: phonesSemNome }, remetente_nome: { $ne: '' } },
          '-received_at',
          200
        ).catch(() => []);

        const nomePorTelefone = {};
        for (const m of (msgsWithNames || [])) {
          const tel = (m.remetente_telefone || '').replace(/\D/g, '');
          if (tel && m.remetente_nome && !nomePorTelefone[tel]) {
            nomePorTelefone[tel] = m.remetente_nome;
          }
        }

        // 2) Look up names from WhatsappRemetenteVoxx for still-unnamed
        const stillUnnamed = phonesSemNome.filter(p => !nomePorTelefone[p.replace(/\D/g, '')]);
        if (stillUnnamed.length > 0) {
          const remetentes = await base44.asServiceRole.entities.WhatsappRemetenteVoxx.list('-created_date', 500).catch(() => []);
          for (const r of (remetentes || [])) {
            const telNorm = (r.telefone_normalizado || r.telefone || '').replace(/\D/g, '');
            if (telNorm && stillUnnamed.includes(telNorm) && !nomePorTelefone[telNorm]) {
              nomePorTelefone[telNorm] = r.nome;
            }
          }
        }

        // Apply names to participants
        for (const p of rawParticipants) {
          if (!p.name) {
            const telNorm = p.phone.replace(/\D/g, '');
            if (nomePorTelefone[telNorm]) {
              p.name = nomePorTelefone[telNorm];
            }
          }
        }
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
          participants: rawParticipants,
          totalParticipants: rawParticipants.length,
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