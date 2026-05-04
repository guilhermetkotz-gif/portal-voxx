import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Busca todos os custos recorrentes
    const todos = await base44.asServiceRole.entities.FinanceiroCusto.filter({ recorrente: true }, '-created_date', 5000);

    // Agrupa por nome (normalizado)
    const grupos = {};
    for (const c of todos) {
      const key = c.nome?.toLowerCase()?.trim();
      if (!key) continue;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(c);
    }

    let atualizados = 0;

    for (const itens of Object.values(grupos)) {
      // Encontra a data_inicio mais antiga do grupo
      const comData = itens.filter(i => i.data_inicio);
      if (comData.length === 0) continue;

      comData.sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
      const dataInicio = comData[0].data_inicio;

      // Atualiza todos os que não têm data_inicio
      const semData = itens.filter(i => !i.data_inicio);
      for (const c of semData) {
        await base44.asServiceRole.entities.FinanceiroCusto.update(c.id, { data_inicio: dataInicio });
        atualizados++;
      }
    }

    return Response.json({
      message: `${atualizados} lançamento(s) atualizado(s) com data de início da recorrência.`,
      atualizados,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});