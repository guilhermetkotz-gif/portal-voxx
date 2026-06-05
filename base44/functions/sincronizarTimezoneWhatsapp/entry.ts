import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import moment from 'npm:moment-timezone';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem executar esta função' }, { status: 403 });
    }

    console.log('[sincronizarTimezoneWhatsapp] Iniciando sincronização de timezone...');

    // Buscar todos os logs de WhatsApp
    const logs = await base44.asServiceRole.entities.WhatsappEnvioLog.list('-enviado_em', 10000);
    
    let atualizados = 0;
    let erros = 0;

    for (const log of logs) {
      try {
        if (!log.enviado_em) continue;

        // Converter para horário de Brasília
        const dataOriginal = new Date(log.enviado_em);
        const dataBrasilia = moment(dataOriginal).tz('America/Sao_Paulo').toISOString();

        // Atualizar o registro com o timestamp corrigido
        await base44.asServiceRole.entities.WhatsappEnvioLog.update(log.id, {
          enviado_em: dataBrasilia
        });

        atualizados++;
        
        if (atualizados % 100 === 0) {
          console.log(`[sincronizarTimezoneWhatsapp] ${atualizados} registros atualizados...`);
        }
      } catch (error) {
        console.error(`[sincronizarTimezoneWhatsapp] Erro ao atualizar log ${log.id}:`, error.message);
        erros++;
      }
    }

    console.log(`[sincronizarTimezoneWhatsapp] Concluído: ${atualizados} atualizados, ${erros} erros`);

    return Response.json({
      success: true,
      mensagem: 'Sincronização concluída',
      registros_atualizados: atualizados,
      erros: erros
    });

  } catch (error) {
    console.error('[sincronizarTimezoneWhatsapp] Erro geral:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});