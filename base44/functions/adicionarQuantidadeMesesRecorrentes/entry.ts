import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const todas = await base44.asServiceRole.entities.FinanceiroReceita.filter({ recorrente: true }, '-created_date', 2000);
    const semQtd = todas.filter(r => !r.quantidade_meses || r.quantidade_meses < 1);

    let atualizadas = 0;

    for (const r of semQtd) {
      const baseStr = r.data_inicio || r.created_date?.substring(0, 10) || new Date().toISOString().substring(0, 10);
      const base = new Date(baseStr + 'T12:00:00');
      const fim = new Date(base);
      fim.setMonth(fim.getMonth() + 11);
      const data_fim = `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, '0')}-${String(fim.getDate()).padStart(2, '0')}`;

      await base44.asServiceRole.entities.FinanceiroReceita.update(r.id, {
        quantidade_meses: 12,
        data_fim,
        frequencia: 'mensal',
      });
      atualizadas++;
    }

    return Response.json({
      message: `${atualizadas} receita(s) atualizada(s) com 12 meses de recorrência.`,
      atualizadas,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});