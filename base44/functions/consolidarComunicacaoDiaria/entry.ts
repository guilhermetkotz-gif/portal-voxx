import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Allow admins or automation (no user = service role call from automation)
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { cliente_id, data } = body;

    const hoje = data || new Date().toISOString().split('T')[0];

    // Buscar clientes ativos com whatsapp configurado
    let clientes;
    if (cliente_id) {
      const c = await base44.asServiceRole.entities.Cliente.filter({ id: cliente_id });
      clientes = c;
    } else {
      clientes = await base44.asServiceRole.entities.Cliente.filter({ whatsapp_envio_ativo: true });
    }

    const resultados = [];

    for (const cliente of clientes) {
      // Verificar se já existe resumo para hoje
      const existing = await base44.asServiceRole.entities.ResumoDiarioCliente.filter({
        cliente_id: cliente.id,
        data: hoje
      });
      if (existing.length > 0 && !body.forcar_regenerar) {
        resultados.push({ cliente_id: cliente.id, cliente_nome: cliente.nome, status: 'ja_existe', resumo_id: existing[0].id });
        continue;
      }

      // Buscar itens da fila aguardando para este cliente
      const filaItens = await base44.asServiceRole.entities.FilaComunicacaoCliente.filter({
        cliente_id: cliente.id,
        status: 'aguardando'
      });

      if (filaItens.length === 0) {
        resultados.push({ cliente_id: cliente.id, cliente_nome: cliente.nome, status: 'sem_itens' });
        continue;
      }

      // Coletar anexos para envio ao cliente
      const todosAnexos = [];
      filaItens.forEach(item => {
        if (item.anexos && Array.isArray(item.anexos)) {
          item.anexos.filter(a => a.enviar_cliente !== false).forEach(a => todosAnexos.push(a));
        }
      });

      // Montar lista de ações para a IA
      const listaAcoes = filaItens.map(item => {
        const tipo = item.tipo_entrega || item.tipo_evento || 'ação';
        return `- [${tipo}] ${item.resumo}`;
      }).join('\n');

      // Gerar mensagem profissional com IA
      let mensagemGerada = '';
      try {
        const prompt = `Você é um assistente de comunicação de uma agência de marketing digital chamada Voxx.
Seu trabalho é gerar um resumo diário profissional e elegante para enviar ao cliente via WhatsApp.

Cliente: ${cliente.nome}
Data: ${new Date(hoje).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}

Ações realizadas hoje pela equipe Voxx:
${listaAcoes}

INSTRUÇÕES:
- Escreva em linguagem orientada ao cliente (não use termos técnicos internos)
- Transforme ações operacionais em benefícios para o cliente
- Seja profissional, direto e positivo
- Use emojis com moderação
- Comece com uma saudação
- Finalize com uma frase de comprometimento
- NÃO copie os textos internos — transforme-os em comunicação elegante
- Máximo de 300 palavras
- Formato pronto para WhatsApp (use quebras de linha)`;

        const resp = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
        mensagemGerada = resp;
      } catch (err) {
        mensagemGerada = `Olá! Segue o resumo das atividades realizadas hoje pela equipe Voxx para ${cliente.nome}:\n\n${filaItens.map(i => `• ${i.resumo}`).join('\n')}\n\nEstamos à disposição! 🚀`;
      }

      // Criar/atualizar o resumo diário
      let resumo;
      if (existing.length > 0 && body.forcar_regenerar) {
        resumo = await base44.asServiceRole.entities.ResumoDiarioCliente.update(existing[0].id, {
          mensagem_gerada: mensagemGerada,
          mensagem_editada: null,
          itens_consolidados: filaItens.map(i => i.id),
          total_acoes: filaItens.length,
          total_anexos: todosAnexos.length,
          anexos: todosAnexos,
          status_revisao: 'pendente',
          status_envio: 'aguardando_revisao',
          whatsapp_grupo_id: cliente.whatsapp_grupo_id || null,
          whatsapp_grupo_nome: cliente.whatsapp_grupo_nome || null
        });
      } else {
        resumo = await base44.asServiceRole.entities.ResumoDiarioCliente.create({
          cliente_id: cliente.id,
          cliente_nome: cliente.nome,
          data: hoje,
          mensagem_gerada: mensagemGerada,
          itens_consolidados: filaItens.map(i => i.id),
          total_acoes: filaItens.length,
          total_anexos: todosAnexos.length,
          anexos: todosAnexos,
          status_revisao: 'pendente',
          status_envio: 'aguardando_revisao',
          whatsapp_grupo_id: cliente.whatsapp_grupo_id || null,
          whatsapp_grupo_nome: cliente.whatsapp_grupo_nome || null,
          gerado_por: user?.email || 'sistema'
        });
      }

      // Marcar itens da fila como consolidados
      for (const item of filaItens) {
        await base44.asServiceRole.entities.FilaComunicacaoCliente.update(item.id, {
          status: 'consolidado',
          resumo_diario_id: resumo.id
        });
      }

      resultados.push({
        cliente_id: cliente.id,
        cliente_nome: cliente.nome,
        status: 'gerado',
        resumo_id: resumo.id,
        total_acoes: filaItens.length,
        total_anexos: todosAnexos.length
      });
    }

    return Response.json({ success: true, data: hoje, resultados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});