import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verificar se é admin
        const isAdmin = user.role === 'admin' || user.tipo_usuario === 'voxx_admin' || user.tipo_usuario === 'voxx_manager';
        if (!isAdmin) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { account_name, horizon = 7 } = await req.json();

        // Buscar dados históricos da conta
        const radarData = await base44.asServiceRole.entities.RadarMetaData.filter({ account_name });
        const accountData = await base44.asServiceRole.entities.ContaMetaAds.filter({ account_name });

        if (!radarData.length || !accountData.length) {
            return Response.json({ error: 'Dados insuficientes para previsão' }, { status: 400 });
        }

        const radar = radarData[0];
        const account = accountData[0];

        // Buscar histórico de otimizações
        const otimizacoes = await base44.asServiceRole.entities.MetaAdsOtimizacao.filter(
            { account_name },
            '-created_date',
            10
        );

        // Preparar contexto para o LLM
        const contexto = {
            conta: account_name,
            periodo_previsao: `${horizon} dias`,
            metricas_atuais: {
                cpl_ontem: radar.cpl_ontem,
                cpl_7d: radar.cpl_7d,
                leads_ontem: radar.leads_ontem,
                leads_7d: radar.leads_7d,
                leads_7d_media_dia: radar.leads_7d_media_dia,
                ctr_ontem: radar.ctr_ontem,
                ctr_7d: radar.ctr_7d,
                frequencia_ontem: radar.frequencia_ontem,
                frequencia_7d: radar.frequencia_7d,
                variacao_cpl: radar.variacao_cpl,
                variacao_ctr: radar.variacao_ctr,
                variacao_frequencia: radar.variacao_frequencia
            },
            metricas_adicionais: {
                gasto: account.amount_spent,
                impressions: account.impressions,
                frequency: account.frequency,
                conversas: account.messaging_conversations,
                conexoes: account.new_messaging_connections,
                cost_per_messaging: account.cost_per_messaging
            },
            otimizacoes_recentes: otimizacoes.map(o => ({
                data: o.data_acao,
                problema: o.problema,
                objetivo: o.objetivo,
                resumo: o.resumo_acao
            })),
            referencias_frequencia: {
                '1_dia': '1.1 - 1.6',
                '7_dias': '1.8 - 2.8',
                '14_dias': '2.5 - 3.5',
                '30_dias': '3.5 - 5.0'
            }
        };

        const prompt = `Você é um especialista em análise preditiva de campanhas Meta Ads.

DADOS DA CONTA:
${JSON.stringify(contexto, null, 2)}

TAREFA:
Analise os dados históricos e tendências da conta e gere uma previsão detalhada para os próximos ${horizon} dias.

CONSIDERE:
1. Tendências recentes (variações de CPL, CTR, Frequência)
2. Sazonalidade e padrões de comportamento
3. Impacto das otimizações recentes
4. Saturação de público (frequência)
5. Faixas de frequência saudável por período:
   - 1 dia: 1.1 - 1.6
   - 7 dias: 1.8 - 2.8
   - 14 dias: 2.5 - 3.5
   - 30 dias: 3.5 - 5.0

INSTRUÇÕES:
- Use análise de regressão linear para tendências
- Aplique fatores de sazonalidade se aplicável
- Considere aceleração/desaceleração baseada em otimizações
- Identifique riscos e oportunidades específicos
- Seja realista e conservador nas projeções

Forneça a previsão no formato JSON solicitado.`;

        const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt,
            response_json_schema: {
                type: 'object',
                properties: {
                    previsoes: {
                        type: 'object',
                        properties: {
                            cpl: {
                                type: 'object',
                                properties: {
                                    valor_previsto: { type: 'number' },
                                    intervalo_confianca: {
                                        type: 'object',
                                        properties: {
                                            min: { type: 'number' },
                                            max: { type: 'number' }
                                        }
                                    },
                                    tendencia: { type: 'string', enum: ['alta', 'baixa', 'estavel'] },
                                    confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] }
                                }
                            },
                            ctr: {
                                type: 'object',
                                properties: {
                                    valor_previsto: { type: 'number' },
                                    intervalo_confianca: {
                                        type: 'object',
                                        properties: {
                                            min: { type: 'number' },
                                            max: { type: 'number' }
                                        }
                                    },
                                    tendencia: { type: 'string', enum: ['alta', 'baixa', 'estavel'] },
                                    confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] }
                                }
                            },
                            conversoes: {
                                type: 'object',
                                properties: {
                                    total_previsto: { type: 'number' },
                                    media_dia: { type: 'number' },
                                    intervalo_confianca: {
                                        type: 'object',
                                        properties: {
                                            min: { type: 'number' },
                                            max: { type: 'number' }
                                        }
                                    },
                                    tendencia: { type: 'string', enum: ['alta', 'baixa', 'estavel'] }
                                }
                            },
                            frequencia: {
                                type: 'object',
                                properties: {
                                    valor_previsto: { type: 'number' },
                                    status: { type: 'string', enum: ['saudavel', 'alerta', 'critico'] },
                                    risco_saturacao: { type: 'string', enum: ['baixo', 'moderado', 'alto'] }
                                }
                            },
                            gasto_estimado: {
                                type: 'object',
                                properties: {
                                    total: { type: 'number' },
                                    diario: { type: 'number' }
                                }
                            }
                        }
                    },
                    analise: {
                        type: 'object',
                        properties: {
                            riscos: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        tipo: { type: 'string' },
                                        descricao: { type: 'string' },
                                        severidade: { type: 'string', enum: ['baixa', 'media', 'alta', 'critica'] },
                                        probabilidade: { type: 'string', enum: ['baixa', 'media', 'alta'] }
                                    }
                                }
                            },
                            oportunidades: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        tipo: { type: 'string' },
                                        descricao: { type: 'string' },
                                        impacto_potencial: { type: 'string' }
                                    }
                                }
                            },
                            recomendacoes: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        acao: { type: 'string' },
                                        prioridade: { type: 'string', enum: ['baixa', 'media', 'alta'] },
                                        justificativa: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    confianca_geral: {
                        type: 'string',
                        enum: ['alta', 'media', 'baixa']
                    },
                    fatores_limitantes: {
                        type: 'array',
                        items: { type: 'string' }
                    }
                }
            }
        });

        return Response.json({
            success: true,
            account_name,
            horizon,
            data_previsao: new Date().toISOString(),
            ...response
        });

    } catch (error) {
        console.error('Erro ao gerar previsão:', error);
        return Response.json({ 
            error: 'Erro ao gerar previsão',
            details: error.message 
        }, { status: 500 });
    }
});