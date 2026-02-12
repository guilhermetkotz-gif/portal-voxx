import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { userId } = await req.json();

        if (!userId) {
            return Response.json({ error: 'userId é obrigatório' }, { status: 400 });
        }

        // Buscar o usuário
        const user = await base44.asServiceRole.entities.User.get(userId);
        
        if (!user) {
            return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
        }

        // Verificar se tem tipo_usuario em vez de tipo_acesso
        const tipoUsuario = user.tipo_usuario || user.tipo_acesso;
        
        // Atualizar para tipo_acesso correto
        await base44.asServiceRole.entities.User.update(userId, {
            tipo_acesso: tipoUsuario === 'voxx_manager' ? 'voxx_operacao' : tipoUsuario
        });

        // Se for usuário Voxx, garantir acesso a todos os clientes
        if (tipoUsuario === 'voxx_manager' || tipoUsuario === 'voxx_operacao' || tipoUsuario === 'voxx_admin') {
            const clientes = await base44.asServiceRole.entities.Cliente.list('-created_date', 500);
            const access = await base44.asServiceRole.entities.UserClientAccess.filter({
                usuario_id: userId,
                status: 'ativo'
            });

            const existingClienteIds = access.map(a => a.cliente_id);
            const accessToCreate = [];

            for (const cliente of clientes) {
                if (!existingClienteIds.includes(cliente.id)) {
                    accessToCreate.push({
                        usuario_id: userId,
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

            return Response.json({
                success: true,
                usuario: user.email,
                tipo_acesso_corrigido: tipoUsuario === 'voxx_manager' ? 'voxx_operacao' : tipoUsuario,
                total_clientes: clientes.length,
                acessos_criados: accessToCreate.length,
                acessos_existentes: existingClienteIds.length
            });
        }

        return Response.json({
            success: true,
            usuario: user.email,
            tipo_acesso_corrigido: tipoUsuario,
            message: 'Usuário não é Voxx, apenas tipo_acesso foi corrigido'
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});