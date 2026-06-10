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

    const demandas = await sdk.entities.Demanda.list('-created_date', 1000);
    const ativas = demandas.filter(d => d.status !== 'concluida' && d.status !== 'finalizada');

    let aguardandoAprovacao = 0;
    let demandasComAlertas = 0;
    let semMovimentacao = 0;
    let vencidas = 0;
    let aguardandoCliente = 0;
    const vencidasPorSetor = {};

    for (const d of ativas) {
      if (d.status === 'aguardando_cliente') aguardandoCliente++;

      const tags = d.tags || [];
      if (tags.includes('aprovacao_pendente') || tags.includes('intervencao_humana')) {
        demandasComAlertas++;
      }

      if (d.ultima_atividade_kanban && d.ultima_atividade_kanban < agora48h) {
        semMovimentacao++;
      }

      if (d.previsao_entrega && d.previsao_entrega < hojeISO) {
        vencidas++;
        const setor = d.setor || 'sem_setor';
        vencidasPorSetor[setor] = (vencidasPorSetor[setor] || 0) + 1;
      }
    }

    aguardandoAprovacao = aguardandoCliente + demandasComAlertas;

    // Todos os setores com vencidas, ordenados do maior pro menor
    const todosSetoresVencidas = Object.entries(vencidasPorSetor)
      .sort(([, a], [, b]) => b - a)
      .map(([setor, qtd]) => ({ setor, qtd }));

    return Response.json({
      success: true,
      totalAtivas: ativas.length,
      totalDemandas: demandas.length,
      vencidasPorSetor: todosSetoresVencidas,
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