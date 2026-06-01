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

    // Data de referência no fuso SP
    const hoje = data || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const agoraISO = new Date().toISOString();

    // Helper: converte timestamp UTC para data no fuso SP
    const spDate = (isoStr) => {
      if (!isoStr) return '';
      try { return new Date(isoStr).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); } catch { return ''; }
    };

    // ─── FONTE DE VERDADE 1: Demandas concluídas na data ───
    const todasDemandas = await base44.asServiceRole.entities.Demanda.filter({}, '-updated_date', 1000);
    const demandasDoDia = todasDemandas.filter(d => {
      if (d.status !== 'concluida' && d.status !== 'finalizada') return false;
      if (!d.comunicar_cliente) return false;
      if (cliente_id && d.cliente_id !== cliente_id) return false;
      const dtRef = d.data_conclusao || d.updated_date || '';
      return spDate(dtRef) === hoje;
    });

    // ─── FONTE DE VERDADE 2: Otimizações Meta Ads na data ───
    const todasOtimizacoes = await base44.asServiceRole.entities.MetaAdsOtimizacao.filter({}, '-created_date', 500);
    const otimizacoesDoDia = todasOtimizacoes.filter(o => {
      if (!o.comunicar_cliente) return false;
      const dtOtim = o.data_acao ? spDate(o.data_acao + 'T12:00:00') : spDate(o.created_date);
      if (dtOtim !== hoje) return false;
      if (cliente_id && o.cliente_id && o.cliente_id !== cliente_id) return false;
      return true;
    });

    // Buscar clientes para resolução de nomes e match de account_name (fallback)
    const todosClientes = await base44.asServiceRole.entities.Cliente.list('-updated_date', 500);
    const clientesMap = new Map(todosClientes.map(c => [c.id, c]));

    // Resolver cliente_id das otimizações (via cliente_id direto ou fallback por account_name)
    const otimizacoesResolvidas = otimizacoesDoDia.map(o => {
      if (o.cliente_id && clientesMap.has(o.cliente_id)) {
        return { ...o, _cliente_id_resolvido: o.cliente_id };
      }
      // Fallback: match por account_name
      const clienteMatch = todosClientes.find(c =>
        c.meta_ads_account_name === o.account_name ||
        (c.contas_anuncio || []).some(ca => ca.plataforma === 'Meta' && ca.conta_nome === o.account_name)
      );
      if (clienteMatch) return { ...o, _cliente_id_resolvido: clienteMatch.id };
      return { ...o, _cliente_id_resolvido: null }; // sem cliente identificável
    });

    // ─── Agrupar por cliente ───
    const porCliente = new Map();

    for (const dem of demandasDoDia) {
      if (!dem.cliente_id) continue;
      if (!porCliente.has(dem.cliente_id)) {
        porCliente.set(dem.cliente_id, { demandas: [], otimizacoes: [] });
      }
      porCliente.get(dem.cliente_id).demandas.push(dem);
    }

    for (const otim of otimizacoesResolvidas) {
      const cliId = otim._cliente_id_resolvido;
      if (!cliId) continue;
      if (!porCliente.has(cliId)) {
        porCliente.set(cliId, { demandas: [], otimizacoes: [] });
      }
      porCliente.get(cliId).otimizacoes.push(otim);
    }

    // ─── Resumos existentes para a data ───
    const resumosExistentes = await base44.asServiceRole.entities.ResumoDiarioCliente.filter({ data: hoje });
    const resumosPorCliente = new Map(resumosExistentes.map(r => [r.cliente_id, r]));

    const emojiMap = {
      'Arte': '🎨', 'Vídeo': '🎬', 'Landing Page': '🌐', 'Meta Ads': '📈',
      'Google Ads': '🔎', 'Automação': '⚙️', 'Relatório': '📊',
      'Atendimento': '🤝', 'Estratégia': '🎯', 'Outro': '📋'
    };

    const tipoMap = {
      CRIACAO: 'Arte', EDICAO: 'Vídeo', TRAFEGO_META: 'Meta Ads',
      TRAFEGO_GOOGLE: 'Google Ads', TRAFEGO_TIKTOK: 'Meta Ads',
      BI_RELATORIO: 'Relatório', AUTOMACAO: 'Automação',
      ATENDIMENTO: 'Atendimento', IMPLANTACAO: 'Estratégia',
      ALTERACAO_CRIACAO: 'Arte'
    };

    const auditoria = [];
    const resultados = [];
    let gerados = 0;

    for (const [cliId, { demandas, otimizacoes }] of porCliente.entries()) {
      const cliente = clientesMap.get(cliId);
      const clienteNome = cliente?.nome || demandas[0]?.cliente_nome || otimizacoes[0]?.account_name || cliId;

      // Coletar todos os anexos das demandas
      const todosAnexos = [];
      for (const dem of demandas) {
        (dem.anexos_cliente || []).filter(a => a.enviar_cliente !== false).forEach(a => todosAnexos.push(a));
      }

      const totalItens = demandas.length + otimizacoes.length;

      // Auditoria entry (sempre adicionado)
      const auditEntry = {
        cliente_id: cliId,
        cliente_nome: clienteNome,
        demandas_count: demandas.length,
        otimizacoes_count: otimizacoes.length,
        anexos_count: todosAnexos.length,
        resumo_gerado: false,
        resumo_id: null,
        status: 'pendente',
        divergencias: []
      };

      // Verificar divergências
      const demandasSemClienteId = demandas.filter(d => !d.cliente_id);
      if (demandasSemClienteId.length > 0) {
        auditEntry.divergencias.push(`${demandasSemClienteId.length} demanda(s) sem cliente_id`);
      }

      // Verificar se já existe resumo
      const resumoExistente = resumosPorCliente.get(cliId);
      if (resumoExistente && !forcar_regenerar) {
        auditEntry.resumo_gerado = true;
        auditEntry.resumo_id = resumoExistente.id;
        auditEntry.status = 'ja_existe';
        auditoria.push(auditEntry);
        resultados.push({ cliente_id: cliId, cliente_nome: clienteNome, status: 'ja_existe', resumo_id: resumoExistente.id });
        continue;
      }

      if (totalItens === 0) {
        auditEntry.status = 'sem_dados';
        auditoria.push(auditEntry);
        continue;
      }

      // ─── Construir conteúdo do resumo ───
      const dataFormatada = new Date(hoje + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

      // Agrupar demandas por tipo
      // Prioridade resumo: 1º resumo_cliente, 2º resumo_entrega_cliente, 3º título
      const grupos = {};
      for (const dem of demandas) {
        // Ignorar demandas marcadas como Não Comunicar
        if (dem.tipo_comunicacao === 'Não Comunicar') continue;
        const tipo = dem.tipo_entrega || tipoMap[dem.setor_responsavel_original || dem.setor] || 'Outro';
        if (!grupos[tipo]) grupos[tipo] = [];
        const resumo = dem.resumo_cliente?.trim() || dem.resumo_entrega_cliente?.trim() || dem.titulo;
        grupos[tipo].push(resumo);
      }
      // Otimizações Meta
      if (otimizacoes.length > 0) {
        if (!grupos['Meta Ads']) grupos['Meta Ads'] = [];
        otimizacoes.forEach(o => {
          grupos['Meta Ads'].push(o.resumo_para_cliente || o.resumo_acao || o.objetivo || 'Otimização nas campanhas Meta Ads');
        });
      }

      // Eliminar itens duplicados dentro de cada grupo
      for (const tipo of Object.keys(grupos)) {
        grupos[tipo] = [...new Set(grupos[tipo])];
      }

      const listaAgrupada = Object.entries(grupos)
        .filter(([, items]) => items.length > 0)
        .map(([tipo, items]) => {
          const emoji = emojiMap[tipo] || '📋';
          const linhas = items.map(r => '  - ' + r).join('\n');
          return `${emoji} ${tipo} (${items.length} ${items.length > 1 ? 'ações' : 'ação'}):\n${linhas}`;
        }).join('\n\n');

      // Gerar mensagem com IA
      let mensagemGerada = '';
      try {
        const instrucaoAnexos = todosAnexos.length > 0
          ? `Ao final da mensagem, inclua:\n📎 Arquivos enviados\n${todosAnexos.map(a => '• ' + (a.nome || 'arquivo')).join('\n')}`
          : 'NÃO mencione arquivos ou anexos — não há nenhum arquivo vinculado.';

        const prompt = `Consolide os registros operacionais abaixo em uma mensagem de atualização para o cliente via WhatsApp.

Cliente: ${clienteNome}
Data: ${dataFormatada}

REGISTROS (use SOMENTE estas informações — estes já são os resumos para o cliente, escritos pela equipe operacional):
${listaAgrupada}

FORMATO OBRIGATÓRIO:
1. Primeira linha: 📌 Atualização Voxx | ${dataFormatada}
2. Mostre APENAS as categorias que aparecem nos registros acima.
3. Para cada categoria, reproduza o conteúdo de forma clara e profissional, sem alterar o significado.
4. Não agrupe categorias diferentes. Não crie categorias vazias.
5. ${instrucaoAnexos}

PROIBIDO: inventar ações, alterar o conteúdo dos resumos fornecidos, usar títulos técnicos internos, usar linguagem operacional.
Tom: gestor de contas experiente, executivo, direto. Máximo 300 caracteres por ação. Máximo 200 palavras no total.`;

        mensagemGerada = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
      } catch (_) {
        // Fallback sem IA
        const linhas = [`📌 Atualização Voxx | ${dataFormatada}`, ''];
        for (const [tipo, items] of Object.entries(grupos)) {
          linhas.push(`${emojiMap[tipo] || '📋'} ${tipo}`);
          items.forEach(r => linhas.push('• ' + r));
          linhas.push('');
        }
        if (todosAnexos.length > 0) {
          linhas.push('📎 Arquivos enviados');
          todosAnexos.forEach(a => linhas.push('• ' + (a.nome || 'arquivo')));
        }
        mensagemGerada = linhas.join('\n').trim();
      }

      // Criar ou atualizar resumo
      let resumo;
      const itensFila = [
        ...demandas.map(d => d.id),
        ...otimizacoes.map(o => o.id)
      ];

      if (resumoExistente && forcar_regenerar) {
        resumo = await base44.asServiceRole.entities.ResumoDiarioCliente.update(resumoExistente.id, {
          mensagem_gerada: mensagemGerada,
          mensagem_editada: null,
          itens_consolidados: itensFila,
          total_acoes: totalItens,
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
          itens_consolidados: itensFila,
          total_acoes: totalItens,
          total_anexos: todosAnexos.length,
          anexos: todosAnexos,
          status_revisao: 'pendente',
          status_envio: 'aguardando_revisao',
          whatsapp_grupo_id: cliente?.whatsapp_grupo_id || null,
          whatsapp_grupo_nome: cliente?.whatsapp_grupo_nome || null,
          gerado_por: user?.email || 'sistema'
        });
      }

      gerados++;
      auditEntry.resumo_gerado = true;
      auditEntry.resumo_id = resumo.id;
      auditEntry.status = 'gerado';
      auditoria.push(auditEntry);
      resultados.push({
        cliente_id: cliId,
        cliente_nome: clienteNome,
        status: 'gerado',
        resumo_id: resumo.id,
        total_acoes: totalItens
      });
    }

    // Clientes com otimizações não resolvidas (sem cliente_id e sem match)
    const otimizacoesSemCliente = otimizacoesResolvidas.filter(o => !o._cliente_id_resolvido);

    return Response.json({
      success: true,
      data: hoje,
      gerados,
      demandas_encontradas: demandasDoDia.length,
      otimizacoes_encontradas: otimizacoesDoDia.length,
      otimizacoes_sem_cliente: otimizacoesSemCliente.length,
      clientes_processados: porCliente.size,
      resultados,
      auditoria
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});