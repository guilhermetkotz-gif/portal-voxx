import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import {
  determinarVersaoCanonica,
  verificarOperacaoExistente,
  hashPayload,
  gerarUUID,
  gerarTokenPublico,
  versaoStatusToItemStatus,
  versaoStatusToEntregaStatus,
} from '../../shared/versaoCanonica.ts';

/**
 * Fase 2 — Entregas, versões e aprovação individual por ItemDemanda.
 *
 * Centraliza todas as operações de entrega/aprovação para demandas compostas.
 * O frontend NUNCA altera diretamente status_aprovacao do ItemDemanda —
 * somente esta função pode fazê-lo, após validação completa.
 *
 * Actions:
 *  - listar_entregas_item    : lista entregas (versões) de um item
 *  - criar_entrega_item      : cria primeira versão de entrega para um item
 *  - criar_nova_versao        : cria nova versão (arquiva a atual)
 *  - enviar_para_aprovacao   : ativa link e status → aguardando
 *  - solicitar_ajustes       : status → ajustes_solicitados (uso interno VOXX)
 *  - aprovar_item             : status → aprovado
 *  - reabrir_aprovado         : reabre item aprovado (exige confirmação)
 *  - excluir_rascunho        : remove entrega em rascunho sem histórico
 */

const VALID_STATUS_APROVACAO = ['nao_enviado', 'aguardando', 'ajustes_solicitados', 'reenviado', 'aprovado'];
const VALID_STATUS_VERSAO = ['substituida', 'arquivada', 'aprovada_anteriormente', 'reprovada', 'ativa'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Usuário não autenticado.' }, { status: 401 });
    }

    const tipoUsuario = user.tipo_usuario || user.tipo_acesso || '';
    const isVoxxUser = tipoUsuario.startsWith('voxx_') || user.role === 'admin';
    if (!isVoxxUser) {
      return Response.json({ error: 'Acesso negado. Apenas usuários VOXX podem gerenciar entregas.' }, { status: 403 });
    }

    const sdk = base44.asServiceRole;
    const body = await req.json();
    const { action } = body;

    const getEstrutura = (d) => {
      if (!d) return 'legada';
      const v = d.estrutura_demanda;
      if (v === null || v === undefined || v === '') return 'legada';
      return v;
    };

    // Helper: valida acesso à demanda + retorna demanda
    const validateDemanda = async (demandaId) => {
      const arr = await sdk.entities.Demanda.filter({ id: demandaId }).catch(() => []);
      const demanda = arr[0];
      if (!demanda) return { ok: false, error: 'Demanda não encontrada.', status: 404 };
      return { ok: true, demanda };
    };

    // Helper: valida item existe, pertence à demanda, e demanda é composta
    const validateItemComposta = async (itemId, demandaId) => {
      const itemArr = await sdk.entities.ItemDemanda.filter({ id: itemId }).catch(() => []);
      const item = itemArr[0];
      if (!item) return { ok: false, error: 'Item não encontrado.', status: 404 };

      if (item.demanda_id !== demandaId) {
        return { ok: false, error: 'Item não pertence à demanda informada.', status: 400 };
      }

      const access = await validateDemanda(demandaId);
      if (!access.ok) return access;
      const estrutura = getEstrutura(access.demanda);
      if (estrutura !== 'composta') {
        return { ok: false, error: `Entregas por item são permitidas apenas em demandas compostas (atual: ${estrutura}).`, status: 400 };
      }
      return { ok: true, item, demanda: access.demanda };
    };

    // Helper: gera token público único
    const gerarToken = () =>
      Math.random().toString(36).substring(2, 10) +
      Date.now().toString(36) +
      Math.random().toString(36).substring(2, 8);

    // Helper: registra TimelineEvent com vínculo de item/entrega
    const timeline = (demandaId, clienteId, tipo, descricao, autor, autorTipo, itemId, entregaId, extra) =>
      sdk.entities.TimelineEvent.create({
        demanda_id: demandaId,
        cliente_id: clienteId,
        item_demanda_id: itemId || null,
        entrega_demanda_id: entregaId || null,
        tipo,
        descricao,
        autor: autor || null,
        autor_tipo: autorTipo || 'voxx',
        ...(extra || {}),
      }).catch(() => null);

    const agora = new Date().toISOString();
    const usuarioNome = user.full_name || user.email;

    // ── V2 HELPERS (modelo entidade_versao) ──
    const iniciarOperacao = async (params) => {
      const operacaoId = gerarUUID();
      await sdk.entities.OperacaoEntrega.create({
        operacao_id: operacaoId,
        idempotency_key: params.idempotency_key || null,
        entrega_id: params.entrega_id || null,
        item_demanda_id: params.item_demanda_id || null,
        tipo_operacao: params.tipo_operacao,
        payload_hash: params.payload_hash || null,
        status_operacao: 'em_execucao',
        etapa_atual: 'operacao_criada',
        iniciada_em: new Date().toISOString(),
        iniciada_por: usuarioNome,
        iniciada_por_id: user.id,
        falhas: [],
      });
      return operacaoId;
    };

    const concluirOperacao = async (operacaoId, versaoUid, etapa) => {
      const ops = await sdk.entities.OperacaoEntrega.filter({ operacao_id: operacaoId });
      if (ops[0]) {
        await sdk.entities.OperacaoEntrega.update(ops[0].id, {
          status_operacao: 'concluida',
          etapa_atual: etapa || 'concluida',
          versao_uid: versaoUid || null,
          concluida_em: new Date().toISOString(),
        });
      }
    };

    const atualizarCachesEntrega = async (entregaId, versaoCanonica) => {
      const numeroVersao = versaoCanonica.numero_exibicao_calculado || versaoCanonica.numero_exibicao || 1;
      const statusCache = versaoStatusToEntregaStatus(versaoCanonica.status);
      await sdk.entities.EntregaDemanda.update(entregaId, {
        versao_atual_uid_cache: versaoCanonica.versao_uid,
        numero_versao_atual_cache: numeroVersao,
        status_entrega_cache: statusCache,
        token_publico_cache: versaoCanonica.token_publico,
        ultima_sincronizacao_em: new Date().toISOString(),
      });
    };

    const cachearResultado = async (operacaoId, resultado) => {
      const ops = await sdk.entities.OperacaoEntrega.filter({ operacao_id: operacaoId });
      if (ops[0]) {
        await sdk.entities.OperacaoEntrega.update(ops[0].id, { resultado });
      }
    };

    // ─────────────────────────────────────────────────────────
    // V2 ROUTING (modelo entidade_versao — Fase 2A)
    // Tenta handler V2 primeiro. Se retornar Response, retorna-o.
    // Se retornar null, cai para lógica embutida existente (não alterada).
    // ─────────────────────────────────────────────────────────
    const handleV2 = async (action, body) => {

      // ── listar_entregas_item V2 ──
      if (action === 'listar_entregas_item') {
        const { item_id, demanda_id } = body;
        if (!item_id || !demanda_id) return null;
        const v = await validateItemComposta(item_id, demanda_id);
        if (!v.ok) return null;

        const v2Entregas = await sdk.entities.EntregaDemanda.filter(
          { item_demanda_id: item_id, modelo_versionamento: 'entidade_versao' },
          '-created_date', 5
        );
        if (v2Entregas.length === 0) return null;

        const entregaAgrupadora = v2Entregas[0];
        const canonico = await determinarVersaoCanonica(sdk, entregaAgrupadora.id);
        const vc = canonico.versao_canonica;

        const versoesAnteriores = canonico.versoes_validas
          .filter(ver => ver.versao_uid !== vc?.versao_uid)
          .map(ver => ({
            id: ver.id, versao_uid: ver.versao_uid,
            numero_versao_atual: ver.numero_exibicao_calculado,
            nome_entrega: ver.nome_entrega,
            status_entrega: ver.status,
            data_envio: ver.enviada_em,
          }));

        return Response.json({
          entregas: [{
            id: entregaAgrupadora.id,
            demanda_id: entregaAgrupadora.demanda_id,
            item_demanda_id: entregaAgrupadora.item_demanda_id,
            item_titulo: entregaAgrupadora.item_titulo,
            cliente_id: entregaAgrupadora.cliente_id,
            cliente_nome: entregaAgrupadora.cliente_nome,
            nome_entrega: vc?.nome_entrega || entregaAgrupadora.nome_entrega,
            descricao: vc?.descricao || entregaAgrupadora.descricao,
            tipo_entrega: vc?.tipo_entrega || entregaAgrupadora.tipo_entrega,
            status_entrega: vc ? versaoStatusToEntregaStatus(vc.status) : 'rascunho',
            arquivos: vc?.arquivos || [],
            link_externo: vc?.link_externo || null,
            observacao_voxx: vc?.observacao_voxx || null,
            observacao_cliente: null,
            observacao_interna: vc?.observacao_interna || null,
            versao_ativa: true,
            numero_versao_atual: canonico.numero_versao_canonica || 1,
            token_publico: vc?.token_publico || null,
            link_publico_aprovacao: vc?.token_publico
              ? `${req.headers.get('origin') || ''}/aprovacao/${vc.token_publico}` : null,
            link_ativo: vc?.status === 'em_aprovacao' || vc?.status === 'reenviado',
            data_envio: vc?.enviada_em || null,
            usuario_envio_nome: vc?.criada_por || null,
            historico_aprovacoes: [],
            modelo_versionamento: 'entidade_versao',
            versao_uid: vc?.versao_uid || null,
            tem_concorrencia: canonico.tem_concorrencia,
            versoes_anteriores: versoesAnteriores,
          }],
        });
      }

      // ── criar_entrega_item V2 ──
      if (action === 'criar_entrega_item' && body.modelo_versionamento === 'entidade_versao') {
        const { item_id, demanda_id, nome_entrega, descricao, tipo_entrega, arquivos, link_externo, observacao_interna, observacao_voxx } = body;
        if (!item_id || !demanda_id || !nome_entrega?.trim() || !tipo_entrega || !arquivos || arquivos.length === 0) return null;

        const v = await validateItemComposta(item_id, demanda_id);
        if (!v.ok) return null;
        const { item, demanda } = v;

        // Proteção de escopo: modelo entidade_versao autorizado apenas para demanda específica
        const DEMANDA_AUTORIZADA_V2 = '6a5e51c1f77aa0ea68dd3e42';
        if (demanda.id !== DEMANDA_AUTORIZADA_V2) {
          return Response.json({
            error: 'Modelo de versionamento entidade_versao não autorizado para esta demanda.',
            code: 'MODELO_VERSIONAMENTO_NAO_AUTORIZADO',
          }, { status: 403 });
        }

        const idempotencyKey = body.idempotency_key || gerarUUID();
        const payloadHash = await hashPayload({ nome_entrega, arquivos, link_externo, tipo_entrega, observacao_voxx });
        const existente = await verificarOperacaoExistente(sdk, idempotencyKey, 'criar_entrega', null, payloadHash);
        if (existente.existe && existente.status === 'concluida' && existente.resultado) return Response.json(existente.resultado);
        if (existente.existe && ['iniciada', 'em_execucao'].includes(existente.status)) return Response.json({ error: 'Operação em andamento.', code: 'OPERACAO_EM_ANDAMENTO' }, { status: 409 });

        const existentesV2 = await sdk.entities.EntregaDemanda.filter({ item_demanda_id: item_id, modelo_versionamento: 'entidade_versao' }, '-created_date', 5);
        if (existentesV2.length > 0) return Response.json({ error: 'Já existe uma entrega para este item. Use criar_nova_versao.', code: 'ENTREGA_EXISTENTE' }, { status: 409 });

        const operacaoId = await iniciarOperacao({ idempotency_key: idempotencyKey, item_demanda_id: item_id, tipo_operacao: 'criar_entrega', payload_hash: payloadHash });
        const versaoUid = gerarUUID();
        const token = gerarTokenPublico();

        const novaEntrega = await sdk.entities.EntregaDemanda.create({
          demanda_id, demanda_titulo: demanda.titulo, item_demanda_id: item_id, item_titulo: item.titulo,
          cliente_id: demanda.cliente_id, cliente_nome: demanda.cliente_nome,
          nome_entrega: nome_entrega.trim(), descricao: descricao || null, tipo_entrega,
          status_entrega: 'rascunho', arquivos: arquivos || [], link_externo: link_externo || null,
          observacao_interna: observacao_interna || null, observacao_voxx: observacao_voxx || null,
          modelo_versionamento: 'entidade_versao', versao_atual_uid_cache: versaoUid,
          numero_versao_atual_cache: 1, status_entrega_cache: 'rascunho', token_publico_cache: token,
          tem_conflito_versao: false, ultima_sincronizacao_em: agora, retorno_cliente_tratado: true,
          usuario_envio_id: user.id, usuario_envio: user.email, usuario_envio_nome: usuarioNome,
        });

        const novaVersao = await sdk.entities.VersaoEntregaDemanda.create({
          versao_uid: versaoUid, entrega_demanda_id: novaEntrega.id, item_demanda_id: item_id, demanda_id,
          cliente_id: demanda.cliente_id, operacao_id: operacaoId, idempotency_key: idempotencyKey,
          payload_hash: payloadHash, numero_exibicao: 1, nome_entrega: nome_entrega.trim(),
          descricao: descricao || null, tipo_entrega, arquivos: arquivos || [], link_externo: link_externo || null,
          observacao_voxx: observacao_voxx || null, observacao_interna: observacao_interna || null,
          token_publico: token, criada_em: agora, criada_por: usuarioNome, criada_por_id: user.id,
          status: 'rascunho', status_canonico: 'ativa',
        });

        await concluirOperacao(operacaoId, versaoUid, 'versao_criada');

        if (item.status_aprovacao && item.status_aprovacao !== 'nao_enviado') {
          await sdk.entities.ItemDemanda.update(item_id, { status_aprovacao: 'nao_enviado' });
        }

        await timeline(demanda.id, demanda.cliente_id, 'entrega_criada',
          `📦 Entrega criada para "${item.titulo}": ${nome_entrega.trim()} (v1) [entidade_versao]`,
          usuarioNome, 'voxx', item_id, novaEntrega.id, { versao_uid: versaoUid });

        const resultado = { entrega: { ...novaEntrega, versao_uid: versaoUid, modelo_versionamento: 'entidade_versao' }, versao: novaVersao, operacao_id: operacaoId };
        await cachearResultado(operacaoId, resultado);
        return Response.json(resultado);
      }

      // ── criar_nova_versao V2 ──
      if (action === 'criar_nova_versao') {
        const { item_id, demanda_id } = body;
        if (!item_id || !demanda_id) return null;
        const v = await validateItemComposta(item_id, demanda_id);
        if (!v.ok) return null;
        const { item, demanda } = v;

        const v2Entregas = await sdk.entities.EntregaDemanda.filter({ item_demanda_id: item_id, modelo_versionamento: 'entidade_versao' }, '-created_date', 5);
        if (v2Entregas.length === 0) return null;

        const entrega = v2Entregas[0];
        const { nome_entrega, descricao, tipo_entrega, arquivos, link_externo, observacao_interna, observacao_voxx, confirmar_reabertura } = body;
        if (!nome_entrega?.trim() || !tipo_entrega || !arquivos || arquivos.length === 0) return null;

        const canonico = await determinarVersaoCanonica(sdk, entrega.id);
        const versaoAtual = canonico.versao_canonica;
        if (!versaoAtual) return Response.json({ error: 'Não existe versão ativa. Use criar_entrega_item.', code: 'SEM_VERSAO_ATIVA' }, { status: 400 });

        if (versaoAtual.status === 'aprovado' && !confirmar_reabertura) {
          return Response.json({ error: 'A versão atual está aprovada. Criar uma nova versão reabrirá a aprovação. Confirme com confirmar_reabertura=true.', code: 'REABERTURA_APROVADO_REQUER_CONFIRMACAO' }, { status: 409 });
        }

        const idempotencyKey = body.idempotency_key || gerarUUID();
        const payloadHash = await hashPayload({ nome_entrega, arquivos, link_externo, tipo_entrega, observacao_voxx });
        const existente = await verificarOperacaoExistente(sdk, idempotencyKey, 'criar_nova_versao', entrega.id, payloadHash);
        if (existente.existe && existente.status === 'concluida' && existente.resultado) return Response.json(existente.resultado);
        if (existente.existe && ['iniciada', 'em_execucao'].includes(existente.status)) return Response.json({ error: 'Operação em andamento.', code: 'OPERACAO_EM_ANDAMENTO' }, { status: 409 });

        const operacaoId = await iniciarOperacao({ idempotency_key: idempotencyKey, entrega_id: entrega.id, item_demanda_id: item_id, tipo_operacao: 'criar_nova_versao', payload_hash: payloadHash });
        const versaoUid = gerarUUID();
        const token = gerarTokenPublico();
        const novoNumero = (canonico.total_validas || 1) + 1;

        const novaVersao = await sdk.entities.VersaoEntregaDemanda.create({
          versao_uid: versaoUid, entrega_demanda_id: entrega.id, item_demanda_id: item_id, demanda_id,
          cliente_id: demanda.cliente_id, operacao_id: operacaoId, idempotency_key: idempotencyKey,
          payload_hash: payloadHash, numero_exibicao: novoNumero, nome_entrega: nome_entrega.trim(),
          descricao: descricao || null, tipo_entrega, arquivos: arquivos || [], link_externo: link_externo || null,
          observacao_voxx: observacao_voxx || null, observacao_interna: observacao_interna || null,
          token_publico: token, criada_em: agora, criada_por: usuarioNome, criada_por_id: user.id,
          status: 'rascunho', status_canonico: 'ativa',
        });

        await sdk.entities.VersaoEntregaDemanda.update(versaoAtual.id, {
          status_canonico: 'substituida', substituida_em: agora, substituida_por_versao_uid: versaoUid,
        });

        await atualizarCachesEntrega(entrega.id, { ...novaVersao, numero_exibicao_calculado: novoNumero });
        // Item permanece ajustes_solicitados — nova versão em rascunho não altera status do item
        await concluirOperacao(operacaoId, versaoUid, 'nova_versao_criada');

        await timeline(demanda.id, demanda.cliente_id, 'nova_versao_enviada',
          `🔄 Nova versão (v${novoNumero}) criada para "${item.titulo}" [entidade_versao]`,
          usuarioNome, 'voxx', item_id, entrega.id, { versao_uid: versaoUid });

        if (versaoAtual.status === 'aprovado') {
          await timeline(demanda.id, demanda.cliente_id, 'item_reaberto',
            `🔓 Item "${item.titulo}" reaberto — v${versaoAtual.numero_exibicao_calculado || versaoAtual.numero_exibicao} aprovada substituída por v${novoNumero}`,
            usuarioNome, 'voxx', item_id, entrega.id, { versao_uid: versaoUid });
        }

        const resultado = { entrega: { ...entrega, versao_uid: versaoUid }, versao: novaVersao, operacao_id: operacaoId, versao_anterior_uid: versaoAtual.versao_uid };
        await cachearResultado(operacaoId, resultado);
        return Response.json(resultado);
      }

      // ── Actions que operam sobre entrega existente por entrega_id ──
      if (['enviar_para_aprovacao', 'solicitar_ajustes', 'aprovar_item', 'reabrir_aprovado', 'excluir_rascunho'].includes(action)) {
        const { entrega_id, item_id, demanda_id } = body;
        if (!entrega_id || !item_id || !demanda_id) return null;

        const v = await validateItemComposta(item_id, demanda_id);
        if (!v.ok) return null;
        const { item, demanda } = v;

        const entregaArr = await sdk.entities.EntregaDemanda.filter({ id: entrega_id });
        const entrega = entregaArr[0];
        if (!entrega) return null;
        if (entrega.modelo_versionamento !== 'entidade_versao') return null;
        if (entrega.item_demanda_id !== item_id) return null;

        const canonico = await determinarVersaoCanonica(sdk, entrega.id);
        const versaoAtual = canonico.versao_canonica;

        // ── enviar_para_aprovacao V2 ──
        // Aceita somente status rascunho. v1 → em_aprovacao; v2+ → reenviado.
        if (action === 'enviar_para_aprovacao') {
          if (!versaoAtual) return Response.json({ error: 'Não existe versão ativa.', code: 'SEM_VERSAO_ATIVA' }, { status: 400 });
          if (versaoAtual.status === 'reenviado') return Response.json({ error: 'Uma versão reenviado já está em avaliação.', code: 'REENVIADO_JA_ESTA_EM_AVALIACAO' }, { status: 400 });
          if (versaoAtual.status !== 'rascunho') return Response.json({ error: `Status atual (${versaoAtual.status}) não permite envio. Apenas rascunho é aceito.`, code: 'STATUS_NAO_PERMITE_ENVIO' }, { status: 400 });
          if (!versaoAtual.arquivos?.length && !versaoAtual.link_externo) return Response.json({ error: 'Versão sem arquivos ou link.' }, { status: 400 });

          // Listar todas as versões para determinar se é primeira versão ou reenvio
          const todasVersoes = canonico.versoes_validas || [];
          const temVersaoAnterior = todasVersoes.some(v => v.versao_uid !== versaoAtual.versao_uid);

          const operacaoId = await iniciarOperacao({ entrega_id: entrega.id, item_demanda_id: item_id, tipo_operacao: 'enviar_aprovacao', idempotency_key: body.idempotency_key });

          let novoStatusVersao, novoStatusItem;
          if (!temVersaoAnterior) {
            novoStatusVersao = 'em_aprovacao';
            novoStatusItem = 'aguardando';
          } else {
            novoStatusVersao = 'reenviado';
            novoStatusItem = 'reenviado';
          }

          await sdk.entities.VersaoEntregaDemanda.update(versaoAtual.id, { status: novoStatusVersao, enviada_em: agora });
          await sdk.entities.ItemDemanda.update(item_id, { status_aprovacao: novoStatusItem });
          await atualizarCachesEntrega(entrega.id, { ...versaoAtual, status: novoStatusVersao });

          await sdk.entities.NotificacaoAprovacao.updateMany({ entrega_id: entrega.id, lida: false }, { $set: { lida: true, visualizada_em: agora } }).catch(() => null);
          await concluirOperacao(operacaoId, versaoAtual.versao_uid, 'enviada_aprovacao');

          await timeline(demanda.id, demanda.cliente_id, 'aprovacao_solicitada',
            `📤 ${usuarioNome} enviou "${item.titulo}" (v${canonico.numero_versao_canonica}) para aprovação [entidade_versao]`,
            usuarioNome, 'voxx', item_id, entrega.id, { versao_uid: versaoAtual.versao_uid });

          return Response.json({ success: true, entrega_id: entrega.id, status_entrega: novoStatusVersao, status_aprovacao_item: novoStatusItem, link_publico: versaoAtual.token_publico ? `${req.headers.get('origin') || ''}/aprovacao/${versaoAtual.token_publico}` : null, versao_uid: versaoAtual.versao_uid });
        }

        // ── solicitar_ajustes V2 ──
        if (action === 'solicitar_ajustes') {
          const { comentario } = body;
          if (!comentario?.trim()) return null;
          if (!versaoAtual) return Response.json({ error: 'Sem versão ativa.' }, { status: 400 });

          const operacaoId = await iniciarOperacao({ entrega_id: entrega.id, item_demanda_id: item_id, tipo_operacao: 'solicitar_ajustes', idempotency_key: body.idempotency_key });
          await sdk.entities.VersaoEntregaDemanda.update(versaoAtual.id, { status: 'solicitacao_alteracao' });
          await sdk.entities.ItemDemanda.update(item_id, { status_aprovacao: 'ajustes_solicitados' });
          await atualizarCachesEntrega(entrega.id, { ...versaoAtual, status: 'solicitacao_alteracao' });
          await sdk.entities.EntregaDemanda.update(entrega.id, { observacao_cliente: comentario.trim(), retorno_cliente_tratado: false });
          await concluirOperacao(operacaoId, versaoAtual.versao_uid, 'ajustes_solicitados');

          await timeline(demanda.id, demanda.cliente_id, 'ajustes_solicitados',
            `✏️ ${usuarioNome} solicitou ajustes em "${item.titulo}" (v${canonico.numero_versao_canonica}): "${comentario.trim()}" [entidade_versao]`,
            usuarioNome, 'voxx', item_id, entrega.id, { versao_uid: versaoAtual.versao_uid });

          return Response.json({ success: true, status_aprovacao_item: 'ajustes_solicitados', versao_uid: versaoAtual.versao_uid });
        }

        // ── aprovar_item V2 ──
        if (action === 'aprovar_item') {
          if (!versaoAtual) return Response.json({ error: 'Sem versão ativa.' }, { status: 400 });
          if (versaoAtual.status === 'aprovado') return Response.json({ error: 'Este item já está aprovado.', code: 'JA_APROVADO' }, { status: 400 });
          if (!['em_aprovacao', 'reenviado'].includes(versaoAtual.status)) return Response.json({ error: `Status atual (${versaoAtual.status}) não permite aprovação. Apenas em_aprovacao ou reenviado.`, code: 'STATUS_NAO_PERMITE_APROVACAO' }, { status: 400 });

          const operacaoId = await iniciarOperacao({ entrega_id: entrega.id, item_demanda_id: item_id, tipo_operacao: 'aprovar', idempotency_key: body.idempotency_key });
          await sdk.entities.VersaoEntregaDemanda.update(versaoAtual.id, { status: 'aprovado', aprovada_em: agora, aprovada_por: usuarioNome });
          await sdk.entities.ItemDemanda.update(item_id, { status_aprovacao: 'aprovado' });
          await atualizarCachesEntrega(entrega.id, { ...versaoAtual, status: 'aprovado' });
          await sdk.entities.EntregaDemanda.update(entrega.id, { data_aprovacao: agora, usuario_aprovacao: usuarioNome, retorno_cliente_tratado: true });
          await concluirOperacao(operacaoId, versaoAtual.versao_uid, 'aprovado');

          await timeline(demanda.id, demanda.cliente_id, 'versao_aprovada',
            `✅ ${usuarioNome} aprovou "${item.titulo}" (v${canonico.numero_versao_canonica}) [entidade_versao]`,
            usuarioNome, 'voxx', item_id, entrega.id, { versao_uid: versaoAtual.versao_uid });

          return Response.json({ success: true, status_aprovacao_item: 'aprovado', versao_uid: versaoAtual.versao_uid });
        }

        // ── reabrir_aprovado V2 ──
        if (action === 'reabrir_aprovado') {
          if (body.confirmacao !== 'confirmo_reabertura') return null;
          if (!versaoAtual) return Response.json({ error: 'Sem versão ativa.' }, { status: 400 });
          if (versaoAtual.status !== 'aprovado') return Response.json({ error: 'Apenas itens aprovados podem ser reabertos.', code: 'NAO_APROVADO' }, { status: 400 });

          const operacaoId = await iniciarOperacao({ entrega_id: entrega.id, item_demanda_id: item_id, tipo_operacao: 'reabrir_aprovado', idempotency_key: body.idempotency_key });
          await sdk.entities.VersaoEntregaDemanda.update(versaoAtual.id, { status: 'solicitacao_alteracao', aprovada_em: null, aprovada_por: null });
          await sdk.entities.ItemDemanda.update(item_id, { status_aprovacao: 'ajustes_solicitados' });
          await atualizarCachesEntrega(entrega.id, { ...versaoAtual, status: 'solicitacao_alteracao' });
          await sdk.entities.EntregaDemanda.update(entrega.id, { data_aprovacao: null, usuario_aprovacao: null, retorno_cliente_tratado: false });
          await concluirOperacao(operacaoId, versaoAtual.versao_uid, 'reaberto');

          await timeline(demanda.id, demanda.cliente_id, 'item_reaberto',
            `🔓 ${usuarioNome} reabriu "${item.titulo}" (v${canonico.numero_versao_canonica}) [entidade_versao]`,
            usuarioNome, 'voxx', item_id, entrega.id, { versao_uid: versaoAtual.versao_uid });

          return Response.json({ success: true, status_aprovacao_item: 'ajustes_solicitados', versao_uid: versaoAtual.versao_uid });
        }

        // ── excluir_rascunho V2 ──
        if (action === 'excluir_rascunho') {
          if (!versaoAtual) return Response.json({ error: 'Sem versão ativa.' }, { status: 400 });
          if (versaoAtual.status !== 'rascunho') return Response.json({ error: 'Não é possível excluir versão enviada. Use criar_nova_versao.', code: 'TEM_HISTORICO' }, { status: 400 });

          const respostas = await sdk.entities.RespostaAprovacaoEntrega.filter({ versao_entrega_demanda_id: versaoAtual.id }).catch(() => []);
          if (respostas.length > 0) return Response.json({ error: 'Não é possível excluir versão com respostas de cliente.', code: 'TEM_HISTORICO' }, { status: 400 });

          const operacaoId = await iniciarOperacao({ entrega_id: entrega.id, item_demanda_id: item_id, tipo_operacao: 'cancelar_envio', idempotency_key: body.idempotency_key });
          await sdk.entities.VersaoEntregaDemanda.update(versaoAtual.id, { status: 'cancelada', status_canonico: 'cancelada', cancelada_em: agora, motivo_cancelamento: 'Rascunho excluído por ' + usuarioNome });

          const restantes = await sdk.entities.VersaoEntregaDemanda.filter({ entrega_demanda_id: entrega.id, status_canonico: 'ativa' }, 'created_date', 10);
          if (restantes.length === 0) {
            await sdk.entities.EntregaDemanda.update(entrega.id, { status_entrega: 'arquivado', status_entrega_cache: 'arquivado', versao_atual_uid_cache: null, token_publico_cache: null, ultima_sincronizacao_em: agora });
          } else {
            const novoCanonico = await determinarVersaoCanonica(sdk, entrega.id);
            if (novoCanonico.versao_canonica) await atualizarCachesEntrega(entrega.id, novoCanonico.versao_canonica);
          }

          await concluirOperacao(operacaoId, versaoAtual.versao_uid, 'rascunho_excluido');
          await timeline(demanda.id, demanda.cliente_id, 'versao_cancelada',
            `🗑️ ${usuarioNome} excluiu o rascunho de "${item.titulo}" [entidade_versao]`,
            usuarioNome, 'voxx', item_id, entrega.id, { versao_uid: versaoAtual.versao_uid });

          return Response.json({ success: true, versao_uid: versaoAtual.versao_uid });
        }
      }

      return null; // Não tratado por V2 — cai para lógica embutida
    };

    // Tenta V2 primeiro; se retornar Response, retorna-o.
    const v2Response = await handleV2(action, body);
    if (v2Response) return v2Response;

    // =====================================================
    // ACTION: listar_entregas_item
    // =====================================================
    if (action === 'listar_entregas_item') {
      const { item_id, demanda_id } = body;
      if (!item_id || !demanda_id) {
        return Response.json({ error: 'item_id e demanda_id são obrigatórios.' }, { status: 400 });
      }
      const v = await validateItemComposta(item_id, demanda_id);
      if (!v.ok) return Response.json({ error: v.error }, { status: v.status });

      const entregas = await sdk.entities.EntregaDemanda.filter(
        { item_demanda_id: item_id },
        '-numero_versao_atual',
        100
      );
      // Ordenar por número_versao_atual decrescente (mais recente primeiro)
      const sorted = [...entregas].sort((a, b) => (b.numero_versao_atual || 0) - (a.numero_versao_atual || 0));
      return Response.json({ entregas: sorted });
    }

    // =====================================================
    // ACTION: criar_entrega_item — primeira versão de um item
    // =====================================================
    if (action === 'criar_entrega_item') {
      const {
        item_id, demanda_id,
        nome_entrega, descricao, tipo_entrega,
        arquivos, link_externo,
        observacao_interna, observacao_voxx,
      } = body;

      if (!item_id || !demanda_id) {
        return Response.json({ error: 'item_id e demanda_id são obrigatórios.' }, { status: 400 });
      }
      if (!nome_entrega?.trim()) {
        return Response.json({ error: 'nome_entrega é obrigatório.' }, { status: 400 });
      }
      if (!tipo_entrega) {
        return Response.json({ error: 'tipo_entrega é obrigatório.' }, { status: 400 });
      }
      if (!arquivos || arquivos.length === 0) {
        return Response.json({ error: 'Pelo menos um arquivo ou link é obrigatório para criar uma entrega.' }, { status: 400 });
      }

      const v = await validateItemComposta(item_id, demanda_id);
      if (!v.ok) return Response.json({ error: v.error }, { status: v.status });
      const { item, demanda } = v;

      // Impedir criação se já existe entrega ativa para o item
      const existentes = await sdk.entities.EntregaDemanda.filter(
        { item_demanda_id: item_id, versao_ativa: true },
        '-numero_versao_atual',
        5
      );
      if (existentes && existentes.length > 0) {
        return Response.json({
          error: 'Já existe uma versão ativa para este item. Use criar_nova_versao para substituí-la.',
          code: 'VERSAO_ATIVA_EXISTENTE',
        }, { status: 409 });
      }

      const token = gerarToken();
      const link = `${req.headers.get('origin') || ''}/aprovacao/${token}`;

      const novaEntrega = await sdk.entities.EntregaDemanda.create({
        demanda_id,
        demanda_titulo: demanda.titulo,
        item_demanda_id: item_id,
        item_titulo: item.titulo,
        cliente_id: demanda.cliente_id,
        cliente_nome: demanda.cliente_nome,
        nome_entrega: nome_entrega.trim(),
        descricao: descricao || null,
        tipo_entrega,
        arquivos: arquivos || [],
        link_externo: link_externo || null,
        observacao_interna: observacao_interna || null,
        observacao_voxx: observacao_voxx || null,
        status_entrega: 'rascunho',
        versao_ativa: true,
        numero_versao_atual: 1,
        versoes: [],
        historico_aprovacoes: [],
        token_publico: token,
        link_publico_aprovacao: link,
        link_ativo: false,
        retorno_cliente_tratado: true,
        usuario_envio_id: user.id,
        usuario_envio: user.email,
        usuario_envio_nome: usuarioNome,
      });

      // Atualizar ItemDemanda.status_aprovacao → nao_enviado (já é o default, mas garante)
      if (item.status_aprovacao && item.status_aprovacao !== 'nao_enviado') {
        await sdk.entities.ItemDemanda.update(item_id, { status_aprovacao: 'nao_enviado' });
      }

      await timeline(
        demanda.id, demanda.cliente_id,
        'entrega_criada',
        `📦 Entrega criada para o item "${item.titulo}": ${nome_entrega.trim()} (v1)`,
        usuarioNome, 'voxx', item_id, novaEntrega.id
      );

      return Response.json({ entrega: novaEntrega });
    }

    // =====================================================
    // ACTION: criar_nova_versao — arquiva versão atual, cria próxima
    // =====================================================
    if (action === 'criar_nova_versao') {
      const {
        item_id, demanda_id,
        nome_entrega, descricao, tipo_entrega,
        arquivos, link_externo,
        observacao_interna, observacao_voxx,
        confirmar_reabertura,
      } = body;

      if (!item_id || !demanda_id) {
        return Response.json({ error: 'item_id e demanda_id são obrigatórios.' }, { status: 400 });
      }
      if (!nome_entrega?.trim()) {
        return Response.json({ error: 'nome_entrega é obrigatório.' }, { status: 400 });
      }
      if (!tipo_entrega) {
        return Response.json({ error: 'tipo_entrega é obrigatório.' }, { status: 400 });
      }
      if (!arquivos || arquivos.length === 0) {
        return Response.json({ error: 'Pelo menos um arquivo ou link é obrigatório.' }, { status: 400 });
      }

      const v = await validateItemComposta(item_id, demanda_id);
      if (!v.ok) return Response.json({ error: v.error }, { status: v.status });
      const { item, demanda } = v;

      // Buscar versão ativa atual
      const atuais = await sdk.entities.EntregaDemanda.filter(
        { item_demanda_id: item_id, versao_ativa: true },
        '-numero_versao_atual',
        10
      );
      const entregaAtual = atuais[0];
      if (!entregaAtual) {
        return Response.json({ error: 'Não existe versão ativa para este item. Use criar_entrega_item.', code: 'SEM_VERSAO_ATIVA' }, { status: 400 });
      }

      // Se versão atual está aprovada, exige confirmação explícita de reabertura
      if (entregaAtual.status_entrega === 'aprovado' && !confirmar_reabertura) {
        return Response.json({
          error: 'A versão atual está aprovada. Criar uma nova versão reabrirá a aprovação. Confirme com confirmar_reabertura=true.',
          code: 'REABERTURA_APROVADO_REQUER_CONFIRMACAO',
        }, { status: 409 });
      }

      // Calcular próxima versão (max + 1) — protege contra concorrência
      const todasDoItem = await sdk.entities.EntregaDemanda.filter(
        { item_demanda_id: item_id },
        '-numero_versao_atual',
        200
      );
      const maxVersao = todasDoItem.reduce((max, e) => Math.max(max, e.numero_versao_atual || 0), 0);
      const proximoNumero = maxVersao + 1;

      // Impedir versão duplicada (re-check após calcular)
      const comMesmoNumero = todasDoItem.filter(e => (e.numero_versao_atual || 0) === proximoNumero);
      if (comMesmoNumero.length > 0) {
        return Response.json({ error: 'Conflito de versão: já existe uma versão com este número. Tente novamente.', code: 'CONFLITO_VERSAO' }, { status: 409 });
      }

      // Determinar status_versao da versão que está sendo arquivada
      let statusVersaoAntiga = 'substituida';
      if (entregaAtual.status_entrega === 'aprovado') statusVersaoAntiga = 'aprovada_anteriormente';
      else if (entregaAtual.status_entrega === 'solicitacao_alteracao') statusVersaoAntiga = 'reprovada';

      // Arquivar versão atual: marcar versao_ativa=false e preservar no array versoes[]
      const versoesArquivadas = [...(entregaAtual.versoes || [])];
      versoesArquivadas.push({
        numero: entregaAtual.numero_versao_atual || 1,
        arquivos: entregaAtual.arquivos || [],
        link_externo: entregaAtual.link_externo || '',
        data_upload: entregaAtual.data_envio || entregaAtual.created_date,
        usuario_nome: entregaAtual.usuario_envio_nome || '',
        observacao: entregaAtual.observacao_interna || '',
        status_versao: statusVersaoAntiga,
      });

      await sdk.entities.EntregaDemanda.update(entregaAtual.id, {
        versao_ativa: false,
        link_ativo: false,
        versoes: versoesArquivadas,
      });

      // Criar nova versão ativa — sempre status 'reenviado' (nova versão após ajustes/reabertura)
      const token = gerarToken();
      const link = `${req.headers.get('origin') || ''}/aprovacao/${token}`;

      const novaEntrega = await sdk.entities.EntregaDemanda.create({
        demanda_id,
        demanda_titulo: demanda.titulo,
        item_demanda_id: item_id,
        item_titulo: item.titulo,
        cliente_id: demanda.cliente_id,
        cliente_nome: demanda.cliente_nome,
        nome_entrega: nome_entrega.trim(),
        descricao: descricao || null,
        tipo_entrega,
        arquivos: arquivos || [],
        link_externo: link_externo || null,
        observacao_interna: observacao_interna || null,
        observacao_voxx: observacao_voxx || null,
        status_entrega: 'reenviado',
        versao_ativa: true,
        numero_versao_atual: proximoNumero,
        versoes: [],
        historico_aprovacoes: [],
        token_publico: token,
        link_publico_aprovacao: link,
        link_ativo: false,
        retorno_cliente_tratado: true,
        usuario_envio_id: user.id,
        usuario_envio: user.email,
        usuario_envio_nome: usuarioNome,
      });

      // Atualizar ItemDemanda.status_aprovacao → reenviado
      await sdk.entities.ItemDemanda.update(item_id, { status_aprovacao: 'reenviado' });

      await timeline(
        demanda.id, demanda.cliente_id,
        'nova_versao_enviada',
        `🔄 Nova versão (v${proximoNumero}) criada para o item "${item.titulo}"`,
        usuarioNome, 'voxx', item_id, novaEntrega.id
      );

      if (entregaAtual.status_entrega === 'aprovado') {
        await timeline(
          demanda.id, demanda.cliente_id,
          'item_reaberto',
          `🔓 Item "${item.titulo}" reaberto — versão v${entregaAtual.numero_versao_atual} aprovada foi substituída por v${proximoNumero}`,
          usuarioNome, 'voxx', item_id, entregaAtual.id
        );
      }

      return Response.json({ entrega: novaEntrega, versao_anterior_id: entregaAtual.id });
    }

    // =====================================================
    // ACTION: enviar_para_aprovacao — ativa link, status → aguardando
    // =====================================================
    if (action === 'enviar_para_aprovacao') {
      const { entrega_id, demanda_id, item_id } = body;
      if (!entrega_id || !demanda_id || !item_id) {
        return Response.json({ error: 'entrega_id, demanda_id e item_id são obrigatórios.' }, { status: 400 });
      }

      const v = await validateItemComposta(item_id, demanda_id);
      if (!v.ok) return Response.json({ error: v.error }, { status: v.status });
      const { item, demanda } = v;

      const entregaArr = await sdk.entities.EntregaDemanda.filter({ id: entrega_id });
      const entrega = entregaArr[0];
      if (!entrega) return Response.json({ error: 'Entrega não encontrada.' }, { status: 404 });

      // Validar vínculo item-demanda-entrega
      if (entrega.item_demanda_id !== item_id) {
        return Response.json({ error: 'Entrega não pertence ao item informado.' }, { status: 400 });
      }
      if (entrega.demanda_id !== demanda_id) {
        return Response.json({ error: 'Entrega não pertence à demanda informada.' }, { status: 400 });
      }

      // Validar que é a versão ativa
      if (!entrega.versao_ativa) {
        return Response.json({ error: 'Não é possível enviar uma versão arquivada para aprovação. Envie a versão ativa.', code: 'VERSAO_ARQUIVADA' }, { status: 400 });
      }

      // Validar arquivos
      if (!entrega.arquivos?.length && !entrega.link_externo) {
        return Response.json({ error: 'Entrega não possui arquivos ou link externo. Adicione material antes de enviar.' }, { status: 400 });
      }

      // Status permitidos para envio: rascunho, solicitacao_alteracao, reenviado
      const statusPermitidos = ['rascunho', 'solicitacao_alteracao', 'reenviado'];
      if (!statusPermitidos.includes(entrega.status_entrega)) {
        return Response.json({
          error: `Status atual (${entrega.status_entrega}) não permite envio para aprovação.`,
          code: 'STATUS_NAO_PERMITE_ENVIO',
        }, { status: 400 });
      }

      const eraReenvio = entrega.status_entrega === 'reenviado' || item.status_aprovacao === 'reenviado';

      // Reativar link se necessário (ou usar token existente)
      let token = entrega.token_publico;
      let link = entrega.link_publico_aprovacao;
      if (!token) {
        token = gerarToken();
        link = `${req.headers.get('origin') || ''}/aprovacao/${token}`;
      }

      await sdk.entities.EntregaDemanda.update(entrega.id, {
        token_publico: token,
        link_publico_aprovacao: link,
        link_ativo: true,
        status_entrega: 'em_aprovacao',
        data_envio: agora,
        usuario_envio_id: user.id,
        usuario_envio: user.email,
        usuario_envio_nome: usuarioNome,
        retorno_cliente_tratado: true,
      });

      // Atualizar ItemDemanda.status_aprovacao
      const novoStatusItem = eraReenvio ? 'reenviado' : 'aguardando';
      await sdk.entities.ItemDemanda.update(item_id, { status_aprovacao: novoStatusItem });

      // Limpar notificações pendentes de versão anterior
      await sdk.entities.NotificacaoAprovacao.updateMany(
        { entrega_id: entrega.id, lida: false },
        { $set: { lida: true, visualizada_em: agora } }
      ).catch(() => null);

      await timeline(
        demanda.id, demanda.cliente_id,
        'aprovacao_solicitada',
        `📤 ${usuarioNome} enviou o item "${item.titulo}" (v${entrega.numero_versao_atual}) para aprovação do cliente`,
        usuarioNome, 'voxx', item_id, entrega.id
      );

      return Response.json({
        success: true,
        entrega_id: entrega.id,
        status_entrega: 'em_aprovacao',
        status_aprovacao_item: novoStatusItem,
        link_publico: link,
      });
    }

    // =====================================================
    // ACTION: solicitar_ajustes — uso interno VOXX (antes do envio ao cliente)
    // =====================================================
    if (action === 'solicitar_ajustes') {
      const { entrega_id, demanda_id, item_id, comentario } = body;
      if (!entrega_id || !demanda_id || !item_id) {
        return Response.json({ error: 'entrega_id, demanda_id e item_id são obrigatórios.' }, { status: 400 });
      }
      if (!comentario?.trim()) {
        return Response.json({ error: 'comentario é obrigatório.' }, { status: 400 });
      }

      const v = await validateItemComposta(item_id, demanda_id);
      if (!v.ok) return Response.json({ error: v.error }, { status: v.status });
      const { item, demanda } = v;

      const entregaArr = await sdk.entities.EntregaDemanda.filter({ id: entrega_id });
      const entrega = entregaArr[0];
      if (!entrega) return Response.json({ error: 'Entrega não encontrada.' }, { status: 404 });
      if (entrega.item_demanda_id !== item_id) {
        return Response.json({ error: 'Entrega não pertence ao item informado.' }, { status: 400 });
      }

      const historico = [...(entrega.historico_aprovacoes || [])];
      historico.push({
        acao: 'solicitacao_alteracao',
        nome_responsavel: usuarioNome,
        observacao: comentario.trim(),
        data: agora,
        versao: entrega.numero_versao_atual || 1,
      });

      await sdk.entities.EntregaDemanda.update(entrega.id, {
        status_entrega: 'solicitacao_alteracao',
        observacao_cliente: comentario.trim(),
        historico_aprovacoes: historico,
        retorno_cliente_tratado: false,
      });

      // Atualizar ItemDemanda.status_aprovacao → ajustes_solicitados
      await sdk.entities.ItemDemanda.update(item_id, { status_aprovacao: 'ajustes_solicitados' });

      await timeline(
        demanda.id, demanda.cliente_id,
        'ajustes_solicitados',
        `✏️ ${usuarioNome} solicitou ajustes no item "${item.titulo}" (v${entrega.numero_versao_atual}): "${comentario.trim()}"`,
        usuarioNome, 'voxx', item_id, entrega.id
      );

      return Response.json({ success: true, status_aprovacao_item: 'ajustes_solicitados' });
    }

    // =====================================================
    // ACTION: aprovar_item — aprova versão atual (uso interno VOXX)
    // =====================================================
    if (action === 'aprovar_item') {
      const { entrega_id, demanda_id, item_id, comentario } = body;
      if (!entrega_id || !demanda_id || !item_id) {
        return Response.json({ error: 'entrega_id, demanda_id e item_id são obrigatórios.' }, { status: 400 });
      }

      const v = await validateItemComposta(item_id, demanda_id);
      if (!v.ok) return Response.json({ error: v.error }, { status: v.status });
      const { item, demanda } = v;

      const entregaArr = await sdk.entities.EntregaDemanda.filter({ id: entrega_id });
      const entrega = entregaArr[0];
      if (!entrega) return Response.json({ error: 'Entrega não encontrada.' }, { status: 404 });
      if (entrega.item_demanda_id !== item_id) {
        return Response.json({ error: 'Entrega não pertence ao item informado.' }, { status: 400 });
      }
      if (!entrega.versao_ativa) {
        return Response.json({ error: 'Não é possível aprovar uma versão arquivada.', code: 'VERSAO_ARQUIVADA' }, { status: 400 });
      }

      // Impedir aprovação duplicada
      if (entrega.status_entrega === 'aprovado') {
        return Response.json({ error: 'Este item já está aprovado.', code: 'JA_APROVADO' }, { status: 400 });
      }

      // Impedir aprovação se status não permite (ex: rascunho sem envio)
      if (entrega.status_entrega === 'rascunho') {
        return Response.json({ error: 'Não é possível aprovar uma entrega em rascunho. Envie para aprovação primeiro.', code: 'STATUS_NAO_PERMITE_APROVACAO' }, { status: 400 });
      }

      const historico = [...(entrega.historico_aprovacoes || [])];
      historico.push({
        acao: 'aprovar',
        nome_responsavel: usuarioNome,
        observacao: comentario?.trim() || '',
        data: agora,
        versao: entrega.numero_versao_atual || 1,
      });

      await sdk.entities.EntregaDemanda.update(entrega.id, {
        status_entrega: 'aprovado',
        data_aprovacao: agora,
        usuario_aprovacao: usuarioNome,
        historico_aprovacoes: historico,
        retorno_cliente_tratado: true,
      });

      // Atualizar ItemDemanda.status_aprovacao → aprovado
      await sdk.entities.ItemDemanda.update(item_id, { status_aprovacao: 'aprovado' });

      await timeline(
        demanda.id, demanda.cliente_id,
        'versao_aprovada',
        `✅ ${usuarioNome} aprovou o item "${item.titulo}" (v${entrega.numero_versao_atual})`,
        usuarioNome, 'voxx', item_id, entrega.id
      );

      return Response.json({ success: true, status_aprovacao_item: 'aprovado' });
    }

    // =====================================================
    // ACTION: reabrir_aprovado — reabre item aprovado (exige confirmação)
    // =====================================================
    if (action === 'reabrir_aprovado') {
      const { entrega_id, demanda_id, item_id, confirmacao } = body;
      if (!entrega_id || !demanda_id || !item_id) {
        return Response.json({ error: 'entrega_id, demanda_id e item_id são obrigatórios.' }, { status: 400 });
      }
      if (confirmacao !== 'confirmo_reabertura') {
        return Response.json({ error: 'Confirmação explícita necessária para reabrir item aprovado.', code: 'REABERTURA_REQUER_CONFIRMACAO' }, { status: 400 });
      }

      const v = await validateItemComposta(item_id, demanda_id);
      if (!v.ok) return Response.json({ error: v.error }, { status: v.status });
      const { item, demanda } = v;

      const entregaArr = await sdk.entities.EntregaDemanda.filter({ id: entrega_id });
      const entrega = entregaArr[0];
      if (!entrega) return Response.json({ error: 'Entrega não encontrada.' }, { status: 404 });
      if (entrega.item_demanda_id !== item_id) {
        return Response.json({ error: 'Entrega não pertence ao item informado.' }, { status: 400 });
      }
      if (entrega.status_entrega !== 'aprovado') {
        return Response.json({ error: 'Apenas itens aprovados podem ser reabertos.', code: 'NAO_APROVADO' }, { status: 400 });
      }

      await sdk.entities.EntregaDemanda.update(entrega.id, {
        status_entrega: 'solicitacao_alteracao',
        data_aprovacao: null,
        usuario_aprovacao: null,
        retorno_cliente_tratado: false,
      });

      await sdk.entities.ItemDemanda.update(item_id, { status_aprovacao: 'ajustes_solicitados' });

      await timeline(
        demanda.id, demanda.cliente_id,
        'item_reaberto',
        `🔓 ${usuarioNome} reabriu o item "${item.titulo}" (v${entrega.numero_versao_atual}) que estava aprovado`,
        usuarioNome, 'voxx', item_id, entrega.id
      );

      return Response.json({ success: true, status_aprovacao_item: 'ajustes_solicitados' });
    }

    // =====================================================
    // ACTION: excluir_rascunho — remove entrega em rascunho sem histórico
    // =====================================================
    if (action === 'excluir_rascunho') {
      const { entrega_id, demanda_id, item_id } = body;
      if (!entrega_id || !demanda_id || !item_id) {
        return Response.json({ error: 'entrega_id, demanda_id e item_id são obrigatórios.' }, { status: 400 });
      }

      const v = await validateItemComposta(item_id, demanda_id);
      if (!v.ok) return Response.json({ error: v.error }, { status: v.status });
      const { item, demanda } = v;

      const entregaArr = await sdk.entities.EntregaDemanda.filter({ id: entrega_id });
      const entrega = entregaArr[0];
      if (!entrega) return Response.json({ error: 'Entrega não encontrada.' }, { status: 404 });
      if (entrega.item_demanda_id !== item_id) {
        return Response.json({ error: 'Entrega não pertence ao item informado.' }, { status: 400 });
      }

      // Impedir exclusão se houve envio, aprovação, comentário ou histórico de cliente
      if (entrega.status_entrega !== 'rascunho') {
        return Response.json({ error: 'Não é possível excluir uma entrega que já foi enviada, aprovada ou tem histórico. Use criar_nova_versao para substituir.', code: 'TEM_HISTORICO' }, { status: 400 });
      }
      if (entrega.historico_aprovacoes?.length > 0) {
        return Response.json({ error: 'Não é possível excluir uma entrega com histórico de aprovação.', code: 'TEM_HISTORICO' }, { status: 400 });
      }

      await sdk.entities.EntregaDemanda.delete(entrega_id);

      await timeline(
        demanda.id, demanda.cliente_id,
        'acao_voxx',
        `🗑️ ${usuarioNome} excluiu o rascunho de entrega do item "${item.titulo}"`,
        usuarioNome, 'voxx', item_id, entrega_id
      );

      return Response.json({ success: true });
    }

    // =====================================================
    // ACTION: resumo_aprovacao_itens — resumo agregado de aprovação por demanda
    // =====================================================
    if (action === 'resumo_aprovacao_itens') {
      const { demanda_ids } = body;
      if (!Array.isArray(demanda_ids) || demanda_ids.length === 0) {
        return Response.json({ resumo_map: {} });
      }

      // Filtrar apenas demandas compostas
      const demandasArr = await sdk.entities.Demanda.filter({});
      const compostaIds = demandasArr
        .filter(d => demanda_ids.includes(d.id) && getEstrutura(d) === 'composta')
        .map(d => d.id);

      if (compostaIds.length === 0) {
        return Response.json({ resumo_map: {} });
      }

      const allItems = await sdk.entities.ItemDemanda.filter({});
      const visibleItems = allItems.filter(i => compostaIds.includes(i.demanda_id));

      const map = {};
      visibleItems.forEach(item => {
        if (!item.demanda_id) return;
        if (!map[item.demanda_id]) {
          map[item.demanda_id] = {
            total: 0, aprovados: 0, aguardando: 0,
            ajustes: 0, reenviado: 0, nao_enviado: 0,
          };
        }
        const r = map[item.demanda_id];
        if (item.status_finalizacao === 'cancelado') return;
        r.total++;
        const sa = item.status_aprovacao || 'nao_enviado';
        if (sa === 'aprovado') r.aprovados++;
        else if (sa === 'aguardando') r.aguardando++;
        else if (sa === 'ajustes_solicitados') r.ajustes++;
        else if (sa === 'reenviado') r.reenviado++;
        else r.nao_enviado++;
      });

      return Response.json({ resumo_map: map });
    }

    return Response.json({ error: `Action "${action}" não reconhecida.` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});