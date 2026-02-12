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

        // Buscar todos os acessos existentes de uma vez
        const allAccess = await base44.entities.UserClientAccess.filter({
            status: 'ativo'
        }, '', 10000);
        
        // Criar mapa de acessos existentes para verificação rápida
        const existingAccessMap = new Set(
            allAccess.map(a => `${a.usuario_id}_${a.cliente_id}`)
        );

        // Criar lista de novos acessos
        const newAccess = [];
        
        for (const cliente of clientes) {
            for (const voxxUser of voxxUsers) {
                const key = `${voxxUser.id}_${cliente.id}`;
                
                if (!existingAccessMap.has(key)) {
                    newAccess.push({
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
                }
            }
        }

        // Criar todos de uma vez usando bulkCreate
        let created = 0;
        if (newAccess.length > 0) {
            await base44.entities.UserClientAccess.bulkCreate(newAccess);
            created = newAccess.length;
        }
        
        const skipped = (clientes.length * voxxUsers.length) - created;

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