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

        // Buscar credenciais Z-API (entidade → fallback para secrets de ambiente)
        const zapiConfigs = await base44.asServiceRole.entities.ConfiguracaoZapi.list('-created_date', 1).catch(() => []);
        const zapi = zapiConfigs?.[0];
        const instanceId = zapi?.instance_id || Deno.env.get('ZAPI_INSTANCE_ID');
        const token = zapi?.token_instancia || Deno.env.get('ZAPI_TOKEN');
        const clientToken = zapi?.token_global || Deno.env.get('ZAPI_CLIENT_TOKEN');

        if (!instanceId || !token || !clientToken) {
            return Response.json({ error: 'Z-API não configurada. Configure os secrets ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN.' }, { status: 503 });
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

        const zapiData = await zapiResponse.json().catch(() => null);

        // Z-API pode retornar HTTP 200 com erro no body
        const apiError = zapiData?.error ? `Z-API: ${zapiData.error}${zapiData.message ? ' - ' + zapiData.message : ''}` : null;
        if (!zapiResponse.ok || apiError) {
            console.error('Z-API error:', zapiData);
            return Response.json({ error: apiError || 'Erro ao enviar via Z-API', details: zapiData }, { status: 500 });
        }

        const messageId = zapiData?.messageId || zapiData?.zaapId || '';

        // Atualizar otimização (apenas campos existentes no schema)
        try {
            await base44.asServiceRole.entities.MetaAdsOtimizacao.update(otimizacao_id, {
                comunicacao_enviada_fila: true
            });
        } catch (_) { /* non-critical */ }

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
            enviado_por_nome: user.full_name || '',
            enviado_em: new Date().toISOString()
        });

        // Salvar na tabela de mensagens para rastreabilidade
        try {
            await base44.asServiceRole.entities.WhatsappMensagem.create({
                message_id: messageId || null,
                cliente_id: cliente_id || otimizacao.cliente_id || null,
                cliente_nome: otimizacao.cliente_nome || otimizacao.account_name || null,
                grupo_id: whatsappGrupoId,
                is_group: true,
                remetente_nome: user.full_name || user.email,
                remetente_tipo: 'voxx',
                origem: 'enviada',
                mensagem: mensagem,
                tipo_mensagem: 'texto',
                received_at: new Date().toISOString(),
                from_me: true,
                status_entrega: 'enviado',
                status_processamento: 'ok',
            });
        } catch (_) { /* non-critical */ }

        return Response.json({
            success: true,
            message_id: messageId,
            grupo_id: whatsappGrupoId
        });
    } catch (error) {
        console.error('Erro ao enviar otimização WhatsApp:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});