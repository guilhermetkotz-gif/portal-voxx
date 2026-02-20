import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas admins podem executar esta função' }, { status: 403 });
    }

    // Busca todas as colunas ativas
    const colunas = await base44.asServiceRole.entities.KanbanColumn.filter({ active: true });
    const setoresValidos = new Set([
      'ATENDIMENTO',
      'TRAFEGO_META',
      'TRAFEGO_GOOGLE',
      'TRAFEGO_TIKTOK',
      'ALTERACAO_CRIACAO',
      'CRIACAO',
      'EDICAO',
      'BI_RELATORIO',
      'IMPLANTACAO',
      'FINANCEIRO',
      'AUTOMACAO',
      'SALDOS'
    ]);

    // Adiciona colunas customizadas ativas
    colunas.forEach(col => setoresValidos.add(col.column_id));

    // Busca todas as demandas
    const todasDemandas = await base44.asServiceRole.entities.Demanda.list('-created_date', 1000);
    
    // Identifica demandas com setores órfãos
    const demandasOrfas = todasDemandas.filter(d => !setoresValidos.has(d.setor));
    
    if (demandasOrfas.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'Nenhuma demanda órfã encontrada',
        demandasOrfas: []
      });
    }

    // Agrupa por setor órfão para análise
    const setoresOrfaos = {};
    demandasOrfas.forEach(d => {
      if (!setoresOrfaos[d.setor]) {
        setoresOrfaos[d.setor] = [];
      }
      setoresOrfaos[d.setor].push({
        id: d.id,
        titulo: d.titulo,
        cliente_nome: d.cliente_nome,
        status: d.status,
        created_date: d.created_date
      });
    });

    return Response.json({
      success: true,
      totalOrfas: demandasOrfas.length,
      setoresOrfaos: setoresOrfaos,
      setoresValidos: Array.from(setoresValidos)
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});