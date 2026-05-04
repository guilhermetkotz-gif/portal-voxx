import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const todos = await base44.asServiceRole.entities.FinanceiroCusto.filter({ recorrente: true }, '-created_date', 5000);

    const grupos = {};
    for (const c of todos) {
      const key = (c.nome || '').toLowerCase().trim();
      if (!key) continue;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(c);
    }

    let atualizados = 0;
    for (const itens of Object.values(grupos)) {
      const comData = itens.filter(i => i.data_inicio).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
      if (!comData.length) continue;
      const dataInicio = comData[0].data_inicio;
      for (const c of itens.filter(i => !i.data_inicio)) {
        await base44.asServiceRole.entities.FinanceiroCusto.update(c.id, { data_inicio: dataInicio });
        atualizados++;
      }
    }

    return Response.json({ message: `${atualizados} lançamento(s) atualizado(s).`, atualizados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});