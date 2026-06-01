import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token, action, nome_responsavel, observacao } = body;

    if (!token) {
      return Response.json({ error: 'Token obrigatório' }, { status: 400 });
    }

    // Buscar entrega pelo token (sem auth)
    const entregas = await base44.asServiceRole.entities.EntregaDemanda.filter({ token_publico: token });
    if (!entregas || entregas.length === 0) {
      return Response.json({ error: 'Entrega não encontrada' }, { status: 404 });
    }
    const entrega = entregas[0];

    // Apenas GET — retornar dados públicos
    if (!action) {
      return Response.json({
        success: true,
        entrega: {
          id: entrega.id,
          nome_entrega: entrega.nome_entrega,
          descricao: entrega.descricao,
          tipo_entrega: entrega.tipo_entrega,
          status_entrega: entrega.status_entrega,
          arquivos: entrega.arquivos || [],
          link_externo: entrega.link_externo || null,
          versoes: entrega.versoes || [],
          cliente_nome: entrega.cliente_nome,
          data_envio: entrega.data_envio,
          numero_versao_atual: entrega.numero_versao_atual || 1,
          observacao_cliente: entrega.observacao_cliente || null
        }
      });
    }

    // Ação: aprovar ou solicitar_alteracao
    if (action !== 'aprovar' && action !== 'solicitacao_alteracao') {
      return Response.json({ error: 'Ação inválida' }, { status: 400 });
    }

    const agora = new Date().toISOString();
    const historico = entrega.historico_aprovacoes || [];
    historico.push({
      acao: action,
      nome_responsavel: nome_responsavel || 'Cliente',
      observacao: observacao || '',
      data: agora,
      ip: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'desconhecido'
    });

    const updates = {
      historico_aprovacoes: historico,
      observacao_cliente: observacao || entrega.observacao_cliente || ''
    };

    if (action === 'aprovar') {
      updates.status_entrega = 'aprovado';
      updates.data_aprovacao = agora;
      updates.usuario_aprovacao = nome_responsavel || 'Cliente';
    } else {
      updates.status_entrega = 'solicitacao_alteracao';
    }

    await base44.asServiceRole.entities.EntregaDemanda.update(entrega.id, updates);

    // Registrar evento na timeline da demanda
    const descricaoEvento = action === 'aprovar'
      ? `✅ Cliente aprovou a entrega: ${entrega.nome_entrega}`
      : `✏️ Cliente solicitou alteração na entrega: ${entrega.nome_entrega}${observacao ? ` — "${observacao}"` : ''}`;

    await base44.asServiceRole.entities.TimelineEvent.create({
      demanda_id: entrega.demanda_id,
      cliente_id: entrega.cliente_id,
      tipo: action === 'aprovar' ? 'aprovacao' : 'solicitacao_alteracao',
      descricao: descricaoEvento,
      autor: nome_responsavel || 'Cliente',
      autor_tipo: 'cliente'
    });

    return Response.json({ success: true, action, status: updates.status_entrega });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});