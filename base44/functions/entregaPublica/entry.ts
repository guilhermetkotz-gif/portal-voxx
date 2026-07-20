import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token, action, nome_responsavel, observacao, anexos, link_alteracao } = body;

    if (!token) {
      return Response.json({ error: 'Token obrigatório' }, { status: 400 });
    }

    const sdk = base44.asServiceRole;

    // Buscar entrega pelo token
    const entregas = await sdk.entities.EntregaDemanda.filter({ token_publico: token });
    if (!entregas || entregas.length === 0) {
      return Response.json({ error: 'link_invalido' }, { status: 404 });
    }
    const entrega = entregas[0];

    // Verificar se link está ativo
    if (entrega.link_ativo === false) {
      return Response.json({ error: 'link_inativo' }, { status: 403 });
    }

    // Verificar expiração
    if (entrega.link_expira_em && new Date(entrega.link_expira_em) < new Date()) {
      return Response.json({ error: 'link_expirado' }, { status: 403 });
    }

    // GET — retornar dados públicos
    if (!action) {
      return Response.json({
        success: true,
        entrega: {
          id: entrega.id,
          nome_entrega: entrega.nome_entrega,
          demanda_titulo: entrega.demanda_titulo || null,
          item_titulo: entrega.item_titulo || null,
          descricao: entrega.descricao,
          tipo_entrega: entrega.tipo_entrega,
          status_entrega: entrega.status_entrega,
          arquivos: entrega.arquivos || [],
          link_externo: entrega.link_externo || null,
          observacao_voxx: entrega.observacao_voxx || null,
          versoes: entrega.versoes || [],
          cliente_nome: entrega.cliente_nome,
          data_envio: entrega.data_envio,
          numero_versao_atual: entrega.numero_versao_atual || 1,
          observacao_cliente: entrega.observacao_cliente || null,
          historico_aprovacoes: entrega.historico_aprovacoes || []
        }
      });
    }

    // Validar ação
    if (action !== 'aprovar' && action !== 'solicitacao_alteracao') {
      return Response.json({ error: 'Ação inválida' }, { status: 400 });
    }
    if (!nome_responsavel?.trim()) {
      return Response.json({ error: 'Nome obrigatório' }, { status: 400 });
    }

    // Impedir aprovação de versão arquivada/substituída
    if (entrega.versao_ativa === false) {
      return Response.json({
        error: 'versao_substituida',
        message: 'Esta versão foi substituída por uma mais recente. Acesse o link atualizado.',
      }, { status: 403 });
    }

    // Impedir aprovação duplicada
    if (entrega.status_entrega === 'aprovado' && action === 'aprovar') {
      return Response.json({
        error: 'ja_aprovado',
        message: 'Esta entrega já foi aprovada.',
      }, { status: 400 });
    }

    // Impedir pedido de ajustes após aprovação sem reabertura
    if (entrega.status_entrega === 'aprovado' && action === 'solicitacao_alteracao') {
      return Response.json({
        error: 'aprovado_requer_reabertura',
        message: 'Este item já está aprovado. A reabertura deve ser solicitada à equipe Voxx.',
      }, { status: 400 });
    }

    const agora = new Date().toISOString();
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'desconhecido';
    const userAgent = req.headers.get('user-agent') || '';

    // Salvar resposta
    const resposta = await sdk.entities.RespostaAprovacaoEntrega.create({
      entrega_id: entrega.id,
      demanda_id: entrega.demanda_id,
      cliente_id: entrega.cliente_id,
      token_publico: token,
      numero_versao: entrega.numero_versao_atual || 1,
      tipo_resposta: action === 'aprovar' ? 'aprovado' : 'solicitou_alteracao',
      nome_responsavel: nome_responsavel.trim(),
      observacao_cliente: observacao || '',
      anexos: anexos || [],
      link_alteracao: link_alteracao || null,
      data_resposta: agora,
      ip,
      user_agent: userAgent
    });

    // Atualizar historico_aprovacoes
    const historico = entrega.historico_aprovacoes || [];
    historico.push({
      acao: action,
      nome_responsavel: nome_responsavel.trim(),
      observacao: observacao || '',
      data: agora,
      ip,
      versao: entrega.numero_versao_atual || 1,
      anexos: anexos || [],
      link_alteracao: link_alteracao || null
    });

    const updates = {
      historico_aprovacoes: historico,
      retorno_cliente_tratado: false
    };

    if (action === 'aprovar') {
      updates.status_entrega = 'aprovado';
      updates.data_aprovacao = agora;
      updates.usuario_aprovacao = nome_responsavel.trim();
    } else {
      updates.status_entrega = 'solicitacao_alteracao';
      updates.observacao_cliente = observacao || '';
    }

    await sdk.entities.EntregaDemanda.update(entrega.id, updates);

    // ── FASE 2: Se a entrega tem item_demanda_id, sincronizar ItemDemanda.status_aprovacao ──
    if (entrega.item_demanda_id) {
      try {
        const novoStatusItem = action === 'aprovar' ? 'aprovado' : 'ajustes_solicitados';
        await sdk.entities.ItemDemanda.update(entrega.item_demanda_id, {
          status_aprovacao: novoStatusItem,
        });
      } catch (e) {
        console.error('Erro ao sincronizar ItemDemanda.status_aprovacao:', e.message);
      }
    }

    // Criar evento na timeline (com vínculo de item/entrega)
    const descEvento = action === 'aprovar'
      ? `✅ ${nome_responsavel.trim()} aprovou a entrega: ${entrega.nome_entrega}`
      : `✏️ ${nome_responsavel.trim()} solicitou alteração em: ${entrega.nome_entrega}${observacao ? ` — "${observacao}"` : ''}`;

    await sdk.entities.TimelineEvent.create({
      demanda_id: entrega.demanda_id,
      cliente_id: entrega.cliente_id,
      item_demanda_id: entrega.item_demanda_id || null,
      entrega_demanda_id: entrega.id,
      tipo: action === 'aprovar' ? 'versao_aprovada' : 'ajustes_solicitados',
      descricao: descEvento,
      autor: nome_responsavel.trim(),
      autor_tipo: 'cliente'
    });

    // ── CRIAR NOTIFICAÇÃO (com dedup por resposta_aprovacao_id) ──
    const tipoNotif = action === 'aprovar' ? 'entrega_aprovada_cliente' : 'alteracao_solicitada_cliente';

    const existentes = await sdk.entities.NotificacaoAprovacao.filter({
      resposta_aprovacao_id: resposta.id
    });

    if (!existentes || existentes.length === 0) {
      await sdk.entities.NotificacaoAprovacao.create({
        tipo_notificacao: tipoNotif,
        cliente_id: entrega.cliente_id,
        cliente_nome: entrega.cliente_nome,
        demanda_id: entrega.demanda_id || null,
        demanda_titulo: entrega.demanda_titulo || null,
        entrega_id: entrega.id,
        entrega_nome: entrega.nome_entrega,
        status_aprovacao: action === 'aprovar' ? 'aprovado' : 'solicitacao_alteracao',
        comentario_cliente: observacao || null,
        anexos: anexos || [],
        link_alteracao: link_alteracao || null,
        lida: false,
        data_resposta_cliente: agora,
        resposta_aprovacao_id: resposta.id
      });
    }

    return Response.json({ success: true, action, status: updates.status_entrega });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});