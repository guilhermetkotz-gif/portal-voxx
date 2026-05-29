import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const hoje = body.data || new Date().toISOString().split('T')[0];

    // Buscar demandas recentes
    const demandas = await base44.asServiceRole.entities.Demanda.filter({}, '-updated_date', 500);

    const concluidasHoje = [];
    const comunicarTrue = [];
    const semFila = [];

    // Buscar TODA a fila de uma vez
    const todaFilaDemandasMap = new Map();
    const todaFilaAll = await base44.asServiceRole.entities.FilaComunicacaoCliente.filter({ origem: 'demanda' }, '-created_date', 500);
    todaFilaAll.forEach(i => { todaFilaDemandasMap.set(i.origem_id, i); });

    for (const dem of demandas) {
      if (dem.status !== 'concluida' && dem.status !== 'finalizada') continue;

      const dataConclusao = dem.data_conclusao || dem.updated_date || '';
      const isHoje = dataConclusao.startsWith(hoje);

      if (isHoje) {
        concluidasHoje.push({
          id: dem.id,
          titulo: dem.titulo,
          cliente_nome: dem.cliente_nome,
          status: dem.status,
          comunicar_cliente: dem.comunicar_cliente,
          data_conclusao: dem.data_conclusao,
          updated_date: dem.updated_date,
          comunicacao_evento_gerado: dem.comunicacao_evento_gerado,
          comunicacao_evento_id: dem.comunicacao_evento_id,
          fila_status: todaFilaDemandasMap.get(dem.id)?.status || 'SEM_ITEM',
          setor: dem.setor
        });

        if (dem.comunicar_cliente) {
          comunicarTrue.push(dem.id);
          if (!todaFilaDemandasMap.has(dem.id)) {
            semFila.push({ id: dem.id, titulo: dem.titulo, cliente_nome: dem.cliente_nome, comunicacao_evento_gerado: dem.comunicacao_evento_gerado });
          }
        }
      }
    }

    // Contar itens na fila por status
    const todaFila = todaFilaAll;
    const filaHoje = todaFila.filter(i => (i.data_evento || '').startsWith(hoje));
    const filaStatusCount = {};
    todaFila.forEach(i => { filaStatusCount[i.status] = (filaStatusCount[i.status] || 0) + 1; });

    return Response.json({
      hoje,
      total_demandas_escaneadas: demandas.length,
      concluidas_hoje: concluidasHoje.length,
      comunicar_true_hoje: comunicarTrue.length,
      sem_fila_item: semFila.length,
      demandas_sem_fila: semFila,
      detalhes_concluidas_hoje: concluidasHoje,
      fila_total: todaFila.length,
      fila_hoje: filaHoje.length,
      fila_por_status: filaStatusCount
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});