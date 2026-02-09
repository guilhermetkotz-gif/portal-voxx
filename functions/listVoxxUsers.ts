import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Apenas voxx pode listar usuários voxx
        if (user.role !== 'admin' && !user.tipo_usuario?.startsWith('voxx_')) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Usar service role para listar todos os usuários
        const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);
        
        // Filtrar apenas usuários voxx
        const voxxUsers = allUsers.filter(u => 
            u.tipo_usuario?.startsWith('voxx_') || u.role === 'admin'
        );

        return Response.json({ users: voxxUsers });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});