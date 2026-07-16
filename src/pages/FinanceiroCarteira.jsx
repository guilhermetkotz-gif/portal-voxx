import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import {
  Users, UserPlus, UserMinus, TrendingUp, TrendingDown, AlertTriangle,
  Plus, Edit, CheckCircle, ArrowUpRight, ArrowDownRight, Activity
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v) => `${(v || 0).toFixed(1)}%`;

const STATUS_LABEL = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  encerrado: 'Encerrado',
  em_implantacao: 'Em implantação'
};
const STATUS_COLOR = {
  ativo: 'bg-emerald-100 text-emerald-700',
  pausado: 'bg-amber-100 text-amber-700',
  encerrado: 'bg-red-100 text-red-700',
  em_implantacao: 'bg-blue-100 text-blue-700'
};
const MOTIVO_LABEL = {
  cancelamento_por_preco: 'Preço',
  encerramento_de_operacao: 'Encerramento de operação',
  baixa_performance_percebida: 'Baixa performance percebida',
  reestruturacao_interna: 'Reestruturação interna',
  outro: 'Outro'
};

const EMPTY_FORM = {
  nome: '', unidade: '', valor_mensal: '', tipo_contrato: 'mensal',
  dia_cobranca: '', status: 'ativo', data_inicio: '', data_fim: '',
  motivo_saida: '', observacoes: '', recorrente: true
};

function kpisForMonth(clientes, mesRef) {
  const [year, month] = mesRef.split('-').map(Number);
  const inicio = startOfMonth(new Date(year, month - 1));
  const fim = endOfMonth(new Date(year, month - 1));

  const ativos = clientes.filter(c => {
    const dataInicio = c.data_inicio ? parseISO(c.data_inicio) : null;
    const dataFim = c.data_fim ? parseISO(c.data_fim) : null;
    // Cliente estava ativo neste mês: já tinha iniciado e ainda não tinha encerrado
    const jaIniciou = !dataInicio || dataInicio <= fim;
    const aindaNaoEncerrou = !dataFim || dataFim >= inicio;
    // Excluir clientes que não tinham iniciado ainda OU já estavam encerrados neste mês
    return jaIniciou && aindaNaoEncerrou;
  });
  const novos = clientes.filter(c => {
    if (!c.data_inicio) return false;
    const d = parseISO(c.data_inicio);
    return d >= inicio && d <= fim;
  });
  const perdidos = clientes.filter(c => {
    if (!c.data_fim) return false;
    const d = parseISO(c.data_fim);
    return d >= inicio && d <= fim;
  });

  const baseInicio = ativos.length + perdidos.length;
  const churnClientes = baseInicio > 0 ? (perdidos.length / baseInicio) * 100 : 0;

  const receitaAtiva = ativos.reduce((s, c) => s + (c.valor_mensal || 0), 0);
  const receitaPerdida = perdidos.reduce((s, c) => s + (c.valor_mensal || 0), 0);
  const receitaNova = novos.reduce((s, c) => s + (c.valor_mensal || 0), 0);
  const receitaBaseInicio = receitaAtiva + receitaPerdida;
  const churnReceita = receitaBaseInicio > 0 ? (receitaPerdida / receitaBaseInicio) * 100 : 0;

  const crescimentoLiquido = novos.length - perdidos.length;
  const crescimentoReceita = receitaNova - receitaPerdida;

  return {
    ativos: ativos.length, novos: novos.length, perdidos: perdidos.length,
    churnClientes, churnReceita, crescimentoLiquido, crescimentoReceita,
    receitaAtiva, receitaNova, receitaPerdida
  };
}

function buildChartData(clientes, meses) {
  return meses.map(mes => {
    const k = kpisForMonth(clientes, mes);
    return {
      mes: format(parseISO(`${mes}-01`), 'MMM/yy', { locale: ptBR }),
      ativos: k.ativos, novos: k.novos, perdidos: k.perdidos,
      receita: k.receitaAtiva, receitaNova: k.receitaNova, receitaPerdida: k.receitaPerdida
    };
  });
}

