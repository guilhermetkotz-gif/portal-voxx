import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Função helper para adicionar itens à fila de comunicação
// Chamada quando uma demanda é concluída ou uma ação Meta/Google é registrada com comunicar_cliente = true

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { cliente_id, cliente_nome, origem, origem_id, tipo_evento, tipo_entrega, resumo, data_evento, anexos_cliente } = body;

    if (!cliente_id || !origem || !resumo) {
      return Response.json({ error: 'cliente_id, origem e resumo são obrigatórios' }, { status: 400 });
    }

    // Verificar se já existe item para essa origem_id (evitar duplicatas)
    if (origem_id) {
      const existing = await base44.asServiceRole.entities.FilaComunicacaoCliente.filter({
        origem_id,
        status: 'aguardando'
      });
      if (existing.length > 0) {
        return Response.json({ success: true, id: existing[0].id, duplicata: true });
      }
    }

    const hoje = data_evento || new Date().toISOString().split('T')[0];

    const item = await base44.asServiceRole.entities.FilaComunicacaoCliente.create({
      cliente_id,
      cliente_nome: cliente_nome || '',
      origem,
      origem_id: origem_id || null,
      tipo_evento: tipo_evento || 'entrega',
      tipo_entrega: tipo_entrega || null,
      resumo,
      data_evento: hoje,
      usuario_responsavel: user.email,
      usuario_responsavel_nome: user.full_name || user.email,
      anexos: (anexos_cliente || []).filter(a => a.enviar_cliente !== false),
      status: 'aguardando'
    });

    return Response.json({ success: true, id: item.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});