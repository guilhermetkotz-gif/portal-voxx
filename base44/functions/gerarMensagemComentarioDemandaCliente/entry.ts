import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const {
      demanda_id, cliente_id, cliente_nome, titulo_demanda,
      setor_principal, status_demanda, comentario_original,
      anexos_do_comentario, links_do_comentario, resumo_cliente,
      tipo_entrega,
    } = body;

    if (!comentario_original?.trim()) {
      return Response.json({ error: 'Comentário vazio' }, { status: 400 });
    }

    // Buscar demandas vinculadas e últimos comentários para contexto
    let contextoExtra = '';
    try {
      const timeline = await base44.asServiceRole.entities.TimelineEvent.filter(
        { demanda_id },
        '-created_date',
        5
      );
      const comentariosRecentes = timeline
        .filter(e => e.tipo === 'comentario' && e.descricao)
        .map(e => `- ${e.autor}: ${e.descricao?.substring(0, 200)}`)
        .join('\n');
      if (comentariosRecentes) {
        contextoExtra = `\n\nCOMENTÁRIOS RECENTES DA DEMANDA:\n${comentariosRecentes}`;
      }
    } catch (_) { /* ignora */ }

    // Buscar entregas vinculadas
    let entregasContexto = '';
    try {
      const entregas = await base44.asServiceRole.entities.EntregaDemanda.filter(
        { demanda_id },
        '-created_date',
        3
      );
      if (entregas.length > 0) {
        entregasContexto = '\n\nENTREGAS VINCULADAS:\n' + entregas.map(e =>
          `- ${e.nome_entrega} (${e.tipo_entrega || 'Outro'}) — Status: ${e.status_entrega || 'N/A'}`
        ).join('\n');
      }
    } catch (_) { /* ignora */ }

    // Mapear status para linguagem do cliente
    const statusMap = {
      recebida: 'recebida e em análise',
      em_triagem: 'em triagem pela equipe',
      programada: 'programada para execução',
      em_execucao: 'em andamento pela equipe',
      aguardando_cliente: 'aguardando retorno do cliente',
      em_revisao: 'em revisão final',
      concluida: 'concluída',
      finalizada: 'finalizada',
    };
    const statusLegivel = statusMap[status_demanda] || status_demanda;

    const setorMap = {
      ATENDIMENTO: 'Atendimento',
      TRAFEGO_META: 'Tráfego Meta Ads',
      TRAFEGO_GOOGLE: 'Tráfego Google Ads',
      TRAFEGO_TIKTOK: 'Tráfego TikTok',
      CRIACAO: 'Criação',
      EDICAO: 'Edição de Vídeo',
      BI_RELATORIO: 'BI & Relatórios',
      IMPLANTACAO: 'Implantação',
      FINANCEIRO: 'Financeiro',
      ALTERACAO_CRIACAO: 'Alteração Criação',
      AUTOMACAO: 'Automação',
      SALDOS: 'Saldos',
    };
    const setorLegivel = setorMap[setor_principal] || setor_principal;

    const prompt = `Transforme o comentário interno abaixo em uma mensagem profissional para enviar ao cliente via WhatsApp.

REGRAS:
- Curta, profissional, clara e objetiva
- Sem linguagem técnica interna
- Sem expor bastidores ou justificativas internas
- Sem prometer resultados
- Sem inventar informações que não estão no comentário
- Incluir próximo passo claro quando fizer sentido
- Tom consultivo e de cuidado com o cliente
- Apenas o texto da mensagem, sem aspas, sem "Olá [nome]", sem saudação genérica

CONTEXTO:
- Cliente: ${cliente_nome || 'Não informado'}
- Demanda: ${titulo_demanda || 'Não informado'}
- Setor: ${setorLegivel}
- Status: ${statusLegivel}
${resumo_cliente ? `- Resumo para cliente: ${resumo_cliente}` : ''}
${tipo_entrega ? `- Tipo de entrega: ${tipo_entrega}` : ''}
${entregasContexto}
${contextoExtra}

COMENTÁRIO INTERNO:
"""
${comentario_original}
"""
${anexos_do_comentario ? `\nANEXOS DO COMENTÁRIO: ${anexos_do_comentario}` : ''}
${links_do_comentario ? `\nLINKS DO COMENTÁRIO: ${links_do_comentario}` : ''}

Retorne APENAS a mensagem pronta para o cliente, sem nenhum texto adicional.`;

    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
    });

    const mensagem = typeof response === 'string' ? response.trim() : (response?.mensagem || response?.text || String(response)).trim();

    // Determinar tipo de mensagem
    let tipoMensagem = 'Atualização de andamento';
    const lower = mensagem.toLowerCase();
    if (lower.includes('aprov') || lower.includes('validar') || lower.includes('avaliação')) {
      tipoMensagem = 'Solicitação de aprovação';
    } else if (lower.includes('entreg') || lower.includes('finaliz') || lower.includes('conclu')) {
      tipoMensagem = 'Entrega realizada';
    } else if (lower.includes('informa') || lower.includes('precis') || lower.includes('necessit')) {
      tipoMensagem = 'Solicitação de informação';
    } else if (lower.includes('ajust') || lower.includes('corrig') || lower.includes('alteração')) {
      tipoMensagem = 'Aviso de ajuste realizado';
    } else if (lower.includes('receb') || lower.includes('confirm')) {
      tipoMensagem = 'Confirmação de recebimento';
    } else if (lower.includes('retom') || lower.includes('continu')) {
      tipoMensagem = 'Retomada de demanda';
    }

    return Response.json({
      mensagem_sugerida: mensagem,
      tipo_mensagem: tipoMensagem,
      nivel_confianca: 'alta',
      resumo_contexto_usado: `Cliente: ${cliente_nome}, Demanda: ${titulo_demanda}, Setor: ${setorLegivel}, Status: ${statusLegivel}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});