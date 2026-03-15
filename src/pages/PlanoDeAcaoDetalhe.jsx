import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Plus, FileText, Copy, Pencil, Trash2,
  ExternalLink, Building2, Users, PlusCircle,
  CheckCircle2, Clock, AlertTriangle, TrendingUp, ListTodo
} from "lucide-react";
import NovaAcaoModal from "@/components/planoacao/NovaAcaoModal";
import NovaDemandaPlanoModal from "@/components/planoacao/NovaDemandaPlanoModal";
import PrazoIndicador, { calcularIndicadorPrazo } from "@/components/planoacao/PrazoIndicador";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusAcaoColor = {
  "Nova": "bg-blue-50 text-blue-700 border-blue-200",
  "Em andamento": "bg-amber-50 text-amber-700 border-amber-200",
  "Concluída": "bg-green-50 text-green-700 border-green-200",
};

const statusPlanoColor = {
  "Aberto": "bg-blue-100 text-blue-700",
  "Em andamento": "bg-amber-100 text-amber-700",
  "Concluído": "bg-green-100 text-green-700",
  "Arquivado": "bg-slate-100 text-slate-500",
};

const FILTROS = ["Todas", "Nova", "Em andamento", "Concluída", "A vencer", "Em atraso"];

export default function PlanoDeAcaoDetalhe({ user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const planoId = urlParams.get("id");

  const [novaAcaoOpen, setNovaAcaoOpen] = useState(false);
  const [itemParaEditar, setItemParaEditar] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [novaDemandaItem, setNovaDemandaItem] = useState(null);
  const [filtroAtivo, setFiltroAtivo] = useState("Todas");

  const { data: plano, isLoading: loadingPlano } = useQuery({
    queryKey: ["planoDetalhe", planoId],
    queryFn: () => base44.entities.PlanoDeAcao.filter({ id: planoId }),
    enabled: !!planoId,
    select: (data) => data[0],
  });

  const { data: itens = [], isLoading: loadingItens } = useQuery({
    queryKey: ["planoItens", planoId],
    queryFn: () => base44.entities.PlanoDeAcaoItem.filter({ plano_id: planoId }, "-created_date", 200),
    enabled: !!planoId,
  });

  const { data: demandas = [] } = useQuery({
    queryKey: ["demandas"],
    queryFn: () => base44.entities.Demanda.list("-created_date", 500),
    staleTime: 2 * 60 * 1000,
  });

  const updatePlanoMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PlanoDeAcao.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planoDetalhe", planoId] }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id) => base44.entities.PlanoDeAcaoItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planoItens", planoId] });
      queryClient.invalidateQueries({ queryKey: ["planosDeAcao"] });
      setConfirmDelete(null);
      toast.success("Ação removida");
    },
  });

  const stats = useMemo(() => {
    const total = itens.length;
    const novas = itens.filter((i) => i.status_acao === "Nova").length;
    const concluidas = itens.filter((i) => i.status_acao === "Concluída").length;
    const emAndamento = itens.filter((i) => i.status_acao === "Em andamento").length;
    const atraso = itens.filter((i) => calcularIndicadorPrazo(i.prazo, i.status_acao) === "atraso").length;
    const aVencer = itens.filter((i) => calcularIndicadorPrazo(i.prazo, i.status_acao) === "a_vencer").length;
    const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;
    return { total, novas, concluidas, emAndamento, atraso, aVencer, pct };
  }, [itens]);

  const itensFiltrados = useMemo(() => {
    if (filtroAtivo === "Todas") return itens;
    if (filtroAtivo === "A vencer") return itens.filter((i) => calcularIndicadorPrazo(i.prazo, i.status_acao) === "a_vencer");
    if (filtroAtivo === "Em atraso") return itens.filter((i) => calcularIndicadorPrazo(i.prazo, i.status_acao) === "atraso");
    return itens.filter((i) => i.status_acao === filtroAtivo);
  }, [itens, filtroAtivo]);

  const handleCopiarResumo = () => {
    if (!plano) return;
    const hoje = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
    const dataAbertura = plano.data_abertura ? format(parseISO(plano.data_abertura), "dd/MM/yyyy", { locale: ptBR }) : "—";

    const indicadorLabels = { ok: "Prazo OK", a_vencer: "A vencer", atraso: "Em atraso", concluida: "Concluída", sem_prazo: "Não informado" };
    const listaAcoes = itens.map((item, idx) => {
      const prazoFmt = item.prazo ? format(parseISO(item.prazo), "dd/MM/yyyy", { locale: ptBR }) : "Não informado";
      const indicador = calcularIndicadorPrazo(item.prazo, item.status_acao);
      return [
        `${idx + 1}. ${item.acao_proposta}`,
        `Problema: ${item.problema_identificado || "Não informado"}`,
        `Responsável: ${item.responsavel || "Não informado"}`,
        `Prazo: ${prazoFmt}`,
        `Status: ${item.status_acao}`,
        `Indicador de prazo: ${indicadorLabels[indicador]}`,
      ].join("\n");
    }).join("\n\n");

    const texto = [
      `📋 *Plano de Ação — ${plano.cliente_nome}*`,
      ``,
      `🎯 *Objetivo:*`,
      plano.objetivo_geral,
      ``,
      `📅 *Abertura do plano:*`,
      dataAbertura,
      ``,
      `📊 *Resumo atual:*`,
      `• Total de ações: ${stats.total}`,
      `• Novas: ${stats.novas}`,
      `• Em andamento: ${stats.emAndamento}`,
      `• Concluídas: ${stats.concluidas}`,
      `• A vencer: ${stats.aVencer}`,
      `• Em atraso: ${stats.atraso}`,
      ``,
      `🧩 *Ações:*`,
      ``,
      listaAcoes,
      ``,
      `Status geral do plano: *${plano.status_plano}*`,
      ``,
      `_Gerado em ${hoje} · Portal Voxx_`,
    ].join("\n");

    navigator.clipboard.writeText(texto);
    toast.success("Resumo copiado para a área de transferência!");
  };

  const handleGerarPDF = () => {
    if (!plano) return;
    const dataAbertura = plano.data_abertura ? format(parseISO(plano.data_abertura), "dd/MM/yyyy", { locale: ptBR }) : "—";
    const dataGeracao = format(new Date(), "dd/MM/yyyy 'às' HH:mm");

    const indicadorLabel = { ok: "Prazo OK", a_vencer: "A vencer", atraso: "Em atraso", concluida: "Concluída", sem_prazo: "Sem prazo" };
    const indicadorClass = { ok: "badge-ok", a_vencer: "badge-vencer", atraso: "badge-atraso", concluida: "badge-concluida", sem_prazo: "badge-sem-prazo" };
    const statusClass = { "Nova": "badge-nova", "Em andamento": "badge-andamento", "Concluída": "badge-concluida" };

    const acoesHTML = itens.map((item, idx) => {
      const prazoFmt = item.prazo ? format(parseISO(item.prazo), "dd/MM/yyyy") : "—";
      const ind = calcularIndicadorPrazo(item.prazo, item.status_acao);
      const demanda = item.demanda_id_relacionada ? demandas.find((d) => d.id === item.demanda_id_relacionada) : null;
      return `
        <div class="acao-card ${item.status_acao === "Concluída" ? "acao-concluida" : ""}">
          <div class="acao-header">
            <span class="acao-numero">Ação #${idx + 1}</span>
            <div class="acao-badges">
              <span class="badge ${statusClass[item.status_acao] || ""}">${item.status_acao}</span>
              <span class="badge ${indicadorClass[ind] || ""}">${indicadorLabel[ind] || "—"}</span>
            </div>
          </div>
          <div class="acao-grid">
            <div class="acao-field">
              <span class="field-label">Problema identificado</span>
              <span class="field-value">${item.problema_identificado}</span>
            </div>
            <div class="acao-field acao-field-full">
              <span class="field-label">Ação proposta</span>
              <span class="field-value field-destaque">${item.acao_proposta}</span>
            </div>
            <div class="acao-field">
              <span class="field-label">Responsável</span>
              <span class="field-value">${item.responsavel}</span>
            </div>
            <div class="acao-field">
              <span class="field-label">Data de abertura</span>
              <span class="field-value">${item.data_abertura ? format(parseISO(item.data_abertura), "dd/MM/yyyy") : "—"}</span>
            </div>
            <div class="acao-field">
              <span class="field-label">Prazo</span>
              <span class="field-value">${prazoFmt}</span>
            </div>
            <div class="acao-field">
              <span class="field-label">Demanda vinculada</span>
              <span class="field-value">${demanda ? demanda.titulo : "Não vinculada"}</span>
            </div>
            ${item.observacoes ? `<div class="acao-field acao-field-full"><span class="field-label">Observações</span><span class="field-value field-obs">${item.observacoes}</span></div>` : ""}
          </div>
        </div>
      `;
    }).join("");

    const pctConclusao = stats.pct;

    const conteudo = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Plano de Ação — ${plano.cliente_nome}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f8fafc; color: #1e293b; font-size: 13px; }
    .page { max-width: 800px; margin: 0 auto; background: #fff; }

    /* CABEÇALHO */
    .header { background: linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%); color: white; padding: 32px 40px 28px; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .brand { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.8; margin-bottom: 8px; }
    .doc-title { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }
    .doc-date { font-size: 11px; opacity: 0.75; margin-top: 4px; }
    .cliente-nome { font-size: 15px; font-weight: 600; opacity: 0.95; margin-top: 12px; }

    /* BLOCO 1 — INFO GERAL */
    .section { padding: 28px 40px; }
    .section-title { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #7c3aed; margin-bottom: 16px; border-bottom: 2px solid #ede9fe; padding-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .info-item { }
    .info-item.full { grid-column: 1 / -1; }
    .info-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 600; margin-bottom: 3px; }
    .info-value { font-size: 13px; color: #1e293b; font-weight: 500; }
    .objetivo-box { background: #f5f3ff; border-left: 3px solid #7c3aed; padding: 12px 16px; border-radius: 0 6px 6px 0; font-size: 13px; color: #3730a3; line-height: 1.6; }

    /* BLOCO 2 — RESUMO */
    .resumo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
    .resumo-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; text-align: center; }
    .resumo-card .valor { font-size: 28px; font-weight: 700; line-height: 1; margin-bottom: 4px; }
    .resumo-card .rotulo { font-size: 11px; color: #64748b; }
    .rc-total .valor { color: #1e293b; }
    .rc-nova .valor { color: #2563eb; }
    .rc-andamento .valor { color: #d97706; }
    .rc-concluida .valor { color: #16a34a; }
    .rc-vencer .valor { color: #ea580c; }
    .rc-atraso .valor { color: #dc2626; }

    /* BARRA DE PROGRESSO */
    .progresso-wrap { margin-top: 8px; }
    .progresso-label { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 6px; }
    .progresso-bar { height: 8px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
    .progresso-fill { height: 100%; background: linear-gradient(90deg, #16a34a, #22c55e); border-radius: 99px; }

    /* BLOCO 3 — AÇÕES */
    .acoes-section { padding: 0 40px 32px; }
    .acao-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin-bottom: 14px; page-break-inside: avoid; }
    .acao-card.acao-concluida { border-color: #bbf7d0; background: #f0fdf4; }
    .acao-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .acao-numero { font-size: 12px; font-weight: 700; color: #7c3aed; letter-spacing: 0.5px; }
    .acao-badges { display: flex; gap: 6px; flex-wrap: wrap; }
    .acao-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .acao-field { }
    .acao-field-full { grid-column: 1 / -1; }
    .field-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; font-weight: 600; display: block; margin-bottom: 2px; }
    .field-value { font-size: 12px; color: #334155; display: block; }
    .field-destaque { font-weight: 600; color: #1e293b; font-size: 13px; }
    .field-obs { color: #64748b; font-style: italic; }

    /* BADGES */
    .badge { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 10px; font-weight: 700; letter-spacing: 0.3px; }
    .badge-nova { background: #dbeafe; color: #1d4ed8; }
    .badge-andamento { background: #fef3c7; color: #92400e; }
    .badge-concluida { background: #dcfce7; color: #166534; }
    .badge-ok { background: #dbeafe; color: #1d4ed8; }
    .badge-vencer { background: #ffedd5; color: #c2410c; }
    .badge-atraso { background: #fee2e2; color: #991b1b; }
    .badge-sem-prazo { background: #f1f5f9; color: #64748b; }

    /* RODAPÉ */
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 40px; text-align: center; color: #94a3b8; font-size: 11px; }
    .footer strong { color: #64748b; }

    @media print {
      body { background: #fff; }
      .page { max-width: 100%; }
      .acao-card { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- CABEÇALHO -->
    <div class="header">
      <div class="header-top">
        <div>
          <div class="brand">Portal Voxx · Plano de Ação</div>
          <div class="doc-title">${plano.titulo_plano}</div>
          <div class="cliente-nome">📍 ${plano.cliente_nome}</div>
        </div>
        <div style="text-align:right;">
          <div class="doc-date">Gerado em ${dataGeracao}</div>
          <div style="margin-top:8px;">
            <span class="badge" style="background:rgba(255,255,255,0.25); color:white; font-size:11px;">${plano.status_plano}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- BLOCO 1 — INFORMAÇÕES GERAIS -->
    <div class="section">
      <div class="section-title">Informações Gerais</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Cliente</div>
          <div class="info-value">${plano.cliente_nome}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Data de abertura</div>
          <div class="info-value">${dataAbertura}</div>
        </div>
        <div class="info-item full">
          <div class="info-label">Objetivo geral</div>
          <div class="objetivo-box">${plano.objetivo_geral}</div>
        </div>
        ${plano.descricao_resumida ? `<div class="info-item full"><div class="info-label">Descrição</div><div class="info-value">${plano.descricao_resumida}</div></div>` : ""}
        ${plano.observacoes ? `<div class="info-item full"><div class="info-label">Observações</div><div class="info-value" style="color:#64748b;">${plano.observacoes}</div></div>` : ""}
      </div>
    </div>

    <!-- BLOCO 2 — RESUMO EXECUTIVO -->
    <div class="section" style="padding-top:0;">
      <div class="section-title">Resumo Executivo</div>
      <div class="resumo-grid">
        <div class="resumo-card rc-total"><div class="valor">${stats.total}</div><div class="rotulo">Total de ações</div></div>
        <div class="resumo-card rc-nova"><div class="valor">${stats.novas}</div><div class="rotulo">Novas</div></div>
        <div class="resumo-card rc-andamento"><div class="valor">${stats.emAndamento}</div><div class="rotulo">Em andamento</div></div>
        <div class="resumo-card rc-concluida"><div class="valor">${stats.concluidas}</div><div class="rotulo">Concluídas</div></div>
        <div class="resumo-card rc-vencer"><div class="valor">${stats.aVencer}</div><div class="rotulo">A vencer</div></div>
        <div class="resumo-card rc-atraso"><div class="valor">${stats.atraso}</div><div class="rotulo">Em atraso</div></div>
      </div>
      <div class="progresso-wrap">
        <div class="progresso-label"><span>Progresso geral</span><span><strong>${stats.concluidas}</strong> de ${stats.total} concluídas · <strong>${pctConclusao}%</strong></span></div>
        <div class="progresso-bar"><div class="progresso-fill" style="width:${pctConclusao}%"></div></div>
      </div>
    </div>

    <!-- BLOCO 3 — LISTA DAS AÇÕES -->
    <div class="acoes-section">
      <div class="section-title" style="margin-bottom:16px; border-bottom:2px solid #ede9fe; padding-bottom:8px; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#7c3aed;">
        Lista das Ações (${itens.length})
      </div>
      ${acoesHTML || '<p style="color:#94a3b8; text-align:center; padding:32px 0;">Nenhuma ação cadastrada.</p>'}
    </div>

    <!-- RODAPÉ -->
    <div class="footer">
      <strong>Documento gerado automaticamente pelo Portal Voxx</strong><br/>
      Data/hora: ${dataGeracao}
    </div>

  </div>
</body>
</html>`;

    const janela = window.open("", "_blank");
    janela.document.write(conteudo);
    janela.document.close();
    janela.print();
  };

  if (!planoId || loadingPlano) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" /></div>;
  }

  if (!plano) {
    return <div className="text-center py-16 text-slate-400">Plano não encontrado.</div>;
  }

  const dataAbertura = plano.data_abertura ? format(parseISO(plano.data_abertura), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "—";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ── BLOCO 1: CABEÇALHO ── */}
      <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10 shrink-0" onClick={() => navigate("/PlanoDeAcao")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-violet-200 text-sm font-medium">{plano.cliente_nome}</span>
                <Badge className={cn("text-xs border-0", statusPlanoColor[plano.status_plano])}>{plano.status_plano}</Badge>
              </div>
              <h1 className="text-xl font-bold leading-tight">{plano.titulo_plano}</h1>
              <p className="text-violet-100 text-sm mt-1 leading-relaxed max-w-xl">{plano.objetivo_geral}</p>
              <p className="text-violet-300 text-xs mt-2">Aberto em {dataAbertura}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Select value={plano.status_plano} onValueChange={(v) => updatePlanoMutation.mutate({ id: plano.id, data: { status_plano: v } })}>
              <SelectTrigger className="w-36 h-8 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Aberto", "Em andamento", "Concluído", "Arquivado"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-8" onClick={handleCopiarResumo}>
              <Copy className="w-3.5 h-3.5 mr-1" /> Copiar Resumo
            </Button>
            <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-8" onClick={handleGerarPDF}>
              <FileText className="w-3.5 h-3.5 mr-1" /> Gerar PDF
            </Button>
            <Button size="sm" className="bg-white text-violet-700 hover:bg-violet-50 h-8 font-semibold" onClick={() => { setItemParaEditar(null); setNovaAcaoOpen(true); }}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Nova Ação
            </Button>
          </div>
        </div>
      </div>

      {/* ── BLOCO 2: CARDS DE RESUMO ── */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-slate-700", bg: "bg-slate-50", icon: <ListTodo className="w-4 h-4 text-slate-400" /> },
          { label: "Novas", value: stats.novas, color: "text-blue-700", bg: "bg-blue-50", icon: <Clock className="w-4 h-4 text-blue-400" /> },
          { label: "Andamento", value: stats.emAndamento, color: "text-amber-700", bg: "bg-amber-50", icon: <TrendingUp className="w-4 h-4 text-amber-400" /> },
          { label: "Concluídas", value: stats.concluidas, color: "text-green-700", bg: "bg-green-50", icon: <CheckCircle2 className="w-4 h-4 text-green-400" /> },
          { label: "A vencer", value: stats.aVencer, color: "text-orange-600", bg: "bg-orange-50", icon: <AlertTriangle className="w-4 h-4 text-orange-400" /> },
          { label: "Em atraso", value: stats.atraso, color: "text-red-700", bg: "bg-red-50", icon: <AlertTriangle className="w-4 h-4 text-red-400" /> },
        ].map(({ label, value, color, bg, icon }) => (
          <Card key={label} className="col-span-1">
            <CardContent className="p-3 text-center">
              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center mx-auto mb-1.5", bg)}>{icon}</div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500 leading-tight">{label}</p>
            </CardContent>
          </Card>
        ))}
        {/* % Conclusão */}
        <Card className="col-span-3 md:col-span-1">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-violet-700">{stats.pct}%</p>
            <p className="text-xs text-slate-500">Conclusão</p>
            <div className="mt-1.5 w-full bg-slate-100 rounded-full h-1.5">
              <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${stats.pct}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── BLOCO 3+4: FILTROS + LISTA ── */}
      <div>
        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {FILTROS.map((f) => (
            <button
              key={f}
              onClick={() => setFiltroAtivo(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                filtroAtivo === f
                  ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-600"
              )}
            >
              {f}
              {f !== "Todas" && (
                <span className="ml-1.5 opacity-70">
                  ({f === "A vencer" ? stats.aVencer : f === "Em atraso" ? stats.atraso : f === "Novas" || f === "Nova" ? stats.novas : f === "Em andamento" ? stats.emAndamento : f === "Concluída" ? stats.concluidas : itens.length})
                </span>
              )}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400">{itensFiltrados.length} ação(ões) exibida(s)</span>
        </div>

        {/* Lista de Ações */}
        {loadingItens ? (
          <div className="text-center py-12 text-slate-400">Carregando...</div>
        ) : itensFiltrados.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100">
            <ListTodo className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p className="font-medium">Nenhuma ação para este filtro.</p>
            {filtroAtivo === "Todas" && (
              <Button className="mt-4 bg-violet-600 hover:bg-violet-700" size="sm" onClick={() => { setItemParaEditar(null); setNovaAcaoOpen(true); }}>
                Adicionar primeira ação
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {itensFiltrados.map((item, idx) => {
              const demanda = item.demanda_id_relacionada ? demandas.find((d) => d.id === item.demanda_id_relacionada) : null;
              const indicador = calcularIndicadorPrazo(item.prazo, item.status_acao);
              const isConcluida = item.status_acao === "Concluída";

              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-2xl border p-5 transition-shadow hover:shadow-md",
                    isConcluida ? "border-green-100 bg-green-50/40" : indicador === "atraso" ? "border-red-100 bg-red-50/20" : "border-slate-100 bg-white"
                  )}
                >
                  {/* Cabeçalho do card */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                        isConcluida ? "bg-green-100 text-green-700" : "bg-violet-100 text-violet-700"
                      )}>{itens.indexOf(item) + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className={cn("text-xs font-semibold", statusAcaoColor[item.status_acao])}>{item.status_acao}</Badge>
                          <PrazoIndicador prazo={item.prazo} status={item.status_acao} />
                          {item.responsavel === "Unidade" ? (
                            <span className="flex items-center gap-1 text-xs text-slate-500"><Building2 className="w-3 h-3" /> Unidade</span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-violet-600"><Users className="w-3 h-3" /> Agência Voxx</span>
                          )}
                        </div>
                        <p className="text-base font-semibold text-slate-900 leading-snug">{item.acao_proposta}</p>
                      </div>
                    </div>
                    {/* Ações do card */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 px-2 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                        onClick={() => setNovaDemandaItem(item)}
                      >
                        <PlusCircle className="w-3.5 h-3.5 mr-1" /> Nova Demanda
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setItemParaEditar(item); setNovaAcaoOpen(true); }}>
                        <Pencil className="w-3.5 h-3.5 text-slate-400" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmDelete(item.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </Button>
                    </div>
                  </div>

                  {/* Detalhes */}
                  <div className="mt-3 ml-10 space-y-2">
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">Problema identificado</p>
                      <p className="text-sm text-slate-700">{item.problema_identificado}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500 pt-1">
                      <span>📅 Prazo: <strong>{item.prazo ? format(parseISO(item.prazo), "dd/MM/yyyy") : "Sem prazo"}</strong></span>
                      {item.data_abertura && (
                        <span>🗓 Abertura: <strong>{format(parseISO(item.data_abertura), "dd/MM/yyyy")}</strong></span>
                      )}
                      {demanda ? (
                        <span className="flex items-center gap-1 text-violet-600 font-medium">
                          <ExternalLink className="w-3 h-3" />
                          Demanda: {demanda.titulo}
                          <Badge className="text-xs bg-violet-50 text-violet-700 border-violet-200 ml-1">{demanda.status}</Badge>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Sem demanda vinculada</span>
                      )}
                    </div>
                    {item.observacoes && (
                      <p className="text-xs text-slate-400 italic border-l-2 border-slate-200 pl-3">{item.observacoes}</p>
                    )}
                  </div>

                  {/* Confirm delete */}
                  {confirmDelete === item.id && (
                    <div className="mt-3 pt-3 border-t border-red-100 flex items-center gap-2 text-sm">
                      <span className="text-red-600 flex-1">Confirmar exclusão desta ação?</span>
                      <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
                      <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteItemMutation.mutate(item.id)}>Excluir</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NovaAcaoModal
        open={novaAcaoOpen}
        onOpenChange={setNovaAcaoOpen}
        planoId={planoId}
        clienteId={plano?.cliente_id}
        itemParaEditar={itemParaEditar}
        onSaved={() => setItemParaEditar(null)}
      />

      <NovaDemandaPlanoModal
        open={!!novaDemandaItem}
        onClose={() => setNovaDemandaItem(null)}
        clienteId={plano?.cliente_id}
        clienteNome={plano?.cliente_nome}
        planoAcaoItemId={novaDemandaItem?.id}
      />
    </div>
  );
}