import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Configuration JSON - Motor de Recomendações Voxx Meta Ads
const CONFIG = {
  "version": "1.0.0",
  "investment_buckets": [
    { "id": "A", "label": "Até 3000/mês", "min_monthly": 0, "max_monthly": 3000 },
    { "id": "B", "label": "3001 a 8000/mês", "min_monthly": 3001, "max_monthly": 8000 },
    { "id": "C", "label": "8001 a 20000/mês", "min_monthly": 8001, "max_monthly": 20000 },
    { "id": "D", "label": "20001+/mês", "min_monthly": 20001, "max_monthly": 999999 }
  ],
  "thresholds": {
    "frequency": { "warn": 1.9, "high": 2.5, "critical": 3.0 },
    "delta_cpl_pct": { "warn": 0.15, "high": 0.25, "critical": 0.35 },
    "ctr_vs_avg_pct": { "warn_drop": -0.10, "high_drop": -0.20, "critical_drop": -0.30 },
    "pacing_ratio": { "underspend": 0.70, "overspend": 1.30 }
  },
  "problem_catalog": {
    "FREQ_SATURATION": {
      "label": "Saturação por Frequência",
      "check": (data) => data.frequency_current >= 2.5,
      "severity": (data) => data.frequency_current >= 3.0 ? "CRITICAL" : "HIGH"
    },
    "CPL_SPIKE": {
      "label": "CPL em alta (piora relevante)",
      "check": (data) => data.delta_cpl_pct >= 0.25,
      "severity": (data) => data.delta_cpl_pct >= 0.35 ? "CRITICAL" : "HIGH"
    },
    "CTR_DROP": {
      "label": "Queda de CTR (criativo/mensagem)",
      "check": (data) => data.ctr_vs_avg_pct <= -0.20,
      "severity": (data) => data.ctr_vs_avg_pct <= -0.30 ? "CRITICAL" : "HIGH"
    },
    "CPM_RISE": {
      "label": "Aumento de CPM (leilão/posicionamento)",
      "check": (data) => data.cpm_vs_avg_pct >= 0.20,
      "severity": (data) => data.cpm_vs_avg_pct >= 0.35 ? "HIGH" : "MEDIUM"
    },
    "PACING_MISMATCH": {
      "label": "Pacing fora do planejado",
      "check": (data) => data.spend_pacing_ratio < 0.7 || data.spend_pacing_ratio > 1.3,
      "severity": (data) => (data.spend_pacing_ratio < 0.6 || data.spend_pacing_ratio > 1.5) ? "HIGH" : "MEDIUM"
    },
    "LOW_VOLUME_CONTEXT": {
      "label": "Baixo volume operacional",
      "check": (data) => data.leads_yesterday < 5,
      "severity": (data) => data.leads_yesterday < 2 ? "MEDIUM" : "LOW"
    }
  },
  "actions_library": {
    "FREQ_SATURATION": {
      "A": [
        {
          "action_id": "A_FREQ_01",
          "title": "Trocar criativos imediatamente",
          "steps": ["Substituir 1–2 criativos principais (novo hook + nova primeira cena/imagem).", "Manter 1 público principal (evitar fragmentação).", "Revisar CTA para foco em WhatsApp/Lead."],
          "impact": "FAST",
          "complexity": "LOW"
        }
      ],
      "B": [
        {
          "action_id": "B_FREQ_01",
          "title": "Rotação criativa com substituição parcial",
          "steps": ["Inserir 2 novos criativos e pausar os 2 com pior CTR.", "Revisar sobreposição de público (exclusões simples)."],
          "impact": "FAST",
          "complexity": "MEDIUM"
        }
      ],
      "C": [
        {
          "action_id": "C_FREQ_01",
          "title": "Reset criativo + expansão de público",
          "steps": ["Criar 1 novo conjunto com criativos vencedores e variações.", "Testar público mais amplo (broad) e/ou lookalike.", "Ajustar posicionamentos para reduzir saturação."],
          "impact": "MEDIUM",
          "complexity": "MEDIUM"
        }
      ],
      "D": [
        {
          "action_id": "D_FREQ_01",
          "title": "Estrutura contínua de criativos e split de públicos",
          "steps": ["Organizar criativos por clusters (dor/benefício/prova social/oferta).", "Dividir públicos (broad vs LAL vs retarget) com controle de sobreposição.", "Criar calendário semanal de renovação criativa."],
          "impact": "STRUCTURAL",
          "complexity": "HIGH"
        }
      ]
    },
    "CPL_SPIKE": {
      "A": [
        {
          "action_id": "A_CPL_01",
          "title": "Consolidar e simplificar",
          "steps": ["Reduzir para 1 campanha + 1 conjunto principal.", "Pausar anúncios com CTR abaixo da média e pouco volume.", "Atualizar copy e criativo principal."],
          "impact": "FAST",
          "complexity": "LOW"
        }
      ],
      "B": [
        {
          "action_id": "B_CPL_01",
          "title": "Troca de criativos + ajuste de otimização",
          "steps": ["Criar 2 novos criativos com novos hooks.", "Confirmar objetivo/otimização correta (Lead/Mensagem).", "Revisar públicos e excluir segmentos de pior desempenho."],
          "impact": "FAST",
          "complexity": "MEDIUM"
        }
      ],
      "C": [
        {
          "action_id": "C_CPL_01",
          "title": "Teste A/B e reestruturação leve",
          "steps": ["Testar 2 ângulos criativos (dor vs transformação) com orçamento dedicado.", "Separar campanhas por objetivo e controlar orçamento por bloco.", "Ajustar posicionamentos e criativos por placement."],
          "impact": "MEDIUM",
          "complexity": "MEDIUM"
        }
      ],
      "D": [
        {
          "action_id": "D_CPL_01",
          "title": "Diagnóstico de leilão + arquitetura de campanhas",
          "steps": ["Analisar CPM/CTR/Frequência para identificar componente do aumento do CPL.", "Reestruturar campanha (ABO/CBO conforme cenário) e reduzir desperdício.", "Criar pipeline de criativos (mín. 4 variações/semana)."],
          "impact": "STRUCTURAL",
          "complexity": "HIGH"
        }
      ]
    },
    "CTR_DROP": {
      "A": [
        {
          "action_id": "A_CTR_01",
          "title": "Trocar criativo principal e simplificar promessa",
          "steps": ["Substituir criativo com pior CTR.", "Reduzir texto e reforçar benefício central.", "Garantir CTA direto (WhatsApp/Avaliação)."],
          "impact": "FAST",
          "complexity": "LOW"
        }
      ],
      "B": [
        {
          "action_id": "B_CTR_01",
          "title": "Novo hook + formato vídeo curto",
          "steps": ["Criar 1 vídeo curto (5–10s) com hook forte nos 2 primeiros segundos.", "Testar headline alternativa e CTA.", "Revisar criativos por placement."],
          "impact": "FAST",
          "complexity": "MEDIUM"
        }
      ],
      "C": [
        {
          "action_id": "C_CTR_01",
          "title": "Novos conceitos criativos e prova social",
          "steps": ["Criar 2 novos conceitos (prova social / autoridade / transformação).", "Avaliar performance por placement e pausar os piores.", "Ajustar público para reduzir dispersão."],
          "impact": "MEDIUM",
          "complexity": "MEDIUM"
        }
      ],
      "D": [
        {
          "action_id": "D_CTR_01",
          "title": "Clusters criativos + testing sistemático",
          "steps": ["Organizar criativos por cluster e rodar testes controlados.", "Atualizar narrativa e ângulos de oferta.", "Implementar rotina de produção criativa semanal."],
          "impact": "STRUCTURAL",
          "complexity": "HIGH"
        }
      ]
    },
    "CPM_RISE": {
      "A": [
        {
          "action_id": "A_CPM_01",
          "title": "Ajustar posicionamentos e evitar dispersão",
          "steps": ["Revisar posicionamentos e remover os mais caros se necessário.", "Manter público enxuto e criativo de melhor CTR."],
          "impact": "FAST",
          "complexity": "LOW"
        }
      ],
      "B": [
        {
          "action_id": "B_CPM_01",
          "title": "Refinar público + revisar horários/placements",
          "steps": ["Ajustar público (exclusões básicas).", "Revisar placements e cortar os que elevaram CPM sem retorno."],
          "impact": "MEDIUM",
          "complexity": "MEDIUM"
        }
      ],
      "C": [
        {
          "action_id": "C_CPM_01",
          "title": "Mitigação de leilão",
          "steps": ["Testar público mais amplo (broad) para reduzir custo de leilão.", "Melhorar CTR com novo criativo para compensar CPM."],
          "impact": "MEDIUM",
          "complexity": "MEDIUM"
        }
      ],
      "D": [
        {
          "action_id": "D_CPM_01",
          "title": "Arquitetura de campanhas para cenário competitivo",
          "steps": ["Criar campanhas paralelas com estratégia de entrega diferente.", "Trabalhar criativos para elevar CTR e reduzir custo efetivo por resultado."],
          "impact": "STRUCTURAL",
          "complexity": "HIGH"
        }
      ]
    },
    "PACING_MISMATCH": {
      "A": [
        {
          "action_id": "A_PACE_01",
          "title": "Ajustar orçamento diário para o planejado",
          "steps": ["Se underspend: simplificar estrutura e revisar limitações de entrega.", "Se overspend: reduzir orçamento diário e evitar picos."],
          "impact": "FAST",
          "complexity": "LOW"
        }
      ],
      "B": [
        {
          "action_id": "B_PACE_01",
          "title": "Revisar pacing e estabilidade do aprendizado",
          "steps": ["Evitar mudanças frequentes de orçamento.", "Ajustar gradualmente (+/- 10–20%)."],
          "impact": "FAST",
          "complexity": "LOW"
        }
      ],
      "C": [
        {
          "action_id": "C_PACE_01",
          "title": "Controle de pacing por bloco de campanha",
          "steps": ["Separar campanhas por objetivo e controlar orçamento.", "Validar se há limitação por público/creative fatigue."],
          "impact": "MEDIUM",
          "complexity": "MEDIUM"
        }
      ],
      "D": [
        {
          "action_id": "D_PACE_01",
          "title": "Gestão de budget dinâmica",
          "steps": ["Criar regras internas de redistribuição para campanhas vencedoras.", "Avaliar spend cap e restrições de conta."],
          "impact": "STRUCTURAL",
          "complexity": "HIGH"
        }
      ]
    },
    "LOW_VOLUME_CONTEXT": {
      "A": [
        {
          "action_id": "A_VOL_01",
          "title": "Sinalizar baixa amostra e evitar decisões abruptas",
          "steps": ["Manter estabilidade por 48–72h antes de mudanças agressivas.", "Focar em 1 ajuste por vez (criativo OU público)."],
          "impact": "MEDIUM",
          "complexity": "LOW"
        }
      ],
      "B": [
        {
          "action_id": "B_VOL_01",
          "title": "Validar leitura com janela maior",
          "steps": ["Conferir consistência com 7d antes de mudanças grandes.", "Priorizar ajustes de criativo."],
          "impact": "MEDIUM",
          "complexity": "LOW"
        }
      ],
      "C": [
        {
          "action_id": "C_VOL_01",
          "title": "Ajustes graduais com confirmação",
          "steps": ["Aplicar mudanças em etapas e monitorar impacto.", "Evitar reestruturação completa por variação pontual."],
          "impact": "MEDIUM",
          "complexity": "MEDIUM"
        }
      ],
      "D": [
        {
          "action_id": "D_VOL_01",
          "title": "Diagnóstico por segmentação",
          "steps": ["Quebrar análise por campanha/adset para localizar origem da queda.", "Aplicar correções localizadas."],
          "impact": "MEDIUM",
          "complexity": "MEDIUM"
        }
      ]
    }
  }
};

