import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

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