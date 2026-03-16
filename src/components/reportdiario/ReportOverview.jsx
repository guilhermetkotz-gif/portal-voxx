import React, { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, FileText, AlertTriangle, CheckCircle2, Clock, TrendingUp,
  BarChart3, ClipboardList, Target, Activity, Zap, Users, DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";
import { calcularIndicadorPrazo } from "@/components/planoacao/PrazoIndicador";

// ── helpers ──
const fmtBrl = (v) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBrl0 = (v) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_LABELS = {
  recebida: "Recebida", em_triagem: "Em triagem", programada: "Programada",
  em_execucao: "Em execução", aguardando_cliente: "Aguardando cliente",
  em_revisao: "Em revisão", concluida: "Concluída",
};

function KPICard({ label, value, sub, colorClass = "text-slate-900", bgClass = "bg-white", icon }) {
  return (
    <div className={cn("rounded-xl border border-slate-100 p-4 flex flex-col gap-1", bgClass)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
        {icon && <span className="opacity-40">{icon}</span>}
      </div>
      <p className={cn("text-2xl font-900 font-bold leading-none mt-1", colorClass)}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ icon, title, count }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-lg">{icon}</span>
      <h2 className="text-base font-bold text-slate-800">{title}</h2>
      {count != null && (
        <span className="ml-auto text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5 font-medium">{count}</span>
      )}
    </div>
  );
}

function AlertRow({ level, text }) {
  const cfg = {
    error: { bg: "bg-red-50 border-red-200", icon: "🔴", text: "text-red-800" },
    warn: { bg: "bg-amber-50 border-amber-200", icon: "🟡", text: "text-amber-800" },
    ok: { bg: "bg-green-50 border-green-200", icon: "🟢", text: "text-green-800" },
  }[level] || { bg: "bg-slate-50 border-slate-200", icon: "⚪", text: "text-slate-700" };
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-xs", cfg.bg)}>
      <span>{cfg.icon}</span>
      <span className={cfg.text}>{text}</span>
    </div>
  );
}

