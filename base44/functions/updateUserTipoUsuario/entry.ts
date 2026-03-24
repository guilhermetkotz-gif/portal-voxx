import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin' && user?.tipo_usuario !== 'voxx_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { usuario_id, tipo_usuario, cliente_id, tipo_acesso } = await req.json();

    if (!usuario_id || !tipo_usuario) {
      return Response.json({ error: 'usuario_id e tipo_usuario são obrigatórios' }, { status: 400 });
    }

    const updateData = { tipo_usuario };
    if (cliente_id !== undefined) updateData.cliente_id = cliente_id;
    if (tipo_acesso !== undefined) updateData.tipo_acesso = tipo_acesso;

    // Update using service role to ensure the data field is saved correctly
    await base44.asServiceRole.entities.User.update(usuario_id, updateData);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});