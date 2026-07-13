import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const {
            cliente_id,
            cliente_nome,
            grupo_nome,
            tempo_sem_comunicacao,
            mensagens_recentes,
            demandas_recentes,
            otimizacoes_meta_ads,
            dados_kanban,
        } = body;

        if (!cliente_nome) {
            return Response.json({ error: 'cliente_nome é obrigatório' }, { status: 400 });
        }

        // Monta contexto das mensagens
        let contextoMensagens = '';
        if (mensagens_recentes && mensagens_recentes.length > 0) {
            contextoMensagens = 'Últimas mensagens do grupo:\n';
            mensagens_recentes.forEach(m => {
                const tipo = m.remetente_tipo === 'voxx' || m.origem === 'enviada' ? 'VOXX' : 'Cliente';
                contextoMensagens += `- [${tipo}] ${m.mensagem || '(mídia)'}\n`;
            });
        }

        // Monta contexto das demandas
        let contextoDemandas = '';
        if (demandas_recentes && demandas_recentes.length > 0) {
            contextoDemandas = 'Demandas recentes do cliente:\n';
            demandas_recentes.forEach(d => {
                contextoDemandas += `- ${d.titulo || 'Sem título'} (Status: ${d.status || 'N/A'}, Setor: ${d.setor || 'N/A'})\n`;
            });
        }

        // === ENRIQUECER DADOS META ADS ===
        // Buscar otimizações por cliente_id E também por account_name (muitos registros não têm cliente_id)
        let otimizacoesEnriquecidas = [...(otimizacoes_meta_ads || [])];
        let contaMetaAdsData = null;

        // Sempre tenta enriquecer se houver cliente_nome (mesmo sem cliente_id válido)
        if (cliente_nome) {
            try {
                // 1. Buscar otimizações por cliente_id (caso o frontend já não tenha pego todas)
                if (cliente_id) {
                    const porClienteId = await base44.asServiceRole.entities.MetaAdsOtimizacao.filter(
                        { cliente_id }, '-created_date', 10
                    );
                    const idsJa = new Set(otimizacoesEnriquecidas.map(o => o.conta_meta_ads_id).filter(Boolean));
                    for (const o of porClienteId) {
                        if (o.conta_meta_ads_id && !idsJa.has(o.conta_meta_ads_id)) {
                            idsJa.add(o.conta_meta_ads_id);
                            otimizacoesEnriquecidas.push(o);
                        }
                    }
                }

                // 2. Extrair tokens significativos do nome do cliente E do grupo
                // Remove números entre parênteses/colchetes, depois divide em palavras
                const stopWords = new Set(['sin', 'os', 'voxx', 'or', 'the', 'de', 'da', 'do', 'rs', 'sp', 'pr', 'sc']);
                const nomeComposto = `${cliente_nome} ${grupo_nome || ''}`.toLowerCase();
                const tokens = nomeComposto
                    .replace(/[()\[\]{}\d]/g, ' ')
                    .split(/[\s\-|/\\]+/)
                    .map(t => t.trim())
                    .filter(t => t.length > 2 && !stopWords.has(t));

                // Tokens únicos
                const tokensUnicos = [...new Set(tokens)];

                // 3. Buscar ContaMetaAds por correspondência de tokens
                const todasContas = await base44.asServiceRole.entities.ContaMetaAds.list('-updated_date', 100);
                
                // Função de score: quantos tokens do cliente aparecem no nome da conta
                const scoreConta = (accName) => {
                    if (!accName) return 0;
                    const accLower = accName.toLowerCase();
                    return tokensUnicos.filter(t => accLower.includes(t)).length;
                };

                // Encontra a conta com maior score (mínimo 2 tokens ou 1 se só houver 1 token)
                let melhorConta = null;
                let melhorScore = 0;
                for (const c of todasContas) {
                    const score = scoreConta(c.account_name);
                    if (score > melhorScore) {
                        melhorScore = score;
                        melhorConta = c;
                    }
                }
                // Aceita se pelo menos 2 tokens casarem, ou 1 se o cliente só tem 1 token significativo
                const minTokens = tokensUnicos.length >= 2 ? 2 : 1;
                if (melhorConta && melhorScore >= minTokens) {
                    contaMetaAdsData = melhorConta;
                }

                // 4. Buscar otimizações por correspondência de tokens no account_name/cliente_nome
                const todasOtimizacoes = await base44.asServiceRole.entities.MetaAdsOtimizacao.list('-created_date', 50);
                const porNome = todasOtimizacoes.filter(o => {
                    const nomeBusca = `${o.account_name || ''} ${o.cliente_nome || ''}`.toLowerCase();
                    return tokensUnicos.every(t => nomeBusca.includes(t));
                });

                const idsJa2 = new Set(otimizacoesEnriquecidas.map(o => o.conta_meta_ads_id).filter(Boolean));
                for (const o of porNome) {
                    if (!idsJa2.has(o.conta_meta_ads_id)) {
                        idsJa2.add(o.conta_meta_ads_id);
                        otimizacoesEnriquecidas.push(o);
                    }
                }

                // 5. Se encontrou uma conta Meta Ads, buscar otimizações dessa conta específica
                if (contaMetaAdsData?.account_name) {
                    const otmPorConta = todasOtimizacoes.filter(o =>
                        (o.account_name || '').toLowerCase() === contaMetaAdsData.account_name.toLowerCase()
                    );
                    for (const o of otmPorConta) {
                        if (!idsJa2.has(o.conta_meta_ads_id)) {
                            idsJa2.add(o.conta_meta_ads_id);
                            otimizacoesEnriquecidas.push(o);
                        }
                    }
                }

                // 6. Buscar RadarMetaData (métricas diárias de performance) por tokens
                if (tokensUnicos.length > 0) {
                    const radarData = await base44.asServiceRole.entities.RadarMetaData.list('-updated_date', 100);
                    const radarMatch = radarData.find(r => {
                        const accName = (r.account_name || '').toLowerCase();
                        const score = tokensUnicos.filter(t => accName.includes(t)).length;
                        return score >= minTokens;
                    });
                    if (radarMatch && !contaMetaAdsData) {
                        // Usa dados do radar como fonte alternativa de métricas
                        contaMetaAdsData = {
                            account_name: radarMatch.account_name,
                            leads: radarMatch.leads_7d,
                            cpl_meta_ads: radarMatch.cpl_7d,
                            amount_spent: radarMatch.amount_spent_ontem,
                        };
                    }
                }
            } catch (_) {
                // Silencioso: se falhar enriquecimento, usa só o que o frontend mandou
            }
        }

        // Monta contexto de otimizações Meta Ads
        let contextoOtimizacoes = '';
        const temOtimizacoes = otimizacoesEnriquecidas.length > 0;

        if (temOtimizacoes) {
            contextoOtimizacoes = 'Ações recentes de Meta Ads:\n';
            otimizacoesEnriquecidas.slice(0, 10).forEach(o => {
                const partes = [];
                if (o.problema) partes.push('Problema: ' + o.problema);
                if (o.objetivo) partes.push('Objetivo: ' + o.objetivo);
                if (o.acoes_implementadas) partes.push('Ações: ' + o.acoes_implementadas);
                contextoOtimizacoes += `- ${partes.join('. ')}\n`;
            });
        }

        // Adiciona dados da ContaMetaAds se disponível
        if (contaMetaAdsData) {
            if (!contextoOtimizacoes) {
                contextoOtimizacoes = 'Dados da conta Meta Ads:\n';
            } else {
                contextoOtimizacoes += '\nMétricas atuais da conta:\n';
            }
            if (contaMetaAdsData.leads != null) contextoOtimizacoes += `- Leads: ${contaMetaAdsData.leads}\n`;
            if (contaMetaAdsData.cpl_meta_ads != null) contextoOtimizacoes += `- Custo por lead: R$ ${contaMetaAdsData.cpl_meta_ads}\n`;
            if (contaMetaAdsData.amount_spent != null) contextoOtimizacoes += `- Investimento: R$ ${contaMetaAdsData.amount_spent}\n`;
            if (contaMetaAdsData.nota_gpt != null) contextoOtimizacoes += `- Score da conta: ${contaMetaAdsData.nota_gpt}/100\n`;
            if (contaMetaAdsData.classificacao) contextoOtimizacoes += `- Classificação: ${contaMetaAdsData.classificacao}\n`;
            if (contaMetaAdsData.main_issue) contextoOtimizacoes += `- Principal atenção: ${contaMetaAdsData.main_issue}\n`;
        }

        const temDadosMetaAds = temOtimizacoes || !!contaMetaAdsData;

        // Monta contexto do Kanban
        let contextoKanban = '';
        if (dados_kanban && dados_kanban.length > 0) {
            contextoKanban = 'Movimentações recentes no Kanban:\n';
            dados_kanban.forEach(k => {
                contextoKanban += `- Demanda "${k.titulo || 'Sem título'}" movida para "${k.setor || 'N/A'}"\n`;
            });
        }

        const prompt = `Você é um CS (Customer Success) experiente da agência VOXX, especializada em marketing digital (Meta Ads, Google Ads, criação de conteúdo).

Seu objetivo é gerar uma mensagem curta e consultiva para reativar a comunicação com um cliente que está com o grupo WhatsApp sem movimentação há ${tempo_sem_comunicacao || 'vários dias'}.

Cliente: ${cliente_nome}
${grupo_nome ? 'Grupo: ' + grupo_nome : ''}

Contexto disponível sobre o cliente:
${contextoMensagens || '(Sem mensagens recentes disponíveis)'}

${contextoDemandas || '(Sem demandas recentes)'}

${contextoOtimizacoes || '(Sem dados de Meta Ads disponíveis)'}

${contextoKanban || '(Sem movimentações de Kanban recentes)'}

Regras para a mensagem:
1. Seja CURTA — 300 a 600 caracteres.
2. Tom profissional, consultivo e próximo — como um gestor de conta experiente.
3. NÃO use linguagem técnica (CPM, CTR, frequência, etc).
4. NÃO invente dados ou métricas que não estejam no contexto acima.
5. NÃO cobre o cliente nem use tom negativo.
6. Use APENAS informações reais do contexto fornecido.
7. Se houver ações/demandas recentes, mencione-as de forma positiva e natural.
8. Se houver otimizações de Meta Ads, transforme em valor percebido pelo cliente.
9. Se NÃO houver informação suficiente, gere uma mensagem neutra de presença institucional.
10. NÃO use "Olá" ou "Prezado" como abertura — vá direto ao ponto.
11. Termine com uma abertura para o cliente trazer prioridades.
12. NÃO assine a mensagem.
13. NÃO use emojis em excesso — no máximo 1 se fizer sentido.
14. Use o nome do cliente naturalmente no texto.

IMPORTANTE: Se há dados reais de otimizações, demandas ou movimentações, use-os. Se não há dados suficientes, faça uma mensagem de presença/check-in sem inventar nada.`;

        const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt,
            model: 'claude_sonnet_4_6'
        });

        let mensagem = typeof response === 'string' ? response : response?.content || response?.text || '';

        return Response.json({
            mensagem_sugerida: mensagem.trim(),
            resumo_contexto_usado: {
                tem_mensagens: !!(mensagens_recentes && mensagens_recentes.length > 0),
                tem_demandas: !!(demandas_recentes && demandas_recentes.length > 0),
                tem_otimizacoes: temDadosMetaAds,
                tem_kanban: !!(dados_kanban && dados_kanban.length > 0),
            }
        });
    } catch (error) {
        console.error('Erro ao gerar mensagem de reativação:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});