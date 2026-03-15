import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Copy, X, Pencil, Check } from "lucide-react";
import { calcularIndicadorPrazo } from "@/components/planoacao/PrazoIndicador";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusDemandaLabel = {
  recebida: "Recebida", em_triagem: "Em triagem", programada: "Programada",
  em_execucao: "Em execução", aguardando_cliente: "Aguardando cliente",
  em_revisao: "Em revisão", concluida: "Concluída",
};

export default function ReportModal({ cliente, report, dataReport, demandas, plano, planoItens, meta, google, user, onClose, onSave }) {
  const [destaque, setDestaque] = useState(report?.destaque_positivo || "");
  const [atencao, setAtencao] = useState(report?.ponto_atencao || "");
  const [proxPassos, setProxPassos] = useState(report?.proximos_passos || "");
  const [editando, setEditando] = useState(false);

  const dataFmt = dataReport ? format(parseISO(dataReport), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "—";
  const dataGeracao = format(new Date(), "dd/MM/yyyy 'às' HH:mm");

  // ── Dados derivados ──
  const demandasCliente = demandas.filter((d) => d.cliente_id === cliente.id);
  const demandasAbertas = demandasCliente.filter((d) => !["concluida"].includes(d.status));
  const demandasConcluidas = demandasCliente.filter((d) => d.status === "concluida");
  const demandasAguardando = demandasCliente.filter((d) => d.status === "aguardando_cliente");
  const demandasExecucao = demandasCliente.filter((d) => d.status === "em_execucao");

  const itensPlano = plano ? planoItens.filter((i) => i.plano_id === plano.id) : [];
  const itensAndamento = itensPlano.filter((i) => i.status_acao === "Em andamento").length;
  const itensConcluidos = itensPlano.filter((i) => i.status_acao === "Concluída").length;
  const itensAtraso = itensPlano.filter((i) => calcularIndicadorPrazo(i.prazo, i.status_acao) === "atraso").length;
  const itensAVencer = itensPlano.filter((i) => calcularIndicadorPrazo(i.prazo, i.status_acao) === "a_vencer").length;

  // ── Destaque e alerta automáticos (se não editados) ──
  const destaqueAuto = (() => {
    if (meta?.classificacao === "ELITE" || meta?.classificacao === "SAUDÁVEL") return `Meta Ads com performance ${meta.classificacao.toLowerCase()} — campanhas operando dentro da meta.`;
    if (itensConcluidos > 0) return `${itensConcluidos} ação(ões) do plano de ação concluída(s) no período.`;
    if (demandasConcluidas.length > 0) return `${demandasConcluidas.length} demanda(s) concluída(s) no período.`;
    return "Campanhas e operação em acompanhamento contínuo.";
  })();

  const atencaoAuto = (() => {
    if (meta?.classificacao === "CRÍTICO") return `Meta Ads com classificação CRÍTICA — atenção imediata necessária.`;
    if (itensAtraso > 0) return `${itensAtraso} ação(ões) do plano com prazo em atraso.`;
    if (demandasAguardando.length > 0) return `${demandasAguardando.length} demanda(s) aguardando retorno do cliente.`;
    return "Nenhum ponto crítico identificado no momento.";
  })();

  const proxPassosAuto = [
    demandasExecucao.length > 0 ? `Seguir com execução das ${demandasExecucao.length} demanda(s) em andamento.` : null,
    itensAndamento > 0 ? `Acompanhar as ${itensAndamento} ação(ões) em andamento no plano de ação.` : null,
    "Manter monitoramento contínuo das campanhas e otimizar conforme necessário.",
  ].filter(Boolean).join("\n");

  const handleSave = () => {
    onSave({
      destaque_positivo: destaque || destaqueAuto,
      ponto_atencao: atencao || atencaoAuto,
      proximos_passos: proxPassos || proxPassosAuto,
    });
    setEditando(false);
    toast.success("Report salvo!");
  };

  const handleCopiarResumo = () => {
    const texto = [
      `📄 *Resumo Diário Voxx — ${cliente.nome}*`,
      `📅 Data: ${dataFmt}`,
      ``,
      `📌 *Destaque do dia:*`,
      destaque || destaqueAuto,
      ``,
      `⚠️ *Ponto de atenção:*`,
      atencao || atencaoAuto,
      ``,
      `📊 *Meta Ads*`,
      meta
        ? `Investimento: R$ ${(meta.amount_spent || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\nLeads/Conversas: ${meta.messaging_conversations || 0}\nStatus: ${meta.classificacao || "—"}`
        : "Dados não disponíveis no momento.",
      ``,
      `🔎 *Google Ads*`,
      google
        ? `Investimento: R$ ${(google.cost || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\nConversões: ${google.conversions || 0}\nCusto/Conversão: R$ ${(google.cost_per_conversion || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
        : "Dados não disponíveis no momento.",
      ``,
      `🧩 *Demandas*`,
      `• Em andamento: ${demandasExecucao.length}`,
      `• Concluídas: ${demandasConcluidas.length}`,
      `• Aguardando retorno: ${demandasAguardando.length}`,
      ``,
      plano ? [
        `📋 *Plano de Ação*`,
        `• Total: ${itensPlano.length} ações`,
        `• Em andamento: ${itensAndamento}`,
        `• Concluídas: ${itensConcluidos}`,
        itensAtraso > 0 ? `• Em atraso: ${itensAtraso}` : null,
        ``,
      ].filter(Boolean).join("\n") : "",
      `➡️ *Próximos passos*`,
      proxPassos || proxPassosAuto,
      ``,
      `_Gerado em ${dataGeracao} · Portal Voxx_`,
    ].filter((l) => l !== "").join("\n");

    navigator.clipboard.writeText(texto);
    toast.success("Resumo copiado!");
  };

  const handleGerarPDF = () => {
    const destaqueTexto = destaque || destaqueAuto;
    const atencaoTexto = atencao || atencaoAuto;
    const proxPassosTexto = proxPassos || proxPassosAuto;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Report Diário — ${cliente.nome}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #1e293b; font-size: 13px; line-height: 1.6; }
    .page { max-width: 780px; margin: 0 auto; }

    /* CAPA */
    .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 36px 40px 30px; }
    .brand { font-size: 10px; letter-spacing: 2.5px; text-transform: uppercase; opacity: 0.6; margin-bottom: 10px; }
    .doc-title { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
    .doc-subtitle { font-size: 13px; opacity: 0.75; margin-top: 4px; }
    .doc-info { margin-top: 16px; display: flex; gap: 24px; flex-wrap: wrap; }
    .doc-info-item label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.55; display: block; margin-bottom: 2px; }
    .doc-info-item span { font-size: 14px; font-weight: 600; }

    /* SEÇÕES */
    .section { padding: 24px 40px; border-bottom: 1px solid #f1f5f9; }
    .section:last-child { border-bottom: none; }
    .section-label { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #94a3b8; margin-bottom: 12px; }
    .section-title { font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 12px; }

    /* RESUMO EXECUTIVO */
    .exec-text { font-size: 13px; color: #475569; line-height: 1.7; margin-bottom: 14px; }
    .highlight-box { border-left: 3px solid #22c55e; background: #f0fdf4; padding: 10px 14px; border-radius: 0 6px 6px 0; margin-bottom: 10px; }
    .highlight-box .hl-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #16a34a; margin-bottom: 3px; }
    .highlight-box .hl-text { font-size: 13px; color: #166534; }
    .atencao-box { border-left: 3px solid #f59e0b; background: #fffbeb; padding: 10px 14px; border-radius: 0 6px 6px 0; margin-bottom: 10px; }
    .atencao-box .hl-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #d97706; margin-bottom: 3px; }
    .atencao-box .hl-text { font-size: 13px; color: #92400e; }

    /* GRID DE MÉTRICAS */
    .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; }
    .metric-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; text-align: center; }
    .metric-value { font-size: 22px; font-weight: 700; color: #1e293b; }
    .metric-label { font-size: 10px; color: #64748b; margin-top: 2px; }
    .metric-card.ok .metric-value { color: #16a34a; }
    .metric-card.warn .metric-value { color: #d97706; }
    .metric-card.bad .metric-value { color: #dc2626; }

    /* BADGE */
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-yellow { background: #fef3c7; color: #92400e; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .badge-blue { background: #dbeafe; color: #1d4ed8; }
    .badge-slate { background: #f1f5f9; color: #475569; }

    /* LISTA */
    .item-list { list-style: none; }
    .item-list li { padding: 8px 0; border-bottom: 1px solid #f8fafc; font-size: 13px; color: #334155; display: flex; align-items: flex-start; gap: 8px; }
    .item-list li:last-child { border-bottom: none; }
    .item-list li::before { content: "•"; color: #7c3aed; font-weight: 700; margin-top: 1px; }

    /* PRÓXIMOS PASSOS */
    .steps-list { }
    .steps-list p { font-size: 13px; color: #475569; margin-bottom: 6px; padding-left: 16px; position: relative; }
    .steps-list p::before { content: "→"; position: absolute; left: 0; color: #7c3aed; font-weight: 700; }

    /* RODAPÉ */
    .footer { background: #f8fafc; padding: 14px 40px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #e2e8f0; }

    @media print {
      .page { max-width: 100%; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- CAPA -->
  <div class="header">
    <div class="brand">Portal Voxx · Report Diário</div>
    <div class="doc-title">Resumo Diário Voxx</div>
    <div class="doc-subtitle">Visão geral das ações e resultados do dia</div>
    <div class="doc-info">
      <div class="doc-info-item"><label>Cliente</label><span>${cliente.nome}</span></div>
      <div class="doc-info-item"><label>Data</label><span>${dataFmt}</span></div>
      <div class="doc-info-item"><label>Gerado em</label><span>${dataGeracao}</span></div>
    </div>
  </div>

  <!-- BLOCO 1 — RESUMO EXECUTIVO -->
  <div class="section">
    <div class="section-label">Bloco 1</div>
    <div class="section-title">Resumo Executivo</div>
    <p class="exec-text">Hoje seguimos com a gestão ativa das campanhas e das ações operacionais da conta. Monitoramos o desempenho das campanhas, andamento das demandas e evolução das ações estratégicas definidas para o cliente. O foco permanece em manter estabilidade nas campanhas, otimizar resultados e avançar nas entregas previstas no planejamento.</p>
    <div class="highlight-box">
      <div class="hl-label">✅ Destaque positivo do dia</div>
      <div class="hl-text">${destaqueTexto}</div>
    </div>
    <div class="atencao-box">
      <div class="hl-label">⚠️ Ponto de atenção</div>
      <div class="hl-text">${atencaoTexto}</div>
    </div>
  </div>

  <!-- BLOCO 2 — META ADS -->
  <div class="section">
    <div class="section-label">Bloco 2</div>
    <div class="section-title">Meta Ads — Visão Geral</div>
    ${meta ? `
    <p class="exec-text">As campanhas no Meta Ads seguem em monitoramento constante com ajustes contínuos para melhoria de performance e estabilidade dos resultados.</p>
    <div class="metrics-grid">
      <div class="metric-card"><div class="metric-value">R$ ${(meta.amount_spent || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</div><div class="metric-label">Investimento</div></div>
      <div class="metric-card ok"><div class="metric-value">${meta.messaging_conversations || meta.new_messaging_connections || 0}</div><div class="metric-label">Leads / Conversas</div></div>
      <div class="metric-card"><div class="metric-value">R$ ${(meta.cost_per_messaging || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div><div class="metric-label">Custo por lead</div></div>
    </div>
    <div>Status geral: <span class="badge ${meta.classificacao === "ELITE" || meta.classificacao === "SAUDÁVEL" ? "badge-green" : meta.classificacao === "CRÍTICO" || meta.classificacao === "ALERTA" ? "badge-red" : "badge-yellow"}">${meta.classificacao || "—"}</span></div>
    ${meta.main_issue ? `<p style="margin-top:8px; font-size:12px; color:#64748b;">Principal alerta: ${meta.main_issue}</p>` : ""}
    ` : `<p class="exec-text" style="color:#94a3b8;">Dados de Meta Ads não disponíveis para este cliente no momento.</p>`}
  </div>

  <!-- BLOCO 3 — GOOGLE ADS -->
  <div class="section">
    <div class="section-label">Bloco 3</div>
    <div class="section-title">Google Ads — Visão Geral</div>
    ${google ? `
    <p class="exec-text">As campanhas no Google Ads seguem em acompanhamento diário com foco em eficiência de conversão e estabilidade de custos.</p>
    <div class="metrics-grid">
      <div class="metric-card"><div class="metric-value">R$ ${(google.cost || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</div><div class="metric-label">Investimento</div></div>
      <div class="metric-card ok"><div class="metric-value">${google.conversions || 0}</div><div class="metric-label">Conversões</div></div>
      <div class="metric-card"><div class="metric-value">R$ ${(google.cost_per_conversion || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div><div class="metric-label">Custo/Conversão</div></div>
    </div>
    ${google.health_status ? `<div>Status: <span class="badge ${google.health_status === "Saudável" ? "badge-green" : google.health_status === "Crítico" || google.health_status === "Urgente" ? "badge-red" : "badge-yellow"}">${google.health_status}</span></div>` : ""}
    ${google.optimization_score ? `<p style="margin-top:8px; font-size:12px; color:#64748b;">Optimization Score: ${google.optimization_score}%</p>` : ""}
    ` : `<p class="exec-text" style="color:#94a3b8;">Dados de Google Ads não disponíveis para este cliente no momento.</p>`}
  </div>

  <!-- BLOCO 4 — DEMANDAS -->
  <div class="section">
    <div class="section-label">Bloco 4</div>
    <div class="section-title">Demandas Operacionais</div>
    <p class="exec-text">Seguimos com as demandas operacionais em andamento conforme planejamento.</p>
    <div class="metrics-grid">
      <div class="metric-card ${demandasExecucao.length > 0 ? "ok" : ""}"><div class="metric-value">${demandasExecucao.length}</div><div class="metric-label">Em andamento</div></div>
      <div class="metric-card ok"><div class="metric-value">${demandasConcluidas.length}</div><div class="metric-label">Concluídas</div></div>
      <div class="metric-card ${demandasAguardando.length > 0 ? "warn" : ""}"><div class="metric-value">${demandasAguardando.length}</div><div class="metric-label">Aguardando retorno</div></div>
    </div>
    ${demandasExecucao.slice(0, 3).length > 0 ? `
    <ul class="item-list">
      ${demandasExecucao.slice(0, 3).map(d => `<li>${d.titulo} <span class="badge badge-yellow" style="margin-left:4px;">${statusDemandaLabel[d.status] || d.status}</span></li>`).join("")}
    </ul>` : ""}
  </div>

  <!-- BLOCO 5 — PLANO DE AÇÃO -->
  ${plano ? `
  <div class="section">
    <div class="section-label">Bloco 5</div>
    <div class="section-title">Plano de Ação</div>
    <p class="exec-text">O plano de ação do cliente segue ativo com acompanhamento das ações definidas.</p>
    <div class="metrics-grid">
      <div class="metric-card"><div class="metric-value">${itensPlano.length}</div><div class="metric-label">Total de ações</div></div>
      <div class="metric-card"><div class="metric-value">${itensAndamento}</div><div class="metric-label">Em andamento</div></div>
      <div class="metric-card ok"><div class="metric-value">${itensConcluidos}</div><div class="metric-label">Concluídas</div></div>
    </div>
    ${itensAtraso > 0 ? `<p style="color:#dc2626; font-size:12px; margin-top:4px;">⚠️ ${itensAtraso} ação(ões) com prazo em atraso</p>` : ""}
    ${itensAVencer > 0 ? `<p style="color:#d97706; font-size:12px; margin-top:4px;">🕐 ${itensAVencer} ação(ões) a vencer em breve</p>` : ""}
  </div>
  ` : ""}

  <!-- BLOCO 6 — PRÓXIMOS PASSOS -->
  <div class="section">
    <div class="section-label">Bloco 6</div>
    <div class="section-title">Próximos Passos</div>
    <p class="exec-text">As próximas ações seguem focadas em evolução contínua das campanhas e execução das demandas planejadas.</p>
    <div class="steps-list">
      ${(proxPassosTexto).split("\n").map(s => s.trim()).filter(Boolean).map(s => `<p>${s}</p>`).join("")}
    </div>
  </div>

  <!-- RODAPÉ -->
  <div class="footer">
    <strong>Relatório gerado automaticamente pelo Portal Voxx</strong> · ${dataGeracao}
  </div>

</div>
</body>
</html>`;

    const janela = window.open("", "_blank");
    janela.document.write(html);
    janela.document.close();
    janela.print();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>📄 Report — {cliente.nome}</span>
            <span className="text-sm font-normal text-slate-500">{dataFmt}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* RESUMO EXECUTIVO */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Resumo Executivo</p>
            <p className="text-sm text-slate-600 mb-3">Seguimos com a gestão ativa das campanhas e das ações operacionais. O foco permanece em manter estabilidade nas campanhas, otimizar resultados e avançar nas entregas planejadas.</p>

            <div className="space-y-2">
              <div>
                <Label className="text-xs text-green-600 font-semibold">✅ Destaque positivo do dia</Label>
                {editando ? (
                  <Textarea value={destaque} onChange={(e) => setDestaque(e.target.value)} placeholder={destaqueAuto} className="mt-1 text-sm min-h-[60px]" />
                ) : (
                  <p className="text-sm text-slate-700 mt-1 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{destaque || destaqueAuto}</p>
                )}
              </div>
              <div>
                <Label className="text-xs text-amber-600 font-semibold">⚠️ Ponto de atenção</Label>
                {editando ? (
                  <Textarea value={atencao} onChange={(e) => setAtencao(e.target.value)} placeholder={atencaoAuto} className="mt-1 text-sm min-h-[60px]" />
                ) : (
                  <p className="text-sm text-slate-700 mt-1 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{atencao || atencaoAuto}</p>
                )}
              </div>
            </div>
          </div>

          {/* META ADS */}
          {meta && (
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">📊 Meta Ads</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Investimento", value: `R$ ${(meta.amount_spent || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` },
                  { label: "Leads", value: meta.messaging_conversations || meta.new_messaging_connections || 0 },
                  { label: "CPL", value: `R$ ${(meta.cost_per_messaging || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-lg p-2">
                    <p className="text-base font-bold text-slate-800">{value}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                Status: <Badge className={cn("text-xs", meta.classificacao === "ELITE" || meta.classificacao === "SAUDÁVEL" ? "bg-green-100 text-green-700" : meta.classificacao === "CRÍTICO" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700")}>{meta.classificacao || "—"}</Badge>
                {meta.main_issue && <span className="text-slate-400">· {meta.main_issue}</span>}
              </div>
            </div>
          )}

          {/* GOOGLE ADS */}
          {google && (
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">🔎 Google Ads</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Investimento", value: `R$ ${(google.cost || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` },
                  { label: "Conversões", value: google.conversions || 0 },
                  { label: "Custo/Conv.", value: `R$ ${(google.cost_per_conversion || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-lg p-2">
                    <p className="text-base font-bold text-slate-800">{value}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              {google.health_status && (
                <div className="mt-2 text-xs text-slate-500">
                  Status: <Badge className={cn("text-xs", google.health_status === "Saudável" ? "bg-green-100 text-green-700" : google.health_status === "Crítico" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700")}>{google.health_status}</Badge>
                </div>
              )}
            </div>
          )}

          {/* DEMANDAS */}
          <div className="rounded-xl border border-slate-100 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">🧩 Demandas</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Em andamento", value: demandasExecucao.length, color: "text-blue-700" },
                { label: "Concluídas", value: demandasConcluidas.length, color: "text-green-700" },
                { label: "Aguardando", value: demandasAguardando.length, color: "text-amber-700" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-2">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            {demandasExecucao.slice(0, 3).map((d) => (
              <div key={d.id} className="mt-2 flex items-center gap-2 text-xs text-slate-600 border-t border-slate-50 pt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                {d.titulo}
              </div>
            ))}
          </div>

          {/* PLANO DE AÇÃO */}
          {plano && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-3">📋 Plano de Ação</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "Total", value: itensPlano.length },
                  { label: "Andamento", value: itensAndamento },
                  { label: "Concluídas", value: itensConcluidos },
                  { label: "Atraso", value: itensAtraso },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-lg p-2 border border-violet-100">
                    <p className="text-lg font-bold text-violet-700">{value}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PRÓXIMOS PASSOS */}
          <div className="rounded-xl border border-slate-100 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">➡️ Próximos Passos</p>
            {editando ? (
              <Textarea value={proxPassos} onChange={(e) => setProxPassos(e.target.value)} placeholder={proxPassosAuto} className="text-sm min-h-[80px]" />
            ) : (
              <div className="space-y-1">
                {(proxPassos || proxPassosAuto).split("\n").filter(Boolean).map((s, i) => (
                  <p key={i} className="text-sm text-slate-700 flex items-start gap-2">
                    <span className="text-violet-500 font-bold mt-0.5 shrink-0">→</span> {s}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* AÇÕES */}
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