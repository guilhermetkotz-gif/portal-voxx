import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Função de migração: popula setor_responsavel_original nas demandas existentes
// Executa uma única vez — não sobrescreve se já estiver preenchido

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let offset = 0;
    const pageSize = 100;
    let total = 0;
    let migradas = 0;
    let jaPreenchidas = 0;

    while (true) {
      const demandas = await base44.asServiceRole.entities.Demanda.list('-created_date', pageSize);

      if (demandas.length === 0) break;

      for (const dem of demandas) {
        total++;

        if (dem.setor_responsavel_original) {
          // Já está preenchido — não tocar
          jaPreenchidas++;
          continue;
        }

        if (!dem.setor) continue;

        // Copiar setor atual para setor_responsavel_original (uma única vez)
        await base44.asServiceRole.entities.Demanda.update(dem.id, {
          setor_responsavel_original: dem.setor
        });
        migradas++;
      }

      if (demandas.length < pageSize) break;
      offset += pageSize;
    }

    return Response.json({
      success: true,
      total_processadas: total,
      migradas,
      ja_preenchidas: jaPreenchidas,
      mensagem: `Migração concluída: ${migradas} demandas atualizadas, ${jaPreenchidas} já possuíam o campo.`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});