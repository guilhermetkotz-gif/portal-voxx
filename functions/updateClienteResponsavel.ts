import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Apenas voxx pode fazer essa operação
        if (user.role !== 'admin' && !user.tipo_usuario?.startsWith('voxx_')) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { clienteId, responsavel } = await req.json();

        if (!clienteId) {
            return Response.json({ error: 'clienteId é obrigatório' }, { status: 400 });
        }

        // Atualizar responsável diretamente
        await base44.asServiceRole.entities.Cliente.update(clienteId, {
            responsavel_voxx_trafego: responsavel === '__NONE__' ? null : responsavel
        });

        return Response.json({ 
            success: true, 
            message: `Responsável ${responsavel && responsavel !== '__NONE__' ? 'atualizado' : 'removido'} com sucesso!`
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});