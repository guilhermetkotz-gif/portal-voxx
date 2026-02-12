import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Apenas admins e voxx_admin podem listar todos os usuários
        if (user.role !== 'admin' && user.tipo_acesso !== 'voxx_admin' && user.tipo_acesso !== 'voxx_manager') {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Usar service role para listar todos os usuários
        const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);

        return Response.json({ users: allUsers });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});