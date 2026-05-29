import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { cliente_id, data, forcar_regenerar } = body;

    const hoje = data || new Date().toISOString().split('T')[0];

    // Diagnóstico completo
    const diagnostico = {
      data: hoje,
      total_itens_fila: 0,
      itens_aguardando: 0,
      itens_consolidados: 0,
      clientes_com_envio_ativo: 0,
      clientes_sem_grupo_whatsapp: 0,
      itens_sem_cliente_encontrado: 0,
      detalhes_por_cliente: [],
      motivos_nao_geracao: []
    };

    // Buscar todos os itens aguardando
    const todosItens = await base44.asServiceRole.entities.FilaComunicacaoCliente.filter({ status: 'aguardando' });
    diagnostico.total_itens_fila = todosItens.length;
    diagnostico.itens_aguardando = todosItens.filter(i => i.status === 'aguardando').length;

    // Buscar clientes com whatsapp ativo (ou cliente_id específico)
    let clientes;
    if (cliente_id) {
      const c = await base44.asServiceRole.entities.Cliente.filter({ id: cliente_id });
      clientes = c;
    } else {
      clientes = await base44.asServiceRole.entities.Cliente.filter({ whatsapp_envio_ativo: true });
    }

    diagnostico.clientes_com_envio_ativo = clientes.length;

    if (clientes.length === 0 && !cliente_id) {
      diagnostico.motivos_nao_geracao.push('Nenhum cliente com whatsapp_envio_ativo = true encontrado');
    }

    if (todosItens.length === 0) {
      diagnostico.motivos_nao_geracao.push('Fila de comunicação vazia — nenhum evento com "comunicar ao cliente = sim" foi registrado');
    }

    // FALLBACK: Escanear demandas concluídas hoje que a automação pode ter perdido
    diagnostico.fallback_demandas_adicionadas = 0;
    const agoraFallback = new Date().toISOString();
    try {
      const demandasConcluidas = await base44.asServiceRole.entities.Demanda.filter({}, '-updated_date', 300);
      const tipoMapFallback = { CRIACAO: 'Arte', EDICAO: 'Vídeo', TRAFEGO_META: 'Meta Ads', TRAFEGO_GOOGLE: 'Google Ads', TRAFEGO_TIKTOK: 'Meta Ads', BI_RELATORIO: 'Relatório', AUTOMACAO: 'Automação', ATENDIMENTO: 'Atendimento', IMPLANTACAO: 'Estratégia', ALTERACAO_CRIACAO: 'Arte' };

      for (const dem of demandasConcluidas) {
        if (dem.status !== 'concluida' && dem.status !== 'finalizada') continue;
        if (dem.comunicacao_evento_gerado || dem.comunicacao_enviada_fila) continue;

        // Usar data_conclusao ou updated_date como referência
        const dataConclusao = dem.data_conclusao || dem.updated_date || agoraFallback;
        if (!dataConclusao.startsWith(hoje)) continue;

        // Verificar se já existe item na fila (qualquer status)
        const existingFila = await base44.asServiceRole.entities.FilaComunicacaoCliente.filter({ origem: 'demanda', origem_id: dem.id });
        if (existingFila.length > 0) {
          // Sincronizar flags
          await base44.asServiceRole.entities.Demanda.update(dem.id, { comunicacao_evento_gerado: true, comunicacao_enviada_fila: true, comunicacao_evento_id: existingFila[0].id });
          continue;
        }

        // Adicionar à fila
        const tipoEntrega = dem.tipo_entrega || tipoMapFallback[dem.setor] || 'Outro';
        const resumoFallback = dem.resumo_entrega_cliente?.trim() || dem.titulo;
        const dataEvento = dataConclusao.split('T')[0];

        const itemFallback = await base44.asServiceRole.entities.FilaComunicacaoCliente.create({
          cliente_id: dem.cliente_id,
          cliente_nome: dem.cliente_nome || '',
          origem: 'demanda',
          origem_id: dem.id,
          tipo_evento: 'entrega',
          tipo_entrega: tipoEntrega,
          resumo: resumoFallback,
          data_evento: dataEvento,
          status: 'aguardando'
        });

        await base44.asServiceRole.entities.Demanda.update(dem.id, {
          comunicacao_evento_gerado: true,
          comunicacao_enviada_fila: true,
          comunicacao_evento_id: itemFallback.id,
          data_comunicacao_evento: agoraFallback,
          data_conclusao: dem.data_conclusao || agoraFallback
        });

        diagnostico.fallback_demandas_adicionadas++;
        // Adicionar ao todosItens para que a consolidação já a inclua nesta rodada
        todosItens.push(itemFallback);
      }
    } catch (errFallback) {
      diagnostico.motivos_nao_geracao.push(`Erro no fallback scan: ${errFallback.message}`);
    }

    // Fallback: MetaAdsOtimizacao com comunicar_cliente = true não enfileiradas de hoje
    diagnostico.fallback_meta_ads_adicionadas = 0;
    try {
      const otimizacoes = await base44.asServiceRole.entities.MetaAdsOtimizacao.filter({}, '-created_date', 200);
      const todosClientesMeta = await base44.asServiceRole.entities.Cliente.list('-updated_date', 500);

      for (const otim of otimizacoes) {
        if (otim.comunicacao_enviada_fila) continue;
        const dataOtim = otim.data_acao || otim.created_date?.split('T')[0] || '';
        if (!dataOtim.startsWith(hoje)) continue;

        const existingFila = await base44.asServiceRole.entities.FilaComunicacaoCliente.filter({ origem: 'meta_ads', origem_id: otim.id });
        if (existingFila.length > 0) {
          await base44.asServiceRole.entities.MetaAdsOtimizacao.update(otim.id, { comunicacao_enviada_fila: true });
          continue;
        }

        const clienteOtim = todosClientesMeta.find(c => 
          c.meta_ads_account_name === otim.account_name ||
          (c.contas_anuncio || []).some(ca => ca.plataforma === 'Meta' && ca.conta_nome === otim.account_name)
        );
        if (!clienteOtim) continue;

        const resumoOtim = otim.resumo_para_cliente || otim.resumo_acao || otim.objetivo || 'Otimização realizada nas campanhas Meta Ads';
        const itemOtim = await base44.asServiceRole.entities.FilaComunicacaoCliente.create({
          cliente_id: clienteOtim.id,
          cliente_nome: clienteOtim.nome,
          origem: 'meta_ads',
          origem_id: otim.id,
          tipo_evento: 'otimizacao',
          tipo_entrega: 'Meta Ads',
          resumo: resumoOtim,
          data_evento: dataOtim,
          status: 'aguardando'
        });

        await base44.asServiceRole.entities.MetaAdsOtimizacao.update(otim.id, { comunicacao_enviada_fila: true });
        todosItens.push(itemOtim);
        diagnostico.fallback_meta_ads_adicionadas++;
      }
    } catch (errMeta) {
      diagnostico.motivos_nao_geracao.push(`Erro no fallback Meta Ads: ${errMeta.message}`);
    }

    // Expandir clientes: incluir também clientes com itens na fila mas sem whatsapp_envio_ativo
    if (!cliente_id) {
      const clienteIdsNaFila = [...new Set(todosItens.map(i => i.cliente_id))];
      const clienteIdsJaIncluidos = new Set(clientes.map(c => c.id));
      const idsFaltando = clienteIdsNaFila.filter(id => !clienteIdsJaIncluidos.has(id));
      if (idsFaltando.length > 0) {
        const todosClientesList = await base44.asServiceRole.entities.Cliente.list('-updated_date', 500);
        const extras = todosClientesList.filter(c => idsFaltando.includes(c.id));
        clientes = [...clientes, ...extras];
      }
    }

    const resultados = [];

    for (const cliente of clientes) {
      const clienteDiag = { cliente_id: cliente.id, cliente_nome: cliente.nome, status: '', motivo: '' };

      // Verificar se já existe resumo para hoje
      const existing = await base44.asServiceRole.entities.ResumoDiarioCliente.filter({
        cliente_id: cliente.id,
        data: hoje
      });

      if (existing.length > 0 && !forcar_regenerar) {
        clienteDiag.status = 'ja_existe';
        clienteDiag.motivo = 'Resumo para hoje já foi gerado anteriormente';
        diagnostico.detalhes_por_cliente.push(clienteDiag);
        resultados.push({ cliente_id: cliente.id, cliente_nome: cliente.nome, status: 'ja_existe', resumo_id: existing[0].id });
        continue;
      }

      // Buscar itens da fila aguardando para este cliente
      const filaItens = todosItens.filter(i => i.cliente_id === cliente.id && i.status === 'aguardando');

      if (filaItens.length === 0) {
        clienteDiag.status = 'sem_itens';
        clienteDiag.motivo = 'Nenhum evento na fila para este cliente hoje';
        diagnostico.detalhes_por_cliente.push(clienteDiag);
        resultados.push({ cliente_id: cliente.id, cliente_nome: cliente.nome, status: 'sem_itens' });
        continue;
      }

      // Coletar anexos
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

      // Agrupar ações por tipo para consolidação inteligente
      const grupos = {};
      for (const item of filaItens) {
        const tipo = item.tipo_entrega || item.tipo_evento || 'Outro';
        if (!grupos[tipo]) grupos[tipo] = [];
        grupos[tipo].push(item.resumo);
      }

      const dataFormatada = new Date(hoje + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

      // Gerar mensagem profissional com IA
      let mensagemGerada = '';
      try {
        const listaAgrupada = Object.entries(grupos).map(([tipo, resumos]) => {
          return `[${tipo}] (${resumos.length} ação${resumos.length > 1 ? 'ões' : ''}):\n${resumos.map(r => `  - ${r}`).join('\n')}`;
        }).join('\n\n');

        const prompt = `Você é o gestor de contas da Voxx, agência de marketing digital. Gere a mensagem de atualização diária para o cliente.

Cliente: ${cliente.nome}
Data: ${dataFormatada}

Ações realizadas:
${listaAgrupada}

REGRAS OBRIGATÓRIAS:
1. Comece com: 📌 Atualização Voxx | ${dataFormatada}
2. Agrupe ações por tipo usando os emojis corretos: 🎨 Arte · 🎬 Vídeo · 🌐 Landing Page · 📈 Meta Ads · 🔎 Google Ads · ⚙️ Automação · 📊 Relatório
3. Liste a contagem de cada tipo quando houver mais de 1
4. Destaque as 2 ou 3 principais ações em bullet points curtos (máx. 280 caracteres cada)
5. ${todosAnexos.length > 0 ? `Finalize com: 📎 Arquivos enviados\n${todosAnexos.map(a => `• ${a.nome || 'arquivo'}`).join('\n')}` : 'NÃO inclua nenhuma menção a arquivos ou anexos na mensagem — não há nenhum arquivo associado.'}
6. Formato para WhatsApp (quebras de linha)

O QUE NÃO PODE APARECER NA MENSAGEM (estes elementos tornam a comunicação ruim):
- "Espero que estejam bem"
- "Nossa equipe trabalhou com dedicação"
- "Estamos comprometidos"
- "Seguimos à disposição"
- "Agradecemos a confiança"
- "Temos o prazer"
- Frases motivacionais ou emocionais
- Linguagem corporativa excessiva
- Saudações genéricas

TOM: executivo, objetivo, consultivo. Escreva como um gestor de conta humano, não como IA.
TAMANHO MÁXIMO: 300 palavras. Priorize clareza e brevidade.`;

        const resp = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
        mensagemGerada = resp;
      } catch (err) {
        // Fallback estruturado sem IA
        const linhas = [`📌 Atualização Voxx | ${dataFormatada}`, ''];
        const emojiMap = { 'Arte': '🎨', 'Vídeo': '🎬', 'Landing Page': '🌐', 'Meta Ads': '📈', 'Google Ads': '🔎', 'Automação': '⚙️', 'Relatório': '📊', 'Outro': '📋' };
        for (const [tipo, resumos] of Object.entries(grupos)) {
          const emoji = emojiMap[tipo] || '📋';
          linhas.push(`${emoji} ${resumos.length > 1 ? resumos.length + 'x ' : ''}${tipo}`);
        }
        linhas.push('');
        linhas.push('Principais ações:');
        filaItens.slice(0, 3).forEach(i => linhas.push(`• ${i.resumo}`));
        mensagemGerada = linhas.join('\n');
      }

      // Criar/atualizar o resumo diário
      let resumo;
      if (existing.length > 0 && forcar_regenerar) {
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

      clienteDiag.status = 'gerado';
      clienteDiag.motivo = `${filaItens.length} ações consolidadas`;
      diagnostico.detalhes_por_cliente.push(clienteDiag);

      resultados.push({
        cliente_id: cliente.id,
        cliente_nome: cliente.nome,
        status: 'gerado',
        resumo_id: resumo.id,
        total_acoes: filaItens.length,
        total_anexos: todosAnexos.length
      });
    }

    // Detectar itens na fila sem cliente com envio ativo
    const clienteIdsComEnvio = new Set(clientes.map(c => c.id));
    const itensSemCliente = todosItens.filter(i => !clienteIdsComEnvio.has(i.cliente_id));
    diagnostico.itens_sem_cliente_encontrado = itensSemCliente.length;
    if (itensSemCliente.length > 0) {
      const semGrupo = [...new Set(itensSemCliente.map(i => i.cliente_nome))];
      diagnostico.motivos_nao_geracao.push(`${itensSemCliente.length} evento(s) de cliente(s) sem whatsapp_envio_ativo: ${semGrupo.slice(0, 5).join(', ')}`);
    }

    const gerados = resultados.filter(r => r.status === 'gerado').length;
    if (gerados === 0 && diagnostico.motivos_nao_geracao.length === 0) {
      diagnostico.motivos_nao_geracao.push('Todos os clientes elegíveis já têm resumo gerado para hoje ou não têm itens na fila');
    }

    return Response.json({
      success: true,
      data: hoje,
      resultados,
      gerados,
      diagnostico
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});