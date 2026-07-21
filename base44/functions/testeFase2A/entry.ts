import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import {
  determinarVersaoCanonica,
  determinarOperacaoCanonica,
  hashPayload,
  gerarUUID,
  gerarTokenPublico,
  versaoStatusToItemStatus,
  versaoStatusToEntregaStatus,
} from '../../shared/versaoCanonica.ts';

/**
 * TEMPORÁRIO — Testes de idempotência e canonização da Fase 2A.
 * Excluir após homologação.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Apenas admin' }, { status: 403 });

    const sdk = base44.asServiceRole;
    const body = await req.json();
    const { test_type, entrega_id, item_id, demanda_id, token, action, idempotency_key, cliente_id, cliente_nome } = body;
    const usuarioNome = user.full_name || user.email;
    const agora = new Date().toISOString();

    // ── Helper: simular entregaPublica (canonização antes de aplicar) ──
    const simularRespostaPublica = async (params) => {
      const { token: t, action: act, idempotencyKey: idemKey } = params;
      const versoesByToken = await sdk.entities.VersaoEntregaDemanda.filter({ token_publico: t });
      const versao = versoesByToken[0];
      if (!versao) return { error: 'versao_nao_encontrada' };

      const entregaArr = await sdk.entities.EntregaDemanda.filter({ id: versao.entrega_demanda_id });
      const entrega = entregaArr[0];
      if (!entrega) return { error: 'entrega_nao_encontrada' };

      const canonico = await determinarVersaoCanonica(sdk, entrega.id);
      if (!canonico.versao_canonica || versao.versao_uid !== canonico.versao_canonica.versao_uid) {
        return { error: 'versao_substituida' };
      }
      if (!['em_aprovacao', 'reenviado'].includes(versao.status)) {
        return { error: 'status_nao_aceita_resposta', status: versao.status };
      }

      // Idempotência sequencial
      const respostasExistentes = await sdk.entities.RespostaAprovacaoEntrega.filter(
        { idempotency_key: idemKey, versao_entrega_demanda_id: versao.id }, 'created_date', 5
      );
      if (respostasExistentes && respostasExistentes.length > 0) {
        const existente = respostasExistentes[0];
        if (existente.status_aplicacao === 'aplicada') return { duplicada: true, sequencial: true };
        if (existente.status_aplicacao === 'pendente_aplicacao') return { error: 'RESPOSTA_EM_PROCESSAMENTO' };
      }

      const tipoResposta = act === 'aprovar' ? 'aprovado' : 'solicitou_alteracao';
      const payloadHash = await hashPayload({ versao_uid: versao.versao_uid, tipo_resposta: tipoResposta, nome_responsavel: 'Teste' });

      // 1. Criar OperacaoEntrega
      const operacaoId = gerarUUID();
      const opRecord = await sdk.entities.OperacaoEntrega.create({
        operacao_id: operacaoId, idempotency_key: idemKey, entrega_id: entrega.id,
        item_demanda_id: versao.item_demanda_id || null, versao_uid: versao.versao_uid,
        tipo_operacao: 'resposta_cliente', payload_hash: payloadHash,
        status_operacao: 'em_execucao', etapa_atual: 'operacao_criada',
        iniciada_em: agora, iniciada_por: 'Teste', falhas: [],
      });

      // 2. Canonizar
      const canonicaOp = await determinarOperacaoCanonica(sdk, {
        idempotency_key: idemKey, tipo_operacao: 'resposta_cliente',
        entrega_id: entrega.id, payload_hash: payloadHash, versao_uid: versao.versao_uid,
      });

      // 3. Se NÃO canônica → duplicada
      if (canonicaOp.operacao_canonica && canonicaOp.operacao_canonica.operacao_id !== operacaoId) {
        await sdk.entities.OperacaoEntrega.update(opRecord.id, {
          status_operacao: 'duplicada', operacao_canonica_id: canonicaOp.operacao_canonica.operacao_id,
          etapa_atual: 'duplicada_nao_aplicada', concluida_em: new Date().toISOString(),
        });
        return { duplicada: true, operacao_canonica_id: canonicaOp.operacao_canonica.operacao_id };
      }

      // 4. Canônica → marcar duplicadas
      for (const dup of canonicaOp.operacoes_duplicadas) {
        if (dup.status_operacao !== 'duplicada') {
          await sdk.entities.OperacaoEntrega.update(dup.id, {
            status_operacao: 'duplicada', operacao_canonica_id: operacaoId,
            etapa_atual: 'duplicada_marcada_canonica', concluida_em: new Date().toISOString(),
          });
        }
      }

      // 5. Criar RespostaAprovacaoEntrega pendente
      const resposta = await sdk.entities.RespostaAprovacaoEntrega.create({
        entrega_id: entrega.id, versao_entrega_demanda_id: versao.id, versao_uid: versao.versao_uid,
        demanda_id: entrega.demanda_id, cliente_id: entrega.cliente_id, token_publico: t,
        numero_versao: canonico.numero_versao_canonica || 1, tipo_resposta: tipoResposta,
        nome_responsavel: 'Teste', observacao_cliente: '', anexos: [], link_alteracao: null,
        data_resposta: agora, ip: 'teste', user_agent: 'teste',
        operacao_id: operacaoId, idempotency_key: idemKey, status_aplicacao: 'pendente_aplicacao',
      });

      const novoStatusVersao = act === 'aprovar' ? 'aprovado' : 'solicitacao_alteracao';

      try {
        await sdk.entities.VersaoEntregaDemanda.update(versao.id, {
          status: novoStatusVersao,
          ...(act === 'aprovar' ? { aprovada_em: agora, aprovada_por: 'Teste' } : {}),
        });
        await sdk.entities.RespostaAprovacaoEntrega.update(resposta.id, {
          status_aplicacao: 'aplicada', aplicada_em: new Date().toISOString(),
        });
        await sdk.entities.EntregaDemanda.update(entrega.id, {
          status_entrega_cache: novoStatusVersao, retorno_cliente_tratado: false,
        });
        if (versao.item_demanda_id) {
          await sdk.entities.ItemDemanda.update(versao.item_demanda_id, {
            status_aprovacao: versaoStatusToItemStatus(novoStatusVersao),
          });
        }
        await sdk.entities.OperacaoEntrega.update(opRecord.id, {
          status_operacao: 'concluida', etapa_atual: 'resposta_aplicada',
          versao_uid: versao.versao_uid, concluida_em: new Date().toISOString(),
        });
        // Timeline (sem catch)
        await sdk.entities.TimelineEvent.create({
          demanda_id: entrega.demanda_id, cliente_id: entrega.cliente_id,
          item_demanda_id: versao.item_demanda_id || null, entrega_demanda_id: entrega.id,
          versao_uid: versao.versao_uid, operacao_id: operacaoId,
          tipo: act === 'aprovar' ? 'versao_aprovada' : 'ajustes_solicitados',
          descricao: `Teste Fase2A: ${act}`, autor: 'Teste', autor_tipo: 'cliente',
        });
        // Notificação (dedup por entrega + versao + status)
        const tipoNotif = act === 'aprovar' ? 'entrega_aprovada_cliente' : 'alteracao_solicitada_cliente';
        const notifExistentes = await sdk.entities.NotificacaoAprovacao.filter(
          { entrega_id: entrega.id, versao_uid: versao.versao_uid, status_aprovacao: novoStatusVersao },
          'created_date', 5
        );
        if (!notifExistentes || notifExistentes.length === 0) {
          await sdk.entities.NotificacaoAprovacao.create({
            tipo_notificacao: tipoNotif, cliente_id: entrega.cliente_id, cliente_nome: entrega.cliente_nome,
            demanda_id: entrega.demanda_id, entrega_id: entrega.id, entrega_nome: versao.nome_entrega,
            status_aprovacao: novoStatusVersao, versao_uid: versao.versao_uid, lida: false,
            data_resposta_cliente: agora, resposta_aprovacao_id: resposta.id, operacao_id: operacaoId,
          });
        }
        return { success: true, canonical: true, operacao_id: operacaoId };
      } catch (e) {
        await sdk.entities.RespostaAprovacaoEntrega.update(resposta.id, {
          status_aplicacao: 'falha_aplicacao', erro_aplicacao_detalhe: e.message,
        });
        const falhas = opRecord.falhas || [];
        falhas.push({ etapa: 'aplicacao_resposta', erro: e.message, timestamp: new Date().toISOString() });
        await sdk.entities.OperacaoEntrega.update(opRecord.id, {
          status_operacao: 'falha', etapa_atual: 'falha_aplicacao', falhas,
        });
        return { error: 'falha_aplicacao', message: e.message, operacao_id: operacaoId };
      }
    };

    // ── Teste E: aprovações concorrentes com a mesma chave ──
    if (test_type === 'concurrent_approval') {
      const idemKey = idempotency_key || gerarUUID();
      const results = await Promise.all([
        simularRespostaPublica({ token, action: action || 'aprovar', idempotencyKey: idemKey }),
        simularRespostaPublica({ token, action: action || 'aprovar', idempotencyKey: idemKey }),
      ]);

      const versoes = await sdk.entities.VersaoEntregaDemanda.filter({ entrega_demanda_id: entrega_id }, 'created_date', 10);
      const ops = await sdk.entities.OperacaoEntrega.filter({ entrega_id }, 'created_date', 10);
      const respostas = await sdk.entities.RespostaAprovacaoEntrega.filter({ entrega_id }, 'created_date', 10);
      const timeline = await sdk.entities.TimelineEvent.filter({ entrega_demanda_id: entrega_id }, 'created_date', 10);
      const notifs = await sdk.entities.NotificacaoAprovacao.filter({ entrega_id }, 'created_date', 10);

      return Response.json({
        test: 'E_concurrent_approval',
        idempotency_key: idemKey,
        results,
        state: {
          versoes: versoes.map(v => ({ uid: v.versao_uid.slice(0, 8), status: v.status, canonico: v.status_canonico })),
          operacoes: ops.map(o => ({ id: o.operacao_id.slice(0, 8), status: o.status_operacao, canonica_id: o.operacao_canonica_id?.slice(0, 8) })),
          respostas: respostas.map(r => ({ id: r.id.slice(0, 8), status: r.status_aplicacao, operacao: r.operacao_id?.slice(0, 8), duplicada: r.status_aplicacao === 'duplicada' })),
          timeline_count: timeline.length,
          notificacoes_count: notifs.length,
          respostas_aplicadas: respostas.filter(r => r.status_aplicacao === 'aplicada').length,
          respostas_duplicadas: respostas.filter(r => r.status_aplicacao === 'duplicada').length,
        },
      });
    }

    // ── Teste F: falha após resposta pendente ──
    if (test_type === 'failure_after_pending') {
      // Criar resposta pendente sem aplicar
      const versoes = await sdk.entities.VersaoEntregaDemanda.filter({ entrega_demanda_id: entrega_id, status_canonico: 'ativa' }, 'created_date', 5);
      const versao = versoes[versoes.length - 1]; // última versão ativa
      if (!versao) return Response.json({ error: 'Sem versão ativa' });

      const operacaoId = gerarUUID();
      await sdk.entities.OperacaoEntrega.create({
        operacao_id: operacaoId, idempotency_key: idempotency_key || gerarUUID(),
        entrega_id, item_demanda_id: versao.item_demanda_id, versao_uid: versao.versao_uid,
        tipo_operacao: 'resposta_cliente', payload_hash: 'test_failure',
        status_operacao: 'falha', etapa_atual: 'falha_aplicacao',
        iniciada_em: agora, iniciada_por: 'Teste', falhas: [{ etapa: 'simulated_failure', erro: 'Teste F', timestamp: agora }],
      });

      const resposta = await sdk.entities.RespostaAprovacaoEntrega.create({
        entrega_id, versao_entrega_demanda_id: versao.id, versao_uid: versao.versao_uid,
        demanda_id, cliente_id, token_publico: token, numero_versao: 1,
        tipo_resposta: action === 'aprovar' ? 'aprovado' : 'solicitou_alteracao',
        nome_responsavel: 'Teste', observacao_cliente: '', data_resposta: agora,
        operacao_id: operacaoId, idempotency_key: idempotency_key || gerarUUID(),
        status_aplicacao: 'falha_aplicacao', erro_aplicacao_detalhe: 'Falha simulada — Teste F',
      });

      return Response.json({
        test: 'F_failure_after_pending',
        resposta_id: resposta.id,
        operacao_id: operacaoId,
        status_aplicacao: 'falha_aplicacao',
        message: 'Resposta criada com falha simulada. Reconciliador deve retomar.',
      });
    }

    return Response.json({ error: `test_type '${test_type}' não reconhecido` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});