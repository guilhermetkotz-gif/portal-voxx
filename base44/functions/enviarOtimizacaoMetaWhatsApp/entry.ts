import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { otimizacao_id, cliente_id, mensagem, grupo_id } = body;

        if (!otimizacao_id || !mensagem) {
            return Response.json({ error: 'otimizacao_id e mensagem são obrigatórios' }, { status: 400 });
        }

        // Buscar otimização
        const otimizacao = await base44.asServiceRole.entities.MetaAdsOtimizacao.get(otimizacao_id);
        if (!otimizacao) {
            return Response.json({ error: 'Otimização não encontrada' }, { status: 404 });
        }

        // Determinar grupo WhatsApp
        let whatsappGrupoId = grupo_id;
        if (!whatsappGrupoId && cliente_id) {
            const cliente = await base44.asServiceRole.entities.Cliente.get(cliente_id);
            whatsappGrupoId = cliente?.whatsapp_grupo_id;
        }

        if (!whatsappGrupoId) {
            return Response.json({ error: 'Nenhum grupo WhatsApp vinculado ao cliente' }, { status: 400 });
        }

        // Buscar credenciais Z-API
        const zapiConfigs = await base44.asServiceRole.entities.ConfiguracaoZapi.list('-created_date', 1);
        if (!zapiConfigs || zapiConfigs.length === 0) {
            return Response.json({ error: 'Z-API não configurada' }, { status: 400 });
        }

        const zapi = zapiConfigs[0];
        const instanceId = zapi.instance_id;
        const token = zapi.token_instancia;
        const clientToken = zapi.token_global;

        if (!instanceId || !token) {
            return Response.json({ error: 'Credenciais Z-API incompletas' }, { status: 400 });
        }

        // Enviar via Z-API
        const zapiResponse = await fetch(
            `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Client-Token': clientToken || ''
                },
                body: JSON.stringify({
                    phone: whatsappGrupoId,
                    message: mensagem
                })
            }
        );

        const zapiData = await zapiResponse.json();

        if (!zapiResponse.ok) {
            console.error('Z-API error:', zapiData);
            return Response.json({ error: 'Erro ao enviar via Z-API', details: zapiData }, { status: 500 });
        }

        // Atualizar otimização com dados do envio
        await base44.asServiceRole.entities.MetaAdsOtimizacao.update(otimizacao_id, {
            mensagem_cliente_enviada: mensagem,
            enviado_whatsapp: true,
            enviado_em: new Date().toISOString(),
            enviado_por: user.email,
            whatsapp_grupo_id: whatsappGrupoId,
            whatsapp_message_id: zapiData?.messageId || zapiData?.zaapId || ''
        });

        // Criar log de envio
        await base44.asServiceRole.entities.WhatsappEnvioLog.create({
            cliente_id: cliente_id || otimizacao.cliente_id || '',
            cliente_nome: otimizacao.cliente_nome || otimizacao.account_name || '',
            grupo_id: whatsappGrupoId,
            tipo_envio: 'texto',
            origem: 'manual',
            origem_id: otimizacao_id,
            mensagem: mensagem,
            status_envio: 'enviado',
            retorno_zapi: JSON.stringify(zapiData),
            enviado_por: user.email,
            enviado_em: new Date().toISOString()
        });

        return Response.json({
            success: true,
            message_id: zapiData?.messageId || zapiData?.zaapId || '',
            grupo_id: whatsappGrupoId
        });
    } catch (error) {
        console.error('Erro ao enviar otimização WhatsApp:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});