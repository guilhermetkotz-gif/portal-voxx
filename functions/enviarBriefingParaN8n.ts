import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Autenticar usuário
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obter payload
    const { demanda_id, briefing_json } = await req.json();
    
    if (!demanda_id || !briefing_json) {
      return Response.json({ 
        error: 'demanda_id e briefing_json são obrigatórios' 
      }, { status: 400 });
    }

    // Obter URL do webhook n8n do secret
    const n8nWebhookUrl = Deno.env.get('N8N_BRIEFING_WEBHOOK_URL');
    
    if (!n8nWebhookUrl) {
      return Response.json({ 
        error: 'Webhook n8n não configurado. Configure N8N_BRIEFING_WEBHOOK_URL nas variáveis de ambiente.' 
      }, { status: 500 });
    }

    // Buscar demanda completa para validar acesso
    const demanda = await base44.entities.Demanda.get(demanda_id);
    
    if (!demanda) {
      return Response.json({ error: 'Demanda não encontrada' }, { status: 404 });
    }

    // Parse do JSON se vier como string
    const briefingData = typeof briefing_json === 'string' 
      ? JSON.parse(briefing_json) 
      : briefing_json;

    // Enviar para webhook n8n
    const webhookResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        demanda_id: demanda_id,
        briefing: briefingData,
        user_email: user.email,
        timestamp: new Date().toISOString()
      })
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('Erro ao chamar webhook n8n:', errorText);
      return Response.json({ 
        error: 'Erro ao processar no n8n',
        details: errorText
      }, { status: 500 });
    }

    const webhookResult = await webhookResponse.json();

    // Adicionar evento na timeline da demanda
    await base44.entities.TimelineEvent.create({
      demanda_id: demanda_id,
      cliente_id: demanda.cliente_id,
      tipo: 'acao_voxx',
      descricao: 'Briefing enviado para geração automática via IA (n8n)',
      autor: user.full_name || user.email,
      autor_tipo: 'voxx'
    });

    return Response.json({ 
      success: true,
      message: 'Briefing enviado para n8n com sucesso',
      webhook_response: webhookResult
    });

  } catch (error) {
    console.error('Erro ao enviar briefing para n8n:', error);
    return Response.json({ 
      error: error.message || 'Erro interno do servidor' 
    }, { status: 500 });
  }
});