function getInvestmentBucket(monthlyInvestment) {
  for (const bucket of CONFIG.investment_buckets) {
    if (monthlyInvestment >= bucket.min_monthly && monthlyInvestment <= bucket.max_monthly) {
      return bucket.id;
    }
  }
  return "A";
}

function detectProblems(data) {
  const problems = [];
  
  for (const [problemId, config] of Object.entries(CONFIG.problem_catalog)) {
    if (config.check(data)) {
      problems.push({
        problem_id: problemId,
        label: config.label,
        severity: config.severity(data)
      });
    }
  }
  
  // Sort by severity
  const severityOrder = { "CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3 };
  problems.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  return problems;
}

function getRecommendedActions(problemId, investmentBucket, maxActions = 3) {
  const actions = CONFIG.actions_library[problemId]?.[investmentBucket] || [];
  return actions.slice(0, maxActions);
}

function generateStatusMessage(data) {
  // Frequência alta + CTR em queda
  if (data.frequency_current >= 2.5 && data.ctr_vs_avg_pct <= -0.2) {
    return "Frequência elevada e CTR em queda — provável saturação de criativos";
  }
  
  // CPL piorou
  if (data.delta_cpl_pct >= 0.25) {
    return "CPL piorou de forma relevante vs média recente";
  }
  
  // Pacing fora
  if (data.spend_pacing_ratio < 0.7 || data.spend_pacing_ratio > 1.3) {
    return "Pacing do gasto diário fora do planejado";
  }
  
  // Baixo volume
  if (data.leads_yesterday < 5) {
    return "Baixo volume de amostra — validar tendência";
  }
  
  return "Performance sem alertas críticos no momento";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accounts } = await req.json();

    if (!accounts || !Array.isArray(accounts)) {
      return Response.json({ error: 'Invalid input: accounts array required' }, { status: 400 });
    }

    const recommendations = accounts.map(account => {
      const investmentBucket = getInvestmentBucket(account.monthly_investment || 0);
      const problems = detectProblems(account);
      
      const primaryProblem = problems[0];
      const actions = primaryProblem 
        ? getRecommendedActions(primaryProblem.problem_id, investmentBucket)
        : [];

      return {
        unit_name: account.unit_name,
        account_name: account.account_name,
        investment_bucket: investmentBucket,
        investment_bucket_label: CONFIG.investment_buckets.find(b => b.id === investmentBucket)?.label,
        problems: problems,
        primary_problem: primaryProblem || null,
        actions: actions,
        status_message: generateStatusMessage(account)
      };
    });

    return Response.json({ 
      success: true,
      recommendations
    });

  } catch (error) {
    console.error('Error generating recommendations:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});