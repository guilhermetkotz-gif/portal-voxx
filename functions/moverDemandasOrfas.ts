import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas admins podem executar esta função' }, { status: 403 });
    }

    const { setorOrigem, setorDestino } = await req.json();

    if (!setorOrigem || !setorDestino) {
      return Response.json({ error: 'setorOrigem e setorDestino são obrigatórios' }, { status: 400 });
    }

    // Busca demandas com o setor órfão
    const demandas = await base44.asServiceRole.entities.Demanda.filter({ setor: setorOrigem });

    if (demandas.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'Nenhuma demanda encontrada com esse setor',
        demandasMovidas: 0
      });
    }

    // Move todas para o setor destino
    const promises = demandas.map(d => 
      base44.asServiceRole.entities.Demanda.update(d.id, { setor: setorDestino })
    );

    await Promise.all(promises);

    return Response.json({
      success: true,
      message: `${demandas.length} demandas movidas de "${setorOrigem}" para "${setorDestino}"`,
      demandasMovidas: demandas.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});