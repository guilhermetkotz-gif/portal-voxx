import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user?.role !== 'admin' && user?.tipo_usuario !== 'voxx_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { usuario_id, full_name } = await req.json();

    if (!usuario_id || !full_name || !full_name.trim()) {
      return Response.json({ error: 'usuario_id e full_name são obrigatórios' }, { status: 400 });
    }

    await base44.asServiceRole.entities.User.update(usuario_id, { full_name: full_name.trim() });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});