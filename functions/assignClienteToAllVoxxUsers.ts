import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { cliente_id } = await req.json();

        if (!cliente_id) {
            return Response.json({ error: 'cliente_id is required' }, { status: 400 });
        }

        // Buscar cliente
        const cliente = await base44.entities.Cliente.get(cliente_id);
        if (!cliente) {
            return Response.json({ error: 'Cliente not found' }, { status: 404 });
        }

        // Buscar todos os usuários Voxx
        const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);
        const voxxUsers = allUsers.filter(u => 
            u.tipo_acesso === 'voxx_admin' || 
            u.tipo_acesso === 'voxx_operacao' ||
            u.role === 'admin'
        );

        // Criar acesso para cada usuário Voxx (se ainda não existir)
        const created = [];
        for (const voxxUser of voxxUsers) {
            // Verificar se já existe acesso
            const existing = await base44.entities.UserClientAccess.filter({
                usuario_id: voxxUser.id,
                cliente_id: cliente_id,
                status: 'ativo'
            });

            if (existing.length === 0) {
                // Criar novo acesso
                await base44.entities.UserClientAccess.create({
                    usuario_id: voxxUser.id,
                    usuario_email: voxxUser.email,
                    cliente_id: cliente_id,
                    cliente_nome: cliente.nome,
                    nivel_acesso: 'editor',
                    status: 'ativo',
                    data_atribuicao: new Date().toISOString(),
                    atribuido_por_usuario_id: user.id,
                    atribuido_por_nome: user.full_name
                });
                created.push(voxxUser.email);
            }
        }

        return Response.json({ 
            success: true, 
            message: `Cliente atribuído a ${created.length} usuários Voxx`,
            created_for: created
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});