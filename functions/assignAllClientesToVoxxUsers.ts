import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Apenas admins podem executar essa operação
        if (user.role !== 'admin' && user.tipo_acesso !== 'voxx_admin') {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Buscar todos os clientes
        const clientes = await base44.entities.Cliente.list('-created_date', 1000);
        
        // Buscar todos os usuários Voxx
        const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);
        const voxxUsers = allUsers.filter(u => 
            u.tipo_acesso === 'voxx_admin' || 
            u.tipo_acesso === 'voxx_operacao' ||
            u.role === 'admin'
        );

        let created = 0;
        let skipped = 0;

        // Para cada cliente, criar acesso para cada usuário Voxx
        for (const cliente of clientes) {
            for (const voxxUser of voxxUsers) {
                // Verificar se já existe acesso
                const existing = await base44.entities.UserClientAccess.filter({
                    usuario_id: voxxUser.id,
                    cliente_id: cliente.id,
                    status: 'ativo'
                });

                if (existing.length === 0) {
                    // Criar novo acesso
                    await base44.entities.UserClientAccess.create({
                        usuario_id: voxxUser.id,
                        usuario_email: voxxUser.email,
                        cliente_id: cliente.id,
                        cliente_nome: cliente.nome,
                        nivel_acesso: 'editor',
                        status: 'ativo',
                        data_atribuicao: new Date().toISOString(),
                        atribuido_por_usuario_id: user.id,
                        atribuido_por_nome: user.full_name
                    });
                    created++;
                } else {
                    skipped++;
                }
            }
        }

        return Response.json({ 
            success: true, 
            message: `Processamento concluído`,
            total_clientes: clientes.length,
            total_voxx_users: voxxUsers.length,
            acessos_criados: created,
            acessos_existentes: skipped
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});