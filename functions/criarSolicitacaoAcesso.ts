import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { nome, email, senha, tipoUsuario, funcao, unidadesDesejadas } = await req.json();

        // Validate input
        if (!nome || !email || !senha || !funcao || !unidadesDesejadas) {
            return Response.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
        }

        if (senha.length < 6) {
            return Response.json({ error: 'A senha deve ter no mínimo 6 caracteres' }, { status: 400 });
        }

        // Check if user already exists
        const existingUsers = await base44.asServiceRole.entities.User.filter({ email });
        if (existingUsers.length > 0) {
            return Response.json({ error: 'Este email já está cadastrado' }, { status: 400 });
        }

        // Invite user (creates the user account)
        await base44.asServiceRole.users.inviteUser(email, 'user');

        // Wait a bit and get the created user
        await new Promise(resolve => setTimeout(resolve, 1000));
        const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 100);
        const newUser = allUsers.find(u => u.email === email);

        if (!newUser) {
            return Response.json({ error: 'Erro ao criar usuário' }, { status: 500 });
        }

        // Update user with additional info
        await base44.asServiceRole.entities.User.update(newUser.id, {
            full_name: nome,
            tipo_usuario: tipoUsuario,
            status: 'pendente',
            cargo: funcao
        });

        // Create access request
        await base44.asServiceRole.entities.AccessRequest.create({
            usuario_id: newUser.id,
            usuario_nome: nome,
            usuario_email: email,
            contas_solicitadas: [],
            contas_solicitadas_nomes: [],
            motivo: `Função: ${funcao}\nUnidades desejadas: ${unidadesDesejadas}`,
            status: 'pendente'
        });

        // Create notification for admins
        const admins = await base44.asServiceRole.entities.User.filter({ 
            tipo_usuario: { $in: ['voxx_admin', 'voxx_manager'] }
        });
        
        for (const admin of admins) {
            await base44.asServiceRole.entities.Notificacao.create({
                user_email: admin.email,
                tipo: 'nova_solicitacao',
                titulo: 'Nova Solicitação de Acesso',
                mensagem: `${nome} (${email}) solicitou acesso ao portal.`,
                lida: false
            });
        }

        return Response.json({ 
            success: true,
            message: 'Solicitação criada com sucesso'
        });
        
    } catch (error) {
        console.error('Erro ao criar solicitação:', error);
        return Response.json({ 
            error: error.message || 'Erro ao processar solicitação'
        }, { status: 500 });
    }
});