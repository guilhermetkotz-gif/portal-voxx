import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (_req) => {
  try {
    const base44 = createClientFromRequest(_req);
    const sdk = base44.asServiceRole;

    const agora = new Date().toISOString();
    const agora48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeISO = hoje.toISOString();

    // Buscar todas as demandas ativas (não concluídas/finalizadas)
    const demandas = await sdk.entities.Demanda.list('-created_date', 1000);

    const ativas = demandas.filter(d => d.status !== 'concluida' && d.status !== 'finalizada');

    // KPIs
    const ativasPorSetor = {};
    let aguardandoAprovacao = 0;
    let demandasComAlertas = 0;
    let semMovimentacao = 0;
    let vencidas = 0;
    let aguardandoCliente = 0;

    for (const d of ativas) {
      const setor = d.setor || 'sem_setor';
      ativasPorSetor[setor] = (ativasPorSetor[setor] || 0) + 1;

      // Aguardando cliente
      if (d.status === 'aguardando_cliente') aguardandoCliente++;

      // Demandas com alertas (tags de intervenção/aprovação pendente)
      const tags = d.tags || [];
      if (tags.includes('aprovacao_pendente') || tags.includes('intervencao_humana')) {
        demandasComAlertas++;
      }

      // Sem movimentação (>48h)
      if (d.ultima_atividade_kanban && d.ultima_atividade_kanban < agora48h) {
        semMovimentacao++;
      }

      // Vencidas (previsão de entrega passou e não foi concluída)
      if (d.previsao_entrega && d.previsao_entrega < hojeISO) {
        vencidas++;
      }
    }

    // Aguardando aprovação = aguardando_cliente + tags de aprovação
    aguardandoAprovacao = aguardandoCliente + demandasComAlertas;

    // Top 5 setores por quantidade
    const topSetores = Object.entries(ativasPorSetor)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

    return Response.json({
      success: true,
      totalAtivas: ativas.length,
      totalDemandas: demandas.length,
      ativasPorSetor: topSetores,
      aguardandoAprovacao,
      aguardandoCliente,
      demandasComAlertas,
      semMovimentacao,
      vencidas,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});