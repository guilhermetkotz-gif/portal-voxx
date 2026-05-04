import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Busca lote pequeno para não estourar rate limit
    const todas = await base44.asServiceRole.entities.FinanceiroReceita.filter(
      { recorrente: true }, '-created_date', 500
    );

    await sleep(500);

    const semQtd = todas.filter(r => !r.quantidade_meses || r.quantidade_meses < 1);

    // Processa apenas 20 por chamada
    const lote = semQtd.slice(0, 20);

    let atualizadas = 0;
    for (const r of lote) {
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
      await sleep(300);
    }

    return Response.json({
      message: `${atualizadas} receita(s) atualizada(s).`,
      atualizadas,
      temMais: semQtd.length > 20,
      restantes: Math.max(0, semQtd.length - 20),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});