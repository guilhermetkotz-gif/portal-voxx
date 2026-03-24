import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Motor de Recomendações Voxx Meta Ads
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
      "severity": (data) => data.frequency_current >= 3.0 ? "critical" : "high"
    },
    "CPL_SPIKE": {
      "label": "CPL em alta (piora relevante)",
      "check": (data) => data.delta_cpl_pct >= 0.25,
      "severity": (data) => data.delta_cpl_pct >= 0.35 ? "critical" : "high"
    },
    "CTR_DROP": {
      "label": "Queda de CTR (criativo/mensagem)",
      "check": (data) => data.ctr_vs_avg_pct <= -0.20,
      "severity": (data) => data.ctr_vs_avg_pct <= -0.30 ? "critical" : "high"
    },
    "CPM_RISE": {
      "label": "Aumento de CPM (leilão/posicionamento)",
      "check": (data) => data.cpm_vs_avg_pct >= 0.20,
      "severity": (data) => data.cpm_vs_avg_pct >= 0.35 ? "high" : "medium"
    },
    "PACING_MISMATCH": {
      "label": "Pacing fora do planejado",
      "check": (data) => data.spend_pacing_ratio < 0.7 || data.spend_pacing_ratio > 1.3,
      "severity": (data) => (data.spend_pacing_ratio < 0.6 || data.spend_pacing_ratio > 1.5) ? "high" : "medium"
    },
    "LOW_VOLUME_CONTEXT": {
      "label": "Baixo volume operacional",
      "check": (data) => data.leads_yesterday < 5,
      "severity": (data) => data.leads_yesterday < 2 ? "medium" : "low"
    }
  },
  "actions_library": {
    "FREQ_SATURATION": {
      "A": ["Substituir 1–2 criativos principais (novo hook + nova primeira cena/imagem)", "Manter 1 público principal (evitar fragmentação)", "Revisar CTA para foco em WhatsApp/Lead"],
      "B": ["Inserir 2 novos criativos e pausar os 2 com pior CTR", "Revisar sobreposição de público (exclusões simples)"],
      "C": ["Criar 1 novo conjunto com criativos vencedores e variações", "Testar público mais amplo (broad) e/ou lookalike", "Ajustar posicionamentos para reduzir saturação"],
      "D": ["Organizar criativos por clusters (dor/benefício/prova social/oferta)", "Dividir públicos (broad vs LAL vs retarget) com controle de sobreposição", "Criar calendário semanal de renovação criativa"]
    },
    "CPL_SPIKE": {
      "A": ["Reduzir para 1 campanha + 1 conjunto principal", "Pausar anúncios com CTR abaixo da média e pouco volume", "Atualizar copy e criativo principal"],
      "B": ["Criar 2 novos criativos com novos hooks", "Confirmar objetivo/otimização correta (Lead/Mensagem)", "Revisar públicos e excluir segmentos de pior desempenho"],
      "C": ["Testar 2 ângulos criativos (dor vs transformação) com orçamento dedicado", "Separar campanhas por objetivo e controlar orçamento por bloco", "Ajustar posicionamentos e criativos por placement"],
      "D": ["Analisar CPM/CTR/Frequência para identificar componente do aumento do CPL", "Reestruturar campanha (ABO/CBO conforme cenário) e reduzir desperdício", "Criar pipeline de criativos (mín. 4 variações/semana)"]
    },
    "CTR_DROP": {
      "A": ["Substituir criativo com pior CTR", "Reduzir texto e reforçar benefício central", "Garantir CTA direto (WhatsApp/Avaliação)"],
      "B": ["Criar 1 vídeo curto (5–10s) com hook forte nos 2 primeiros segundos", "Testar headline alternativa e CTA", "Revisar criativos por placement"],
      "C": ["Criar 2 novos conceitos (prova social / autoridade / transformação)", "Avaliar performance por placement e pausar os piores", "Ajustar público para reduzir dispersão"],
      "D": ["Organizar criativos por cluster e rodar testes controlados", "Atualizar narrativa e ângulos de oferta", "Implementar rotina de produção criativa semanal"]
    },
    "CPM_RISE": {
      "A": ["Revisar posicionamentos e remover os mais caros se necessário", "Manter público enxuto e criativo de melhor CTR"],
      "B": ["Ajustar público (exclusões básicas)", "Revisar placements e cortar os que elevaram CPM sem retorno"],
      "C": ["Testar público mais amplo (broad) para reduzir custo de leilão", "Melhorar CTR com novo criativo para compensar CPM"],
      "D": ["Criar campanhas paralelas com estratégia de entrega diferente", "Trabalhar criativos para elevar CTR e reduzir custo efetivo por resultado"]
    },
    "PACING_MISMATCH": {
      "A": ["Se underspend: simplificar estrutura e revisar limitações de entrega", "Se overspend: reduzir orçamento diário e evitar picos"],
      "B": ["Evitar mudanças frequentes de orçamento", "Ajustar gradualmente (+/- 10–20%)"],
      "C": ["Separar campanhas por objetivo e controlar orçamento", "Validar se há limitação por público/creative fatigue"],
      "D": ["Criar regras internas de redistribuição para campanhas vencedoras", "Avaliar spend cap e restrições de conta"]
    },
    "LOW_VOLUME_CONTEXT": {
      "A": ["Manter estabilidade por 48–72h antes de mudanças agressivas", "Focar em 1 ajuste por vez (criativo OU público)"],
      "B": ["Conferir consistência com 7d antes de mudanças grandes", "Priorizar ajustes de criativo"],
      "C": ["Aplicar mudanças em etapas e monitorar impacto", "Evitar reestruturação completa por variação pontual"],
      "D": ["Quebrar análise por campanha/adset para localizar origem da queda", "Aplicar correções localizadas"]
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
  const severityOrder = { "critical": 0, "high": 1, "medium": 2, "low": 3 };
  problems.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  return problems;
}

function generateDiagnosisText(problemId, data) {
  const diagnoses = {
    "FREQ_SATURATION": `Frequência atual de ${data.frequency_current.toFixed(2)} indica que o mesmo público está vendo os anúncios repetidamente, causando fadiga criativa e redução de efetividade.`,
    "CPL_SPIKE": `Variação de CPL de ${(data.delta_cpl_pct * 100).toFixed(1)}% indica aumento significativo no custo de aquisição, comprometendo a eficiência da campanha.`,
    "CTR_DROP": `Queda de CTR de ${(data.ctr_vs_avg_pct * 100).toFixed(1)}% sugere que os criativos perderam relevância ou apelo para o público-alvo.`,
    "CPM_RISE": `Aumento de CPM indica maior competição no leilão ou piora no ranking dos anúncios.`,
    "PACING_MISMATCH": `O ritmo de gasto está ${data.spend_pacing_ratio < 0.7 ? 'abaixo' : 'acima'} do planejado, podendo comprometer objetivos do período.`,
    "LOW_VOLUME_CONTEXT": `Volume de apenas ${data.leads_yesterday} leads ontem - amostra insuficiente para conclusões definitivas.`
  };
  
  return diagnoses[problemId] || "Análise detalhada necessária.";
}

function generateExpectedImpact(problemId, investmentBucket) {
  const impacts = {
    "FREQ_SATURATION": {
      "A": "Redução imediata da frequência e recuperação do CTR em 24-48h",
      "B": "Renovação do interesse do público e estabilização das métricas",
      "C": "Expansão sustentável do alcance com controle de saturação",
      "D": "Sistema escalável de criação contínua com performance consistente"
    },
    "CPL_SPIKE": {
      "A": "Simplificação da estrutura e redução de desperdício",
      "B": "Retorno ao CPL anterior com otimização focada",
      "C": "Identificação do melhor ângulo criativo com teste controlado",
      "D": "Diagnóstico profundo e correção estrutural do CPL"
    },
    "CTR_DROP": {
      "A": "Recuperação rápida do CTR com criativo mais relevante",
      "B": "Aumento significativo de engajamento com novo formato",
      "C": "Criação de múltiplos criativos vencedores",
      "D": "Sistema de produção criativa consistente"
    },
    "CPM_RISE": {
      "A": "Contenção de custos com ajustes táticos",
      "B": "Otimização do custo por impressão",
      "C": "Compensação do CPM com melhor performance",
      "D": "Mitigação estrutural da competitividade do leilão"
    },
    "PACING_MISMATCH": {
      "A": "Alinhamento imediato com o budget planejado",
      "B": "Estabilização do ritmo de gasto",
      "C": "Controle granular por objetivo de campanha",
      "D": "Redistribuição inteligente e automática de budget"
    },
    "LOW_VOLUME_CONTEXT": {
      "A": "Evitar decisões precipitadas baseadas em pouca amostra",
      "B": "Validação consistente antes de mudanças estruturais",
      "C": "Ajustes calibrados com monitoramento preciso",
      "D": "Análise segmentada para ação cirúrgica"
    }
  };
  
  return impacts[problemId]?.[investmentBucket] || "Melhoria esperada nas métricas principais";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { account_name, investment_tier } = await req.json();

    if (!account_name) {
      return Response.json({ error: 'Invalid input: account_name required' }, { status: 400 });
    }

    // Buscar dados da conta e radar
    const accounts = await base44.asServiceRole.entities.ContaMetaAds.filter({ 
      account_name 
    });
    
    const radarData = await base44.asServiceRole.entities.RadarMetaData.filter({ 
      account_name 
    });

    if (!accounts || accounts.length === 0) {
      return Response.json({ error: 'Account not found' }, { status: 404 });
    }

    const account = accounts[0];
    const radar = radarData.length > 0 ? radarData[0] : null;

    // Construir objeto de dados para análise
    const analysisData = {
      frequency_current: Number(account.frequency) || 0,
      delta_cpl_pct: radar ? (Number(radar.variacao_cpl) / 100) : 0,
      ctr_vs_avg_pct: radar ? (Number(radar.variacao_ctr) / 100) : 0,
      cpm_vs_avg_pct: 0,
      spend_pacing_ratio: 1.0,
      leads_yesterday: Number(radar?.leads_ontem) || 0,
      monthly_investment: Number(account.amount_spent) || 0
    };

    const investmentBucket = getInvestmentBucket(analysisData.monthly_investment);
    const problems = detectProblems(analysisData);
    
    // Gerar recomendações para cada problema encontrado
    const recommendations = problems.map(problem => {
      const actions = CONFIG.actions_library[problem.problem_id]?.[investmentBucket] || [];
      
      return {
        problem: problem.label,
        diagnosis: generateDiagnosisText(problem.problem_id, analysisData),
        severity: problem.severity,
        actions: actions,
        expected_impact: generateExpectedImpact(problem.problem_id, investmentBucket)
      };
    });

    return Response.json({ 
      success: true,
      account_name,
      investment_bucket: investmentBucket,
      investment_bucket_label: CONFIG.investment_buckets.find(b => b.id === investmentBucket)?.label,
      recommendations
    });

  } catch (error) {
    console.error('Error generating recommendations:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});