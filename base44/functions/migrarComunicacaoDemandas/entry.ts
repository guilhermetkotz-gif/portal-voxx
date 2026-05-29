import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const STATUS_ATIVOS = ['recebida', 'em_triagem', 'programada', 'em_execucao', 'aguardando_cliente', 'em_revisao'];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
  }

  // Buscar todas as demandas ativas (sem comunicar_cliente definido ou false)
  const todasDemandas = await base44.asServiceRole.entities.Demanda.list('-created_date', 2000);

  const demandasParaAtualizar = todasDemandas.filter(d =>
    STATUS_ATIVOS.includes(d.status) && !d.comunicar_cliente
  );

  let atualizadas = 0;
  const erros = [];

  for (const demanda of demandasParaAtualizar) {
    const updated = await base44.asServiceRole.entities.Demanda.update(demanda.id, {
      comunicar_cliente: true
    });
    if (updated) {
      atualizadas++;
    } else {
      erros.push(demanda.id);
    }
  }

  const log = {
    data_migracao: new Date().toISOString(),
    executado_por: user.email,
    executado_por_nome: user.full_name || user.email,
    total_demandas_ativas: demandasParaAtualizar.length,
    demandas_atualizadas: atualizadas,
    demandas_ja_configuradas: todasDemandas.filter(d => STATUS_ATIVOS.includes(d.status) && d.comunicar_cliente).length,
    erros: erros.length,
    ids_com_erro: erros
  };

  return Response.json({ success: true, log });
});