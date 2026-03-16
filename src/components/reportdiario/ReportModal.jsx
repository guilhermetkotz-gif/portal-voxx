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

  // ── Gerar PDF — Modelo Executivo 1 Página ──
  const handleGerarPDF = () => {
    const fmtBrl = (v) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtBrl0 = (v) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    const totalLeads = (meta?.new_messaging_connections || meta?.messaging_conversations || 0) + (google?.conversions || 0);
    const totalInvest = (meta?.amount_spent || 0) + (google?.cost || 0);
    const cplMedio = totalLeads > 0 ? (totalInvest / totalLeads) : 0;

    // Variações de resumo executivo para evitar repetição
    const resumoVariacoes = [
      `Hoje seguimos com o acompanhamento ativo das campanhas e execução das demandas operacionais da unidade. ${demandasConcluidas.length > 0 ? `Foram concluídas ${demandasConcluidas.length} entrega(s) no período, fortalecendo o fluxo de marketing.` : `As demandas seguem em execução conforme planejamento.`} A gestão está focada na evolução contínua da performance e no avanço das estratégias da unidade.`,
      `O dia foi marcado pelo acompanhamento contínuo das campanhas e pela gestão das ações operacionais previstas. ${otimizacoesMes.length > 0 ? `Foram realizadas ${otimizacoesMes.length} otimização(ões) nas campanhas para melhorar os resultados.` : `As campanhas seguem estáveis com monitoramento ativo.`} Seguimos com foco em performance e entregas estratégicas.`,
      `A equipe Voxx seguiu hoje com a execução das atividades operacionais e o monitoramento das campanhas. ${demandasEmAndamento.length > 0 ? `Há ${demandasEmAndamento.length} demanda(s) em andamento, mantendo o ritmo das entregas.` : `O fluxo operacional está estável e alinhado ao planejamento.`} A gestão segue comprometida com a evolução consistente dos resultados.`,
    ];
    const resumoIdx = new Date().getDate() % resumoVariacoes.length;
    const resumoFinal = resumoVariacoes[resumoIdx];

    // Próximos passos dinâmicos (máx 3)
    const proximosPassosDinamicos = [
      otimizacoesMes.length > 0 || (meta?.classificacao === "ALERTA" || meta?.classificacao === "CRÍTICO")
        ? "Otimização contínua e ajustes nas campanhas Meta Ads" : null,
      demandasEmAndamento.length > 0 ? `Avanço das ${demandasEmAndamento.length} demanda(s) em execução` : null,
      itensAndamento.length > 0 ? "Evolução do plano de ação estratégico" : null,
      "Monitoramento de performance e ajustes estratégicos",
    ].filter(Boolean).slice(0, 3);

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Report Diário Voxx — ${cliente.nome}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    background: #fff;
    color: #1e293b;
    font-size: 12px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    width: 210mm;
    min-height: 297mm;
  }

  /* ══ HEADER ══ */
  .header {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #fff;
    padding: 22px 32px 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  .header-left {}
  .header-eyebrow { font-size: 8px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.4; margin-bottom: 5px; }
  .header-title { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; line-height: 1; }
  .header-subtitle { font-size: 11px; opacity: 0.6; margin-top: 4px; }
  .header-meta { margin-top: 8px; display: flex; flex-direction: column; gap: 2px; }
  .header-meta-row { font-size: 10px; opacity: 0.65; }
  .header-meta-row strong { opacity: 1; color: #fff; }
  .header-right {}
  .voxx-logo-box {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 10px;
    padding: 10px 18px;
    text-align: center;
  }
  .voxx-logo-text { font-size: 18px; font-weight: 900; color: #fff; letter-spacing: -1px; }
  .voxx-logo-sub { font-size: 8px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.5); margin-top: 2px; }

  /* ══ BANNER PORTAL ══ */
  .portal-banner {
    background: linear-gradient(90deg, #166534 0%, #15803d 60%, #16a34a 100%);
    padding: 10px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    text-decoration: none;
    cursor: pointer;
  }
  .portal-banner-left { display: flex; align-items: center; gap: 10px; }
  .portal-banner-icon { font-size: 16px; }
  .portal-banner-title { font-size: 11px; font-weight: 800; color: #fff; letter-spacing: 0.5px; text-transform: uppercase; }
  .portal-banner-sub { font-size: 9px; color: rgba(255,255,255,0.7); margin-top: 1px; }
  .portal-banner-btn { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); border-radius: 20px; padding: 5px 14px; font-size: 9px; font-weight: 700; color: #fff; white-space: nowrap; }

  /* ══ BODY ══ */
  .body { padding: 16px 32px; }

  /* ══ RESUMO EXECUTIVO ══ */
  .resumo-box {
    background: #f8fafc;
    border-left: 3px solid #0f172a;
    border-radius: 0 8px 8px 0;
    padding: 10px 14px;
    margin-bottom: 14px;
  }
  .resumo-label { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 4px; }
  .resumo-text { font-size: 11px; color: #334155; line-height: 1.65; }

  /* ══ KPI CARDS ══ */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
  .kpi-card {
    border-radius: 10px;
    padding: 10px 12px;
    text-align: center;
    border: 1px solid #e2e8f0;
    background: #fff;
  }
  .kpi-card.dark { background: #0f172a; border-color: #0f172a; }
  .kpi-value { font-size: 16px; font-weight: 900; color: #0f172a; line-height: 1; }
  .kpi-card.dark .kpi-value { color: #fff; }
  .kpi-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-top: 3px; }
  .kpi-card.dark .kpi-label { color: rgba(255,255,255,0.6); }
  .kpi-context { font-size: 9px; color: #94a3b8; margin-top: 2px; }
  .kpi-card.dark .kpi-context { color: rgba(255,255,255,0.4); }

  /* ══ STATUS CAMPANHAS ══ */
  .campanhas-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
  .campanha-card { border-radius: 10px; border: 1px solid #e2e8f0; padding: 12px 14px; }
  .campanha-header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #f1f5f9; }
  .campanha-icon { font-size: 13px; }
  .campanha-name { font-size: 11px; font-weight: 800; }
  .campanha-name.meta { color: #1d4ed8; }
  .campanha-name.google { color: #7c3aed; }
  .campanha-badge { margin-left: auto; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 20px; }
  .badge-ok { background: #dcfce7; color: #166534; }
  .badge-warn { background: #fef3c7; color: #92400e; }
  .badge-err { background: #fee2e2; color: #991b1b; }
  .badge-na { background: #f1f5f9; color: #475569; }
  .campanha-rows {}
  .campanha-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: 10px; border-bottom: 1px solid #f8fafc; }
  .campanha-row:last-child { border-bottom: none; }
  .campanha-row-label { color: #64748b; }
  .campanha-row-value { font-weight: 700; color: #1e293b; }

  /* ══ ATIVIDADE OPERACIONAL ══ */
  .atividade-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
  .atividade-card { border-radius: 10px; border: 1px solid #e2e8f0; padding: 12px 14px; background: #fff; }
  .atividade-title { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; }
  .atividade-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #f8fafc; font-size: 10px; }
  .atividade-row:last-child { border-bottom: none; }
  .atividade-row-label { color: #475569; }
  .atividade-row-value { font-weight: 800; color: #0f172a; font-size: 13px; }
  .atividade-row-value.green { color: #16a34a; }
  .atividade-row-value.blue { color: #2563eb; }
  .atividade-row-value.orange { color: #ea580c; }

  /* ══ PRÓXIMOS PASSOS ══ */
  .passos-box { background: #f8fafc; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; }
  .passos-label { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 8px; }
  .passo-item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 5px; font-size: 10px; color: #334155; }
  .passo-bullet { width: 5px; height: 5px; border-radius: 50%; background: #7c3aed; flex-shrink: 0; margin-top: 4px; }

  /* ══ BLOCO FINAL PORTAL ══ */
  .portal-final {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .portal-final-left { flex: 1; }
  .portal-final-title { font-size: 11px; font-weight: 800; color: #fff; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .portal-final-item { font-size: 9px; color: rgba(255,255,255,0.6); margin-bottom: 3px; }
  .portal-final-item span { color: #4ade80; font-weight: 700; margin-right: 4px; }
  .portal-final-btn { background: linear-gradient(135deg, #16a34a, #15803d); border-radius: 20px; padding: 8px 18px; font-size: 10px; font-weight: 800; color: #fff; white-space: nowrap; text-decoration: none; display: block; text-align: center; }

  /* ══ RODAPÉ ══ */
  .footer { background: #f1f5f9; border-top: 1px solid #e2e8f0; padding: 8px 32px; display: flex; justify-content: space-between; align-items: center; }
  .footer-brand { font-size: 10px; font-weight: 700; color: #475569; }
  .footer-sub { font-size: 9px; color: #94a3b8; }
  .footer-date { font-size: 9px; color: #94a3b8; text-align: right; }

  /* ══ SECTION HEADING ══ */
  .section-heading { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
  .section-heading::after { content: ""; flex: 1; height: 1px; background: #e2e8f0; }

  @media print {
    @page { size: A4; margin: 0; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    a { text-decoration: none; }
  }
</style>
</head>
<body>

<!-- ══ 1. HEADER INSTITUCIONAL ══ -->
<div class="header">
  <div class="header-left">
    <div class="header-eyebrow">Portal Voxx · Relatório Executivo</div>
    <div class="header-title">Report Diário Voxx</div>
    <div class="header-subtitle">Visão executiva de performance e operação</div>
    <div class="header-meta">
      <div class="header-meta-row"><strong>Cliente:</strong> ${cliente.nome}</div>
      <div class="header-meta-row"><strong>Data:</strong> ${dataFmt}</div>
    </div>
  </div>
  <div class="header-right">
    <div class="voxx-logo-box">
      <div class="voxx-logo-text">VOXX</div>
      <div class="voxx-logo-sub">Gestão de Performance</div>
    </div>
  </div>
</div>

<!-- ══ 2. BANNER PORTAL VOXX ══ -->
<a href="https://portal-voxx.com/" class="portal-banner">
  <div class="portal-banner-left">
    <div class="portal-banner-icon">📊</div>
    <div>
      <div class="portal-banner-title">Acompanhe os dados completos no Portal Voxx</div>
      <div class="portal-banner-sub">Métricas detalhadas, histórico de ações e acompanhamento completo da sua unidade.</div>
    </div>
  </div>
  <div class="portal-banner-btn">ACESSAR PORTAL →</div>
</a>

<div class="body">

<!-- ══ 3. RESUMO EXECUTIVO ══ -->
<div class="section-heading">Resumo Executivo</div>
<div class="resumo-box">
  <div class="resumo-label">Situação da unidade · ${dataFmt}</div>
  <div class="resumo-text">${resumoFinal}</div>
</div>

<!-- ══ 4. INDICADORES PRINCIPAIS ══ -->
<div class="section-heading">Indicadores Principais</div>
<div class="kpi-grid">
  <div class="kpi-card dark">
    <div class="kpi-value">${meta?.new_messaging_connections || meta?.messaging_conversations || 0}</div>
    <div class="kpi-label">Leads Gerados</div>
    <div class="kpi-context">Meta Ads</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-value">R$ ${fmtBrl0(totalInvest)}</div>
    <div class="kpi-label">Investimento em Mídia</div>
    <div class="kpi-context">Meta + Google</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-value">R$ ${fmtBrl(cplMedio)}</div>
    <div class="kpi-label">CPL Médio</div>
    <div class="kpi-context">Custo por lead</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-value">${google?.conversions || 0}</div>
    <div class="kpi-label">Conversões Google</div>
    <div class="kpi-context">Google Ads</div>
  </div>
</div>

<!-- ══ 5. STATUS DAS CAMPANHAS ══ -->
<div class="section-heading">Status das Campanhas</div>
<div class="campanhas-grid">
  <div class="campanha-card">
    <div class="campanha-header">
      <span class="campanha-icon">🎯</span>
      <span class="campanha-name meta">Meta Ads</span>
      ${meta ? `<span class="campanha-badge ${meta.classificacao === "ELITE" || meta.classificacao === "SAUDÁVEL" ? "badge-ok" : meta.classificacao === "CRÍTICO" || meta.classificacao === "ALERTA" ? "badge-err" : "badge-warn"}">${meta.classificacao || "—"}</span>` : `<span class="campanha-badge badge-na">Sem dados</span>`}
    </div>
    <div class="campanha-rows">
      <div class="campanha-row"><span class="campanha-row-label">Investimento</span><span class="campanha-row-value">R$ ${fmtBrl0(meta?.amount_spent)}</span></div>
      <div class="campanha-row"><span class="campanha-row-label">Leads</span><span class="campanha-row-value">${meta?.new_messaging_connections || meta?.messaging_conversations || 0}</span></div>
      <div class="campanha-row"><span class="campanha-row-label">CPL</span><span class="campanha-row-value">R$ ${fmtBrl(meta?.cost_per_messaging)}</span></div>
      <div class="campanha-row"><span class="campanha-row-label">Frequência</span><span class="campanha-row-value">${meta?.frequency ? meta.frequency.toFixed(1) + "x" : "—"}</span></div>
    </div>
  </div>
  <div class="campanha-card">
    <div class="campanha-header">
      <span class="campanha-icon">🔍</span>
      <span class="campanha-name google">Google Ads</span>
      ${google?.health_status ? `<span class="campanha-badge ${google.health_status === "Saudável" ? "badge-ok" : google.health_status === "Crítico" || google.health_status === "Urgente" ? "badge-err" : "badge-warn"}">${google.health_status}</span>` : `<span class="campanha-badge badge-na">Sem dados</span>`}
    </div>
    <div class="campanha-rows">
      <div class="campanha-row"><span class="campanha-row-label">Conversões</span><span class="campanha-row-value">${google?.conversions || 0}</span></div>
      <div class="campanha-row"><span class="campanha-row-label">Custo por conversão</span><span class="campanha-row-value">R$ ${fmtBrl(google?.cost_per_conversion)}</span></div>
      <div class="campanha-row"><span class="campanha-row-label">Cliques</span><span class="campanha-row-value">${google?.clicks || 0}</span></div>
      <div class="campanha-row"><span class="campanha-row-label">CPC médio</span><span class="campanha-row-value">R$ ${fmtBrl(google?.avg_cpc)}</span></div>
    </div>
  </div>
</div>

<!-- ══ 6. ATIVIDADE OPERACIONAL ══ -->
<div class="section-heading">Atividade Operacional</div>
<div class="atividade-grid">
  <div class="atividade-card">
    <div class="atividade-title">Demandas</div>
    <div class="atividade-row">
      <span class="atividade-row-label">Concluídas no mês</span>
      <span class="atividade-row-value green">${demandasConcluidas.length}</span>
    </div>
    <div class="atividade-row">
      <span class="atividade-row-label">Em andamento</span>
      <span class="atividade-row-value blue">${demandasEmAndamento.length}</span>
    </div>
    ${demandasAguardando.length > 0 ? `
    <div class="atividade-row">
      <span class="atividade-row-label">Aguardando cliente</span>
      <span class="atividade-row-value orange">${demandasAguardando.length}</span>
    </div>` : ""}
  </div>
  <div class="atividade-card">
    <div class="atividade-title">Otimizações & Plano</div>
    <div class="atividade-row">
      <span class="atividade-row-label">Otimizações aplicadas</span>
      <span class="atividade-row-value orange">${otimizacoesMes.length}</span>
    </div>
    ${plano ? `
    <div class="atividade-row">
      <span class="atividade-row-label">Ações do plano concluídas</span>
      <span class="atividade-row-value green">${itensConcluidos.length}</span>
    </div>
    <div class="atividade-row">
      <span class="atividade-row-label">Ações em andamento</span>
      <span class="atividade-row-value blue">${itensAndamento.length}</span>
    </div>` : `
    <div class="atividade-row">
      <span class="atividade-row-label">Monitoramento ativo</span>
      <span class="atividade-row-value" style="color:#16a34a;font-size:10px;font-weight:700;">✔ Online</span>
    </div>`}
  </div>
</div>

<!-- ══ 7. PRÓXIMOS PASSOS ══ -->
<div class="section-heading">Próximos Passos</div>
<div class="passos-box">
  <div class="passos-label">Direcionamento da gestão</div>
  ${proximosPassosDinamicos.map(p => `
  <div class="passo-item">
    <div class="passo-bullet"></div>
    <span>${p}</span>
  </div>`).join("")}
</div>

<!-- ══ 8. BLOCO FINAL PORTAL VOXX ══ -->
<div class="portal-final">
  <div class="portal-final-left">
    <div class="portal-final-title">Relatório completo disponível no Portal Voxx</div>
    <div class="portal-final-item"><span>✔</span> Histórico completo de demandas e entregas</div>
    <div class="portal-final-item"><span>✔</span> Todas as otimizações realizadas no período</div>
    <div class="portal-final-item"><span>✔</span> Evolução detalhada das campanhas</div>
    <div class="portal-final-item"><span>✔</span> Plano de ação com prazos e responsáveis</div>
    <div class="portal-final-item"><span>✔</span> Indicadores atualizados em tempo real</div>
  </div>
  <a href="https://portal-voxx.com/" class="portal-final-btn">ACESSAR<br/>PORTAL VOXX</a>
</div>

</div><!-- /body -->

<!-- ══ 9. RODAPÉ PROFISSIONAL ══ -->
<div class="footer">
  <div>
    <div class="footer-brand">Portal Voxx</div>
    <div class="footer-sub">Relatório executivo gerado automaticamente</div>
  </div>
  <div class="footer-date">${dataFmt} às ${format(new Date(), "HH:mm")}</div>
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

          {/* ── PERFORMANCE DE MÍDIA ── */}
          {meta ? (
            <div className="rounded-xl border border-slate-100 p-4">
              <SectionHeader label="2" title="Performance de Mídia — Meta Ads" />
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
              <SectionHeader label="2" title="Performance de Mídia — Meta Ads" />
              Dados de Meta Ads não vinculados a este cliente.
            </div>
          )}

          {/* ── META ADS ONTEM ── */}
          {radar && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">
              <SectionHeader label="2 · Radar" title="Meta Ads — Ontem" />
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

          {/* ── GOOGLE ADS ── */}
          {google ? (
            <div className="rounded-xl border border-slate-100 p-4">
              <SectionHeader label="2" title="Performance de Mídia — Google Ads" />
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
              <SectionHeader label="2" title="Performance de Mídia — Google Ads" />
              Dados de Google Ads não vinculados a este cliente.
            </div>
          )}

          {/* ── DEMANDAS E EXECUÇÃO ── */}
          <div className="rounded-xl border border-slate-100 p-4">
            <SectionHeader label="3" title="Demandas e Execução" />
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

          {/* ── OTIMIZAÇÕES APLICADAS ── */}
          {otimizacoesMes.length > 0 && (
            <div className="rounded-xl border border-orange-100 bg-orange-50/30 p-4">
              <SectionHeader label="3b" title="Otimizações aplicadas no período" />
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

          {/* ── PLANO DE AÇÃO ── */}
          {plano && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-4">
              <SectionHeader label="4" title="Plano de Ação" />

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

          {/* ── AÇÕES DA VOXX ── */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <SectionHeader label="5" title="Ações realizadas pela Voxx" />
            <p className="text-sm text-slate-600 leading-relaxed">{acoesVoxxTexto}</p>
          </div>

          {/* ── PRÓXIMOS PASSOS ── */}
          <div className="rounded-xl border border-slate-100 p-4">
            <SectionHeader label="6" title="Próximos Passos" />
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