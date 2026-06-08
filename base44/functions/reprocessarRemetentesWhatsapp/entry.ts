import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function normalizarTelefone(tel) {
  if (!tel) return '';
  return tel.replace(/\D/g, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Buscar todos os remetentes VOXX ativos
    const remetentes = await base44.asServiceRole.entities.WhatsappRemetenteVoxx.filter({ ativo: true });
    const telefonesVoxx = new Set(remetentes.map(r => r.telefone_normalizado).filter(Boolean));

    // Buscar todas as mensagens (paginando em lotes de 500)
    let skip = 0;
    const limit = 500;
    let totalAnalisadas = 0;
    let totalVoxx = 0;
    let totalCliente = 0;
    let totalSemTelefone = 0;

    while (true) {
      const mensagens = await base44.asServiceRole.entities.WhatsappMensagem.list('-received_at', limit, skip);
      if (!mensagens.length) break;

      for (const m of mensagens) {
        totalAnalisadas++;

        // from_me = true → sempre VOXX
        if (m.from_me === true) {
          if (m.remetente_tipo !== 'voxx') {
            await base44.asServiceRole.entities.WhatsappMensagem.update(m.id, { remetente_tipo: 'voxx' });
          }
          totalVoxx++;
          continue;
        }

        const tel = normalizarTelefone(m.remetente_telefone);

        if (!tel) {
          totalSemTelefone++;
          // Manter como está, não alterar
          continue;
        }

        // Verificar variações: com e sem o 9 extra (celular)
        const isVoxx = telefonesVoxx.has(tel) ||
          telefonesVoxx.has(tel.slice(0, 4) + tel.slice(5)) || // remove 9 extra
          (tel.length === 12 && telefonesVoxx.has(tel.slice(0, 4) + '9' + tel.slice(4))); // adiciona 9

        const novoTipo = isVoxx ? 'voxx' : 'cliente';

        if (m.remetente_tipo !== novoTipo) {
          await base44.asServiceRole.entities.WhatsappMensagem.update(m.id, { remetente_tipo: novoTipo });
        }

        if (isVoxx) totalVoxx++;
        else totalCliente++;
      }

      if (mensagens.length < limit) break;
      skip += limit;
    }

    return Response.json({
      ok: true,
      totalAnalisadas,
      totalVoxx,
      totalCliente,
      totalSemTelefone,
      totalRemetentesVoxx: remetentes.length,
    });

  } catch (error) {
    console.error('[reprocessarRemetentes] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});