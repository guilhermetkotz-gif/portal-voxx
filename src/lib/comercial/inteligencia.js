/**
 * Motor de Inteligência Comercial Voxx
 * Centraliza triggers, classificações e automações de follow-up
 */

import { differenceInDays, parseISO, addDays, format } from 'date-fns';

// ─── CLASSIFICAÇÃO DO LEAD ────────────────────────────────────────────────────

/**
 * Retorna a temperatura do lead: 🔥 Quente / 🟡 Morno / ❄️ Frio
 */
export function calcularTemperaturaLead(lead, interacoes = []) {
  const diasSemInteracao = lead.ultima_interacao
    ? differenceInDays(new Date(), parseISO(lead.ultima_interacao))
    : 999;

  const fitScore = lead.fit_score || 0;
  const fitAlto = lead.fit_classificacao === 'alto_fit';
  const fitMedio = lead.fit_classificacao === 'medio_fit';

  // Conta interações nos últimos 7 dias
  const interacoesRecentes = interacoes.filter(i => {
    if (!i.created_date) return false;
    return differenceInDays(new Date(), parseISO(i.created_date)) <= 7;
  }).length;

  // Verificar se tem reunião recente (últimos 7 dias)
  const temReuniaoRecente = interacoes.some(i =>
    i.tipo === 'reuniao' && i.created_date &&
    differenceInDays(new Date(), parseISO(i.created_date)) <= 7
  );

  // Lead Quente: fit alto + ativo + engajado
  if (fitAlto && diasSemInteracao <= 3 && (interacoesRecentes >= 2 || temReuniaoRecente)) {
    return { emoji: '🔥', label: 'Quente', cor: 'text-red-600', bg: 'bg-red-50', border: 'border-red-300' };
  }

  // Lead Quente: em negociação com fit bom
  if (['negociacao', 'proposta_enviada'].includes(lead.etapa) && diasSemInteracao <= 5) {
    return { emoji: '🔥', label: 'Quente', cor: 'text-red-600', bg: 'bg-red-50', border: 'border-red-300' };
  }

  // Lead Morno: fit médio ou ativo mas sem engajamento alto
  if ((fitMedio || fitAlto) && diasSemInteracao <= 7) {
    return { emoji: '🟡', label: 'Morno', cor: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-300' };
  }

  if (diasSemInteracao <= 5 && interacoesRecentes >= 1) {
    return { emoji: '🟡', label: 'Morno', cor: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-300' };
  }

  // Lead Frio: sem interação longa ou fit baixo
  return { emoji: '❄️', label: 'Frio', cor: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-300' };
}

// ─── SCORE DE PRIORIDADE ─────────────────────────────────────────────────────

/**
 * Calcula score de prioridade 0-100 para ordenar leads.
 * Maior = atacar primeiro.
 */
export function calcularScorePrioridade(lead, interacoes = []) {
  let score = 0;

  // Fit Score (0–40 pts)
  if (lead.fit_score > 0) score += (lead.fit_score / 100) * 40;

  // Valor estimado (0–20 pts)
  if (lead.valor_estimado > 0) {
    const valNorm = Math.min(lead.valor_estimado / 10000, 1); // normaliza até 10k
    score += valNorm * 20;
  }

  // Etapa avançada (0–20 pts)
  const etapaScores = {
    novo_lead: 0, contato_iniciado: 5, diagnostico_reuniao: 8,
    qualificado: 12, proposta_enviada: 16, negociacao: 20,
    fechado_ganho: 0, fechado_perdido: 0,
  };
  score += etapaScores[lead.etapa] || 0;

  // Engajamento recente (0–10 pts)
  const interacoesRecentes = interacoes.filter(i =>
    i.created_date && differenceInDays(new Date(), parseISO(i.created_date)) <= 7
  ).length;
  score += Math.min(interacoesRecentes * 2, 10);

  // Penalizar inatividade (até -20 pts)
  const diasSemInteracao = lead.ultima_interacao
    ? differenceInDays(new Date(), parseISO(lead.ultima_interacao))
    : 30;
  if (diasSemInteracao > 14) score -= 20;
  else if (diasSemInteracao > 7) score -= 10;
  else if (diasSemInteracao > 3) score -= 5;

  // Proposta sem resposta (bônus urgência: +5)
  if (lead.etapa === 'proposta_enviada' && lead.proposta?.status === 'enviada') {
    const diasProposta = lead.proposta.data_envio
      ? differenceInDays(new Date(), parseISO(lead.proposta.data_envio))
      : 0;
    if (diasProposta >= 1) score += 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── TRIGGERS ────────────────────────────────────────────────────────────────

/**
 * Avalia todos os triggers do lead e retorna alertas/sugestões.
 */
export function avaliarTriggers(lead, interacoes = []) {
  const triggers = [];
  const diasSemInteracao = lead.ultima_interacao
    ? differenceInDays(new Date(), parseISO(lead.ultima_interacao))
    : 999;

  const etapaFechada = ['fechado_ganho', 'fechado_perdido'].includes(lead.etapa);

  // TRIGGER: Tempo sem interação
  if (!etapaFechada) {
    if (diasSemInteracao >= 7) {
      triggers.push({
        tipo: 'inatividade_critica',
        nivel: 'critico',
        titulo: `Sem interação há ${diasSemInteracao} dias`,
        descricao: 'Lead pode estar perdido. Sugerir reativação ou arquivamento.',
        acao: 'registrar_interacao',
        icone: '🔴'
      });
    } else if (diasSemInteracao >= 5) {
      triggers.push({
        tipo: 'inatividade_alta',
        nivel: 'alto',
        titulo: `Sem interação há ${diasSemInteracao} dias`,
        descricao: 'Contato urgente necessário para manter o lead aquecido.',
        acao: 'registrar_interacao',
        icone: '🟠'
      });
    } else if (diasSemInteracao >= 2) {
      triggers.push({
        tipo: 'inatividade_leve',
        nivel: 'baixo',
        titulo: `Sem interação há ${diasSemInteracao} dias`,
        descricao: 'Manter contato ativo para não esfriar o relacionamento.',
        acao: 'registrar_interacao',
        icone: '🟡'
      });
    }
  }

  // TRIGGER: Fit Score Baixo
  if (lead.fit_score > 0 && lead.fit_classificacao === 'baixo_fit') {
    triggers.push({
      tipo: 'fit_baixo',
      nivel: 'aviso',
      titulo: 'Fit Score baixo',
      descricao: 'Baixo potencial de conversão. Cuidado com o esforço investido neste lead.',
      acao: 'qualificacao',
      icone: '⚠️'
    });
  }

  // TRIGGER: Proposta sem resposta
  if (lead.etapa === 'proposta_enviada' && lead.proposta?.status === 'enviada') {
    const diasProposta = lead.proposta.data_envio
      ? differenceInDays(new Date(), parseISO(lead.proposta.data_envio))
      : 0;

    if (diasProposta >= 7) {
      triggers.push({
        tipo: 'proposta_sem_resposta',
        nivel: 'alto',
        titulo: `Proposta sem resposta há ${diasProposta} dias`,
        descricao: 'Fazer follow-up urgente. Considere ligar diretamente.',
        acao: 'registrar_interacao',
        icone: '📬'
      });
    } else if (diasProposta >= 3) {
      triggers.push({
        tipo: 'proposta_followup',
        nivel: 'medio',
        titulo: `Proposta enviada há ${diasProposta} dias`,
        descricao: 'Bom momento para um follow-up de reforço.',
        acao: 'registrar_interacao',
        icone: '📨'
      });
    } else if (diasProposta >= 1) {
      triggers.push({
        tipo: 'proposta_d1',
        nivel: 'info',
        titulo: 'Follow-up leve sugerido',
        descricao: 'Confirme que a proposta foi recebida e se há dúvidas.',
        acao: 'registrar_interacao',
        icone: '💬'
      });
    }
  }

  // TRIGGER: Lead Quente (oportunidade em destaque)
  const temperatura = calcularTemperaturaLead(lead, interacoes);
  if (temperatura.label === 'Quente' && !etapaFechada) {
    triggers.push({
      tipo: 'lead_quente',
      nivel: 'oportunidade',
      titulo: '🔥 Lead Quente — Oportunidade real!',
      descricao: 'Alta interação + fit alto + reunião recente. Foque aqui agora!',
      acao: null,
      icone: '🔥'
    });
  }

  // TRIGGER: Muitas interações sem avanço
  const totalInteracoes = interacoes.filter(i => i.tipo !== 'status_change').length;
  if (totalInteracoes >= 5) {
    const etapasPercorridas = new Set(
      interacoes.filter(i => i.tipo === 'status_change').map(i => i.status_novo)
    ).size;
    if (etapasPercorridas <= 1 && !etapaFechada) {
      triggers.push({
        tipo: 'travado',
        nivel: 'aviso',
        titulo: 'Lead travado — revisar abordagem',
        descricao: `${totalInteracoes} interações sem evolução de etapa. Tente uma abordagem diferente.`,
        acao: 'registrar_interacao',
        icone: '🔒'
      });
    }
  }

  // TRIGGER: Fechado Ganho → sugerir ações pós-venda
  if (lead.etapa === 'fechado_ganho') {
    triggers.push({
      tipo: 'pos_venda',
      nivel: 'info',
      titulo: 'Cliente conquistado! Próximos passos',
      descricao: 'Crie um plano de ação e inicie o onboarding para garantir uma boa experiência.',
      acao: 'plano_acao',
      icone: '🎉'
    });
  }

  return triggers;
}

// ─── FOLLOW-UP AUTOMÁTICO ────────────────────────────────────────────────────

/**
 * Gera tarefas automáticas de follow-up após proposta enviada.
 * Retorna array de tarefas para criar, filtrando as que já existem.
 */
export function gerarTarefasFollowUp(lead, tarefasExistentes = []) {
  if (lead.etapa !== 'proposta_enviada' && lead.etapa !== 'negociacao') return [];
  if (!lead.proposta?.data_envio && !lead.ultima_interacao) return [];

  const dataBase = lead.proposta?.data_envio
    ? parseISO(lead.proposta.data_envio)
    : lead.ultima_interacao ? parseISO(lead.ultima_interacao) : new Date();

  const seguimentos = [
    { dias: 1, titulo: `Follow-up leve — ${lead.nome_empresa}`, tipo: 'follow_up' },
    { dias: 3, titulo: `Reforço de proposta — ${lead.nome_empresa}`, tipo: 'follow_up' },
    { dias: 7, titulo: `Follow-up urgente — ${lead.nome_empresa}`, tipo: 'ligar' },
    { dias: 14, titulo: `Última tentativa — ${lead.nome_empresa}`, tipo: 'ligar' },
  ];

  // Filtra seguimentos que já têm tarefa automática similar
  const titulosExistentes = new Set(tarefasExistentes.map(t => t.titulo));

  return seguimentos
    .filter(s => !titulosExistentes.has(s.titulo))
    .map(s => ({
      lead_id: lead.id,
      lead_nome: lead.nome_empresa,
      titulo: s.titulo,
      tipo: s.tipo,
      data_prazo: format(addDays(dataBase, s.dias), 'yyyy-MM-dd'),
      status: 'pendente',
      automatica: true,
      responsavel_voxx: lead.responsavel_voxx,
      responsavel_nome: lead.responsavel_nome,
    }));
}

// ─── STATUS VISUAL ───────────────────────────────────────────────────────────

export function getStatusVisualLead(lead) {
  if (!lead.ultima_interacao) return { color: 'bg-red-500', label: 'Sem contato', badgeClass: 'bg-red-100 text-red-700' };
  const dias = differenceInDays(new Date(), parseISO(lead.ultima_interacao));
  if (dias <= 3) return { color: 'bg-emerald-500', label: 'Ativo', badgeClass: 'bg-emerald-100 text-emerald-700' };
  if (dias <= 7) return { color: 'bg-amber-400', label: 'Aguardando', badgeClass: 'bg-amber-100 text-amber-700' };
  return { color: 'bg-red-500', label: 'Parado', badgeClass: 'bg-red-100 text-red-700' };
}