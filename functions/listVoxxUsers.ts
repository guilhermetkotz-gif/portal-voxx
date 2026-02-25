import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Apenas voxx pode listar usuários voxx
        const tipoAcesso = user.tipo_acesso || user.tipo_usuario;
        if (user.role !== 'admin' && !tipoAcesso?.startsWith('voxx_')) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Usar service role para listar todos os usuários
        const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);
        
        console.log('📊 Total de usuários no sistema:', allUsers.length);
        console.log('📊 Exemplo de usuário:', allUsers[0]);
        
        // Filtrar apenas usuários voxx (tipo_acesso ou tipo_usuario)
        const voxxUsers = allUsers.filter(u => {
            const tipoAcesso = u.tipo_acesso || u.tipo_usuario;
            const isVoxx = tipoAcesso?.startsWith('voxx_') || u.role === 'admin';
            if (isVoxx) {
                console.log('✅ Usuário Voxx encontrado:', { id: u.id, email: u.email, full_name: u.full_name, tipo_acesso: tipoAcesso, role: u.role });
            }
            return isVoxx;
        });

        console.log('📊 Total de usuários Voxx:', voxxUsers.length);
        
        return Response.json({ users: voxxUsers });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});