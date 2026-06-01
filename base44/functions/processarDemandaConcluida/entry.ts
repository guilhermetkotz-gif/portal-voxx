import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Inferir tipo_entrega automaticamente com base nos dados da demanda
function inferirTipoEntrega(demanda) {
  const sub = (demanda.subcategoria || '').toLowerCase();
  // Prioridade: setor_responsavel_original, depois setor atual
  const setor = demanda.setor_responsavel_original || demanda.setor || '';

  // Prioridade 1: subcategoria
  if (sub) {
    if (/arte|imagem|criativo|peça|peca/.test(sub)) return 'Arte';
    if (/vídeo|video|edição|edicao|reels|shorts/.test(sub)) return 'Vídeo';
    if (/landing|lp|página|pagina/.test(sub)) return 'Landing Page';
    if (/google/.test(sub)) return 'Google Ads';
    if (/meta|facebook|instagram/.test(sub)) return 'Meta Ads';
    if (/relat|report|bi|dashboard/.test(sub)) return 'Relatório';
    if (/automaç|automacao/.test(sub)) return 'Automação';
    if (/atendimento|suporte/.test(sub)) return 'Atendimento';
    if (/estrateg|planejamento/.test(sub)) return 'Estratégia';
  }

  // Prioridade 2: setor original
  const setorMap = {
    CRIACAO: 'Arte',
    EDICAO: 'Vídeo',
    TRAFEGO_META: 'Meta Ads',
    TRAFEGO_GOOGLE: 'Google Ads',
    TRAFEGO_TIKTOK: 'Meta Ads',
    BI_RELATORIO: 'Relatório',
    AUTOMACAO: 'Automação',
    ATENDIMENTO: 'Atendimento',
    IMPLANTACAO: 'Estratégia',
    FINANCEIRO: 'Outro',
    SALDOS: 'Outro',
    ALTERACAO_CRIACAO: 'Arte'
  };
  return setorMap[setor] || 'Outro';
}

// Gerar resumo automaticamente se não preenchido
// Prioridade: 1º resumo_cliente, 2º resumo_entrega_cliente, 3º título da demanda
function gerarResumoAutomatico(demanda) {
  if (demanda.resumo_cliente?.trim()) return demanda.resumo_cliente.trim();
  if (demanda.resumo_entrega_cliente?.trim()) return demanda.resumo_entrega_cliente.trim();

  // Fallback: montar resumo a partir dos dados disponíveis
  const partes = [demanda.titulo];
  if (demanda.subcategoria) partes.push(`(${demanda.subcategoria})`);
  return partes.join(' ');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { event, data } = body;

    // Só processa update/create
    if (!event?.entity_id) {
      return Response.json({ skipped: true, reason: 'no entity_id' });
    }

    // Buscar a demanda atualizada
    const demandaId = event.entity_id;
    let demanda = data || null;
    if (!demanda && demandaId) {
      const results = await base44.asServiceRole.entities.Demanda.filter({ id: demandaId }, '-created_date', 1).catch(() => []);
      demanda = results[0] || null;
    }

    if (!demanda) {
      return Response.json({ skipped: true, reason: 'demanda not found' });
    }

    // Só processa se status é concluida ou finalizada E comunicar_cliente = true
    const statusValido = demanda.status === 'concluida' || demanda.status === 'finalizada';
    if (!statusValido) {
      return Response.json({ skipped: true, reason: `status: ${demanda.status}` });
    }

    if (!demanda.comunicar_cliente) {
      return Response.json({ skipped: true, reason: 'comunicar_cliente = false' });
    }


    if (demanda.tipo_comunicacao === 'Não Comunicar') {
      return Response.json({ skipped: true, reason: 'tipo_comunicacao = Não Comunicar' });
    }

    // Idempotência: verificar flags na própria demanda
    if (demanda.comunicacao_evento_gerado || demanda.comunicacao_enviada_fila) {
      return Response.json({ skipped: true, reason: 'evento_ja_gerado', evento_id: demanda.comunicacao_evento_id });
    }

    // Idempotência: verificar se já existe qualquer item na fila para esta demanda (qualquer status)
    const existing = await base44.asServiceRole.entities.FilaComunicacaoCliente.filter({
      origem: 'demanda',
      origem_id: demandaId
    });
    if (existing.length > 0) {
      // Sincronizar flags da demanda para evitar re-disparo futuro
      await base44.asServiceRole.entities.Demanda.update(demandaId, {
        comunicacao_enviada_fila: true,
        comunicacao_evento_gerado: true,
        comunicacao_evento_id: existing[0].id
      });
      return Response.json({ skipped: true, reason: 'duplicata_fila', fila_id: existing[0].id });
    }

    // Preencher data_conclusao se não estiver definida
    const agora = new Date().toISOString();
    if (!demanda.data_conclusao) {
      await base44.asServiceRole.entities.Demanda.update(demandaId, { data_conclusao: agora });
      demanda.data_conclusao = agora;
    }

    const tipoEntrega = inferirTipoEntrega(demanda);
    const resumo = gerarResumoAutomatico(demanda);
    const dataEvento = demanda.data_conclusao.split('T')[0];

    // Preparar anexos do cliente
    const anexosCliente = (demanda.anexos_cliente || []).filter(a => a.enviar_cliente !== false);

    // Adicionar à fila
    const item = await base44.asServiceRole.entities.FilaComunicacaoCliente.create({
      cliente_id: demanda.cliente_id,
      cliente_nome: demanda.cliente_nome || '',
      origem: 'demanda',
      origem_id: demandaId,
      tipo_evento: 'entrega',
      tipo_entrega: tipoEntrega,
      resumo,
      data_evento: dataEvento,
      usuario_responsavel: demanda.created_by || '',
      usuario_responsavel_nome: '',
      anexos: anexosCliente,
      status: 'aguardando'
    });

    // Marcar demanda com todos os flags de idempotência
    await base44.asServiceRole.entities.Demanda.update(demandaId, {
      comunicacao_enviada_fila: true,
      comunicacao_evento_gerado: true,
      comunicacao_evento_id: item.id,
      data_comunicacao_evento: agora
    });

    return Response.json({ success: true, fila_id: item.id, tipo_entrega: tipoEntrega, resumo });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});