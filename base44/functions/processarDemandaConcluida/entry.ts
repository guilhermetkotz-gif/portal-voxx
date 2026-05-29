import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Inferir tipo_entrega automaticamente com base nos dados da demanda
function inferirTipoEntrega(demanda) {
  const sub = (demanda.subcategoria || '').toLowerCase();
  const setor = demanda.setor || '';

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

  // Prioridade 2: setor
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
function gerarResumoAutomatico(demanda) {
  if (demanda.resumo_entrega_cliente?.trim()) return demanda.resumo_entrega_cliente.trim();

  // Montar resumo a partir dos dados disponíveis
  const partes = [demanda.titulo];
  if (demanda.subcategoria) partes.push(`(${demanda.subcategoria})`);
  const setor = demanda.setor?.replace(/_/g, ' ').toLowerCase() || '';
  if (setor && !demanda.titulo.toLowerCase().includes(setor.split(' ')[0])) {
    partes.push(`— ${setor}`);
  }
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
    const demanda = data || await base44.asServiceRole.entities.Demanda.get(demandaId);

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

    // Verificar se já foi enviado para a fila
    if (demanda.comunicacao_enviada_fila) {
      return Response.json({ skipped: true, reason: 'ja na fila' });
    }

    // Verificar duplicata na fila
    const existing = await base44.asServiceRole.entities.FilaComunicacaoCliente.filter({
      origem_id: demandaId,
      status: 'aguardando'
    });
    if (existing.length > 0) {
      return Response.json({ skipped: true, reason: 'duplicata', fila_id: existing[0].id });
    }

    const tipoEntrega = inferirTipoEntrega(demanda);
    const resumo = gerarResumoAutomatico(demanda);
    const hoje = new Date().toISOString().split('T')[0];

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
      data_evento: hoje,
      usuario_responsavel: demanda.created_by || '',
      usuario_responsavel_nome: '',
      anexos: anexosCliente,
      status: 'aguardando'
    });

    // Marcar demanda como enviada à fila
    await base44.asServiceRole.entities.Demanda.update(demandaId, {
      comunicacao_enviada_fila: true
    });

    return Response.json({ success: true, fila_id: item.id, tipo_entrega: tipoEntrega, resumo });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});