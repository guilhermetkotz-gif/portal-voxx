import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Buscar todas as avaliações pendentes
    const pendentes = await base44.asServiceRole.entities.AvaliacaoEficaciaOtimizacao.filter({
      status: 'pendente'
    });

    if (pendentes.length === 0) {
      return Response.json({ success: true, message: 'Nenhuma avaliação pendente', processadas: 0 });
    }

    const hoje = new Date();
    const tresDiasMs = 3 * 24 * 60 * 60 * 1000;
    let processadas = 0;
    let erros = 0;
    const resultados = [];

    for (const aval of pendentes) {
      try {
        const dataOtim = new Date(aval.data_otimizacao + 'T00:00:00');
        const diffMs = hoje.getTime() - dataOtim.getTime();

        // Só processa se já passaram 3 dias desde a otimização
        if (diffMs < tresDiasMs) {
          resultados.push({
            avaliacao_id: aval.id,
            account_name: aval.account_name,
            skipped: true,
            reason: 'ainda nao completou 3 dias',
            dias_restantes: Math.ceil((tresDiasMs - diffMs) / (24 * 60 * 60 * 1000))
          });
          continue;
        }

        // === 1. Coletar snapshot T3 ===
        const radarData = await base44.asServiceRole.entities.RadarMetaData.filter({
          account_name: aval.account_name
        });
        const radar = radarData[0] || null;

        const contasMeta = await base44.asServiceRole.entities.ContaMetaAds.filter({
          account_name: aval.account_name
        });
        const contaMeta = contasMeta[0] || null;

        const snapshotT3 = {
          cpl_7d: radar?.cpl_7d || 0,
          leads_7d: radar?.leads_7d || 0,
          leads_7d_media_dia: radar?.leads_7d_media_dia || 0,
          ctr_7d: radar?.ctr_7d || 0,
          frequencia_7d: radar?.frequencia_7d || 0,
          amount_spent_ontem: radar?.amount_spent_ontem || 0,
          leads_ontem: radar?.leads_ontem || 0,
          cpl_ontem: radar?.cpl_ontem || 0,
          ctr_ontem: radar?.ctr_ontem || 0,
          frequencia_ontem: radar?.frequencia_ontem || 0,
          nota_gpt: contaMeta?.nota_gpt || 0,
          classificacao: contaMeta?.classificacao || '',
          cpl_meta_ads: contaMeta?.cpl_meta_ads || 0,
          messaging_conversations: contaMeta?.messaging_conversations || 0,
          new_messaging_connections: contaMeta?.new_messaging_connections || 0,
          leads: contaMeta?.leads || 0,
          cadastros_whats: contaMeta?.cadastros_whats || 0,
          amount_spent: contaMeta?.amount_spent || 0,
          coletado_em: new Date().toISOString()
        };

        // === 2. Calcular deltas ===
        const t0 = aval.snapshot_t0 || {};
        const t3 = snapshotT3;

        const deltaCpl = t0.cpl_7d > 0 && t3.cpl_7d > 0
          ? ((t3.cpl_7d - t0.cpl_7d) / t0.cpl_7d) * 100 : 0;
        const deltaLeads = t0.leads_7d > 0 && t3.leads_7d > 0
          ? ((t3.leads_7d - t0.leads_7d) / t0.leads_7d) * 100 : 0;
        const deltaCtr = t0.ctr_7d > 0 && t3.ctr_7d > 0
          ? ((t3.ctr_7d - t0.ctr_7d) / t0.ctr_7d) * 100 : 0;
        const deltaFreq = t0.frequencia_7d > 0 && t3.frequencia_7d > 0
          ? ((t3.frequencia_7d - t0.frequencia_7d) / t0.frequencia_7d) * 100 : 0;
        const deltaNotaGpt = (t3.nota_gpt || 0) - (t0.nota_gpt || 0);

        // === 3. Determinar eficácia técnica ===
        let scoreEficacia = 50; // base neutra
        let eficaciaTecnica = 'estavel';

        // CPL caiu = positivo (até 30 pontos)
        if (deltaCpl < -10) { scoreEficacia += 25; }
        else if (deltaCpl < 0) { scoreEficacia += 15; }
        else if (deltaCpl > 20) { scoreEficacia -= 25; }
        else if (deltaCpl > 0) { scoreEficacia -= 10; }

        // Leads aumentaram = positivo (até 20 pontos)
        if (deltaLeads > 20) { scoreEficacia += 20; }
        else if (deltaLeads > 0) { scoreEficacia += 10; }
        else if (deltaLeads < -20) { scoreEficacia -= 20; }
        else if (deltaLeads < 0) { scoreEficacia -= 10; }

        // CTR aumentou = positivo (até 15 pontos)
        if (deltaCtr > 15) { scoreEficacia += 15; }
        else if (deltaCtr > 0) { scoreEficacia += 8; }
        else if (deltaCtr < -15) { scoreEficacia -= 15; }

        // Frequência diminuiu = positivo (até 15 pontos)
        if (deltaFreq < -10) { scoreEficacia += 15; }
        else if (deltaFreq < 0) { scoreEficacia += 8; }
        else if (deltaFreq > 20) { scoreEficacia -= 15; }

        // Nota GPT aumentou = positivo (até 20 pontos)
        if (deltaNotaGpt > 5) { scoreEficacia += 20; }
        else if (deltaNotaGpt > 0) { scoreEficacia += 10; }
        else if (deltaNotaGpt < -5) { scoreEficacia -= 20; }

        scoreEficacia = Math.max(0, Math.min(100, Math.round(scoreEficacia)));

        if (scoreEficacia >= 65) eficaciaTecnica = 'melhorou';
        else if (scoreEficacia < 40) eficaciaTecnica = 'piorou';

        // === 4. Buscar mensagens do WhatsApp do cliente (T0 a T3) ===
        let totalMensagens = 0;
        let mensagensTexto = '';
        let sentimentoCliente = 'neutro';
        let scoreSatisfacao = 50;
        let resumoSatisfacao = 'Sem mensagens suficientes para análise de satisfação.';

        try {
          // Buscar o cliente para obter grupo_id
          let clienteId = aval.cliente_id;
          if (!clienteId) {
            const clientes = await base44.asServiceRole.entities.Cliente.filter({
              meta_ads_account_name: aval.account_name
            });
            if (clientes[0]) clienteId = clientes[0].id;
          }

          if (clienteId) {
            const clientes = await base44.asServiceRole.entities.Cliente.filter({ id: clienteId });
            const cliente = clientes[0];
            const grupoId = cliente?.whatsapp_grupo_id;

            if (grupoId) {
              const dataInicio = new Date(aval.data_otimizacao + 'T00:00:00');
              const dataFim = new Date(dataInicio.getTime() + tresDiasMs);

              // Buscar mensagens do grupo no período
              const mensagens = await base44.asServiceRole.entities.WhatsappMensagem.filter({
                grupo_id: grupoId
              }, '-timestamp_mensagem', 200);

              const mensagensPeriodo = mensagens.filter(m => {
                if (!m.timestamp_mensagem) return false;
                const ts = new Date(m.timestamp_mensagem);
                return ts >= dataInicio && ts <= dataFim;
              });

              totalMensagens = mensagensPeriodo.length;

              if (totalMensagens > 0) {
                // Preparar texto das mensagens para o LLM (limitar a 60 mensagens)
                const msgsParaLLM = mensagensPeriodo.slice(0, 60).map(m => {
                  const remetente = m.remetente_tipo === 'voxx' ? 'VOXX' : 'CLIENTE';
                  const conteudo = m.mensagem || m.transcricao_audio || `[${m.tipo_mensagem}]`;
                  return `[${remetente}] ${conteudo}`;
                }).join('\n');

                mensagensTexto = msgsParaLLM;
              }
            }
          }
        } catch (e) {
          // Continua sem análise de WhatsApp se houver erro
        }

        // === 5. Análise via LLM ===
        let analiseLlm = '';
        let recomendacoes = '';

        if (totalMensagens > 0 || deltaCpl !== 0 || deltaLeads !== 0 || deltaNotaGpt !== 0) {
          const prompt = `Você é um analista de marketing digital especializado em Meta Ads. Analise a eficácia de uma otimização de campanha realizada há 3 dias.

=== CONTEXTO DA OTIMIZAÇÃO ===
Conta: ${aval.account_name}
Data da otimização: ${aval.data_otimizacao}

=== SNAPSHOT T0 (Momento da Otimização) ===
CPL 7d: R$ ${t0.cpl_7d || 0}
Leads 7d: ${t0.leads_7d || 0}
CTR 7d: ${t0.ctr_7d || 0}%
Frequência 7d: ${t0.frequencia_7d || 0}
Investimento/dia: R$ ${t0.amount_spent_ontem || 0}
Nota GPT: ${t0.nota_gpt || 0}
Classificação: ${t0.classificacao || 'N/A'}

=== SNAPSHOT T3 (3 Dias Depois) ===
CPL 7d: R$ ${t3.cpl_7d || 0}
Leads 7d: ${t3.leads_7d || 0}
CTR 7d: ${t3.ctr_7d || 0}%
Frequência 7d: ${t3.frequencia_7d || 0}
Investimento/dia: R$ ${t3.amount_spent_ontem || 0}
Nota GPT: ${t3.nota_gpt || 0}
Classificação: ${t3.classificacao || 'N/A'}

=== VARIAÇÕES ===
Variação CPL: ${deltaCpl.toFixed(1)}% (negativo = melhora)
Variação Leads: ${deltaLeads.toFixed(1)}%
Variação CTR: ${deltaCtr.toFixed(1)}%
Variação Frequência: ${deltaFreq.toFixed(1)}% (negativo = melhora)
Variação Nota GPT: ${deltaNotaGpt > 0 ? '+' : ''}${deltaNotaGpt.toFixed(0)} pontos

=== SCORE TÉCNICO CALCULADO ===
Score de Eficácia: ${scoreEficacia}/100
Veredito Técnico: ${eficaciaTecnica.toUpperCase()}

${totalMensagens > 0 ? `=== MENSAGENS DE WHATSAPP (T0 a T3) ===
Total de mensagens no período: ${totalMensagens}

${mensagensTexto}` : '=== SEM MENSAGENS DE WHATSAPP NO PERÍODO ==='}

Por favor, forneça:

1. ANÁLISE_DE_EFICACIA: Um parágrafo detalhado sobre se a otimização foi eficaz ou não, considerando os dados técnicos (CPL, leads, CTR, frequência) e o sentimento do cliente nas mensagens do WhatsApp (se houver).

2. SATISFACAO_CLIENTE: Analise o tom e sentimento do cliente nas mensagens do WhatsApp. Classifique como "positivo", "neutro" ou "negativo" e dê um score de 0-100. Considere se o cliente demonstra satisfação com os resultados, se há reclamações, ou se o clima é neutro.

3. RECOMENDACOES: 2-3 recomendações práticas de próximos passos baseadas na análise.

Formate sua resposta em JSON com esta estrutura:
{
  "analise_eficacia": "texto da análise...",
  "sentimento_cliente": "positivo|neutro|negativo",
  "score_satisfacao": número_de_0_a_100,
  "resumo_satisfacao": "resumo curto do sentimento do cliente...",
  "recomendacoes": "texto das recomendações..."
}`;

          try {
            const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
              prompt,
              response_json_schema: {
                type: "object",
                properties: {
                  analise_eficacia: { type: "string" },
                  sentimento_cliente: { type: "string", enum: ["positivo", "neutro", "negativo"] },
                  score_satisfacao: { type: "number" },
                  resumo_satisfacao: { type: "string" },
                  recomendacoes: { type: "string" }
                }
              }
            });

            analiseLlm = llmResponse.analise_eficacia || '';
            recomendacoes = llmResponse.recomendacoes || '';

            if (llmResponse.sentimento_cliente) {
              sentimentoCliente = llmResponse.sentimento_cliente;
            }
            if (typeof llmResponse.score_satisfacao === 'number') {
              scoreSatisfacao = Math.max(0, Math.min(100, llmResponse.score_satisfacao));
            }
            if (llmResponse.resumo_satisfacao) {
              resumoSatisfacao = llmResponse.resumo_satisfacao;
            }
          } catch (llmErr) {
            analiseLlm = `Análise técnica processada. Não foi possível gerar análise via LLM: ${llmErr.message}`;
            recomendacoes = 'Verificar manualmente os dados T0 vs T3 para próximos passos.';
          }
        } else {
          analiseLlm = 'Sem dados suficientes (sem variação nos KPIs e sem mensagens de WhatsApp no período) para gerar análise de eficácia.';
          recomendacoes = 'Aguardar mais dados para reavaliação.';
        }

        // === 6. Atualizar registro ===
        await base44.asServiceRole.entities.AvaliacaoEficaciaOtimizacao.update(aval.id, {
          snapshot_t3: snapshotT3,
          delta_cpl: deltaCpl,
          delta_leads: deltaLeads,
          delta_ctr: deltaCtr,
          delta_frequencia: deltaFreq,
          delta_nota_gpt: deltaNotaGpt,
          eficacia_tecnica: eficaciaTecnica,
          score_eficacia: scoreEficacia,
          total_mensagens_whatsapp: totalMensagens,
          sentimento_cliente: sentimentoCliente,
          score_satisfacao: scoreSatisfacao,
          resumo_satisfacao: resumoSatisfacao,
          analise_llm: analiseLlm,
          recomendacoes: recomendacoes,
          data_avaliacao: new Date().toISOString(),
          status: 'concluida'
        });

        processadas++;
        resultados.push({
          avaliacao_id: aval.id,
          account_name: aval.account_name,
          eficacia: eficaciaTecnica,
          score_eficacia: scoreEficacia,
          score_satisfacao: scoreSatisfacao,
          total_mensagens: totalMensagens
        });
      } catch (err) {
        erros++;
        try {
          await base44.asServiceRole.entities.AvaliacaoEficaciaOtimizacao.update(aval.id, {
            status: 'erro',
            erro_detalhe: err.message,
            data_avaliacao: new Date().toISOString()
          });
        } catch (_) {}
        resultados.push({
          avaliacao_id: aval.id,
          account_name: aval.account_name,
          error: err.message
        });
      }
    }

    return Response.json({
      success: true,
      processadas,
      erros,
      total_pendentes: pendentes.length,
      resultados
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});