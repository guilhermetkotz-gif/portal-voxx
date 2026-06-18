import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { demanda_id, usuario_id } = await req.json();
    const uid = usuario_id || user.id;

    // Apenas admin pode pausar cronômetro de outro usuário
    if (usuario_id && usuario_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem pausar cronômetros de outros usuários' }, { status: 403 });
    }

    // Buscar demanda atual
    const demandas = await base44.entities.Demanda.filter({ id: demanda_id });
    if (!demandas.length) return Response.json({ error: 'Demanda não encontrada' }, { status: 404 });

    const demanda = demandas[0];
    const cronometrosAtivos = demanda.cronometros_ativos || [];

    // Encontrar o cronômetro do usuário
    const meuCronometro = cronometrosAtivos.find(c => c.usuario_id === uid);
    if (!meuCronometro) {
      return Response.json({ success: true, message: 'Cronômetro não estava ativo', minutos_adicionados: 0 });
    }

    // Calcular minutos decorridos
    const inicio = new Date(meuCronometro.data_inicio).getTime();
    const agora = Date.now();
    const segundos = Math.floor((agora - inicio) / 1000);
    const minutos = Math.max(1, Math.floor(segundos / 60));

    // Remover usuário dos cronômetros ativos
    const novosCronometrosAtivos = cronometrosAtivos.filter(c => c.usuario_id !== uid);

    // Adicionar ao histórico
    const historico = demanda.historico_tempo_trabalho || [];
    historico.push({
      usuario_id: uid,
      usuario_nome: meuCronometro.usuario_nome,
      minutos: minutos,
      data_registro: new Date().toISOString()
    });

    // Atualizar total acumulado
    const novoTotal = (demanda.tempo_trabalho_minutos || 0) + minutos;

    await base44.entities.Demanda.update(demanda_id, {
      cronometros_ativos: novosCronometrosAtivos,
      historico_tempo_trabalho: historico,
      tempo_trabalho_minutos: novoTotal
    });

    return Response.json({ success: true, minutos_adicionados: minutos, total: novoTotal });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});