import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Buscar todos os usuários
        const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);
        
        // Filtrar usuários Voxx
        const voxxUsers = allUsers.filter(u => 
            u.tipo_usuario === 'voxx_admin' || 
            u.tipo_usuario === 'voxx_operacao' ||
            u.tipo_usuario === 'voxx_manager' ||
            u.tipo_acesso === 'voxx_admin' ||
            u.tipo_acesso === 'voxx_operacao' ||
            u.tipo_acesso === 'voxx_manager' ||
            u.role === 'admin'
        );

        // Buscar todos os clientes
        const clientes = await base44.asServiceRole.entities.Cliente.list('-created_date', 500);

        const results = [];

        for (const user of voxxUsers) {
            const tipoUsuario = user.tipo_usuario || user.tipo_acesso || 'voxx_operacao';
            
            // Corrigir tipo_acesso se necessário
            if (user.tipo_acesso !== tipoUsuario || user.tipo_usuario) {
                await base44.asServiceRole.entities.User.update(user.id, {
                    tipo_acesso: tipoUsuario === 'voxx_manager' ? 'voxx_operacao' : tipoUsuario
                });
            }

            // Buscar acessos existentes
            const access = await base44.asServiceRole.entities.UserClientAccess.filter({
                usuario_id: user.id,
                status: 'ativo'
            });

            const existingClienteIds = access.map(a => a.cliente_id);
            const accessToCreate = [];

            for (const cliente of clientes) {
                if (!existingClienteIds.includes(cliente.id)) {
                    accessToCreate.push({
                        usuario_id: user.id,
                        usuario_email: user.email,
                        cliente_id: cliente.id,
                        cliente_nome: cliente.nome,
                        nivel_acesso: 'editor',
                        status: 'ativo',
                        data_atribuicao: new Date().toISOString(),
                        atribuido_por_usuario_id: 'system',
                        atribuido_por_nome: 'Sistema Automático'
                    });
                }
            }

            if (accessToCreate.length > 0) {
                await base44.asServiceRole.entities.UserClientAccess.bulkCreate(accessToCreate);
            }

            results.push({
                usuario: user.email,
                tipo_acesso_corrigido: tipoUsuario === 'voxx_manager' ? 'voxx_operacao' : tipoUsuario,
                acessos_criados: accessToCreate.length,
                acessos_existentes: existingClienteIds.length
            });
        }

        return Response.json({
            success: true,
            total_voxx_users: voxxUsers.length,
            total_clientes: clientes.length,
            results
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});