export default function FinanceiroCarteira() {
  const queryClient = useQueryClient();
  const [mesRef, setMesRef] = useState(format(new Date(), 'yyyy-MM'));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientesFinanceiros'],
    queryFn: () => base44.entities.ClienteFinanceiro.list('-created_date', 500),
    staleTime: 60 * 1000
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data, valor_mensal: parseFloat(data.valor_mensal) || 0, dia_cobranca: parseInt(data.dia_cobranca) || null };
      if (editingId) return base44.entities.ClienteFinanceiro.update(editingId, payload);
      return base44.entities.ClienteFinanceiro.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['clientesFinanceiros']);
      setModalOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      toast.success(editingId ? 'Cliente atualizado!' : 'Cliente cadastrado!');
    }
  });

  const kpis = useMemo(() => kpisForMonth(clientes, mesRef), [clientes, mesRef]);

  const ultimos6Meses = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) =>
      format(subMonths(parseISO(`${mesRef}-01`), 5 - i), 'yyyy-MM')
    );
  }, [mesRef]);

  const chartData = useMemo(() => buildChartData(clientes, ultimos6Meses), [clientes, ultimos6Meses]);

  // Projeção simples: média dos últimos 3 meses
  const projecao = useMemo(() => {
    const ultimos3 = ultimos6Meses.slice(-3).map(m => kpisForMonth(clientes, m));
    const avgNovos = ultimos3.reduce((s, k) => s + k.novos, 0) / 3;
    const avgPerdidos = ultimos3.reduce((s, k) => s + k.perdidos, 0) / 3;
    const avgCrescLiquido = avgNovos - avgPerdidos;
    const avgCrescReceita = ultimos3.reduce((s, k) => s + k.crescimentoReceita, 0) / 3;
    return { avgNovos: avgNovos.toFixed(1), avgPerdidos: avgPerdidos.toFixed(1), avgCrescLiquido: avgCrescLiquido.toFixed(1), avgCrescReceita };
  }, [clientes, ultimos6Meses]);

  // Alertas
  const alertas = useMemo(() => {
    const a = [];
    if (kpis.churnClientes > 10) a.push({ msg: `Churn elevado: ${pct(kpis.churnClientes)} dos clientes saíram no mês`, tipo: 'erro' });
    if (kpis.crescimentoLiquido < 0) a.push({ msg: `Crescimento líquido negativo: ${kpis.crescimentoLiquido} clientes`, tipo: 'erro' });
    if (kpis.churnReceita > 10) a.push({ msg: `Churn de receita elevado: ${pct(kpis.churnReceita)}`, tipo: 'erro' });
    if (kpis.perdidos > kpis.novos) a.push({ msg: `Mais saídas (${kpis.perdidos}) do que entradas (${kpis.novos}) no período`, tipo: 'aviso' });
    return a;
  }, [kpis]);

  const clientesFiltrados = clientes.filter(c => {
    const matchSearch = !search || c.nome?.toLowerCase().includes(search.toLowerCase()) || c.unidade?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'todos' || c.status === filterStatus;

    // Filtro por mês: cliente deve estar ativo no período selecionado
    // Exceção: encerrados aparecem independentemente do mês selecionado
    const [year, month] = mesRef.split('-').map(Number);
    const inicioMes = startOfMonth(new Date(year, month - 1));
    const fimMes = endOfMonth(new Date(year, month - 1));
    const dataInicio = c.data_inicio ? parseISO(c.data_inicio) : null;
    const dataFim = c.data_fim ? parseISO(c.data_fim) : null;
    // Exclui clientes que ainda não haviam iniciado ou já haviam encerrado nesse mês
    // Mas encerrados são sempre mostrados (independente do mês) para não sumirem da lista
    const isEncerrado = c.status === 'encerrado';
    const matchMes = isEncerrado
      ? (!dataInicio || dataInicio <= fimMes)  // encerrados: apenas precisam ter iniciado
      : (!dataInicio || dataInicio <= fimMes) && (!dataFim || dataFim >= inicioMes);

    return matchSearch && matchStatus && matchMes;
  });

  function openEdit(cliente) {
    setForm({ ...EMPTY_FORM, ...cliente });
    setEditingId(cliente.id);
    setModalOpen(true);
  }

  function openNew() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setModalOpen(true);
  }

  const kpiCards = [
    { label: 'Clientes Ativos', value: kpis.ativos, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
    { label: 'Novos no Mês', value: kpis.novos, icon: UserPlus, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', delta: `+${fmt(kpis.receitaNova)}` },
    { label: 'Perdidos no Mês', value: kpis.perdidos, icon: UserMinus, color: kpis.perdidos > 0 ? 'text-red-600' : 'text-slate-500', bg: kpis.perdidos > 0 ? 'bg-red-50' : 'bg-slate-50', border: kpis.perdidos > 0 ? 'border-red-200' : 'border-slate-200', delta: kpis.perdidos > 0 ? `-${fmt(kpis.receitaPerdida)}` : null },
    { label: 'Churn Clientes', value: pct(kpis.churnClientes), icon: TrendingDown, color: kpis.churnClientes > 10 ? 'text-red-600' : 'text-amber-600', bg: kpis.churnClientes > 10 ? 'bg-red-50' : 'bg-amber-50', border: kpis.churnClientes > 10 ? 'border-red-200' : 'border-amber-200' },
    { label: 'Churn Receita', value: pct(kpis.churnReceita), icon: Activity, color: kpis.churnReceita > 10 ? 'text-red-600' : 'text-amber-600', bg: kpis.churnReceita > 10 ? 'bg-red-50' : 'bg-amber-50', border: kpis.churnReceita > 10 ? 'border-red-200' : 'border-amber-200' },
    { label: 'Crescimento Líquido', value: kpis.crescimentoLiquido >= 0 ? `+${kpis.crescimentoLiquido}` : kpis.crescimentoLiquido, icon: kpis.crescimentoLiquido >= 0 ? ArrowUpRight : ArrowDownRight, color: kpis.crescimentoLiquido >= 0 ? 'text-emerald-600' : 'text-red-600', bg: kpis.crescimentoLiquido >= 0 ? 'bg-emerald-50' : 'bg-red-50', border: kpis.crescimentoLiquido >= 0 ? 'border-emerald-200' : 'border-red-200' },
    { label: 'Crescimento Receita', value: fmt(kpis.crescimentoReceita), icon: TrendingUp, color: kpis.crescimentoReceita >= 0 ? 'text-emerald-600' : 'text-red-600', bg: kpis.crescimentoReceita >= 0 ? 'bg-emerald-50' : 'bg-red-50', border: kpis.crescimentoReceita >= 0 ? 'border-emerald-200' : 'border-red-200' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-emerald-900 rounded-2xl p-6 text-white flex items-center justify-between">
        <div>
          <p className="text-emerald-300 text-xs font-semibold uppercase tracking-widest mb-1">Módulo Financeiro VOXX</p>
          <h1 className="text-2xl font-bold">Carteira de Clientes</h1>
          <p className="text-slate-400 text-sm mt-1">Evolução, churn e crescimento da base</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} className="bg-white/10 border-white/20 text-white w-40 [color-scheme:dark]" />
          <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" /> Novo Cliente
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium ${a.tipo === 'erro' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpiCards.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <Card key={i} className={`p-4 border ${kpi.border}`}>
              <div className={`w-8 h-8 ${kpi.bg} rounded-lg flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className="text-[10px] text-slate-500 mb-0.5">{kpi.label}</p>
              <p className={`text-base font-bold ${kpi.color}`}>{kpi.value}</p>
              {kpi.delta && <p className="text-[10px] text-slate-400 mt-0.5">{kpi.delta}</p>}
            </Card>
          );
        })}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Evolução da Base de Clientes (6 meses)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="novos" fill="#10b981" name="Novos" radius={[3,3,0,0]} />
              <Bar dataKey="perdidos" fill="#ef4444" name="Perdidos" radius={[3,3,0,0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Evolução de Receita Recorrente (6 meses)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="receitaNova" fill="#10b981" name="Nova" radius={[3,3,0,0]} />
              <Bar dataKey="receitaPerdida" fill="#ef4444" name="Perdida" radius={[3,3,0,0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Gráficos de Evolução */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Clientes Ativos (6 meses)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="ativos" stroke="#7c3aed" strokeWidth={2} name="Ativos" dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Receita Total Ativa (6 meses)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="receita" stroke="#7c3aed" strokeWidth={2} name="Total Ativa" dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Projeção */}
      <Card className="p-6 bg-slate-50 border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-600" /> Projeção Simples (baseada na média dos últimos 3 meses)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Média de novos/mês', value: projecao.avgNovos, color: 'text-emerald-600' },
            { label: 'Média de perdidos/mês', value: projecao.avgPerdidos, color: 'text-red-600' },
            { label: 'Crescimento líquido médio', value: `${parseFloat(projecao.avgCrescLiquido) >= 0 ? '+' : ''}${projecao.avgCrescLiquido} clientes`, color: parseFloat(projecao.avgCrescLiquido) >= 0 ? 'text-emerald-600' : 'text-red-600' },
            { label: 'Crescimento receita médio', value: fmt(projecao.avgCrescReceita), color: projecao.avgCrescReceita >= 0 ? 'text-emerald-600' : 'text-red-600' },
          ].map((p, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-slate-200">
              <p className="text-[11px] text-slate-500 mb-1">{p.label}</p>
              <p className={`text-lg font-bold ${p.color}`}>{p.value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">* Estimativa simples — não é previsão exata. Baseada nos últimos 3 meses de dados cadastrados.</p>
      </Card>

      {/* Lista de Clientes */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700">Clientes Financeiros ({clientesFiltrados.length})</h2>
          <div className="flex gap-2">
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="w-48 h-8 text-sm" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="encerrado">Encerrado</SelectItem>
                <SelectItem value="pausado">Pausado</SelectItem>
                <SelectItem value="em_implantacao">Em implantação</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <p className="text-slate-400 text-sm py-8 text-center">Carregando...</p>
        ) : (
          <div className="space-y-2">
            {clientesFiltrados.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{c.nome}</p>
                    {c.unidade && <p className="text-xs text-slate-400">{c.unidade}</p>}
                  </div>
                  <Badge className={STATUS_COLOR[c.status || 'ativo']}>{STATUS_LABEL[c.status || 'ativo']}</Badge>
                  {c.motivo_saida && <Badge variant="outline" className="text-xs">{MOTIVO_LABEL[c.motivo_saida]}</Badge>}
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{fmt(c.valor_mensal)}</p>
                    <p className="text-[10px] text-slate-400">{c.data_inicio ? format(parseISO(c.data_inicio), 'dd/MM/yyyy') : '—'}{c.data_fim ? ` até ${format(parseISO(c.data_fim), 'dd/MM/yyyy')}` : ''}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {clientesFiltrados.length === 0 && (
              <p className="text-slate-400 text-sm py-8 text-center">Nenhum cliente encontrado.</p>
            )}
          </div>
        )}
      </Card>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={v => { setModalOpen(v); if (!v) { setEditingId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Cliente' : 'Novo Cliente Financeiro'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome do Cliente *</Label>
                <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome" />
              </div>
              <div>
                <Label>Unidade</Label>
                <Input value={form.unidade} onChange={e => setForm(p => ({ ...p, unidade: e.target.value }))} placeholder="Unidade / filial" />
              </div>
              <div>
                <Label>Valor Mensal (R$)</Label>
                <Input type="number" value={form.valor_mensal} onChange={e => setForm(p => ({ ...p, valor_mensal: e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <Label>Tipo de Contrato</Label>
                <Select value={form.tipo_contrato} onValueChange={v => setForm(p => ({ ...p, tipo_contrato: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                    <SelectItem value="avulso">Avulso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="em_implantacao">Em implantação</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de Início</Label>
                <Input type="date" value={form.data_inicio} onChange={e => setForm(p => ({ ...p, data_inicio: e.target.value }))} />
              </div>
              <div>
                <Label>Data de Encerramento</Label>
                <Input type="date" value={form.data_fim} onChange={e => setForm(p => ({ ...p, data_fim: e.target.value }))} />
              </div>
              {form.status === 'encerrado' && (
                <div className="col-span-2">
                  <Label>Motivo de Saída</Label>
                  <Select value={form.motivo_saida} onValueChange={v => setForm(p => ({ ...p, motivo_saida: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cancelamento_por_preco">Cancelamento por preço</SelectItem>
                      <SelectItem value="encerramento_de_operacao">Encerramento de operação</SelectItem>
                      <SelectItem value="baixa_performance_percebida">Baixa performance percebida</SelectItem>
                      <SelectItem value="reestruturacao_interna">Reestruturação interna</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="col-span-2">
                <Label>Observações</Label>
                <Input value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} placeholder="Observações internas" />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!form.nome || saveMutation.isPending}
              onClick={() => saveMutation.mutate(form)}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? 'Salvando...' : editingId ? 'Atualizar Cliente' : 'Cadastrar Cliente'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}