export default function ReportOverview({
  cliente, report, dataReport, demandas, plano, planoItens,
  meta, radar, google, otimizacoes, user, onBack, onAbrirModal
}) {
  const handleGerarPDFOverview = () => {
    const fmtBrl = (v) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtN = (v) => (v || 0).toLocaleString("pt-BR");
    const dataFmt2 = dataReport
      ? format(parseISO(dataReport), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const dataGeracao = format(new Date(), "dd/MM/yyyy 'às' HH:mm");

    const mesAtualLocal = new Date().getMonth();
    const anoAtualLocal = new Date().getFullYear();

    const demandasCliente2 = demandas.filter((d) => d.cliente_id === cliente.id);
    const demandasConcluidas2 = demandasCliente2.filter((d) => d.status === "concluida");
    const demandasAndamento2 = demandasCliente2.filter((d) => ["em_execucao","programada","em_triagem","em_revisao"].includes(d.status));
    const demandasAguardando2 = demandasCliente2.filter((d) => d.status === "aguardando_cliente");

    const itensPlano2 = plano ? planoItens.filter((i) => i.plano_id === plano.id) : [];
    const itensConcluidos2 = itensPlano2.filter((i) => i.status_acao === "Concluída");
    const itensAndamento2 = itensPlano2.filter((i) => i.status_acao === "Em andamento");
    const itensAtraso2 = itensPlano2.filter((i) => calcularIndicadorPrazo(i.prazo, i.status_acao) === "atraso");
    const itensAVencer2 = itensPlano2.filter((i) => calcularIndicadorPrazo(i.prazo, i.status_acao) === "a_vencer");

    const otimizacoesMes2 = otimizacoes.filter((o) => {
      if (!o.data_acao) return false;
      const dt = new Date(o.data_acao);
      return dt.getMonth() === mesAtualLocal && dt.getFullYear() === anoAtualLocal;
    });

    const totalLeads2 = (meta?.new_messaging_connections || meta?.messaging_conversations || 0) + (google?.conversions || 0);
    const totalInvest2 = (meta?.amount_spent || 0) + (google?.cost || 0);
    const cplMedio2 = totalLeads2 > 0 ? totalInvest2 / totalLeads2 : 0;

    // Alertas
    const alertas2 = [];
    if (meta?.classificacao === "CRÍTICO") alertas2.push({ level: "error", text: "Meta Ads com classificação CRÍTICA — ação imediata necessária." });
    else if (meta?.classificacao === "ALERTA") alertas2.push({ level: "warn", text: "Meta Ads em estado de ALERTA — monitoramento intensificado." });
    else if (meta?.classificacao === "ELITE" || meta?.classificacao === "SAUDÁVEL") alertas2.push({ level: "ok", text: `Meta Ads com performance ${meta.classificacao} — campanhas dentro dos objetivos.` });
    if (google?.health_status === "Urgente" || google?.health_status === "Crítico") alertas2.push({ level: "error", text: `Google Ads com status ${google.health_status} — intervenção necessária.` });
    else if (google?.health_status === "Saudável") alertas2.push({ level: "ok", text: "Google Ads com status Saudável — performance estável." });
    if (meta?.frequency && meta.frequency > 3.5) alertas2.push({ level: "warn", text: `Frequência Meta Ads elevada (${meta.frequency.toFixed(1)}x) — risco de saturação.` });
    if (radar?.variacao_cpl != null && radar.variacao_cpl > 15) alertas2.push({ level: "warn", text: `CPL ontem ${radar.variacao_cpl.toFixed(1)}% acima da média dos últimos 7 dias.` });
    if (itensAtraso2.length > 0) alertas2.push({ level: "warn", text: `${itensAtraso2.length} ação(ões) do plano com prazo em atraso.` });
    if (demandasAguardando2.length > 0) alertas2.push({ level: "warn", text: `${demandasAguardando2.length} demanda(s) aguardando retorno do cliente.` });
    if (alertas2.length === 0) alertas2.push({ level: "ok", text: "Nenhum alerta crítico identificado. Operação e campanhas estáveis." });

    const alertaColor = (level) => level === "error" ? "#fee2e2" : level === "warn" ? "#fef3c7" : "#dcfce7";
    const alertaTextColor = (level) => level === "error" ? "#991b1b" : level === "warn" ? "#92400e" : "#166534";
    const alertaIcon = (level) => level === "error" ? "🔴" : level === "warn" ? "🟡" : "🟢";

    const metaBadgeColor = meta?.classificacao === "ELITE" || meta?.classificacao === "SAUDÁVEL" ? "#166534" : meta?.classificacao === "CRÍTICO" || meta?.classificacao === "ALERTA" ? "#991b1b" : "#92400e";
    const metaBadgeBg = meta?.classificacao === "ELITE" || meta?.classificacao === "SAUDÁVEL" ? "#dcfce7" : meta?.classificacao === "CRÍTICO" || meta?.classificacao === "ALERTA" ? "#fee2e2" : "#fef3c7";
    const googleBadgeColor = google?.health_status === "Saudável" ? "#166534" : (google?.health_status === "Crítico" || google?.health_status === "Urgente") ? "#991b1b" : "#92400e";
    const googleBadgeBg = google?.health_status === "Saudável" ? "#dcfce7" : (google?.health_status === "Crítico" || google?.health_status === "Urgente") ? "#fee2e2" : "#fef3c7";

    const statusDemandaLabel2 = { recebida: "Recebida", em_triagem: "Em triagem", programada: "Programada", em_execucao: "Em execução", aguardando_cliente: "Aguard. cliente", em_revisao: "Em revisão", concluida: "Concluída" };

    const kpiBox = (label, value, color = "#1e293b") => `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:18px;font-weight:900;color:${color};line-height:1;">${value}</div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;margin-top:4px;">${label}</div>
      </div>`;

    const sectionTitle = (icon, title) => `
      <div style="display:flex;align-items:center;gap:8px;margin:20px 0 10px;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">
        <span style="font-size:14px;">${icon}</span>
        <span style="font-size:12px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;">${title}</span>
      </div>`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Overview Completo Voxx — ${cliente.nome}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #1e293b; font-size: 11px; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 210mm; }
  .kpi-grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 10px; }
  .kpi-grid-5 { display: grid; grid-template-columns: repeat(5,1fr); gap: 8px; margin-bottom: 10px; }
  .kpi-grid-6 { display: grid; grid-template-columns: repeat(6,1fr); gap: 8px; margin-bottom: 10px; }
  .kpi-grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-bottom: 10px; }
  .table-header { display:grid; background:#f1f5f9; padding:6px 12px; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:0.8px; color:#475569; border-radius:8px 8px 0 0; border:1px solid #e2e8f0; border-bottom:none; }
  .table-row { display:grid; padding:6px 12px; font-size:10px; border:1px solid #e2e8f0; border-top:none; }
  .table-row:last-child { border-radius:0 0 8px 8px; }
  .badge { display:inline-block; padding:2px 8px; border-radius:20px; font-size:9px; font-weight:700; }
  @media print { @page { size: A4; margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>

<!-- HEADER -->
<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);color:#fff;padding:24px 32px 20px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div style="font-size:8px;letter-spacing:3px;text-transform:uppercase;opacity:0.4;margin-bottom:6px;">Portal Voxx · Overview Completo da Unidade</div>
      <div style="font-size:22px;font-weight:900;letter-spacing:-0.5px;">${cliente.nome}</div>
      ${cliente.cidade ? `<div style="font-size:11px;opacity:0.6;margin-top:4px;">${cliente.cidade}/${cliente.estado}</div>` : ""}
      <div style="margin-top:8px;font-size:10px;opacity:0.65;">Data: <strong style="opacity:1;color:#fff;">${dataFmt2}</strong></div>
      ${user ? `<div style="font-size:10px;opacity:0.55;margin-top:2px;">Gerado por: ${user.full_name || user.email}</div>` : ""}
    </div>
    <div style="text-align:right;">
      <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:12px 20px;">
        <div style="font-size:20px;font-weight:900;">VOXX</div>
        <div style="font-size:8px;letter-spacing:2px;text-transform:uppercase;opacity:0.5;margin-top:2px;">Gestão de Performance</div>
      </div>
      <div style="font-size:9px;opacity:0.4;margin-top:8px;">Gerado em ${dataGeracao}</div>
    </div>
  </div>
</div>

<!-- LINK PORTAL -->
<div style="background:linear-gradient(90deg,#166534,#16a34a);padding:8px 32px;display:flex;align-items:center;justify-content:space-between;">
  <div style="font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.5px;">📊 Dados completos e atualizados no Portal Voxx</div>
  <div style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);border-radius:20px;padding:4px 14px;font-size:9px;font-weight:700;color:#fff;">portal-voxx.com</div>
</div>

<div style="padding:16px 32px 24px;">

${sectionTitle("📊", "KPIs Executivos Consolidados")}
<div class="kpi-grid-5">
  ${kpiBox("Total de Leads", fmtN(totalLeads2), "#16a34a")}
  ${kpiBox("Investimento Total", `R$ ${fmtBrl(totalInvest2)}`)}
  ${kpiBox("CPL Médio", `R$ ${fmtBrl(cplMedio2)}`)}
  ${kpiBox("Conversões Google", fmtN(google?.conversions || 0), "#7c3aed")}
  ${kpiBox("Custo/Conv. Google", `R$ ${fmtBrl(google?.cost_per_conversion)}`)}
</div>

${sectionTitle("🎯", "Performance Meta Ads")}
${meta ? `
<div class="kpi-grid-4" style="margin-bottom:8px;">
  ${kpiBox("Investimento", `R$ ${fmtBrl(meta.amount_spent)}`)}
  ${kpiBox("Leads / Conversas", fmtN(meta.new_messaging_connections || meta.messaging_conversations || 0), "#16a34a")}
  ${kpiBox("CPL", `R$ ${fmtBrl(meta.cost_per_messaging)}`)}
  ${kpiBox("Frequência", meta.frequency ? `${meta.frequency.toFixed(2)}x` : "—", meta.frequency > 3 ? "#ea580c" : "#1e293b")}
</div>
<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
  <span style="font-size:10px;color:#64748b;">Status:</span>
  <span class="badge" style="background:${metaBadgeBg};color:${metaBadgeColor};">${meta.classificacao || "—"}</span>
  ${meta.nota_gpt ? `<span style="font-size:10px;color:#64748b;">· Nota GPT: <strong>${meta.nota_gpt}/100</strong></span>` : ""}
  ${meta.main_issue ? `<span style="font-size:10px;color:#dc2626;">· ⚡ ${meta.main_issue}</span>` : ""}
</div>
${radar ? `
<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:10px 12px;margin-bottom:8px;">
  <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#0369a1;margin-bottom:8px;">Indicadores do Dia Anterior (Radar)</div>
  <div class="kpi-grid-6">
    ${kpiBox("Leads ontem", radar.leads_ontem ?? "—", "#16a34a")}
    ${kpiBox("Inv. diário", radar.amount_spent_ontem != null ? `R$ ${fmtBrl(radar.amount_spent_ontem)}` : "—")}
    ${kpiBox("CPL ontem", radar.cpl_ontem != null ? `R$ ${fmtBrl(radar.cpl_ontem)}` : "—")}
    ${kpiBox("Var. CPL", radar.variacao_cpl != null ? `${radar.variacao_cpl > 0 ? "+" : ""}${radar.variacao_cpl.toFixed(1)}%` : "—", radar.variacao_cpl > 10 ? "#dc2626" : radar.variacao_cpl < -5 ? "#16a34a" : "#d97706")}
    ${kpiBox("CTR (7d)", radar.ctr_7d != null ? `${radar.ctr_7d.toFixed(2)}%` : "—")}
    ${kpiBox("Freq. (7d)", radar.frequencia_7d != null ? `${radar.frequencia_7d.toFixed(2)}x` : "—", radar.frequencia_7d > 3 ? "#ea580c" : "#1e293b")}
  </div>
</div>` : ""}
` : `<p style="color:#94a3b8;font-style:italic;text-align:center;padding:10px 0;font-size:11px;">Dados de Meta Ads não vinculados a este cliente.</p>`}

${sectionTitle("🔍", "Performance Google Ads")}
${google ? `
<div class="kpi-grid-4" style="margin-bottom:8px;">
  ${kpiBox("Investimento", `R$ ${fmtBrl(google.cost)}`)}
  ${kpiBox("Conversões", fmtN(google.conversions || 0), "#16a34a")}
  ${kpiBox("Custo/Conversão", `R$ ${fmtBrl(google.cost_per_conversion)}`)}
  ${kpiBox("Cliques", fmtN(google.clicks || 0), "#2563eb")}
</div>
<div class="kpi-grid-3">
  ${kpiBox("CPC Médio", `R$ ${fmtBrl(google.avg_cpc)}`)}
  ${kpiBox("Optim. Score", google.optimization_score ? `${google.optimization_score}%` : "—", google.optimization_score >= 70 ? "#16a34a" : "#d97706")}
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center;">
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;margin-bottom:6px;">Status</div>
    ${google.health_status ? `<span class="badge" style="background:${googleBadgeBg};color:${googleBadgeColor};">${google.health_status}</span>` : `<span style="color:#94a3b8;">—</span>`}
  </div>
</div>
` : `<p style="color:#94a3b8;font-style:italic;text-align:center;padding:10px 0;font-size:11px;">Dados de Google Ads não vinculados a este cliente.</p>`}

${sectionTitle("🚨", `Radar de Alertas (${alertas2.length})`)}
<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px;">
  ${alertas2.map(a => `
  <div style="display:flex;align-items:flex-start;gap:8px;background:${alertaColor(a.level)};border:1px solid ${alertaColor(a.level)};border-radius:8px;padding:7px 12px;">
    <span>${alertaIcon(a.level)}</span>
    <span style="font-size:10px;color:${alertaTextColor(a.level)};">${a.text}</span>
  </div>`).join("")}
</div>

${sectionTitle("🔧", `Histórico de Ações de Tráfego (${otimizacoes.length})`)}
${otimizacoes.length === 0 ? `<p style="color:#94a3b8;font-style:italic;text-align:center;padding:10px 0;font-size:11px;">Nenhuma ação registrada.</p>` : `
<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;">
  ${[...otimizacoes].sort((a,b)=>new Date(b.data_acao)-new Date(a.data_acao)).map(o => `
  <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:8px 12px;">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:10px;font-weight:700;color:#c2410c;text-transform:uppercase;">${o.objetivo || "Otimização de campanha"}</span>
      <span style="font-size:9px;color:#94a3b8;">${o.data_acao ? format(parseISO(o.data_acao), "dd/MM/yyyy", { locale: ptBR }) : "—"}</span>
    </div>
    ${o.problema ? `<p style="font-size:10px;color:#475569;margin-bottom:2px;"><strong>Problema:</strong> ${o.problema}</p>` : ""}
    ${o.acoes_implementadas ? `<p style="font-size:10px;color:#475569;"><strong>Ações:</strong> ${o.acoes_implementadas}</p>` : ""}
  </div>`).join("")}
</div>`}

${sectionTitle("⚙️", `Demandas Operacionais (${demandasCliente2.length})`)}
<div class="kpi-grid-4" style="margin-bottom:10px;">
  ${kpiBox("Abertas", fmtN(demandasCliente2.filter(d=>d.status!=="concluida").length))}
  ${kpiBox("Em andamento", fmtN(demandasAndamento2.length), "#2563eb")}
  ${kpiBox("Concluídas", fmtN(demandasConcluidas2.length), "#16a34a")}
  ${kpiBox("Aguardando", fmtN(demandasAguardando2.length), demandasAguardando2.length > 0 ? "#d97706" : "#1e293b")}
</div>
${demandasCliente2.length > 0 ? `
<div class="table-header" style="grid-template-columns:5fr 2fr 2fr 2fr 1fr;">
  <span>Título</span><span>Abertura</span><span>Conclusão</span><span>Status</span><span>Prior.</span>
</div>
${[...demandasCliente2].sort((a,b)=>new Date(b.created_date)-new Date(a.created_date)).map((d,i) => {
  const sc = { concluida:"#dcfce7", em_execucao:"#dbeafe", aguardando_cliente:"#fef3c7", recebida:"#f1f5f9", programada:"#cffafe", em_revisao:"#ede9fe" };
  const tc = { concluida:"#166534", em_execucao:"#1d4ed8", aguardando_cliente:"#92400e", recebida:"#475569", programada:"#0e7490", em_revisao:"#5b21b6" };
  return `<div class="table-row" style="grid-template-columns:5fr 2fr 2fr 2fr 1fr;background:${i%2===0?"#fff":"#f8fafc"};">
    <span style="font-size:10px;font-weight:500;color:#1e293b;">${d.titulo}</span>
    <span style="color:#64748b;">${d.created_date ? format(parseISO(d.created_date),"dd/MM/yy") : "—"}</span>
    <span style="color:#64748b;">${d.status==="concluida"&&d.updated_date ? format(parseISO(d.updated_date),"dd/MM/yy") : "—"}</span>
    <span><span class="badge" style="background:${sc[d.status]||"#f1f5f9"};color:${tc[d.status]||"#475569"};">${statusDemandaLabel2[d.status]||d.status}</span></span>
    <span style="font-size:9px;color:${d.prioridade==="alta"?"#dc2626":d.prioridade==="media"?"#d97706":"#94a3b8"};">${d.prioridade||"—"}</span>
  </div>`;
}).join("")}` : ""}

${(() => {
      if (!plano) return "";
      const sc2 = {"Nova":"#f1f5f9","Em andamento":"#dbeafe","Concluída":"#dcfce7"};
      const tc2 = {"Nova":"#475569","Em andamento":"#1d4ed8","Concluída":"#166534"};
      const rowsHtml = itensPlano2.map((item, idx) => {
        const ind = calcularIndicadorPrazo(item.prazo, item.status_acao);
        const pc = ind==="atraso"?"#dc2626":ind==="a_vencer"?"#d97706":"#475569";
        const pw = ind==="atraso"?"700":"400";
        return `<div class="table-row" style="grid-template-columns:5fr 2fr 2fr 2fr 2fr;background:${idx%2===0?"#fff":"#faf5ff"};">
    <span style="font-size:10px;font-weight:500;color:#1e293b;">${item.acao_proposta || "—"}</span>
    <span style="color:#64748b;">${item.responsavel||"—"}</span>
    <span style="color:#64748b;">${item.data_abertura?format(parseISO(item.data_abertura),"dd/MM/yy"):"—"}</span>
    <span style="color:${pc};font-weight:${pw};">${item.prazo?format(parseISO(item.prazo),"dd/MM/yy"):"—"}</span>
    <span><span class="badge" style="background:${sc2[item.status_acao]||"#f1f5f9"};color:${tc2[item.status_acao]||"#475569"};">${item.status_acao||"—"}</span></span>
  </div>`;
      }).join("");
      return `
${sectionTitle("📋", `Plano de Ação — ${plano.titulo_plano} (${itensPlano2.length})`)}
<div class="kpi-grid-4" style="margin-bottom:10px;">
  ${kpiBox("Em andamento", fmtN(itensAndamento2.length), "#2563eb")}
  ${kpiBox("Concluídas", fmtN(itensConcluidos2.length), "#16a34a")}
  ${kpiBox("Em atraso", fmtN(itensAtraso2.length), itensAtraso2.length > 0 ? "#dc2626" : "#1e293b")}
  ${kpiBox("A vencer", fmtN(itensAVencer2.length), itensAVencer2.length > 0 ? "#d97706" : "#1e293b")}
</div>
${itensPlano2.length > 0 ? `<div class="table-header" style="grid-template-columns:5fr 2fr 2fr 2fr 2fr;background:#f5f3ff;color:#5b21b6;border-color:#ddd6fe;">
  <span>Ação</span><span>Responsável</span><span>Abertura</span><span>Prazo</span><span>Status</span>
</div>${rowsHtml}` : "<p style='color:#94a3b8;font-style:italic;font-size:11px;padding:8px 0;'>Nenhuma ação cadastrada neste plano.</p>"}`;
    })()}

${sectionTitle("📝", "Resumo Automático")}
<div style="background:#f8fafc;border-left:3px solid #1e293b;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:16px;">
  <p style="font-size:11px;color:#334155;line-height:1.7;">${[
    `A equipe Voxx seguiu com o acompanhamento ativo das campanhas e execução das demandas operacionais da unidade ${cliente.nome}.`,
    otimizacoesMes2.length > 0 ? `Foram realizadas ${otimizacoesMes2.length} otimização(ões) nas campanhas Meta Ads no período.` : "",
    demandasConcluidas2.length > 0 ? `${demandasConcluidas2.length} demanda(s) foram concluídas, mantendo o ritmo de entregas.` : demandasAndamento2.length > 0 ? `Há ${demandasAndamento2.length} demanda(s) em andamento conforme planejamento.` : "",
    itensAndamento2.length > 0 ? `O plano de ação conta com ${itensAndamento2.length} ação(ões) em execução e ${itensConcluidos2.length} concluída(s).` : "",
    "A gestão permanece comprometida com a evolução contínua de performance e entregas estratégicas."
  ].filter(Boolean).join(" ")}</p>
</div>

</div><!-- /body -->

<!-- FOOTER -->
<div style="background:#f1f5f9;border-top:1px solid #e2e8f0;padding:8px 32px;display:flex;justify-content:space-between;align-items:center;">
  <div>
    <div style="font-size:10px;font-weight:700;color:#475569;">Portal Voxx — Overview Completo da Unidade</div>
    <div style="font-size:9px;color:#94a3b8;">Documento gerado automaticamente</div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:9px;color:#94a3b8;">${cliente.nome} · ${dataFmt2}</div>
    <div style="font-size:9px;color:#94a3b8;">Gerado em ${dataGeracao}</div>
  </div>
</div>

</body>
</html>`;

    const janela = window.open("", "_blank");
    janela.document.write(html);
    janela.document.close();
    setTimeout(() => janela.print(), 500);
  };
  const dataFmt = dataReport
    ? format(parseISO(dataReport), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();

  // ── Demandas ──
  const demandasCliente = useMemo(() => demandas.filter((d) => d.cliente_id === cliente.id), [demandas, cliente.id]);
  const demandasConcluidas = useMemo(() => demandasCliente.filter((d) => d.status === "concluida"), [demandasCliente]);
  const demandasAndamento = useMemo(() => demandasCliente.filter((d) => ["em_execucao", "programada", "em_triagem", "em_revisao"].includes(d.status)), [demandasCliente]);
  const demandasAguardando = useMemo(() => demandasCliente.filter((d) => d.status === "aguardando_cliente"), [demandasCliente]);
  const demandasAbertas = useMemo(() => demandasCliente.filter((d) => d.status !== "concluida"), [demandasCliente]);

  // ── Plano de ação ──
  const itensPlano = useMemo(() => plano ? planoItens.filter((i) => i.plano_id === plano.id) : [], [plano, planoItens]);
  const itensConcluidos = useMemo(() => itensPlano.filter((i) => i.status_acao === "Concluída"), [itensPlano]);
  const itensAndamento = useMemo(() => itensPlano.filter((i) => i.status_acao === "Em andamento"), [itensPlano]);
  const itensNovos = useMemo(() => itensPlano.filter((i) => i.status_acao === "Nova"), [itensPlano]);
  const itensAtraso = useMemo(() => itensPlano.filter((i) => calcularIndicadorPrazo(i.prazo, i.status_acao) === "atraso"), [itensPlano]);
  const itensAVencer = useMemo(() => itensPlano.filter((i) => calcularIndicadorPrazo(i.prazo, i.status_acao) === "a_vencer"), [itensPlano]);

  // ── Otimizações do mês ──
  const otimizacoesMes = useMemo(() => otimizacoes.filter((o) => {
    if (!o.data_acao) return false;
    const dt = new Date(o.data_acao);
    return dt.getMonth() === mesAtual && dt.getFullYear() === anoAtual;
  }), [otimizacoes, mesAtual, anoAtual]);

  // ── KPIs consolidados ──
  const totalLeadsMeta = meta?.new_messaging_connections || meta?.messaging_conversations || 0;
  const totalConversoes = google?.conversions || 0;
  const totalLeads = totalLeadsMeta + totalConversoes;
  const investMeta = meta?.amount_spent || 0;
  const investGoogle = google?.cost || 0;
  const totalInvest = investMeta + investGoogle;
  const cplMedio = totalLeads > 0 ? totalInvest / totalLeads : 0;

  // ── Alertas automáticos ──
  const alertas = useMemo(() => {
    const list = [];
    if (meta?.classificacao === "CRÍTICO") list.push({ level: "error", text: `Meta Ads com classificação CRÍTICA — ação imediata necessária.` });
    else if (meta?.classificacao === "ALERTA") list.push({ level: "warn", text: `Meta Ads em estado de ALERTA — monitoramento intensificado.` });
    else if (meta?.classificacao === "ELITE" || meta?.classificacao === "SAUDÁVEL") list.push({ level: "ok", text: `Meta Ads com performance ${meta.classificacao} — campanhas dentro dos objetivos.` });
    if (google?.health_status === "Urgente" || google?.health_status === "Crítico") list.push({ level: "error", text: `Google Ads com status ${google.health_status} — intervenção necessária.` });
    else if (google?.health_status === "Saudável") list.push({ level: "ok", text: `Google Ads com status Saudável — performance estável.` });
    if (meta?.frequency && meta.frequency > 3.5) list.push({ level: "warn", text: `Frequência Meta Ads elevada (${meta.frequency.toFixed(1)}x) — risco de saturação da audiência.` });
    if (radar?.variacao_cpl != null && radar.variacao_cpl > 15) list.push({ level: "warn", text: `CPL ontem ${radar.variacao_cpl.toFixed(1)}% acima da média dos últimos 7 dias.` });
    if (meta?.leads_repetidos_percent && meta.leads_repetidos_percent > 30) list.push({ level: "warn", text: `Leads repetidos: ${meta.leads_repetidos_percent.toFixed(0)}% — base de contato possivelmente saturada.` });
    if (totalLeadsMeta === 0 && investMeta > 0) list.push({ level: "error", text: `Meta Ads: investimento sem geração de leads registrada.` });
    if (itensAtraso.length > 0) list.push({ level: "warn", text: `${itensAtraso.length} ação(ões) do plano com prazo em atraso.` });
    if (demandasAguardando.length > 0) list.push({ level: "warn", text: `${demandasAguardando.length} demanda(s) aguardando retorno do cliente.` });
    if (list.length === 0) list.push({ level: "ok", text: "Nenhum alerta crítico identificado. Operação e campanhas estáveis." });
    return list;
  }, [meta, google, radar, totalLeadsMeta, investMeta, itensAtraso, demandasAguardando]);

  // ── Resumo automático ──
  const resumoAuto = useMemo(() => {
    const partes = [];
    partes.push(`A equipe Voxx seguiu com o acompanhamento ativo das campanhas e execução das demandas operacionais da unidade ${cliente.nome}.`);
    if (otimizacoesMes.length > 0) partes.push(`Foram realizadas ${otimizacoesMes.length} otimização(ões) nas campanhas Meta Ads no período, com foco em melhorar eficiência e reduzir custo por lead.`);
    if (demandasConcluidas.length > 0) partes.push(`${demandasConcluidas.length} demanda(s) foram concluídas, mantendo o ritmo de entregas estratégicas da unidade.`);
    else if (demandasAndamento.length > 0) partes.push(`Há ${demandasAndamento.length} demanda(s) em andamento, seguindo o planejamento operacional.`);
    if (itensAndamento.length > 0) partes.push(`O plano de ação conta com ${itensAndamento.length} ação(ões) em execução e ${itensConcluidos.length} já concluída(s).`);
    if (meta?.classificacao === "CRÍTICO" || meta?.classificacao === "ALERTA") partes.push(`Ponto de atenção: Meta Ads em estado ${meta.classificacao} — ações corretivas aplicadas.`);
    partes.push(`A gestão permanece comprometida com evolução contínua de performance e entregas estratégicas.`);
    return partes.join(" ");
  }, [cliente.nome, otimizacoesMes, demandasConcluidas, demandasAndamento, itensAndamento, itensConcluidos, meta]);

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-10">

      {/* ── CABEÇALHO ── */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-700 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <button onClick={onBack} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white mb-3 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar para lista
            </button>
            <p className="text-slate-400 text-xs font-medium tracking-widest uppercase mb-1">Overview da Unidade</p>
            <h1 className="text-xl font-bold">{cliente.nome}</h1>
            {cliente.cidade && <p className="text-slate-400 text-xs mt-1">{cliente.cidade}/{cliente.estado}</p>}
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-xs">Data do report</p>
            <p className="text-white font-semibold text-sm">{dataFmt}</p>
            {user && <p className="text-slate-400 text-xs mt-1">Usuário: {user.full_name || user.email}</p>}
            <Button
              size="sm"
              className="mt-3 bg-violet-600 hover:bg-violet-700 text-white"
              onClick={handleGerarPDFOverview}
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" /> Gerar PDF Overview
            </Button>
          </div>
        </div>
      </div>

      {/* ── 1. KPIs EXECUTIVOS ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <SectionTitle icon="📊" title="KPIs Executivos Consolidados" />
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KPICard label="Total de Leads" value={totalLeads} sub="Meta + Google" colorClass="text-green-700" bgClass="bg-green-50/40" icon={<Users className="w-4 h-4" />} />
            <KPICard label="Investimento Total" value={`R$ ${fmtBrl0(totalInvest)}`} sub="Meta + Google Ads" icon={<DollarSign className="w-4 h-4" />} />
            <KPICard label="CPL Médio" value={`R$ ${fmtBrl(cplMedio)}`} sub="Custo por lead" icon={<Target className="w-4 h-4" />} />
            <KPICard label="Conversões Google" value={totalConversoes} sub="Google Ads" colorClass="text-violet-700" bgClass="bg-violet-50/40" icon={<TrendingUp className="w-4 h-4" />} />
            <KPICard label="Custo/Conv. Google" value={`R$ ${fmtBrl(google?.cost_per_conversion)}`} sub="Google Ads" icon={<Activity className="w-4 h-4" />} />
          </div>
        </CardContent>
      </Card>

      {/* ── 2. META ADS ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <SectionTitle icon="🎯" title="Performance Meta Ads" />
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          {meta ? (
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Indicadores Acumulados</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KPICard label="Investimento" value={`R$ ${fmtBrl0(meta.amount_spent)}`} />
                  <KPICard label="Leads / Conversas" value={totalLeadsMeta} colorClass="text-green-700" />
                  <KPICard label="CPL" value={`R$ ${fmtBrl(meta.cost_per_messaging)}`} />
                  <KPICard label="Frequência" value={meta.frequency ? `${meta.frequency.toFixed(2)}x` : "—"} colorClass={meta.frequency > 3 ? "text-amber-600" : "text-slate-700"} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-slate-500">Status:</span>
                  <Badge className={cn("text-xs", meta.classificacao === "ELITE" || meta.classificacao === "SAUDÁVEL" ? "bg-green-100 text-green-700" : meta.classificacao === "CRÍTICO" || meta.classificacao === "ALERTA" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700")}>
                    {meta.classificacao || "—"}
                  </Badge>
                  {meta.nota_gpt && <span className="text-xs text-slate-500">· Nota GPT: <strong>{meta.nota_gpt}/100</strong></span>}
                  {meta.leads_repetidos_percent ? <span className="text-xs text-slate-500">· Leads repetidos: <strong>{meta.leads_repetidos_percent.toFixed(0)}%</strong></span> : null}
                  {meta.main_issue && <span className="text-xs text-red-600">· ⚡ {meta.main_issue}</span>}
                </div>
              </div>
              {radar ? (
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Indicadores do Dia Anterior</p>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    <KPICard label="Leads ontem" value={radar.leads_ontem ?? "—"} colorClass="text-green-700" />
                    <KPICard label="Inv. diário" value={radar.amount_spent_ontem != null ? `R$ ${fmtBrl(radar.amount_spent_ontem)}` : "—"} />
                    <KPICard label="CPL ontem" value={radar.cpl_ontem != null ? `R$ ${fmtBrl(radar.cpl_ontem)}` : "—"} />
                    <KPICard label="Var. CPL" value={radar.variacao_cpl != null ? `${radar.variacao_cpl > 0 ? "+" : ""}${radar.variacao_cpl.toFixed(1)}%` : "—"} colorClass={radar.variacao_cpl > 10 ? "text-red-600" : radar.variacao_cpl < -5 ? "text-green-700" : "text-amber-600"} />
                    <KPICard label="CTR (7d)" value={radar.ctr_7d != null ? `${radar.ctr_7d.toFixed(2)}%` : "—"} />
                    <KPICard label="Freq. (7d)" value={radar.frequencia_7d != null ? `${radar.frequencia_7d.toFixed(2)}x` : "—"} colorClass={radar.frequencia_7d > 3 ? "text-amber-600" : "text-slate-700"} />
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-400 italic text-center py-4">Dados de Meta Ads não vinculados a este cliente.</p>
          )}
        </CardContent>
      </Card>

      {/* ── 3. GOOGLE ADS ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <SectionTitle icon="🔍" title="Performance Google Ads" />
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {google ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <KPICard label="Investimento" value={`R$ ${fmtBrl0(google.cost)}`} />
                <KPICard label="Conversões" value={google.conversions || 0} colorClass="text-green-700" />
                <KPICard label="Custo/Conversão" value={`R$ ${fmtBrl(google.cost_per_conversion)}`} />
                <KPICard label="Cliques" value={google.clicks || 0} colorClass="text-blue-700" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KPICard label="CPC Médio" value={`R$ ${fmtBrl(google.avg_cpc)}`} />
                <KPICard label="Optim. Score" value={google.optimization_score ? `${google.optimization_score}%` : "—"} colorClass={google.optimization_score >= 70 ? "text-green-700" : "text-amber-600"} />
                <div className="flex flex-col gap-1 rounded-xl border border-slate-100 p-4 bg-white">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Status</span>
                  {google.health_status ? (
                    <Badge className={cn("text-xs w-fit mt-1", google.health_status === "Saudável" ? "bg-green-100 text-green-700" : google.health_status === "Crítico" || google.health_status === "Urgente" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700")}>
                      {google.health_status}
                    </Badge>
                  ) : <span className="text-sm text-slate-400">—</span>}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400 italic text-center py-4">Dados de Google Ads não vinculados a este cliente.</p>
          )}
        </CardContent>
      </Card>

      {/* ── 4. RADAR DE ALERTAS ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <SectionTitle icon="🚨" title="Radar de Alertas de Performance" count={alertas.length} />
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-2">
          {alertas.map((a, i) => <AlertRow key={i} level={a.level} text={a.text} />)}
        </CardContent>
      </Card>

      {/* ── 5. HISTÓRICO DE AÇÕES DE TRÁFEGO ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <SectionTitle icon="🔧" title="Histórico de Ações de Tráfego" count={otimizacoes.length} />
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {otimizacoes.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-4">Nenhuma ação de tráfego registrada para esta conta.</p>
          ) : (
            <div className="space-y-3">
              {[...otimizacoes].sort((a, b) => new Date(b.data_acao) - new Date(a.data_acao)).map((o) => (
                <div key={o.id} className="rounded-lg border border-orange-100 bg-orange-50/40 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">
                      {o.objetivo || "Otimização de campanha"}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {o.data_acao ? format(parseISO(o.data_acao), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                    </span>
                  </div>
                  {o.problema && <p className="text-xs text-slate-600 mb-0.5"><span className="font-semibold">Problema:</span> {o.problema}</p>}
                  {o.acoes_implementadas && <p className="text-xs text-slate-600 mb-0.5"><span className="font-semibold">Ações:</span> {o.acoes_implementadas}</p>}
                  {o.resumo_acao && <p className="text-xs text-slate-500 italic mt-1">{o.resumo_acao}</p>}
                  <p className="text-xs text-slate-400 mt-1.5">Responsável: Equipe de Tráfego Voxx</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 6. DEMANDAS OPERACIONAIS ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <SectionTitle icon="⚙️" title="Demandas Operacionais" count={demandasCliente.length} />
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <KPICard label="Abertas" value={demandasAbertas.length} colorClass="text-slate-700" />
            <KPICard label="Em andamento" value={demandasAndamento.length} colorClass="text-blue-700" bgClass="bg-blue-50/30" />
            <KPICard label="Concluídas" value={demandasConcluidas.length} colorClass="text-green-700" bgClass="bg-green-50/30" />
            <KPICard label="Aguardando" value={demandasAguardando.length} colorClass={demandasAguardando.length > 0 ? "text-amber-700" : "text-slate-700"} bgClass={demandasAguardando.length > 0 ? "bg-amber-50/30" : ""} />
          </div>
          {demandasCliente.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-4">Nenhuma demanda registrada para este cliente.</p>
          ) : (
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 gap-0 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <span className="col-span-5">Título</span>
                <span className="col-span-2">Abertura</span>
                <span className="col-span-2">Conclusão</span>
                <span className="col-span-2">Status</span>
                <span className="col-span-1">Prior.</span>
              </div>
              {[...demandasCliente].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).map((d, i) => {
                const statusColors = {
                  concluida: "bg-green-100 text-green-700",
                  em_execucao: "bg-blue-100 text-blue-700",
                  aguardando_cliente: "bg-amber-100 text-amber-700",
                  recebida: "bg-slate-100 text-slate-600",
                  em_triagem: "bg-slate-100 text-slate-600",
                  programada: "bg-cyan-100 text-cyan-700",
                  em_revisao: "bg-violet-100 text-violet-700",
                };
                const priorColors = { alta: "text-red-600 font-bold", media: "text-amber-600", baixa: "text-slate-400" };
                return (
                  <div key={d.id} className={cn("grid grid-cols-12 gap-0 px-4 py-2.5 text-xs items-start border-b border-slate-50 last:border-b-0", i % 2 === 0 ? "bg-white" : "bg-slate-50/40")}>
                    <span className="col-span-5 text-slate-800 font-medium leading-snug pr-2">{d.titulo}</span>
                    <span className="col-span-2 text-slate-500">{d.created_date ? format(parseISO(d.created_date), "dd/MM/yy") : "—"}</span>
                    <span className="col-span-2 text-slate-500">{d.status === "concluida" && d.updated_date ? format(parseISO(d.updated_date), "dd/MM/yy") : "—"}</span>
                    <span className="col-span-2">
                      <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium", statusColors[d.status] || "bg-slate-100 text-slate-600")}>
                        {STATUS_LABELS[d.status] || d.status}
                      </span>
                    </span>
                    <span className={cn("col-span-1 text-[10px]", priorColors[d.prioridade] || "text-slate-400")}>
                      {d.prioridade || "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 7. PLANO DE AÇÃO ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <SectionTitle icon="📋" title={plano ? `Plano de Ação — ${plano.titulo_plano}` : "Plano de Ação"} count={itensPlano.length} />
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {!plano ? (
            <p className="text-sm text-slate-400 italic text-center py-4">Nenhum plano de ação ativo para este cliente.</p>
          ) : (
            <>
              {plano.objetivo_geral && <p className="text-xs text-slate-500 mb-4 leading-relaxed">{plano.objetivo_geral}</p>}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <KPICard label="Abertas" value={itensNovos.length} colorClass="text-slate-700" />
                <KPICard label="Em andamento" value={itensAndamento.length} colorClass="text-blue-700" bgClass="bg-blue-50/30" />
                <KPICard label="Concluídas" value={itensConcluidos.length} colorClass="text-green-700" bgClass="bg-green-50/30" />
                <KPICard label="Em atraso" value={itensAtraso.length} colorClass={itensAtraso.length > 0 ? "text-red-700" : "text-slate-700"} bgClass={itensAtraso.length > 0 ? "bg-red-50/30" : ""} />
              </div>
              {itensAVencer.length > 0 && (
                <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 shrink-0" /> {itensAVencer.length} ação(ões) com prazo a vencer em breve
                </div>
              )}
              {itensPlano.length > 0 && (
                <div className="border border-violet-100 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-12 gap-0 bg-violet-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-violet-700 border-b border-violet-100">
                    <span className="col-span-4">Ação</span>
                    <span className="col-span-2">Responsável</span>
                    <span className="col-span-2">Abertura</span>
                    <span className="col-span-2">Prazo</span>
                    <span className="col-span-2">Status</span>
                  </div>
                  {itensPlano.map((item, idx) => {
                    const ind = calcularIndicadorPrazo(item.prazo, item.status_acao);
                    const prazoColor = ind === "atraso" ? "text-red-600 font-semibold" : ind === "a_vencer" ? "text-amber-600" : "text-slate-500";
                    const statusColor = {
                      "Nova": "bg-slate-100 text-slate-600",
                      "Em andamento": "bg-blue-100 text-blue-700",
                      "Concluída": "bg-green-100 text-green-700",
                    }[item.status_acao] || "bg-slate-100 text-slate-600";
                    return (
                      <div key={item.id} className={cn("grid grid-cols-12 gap-0 px-4 py-2.5 text-xs items-start border-b border-slate-50 last:border-b-0", idx % 2 === 0 ? "bg-white" : "bg-violet-50/20")}>
                        <span className="col-span-4 text-slate-800 font-medium leading-snug pr-2">{item.acao_proposta}</span>
                        <span className="col-span-2 text-slate-500">{item.responsavel || "—"}</span>
                        <span className="col-span-2 text-slate-500">{item.data_abertura ? format(parseISO(item.data_abertura), "dd/MM/yy") : "—"}</span>
                        <span className={cn("col-span-2", prazoColor)}>{item.prazo ? format(parseISO(item.prazo), "dd/MM/yy") : "—"}</span>
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
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 8. RESUMO AUTOMÁTICO ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <SectionTitle icon="📝" title="Resumo Automático do Dia" />
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-sm text-slate-700 leading-relaxed">{resumoAuto}</p>
          </div>
        </CardContent>
      </Card>

      {/* ── 9. BOTÃO GERAR REPORT ── */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
        </Button>
        <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={handleGerarPDFOverview}>
          <FileText className="w-4 h-4 mr-1.5" /> Gerar PDF Overview
        </Button>
      </div>
    </div>
  );
}