import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agora = new Date().toISOString();
    const tagsVencidas = await base44.entities.TagConversa.filter({
      status: 'ativa',
    });

    const tagsParaAlertar = tagsVencidas.filter(t => t.data_lembrete && t.data_lembrete <= agora);

    let processadas = 0;
    for (const tag of tagsParaAlertar) {
      try {
        const grupoNome = tag.grupo_nome || tag.grupo_id;

        await base44.asServiceRole.functions.invoke('enviarMensagemGeral', {
          chatId: tag.grupo_id,
          mensagem: `⏰ *LEMBRETE AUTOMÁTICO*\n\nA tag *"${tag.tag_nome}"* definida para esta conversa expirou.\n\n_Definido por: ${tag.usuario_criador_nome || 'Sistema'}_\n_Data do lembrete: ${new Date(tag.data_lembrete).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}_`,
          tipo: 'texto',
          incluirAssinatura: false,
          clienteId: tag.cliente_id || '',
          clienteNome: tag.cliente_nome || '',
          chatName: grupoNome,
        });

        await base44.asServiceRole.entities.TagConversa.update(tag.id, { status: 'concluida' });
        processadas++;
      } catch (e) {
        console.error(`Erro ao processar tag ${tag.id}:`, e.message);
      }
    }

    return Response.json({ success: true, processadas, total: tagsParaAlertar.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});