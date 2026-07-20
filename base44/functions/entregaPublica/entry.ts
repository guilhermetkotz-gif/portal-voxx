import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  determinarVersaoCanonica,
  gerarUUID,
  versaoStatusToItemStatus,
} from '../../shared/versaoCanonica.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token, action, nome_responsavel, observacao, anexos, link_alteracao } = body;

    if (!token) {
      return Response.json({ error: 'Token obrigatório' }, { status: 400 });
    }

    const sdk = base44.asServiceRole;

    // ─────────────────────────────────────────────────────────
    // V2: modelo entidade_versao — token está em VersaoEntregaDemanda
    // ─────────────────────────────────────────────────────────
    const versoesByToken = await sdk.entities.VersaoEntregaDemanda.filter({ token_publico: token });
    if (versoesByToken && versoesByToken.length > 0) {
      const versao = versoesByToken[0];
      const entregaArrV2 = await sdk.entities.EntregaDemanda.filter({ id: versao.entrega_demanda_id });
      const entregaV2 = entregaArrV2[0];

      if (!entregaV2) {
        return Response.json({ error: 'link_invalido' }, { status: 404 });
      }

      // Determinar versão canônica
      const canonico = await determinarVersaoCanonica(sdk, entregaV2.id);

      // Se a versão do token não é a canônica → rejeitar
      if (!canonico.versao_canonica || versao.versao_uid !== canonico.versao_canonica.versao_uid) {
        return Response.json({
          error: 'versao_substituida',
          message: 'Esta versão foi substituída por uma mais recente. Acesse o link atualizado.',
        }, { status: 403 });
      }

      // GET — retornar dados públicos da versão
      if (!action) {
        return Response.json({
          success: true,
          entrega: {
            id: entregaV2.id,
            nome_entrega: versao.nome_entrega,
            demanda_titulo: entregaV2.demanda_titulo || null,
            item_titulo: entregaV2.item_titulo || null,
            descricao: versao.descricao,
            tipo_entrega: versao.tipo_entrega,
            status_entrega: versao.status,
            arquivos: versao.arquivos || [],
            link_externo: versao.link_externo || null,
            observacao_voxx: versao.observacao_voxx || null,
            versoes: [],
            cliente_nome: entregaV2.cliente_nome,
            data_envio: versao.enviada_em,
            numero_versao_atual: canonico.numero_versao_canonica || 1,
            observacao_cliente: null,
            historico_aprovacoes: [],
            modelo_versionamento: 'entidade_versao',
            versao_uid: versao.versao_uid,
          },
        });
      }

      // POST — processar resposta do cliente
      if (action !== 'aprovar' && action !== 'solicitacao_alteracao') {
        return Response.json({ error: 'Ação inválida' }, { status: 400 });
      }
      if (!nome_responsavel?.trim()) {
        return Response.json({ error: 'Nome obrigatório' }, { status: 400 });
      }

      // Aceitar resposta somente em em_aprovacao ou reenviado
      if (!['em_aprovacao', 'reenviado'].includes(versao.status)) {
        if (versao.status === 'aprovado' && action === 'aprovar') {
          return Response.json({ error: 'ja_aprovado', message: 'Esta entrega já foi aprovada.' }, { status: 400 });
        }
        return Response.json({
          error: 'status_nao_aceita_resposta',
          message: `Status atual (${versao.status}) não aceita resposta do cliente.`,
        }, { status: 400 });
      }

      const agoraV2 = new Date().toISOString();
      const ipV2 = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'desconhecido';
      const userAgentV2 = req.headers.get('user-agent') || '';

      // 1. Criar OperacaoEntrega
      const operacaoId = gerarUUID();
      await sdk.entities.OperacaoEntrega.create({
        operacao_id: operacaoId,
        entrega_id: entregaV2.id,
        item_demanda_id: versao.item_demanda_id || null,
        tipo_operacao: 'resposta_cliente',
        status_operacao: 'em_execucao',
        etapa_atual: 'operacao_criada',
        iniciada_em: agoraV2,
        iniciada_por: nome_responsavel.trim(),
      });

      // 2. Criar RespostaAprovacaoEntrega com status_aplicacao = pendente_aplicacao (ESSENCIAL)
      const resposta = await sdk.entities.RespostaAprovacaoEntrega.create({
        entrega_id: entregaV2.id,
        versao_entrega_demanda_id: versao.id,
        versao_uid: versao.versao_uid,
        demanda_id: entregaV2.demanda_id,
        cliente_id: entregaV2.cliente_id,
        token_publico: token,
        numero_versao: canonico.numero_versao_canonica || 1,
        tipo_resposta: action === 'aprovar' ? 'aprovado' : 'solicitou_alteracao',
        nome_responsavel: nome_responsavel.trim(),
        observacao_cliente: observacao || '',
        anexos: anexos || [],
        link_alteracao: link_alteracao || null,
        data_resposta: agoraV2,
        ip: ipV2,
        user_agent: userAgentV2,
        operacao_id: operacaoId,
        status_aplicacao: 'pendente_aplicacao',
      });

      // 3. Atualizar status da VersaoEntregaDemanda (ESSENCIAL)
      const novoStatusVersao = action === 'aprovar' ? 'aprovado' : 'solicitacao_alteracao';
      await sdk.entities.VersaoEntregaDemanda.update(versao.id, {
        status: novoStatusVersao,
        ...(action === 'aprovar' ? { aprovada_em: agoraV2, aprovada_por: nome_responsavel.trim() } : {}),
      });

      // 4. Marcar resposta como aplicada (ESSENCIAL)
      await sdk.entities.RespostaAprovacaoEntrega.update(resposta.id, {
        status_aplicacao: 'aplicada',
        aplicada_em: new Date().toISOString(),
      });

      // 5. Atualizar caches da EntregaDemanda
      await sdk.entities.EntregaDemanda.update(entregaV2.id, {
        status_entrega_cache: novoStatusVersao,
        retorno_cliente_tratado: false,
        ...(action === 'aprovar' ? {
          data_aprovacao: agoraV2,
          usuario_aprovacao: nome_responsavel.trim(),
        } : {
          observacao_cliente: observacao || '',
        }),
      });

      // 6. Sincronizar ItemDemanda (ESSENCIAL)
      if (versao.item_demanda_id) {
        const novoStatusItem = versaoStatusToItemStatus(novoStatusVersao);
        await sdk.entities.ItemDemanda.update(versao.item_demanda_id, {
          status_aprovacao: novoStatusItem,
        }).catch(() => null);
      }

      // 7. Concluir OperacaoEntrega
      const opsArr = await sdk.entities.OperacaoEntrega.filter({ operacao_id: operacaoId });
      if (opsArr[0]) {
        await sdk.entities.OperacaoEntrega.update(opsArr[0].id, {
          status_operacao: 'concluida',
          etapa_atual: 'resposta_aplicada',
          versao_uid: versao.versao_uid,
          concluida_em: new Date().toISOString(),
        });
      }

      // 8. TimelineEvent (AUXILIAR)
      const descEvento = action === 'aprovar'
        ? `✅ ${nome_responsavel.trim()} aprovou a entrega: ${versao.nome_entrega} [entidade_versao]`
        : `✏️ ${nome_responsavel.trim()} solicitou alteração em: ${versao.nome_entrega}${observacao ? ` — "${observacao}"` : ''} [entidade_versao]`;

      await sdk.entities.TimelineEvent.create({
        demanda_id: entregaV2.demanda_id,
        cliente_id: entregaV2.cliente_id,
        item_demanda_id: versao.item_demanda_id || null,
        entrega_demanda_id: entregaV2.id,
        versao_uid: versao.versao_uid,
        tipo: action === 'aprovar' ? 'versao_aprovada' : 'ajustes_solicitados',
        descricao: descEvento,
        autor: nome_responsavel.trim(),
        autor_tipo: 'cliente',
      }).catch(() => null);

      // 9. NotificacaoAprovacao (AUXILIAR)
      const tipoNotif = action === 'aprovar' ? 'entrega_aprovada_cliente' : 'alteracao_solicitada_cliente';
      const notifExistentes = await sdk.entities.NotificacaoAprovacao.filter({ resposta_aprovacao_id: resposta.id });
      if (!notifExistentes || notifExistentes.length === 0) {
        await sdk.entities.NotificacaoAprovacao.create({
          tipo_notificacao: tipoNotif,
          cliente_id: entregaV2.cliente_id,
          cliente_nome: entregaV2.cliente_nome,
          demanda_id: entregaV2.demanda_id || null,
          demanda_titulo: entregaV2.demanda_titulo || null,
          entrega_id: entregaV2.id,
          entrega_nome: versao.nome_entrega,
          status_aprovacao: novoStatusVersao,
          comentario_cliente: observacao || null,
          anexos: anexos || [],
          link_alteracao: link_alteracao || null,
          lida: false,
          data_resposta_cliente: agoraV2,
          resposta_aprovacao_id: resposta.id,
        }).catch(() => null);
      }

      return Response.json({
        success: true,
        action,
        status: novoStatusVersao,
        versao_uid: versao.versao_uid,
      });
    }

    // ── FIM V2 — cai para lógica embutida existente ──

    // Buscar entrega pelo token (modelo embutido)
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