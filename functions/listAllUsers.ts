import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Apenas admins e voxx_admin podem listar todos os usuários
        const tipoUsuario = user.tipo_usuario || user.tipo_acesso;
        if (user.role !== 'admin' && tipoUsuario !== 'voxx_admin' && tipoUsuario !== 'voxx_manager') {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Usar service role para listar todos os usuários (limitado a 200 para evitar timeout)
        const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 200);

        return Response.json({ users: allUsers });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});