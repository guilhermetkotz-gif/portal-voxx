import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { grupoIds = [], mensagem = '' } = body;

    if (!Array.isArray(grupoIds) || grupoIds.length === 0) {
      return Response.json({ error: 'grupoIds (array) é obrigatório' }, { status: 400 });
    }
    if (!mensagem?.trim()) {
      return Response.json({ error: 'mensagem é obrigatória' }, { status: 400 });
    }

    const resultados = [];
    let enviados = 0;
    let erros = 0;

    for (const chatId of grupoIds) {
      try {
        const res = await base44.functions.invoke('enviarMensagemGeral', {
          chatId,
          mensagem,
          tipo: 'texto',
          incluirAssinatura: true,
        });

        const success = res?.data?.success === true;
        if (success) enviados++; else erros++;
        resultados.push({
          chatId,
          success,
          status_envio: res?.data?.status_envio || 'erro',
          erro: res?.data?.erro || null,
        });
      } catch (e) {
        erros++;
        resultados.push({ chatId, success: false, error: e.message });
      }

      // Delay de 1.5s entre envios para evitar rate limit da Z-API
      if (grupoIds.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    return Response.json({
      total: grupoIds.length,
      enviados,
      erros,
      resultados,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});