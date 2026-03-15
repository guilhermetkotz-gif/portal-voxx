import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Plus, FileText, Copy, Pencil, Trash2,
  CheckCircle2, Clock, AlertTriangle, ExternalLink, Building2, Users, PlusCircle
} from "lucide-react";
import NovaAcaoModal from "@/components/planoacao/NovaAcaoModal";
import NovaDemandaPlanoModal from "@/components/planoacao/NovaDemandaPlanoModal";
import PrazoIndicador, { calcularIndicadorPrazo } from "@/components/planoacao/PrazoIndicador";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusAcaoColor = {
  "Nova": "bg-slate-100 text-slate-600",
  "Em andamento": "bg-yellow-100 text-yellow-700",
  "Concluída": "bg-green-100 text-green-700",
};

const statusPlanoColor = {
  "Aberto": "bg-blue-100 text-blue-700",
  "Em andamento": "bg-yellow-100 text-yellow-700",
  "Concluído": "bg-green-100 text-green-700",
  "Arquivado": "bg-slate-100 text-slate-500",
};

export default function PlanoDeAcaoDetalhe({ user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const planoId = urlParams.get("id");

  const [novaAcaoOpen, setNovaAcaoOpen] = useState(false);
  const [itemParaEditar, setItemParaEditar] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [novaDemandaItem, setNovaDemandaItem] = useState(null); // item para criar demanda vinculada

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
    const concluidas = itens.filter((i) => i.status_acao === "Concluída").length;
    const emAndamento = itens.filter((i) => i.status_acao === "Em andamento").length;
    const atraso = itens.filter((i) => calcularIndicadorPrazo(i.prazo, i.status_acao) === "atraso").length;
    const aVencer = itens.filter((i) => calcularIndicadorPrazo(i.prazo, i.status_acao) === "a_vencer").length;
    return { total, concluidas, emAndamento, atraso, aVencer };
  }, [itens]);

  const handleCopiarResumo = () => {
    if (!plano) return;
    const linhas = [
      `📋 *PLANO DE AÇÃO - ${plano.cliente_nome?.toUpperCase()}*`,
      ``,
      `🎯 *Objetivo:* ${plano.objetivo_geral}`,
      `📅 *Data de abertura:* ${plano.data_abertura ? format(parseISO(plano.data_abertura), "dd/MM/yyyy", { locale: ptBR }) : "—"}`,
      `📊 *Status:* ${plano.status_plano}`,
      ``,
      `📌 *Resumo das ações:*`,
      `• Total: ${stats.total}`,
      `• Concluídas: ${stats.concluidas}`,
      `• Em andamento: ${stats.emAndamento}`,
      `• A vencer: ${stats.aVencer}`,
      `• Em atraso: ${stats.atraso}`,
      ``,
      `*Ações:*`,
      ...itens.map((item, idx) => {
        const prazo = item.prazo ? format(parseISO(item.prazo), "dd/MM/yyyy", { locale: ptBR }) : "—";
        const indicador = calcularIndicadorPrazo(item.prazo, item.status_acao);
        const emoji = indicador === "atraso" ? "🔴" : indicador === "a_vencer" ? "🟡" : indicador === "concluida" ? "✅" : "🔵";
        return `${idx + 1}. ${emoji} *${item.acao_proposta}*\n   Problema: ${item.problema_identificado}\n   Responsável: ${item.responsavel} | Prazo: ${prazo} | Status: ${item.status_acao}`;
      }),
    ];
    navigator.clipboard.writeText(linhas.join("\n"));
    toast.success("Resumo copiado para a área de transferência!");
  };

  const handleGerarPDF = () => {
    if (!plano) return;
    const conteudo = `
      <html>
      <head>
        <meta charset="UTF-8"/>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #1e293b; }
          h1 { color: #6d28d9; font-size: 22px; margin-bottom: 4px; }
          h2 { font-size: 16px; color: #334155; margin-bottom: 2px; }
          .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
          .objetivo { background: #f5f3ff; border-left: 4px solid #7c3aed; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #6d28d9; color: white; padding: 10px 8px; text-align: left; }
          td { padding: 9px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          tr:nth-child(even) td { background: #f8fafc; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
          .ok { background: #dbeafe; color: #1d4ed8; }
          .vencer { background: #fef3c7; color: #92400e; }
          .atraso { background: #fee2e2; color: #991b1b; }
          .concluida { background: #dcfce7; color: #166534; }
          .nova { background: #f1f5f9; color: #475569; }
          .andamento { background: #fef3c7; color: #92400e; }
          .footer { margin-top: 32px; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        </style>
      </head>
      <body>
        <h1>📋 Plano de Ação</h1>
        <h2>${plano.titulo_plano}</h2>
        <div class="meta">
          <strong>Cliente:</strong> ${plano.cliente_nome} &nbsp;|&nbsp;
          <strong>Data:</strong> ${plano.data_abertura ? format(parseISO(plano.data_abertura), "dd/MM/yyyy") : "—"} &nbsp;|&nbsp;
          <strong>Status:</strong> ${plano.status_plano}
        </div>
        <div class="objetivo"><strong>🎯 Objetivo geral:</strong><br/>${plano.objetivo_geral}</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Problema identificado</th>
              <th>Ação proposta</th>
              <th>Responsável</th>
              <th>Prazo</th>
              <th>Status</th>
              <th>Prazo</th>
            </tr>
          </thead>
          <tbody>
            ${itens.map((item, idx) => {
              const prazo = item.prazo ? format(parseISO(item.prazo), "dd/MM/yyyy") : "—";
              const ind = calcularIndicadorPrazo(item.prazo, item.status_acao);
              const indLabel = { ok: "Prazo OK", a_vencer: "A vencer", atraso: "Em atraso", concluida: "Concluída", sem_prazo: "—" }[ind];
              const indClass = { ok: "ok", a_vencer: "vencer", atraso: "atraso", concluida: "concluida", sem_prazo: "" }[ind];
              const statusClass = { "Nova": "nova", "Em andamento": "andamento", "Concluída": "concluida" }[item.status_acao] || "";
              return `<tr>
                <td>${idx + 1}</td>
                <td>${item.problema_identificado}</td>
                <td>${item.acao_proposta}</td>
                <td>${item.responsavel}</td>
                <td>${prazo}</td>
                <td><span class="badge ${statusClass}">${item.status_acao}</span></td>
                <td><span class="badge ${indClass}">${indLabel}</span></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
        <div class="footer">Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} · Voxx Marketing</div>
      </body>
      </html>
    `;
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/PlanoDeAcao")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-500 font-medium">{plano.cliente_nome}</span>
            <Badge className={cn("text-xs", statusPlanoColor[plano.status_plano])}>
              {plano.status_plano}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-0.5">{plano.titulo_plano}</h1>
          <p className="text-slate-500 text-sm mt-1">{plano.objetivo_geral}</p>
          <p className="text-xs text-slate-400 mt-1">
            Aberto em {plano.data_abertura ? format(parseISO(plano.data_abertura), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "—"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          <Select value={plano.status_plano} onValueChange={(v) => updatePlanoMutation.mutate({ id: plano.id, data: { status_plano: v } })}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Aberto", "Em andamento", "Concluído", "Arquivado"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleCopiarResumo}>
            <Copy className="w-4 h-4 mr-1" /> Copiar Resumo
          </Button>
          <Button variant="outline" size="sm" onClick={handleGerarPDF}>
            <FileText className="w-4 h-4 mr-1" /> Gerar PDF
          </Button>
          <Button size="sm" className="bg-violet-600 hover:bg-violet-700" onClick={() => { setItemParaEditar(null); setNovaAcaoOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Nova Ação
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-slate-700" },
          { label: "Em andamento", value: stats.emAndamento, color: "text-yellow-600" },
          { label: "Concluídas", value: stats.concluidas, color: "text-green-600" },
          { label: "A vencer", value: stats.aVencer, color: "text-yellow-500" },
          { label: "Em atraso", value: stats.atraso, color: "text-red-600" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Barra de progresso */}
      {stats.total > 0 && (
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Progresso</span>
            <span>{stats.concluidas}/{stats.total} concluídas ({Math.round((stats.concluidas / stats.total) * 100)}%)</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${stats.total > 0 ? (stats.concluidas / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Lista de ações */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ações do Plano</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingItens ? (
            <div className="text-center py-8 text-slate-400">Carregando...</div>
          ) : itens.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Plus className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nenhuma ação cadastrada ainda.</p>
              <Button className="mt-3 bg-violet-600 hover:bg-violet-700" size="sm" onClick={() => { setItemParaEditar(null); setNovaAcaoOpen(true); }}>
                Adicionar primeira ação
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {itens.map((item, idx) => {
                const demanda = item.demanda_id_relacionada ? demandas.find((d) => d.id === item.demanda_id_relacionada) : null;
                return (
                  <div key={item.id} className={cn(
                    "border rounded-xl p-4 hover:shadow-sm transition-shadow",
                    item.status_acao === "Concluída" ? "border-green-100 bg-green-50/30" : "border-slate-100 bg-white"
                  )}>
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-bold text-slate-400 mt-0.5 w-5 shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-medium mb-0.5">Problema:</p>
                            <p className="text-sm text-slate-700">{item.problema_identificado}</p>
                            <p className="text-xs text-slate-500 font-medium mt-2 mb-0.5">Ação:</p>
                            <p className="text-sm font-semibold text-slate-900">{item.acao_proposta}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!item.demanda_id_relacionada && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                                onClick={() => setNovaDemandaItem(item)}
                              >
                                <PlusCircle className="w-3.5 h-3.5 mr-1" />
                                Nova Demanda
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setItemParaEditar(item); setNovaAcaoOpen(true); }}>
                              <Pencil className="w-3.5 h-3.5 text-slate-400" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmDelete(item.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mt-3 flex-wrap text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            {item.responsavel === "Unidade" ? <Building2 className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                            {item.responsavel}
                          </span>
                          <span>📅 {item.prazo ? format(parseISO(item.prazo), "dd/MM/yyyy") : "Sem prazo"}</span>
                          <Badge className={cn("text-xs", statusAcaoColor[item.status_acao])}>{item.status_acao}</Badge>
                          <PrazoIndicador prazo={item.prazo} status={item.status_acao} />
                          {demanda && (
                            <span className="flex items-center gap-1 text-violet-600">
                              <ExternalLink className="w-3 h-3" />
                              Demanda: {demanda.titulo}
                            </span>
                          )}
                        </div>

                        {item.observacoes && (
                          <p className="mt-2 text-xs text-slate-400 italic">{item.observacoes}</p>
                        )}
                      </div>
                    </div>

                    {/* Confirm delete */}
                    {confirmDelete === item.id && (
                      <div className="mt-3 pt-3 border-t border-red-100 flex items-center gap-2 text-sm">
                        <span className="text-red-600 flex-1">Confirmar exclusão desta ação?</span>
                        <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
                        <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteItemMutation.mutate(item.id)}>
                          Excluir
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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