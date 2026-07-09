import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data, old_data } = body;

    const db = base44.asServiceRole;

    if (event.type === 'create') {
      // Nova demanda: abrir entrada no setor inicial
      if (data && data.setor) {
        await db.entities.DemandaHistoricoSetor.create({
          demanda_id: data.id,
          demanda_titulo: data.titulo || '',
          cliente_id: data.cliente_id || '',
          cliente_nome: data.cliente_nome || '',
          setor: data.setor,
          setor_anterior: null,
          status_entrada: data.status || 'recebida',
          data_entrada: new Date().toISOString(),
          minutos_no_setor: null,
          concluida: false,
        });
      }
    } else if (event.type === 'update' && data && old_data) {
      const setorMudou = old_data.setor !== data.setor;
      const foiConcluida =
        (data.status === 'concluida' || data.status === 'finalizada') &&
        old_data.status !== 'concluida' &&
        old_data.status !== 'finalizada';

      if (setorMudou || foiConcluida) {
        // Fechar a entrada aberta para esta demanda
        const todasEntradas = await db.entities.DemandaHistoricoSetor.filter({
          demanda_id: event.entity_id,
        });
        const entradaAberta = todasEntradas.find(e => !e.data_saida);

        if (entradaAberta) {
          const now = new Date();
          const entrada = new Date(entradaAberta.data_entrada);
          const minutos = Math.round((now - entrada) / 60000);

          await db.entities.DemandaHistoricoSetor.update(entradaAberta.id, {
            data_saida: now.toISOString(),
            minutos_no_setor: minutos,
            status_saida: data.status,
            concluida: foiConcluida,
          });
        }

        // Se mudou de setor, abrir nova entrada
        if (setorMudou && data.setor) {
          await db.entities.DemandaHistoricoSetor.create({
            demanda_id: event.entity_id,
            demanda_titulo: data.titulo || '',
            cliente_id: data.cliente_id || '',
            cliente_nome: data.cliente_nome || '',
            setor: data.setor,
            setor_anterior: old_data.setor || null,
            status_entrada: data.status || '',
            data_entrada: new Date().toISOString(),
            minutos_no_setor: null,
            concluida: false,
          });
        }

        // ── Limpar pendências e notificações de aprovação ──
        // Executa quando o card é movido de setor (ação tratada) OU quando
        // a demanda é concluída/finalizada (mesmo sem mudança de setor).
        if (setorMudou || foiConcluida) {
          try {
            const entregasDaDemanda = await db.entities.EntregaDemanda.filter({
              demanda_id: event.entity_id,
            });

            const entregasPendentes = entregasDaDemanda.filter(e =>
              (e.status_entrega === 'solicitacao_alteracao' || e.status_entrega === 'aprovado') &&
              e.retorno_cliente_tratado !== true
            );

            if (entregasPendentes.length > 0) {
              await db.entities.EntregaDemanda.bulkUpdate(
                entregasPendentes.map(e => ({ id: e.id, retorno_cliente_tratado: true }))
              );
              console.log(`[registrarMovimentacaoSetor] ✅ ${entregasPendentes.length} pendência(s) de aprovação tratada(s) para demanda ${event.entity_id}`);
            }

            // Marcar notificações de aprovação como lidas
            const notifsPendentes = await db.entities.NotificacaoAprovacao.filter({
              demanda_id: event.entity_id,
              lida: false,
            });

            if (notifsPendentes.length > 0) {
              await db.entities.NotificacaoAprovacao.updateMany(
                { demanda_id: event.entity_id, lida: false },
                { $set: { lida: true, visualizada_em: new Date().toISOString() } }
              );
              console.log(`[registrarMovimentacaoSetor] ✅ ${notifsPendentes.length} notificação(ões) de aprovação marcada(s) como lida(s) para demanda ${event.entity_id}`);
            }
          } catch (e) {
            console.error('[registrarMovimentacaoSetor] ⚠️ Erro ao limpar pendências:', e.message);
          }
        }
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});