import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
  }

  // Buscar todos os clientes ativos
  const clientes = await base44.asServiceRole.entities.Cliente.filter({ status: 'ativo' });
  const paraAtualizar = clientes.filter(c => !c.whatsapp_envio_ativo);

  let atualizados = 0;
  for (const c of paraAtualizar) {
    await base44.asServiceRole.entities.Cliente.update(c.id, {
      whatsapp_envio_ativo: true,
      horario_envio_resumo: c.horario_envio_resumo || '17:30'
    });
    atualizados++;
  }

  return Response.json({
    success: true,
    total_clientes_ativos: clientes.length,
    ja_habilitados: clientes.length - paraAtualizar.length,
    atualizados
  });
});