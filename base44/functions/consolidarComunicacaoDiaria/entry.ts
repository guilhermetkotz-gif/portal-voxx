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
    const agoraISO = new Date().toISOString();

    // ─── PASSO 1: Garantir que todas as demandas concluídas hoje com comunicar=true têm item na fila ───
    const tipoMap = {
      CRIACAO: 'Arte', EDICAO: 'Vídeo', TRAFEGO_META: 'Meta Ads',
      TRAFEGO_GOOGLE: 'Google Ads', TRAFEGO_TIKTOK: 'Meta Ads',
      BI_RELATORIO: 'Relatório', AUTOMACAO: 'Automação',
      ATENDIMENTO: 'Atendimento', IMPLANTACAO: 'Estratégia',
      ALTERACAO_CRIACAO: 'Arte'
    };

    // Buscar demandas concluídas hoje com comunicar_cliente = true
    const todasDemandas = await base44.asServiceRole.entities.Demanda.filter({}, '-updated_date', 500);
    const demandasAlvo = todasDemandas.filter(d => {
      if (d.status !== 'concluida' && d.status !== 'finalizada') return false;
      if (!d.comunicar_cliente) return false;
      if (cliente_id && d.cliente_id !== cliente_id) return false;
      const dt = d.data_conclusao || d.updated_date || '';
      return dt.startsWith(hoje);
    });

    // Buscar TODOS os itens da fila (origem=demanda) de uma vez
    const filaDemandasAll = await base44.asServiceRole.entities.FilaComunicacaoCliente.filter({ origem: 'demanda' }, '-created_date', 1000);
    const filaDemandasMap = new Map(filaDemandasAll.map(i => [i.origem_id, i]));

    // Criar itens na fila para demandas que ainda não têm
    let criados = 0;
    for (const dem of demandasAlvo) {
      const existente = filaDemandasMap.get(dem.id);
      if (existente) {
        // Já existe — se consolidado/enviado/descartado não reprocessar
        if (['consolidado', 'enviado', 'descartado'].includes(existente.status)) continue;
        // aguardando — já está correto
        continue;
      }
      // Não existe — criar
      const tipoEntrega = dem.tipo_entrega || tipoMap[dem.setor] || 'Outro';
      const resumo = dem.resumo_entrega_cliente?.trim() || dem.titulo;
      const dataEvento = (dem.data_conclusao || dem.updated_date || agoraISO).split('T')[0];

      const novoItem = await base44.asServiceRole.entities.FilaComunicacaoCliente.create({
        cliente_id: dem.cliente_id,
        cliente_nome: dem.cliente_nome || '',
        origem: 'demanda',
        origem_id: dem.id,
        tipo_evento: 'entrega',
        tipo_entrega: tipoEntrega,
        resumo,
        data_evento: dataEvento,
        status: 'aguardando'
      });
      filaDemandasMap.set(dem.id, novoItem);
      criados++;

      // Sincronizar flags na demanda
      await base44.asServiceRole.entities.Demanda.update(dem.id, {
        comunicacao_evento_gerado: true,
        comunicacao_enviada_fila: true,
        comunicacao_evento_id: novoItem.id,
        data_comunicacao_evento: agoraISO,
        data_conclusao: dem.data_conclusao || agoraISO
      });
    }

    // ─── PASSO 2: Otimizações Meta Ads de hoje ───
    const otimizacoes = await base44.asServiceRole.entities.MetaAdsOtimizacao.filter({}, '-created_date', 200);
    const filaMetaAll = await base44.asServiceRole.entities.FilaComunicacaoCliente.filter({ origem: 'meta_ads' }, '-created_date', 500);
    const filaMetaMap = new Map(filaMetaAll.map(i => [i.origem_id, i]));
    const todosClientes = await base44.asServiceRole.entities.Cliente.list('-updated_date', 500);

    for (const otim of otimizacoes) {
      if (cliente_id) {
        // se filtrando por cliente, verificar se esta otimização é do cliente
      }
      const dataOtim = otim.data_acao || otim.created_date?.split('T')[0] || '';
      if (!dataOtim.startsWith(hoje)) continue;
      if (filaMetaMap.has(otim.id)) continue;

      const clienteOtim = todosClientes.find(c =>
        c.meta_ads_account_name === otim.account_name ||
        (c.contas_anuncio || []).some(ca => ca.plataforma === 'Meta' && ca.conta_nome === otim.account_name)
      );
      if (!clienteOtim) continue;
      if (cliente_id && clienteOtim.id !== cliente_id) continue;

      const resumoOtim = otim.resumo_para_cliente || otim.resumo_acao || otim.objetivo || 'Otimização realizada nas campanhas Meta Ads';
      await base44.asServiceRole.entities.FilaComunicacaoCliente.create({
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
      criados++;
    }

    // ─── PASSO 3: Buscar TODOS os itens aguardando na fila agora ───
    let filaAguardando;
    if (cliente_id) {
      filaAguardando = await base44.asServiceRole.entities.FilaComunicacaoCliente.filter({ status: 'aguardando', cliente_id });
    } else {
      filaAguardando = await base44.asServiceRole.entities.FilaComunicacaoCliente.filter({ status: 'aguardando' });
    }

    // ─── PASSO 4: Agrupar por cliente e gerar resumos ───
    const porCliente = new Map();
    for (const item of filaAguardando) {
      if (!porCliente.has(item.cliente_id)) porCliente.set(item.cliente_id, []);
      porCliente.get(item.cliente_id).push(item);
    }

    // Buscar dados dos clientes necessários
    const clientesMap = new Map(todosClientes.map(c => [c.id, c]));

    const resultados = [];
    const emojiMap = {
      'Arte': '🎨', 'Vídeo': '🎬', 'Landing Page': '🌐', 'Meta Ads': '📈',
      'Google Ads': '🔎', 'Automação': '⚙️', 'Relatório': '📊',
      'Atendimento': '🤝', 'Estratégia': '🎯', 'Outro': '📋'
    };

    for (const [cliId, itens] of porCliente.entries()) {
      // Verificar se já existe resumo para hoje
      const existingResumos = await base44.asServiceRole.entities.ResumoDiarioCliente.filter({ cliente_id: cliId, data: hoje });
      if (existingResumos.length > 0 && !forcar_regenerar) {
        resultados.push({ cliente_id: cliId, cliente_nome: itens[0].cliente_nome, status: 'ja_existe', resumo_id: existingResumos[0].id });
        continue;
      }

      const cliente = clientesMap.get(cliId);
      const clienteNome = itens[0].cliente_nome || cliente?.nome || cliId;

      // Coletar anexos
      const todosAnexos = [];
      itens.forEach(item => {
        (item.anexos || []).filter(a => a.enviar_cliente !== false).forEach(a => todosAnexos.push(a));
      });

      // Agrupar por tipo
      const grupos = {};
      for (const item of itens) {
        const tipo = item.tipo_entrega || item.tipo_evento || 'Outro';
        if (!grupos[tipo]) grupos[tipo] = [];
        grupos[tipo].push(item.resumo);
      }

      const dataFormatada = new Date(hoje + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
      const listaAgrupada = Object.entries(grupos).map(([tipo, resumos]) => {
        const emoji = emojiMap[tipo] || '📋';
        const linhas = resumos.map(r => '  - ' + r).join('\n');
        return emoji + ' ' + tipo + ' (' + resumos.length + (resumos.length > 1 ? ' ações' : ' ação') + '):\n' + linhas;
      }).join('\n\n');

      // Gerar mensagem com IA
      let mensagemGerada = '';
      try {
        const instrucaoAnexos = todosAnexos.length > 0
          ? 'Ao final da mensagem, inclua exatamente:\n📎 Arquivos enviados\n' + todosAnexos.map(a => '• ' + (a.nome || 'arquivo')).join('\n')
          : 'NÃO mencione arquivos, anexos ou materiais — não há nenhum arquivo vinculado a estas ações.';

        const prompt = 'Consolide os registros operacionais abaixo em uma mensagem de atualização para o cliente via WhatsApp.\n\n'
          + 'Cliente: ' + clienteNome + '\n'
          + 'Data: ' + dataFormatada + '\n\n'
          + 'REGISTROS (use SOMENTE estas informações, sem adicionar nada):\n'
          + listaAgrupada + '\n\n'
          + 'FORMATO OBRIGATÓRIO:\n'
          + '1. Primeira linha: 📌 Atualização Voxx | ' + dataFormatada + '\n'
          + '2. Mostre APENAS as categorias que aparecem nos registros acima.\n'
          + '3. Para cada categoria, liste os títulos/resumos exatamente como registrados.\n'
          + '4. ' + instrucaoAnexos + '\n\n'
          + 'PROIBIDO: inventar ações, frases genéricas, saudações ou fechamentos.\n'
          + 'Tom: executivo, direto. Máximo 200 palavras.';

        mensagemGerada = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
      } catch (_) {
        // Fallback estruturado sem IA
        const linhas = ['📌 Atualização Voxx | ' + dataFormatada, ''];
        for (const [tipo, resumos] of Object.entries(grupos)) {
          linhas.push((emojiMap[tipo] || '📋') + ' ' + tipo);
          resumos.forEach(r => linhas.push('• ' + r));
          linhas.push('');
        }
        if (todosAnexos.length > 0) {
          linhas.push('📎 Arquivos enviados');
          todosAnexos.forEach(a => linhas.push('• ' + (a.nome || 'arquivo')));
        }
        mensagemGerada = linhas.join('\n').trim();
      }

      // Criar/atualizar resumo diário
      let resumo;
      if (existingResumos.length > 0 && forcar_regenerar) {
        resumo = await base44.asServiceRole.entities.ResumoDiarioCliente.update(existingResumos[0].id, {
          mensagem_gerada: mensagemGerada,
          mensagem_editada: null,
          itens_consolidados: itens.map(i => i.id),
          total_acoes: itens.length,
          total_anexos: todosAnexos.length,
          anexos: todosAnexos,
          status_revisao: 'pendente',
          status_envio: 'aguardando_revisao',
          whatsapp_grupo_id: cliente?.whatsapp_grupo_id || null,
          whatsapp_grupo_nome: cliente?.whatsapp_grupo_nome || null
        });
      } else {
        resumo = await base44.asServiceRole.entities.ResumoDiarioCliente.create({
          cliente_id: cliId,
          cliente_nome: clienteNome,
          data: hoje,
          mensagem_gerada: mensagemGerada,
          itens_consolidados: itens.map(i => i.id),
          total_acoes: itens.length,
          total_anexos: todosAnexos.length,
          anexos: todosAnexos,
          status_revisao: 'pendente',
          status_envio: 'aguardando_revisao',
          whatsapp_grupo_id: cliente?.whatsapp_grupo_id || null,
          whatsapp_grupo_nome: cliente?.whatsapp_grupo_nome || null,
          gerado_por: user?.email || 'sistema'
        });
      }

      // Marcar itens como consolidados
      for (const item of itens) {
        await base44.asServiceRole.entities.FilaComunicacaoCliente.update(item.id, {
          status: 'consolidado',
          resumo_diario_id: resumo.id
        });
      }

      resultados.push({
        cliente_id: cliId,
        cliente_nome: clienteNome,
        status: 'gerado',
        resumo_id: resumo.id,
        total_acoes: itens.length
      });
    }

    const gerados = resultados.filter(r => r.status === 'gerado').length;

    return Response.json({
      success: true,
      data: hoje,
      gerados,
      fila_itens_novos_criados: criados,
      demandas_alvo: demandasAlvo.length,
      resultados
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});