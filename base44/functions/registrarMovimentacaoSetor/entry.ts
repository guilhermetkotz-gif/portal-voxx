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
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});