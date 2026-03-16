import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Copy, Pencil, Check } from "lucide-react";
import { calcularIndicadorPrazo } from "@/components/planoacao/PrazoIndicador";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusDemandaLabel = {
  recebida: "Recebida", em_triagem: "Em triagem", programada: "Programada",
  em_execucao: "Em execução", aguardando_cliente: "Aguardando cliente",
  em_revisao: "Em revisão", concluida: "Concluída",
};

function SectionHeader({ label, title }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-800">{title}</p>
    </div>
  );
}

function MetricBox({ label, value, colorClass = "text-slate-800" }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100">
      <p className={`text-base font-bold ${colorClass}`}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

export default function ReportModal({ cliente, report, dataReport, demandas, plano, planoItens, meta, radar, google, otimizacoes = [], user, onClose, onSave }) {
  const [destaque, setDestaque] = useState(report?.destaque_positivo || "");
  const [atencao, setAtencao] = useState(report?.ponto_atencao || "");
  const [proxPassos, setProxPassos] = useState(report?.proximos_passos || "");
  const [editando, setEditando] = useState(false);

  const dataFmt = dataReport ? format(parseISO(dataReport), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "—";
  const dataGeracao = format(new Date(), "dd/MM/yyyy 'às' HH:mm");

  // ── Dados derivados ──
  const demandasCliente = demandas.filter((d) => d.cliente_id === cliente.id);
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();
  const demandasConcluidas = demandasCliente.filter((d) => {
    if (d.status !== "concluida") return false;
    const dt = new Date(d.updated_date);
    return dt.getMonth() === mesAtual && dt.getFullYear() === anoAtual;
  });
  const demandasAguardando = demandasCliente.filter((d) => d.status === "aguardando_cliente");
  const demandasEmAndamento = demandasCliente.filter((d) => d.status !== "concluida");
  // mantido para compatibilidade com textos automáticos
  const demandasExecucao = demandasCliente.filter((d) => d.status === "em_execucao");

  // Otimizações do mês atual
  const otimizacoesMes = otimizacoes.filter((o) => {
    if (!o.data_acao) return false;
    const dt = new Date(o.data_acao);
    return dt.getMonth() === mesAtual && dt.getFullYear() === anoAtual;
  });

  const itensPlano = plano ? planoItens.filter((i) => i.plano_id === plano.id) : [];
  const itensAndamento = itensPlano.filter((i) => i.status_acao === "Em andamento");
  const itensConcluidos = itensPlano.filter((i) => i.status_acao === "Concluída");
  const itensNovos = itensPlano.filter((i) => i.status_acao === "Nova");
  const itensAtraso = itensPlano.filter((i) => calcularIndicadorPrazo(i.prazo, i.status_acao) === "atraso");
  const itensAVencer = itensPlano.filter((i) => calcularIndicadorPrazo(i.prazo, i.status_acao) === "a_vencer");

  // ── Textos automáticos ──
  const destaqueAuto = (() => {
    if (meta?.classificacao === "ELITE") return `Meta Ads com performance ELITE — campanhas entregando acima da meta com excelente custo por lead.`;
    if (meta?.classificacao === "SAUDÁVEL") return `Meta Ads com performance saudável — campanhas estáveis e dentro dos objetivos.`;
    if (itensConcluidos.length > 0) return `${itensConcluidos.length} ação(ões) do plano de ação concluída(s) — evoluindo no planejamento estratégico.`;
    if (demandasConcluidas.length > 0) return `${demandasConcluidas.length} demanda(s) concluída(s) — entregas realizadas conforme planejado.`;
    if (google?.health_status === "Saudável") return `Google Ads com status saudável — conversões estáveis e custo por conversão controlado.`;
    return "Campanhas e operação em acompanhamento contínuo com foco em evolução dos resultados.";
  })();

  const atencaoAuto = (() => {
    if (meta?.classificacao === "CRÍTICO") return `Meta Ads com classificação CRÍTICA — análise aprofundada em andamento e ações corretivas sendo aplicadas.`;
    if (meta?.classificacao === "ALERTA") return `Meta Ads em estado de ALERTA — monitoramento intensificado com ajustes em execução.`;
    if (itensAtraso.length > 0) return `${itensAtraso.length} ação(ões) do plano com prazo em atraso — acompanhamento prioritário.`;
    if (google?.health_status === "Urgente" || google?.health_status === "Crítico") return `Google Ads com status ${google.health_status} — ações corretivas sendo implementadas.`;
    if (demandasAguardando.length > 0) return `${demandasAguardando.length} demanda(s) aguardando retorno do cliente para prosseguimento.`;
    return "Nenhum ponto crítico identificado. Monitoramento ativo e operação estável.";
  })();

  const proxPassosAuto = [
    demandasExecucao.length > 0 ? `Seguir com a execução das ${demandasExecucao.length} demanda(s) em andamento.` : null,
    itensAndamento.length > 0 ? `Acompanhar as ${itensAndamento.length} ação(ões) em andamento no plano de ação.` : null,
    itensAVencer.length > 0 ? `Priorizar as ${itensAVencer.length} ação(ões) com prazo a vencer em breve.` : null,
    "Otimização contínua das campanhas com foco em evolução de conversões.",
    "Execução das ações previstas no planejamento estratégico.",
  ].filter(Boolean).join("\n");

  // ── Resumo Executivo Dinâmico ──
  const resumoExecutivo = (() => {
    const p1 = `Hoje seguimos com o acompanhamento ativo das campanhas e execução das demandas previstas para a unidade.`;

    const p2 = demandasConcluidas.length > 0
      ? `Foram concluídas ${demandasConcluidas.length} entrega(s) importante(s) no período, fortalecendo a execução das estratégias planejadas.`
      : itensAndamento.length > 0
      ? `O plano de ação segue em execução com ${itensAndamento.length} ação(ões) em andamento, mantendo o ritmo das entregas estratégicas.`
      : null;

    const p3 = (() => {
      if (meta?.classificacao === "CRÍTICO") return `O principal ponto de atenção está nas campanhas Meta Ads, classificadas como CRÍTICO — análise aprofundada e ações corretivas já em aplicação.`;
      if (meta?.classificacao === "ALERTA") return `As campanhas Meta Ads estão em estado de ALERTA — monitoramento intensificado com ajustes sendo realizados.`;
      if (itensAtraso.length > 0) return `Há ${itensAtraso.length} ação(ões) do plano com prazo em atraso que demandam acompanhamento prioritário.`;
      if (google?.health_status === "Urgente" || google?.health_status === "Crítico") return `As campanhas Google Ads apresentam status ${google.health_status} — intervenções estão em andamento.`;
      if (demandasAguardando.length > 0) return `Aguardamos retorno do cliente para ${demandasAguardando.length} demanda(s) em aberto, essenciais para o avanço das entregas.`;
      return null;
    })();

    const p4 = otimizacoesMes.length > 0
      ? `No período foram realizadas ${otimizacoesMes.length} otimização(ões) nas campanhas, com foco em melhorar a eficiência das conversões e reduzir custos.`
      : `Seguimos com otimizações estruturais nas campanhas e ajustes na captação para melhorar a eficiência das conversões.`;

    return [p1, p2, p3, p4].filter(Boolean).join(" ");
  })();

  // ── Ações Voxx Dinâmico ──
  const acoesVoxxTexto = (() => {
    const partes = [];
    if (otimizacoesMes.length > 0) partes.push(`realizou ${otimizacoesMes.length} otimização(ões) nas campanhas Meta Ads`);
    if (demandasConcluidas.length > 0) partes.push(`concluiu ${demandasConcluidas.length} demanda(s) operacional(is)`);
    if (demandasExecucao.length > 0) partes.push(`manteve ${demandasExecucao.length} entrega(s) em execução`);
    if (partes.length === 0) return `Hoje a equipe Voxx realizou o monitoramento das campanhas, análise de desempenho e acompanhamento das demandas operacionais, aplicando ajustes e otimizações conforme necessário.`;
    return `Hoje a equipe Voxx ${partes.join(", ")}, garantindo o acompanhamento contínuo de resultados e o avanço das estratégias planejadas para a unidade.`;
  })();

  const destaqueTexto = destaque || destaqueAuto;
  const atencaoTexto = atencao || atencaoAuto;
  const proxPassosTexto = proxPassos || proxPassosAuto;

  // ── Salvar ──
  const handleSave = () => {
    onSave({ destaque_positivo: destaqueTexto, ponto_atencao: atencaoTexto, proximos_passos: proxPassosTexto });
    setEditando(false);
    toast.success("Report salvo!");
  };

  // ── Copiar Resumo WhatsApp ──
  const handleCopiarResumo = () => {
    const linhas = [
      `📄 *Resumo Diário Voxx — ${cliente.nome}*`,
      `📅 Data: ${dataFmt}`,
      ``,
      `📌 *Destaque do dia:*`,
      destaqueTexto,
      ``,
      `⚠️ *Ponto de atenção:*`,
      atencaoTexto,
      ``,
      `📊 *Meta Ads*`,
      meta
        ? [
            `• Investimento: R$ ${(meta.amount_spent || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            `• Leads/Conversas: ${meta.new_messaging_connections || meta.messaging_conversations || 0}`,
            `• CPL: R$ ${(meta.cost_per_messaging || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            `• Status: ${meta.classificacao || "—"}`,
            meta.main_issue ? `• Alerta: ${meta.main_issue}` : null,
          ].filter(Boolean).join("\n")
        : "Dados não disponíveis.",
      ``,
      `🔎 *Google Ads*`,
      google
        ? [
            `• Investimento: R$ ${(google.cost || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            `• Conversões: ${google.conversions || 0}`,
            `• Custo/Conversão: R$ ${(google.cost_per_conversion || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            google.health_status ? `• Status: ${google.health_status}` : null,
          ].filter(Boolean).join("\n")
        : "Dados não disponíveis.",
      ``,
      `🧩 *Demandas*`,
      `• Em andamento: ${demandasExecucao.length}`,
      `• Concluídas: ${demandasConcluidas.length}`,
      `• Aguardando retorno: ${demandasAguardando.length}`,
      demandasConcluidas.length > 0
        ? `\n📦 *Principais entregas realizadas:*\n` + demandasConcluidas.slice(0, 3).map(d => `• ${d.titulo}`).join("\n")
        : null,
      ``,
      plano
        ? [
            `📋 *Plano de Ação*`,
            `• Total de ações: ${itensPlano.length}`,
            `• Em andamento: ${itensAndamento.length}`,
            `• Concluídas: ${itensConcluidos.length}`,
            itensAtraso.length > 0 ? `• Em atraso: ${itensAtraso.length}` : null,
            itensAVencer.length > 0 ? `• A vencer: ${itensAVencer.length}` : null,
            ``,
          ].filter(Boolean).join("\n")
        : null,
      `🔧 *Ações realizadas pela Voxx hoje:*`,
      `Monitoramento das campanhas, análise de desempenho e acompanhamento das demandas operacionais. Ajustes e otimizações aplicados conforme necessário.`,
      ``,
      `➡️ *Próximos passos:*`,
      proxPassosTexto,
      ``,
      `_Gerado em ${dataGeracao} · Portal Voxx_`,
    ].filter((l) => l !== null).join("\n");

    navigator.clipboard.writeText(linhas);
    toast.success("Resumo copiado para a área de transferência!");
  };

  // ── Gerar PDF ──
  const handleGerarPDF = () => {
    const metaClassBadge = (cls) => {
      if (!cls) return "badge-slate";
      if (cls === "ELITE" || cls === "SAUDÁVEL") return "badge-green";
      if (cls === "CRÍTICO" || cls === "ALERTA") return "badge-red";
      return "badge-yellow";
    };
    const googleStatusBadge = (s) => {
      if (!s) return "badge-slate";
      if (s === "Saudável") return "badge-green";
      if (s === "Crítico" || s === "Urgente") return "badge-red";
      return "badge-yellow";
    };

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Report Diário — ${cliente.nome}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #1e293b; font-size: 13px; line-height: 1.65; }
  .page { max-width: 760px; margin: 0 auto; }

  /* ── CAPA ── */
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%); color: #fff; padding: 40px 44px 36px; }
  .brand { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.5; margin-bottom: 12px; }
  .doc-title { font-size: 30px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.1; }
  .doc-subtitle { font-size: 13px; opacity: 0.65; margin-top: 6px; }
  .doc-meta { margin-top: 22px; display: grid; grid-template-columns: repeat(3, auto); gap: 0 32px; }
  .doc-meta-item { }
  .doc-meta-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.45; display: block; margin-bottom: 2px; }
  .doc-meta-value { font-size: 13px; font-weight: 700; }

  /* ── SEÇÕES ── */
  .section { padding: 26px 44px; border-bottom: 1px solid #f1f5f9; page-break-inside: avoid; }
  .section:last-child { border-bottom: none; }
  .bloco-label { font-size: 9px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px; }
  .bloco-title { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 14px; }

  /* ── TEXTO ── */
  .texto { font-size: 13px; color: #475569; line-height: 1.75; margin-bottom: 14px; }

  /* ── BOXES DE DESTAQUE ── */
  .box-destaque { border-left: 3px solid #22c55e; background: #f0fdf4; padding: 11px 16px; border-radius: 0 8px 8px 0; margin-bottom: 10px; }
  .box-destaque .box-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #16a34a; margin-bottom: 4px; }
  .box-destaque .box-text { font-size: 13px; color: #166534; line-height: 1.6; }
  .box-atencao { border-left: 3px solid #f59e0b; background: #fffbeb; padding: 11px 16px; border-radius: 0 8px 8px 0; margin-bottom: 10px; }
  .box-atencao .box-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #b45309; margin-bottom: 4px; }
  .box-atencao .box-text { font-size: 13px; color: #92400e; line-height: 1.6; }

  /* ── METRICS ── */
  .metrics-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
  .metrics-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
  .metric-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
  .metric-value { font-size: 20px; font-weight: 800; color: #1e293b; line-height: 1; }
  .metric-label { font-size: 10px; color: #64748b; margin-top: 3px; }
  .metric-card.green .metric-value { color: #16a34a; }
  .metric-card.amber .metric-value { color: #d97706; }
  .metric-card.red .metric-value { color: #dc2626; }
  .metric-card.blue .metric-value { color: #2563eb; }
  .metric-card.violet .metric-value { color: #7c3aed; }

  /* ── BADGES ── */
  .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-yellow { background: #fef3c7; color: #92400e; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-blue { background: #dbeafe; color: #1d4ed8; }
  .badge-slate { background: #f1f5f9; color: #475569; }

  /* ── LISTAS ── */
  .item-list { list-style: none; margin-top: 10px; }
  .item-list li { padding: 7px 0; border-bottom: 1px solid #f8fafc; font-size: 12px; color: #334155; display: flex; align-items: flex-start; gap: 8px; }
  .item-list li:last-child { border-bottom: none; }
  .item-list li::before { content: "•"; color: #7c3aed; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
  .item-list li .badge { margin-left: 6px; }

  /* ── AÇÕES VOXX ── */
  .acoes-voxx-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; }
  .acoes-voxx-box p { font-size: 13px; color: #475569; line-height: 1.75; }

  /* ── PRÓXIMOS PASSOS ── */
  .steps-list p { font-size: 13px; color: #475569; margin-bottom: 7px; padding-left: 18px; position: relative; line-height: 1.6; }
  .steps-list p::before { content: "→"; position: absolute; left: 0; color: #7c3aed; font-weight: 700; }

  /* ── RODAPÉ ── */
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 44px; display: flex; justify-content: space-between; align-items: center; }
  .footer-brand { font-size: 11px; font-weight: 700; color: #64748b; }
  .footer-date { font-size: 10px; color: #94a3b8; }

  @media print {
    .page { max-width: 100%; }
    .section { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page">

<!-- ══ CABEÇALHO ══ -->
<div class="header">
  <div class="brand">Portal Voxx · Relatório Executivo</div>
  <div class="doc-title">Resumo Diário Voxx</div>
  <div class="doc-subtitle">Visão geral das ações e resultados do dia</div>
  <div class="doc-meta">
    <div class="doc-meta-item"><span class="doc-meta-label">Cliente</span><span class="doc-meta-value">${cliente.nome}</span></div>
    <div class="doc-meta-item"><span class="doc-meta-label">Data do report</span><span class="doc-meta-value">${dataFmt}</span></div>
    <div class="doc-meta-item"><span class="doc-meta-label">Gerado em</span><span class="doc-meta-value">${dataGeracao}</span></div>
  </div>
</div>

<!-- ══ BLOCO 1 — RESUMO EXECUTIVO ══ -->
<div class="section">
  <div class="bloco-label">Bloco 1</div>
  <div class="bloco-title">Resumo Executivo</div>
  <p class="texto">
    Hoje seguimos com o acompanhamento ativo das campanhas e das ações operacionais da conta.
    Monitoramos o desempenho das campanhas, o andamento das demandas e a evolução das ações estratégicas definidas para o cliente.
    <br/><br/>
    Nosso foco permanece em manter estabilidade nas campanhas, otimizar resultados e avançar nas entregas planejadas.
  </p>
  <div class="box-destaque">
    <div class="box-label">✅ Destaque positivo do dia</div>
    <div class="box-text">${destaqueTexto}</div>
  </div>
  <div class="box-atencao">
    <div class="box-label">⚠️ Ponto de atenção</div>
    <div class="box-text">${atencaoTexto}</div>
  </div>
</div>

<!-- ══ BLOCO 2 — META ADS ══ -->
<div class="section">
  <div class="bloco-label">Bloco 2</div>
  <div class="bloco-title">Meta Ads — Visão Geral</div>
  ${meta ? `
  <p class="texto">As campanhas no Meta Ads seguem em monitoramento constante com ajustes contínuos para melhoria de performance e estabilidade dos resultados.</p>
  <div class="metrics-3">
    <div class="metric-card"><div class="metric-value">R$ ${(meta.amount_spent || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</div><div class="metric-label">Investimento</div></div>
    <div class="metric-card green"><div class="metric-value">${meta.new_messaging_connections || meta.messaging_conversations || 0}</div><div class="metric-label">Leads / Conversas</div></div>
    <div class="metric-card"><div class="metric-value">R$ ${(meta.cost_per_messaging || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div><div class="metric-label">Custo por lead (CPL)</div></div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
    <span style="font-size:11px;color:#64748b;">Status geral:</span>
    <span class="badge ${metaClassBadge(meta.classificacao)}">${meta.classificacao || "—"}</span>
    ${meta.nota_gpt ? `<span style="font-size:11px;color:#64748b;">· Nota GPT: <strong>${meta.nota_gpt}</strong>/100</span>` : ""}
  </div>
  ${meta.main_issue ? `<p style="font-size:12px;color:#64748b;margin-top:4px;">⚡ Principal alerta: ${meta.main_issue}</p>` : ""}
  ${meta.frequency ? `<p style="font-size:12px;color:#64748b;margin-top:4px;">Frequência: ${meta.frequency.toFixed(1)}x</p>` : ""}
  ` : `<p class="texto" style="color:#94a3b8;font-style:italic;">Dados de Meta Ads não vinculados a este cliente no momento.</p>`}
</div>

<!-- ══ BLOCO 2b — META ADS ONTEM ══ -->
${radar ? `
<div class="section">
  <div class="bloco-label">Bloco 2 · Ontem</div>
  <div class="bloco-title">Meta Ads — Ontem</div>
  <div class="metrics-3">
    <div class="metric-card green"><div class="metric-value">${radar.leads_ontem ?? "—"}</div><div class="metric-label">Leads ontem</div></div>
    <div class="metric-card"><div class="metric-value">${radar.amount_spent_ontem != null ? `R$ ${(radar.amount_spent_ontem).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</div><div class="metric-label">Inv. diário</div></div>
    <div class="metric-card"><div class="metric-value">${radar.cpl_ontem != null ? `R$ ${(radar.cpl_ontem).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</div><div class="metric-label">CPL atual</div></div>
  </div>
  <div class="metrics-3">
    <div class="metric-card ${radar.variacao_cpl != null && radar.variacao_cpl > 10 ? "red" : radar.variacao_cpl != null && radar.variacao_cpl < -5 ? "green" : "amber"}">
      <div class="metric-value">${radar.variacao_cpl != null ? `${radar.variacao_cpl > 0 ? "+" : ""}${radar.variacao_cpl.toFixed(1)}%` : "—"}</div>
      <div class="metric-label">Var. CPL</div>
    </div>
    <div class="metric-card ${radar.variacao_ctr != null && radar.variacao_ctr >= 0 ? "green" : "red"}">
      <div class="metric-value">${radar.variacao_ctr != null ? `${radar.variacao_ctr > 0 ? "+" : ""}${radar.variacao_ctr.toFixed(1)}%` : "—"}</div>
      <div class="metric-label">Var. CTR</div>
    </div>
    <div class="metric-card ${radar.frequencia_7d != null && radar.frequencia_7d > 3 ? "red" : ""}">
      <div class="metric-value">${radar.frequencia_7d != null ? `${radar.frequencia_7d.toFixed(2)}x` : "—"}</div>
      <div class="metric-label">Freq. (7d)</div>
    </div>
  </div>
</div>
` : ""}

<!-- ══ BLOCO 3 — GOOGLE ADS ══ -->
<div class="section">
  <div class="bloco-label">Bloco 3</div>
  <div class="bloco-title">Google Ads — Visão Geral</div>
  ${google ? `
  <p class="texto">As campanhas no Google Ads seguem em acompanhamento diário com foco em eficiência de conversão e estabilidade dos custos.</p>
  <div class="metrics-3">
    <div class="metric-card"><div class="metric-value">R$ ${(google.cost || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</div><div class="metric-label">Investimento</div></div>
    <div class="metric-card green"><div class="metric-value">${google.conversions || 0}</div><div class="metric-label">Conversões</div></div>
    <div class="metric-card"><div class="metric-value">R$ ${(google.cost_per_conversion || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div><div class="metric-label">Custo por conversão</div></div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
    ${google.health_status ? `<span style="font-size:11px;color:#64748b;">Status:</span><span class="badge ${googleStatusBadge(google.health_status)}">${google.health_status}</span>` : ""}
    ${google.optimization_score ? `<span style="font-size:11px;color:#64748b;">· Optimization Score: <strong>${google.optimization_score}%</strong></span>` : ""}
  </div>
  ${google.clicks ? `<p style="font-size:12px;color:#64748b;margin-top:4px;">Cliques: ${google.clicks} · CPC médio: R$ ${(google.avg_cpc || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>` : ""}
  ` : `<p class="texto" style="color:#94a3b8;font-style:italic;">Dados de Google Ads não vinculados a este cliente no momento.</p>`}
</div>

<!-- ══ BLOCO 4 — DEMANDAS OPERACIONAIS ══ -->
<div class="section">
  <div class="bloco-label">Bloco 4</div>
  <div class="bloco-title">Demandas Operacionais</div>
  <p class="texto">Seguimos com as demandas operacionais em andamento conforme o planejamento. Abaixo o status atual das solicitações.</p>
  <div class="metrics-3" style="grid-template-columns:repeat(2,1fr);">
    <div class="metric-card blue"><div class="metric-value">${demandasEmAndamento.length}</div><div class="metric-label">Em andamento</div></div>
    <div class="metric-card green"><div class="metric-value">${demandasConcluidas.length}</div><div class="metric-label">Concluídas</div></div>
  </div>
  ${demandasConcluidas.length > 0 ? `
  <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#16a34a;margin-bottom:6px;">Principais entregas realizadas</p>
  <ul class="item-list">
    ${demandasConcluidas.map(d => `<li>${d.titulo}<span class="badge badge-green">Concluída</span></li>`).join("")}
  </ul>` : ""}
  ${demandasEmAndamento.length > 0 ? `
  <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#2563eb;margin-top:14px;margin-bottom:6px;">Demandas em andamento</p>
  <ul class="item-list">
    ${demandasEmAndamento.map(d => `<li>${d.titulo}<span class="badge badge-blue">${statusDemandaLabel[d.status] || d.status}</span></li>`).join("")}
  </ul>` : ""}
</div>

${otimizacoesMes.length > 0 ? `
<!-- ══ BLOCO 4b — HISTÓRICO DE OTIMIZAÇÕES ══ -->
<div class="section">
  <div class="bloco-label">Bloco 4b</div>
  <div class="bloco-title">Histórico de Otimizações — Meta Ads</div>
  <p class="texto">Otimizações realizadas no mês atual nas campanhas Meta Ads.</p>
  <ul class="item-list">
    ${otimizacoesMes.map(o => `
    <li style="flex-direction:column;align-items:flex-start;gap:4px;">
      <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
        <strong>${o.resumo_acao || o.objetivo || "Otimização"}</strong>
        <span style="font-size:10px;color:#94a3b8;">${o.data_acao ? o.data_acao.split("T")[0].split("-").reverse().join("/") : "—"}</span>
      </div>
      ${o.problema ? `<span style="font-size:11px;color:#64748b;"><strong>Problema:</strong> ${o.problema}</span>` : ""}
      ${o.acoes_implementadas ? `<span style="font-size:11px;color:#64748b;"><strong>Ações:</strong> ${o.acoes_implementadas}</span>` : ""}
    </li>`).join("")}
  </ul>
</div>
` : ""}

<!-- ══ BLOCO 5 — PLANO DE AÇÃO ══ -->
${plano ? `
<div class="section">
  <div class="bloco-label">Bloco 5</div>
  <div class="bloco-title">Plano de Ação — Acompanhamento</div>
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:${plano.objetivo_geral ? "6px" : "14px"};">
    <span style="font-size:14px;font-weight:700;color:#4c1d95;">${plano.titulo_plano}</span>
    <span class="badge badge-yellow">${plano.status_plano}</span>
  </div>
  ${plano.objetivo_geral ? `<p class="texto" style="margin-bottom:14px;">${plano.objetivo_geral}</p>` : ""}
  <div class="metrics-4">
    <div class="metric-card"><div class="metric-value">${itensPlano.length}</div><div class="metric-label">Total</div></div>
    <div class="metric-card blue"><div class="metric-value">${itensAndamento.length}</div><div class="metric-label">Em andamento</div></div>
    <div class="metric-card green"><div class="metric-value">${itensConcluidos.length}</div><div class="metric-label">Concluídas</div></div>
    <div class="metric-card ${itensAtraso.length > 0 ? "red" : ""}"><div class="metric-value">${itensAtraso.length}</div><div class="metric-label">Em atraso</div></div>
  </div>
  ${itensAVencer.length > 0 ? `<p style="font-size:12px;color:#d97706;margin-bottom:10px;">🕐 ${itensAVencer.length} ação(ões) com prazo a vencer em breve</p>` : ""}
  ${itensPlano.length > 0 ? `
  <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:11px;">
    <thead>
      <tr style="background:#ede9fe;color:#5b21b6;">
        <th style="padding:7px 10px;text-align:left;font-weight:700;letter-spacing:0.5px;">Ação</th>
        <th style="padding:7px 10px;text-align:left;font-weight:700;letter-spacing:0.5px;">Responsável</th>
        <th style="padding:7px 10px;text-align:left;font-weight:700;letter-spacing:0.5px;">Prazo</th>
        <th style="padding:7px 10px;text-align:left;font-weight:700;letter-spacing:0.5px;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${itensPlano.map((item, idx) => {
        const ind = calcularIndicadorPrazo(item.prazo, item.status_acao);
        const prazoStyle = ind === "atraso" ? "color:#dc2626;font-weight:700;" : ind === "a_vencer" ? "color:#d97706;" : "color:#64748b;";
        const statusBg = item.status_acao === "Concluída" ? "background:#dcfce7;color:#166534;" : item.status_acao === "Em andamento" ? "background:#dbeafe;color:#1d4ed8;" : "background:#f1f5f9;color:#475569;";
        const prazoFmt = item.prazo ? item.prazo.split("T")[0].split("-").reverse().join("/") : "—";
        return `<tr style="background:${idx % 2 === 0 ? "#fff" : "#f5f3ff"};">
          <td style="padding:7px 10px;color:#334155;border-bottom:1px solid #f1f5f9;">${item.acao_proposta}</td>
          <td style="padding:7px 10px;color:#64748b;border-bottom:1px solid #f1f5f9;">${item.responsavel || "—"}</td>
          <td style="padding:7px 10px;${prazoStyle}border-bottom:1px solid #f1f5f9;">${prazoFmt}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;"><span style="padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;${statusBg}">${item.status_acao || "—"}</span></td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>` : ""}
</div>
` : ""}

<!-- ══ BLOCO 6 — AÇÕES DA VOXX ══ -->
<div class="section">
  <div class="bloco-label">Bloco 6</div>
  <div class="bloco-title">Ações Realizadas pela Voxx</div>
  <div class="acoes-voxx-box">
    <p>
      Hoje a equipe Voxx realizou o monitoramento das campanhas, análise de desempenho e acompanhamento das demandas operacionais, aplicando ajustes e otimizações sempre que necessário para manter a evolução dos resultados.
    </p>
    <p style="margin-top:10px;">
      Nossa rotina inclui verificação diária das principais métricas, identificação de oportunidades de melhoria, atualização das demandas em andamento e alinhamento constante com o planejamento estratégico da conta.
    </p>
  </div>
</div>

<!-- ══ BLOCO 7 — PRÓXIMOS PASSOS ══ -->
<div class="section">
  <div class="bloco-label">Bloco 7</div>
  <div class="bloco-title">Próximos Passos</div>
  <p class="texto">Seguimos com foco em evolução contínua das campanhas e execução das demandas planejadas.</p>
  <div class="steps-list">
    ${proxPassosTexto.split("\n").map(s => s.trim()).filter(Boolean).map(s => `<p>${s}</p>`).join("")}
  </div>
</div>

<!-- ══ RODAPÉ ══ -->
<div class="footer">
  <span class="footer-brand">Portal Voxx · Relatório gerado automaticamente</span>
  <span class="footer-date">${dataGeracao}</span>
</div>

</div>
</body>
</html>`;

    const janela = window.open("", "_blank");
    janela.document.write(html);
    janela.document.close();
    janela.print();
  };

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
            <span className="font-bold text-slate-900">📄 Report — {cliente.nome}</span>
            <span className="text-sm font-normal text-slate-500">{dataFmt}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pb-2">

          {/* ── BLOCO 1: RESUMO EXECUTIVO ── */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <SectionHeader label="Bloco 1" title="Resumo Executivo" />
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Hoje seguimos com o acompanhamento ativo das campanhas e das ações operacionais. Foco em estabilidade, otimização e execução das entregas planejadas.
            </p>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-green-700 font-semibold">✅ Destaque positivo do dia</Label>
                {editando ? (
                  <Textarea value={destaque} onChange={(e) => setDestaque(e.target.value)} placeholder={destaqueAuto} className="mt-1 text-sm min-h-[56px]" />
                ) : (
                  <p className="text-sm text-green-800 mt-1 bg-green-50 border border-green-100 rounded-lg px-3 py-2 leading-relaxed">{destaqueTexto}</p>
                )}
              </div>
              <div>
                <Label className="text-xs text-amber-700 font-semibold">⚠️ Ponto de atenção</Label>
                {editando ? (
                  <Textarea value={atencao} onChange={(e) => setAtencao(e.target.value)} placeholder={atencaoAuto} className="mt-1 text-sm min-h-[56px]" />
                ) : (
                  <p className="text-sm text-amber-800 mt-1 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">{atencaoTexto}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── BLOCO 2: META ADS ── */}
          {meta ? (
            <div className="rounded-xl border border-slate-100 p-4">
              <SectionHeader label="Bloco 2" title="Meta Ads — Visão Geral" />
              <div className="grid grid-cols-3 gap-2 mb-3">
                <MetricBox label="Investimento" value={`R$ ${(meta.amount_spent || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} />
                <MetricBox label="Leads/Conversas" value={meta.new_messaging_connections || meta.messaging_conversations || 0} colorClass="text-green-700" />
                <MetricBox label="CPL" value={`R$ ${(meta.cost_per_messaging || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                <span>Status:</span>
                <Badge className={cn("text-xs", meta.classificacao === "ELITE" || meta.classificacao === "SAUDÁVEL" ? "bg-green-100 text-green-700" : meta.classificacao === "CRÍTICO" || meta.classificacao === "ALERTA" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700")}>{meta.classificacao || "—"}</Badge>
                {meta.nota_gpt && <span>· Nota: <strong>{meta.nota_gpt}</strong>/100</span>}
                {meta.main_issue && <span className="text-slate-400">· {meta.main_issue}</span>}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
              <SectionHeader label="Bloco 2" title="Meta Ads — Visão Geral" />
              Dados de Meta Ads não vinculados a este cliente.
            </div>
          )}

          {/* ── BLOCO 2b: META ADS — ONTEM ── */}
          {radar && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">
              <SectionHeader label="Bloco 2 · Ontem" title="Meta Ads — Ontem" />
              <div className="grid grid-cols-3 gap-2 mb-2">
                <MetricBox label="Leads ontem" value={radar.leads_ontem ?? "—"} colorClass="text-green-700" />
                <MetricBox label="Inv. diário" value={radar.amount_spent_ontem != null ? `R$ ${(radar.amount_spent_ontem).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"} />
                <MetricBox label="CPL atual" value={radar.cpl_ontem != null ? `R$ ${(radar.cpl_ontem).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MetricBox
                  label="Var. CPL"
                  value={radar.variacao_cpl != null ? `${radar.variacao_cpl > 0 ? "+" : ""}${radar.variacao_cpl.toFixed(1)}%` : "—"}
                  colorClass={radar.variacao_cpl == null ? "text-slate-700" : radar.variacao_cpl > 10 ? "text-red-600" : radar.variacao_cpl < -5 ? "text-green-700" : "text-amber-600"}
                />
                <MetricBox
                  label="Var. CTR"
                  value={radar.variacao_ctr != null ? `${radar.variacao_ctr > 0 ? "+" : ""}${radar.variacao_ctr.toFixed(1)}%` : "—"}
                  colorClass={radar.variacao_ctr == null ? "text-slate-700" : radar.variacao_ctr >= 0 ? "text-green-700" : "text-red-600"}
                />
                <MetricBox label="Freq. (7d)" value={radar.frequencia_7d != null ? `${radar.frequencia_7d.toFixed(2)}x` : "—"} colorClass={radar.frequencia_7d != null && radar.frequencia_7d > 3 ? "text-red-600" : "text-slate-700"} />
              </div>
            </div>
          )}

          {/* ── BLOCO 3: GOOGLE ADS ── */}
          {google ? (
            <div className="rounded-xl border border-slate-100 p-4">
              <SectionHeader label="Bloco 3" title="Google Ads — Visão Geral" />
              <div className="grid grid-cols-3 gap-2 mb-3">
                <MetricBox label="Investimento" value={`R$ ${(google.cost || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} />
                <MetricBox label="Conversões" value={google.conversions || 0} colorClass="text-green-700" />
                <MetricBox label="Custo/Conv." value={`R$ ${(google.cost_per_conversion || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                {google.health_status && (
                  <>
                    <span>Status:</span>
                    <Badge className={cn("text-xs", google.health_status === "Saudável" ? "bg-green-100 text-green-700" : google.health_status === "Crítico" || google.health_status === "Urgente" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700")}>{google.health_status}</Badge>
                  </>
                )}
                {google.optimization_score > 0 && <span>· Score: <strong>{google.optimization_score}%</strong></span>}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
              <SectionHeader label="Bloco 3" title="Google Ads — Visão Geral" />
              Dados de Google Ads não vinculados a este cliente.
            </div>
          )}

          {/* ── BLOCO 4: DEMANDAS ── */}
          <div className="rounded-xl border border-slate-100 p-4">
            <SectionHeader label="Bloco 4" title="Demandas Operacionais" />
            <div className="grid grid-cols-2 gap-2 mb-3">
              <MetricBox label="Em andamento" value={demandasEmAndamento.length} colorClass="text-blue-700" />
              <MetricBox label="Concluídas" value={demandasConcluidas.length} colorClass="text-green-700" />
            </div>
            {demandasConcluidas.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-green-600 mb-1">Entregas realizadas</p>
                {demandasConcluidas.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-xs text-slate-600 py-1 border-t border-slate-50">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    {d.titulo}
                  </div>
                ))}
              </div>
            )}
            {demandasEmAndamento.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">Demandas em andamento</p>
                {demandasEmAndamento.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-xs text-slate-600 py-1 border-t border-slate-50">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <span className="flex-1">{d.titulo}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">{statusDemandaLabel[d.status] || d.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── BLOCO 4b: HISTÓRICO DE OTIMIZAÇÕES ── */}
          {otimizacoesMes.length > 0 && (
            <div className="rounded-xl border border-orange-100 bg-orange-50/30 p-4">
              <SectionHeader label="Bloco 4b" title="Histórico de Otimizações — Meta Ads" />
              <p className="text-xs text-slate-500 mb-3">Otimizações realizadas no mês atual nas campanhas Meta Ads.</p>
              <div className="space-y-2">
                {otimizacoesMes.map((o) => (
                  <div key={o.id} className="border border-orange-100 bg-white rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-700">{o.resumo_acao || o.objetivo}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{o.data_acao ? format(parseISO(o.data_acao), "dd/MM", { locale: ptBR }) : "—"}</span>
                    </div>
                    {o.problema && <p className="text-[11px] text-slate-500"><span className="font-medium text-slate-600">Problema:</span> {o.problema}</p>}
                    {o.acoes_implementadas && <p className="text-[11px] text-slate-500 mt-0.5"><span className="font-medium text-slate-600">Ações:</span> {o.acoes_implementadas}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── BLOCO 5: PLANO DE AÇÃO ── */}
          {plano && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-4">
              <SectionHeader label="Bloco 5" title="Plano de Ação — Acompanhamento" />

              {/* Nome do plano e status */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-sm font-semibold text-violet-900">{plano.titulo_plano}</span>
                <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs">{plano.status_plano}</Badge>
              </div>
              {plano.objetivo_geral && (
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">{plano.objetivo_geral}</p>
              )}

              {/* KPIs resumidos */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <MetricBox label="Total" value={itensPlano.length} colorClass="text-slate-700" />
                <MetricBox label="Andamento" value={itensAndamento.length} colorClass="text-blue-700" />
                <MetricBox label="Concluídas" value={itensConcluidos.length} colorClass="text-green-700" />
                <MetricBox label="Atraso" value={itensAtraso.length} colorClass={itensAtraso.length > 0 ? "text-red-700" : "text-slate-700"} />
              </div>

              {itensAVencer.length > 0 && (
                <p className="text-xs text-amber-600 mb-2">🕐 {itensAVencer.length} ação(ões) com prazo a vencer em breve</p>
              )}

              {/* Tabela de ações */}
              {itensPlano.length > 0 && (
                <div className="border border-violet-100 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-0 bg-violet-100/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                    <span className="col-span-5">Ação</span>
                    <span className="col-span-3">Responsável</span>
                    <span className="col-span-2">Prazo</span>
                    <span className="col-span-2">Status</span>
                  </div>
                  {itensPlano.map((item, idx) => {
                    const indicador = calcularIndicadorPrazo(item.prazo, item.status_acao);
                    const statusColor = {
                      "Nova": "bg-slate-100 text-slate-600",
                      "Em andamento": "bg-blue-100 text-blue-700",
                      "Concluída": "bg-green-100 text-green-700",
                    }[item.status_acao] || "bg-slate-100 text-slate-600";
                    const prazoColor = indicador === "atraso" ? "text-red-600 font-semibold" : indicador === "a_vencer" ? "text-amber-600" : "text-slate-500";

                    return (
                      <div key={item.id} className={cn("grid grid-cols-12 gap-0 px-3 py-2 text-xs items-start", idx % 2 === 0 ? "bg-white" : "bg-violet-50/30")}>
                        <span className="col-span-5 text-slate-700 leading-snug pr-2">{item.acao_proposta}</span>
                        <span className="col-span-3 text-slate-500">{item.responsavel || "—"}</span>
                        <span className={cn("col-span-2", prazoColor)}>
                          {item.prazo ? format(parseISO(item.prazo), "dd/MM/yy") : "—"}
                        </span>
                        <span className="col-span-2">
                          <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium", statusColor)}>
                            {item.status_acao || "—"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── BLOCO 6: AÇÕES DA VOXX ── */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <SectionHeader label="Bloco 6" title="Ações Realizadas pela Voxx" />
            <p className="text-sm text-slate-600 leading-relaxed">
              Hoje a equipe Voxx realizou o monitoramento das campanhas, análise de desempenho e acompanhamento das demandas operacionais, aplicando ajustes e otimizações sempre que necessário para manter a evolução dos resultados.
            </p>
          </div>

          {/* ── BLOCO 7: PRÓXIMOS PASSOS ── */}
          <div className="rounded-xl border border-slate-100 p-4">
            <SectionHeader label="Bloco 7" title="Próximos Passos" />
            {editando ? (
              <Textarea value={proxPassos} onChange={(e) => setProxPassos(e.target.value)} placeholder={proxPassosAuto} className="text-sm min-h-[80px]" />
            ) : (
              <div className="space-y-1">
                {proxPassosTexto.split("\n").filter(Boolean).map((s, i) => (
                  <p key={i} className="text-sm text-slate-700 flex items-start gap-2">
                    <span className="text-violet-500 font-bold mt-0.5 shrink-0">→</span> {s}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* ── AÇÕES DO MODAL ── */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
            {editando ? (
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleSave}>
                <Check className="w-3.5 h-3.5 mr-1" /> Salvar
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> Editar destaques
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleCopiarResumo}>
              <Copy className="w-3.5 h-3.5 mr-1" /> Copiar Resumo
            </Button>
            <Button size="sm" className="bg-slate-800 hover:bg-slate-900" onClick={handleGerarPDF}>
              <FileText className="w-3.5 h-3.5 mr-1" /> Gerar PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}