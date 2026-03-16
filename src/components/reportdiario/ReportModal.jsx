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
    const fmtBrl = (v) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtBrl0 = (v) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    const otimizacoesExibir = otimizacoesMes.slice(0, 3);
    const demandasEmAndamentoExibir = demandasEmAndamento.slice(0, 3);
    const demandasConcluidasExibir = demandasConcluidas.slice(0, 3);
    const demandasAguardandoExibir = demandasAguardando.slice(0, 3);
    const itensPlanoExibir = itensPlano.slice(0, 3);

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Report Diário Voxx — ${cliente.nome}</title>
<style>
  @page { margin: 0; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #1e293b; font-size: 13px; line-height: 1.65; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 780px; margin: 0 auto; padding-bottom: 40px; }

  /* ── CABEÇALHO ── */
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%); color: #fff; padding: 36px 44px 32px; display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .header-left {}
  .header-brand { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.45; margin-bottom: 8px; }
  .header-title { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.1; }
  .header-meta { margin-top: 14px; display: flex; flex-direction: column; gap: 4px; }
  .header-meta-row { font-size: 12px; opacity: 0.75; }
  .header-meta-row strong { opacity: 1; }
  .portal-btn { background: linear-gradient(135deg, #16a34a, #15803d); border-radius: 12px; padding: 14px 18px; text-align: center; text-decoration: none; display: block; min-width: 200px; flex-shrink: 0; }
  .portal-btn-icon { font-size: 20px; margin-bottom: 4px; }
  .portal-btn-main { font-size: 13px; font-weight: 800; color: #fff; display: block; letter-spacing: 0.2px; }
  .portal-btn-sub { font-size: 10px; color: rgba(255,255,255,0.75); display: block; margin-top: 3px; line-height: 1.4; }

  /* ── SEÇÕES ── */
  .section { padding: 24px 44px; border-bottom: 1px solid #f1f5f9; page-break-inside: avoid; }
  .section:last-child { border-bottom: none; }
  .section-title { font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
  .section-title-icon { font-size: 15px; }

  /* ── TEXTO ── */
  .texto { font-size: 13px; color: #475569; line-height: 1.8; margin-bottom: 12px; }

  /* ── BOXES ── */
  .box-destaque { border-left: 3px solid #22c55e; background: #f0fdf4; padding: 10px 14px; border-radius: 0 8px 8px 0; margin-bottom: 8px; }
  .box-destaque-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #16a34a; margin-bottom: 3px; }
  .box-destaque-text { font-size: 12px; color: #166534; line-height: 1.6; }
  .box-atencao { border-left: 3px solid #f59e0b; background: #fffbeb; padding: 10px 14px; border-radius: 0 8px 8px 0; margin-bottom: 8px; }
  .box-atencao-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #b45309; margin-bottom: 3px; }
  .box-atencao-text { font-size: 12px; color: #92400e; line-height: 1.6; }

  /* ── METRICS ── */
  .metrics-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; }
  .metrics-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
  .metrics-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 12px; }
  .metric-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center; }
  .metric-value { font-size: 18px; font-weight: 800; color: #1e293b; line-height: 1; }
  .metric-label { font-size: 10px; color: #64748b; margin-top: 4px; }
  .metric-card.green .metric-value { color: #16a34a; }
  .metric-card.amber .metric-value { color: #d97706; }
  .metric-card.red .metric-value { color: #dc2626; }
  .metric-card.blue .metric-value { color: #2563eb; }
  .metric-card.violet .metric-value { color: #7c3aed; }

  /* ── PLATAFORMA HEADER ── */
  .plataforma-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding: 8px 12px; border-radius: 8px; }
  .plataforma-header.meta { background: #eff6ff; }
  .plataforma-header.google { background: #faf5ff; }
  .plataforma-header-name { font-size: 13px; font-weight: 800; }
  .plataforma-header.meta .plataforma-header-name { color: #1d4ed8; }
  .plataforma-header.google .plataforma-header-name { color: #7c3aed; }

  /* ── BADGES ── */
  .badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 10px; font-weight: 700; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-yellow { background: #fef3c7; color: #92400e; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-blue { background: #dbeafe; color: #1d4ed8; }
  .badge-slate { background: #f1f5f9; color: #475569; }

  /* ── DEMANDAS ── */
  .demanda-item { padding: 10px 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 6px; }
  .demanda-titulo { font-size: 12px; font-weight: 600; color: #1e293b; margin-bottom: 3px; }
  .demanda-meta { font-size: 10px; color: #64748b; }

  /* ── OTIMIZAÇÕES ── */
  .otimizacao-item { padding: 12px 14px; border-radius: 8px; border: 1px solid #fed7aa; background: #fff7ed; margin-bottom: 8px; }
  .otimizacao-data { font-size: 10px; font-weight: 700; color: #c2410c; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .otimizacao-acao { font-size: 12px; color: #431407; line-height: 1.5; }
  .otimizacao-impacto { font-size: 11px; color: #9a3412; margin-top: 4px; font-style: italic; }

  /* ── PLANO ── */
  .plano-item { display: grid; grid-template-columns: 1fr auto auto auto; gap: 8px; align-items: start; padding: 8px 10px; border-radius: 6px; margin-bottom: 4px; font-size: 11px; }
  .plano-item:nth-child(even) { background: #faf5ff; }
  .plano-acao { color: #334155; }
  .plano-responsavel { color: #64748b; white-space: nowrap; }
  .plano-prazo { white-space: nowrap; }
  .plano-prazo.atraso { color: #dc2626; font-weight: 700; }
  .plano-prazo.a_vencer { color: #d97706; }
  .plano-prazo.ok { color: #64748b; }

  /* ── SUBSEÇÃO ── */
  .sub-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; margin-top: 14px; }
  .sub-label.green { color: #16a34a; }
  .sub-label.blue { color: #2563eb; }
  .sub-label.amber { color: #b45309; }
  .sub-label.violet { color: #7c3aed; }

  /* ── AÇÕES VOXX ── */
  .acoes-voxx-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; }
  .acoes-voxx-box p { font-size: 13px; color: #475569; line-height: 1.8; }

  /* ── PRÓXIMOS PASSOS ── */
  .steps-list p { font-size: 13px; color: #475569; margin-bottom: 7px; padding-left: 20px; position: relative; line-height: 1.6; }
  .steps-list p::before { content: "→"; position: absolute; left: 0; color: #7c3aed; font-weight: 700; }

  /* ── SEPARADOR ── */
  .divider { height: 1px; background: #f1f5f9; margin: 14px 0; }

  /* ── RODAPÉ ── */
  .footer { background: #f8fafc; border-top: 2px solid #e2e8f0; padding: 14px 44px; display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
  .footer-brand { font-size: 12px; font-weight: 700; color: #475569; }
  .footer-sub { font-size: 10px; color: #94a3b8; margin-top: 2px; }
  .footer-date { font-size: 10px; color: #94a3b8; text-align: right; }

  @media print {
    @page { margin: 0; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { max-width: 100%; }
    .section { page-break-inside: avoid; }
    .header, .footer { -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page">

<!-- ══ CABEÇALHO EDITORIAL ══ -->
<div class="header">
  <div class="header-left">
    <div class="header-brand">Portal Voxx · Relatório Executivo</div>
    <div class="header-title">Report Diário Voxx</div>
    <div class="header-meta">
      <div class="header-meta-row"><strong>Cliente:</strong> ${cliente.nome}</div>
      <div class="header-meta-row"><strong>Data do relatório:</strong> ${dataFmt}</div>
      <div class="header-meta-row"><strong>Gerado em:</strong> ${dataGeracao}</div>
    </div>
  </div>
  <a href="https://portal-voxx.com/" class="portal-btn">
    <div class="portal-btn-icon">📊</div>
    <span class="portal-btn-main">Acesse pelo Portal Voxx</span>
    <span class="portal-btn-sub">Acompanhe resultados, demandas e ações em um só lugar.</span>
  </a>
</div>

<!-- ══ 1 — RESUMO EXECUTIVO ══ -->
<div class="section">
  <div class="section-title"><span class="section-title-icon">📋</span> Resumo Executivo</div>
  <p class="texto">${resumoExecutivo}</p>
  <div class="box-destaque">
    <div class="box-destaque-label">✅ Destaque positivo do dia</div>
    <div class="box-destaque-text">${destaqueTexto}</div>
  </div>
  <div class="box-atencao">
    <div class="box-atencao-label">⚠️ Ponto de atenção</div>
    <div class="box-atencao-text">${atencaoTexto}</div>
  </div>
</div>

<!-- ══ 2 — PERFORMANCE DE MÍDIA ══ -->
<div class="section">
  <div class="section-title"><span class="section-title-icon">📈</span> Performance de Mídia</div>

  ${meta ? `
  <div class="plataforma-header meta">
    <span style="font-size:16px;">🎯</span>
    <span class="plataforma-header-name">Meta Ads</span>
    <span class="badge ${metaClassBadge(meta.classificacao)}" style="margin-left:auto;">${meta.classificacao || "—"}</span>
  </div>
  <div class="metrics-3">
    <div class="metric-card"><div class="metric-value">R$ ${fmtBrl0(meta.amount_spent)}</div><div class="metric-label">Investimento</div></div>
    <div class="metric-card green"><div class="metric-value">${meta.new_messaging_connections || meta.messaging_conversations || 0}</div><div class="metric-label">Leads gerados</div></div>
    <div class="metric-card"><div class="metric-value">R$ ${fmtBrl(meta.cost_per_messaging)}</div><div class="metric-label">CPL médio</div></div>
  </div>
  <div class="metrics-3">
    <div class="metric-card ${meta.frequency && meta.frequency > 3 ? "amber" : ""}"><div class="metric-value">${meta.frequency ? meta.frequency.toFixed(1) + "x" : "—"}</div><div class="metric-label">Frequência</div></div>
    <div class="metric-card"><div class="metric-value">${meta.nota_gpt ? meta.nota_gpt + "/100" : "—"}</div><div class="metric-label">Nota GPT</div></div>
    <div class="metric-card ${meta.leads_repetidos_percent && meta.leads_repetidos_percent > 25 ? "amber" : ""}"><div class="metric-value">${meta.leads_repetidos_percent ? meta.leads_repetidos_percent.toFixed(0) + "%" : "—"}</div><div class="metric-label">Leads repetidos</div></div>
  </div>
  ${meta.main_issue ? `<p style="font-size:11px;color:#dc2626;background:#fef2f2;padding:7px 12px;border-radius:6px;margin-top:4px;">⚡ ${meta.main_issue}</p>` : ""}
  ` : `<p class="texto" style="color:#94a3b8;font-style:italic;margin-bottom:12px;">Dados de Meta Ads não vinculados a este cliente no momento.</p>`}

  ${radar ? `
  <div style="margin-top:12px;">
    <p style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Meta Ads — Ontem vs 7 dias</p>
    <div class="metrics-3">
      <div class="metric-card green"><div class="metric-value">${radar.leads_ontem ?? "—"}</div><div class="metric-label">Leads ontem</div></div>
      <div class="metric-card ${radar.variacao_cpl != null && radar.variacao_cpl > 10 ? "red" : radar.variacao_cpl != null && radar.variacao_cpl < -5 ? "green" : "amber"}"><div class="metric-value">${radar.variacao_cpl != null ? `${radar.variacao_cpl > 0 ? "+" : ""}${radar.variacao_cpl.toFixed(1)}%` : "—"}</div><div class="metric-label">Var. CPL</div></div>
      <div class="metric-card ${radar.frequencia_7d != null && radar.frequencia_7d > 3 ? "red" : ""}"><div class="metric-value">${radar.frequencia_7d != null ? `${radar.frequencia_7d.toFixed(1)}x` : "—"}</div><div class="metric-label">Freq. (7d)</div></div>
    </div>
  </div>` : ""}

  <div class="divider"></div>

  ${google ? `
  <div class="plataforma-header google">
    <span style="font-size:16px;">🔍</span>
    <span class="plataforma-header-name">Google Ads</span>
    ${google.health_status ? `<span class="badge ${googleStatusBadge(google.health_status)}" style="margin-left:auto;">${google.health_status}</span>` : ""}
  </div>
  <div class="metrics-3">
    <div class="metric-card"><div class="metric-value">R$ ${fmtBrl0(google.cost)}</div><div class="metric-label">Investimento</div></div>
    <div class="metric-card green"><div class="metric-value">${google.conversions || 0}</div><div class="metric-label">Conversões</div></div>
    <div class="metric-card"><div class="metric-value">R$ ${fmtBrl(google.cost_per_conversion)}</div><div class="metric-label">Custo/Conversão</div></div>
  </div>
  <div class="metrics-3">
    <div class="metric-card blue"><div class="metric-value">${google.clicks || 0}</div><div class="metric-label">Cliques</div></div>
    <div class="metric-card"><div class="metric-value">R$ ${fmtBrl(google.avg_cpc)}</div><div class="metric-label">CPC médio</div></div>
    <div class="metric-card ${google.optimization_score && google.optimization_score >= 70 ? "green" : google.optimization_score && google.optimization_score < 50 ? "amber" : ""}"><div class="metric-value">${google.optimization_score ? google.optimization_score + "%" : "—"}</div><div class="metric-label">Optim. Score</div></div>
  </div>
  ` : `<p class="texto" style="color:#94a3b8;font-style:italic;">Dados de Google Ads não vinculados a este cliente no momento.</p>`}
</div>

<!-- ══ 3 — DEMANDAS E EXECUÇÃO ══ -->
<div class="section">
  <div class="section-title"><span class="section-title-icon">⚙️</span> Demandas e Execução</div>
  <div class="metrics-2" style="margin-bottom:16px;">
    <div class="metric-card blue"><div class="metric-value">${demandasEmAndamento.length}</div><div class="metric-label">Em andamento</div></div>
    <div class="metric-card green"><div class="metric-value">${demandasConcluidas.length}</div><div class="metric-label">Concluídas</div></div>
  </div>

  ${demandasConcluidasExibir.length > 0 ? `
  <div class="sub-label green">✅ Demandas concluídas</div>
  ${demandasConcluidasExibir.map(d => `
  <div class="demanda-item" style="border-color:#bbf7d0;background:#f0fdf4;">
    <div class="demanda-titulo">${d.titulo}</div>
    <div class="demanda-meta">Status: <span style="color:#16a34a;font-weight:700;">Concluída</span> · Responsável: Voxx</div>
  </div>`).join("")}` : ""}

  ${demandasEmAndamentoExibir.length > 0 ? `
  <div class="sub-label blue">🔄 Demandas em andamento</div>
  ${demandasEmAndamentoExibir.map(d => `
  <div class="demanda-item">
    <div class="demanda-titulo">${d.titulo}</div>
    <div class="demanda-meta">Status: <span style="color:#2563eb;font-weight:700;">${statusDemandaLabel[d.status] || d.status}</span> · Responsável: Voxx</div>
  </div>`).join("")}` : ""}

  ${demandasAguardandoExibir.length > 0 ? `
  <div class="sub-label amber">⏳ Aguardando cliente</div>
  ${demandasAguardandoExibir.map(d => `
  <div class="demanda-item" style="border-color:#fde68a;background:#fffbeb;">
    <div class="demanda-titulo">${d.titulo}</div>
    <div class="demanda-meta">Aguardando retorno do cliente para prosseguimento.</div>
  </div>`).join("")}` : ""}
</div>

${otimizacoesExibir.length > 0 ? `
<!-- ══ OTIMIZAÇÕES APLICADAS ══ -->
<div class="section">
  <div class="section-title"><span class="section-title-icon">🔧</span> Otimizações aplicadas no período</div>
  ${otimizacoesExibir.map(o => `
  <div class="otimizacao-item">
    <div class="otimizacao-data">${o.data_acao ? o.data_acao.split("T")[0].split("-").reverse().join("/") : "—"} — ${o.problema || "Otimização de campanha"}</div>
    <div class="otimizacao-acao"><strong>Ação:</strong> ${o.acoes_implementadas || o.resumo_acao || "—"}</div>
    ${o.objetivo ? `<div class="otimizacao-impacto">Impacto esperado: ${o.objetivo}</div>` : ""}
  </div>`).join("")}
  ${otimizacoesMes.length > 3 ? `<p style="font-size:10px;color:#94a3b8;margin-top:8px;">+ ${otimizacoesMes.length - 3} otimizações adicionais disponíveis no Portal Voxx.</p>` : ""}
</div>
` : ""}

${plano ? `
<!-- ══ 4 — PLANO DE AÇÃO ══ -->
<div class="section">
  <div class="section-title"><span class="section-title-icon">📋</span> Plano de Ação</div>
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
    <span style="font-size:13px;font-weight:700;color:#4c1d95;">${plano.titulo_plano}</span>
    <span class="badge badge-yellow">${plano.status_plano}</span>
  </div>
  ${plano.objetivo_geral ? `<p class="texto" style="margin-bottom:12px;">${plano.objetivo_geral}</p>` : ""}
  <div class="metrics-4" style="margin-bottom:12px;">
    <div class="metric-card violet"><div class="metric-value">${itensNovos.length}</div><div class="metric-label">Ações abertas</div></div>
    <div class="metric-card blue"><div class="metric-value">${itensAndamento.length}</div><div class="metric-label">Em andamento</div></div>
    <div class="metric-card green"><div class="metric-value">${itensConcluidos.length}</div><div class="metric-label">Concluídas</div></div>
    <div class="metric-card ${itensAtraso.length > 0 ? "red" : ""}"><div class="metric-value">${itensAtraso.length}</div><div class="metric-label">Em atraso</div></div>
  </div>
  ${itensAVencer.length > 0 ? `<p style="font-size:11px;color:#d97706;background:#fffbeb;padding:6px 10px;border-radius:6px;margin-bottom:12px;">🕐 ${itensAVencer.length} ação(ões) com prazo a vencer em breve</p>` : ""}
  ${itensPlanoExibir.length > 0 ? `
  <div style="border:1px solid #ede9fe;border-radius:8px;overflow:hidden;">
    <div style="display:grid;grid-template-columns:1fr 110px 80px 90px;background:#ede9fe;padding:7px 10px;">
      <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#5b21b6;">Ação</span>
      <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#5b21b6;">Responsável</span>
      <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#5b21b6;">Prazo</span>
      <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#5b21b6;">Status</span>
    </div>
    ${itensPlanoExibir.map((item, idx) => {
      const ind = calcularIndicadorPrazo(item.prazo, item.status_acao);
      const prazoStyle = ind === "atraso" ? "color:#dc2626;font-weight:700;" : ind === "a_vencer" ? "color:#d97706;" : "color:#64748b;";
      const statusBg = item.status_acao === "Concluída" ? "background:#dcfce7;color:#166534;" : item.status_acao === "Em andamento" ? "background:#dbeafe;color:#1d4ed8;" : "background:#f1f5f9;color:#475569;";
      const prazoFmt = item.prazo ? item.prazo.split("T")[0].split("-").reverse().join("/") : "—";
      return `<div style="display:grid;grid-template-columns:1fr 110px 80px 90px;padding:8px 10px;background:${idx % 2 === 0 ? "#fff" : "#faf5ff"};border-top:1px solid #f1f5f9;font-size:11px;align-items:start;">
        <span style="color:#334155;">${item.acao_proposta}</span>
        <span style="color:#64748b;">${item.responsavel || "—"}</span>
        <span style="${prazoStyle}">${prazoFmt}</span>
        <span><span style="padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;${statusBg}">${item.status_acao || "—"}</span></span>
      </div>`;
    }).join("")}
  </div>
  ${itensPlano.length > 3 ? `<p style="font-size:10px;color:#94a3b8;margin-top:8px;">+ ${itensPlano.length - 3} ações adicionais disponíveis no Portal Voxx.</p>` : ""}
  ` : ""}
</div>
` : ""}

<!-- ══ 5 — AÇÕES REALIZADAS PELA VOXX ══ -->
<div class="section">
  <div class="section-title"><span class="section-title-icon">🚀</span> Ações realizadas pela Voxx</div>
  <div class="acoes-voxx-box">
    <p>${acoesVoxxTexto}</p>
  </div>
</div>

<!-- ══ 6 — PRÓXIMOS PASSOS ══ -->
<div class="section">
  <div class="section-title"><span class="section-title-icon">➡️</span> Próximos Passos</div>
  <div class="steps-list">
    ${proxPassosTexto.split("\n").map(s => s.trim()).filter(Boolean).map(s => `<p>${s}</p>`).join("")}
  </div>
</div>

<!-- ══ RODAPÉ ══ -->
<div class="footer">
  <div>
    <div class="footer-brand">Portal Voxx</div>
    <div class="footer-sub">Relatório gerado automaticamente</div>
  </div>
  <div class="footer-date">${dataGeracao}</div>
</div>

</div>
</body>
</html>`;

    const janela = window.open("", "_blank");
    janela.document.write(html);
    janela.document.close();
    setTimeout(() => janela.print(), 500);
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

          {/* ── RESUMO EXECUTIVO ── */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <SectionHeader label="1" title="Resumo Executivo" />
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">{resumoExecutivo}</p>
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