import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import {
  determinarVersaoCanonica,
  versaoStatusToItemStatus,
  versaoStatusToEntregaStatus,
} from '../../shared/versaoCanonica.ts';

/**
 * Teste isolado Fase 2A — Validar que o reconciliador NÃO retoma resposta
 * obsoleta quando a versão canônica já foi aprovada.
 *
 * Cenário:
 *  1. Criar entrega + item temporários
 *  2. Criar v1, enviar (→ em_aprovacao)
 *  3. Solicitar alteração (→ solicitacao_alteracao)
 *  4. Criar v2, enviar (→ reenviado)
 *  5. Aplicar aprovação canônica via entregaPublica (→ aprovado)
 *  6. Criar resposta antiga de solicitacao_alteracao com falha_aplicacao
 *  7. Executar reconciliador
 *  8. Verificar estado final
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Apenas admin' }, { status: 403 });

    const sdk = base44.asServiceRole;
    const agora = new Date().toISOString();
    const PREFIX = 'TESTE_OBSOLETA_F2A';

    // ── Estado ANTES ──
    // 1. Criar demanda temporária
    const demanda = await sdk.entities.Demanda.create({
      cliente_id: 'test_obsoleta_cliente',
      cliente_nome: 'Teste Obsoleta Cliente',
      setor: 'CRIACAO',
      titulo: `${PREFIX}_DEMANDA`,
      descricao: 'Teste de resposta obsoleta',
      estrutura_demanda: 'composta',
      status: 'em_execucao',
      prioridade: 'media',
    });

    // 2. Criar item temporário
    const item = await sdk.entities.ItemDemanda.create({
      demanda_id: demanda.id,
      titulo: `${PREFIX}_ITEM`,
      tipo_material: 'Arte',
      ordem: 0,
      status_producao: 'concluido',
      status_aprovacao: 'nao_enviado',
      status_publicacao: 'nao_programada',
      status_finalizacao: 'ativo',
    });

    // 3. Criar entrega
    const entrega = await sdk.entities.EntregaDemanda.create({
      demanda_id: demanda.id,
      demanda_titulo: demanda.titulo,
      item_demanda_id: item.id,
      item_titulo: item.titulo,
      cliente_id: 'test_obsoleta_cliente',
      cliente_nome: 'Teste Obsoleta Cliente',
      nome_entrega: `${PREFIX}_ENTREGA`,
      tipo_entrega: 'Imagem',
      status_entrega: 'rascunho',
      modelo_versionamento: 'entidade_versao',
    });

    // 4. Criar v1 via gerenciarEntregaItem (criar_entrega)
    const opIdV1 = crypto.randomUUID();
    const versaoUidV1 = crypto.randomUUID();
    const tokenV1 = crypto.randomUUID();
    await sdk.entities.VersaoEntregaDemanda.create({
      versao_uid: versaoUidV1,
      entrega_demanda_id: entrega.id,
      item_demanda_id: item.id,
      demanda_id: demanda.id,
      cliente_id: 'test_obsoleta_cliente',
      operacao_id: opIdV1,
      idempotency_key: `${PREFIX}_criar_v1`,
      payload_hash: 'hash_v1_test',
      numero_exibicao: 1,
      nome_entrega: `${PREFIX}_ENTREGA`,
      tipo_entrega: 'Imagem',
      arquivos: [{ url: 'https://example.com/v1.png', nome: 'v1.png', tipo: 'imagem' }],
      token_publico: tokenV1,
      criada_em: agora,
      criada_por: user.full_name || user.email,
      criada_por_id: user.id,
      status: 'rascunho',
      status_canonico: 'ativa',
    });
    await sdk.entities.OperacaoEntrega.create({
      operacao_id: opIdV1,
      idempotency_key: `${PREFIX}_criar_v1`,
      entrega_id: entrega.id,
      item_demanda_id: item.id,
      versao_uid: versaoUidV1,
      tipo_operacao: 'criar_entrega',
      payload_hash: 'hash_v1_test',
      status_operacao: 'concluida',
      etapa_atual: 'versao_criada',
      iniciada_em: agora,
      concluida_em: agora,
      iniciada_por: user.full_name || user.email,
      iniciada_por_id: user.id,
    });
    await sdk.entities.EntregaDemanda.update(entrega.id, {
      versao_atual_uid_cache: versaoUidV1,
      numero_versao_atual_cache: 1,
      status_entrega_cache: 'rascunho',
      token_publico_cache: tokenV1,
    });

    // 5. Enviar v1 (→ em_aprovacao)
    const opIdEnvioV1 = crypto.randomUUID();
    await sdk.entities.VersaoEntregaDemanda.update(
      (await sdk.entities.VersaoEntregaDemanda.filter({ versao_uid: versaoUidV1 }))[0].id,
      { status: 'em_aprovacao', enviada_em: agora }
    );
    await sdk.entities.ItemDemanda.update(item.id, { status_aprovacao: 'aguardando' });
    await sdk.entities.OperacaoEntrega.create({
      operacao_id: opIdEnvioV1,
      idempotency_key: `${PREFIX}_enviar_v1`,
      entrega_id: entrega.id,
      item_demanda_id: item.id,
      versao_uid: versaoUidV1,
      tipo_operacao: 'enviar_aprovacao',
      status_operacao: 'concluida',
      etapa_atual: 'enviada_aprovacao',
      iniciada_em: agora,
      concluida_em: agora,
      iniciada_por: user.full_name || user.email,
      iniciada_por_id: user.id,
    });

    // 6. Solicitar alteração via entregaPublica (→ solicitacao_alteracao)
    const opIdSolicAlt = crypto.randomUUID();
    const respostaSolicAlt = await sdk.entities.RespostaAprovacaoEntrega.create({
      entrega_id: entrega.id,
      versao_entrega_demanda_id: (await sdk.entities.VersaoEntregaDemanda.filter({ versao_uid: versaoUidV1 }))[0].id,
      versao_uid: versaoUidV1,
      demanda_id: demanda.id,
      cliente_id: 'test_obsoleta_cliente',
      token_publico: tokenV1,
      tipo_resposta: 'solicitou_alteracao',
      nome_responsavel: 'Cliente Teste',
      observacao_cliente: 'Solicito alteração no v1',
      data_resposta: agora,
      operacao_id: opIdSolicAlt,
      idempotency_key: `${PREFIX}_solic_alt_v1`,
      status_aplicacao: 'aplicada',
      aplicada_em: agora,
    });
    await sdk.entities.VersaoEntregaDemanda.update(
      (await sdk.entities.VersaoEntregaDemanda.filter({ versao_uid: versaoUidV1 }))[0].id,
      { status: 'solicitacao_alteracao' }
    );
    await sdk.entities.ItemDemanda.update(item.id, { status_aprovacao: 'ajustes_solicitados' });
    await sdk.entities.OperacaoEntrega.create({
      operacao_id: opIdSolicAlt,
      idempotency_key: `${PREFIX}_solic_alt_v1`,
      entrega_id: entrega.id,
      item_demanda_id: item.id,
      versao_uid: versaoUidV1,
      tipo_operacao: 'resposta_cliente',
      status_operacao: 'concluida',
      etapa_atual: 'resposta_registrada',
      iniciada_em: agora,
      concluida_em: agora,
      iniciada_por: 'Cliente Teste',
      iniciada_por_id: 'cliente',
    });

    // 7. Criar v2 e enviar (→ reenviado)
    const versaoUidV2 = crypto.randomUUID();
    const tokenV2 = crypto.randomUUID();
    const opIdV2 = crypto.randomUUID();
    await sdk.entities.VersaoEntregaDemanda.create({
      versao_uid: versaoUidV2,
      entrega_demanda_id: entrega.id,
      item_demanda_id: item.id,
      demanda_id: demanda.id,
      cliente_id: 'test_obsoleta_cliente',
      operacao_id: opIdV2,
      idempotency_key: `${PREFIX}_criar_v2`,
      payload_hash: 'hash_v2_test',
      numero_exibicao: 2,
      nome_entrega: `${PREFIX}_ENTREGA`,
      tipo_entrega: 'Imagem',
      arquivos: [{ url: 'https://example.com/v2.png', nome: 'v2.png', tipo: 'imagem' }],
      token_publico: tokenV2,
      criada_em: agora,
      criada_por: user.full_name || user.email,
      criada_por_id: user.id,
      status: 'rascunho',
      status_canonico: 'ativa',
    });
    // Marcar v1 como substituida
    await sdk.entities.VersaoEntregaDemanda.update(
      (await sdk.entities.VersaoEntregaDemanda.filter({ versao_uid: versaoUidV1 }))[0].id,
      { status_canonico: 'substituida', substituida_em: agora, substituida_por_versao_uid: versaoUidV2 }
    );
    await sdk.entities.OperacaoEntrega.create({
      operacao_id: opIdV2,
      idempotency_key: `${PREFIX}_criar_v2`,
      entrega_id: entrega.id,
      item_demanda_id: item.id,
      versao_uid: versaoUidV2,
      tipo_operacao: 'criar_nova_versao',
      status_operacao: 'concluida',
      etapa_atual: 'versao_criada',
      iniciada_em: agora,
      concluida_em: agora,
      iniciada_por: user.full_name || user.email,
      iniciada_por_id: user.id,
    });
    // Enviar v2 (→ reenviado, pois há versão anterior)
    const opIdEnvioV2 = crypto.randomUUID();
    await sdk.entities.VersaoEntregaDemanda.update(
      (await sdk.entities.VersaoEntregaDemanda.filter({ versao_uid: versaoUidV2 }))[0].id,
      { status: 'reenviado', enviada_em: agora }
    );
    await sdk.entities.ItemDemanda.update(item.id, { status_aprovacao: 'reenviado' });
    await sdk.entities.OperacaoEntrega.create({
      operacao_id: opIdEnvioV2,
      idempotency_key: `${PREFIX}_enviar_v2`,
      entrega_id: entrega.id,
      item_demanda_id: item.id,
      versao_uid: versaoUidV2,
      tipo_operacao: 'enviar_aprovacao',
      status_operacao: 'concluida',
      etapa_atual: 'enviada_aprovacao',
      iniciada_em: agora,
      concluida_em: agora,
      iniciada_por: user.full_name || user.email,
      iniciada_por_id: user.id,
    });

    // 8. Aplicar aprovação canônica via entregaPublica (→ aprovado)
    const opIdAprov = crypto.randomUUID();
    const respostaAprov = await sdk.entities.RespostaAprovacaoEntrega.create({
      entrega_id: entrega.id,
      versao_entrega_demanda_id: (await sdk.entities.VersaoEntregaDemanda.filter({ versao_uid: versaoUidV2 }))[0].id,
      versao_uid: versaoUidV2,
      demanda_id: demanda.id,
      cliente_id: 'test_obsoleta_cliente',
      token_publico: tokenV2,
      tipo_resposta: 'aprovado',
      nome_responsavel: 'Cliente Teste',
      observacao_cliente: 'Aprovado!',
      data_resposta: new Date(Date.now() + 1000).toISOString(), // 1s depois
      operacao_id: opIdAprov,
      idempotency_key: `${PREFIX}_aprov_v2`,
      status_aplicacao: 'aplicada',
      aplicada_em: new Date(Date.now() + 1000).toISOString(),
    });
    await sdk.entities.VersaoEntregaDemanda.update(
      (await sdk.entities.VersaoEntregaDemanda.filter({ versao_uid: versaoUidV2 }))[0].id,
      { status: 'aprovado', aprovada_em: new Date(Date.now() + 1000).toISOString(), aprovada_por: 'Cliente Teste' }
    );
    await sdk.entities.ItemDemanda.update(item.id, { status_aprovacao: 'aprovado' });
    await sdk.entities.OperacaoEntrega.create({
      operacao_id: opIdAprov,
      idempotency_key: `${PREFIX}_aprov_v2`,
      entrega_id: entrega.id,
      item_demanda_id: item.id,
      versao_uid: versaoUidV2,
      tipo_operacao: 'aprovar',
      status_operacao: 'concluida',
      etapa_atual: 'resposta_registrada',
      iniciada_em: new Date(Date.now() + 1000).toISOString(),
      concluida_em: new Date(Date.now() + 1000).toISOString(),
      iniciada_por: 'Cliente Teste',
      iniciada_por_id: 'cliente',
    });
    await sdk.entities.EntregaDemanda.update(entrega.id, {
      versao_atual_uid_cache: versaoUidV2,
      numero_versao_atual_cache: 2,
      status_entrega_cache: 'aprovado',
      token_publico_cache: tokenV2,
    });

    // ── Snapshot ANTES do reconciliador ──
    const snapshotAntes = await capturarEstado(sdk, entrega.id, item.id);

    // 9. Criar resposta ANTIGA de solicitacao_alteracao com falha_aplicacao
    //    (simula uma resposta que falhou durante o processamento de v2
    //     ANTES da aprovação canônica ser aplicada)
    const opIdRespFalha = crypto.randomUUID();
    const respostaObsoleta = await sdk.entities.RespostaAprovacaoEntrega.create({
      entrega_id: entrega.id,
      versao_entrega_demanda_id: (await sdk.entities.VersaoEntregaDemanda.filter({ versao_uid: versaoUidV2 }))[0].id,
      versao_uid: versaoUidV2,
      demanda_id: demanda.id,
      cliente_id: 'test_obsoleta_cliente',
      token_publico: tokenV2,
      tipo_resposta: 'solicitou_alteracao',
      nome_responsavel: 'Cliente Teste',
      observacao_cliente: 'Solicito alteração (resposta antiga que falhou)',
      data_resposta: new Date(Date.now() - 5000).toISOString(), // 5s ANTES da aprovação
      operacao_id: opIdRespFalha,
      idempotency_key: `${PREFIX}_solic_alt_v2_falha`,
      status_aplicacao: 'falha_aplicacao',
      erro_aplicacao_detalhe: 'Falha simulada durante aplicação',
    });
    await sdk.entities.OperacaoEntrega.create({
      operacao_id: opIdRespFalha,
      idempotency_key: `${PREFIX}_solic_alt_v2_falha`,
      entrega_id: entrega.id,
      item_demanda_id: item.id,
      versao_uid: versaoUidV2,
      tipo_operacao: 'resposta_cliente',
      status_operacao: 'falha',
      etapa_atual: 'falha_aplicacao_resposta',
      iniciada_em: new Date(Date.now() - 5000).toISOString(),
      iniciada_por: 'Cliente Teste',
      iniciada_por_id: 'cliente',
    });

    // 10. Executar reconciliador
    const reconcilerUrl = new URL(req.url);
    reconcilerUrl.pathname = '/api/functions/reconciliarVersoesEntrega';
    const reconcilerResp = await fetch(reconcilerUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cookie': req.headers.get('cookie') || '' },
      body: JSON.stringify({ entrega_id: entrega.id }),
    });
    const reconcilerResult = await reconcilerResp.json();

    // ── Snapshot DEPOIS do reconciliador ──
    const snapshotDepois = await capturarEstado(sdk, entrega.id, item.id);

    // ── Validações ──
    const versaoV2Depois = snapshotDepois.versoes.find(v => v.uid === versaoUidV2.slice(0, 8));
    const validacoes = {
      versao_continua_aprovado: versaoV2Depois?.status === 'aprovado',
      item_continua_aprovado: snapshotDepois.item_status === 'aprovado',
      cache_continua_aprovado: snapshotDepois.entrega_cache?.status === 'aprovado',
      resposta_obsoleta_marcada: snapshotDepois.respostas.some(r =>
        r.id === respostaObsoleta.id.substring(0, 8) + '...' &&
        (r.status_aplicacao === 'duplicada')
      ),
      sem_timeline_adicional: snapshotDepois.timeline_count === snapshotAntes.timeline_count,
      sem_notificacao_adicional: snapshotDepois.notificacoes_count === snapshotAntes.notificacoes_count,
    };

    // ── Limpeza ──
    await limparTeste(sdk, entrega.id, item.id, demanda.id);

    return Response.json({
      test: 'resposta_obsoleta_nao_aplicada',
      snapshot_antes: snapshotAntes,
      snapshot_depois: snapshotDepois,
      reconciler_result: reconcilerResult,
      validacoes,
      all_pass: Object.values(validacoes).every(v => v === true),
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});

async function capturarEstado(sdk, entregaId, itemId) {
  const versoes = await sdk.entities.VersaoEntregaDemanda.filter({ entrega_demanda_id: entregaId }, 'created_date', 20);
  const entrega = (await sdk.entities.EntregaDemanda.filter({ id: entregaId }))[0];
  const item = (await sdk.entities.ItemDemanda.filter({ id: itemId }))[0];
  const respostas = await sdk.entities.RespostaAprovacaoEntrega.filter({ entrega_id: entregaId }, 'created_date', 50);
  const timeline = await sdk.entities.TimelineEvent.filter({ entrega_demanda_id: entregaId }, 'created_date', 50);
  const notifs = await sdk.entities.NotificacaoAprovacao.filter({ entrega_id: entregaId }, 'created_date', 50);
  return {
    versoes: versoes.map(v => ({ uid: v.versao_uid.slice(0, 8), status: v.status, canonico: v.status_canonico, num: v.numero_exibicao })),
    entrega_cache: { uid: entrega?.versao_atual_uid_cache?.slice(0, 8), status: entrega?.status_entrega_cache, num: entrega?.numero_versao_atual_cache },
    item_status: item?.status_aprovacao,
    respostas: respostas.map(r => ({ id: r.id.slice(0, 8) + '...', tipo: r.tipo_resposta, status: r.status_aplicacao, versao: r.versao_uid?.slice(0, 8), data: r.data_resposta })),
    timeline_count: timeline.length,
    notificacoes_count: notifs.length,
  };
}

async function limparTeste(sdk, entregaId, itemId, demandaId) {
  const versoes = await sdk.entities.VersaoEntregaDemanda.filter({ entrega_demanda_id: entregaId }, 'created_date', 20);
  const ops = await sdk.entities.OperacaoEntrega.filter({ entrega_id: entregaId }, 'created_date', 50);
  const respostas = await sdk.entities.RespostaAprovacaoEntrega.filter({ entrega_id: entregaId }, 'created_date', 50);
  const timeline = await sdk.entities.TimelineEvent.filter({ entrega_demanda_id: entregaId }, 'created_date', 50);
  const notifs = await sdk.entities.NotificacaoAprovacao.filter({ entrega_id: entregaId }, 'created_date', 50);
  for (const n of notifs) await sdk.entities.NotificacaoAprovacao.delete(n.id);
  for (const t of timeline) await sdk.entities.TimelineEvent.delete(t.id);
  for (const r of respostas) await sdk.entities.RespostaAprovacaoEntrega.delete(r.id);
  for (const o of ops) await sdk.entities.OperacaoEntrega.delete(o.id);
  for (const v of versoes) await sdk.entities.VersaoEntregaDemanda.delete(v.id);
  await sdk.entities.EntregaDemanda.delete(entregaId);
  await sdk.entities.ItemDemanda.delete(itemId);
  await sdk.entities.Demanda.delete(demandaId);
}