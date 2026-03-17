import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import PlanoDeAcaoKPIs from "@/components/planoacao/PlanoDeAcaoKPIs";
import PlanoListagem from "@/components/planoacao/PlanoListagem";
import NovoPlanoModal from "@/components/planoacao/NovoPlanModal";

export default function PlanoDeAcao({ user }) {
  const navigate = useNavigate();
  const [novoPlanoOpen, setNovoPlanoOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [filtroCliente, setFiltroCliente] = useState("all");
  const [filtroResponsavel, setFiltroResponsavel] = useState("all");

  const tipoUsuario = user?.tipo_usuario || user?.tipo_acesso;
  const isVoxx = user?.role === 'admin' || tipoUsuario === 'voxx_admin' || tipoUsuario === 'voxx_manager' || tipoUsuario === 'voxx_operacao';

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes", user?.id, isVoxx],
    queryFn: async () => {
      if (isVoxx) {
        return base44.entities.Cliente.list("-updated_date", 500);
      }
      const access = await base44.entities.UserClientAccess.filter({ usuario_id: user.id, status: 'ativo' });
      if (!access.length) return [];
      const clienteIds = access.map(a => a.cliente_id);
      const todos = await base44.entities.Cliente.list("-updated_date", 500);
      return todos.filter(c => clienteIds.includes(c.id));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: planos = [], isLoading: loadingPlanos } = useQuery({
    queryKey: ["planosDeAcao", user?.id, isVoxx],
    queryFn: async () => {
      if (isVoxx) {
        return base44.entities.PlanoDeAcao.list("-created_date", 500);
      }
      const access = await base44.entities.UserClientAccess.filter({ usuario_id: user.id, status: 'ativo' });
      if (!access.length) return [];
      const clienteIds = access.map(a => a.cliente_id);
      const todos = await base44.entities.PlanoDeAcao.list("-created_date", 500);
      return todos.filter(p => clienteIds.includes(p.cliente_id));
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["todosItensPlano"],
    queryFn: () => base44.entities.PlanoDeAcaoItem.list("-created_date", 2000),
    staleTime: 60 * 1000,
  });

  const itensPorPlano = useMemo(() => {
    const map = {};
    itens.forEach((item) => {
      if (!map[item.plano_id]) map[item.plano_id] = [];
      map[item.plano_id].push(item);
    });
    return map;
  }, [itens]);

  const clientesComPlano = useMemo(() => {
    const ids = new Set(planos.map((p) => p.cliente_id));
    return clientes.filter((c) => ids.has(c.id));
  }, [planos, clientes]);

  const responsaveisUnicos = ["Agência Voxx", "Unidade"];

  const planosFiltrados = useMemo(() => {
    return planos.filter((p) => {
      const matchSearch = !search || p.titulo_plano?.toLowerCase().includes(search.toLowerCase()) || p.cliente_nome?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filtroStatus === "all" || p.status_plano === filtroStatus;
      const matchCliente = filtroCliente === "all" || p.cliente_id === filtroCliente;

      let matchResp = true;
      if (filtroResponsavel !== "all") {
        const itensDoPlano = itensPorPlano[p.id] || [];
        matchResp = itensDoPlano.some((i) => i.responsavel === filtroResponsavel);
      }

      return matchSearch && matchStatus && matchCliente && matchResp;
    });
  }, [planos, search, filtroStatus, filtroCliente, filtroResponsavel, itensPorPlano]);

  const handleCreated = (plano) => {
    navigate(`/PlanoDeAcaoDetalhe?id=${plano.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Plano de Ação</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gerencie planos e ações por cliente</p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-700" onClick={() => setNovoPlanoOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Plano de Ação
        </Button>
      </div>

      {/* KPIs */}
      <PlanoDeAcaoKPIs planos={planos} itens={itens} />

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por cliente ou título..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filtroCliente} onValueChange={setFiltroCliente}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Todos os clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clientesComPlano.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="Aberto">Aberto</SelectItem>
                <SelectItem value="Em andamento">Em andamento</SelectItem>
                <SelectItem value="Concluído">Concluído</SelectItem>
                <SelectItem value="Arquivado">Arquivado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos responsáveis</SelectItem>
                {responsaveisUnicos.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Listagem */}
      {loadingPlanos ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        </div>
      ) : (
        <PlanoListagem
          planos={planosFiltrados}
          itensPorPlano={itensPorPlano}
          onVerPlano={(plano) => navigate(`/PlanoDeAcaoDetalhe?id=${plano.id}`)}
        />
      )}

      <NovoPlanoModal
        open={novoPlanoOpen}
        onOpenChange={setNovoPlanoOpen}
        clientes={clientes}
        onCreated={handleCreated}
      />
    </div>
  );
}