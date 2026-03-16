import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isToday, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText, Copy, RefreshCw, CheckCircle2, Clock, AlertTriangle,
  TrendingUp, Users, BarChart3, ClipboardList, Search, Send
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { calcularIndicadorPrazo } from "@/components/planoacao/PrazoIndicador";
import ReportModal from "@/components/reportdiario/ReportModal";
import ReportOverview from "@/components/reportdiario/ReportOverview";

export default function ReportDiario({ user }) {
  const queryClient = useQueryClient();
  const hoje = format(new Date(), "yyyy-MM-dd");

  const [dataFiltro, setDataFiltro] = useState(hoje);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [reportAberto, setReportAberto] = useState(null); // { cliente, report }
  const [overviewAberto, setOverviewAberto] = useState(null); // { cliente }

  // ── Data fetching ──
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: () => base44.entities.Cliente.filter({ status: "ativo" }, "nome", 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ["reportsDiarios", dataFiltro],
    queryFn: () => base44.entities.ReportDiario.filter({ data_report: dataFiltro }, "-created_date", 500),
    staleTime: 30 * 1000,
  });

  const { data: demandas = [] } = useQuery({
    queryKey: ["demandas"],
    queryFn: () => base44.entities.Demanda.list("-created_date", 500),
    staleTime: 2 * 60 * 1000,
  });

  const { data: planosAtivos = [] } = useQuery({
    queryKey: ["planosDeAcao"],
    queryFn: () => base44.entities.PlanoDeAcao.filter({ status_plano: "Em andamento" }, "-created_date", 200),
    staleTime: 2 * 60 * 1000,
  });

  const { data: contasMeta = [] } = useQuery({
    queryKey: ["contasMeta"],
    queryFn: () => base44.entities.ContaMetaAds.list("-created_date", 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: radarMeta = [] } = useQuery({
    queryKey: ["radarMeta"],
    queryFn: () => base44.entities.RadarMetaData.list("-created_date", 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: contasGoogle = [] } = useQuery({
    queryKey: ["contasGoogle"],
    queryFn: () => base44.entities.GoogleAdsAccount.list("-created_date", 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: planoItens = [] } = useQuery({
    queryKey: ["planoItensAll"],
    queryFn: () => base44.entities.PlanoDeAcaoItem.list("-created_date", 1000),
    staleTime: 2 * 60 * 1000,
  });

  const { data: otimizacoesMeta = [] } = useQuery({
    queryKey: ["otimizacoesMeta"],
    queryFn: () => base44.entities.MetaAdsOtimizacao.list("-data_acao", 1000),
    staleTime: 5 * 60 * 1000,
  });

  // ── Mutations ──
  const upsertReportMutation = useMutation({
    mutationFn: async ({ clienteId, clienteNome, data, patch }) => {
      const existing = reports.find((r) => r.cliente_id === clienteId);
      if (existing) {
        return base44.entities.ReportDiario.update(existing.id, patch);
      } else {
        return base44.entities.ReportDiario.create({
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          data_report: data,
          ...patch,
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reportsDiarios", dataFiltro] }),
  });

  const toggleEnviado = (cliente) => {
    const report = reports.find((r) => r.cliente_id === cliente.id);
    const novoEstado = !report?.enviado;
    upsertReportMutation.mutate({
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      data: dataFiltro,
      patch: {
        enviado: novoEstado,
        enviado_em: novoEstado ? new Date().toISOString() : null,
        enviado_por: novoEstado ? user?.email : null,
      },
    });
  };

  // ── Helpers ──
  const getReportCliente = (clienteId) => reports.find((r) => r.cliente_id === clienteId);

  const getDemandasCliente = (clienteId) => demandas.filter((d) => d.cliente_id === clienteId);

  const getPlanoCliente = (clienteId) => planosAtivos.find((p) => p.cliente_id === clienteId);

  const getMetaCliente = (cliente) => {
    const nome = (cliente.meta_ads_account_name || cliente.nome || "").toLowerCase();
    return contasMeta.find((c) => (c.account_name || "").toLowerCase().includes(nome) || nome.includes((c.account_name || "").toLowerCase()));
  };

  const getRadarCliente = (cliente) => {
    const nome = (cliente.meta_ads_account_name || cliente.nome || "").toLowerCase();
    return radarMeta.find((r) => (r.account_name || "").toLowerCase().includes(nome) || nome.includes((r.account_name || "").toLowerCase()));
  };

  const getGoogleCliente = (cliente) => {
    const nome = (cliente.google_ads_account_name || cliente.nome || "").toLowerCase();
    return contasGoogle.find((c) => (c.account_name || "").toLowerCase().includes(nome) || nome.includes((c.unidade_nome || "").toLowerCase()));
  };

  const getItensPlano = (planoId) => planoItens.filter((i) => i.plano_id === planoId);

  // ── Stats do painel ──
  const painelStats = useMemo(() => {
    const enviados = reports.filter((r) => r.enviado).length;
    const comAlerta = clientes.filter((c) => {
      const meta = getMetaCliente(c);
      return meta?.classificacao === "CRÍTICO" || meta?.classificacao === "ALERTA";
    }).length;
    const comPlano = planosAtivos.length;
    const comDemandas = clientes.filter((c) => getDemandasCliente(c.id).some((d) => ["recebida", "em_execucao", "em_triagem"].includes(d.status))).length;
    return { enviados, pendentes: clientes.length - enviados, comAlerta, comPlano, comDemandas };
  }, [reports, clientes, contasMeta, planosAtivos, demandas]);

  // ── Filtro de clientes ──
  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      const matchBusca = !busca || c.nome.toLowerCase().includes(busca.toLowerCase());
      const report = getReportCliente(c.id);
      const matchStatus =
        statusFiltro === "todos" ||
        (statusFiltro === "enviado" && report?.enviado) ||
        (statusFiltro === "pendente" && !report?.enviado);
      return matchBusca && matchStatus;
    });
  }, [clientes, busca, statusFiltro, reports]);

  // ── Dados do overview (para usar tanto no overview quanto no modal) ──
  const overviewData = overviewAberto ? (() => {
    const ov = overviewAberto;
    const meta = getMetaCliente(ov.cliente);
    const radar = getRadarCliente(ov.cliente);
    const google = getGoogleCliente(ov.cliente);
    const plano = getPlanoCliente(ov.cliente.id);
    const report = getReportCliente(ov.cliente.id);
    const otimizacoesCliente = otimizacoesMeta.filter((o) => {
      return meta && (o.account_name || "").toLowerCase() === (meta.account_name || "").toLowerCase();
    });
    return { ov, meta, radar, google, plano, report, otimizacoesCliente };
  })() : null;

  // ── Se overview aberto (e modal fechado), mostrar overview ──
  if (overviewAberto && !reportAberto) {
    const { ov, meta, radar, google, plano, report, otimizacoesCliente } = overviewData;
    return (
      <ReportOverview
        cliente={ov.cliente}
        report={report}
        dataReport={dataFiltro}
        demandas={demandas}
        plano={plano || null}
        planoItens={planoItens}
        meta={meta}
        radar={radar}
        google={google}
        otimizacoes={otimizacoesCliente}
        user={user}
        onBack={() => setOverviewAberto(null)}
        onAbrirModal={() => setReportAberto({ cliente: ov.cliente, report })}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ── CABEÇALHO ── */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-slate-400 text-xs font-medium tracking-widest uppercase mb-1">Portal Voxx</p>
            <h1 className="text-2xl font-bold">📄 Report Diário</h1>
            <p className="text-slate-300 text-sm mt-1">Visão geral das ações e resultados por cliente</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              type="date"
              value={dataFiltro}
              onChange={(e) => setDataFiltro(e.target.value)}
              className="w-36 h-8 text-xs bg-white/10 border-white/20 text-white"
            />
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="w-32 h-8 text-xs bg-white/10 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="enviado">Enviados</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── PAINEL DE KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Gerados hoje", value: reports.length, color: "text-slate-700", bg: "bg-slate-50", icon: <FileText className="w-4 h-4 text-slate-400" /> },
          { label: "Enviados", value: painelStats.enviados, color: "text-green-700", bg: "bg-green-50", icon: <CheckCircle2 className="w-4 h-4 text-green-500" /> },
          { label: "Pendentes", value: painelStats.pendentes, color: "text-amber-700", bg: "bg-amber-50", icon: <Clock className="w-4 h-4 text-amber-500" /> },
          { label: "Com alerta", value: painelStats.comAlerta, color: "text-red-700", bg: "bg-red-50", icon: <AlertTriangle className="w-4 h-4 text-red-500" /> },
          { label: "Plano ativo", value: painelStats.comPlano, color: "text-violet-700", bg: "bg-violet-50", icon: <ClipboardList className="w-4 h-4 text-violet-500" /> },
        ].map(({ label, value, color, bg, icon }) => (
          <Card key={label}>
            <CardContent className="p-3 text-center">
              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center mx-auto mb-1.5", bg)}>{icon}</div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── BARRA DE BUSCA ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-slate-500 shrink-0">{clientesFiltrados.length} cliente(s)</span>
      </div>

      {/* ── LISTA DE CLIENTES ── */}
      <div className="space-y-2">
        {loadingReports ? (
          <div className="text-center py-12 text-slate-400">Carregando...</div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p>Nenhum cliente encontrado.</p>
          </div>
        ) : (
          clientesFiltrados.map((cliente) => {
            const report = getReportCliente(cliente.id);
            const enviado = report?.enviado || false;
            const demandasCliente = getDemandasCliente(cliente.id);
            const plano = getPlanoCliente(cliente.id);
            const meta = getMetaCliente(cliente);
            const google = getGoogleCliente(cliente);
            const demandasAbertas = demandasCliente.filter((d) => !["concluida"].includes(d.status)).length;

            return (
              <div
                key={cliente.id}
                className={cn(
                  "rounded-xl border bg-white p-4 flex items-center gap-4 hover:shadow-sm transition-shadow",
                  enviado ? "border-green-200 bg-green-50/30" : "border-slate-100"
                )}
              >
                {/* Checkbox enviado */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <Checkbox
                    checked={enviado}
                    onCheckedChange={() => toggleEnviado(cliente)}
                    className={enviado ? "border-green-500 data-[state=checked]:bg-green-500" : ""}
                  />
                  <span className="text-[10px] text-slate-400">Enviado</span>
                </div>

                {/* Info do cliente */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">{cliente.nome}</span>
                    {cliente.cidade && <span className="text-xs text-slate-400">{cliente.cidade}/{cliente.estado}</span>}
                    {enviado ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">✓ Enviado</Badge>
                    ) : (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">Pendente</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-500">
                    {meta && (
                      <span className={cn(
                        "flex items-center gap-1",
                        meta.classificacao === "CRÍTICO" || meta.classificacao === "ALERTA" ? "text-red-600" : "text-emerald-600"
                      )}>
                        <BarChart3 className="w-3 h-3" />
                        Meta: {meta.classificacao || "—"}
                      </span>
                    )}
                    {google && (
                      <span className="flex items-center gap-1 text-blue-600">
                        <TrendingUp className="w-3 h-3" />
                        Google: {google.health_status || "—"}
                      </span>
                    )}
                    {demandasAbertas > 0 && (
                      <span className="flex items-center gap-1 text-slate-600">
                        <Clock className="w-3 h-3" />
                        {demandasAbertas} demanda(s) em aberto
                      </span>
                    )}
                    {plano && (
                      <span className="flex items-center gap-1 text-violet-600">
                        <ClipboardList className="w-3 h-3" />
                        Plano ativo
                      </span>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => setOverviewAberto({ cliente })}
                  >
                    <FileText className="w-3.5 h-3.5 mr-1" />
                    Ver Overview
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 bg-violet-600 hover:bg-violet-700 text-xs"
                    onClick={() => setReportAberto({ cliente, report })}
                  >
                    <FileText className="w-3.5 h-3.5 mr-1" />
                    Gerar PDF
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── MODAL DO REPORT ── */}
      {reportAberto && (
        <ReportModal
          cliente={reportAberto.cliente}
          report={reportAberto.report}
          dataReport={dataFiltro}
          demandas={demandas}
          plano={planosAtivos.find((p) => p.cliente_id === reportAberto.cliente.id) || null}
          planoItens={planoItens}
          meta={getMetaCliente(reportAberto.cliente)}
          radar={getRadarCliente(reportAberto.cliente)}
          google={getGoogleCliente(reportAberto.cliente)}
          otimizacoes={otimizacoesMeta.filter((o) => {
            const metaConta = getMetaCliente(reportAberto.cliente);
            return metaConta && (o.account_name || "").toLowerCase() === (metaConta.account_name || "").toLowerCase();
          })}
          user={user}
          onClose={() => { setReportAberto(null); }}
          onSave={(patch) => {
            upsertReportMutation.mutate({
              clienteId: reportAberto.cliente.id,
              clienteNome: reportAberto.cliente.nome,
              data: dataFiltro,
              patch,
            });
          }}
        />
      )}
    </div>
  );
}