import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { format, subDays, startOfMonth, startOfDay, endOfDay, parseISO, differenceInDays, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Target,
  Zap, Clock, DollarSign, BarChart3, Activity, Award, AlertCircle, Layers
} from 'lucide-react';

// ────────────────────────────────────────────────
// CONFIGURAÇÃO DOS SETORES
// ────────────────────────────────────────────────
const SETOR_CONFIG = {
  ATENDIMENTO:       { label: 'Atendimento',        horas_dia: 8,  custo_diario: 350,  cor: '#6366f1' },
  TRAFEGO_META:      { label: 'Tráfego Meta',        horas_dia: 8,  custo_diario: 480,  cor: '#3b82f6' },
  TRAFEGO_GOOGLE:    { label: 'Tráfego Google',      horas_dia: 8,  custo_diario: 480,  cor: '#0ea5e9' },
  TRAFEGO_TIKTOK:    { label: 'Tráfego TikTok',      horas_dia: 6,  custo_diario: 300,  cor: '#06b6d4' },
  CRIACAO:           { label: 'Criação',             horas_dia: 8,  custo_diario: 420,  cor: '#8b5cf6' },
  EDICAO:            { label: 'Edição',              horas_dia: 8,  custo_diario: 380,  cor: '#a855f7' },
  BI_RELATORIO:      { label: 'BI / Relatório',      horas_dia: 6,  custo_diario: 320,  cor: '#ec4899' },
  IMPLANTACAO:       { label: 'Implantação',         horas_dia: 8,  custo_diario: 500,  cor: '#f97316' },
  FINANCEIRO:        { label: 'Financeiro',          horas_dia: 8,  custo_diario: 400,  cor: '#eab308' },
  ALTERACAO_CRIACAO: { label: 'Alt. Criação',        horas_dia: 6,  custo_diario: 280,  cor: '#84cc16' },
  AUTOMACAO:         { label: 'Automação',           horas_dia: 6,  custo_diario: 450,  cor: '#22c55e' },
  SALDOS:            { label: 'Saldos',              horas_dia: 4,  custo_diario: 200,  cor: '#14b8a6' },
};

const STATUS_LABELS = {
  recebida: 'Recebida', em_triagem: 'Em triagem', programada: 'Programada',
  em_execucao: 'Em execução', aguardando_cliente: 'Aguardando cliente',
  em_revisao: 'Em revisão', concluida: 'Concluída', finalizada: 'Finalizada',
};

const PERIOD_OPTIONS = [
  { value: 'today',   label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: '7d',      label: 'Últimos 7 dias' },
  { value: '30d',     label: 'Últimos 30 dias' },
  { value: 'month',   label: 'Este mês' },
];

const COLORS = Object.values(SETOR_CONFIG).map(s => s.cor);

function getPeriodRange(period) {
  const now = new Date();
  switch (period) {
    case 'today':     return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday': { const y = subDays(now, 1); return { start: startOfDay(y), end: endOfDay(y) }; }
    case '7d':        return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case '30d':       return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case 'month':     return { start: startOfMonth(now), end: endOfDay(now) };
    default:          return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
  }
}

function getEfficiencyColor(eff) {
  if (eff >= 70) return 'text-green-600';
  if (eff >= 40) return 'text-yellow-600';
  return 'text-red-600';
}
function getEfficiencyBg(eff) {
  if (eff >= 70) return 'bg-green-50 border-green-200';
  if (eff >= 40) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
}

// ────────────────────────────────────────────────
// COMPONENTES AUXILIARES
// ────────────────────────────────────────────────
function KPICard({ title, value, sub, icon: Icon, color = 'violet', trend }) {
  const colorMap = {
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    green:  'bg-green-50 text-green-600 border-green-100',
    blue:   'bg-blue-50 text-blue-600 border-blue-100',
    amber:  'bg-amber-50 text-amber-600 border-amber-100',
    red:    'bg-red-50 text-red-600 border-red-100',
    slate:  'bg-slate-50 text-slate-600 border-slate-100',
  };
  return (
    <Card className="p-5 border">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium flex items-center gap-1 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-sm font-medium text-slate-700 mt-0.5">{title}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </Card>
  );
}

function AlertBanner({ type, message }) {
  const styles = {
    error:   'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    info:    'bg-blue-50 border-blue-200 text-blue-700',
  };
  const icons = { error: AlertCircle, warning: AlertTriangle, info: Activity };
  const Icon = icons[type] || AlertTriangle;
  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${styles[type]}`}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ────────────────────────────────────────────────
export default function PerformanceOperacional() {
  const [period, setPeriod] = useState('30d');
  const [filterSetor, setFilterSetor] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas_perf_op'],
    queryFn: () => base44.entities.Demanda.list('-created_date', 2000),
    staleTime: 2 * 60 * 1000,
  });

  const { start, end } = useMemo(() => getPeriodRange(period), [period]);
  const diasPeriodo = useMemo(() => Math.max(1, differenceInDays(end, start) + 1), [start, end]);

  // Filtra demandas dentro do período
  const demandasPeriodo = useMemo(() => {
    return demandas.filter(d => {
      const date = d.updated_date || d.created_date;
      if (!date) return false;
      try {
        const dt = new Date(date);
        if (!isWithinInterval(dt, { start, end })) return false;
      } catch { return false; }
      if (filterSetor !== 'all' && d.setor !== filterSetor) return false;
      if (filterStatus !== 'all' && d.status !== filterStatus) return false;
      return true;
    });
  }, [demandas, start, end, filterSetor, filterStatus]);

  const concluidas = useMemo(() =>
    demandasPeriodo.filter(d => d.status === 'concluida' || d.status === 'finalizada'),
    [demandasPeriodo]);

  const atrasadas = useMemo(() =>
    demandasPeriodo.filter(d =>
      d.previsao_entrega &&
      new Date(d.previsao_entrega) < new Date() &&
      d.status !== 'concluida' && d.status !== 'finalizada'
    ), [demandasPeriodo]);

  // Cálculo por setor
  const setorStats = useMemo(() => {
    const stats = {};
    Object.keys(SETOR_CONFIG).forEach(key => {
      const cfg = SETOR_CONFIG[key];
      const concluidasSetor = concluidas.filter(d => d.setor === key);
      const totalSetor = demandasPeriodo.filter(d => d.setor === key);
      const horasDispTotal = cfg.horas_dia * diasPeriodo;
      const custoTotal = cfg.custo_diario * diasPeriodo;
      const custoPorDemanda = concluidasSetor.length > 0 ? custoTotal / concluidasSetor.length : 0;
      const mediaDiaria = concluidasSetor.length / diasPeriodo;
      // Eficiência: demandas concluídas / capacidade estimada (1 por hora disponível / 4h por demanda)
      const capacidade = horasDispTotal / 4;
      const eficiencia = capacidade > 0 ? Math.min(100, (concluidasSetor.length / capacidade) * 100) : 0;

      stats[key] = {
        ...cfg,
        key,
        concluidas: concluidasSetor.length,
        total: totalSetor.length,
        horasDispTotal,
        custoTotal,
        custoPorDemanda,
        mediaDiaria,
        eficiencia: Math.round(eficiencia),
        percentual: 0,
      };
    });
    const totalConcluidas = Object.values(stats).reduce((s, v) => s + v.concluidas, 0);
    Object.keys(stats).forEach(k => {
      stats[k].percentual = totalConcluidas > 0 ? ((stats[k].concluidas / totalConcluidas) * 100).toFixed(1) : '0.0';
    });
    return stats;
  }, [concluidas, demandasPeriodo, diasPeriodo]);

  const setorList = useMemo(() =>
    Object.values(setorStats).filter(s => s.total > 0 || s.concluidas > 0)
      .sort((a, b) => b.concluidas - a.concluidas),
    [setorStats]);

  // KPIs globais
  const totalConcluidas = concluidas.length;
  const setorMaisProdutivo = setorList[0];
  const custoMedioPorDemanda = useMemo(() => {
    const totalCusto = setorList.reduce((s, v) => s + v.custoTotal, 0);
    return totalConcluidas > 0 ? totalCusto / totalConcluidas : 0;
  }, [setorList, totalConcluidas]);
  const eficienciaMedia = useMemo(() => {
    const vals = setorList.filter(s => s.total > 0);
    return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v.eficiencia, 0) / vals.length) : 0;
  }, [setorList]);
  const mediaDiariaGlobal = (totalConcluidas / diasPeriodo).toFixed(1);
  const totalOperacional = useMemo(() =>
    setorList.reduce((s, v) => s + v.custoTotal, 0), [setorList]);

  // Dados para gráficos
  const barData = setorList.map(s => ({
    name: s.label.length > 12 ? s.label.substring(0, 12) + '…' : s.label,
    concluidas: s.concluidas,
    fill: s.cor,
  }));

  const pieData = setorList.filter(s => s.concluidas > 0).map(s => ({
    name: s.label,
    value: s.concluidas,
    fill: s.cor,
  }));

  const custoPorSetorData = setorList.filter(s => s.concluidas > 0).map(s => ({
    name: s.label.length > 12 ? s.label.substring(0, 12) + '…' : s.label,
    custo: Math.round(s.custoPorDemanda),
    fill: s.cor,
  }));

  const eficienciaData = setorList.filter(s => s.total > 0).map(s => ({
    name: s.label.length > 12 ? s.label.substring(0, 12) + '…' : s.label,
    eficiencia: s.eficiencia,
    fill: s.cor,
  }));

  // Evolução diária
  const evolucaoDiaria = useMemo(() => {
    const map = {};
    concluidas.forEach(d => {
      const date = d.updated_date || d.created_date;
      if (!date) return;
      const key = format(new Date(date), 'dd/MM');
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => {
      const [da, ma] = a[0].split('/').map(Number);
      const [db, mb] = b[0].split('/').map(Number);
      return ma !== mb ? ma - mb : da - db;
    }).map(([date, total]) => ({ date, total }));
  }, [concluidas]);

  // Insights
  const insights = useMemo(() => {
    const result = [];
    const top = setorList.filter(s => s.total > 0);
    if (top.length === 0) return result;
    const sorted = [...top].sort((a, b) => b.eficiencia - a.eficiencia);
    if (sorted[0]) result.push({ type: 'success', msg: `${sorted[0].label} é o setor mais eficiente com ${sorted[0].eficiencia}% de eficiência operacional.` });
    const menos = sorted[sorted.length - 1];
    if (menos && menos.eficiencia < 40) result.push({ type: 'warning', msg: `${menos.label} está com baixa eficiência (${menos.eficiencia}%). Pode indicar sobrecarga ou falta de volume.` });
    const sobrecarregados = top.filter(s => s.eficiencia > 90);
    sobrecarregados.forEach(s => result.push({ type: 'error', msg: `${s.label} operando acima de 90% da capacidade. Risco de sobrecarga!` }));
    const subutilizados = top.filter(s => s.eficiencia < 20 && s.total > 0);
    subutilizados.forEach(s => result.push({ type: 'info', msg: `${s.label} está subutilizado (${s.eficiencia}% de eficiência).` }));
    return result;
  }, [setorList]);

  const alertas = useMemo(() => {
    const result = [];
    if (atrasadas.length > 5) result.push({ type: 'error', msg: `${atrasadas.length} demandas em atraso no período selecionado.` });
    if (eficienciaMedia < 30) result.push({ type: 'warning', msg: `Eficiência operacional média está abaixo de 30% (${eficienciaMedia}%).` });
    const custosAltos = setorList.filter(s => s.custoPorDemanda > 2000 && s.concluidas > 0);
    custosAltos.forEach(s => result.push({ type: 'warning', msg: `${s.label} com custo por demanda elevado: R$ ${s.custoPorDemanda.toFixed(0)}` }));
    return result;
  }, [atrasadas, eficienciaMedia, setorList]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Performance Operacional</h1>
          <p className="text-sm text-slate-500 mt-1">Produtividade, eficiência e custo operacional por setor</p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map(p => (
            <Button
              key={p.value}
              size="sm"
              variant={period === p.value ? 'default' : 'outline'}
              onClick={() => setPeriod(p.value)}
              className="text-xs"
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Filtros secundários */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterSetor} onValueChange={setFilterSetor}>
          <SelectTrigger className="w-48 h-9 text-sm">
            <SelectValue placeholder="Todos os setores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {Object.entries(SETOR_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs text-slate-400 self-center">
          Período: {format(start, 'dd/MM/yyyy')} — {format(end, 'dd/MM/yyyy')} ({diasPeriodo} dias)
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {alertas.map((a, i) => <AlertBanner key={i} type={a.type} message={a.msg} />)}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
            <KPICard title="Concluídas" value={totalConcluidas} icon={CheckCircle2} color="green" sub={`${diasPeriodo} dias`} />
            <KPICard title="Setor + Produtivo" value={setorMaisProdutivo?.label || '—'} icon={Award} color="violet" sub={setorMaisProdutivo ? `${setorMaisProdutivo.concluidas} entregas` : ''} />
            <KPICard title="Custo Médio/Demanda" value={custoMedioPorDemanda > 0 ? `R$ ${custoMedioPorDemanda.toFixed(0)}` : '—'} icon={DollarSign} color="blue" />
            <KPICard title="Eficiência Média" value={`${eficienciaMedia}%`} icon={Zap} color={eficienciaMedia >= 70 ? 'green' : eficienciaMedia >= 40 ? 'amber' : 'red'} />
            <KPICard title="Em Atraso" value={atrasadas.length} icon={AlertTriangle} color={atrasadas.length > 5 ? 'red' : 'amber'} />
            <KPICard title="Média Diária" value={mediaDiariaGlobal} icon={Activity} color="slate" sub="entregas/dia" />
            <KPICard title="Custo Operacional" value={`R$ ${(totalOperacional / 1000).toFixed(0)}k`} icon={Layers} color="slate" sub="total do período" />
          </div>

          {/* Gráficos linha 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Barras por setor */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-violet-500" /> Demandas Concluídas por Setor
              </h3>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} margin={{ top: 0, right: 10, bottom: 30, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [v, 'Concluídas']} />
                    <Bar dataKey="concluidas" radius={[4, 4, 0, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-40 text-sm text-slate-400">Sem dados no período</div>}
            </Card>

            {/* Evolução diária */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" /> Evolução Diária de Entregas
              </h3>
              {evolucaoDiaria.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={evolucaoDiaria} margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [v, 'Entregas']} />
                    <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-40 text-sm text-slate-400">Sem dados no período</div>}
            </Card>
          </div>

          {/* Gráficos linha 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Distribuição */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-pink-500" /> Distribuição Operacional
              </h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-40 text-sm text-slate-400">Sem dados</div>}
            </Card>

            {/* Custo por demanda */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-500" /> Custo por Demanda (R$)
              </h3>
              {custoPorSetorData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={custoPorSetorData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip formatter={(v) => [`R$ ${v}`, 'Custo/Demanda']} />
                    <Bar dataKey="custo" radius={[0, 4, 4, 0]}>
                      {custoPorSetorData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-40 text-sm text-slate-400">Sem dados</div>}
            </Card>

            {/* Eficiência */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> Eficiência por Setor (%)
              </h3>
              {eficienciaData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={eficienciaData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Eficiência']} />
                    <Bar dataKey="eficiencia" radius={[0, 4, 4, 0]}>
                      {eficienciaData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-40 text-sm text-slate-400">Sem dados</div>}
            </Card>
          </div>

          {/* Tabela por setor */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-500" /> Tabela Operacional por Setor
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Setor', 'Concluídas', 'Horas Disp.', 'Custo/dia', 'Custo/Demanda', 'Média Diária', 'Eficiência', '% Operação'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-500 py-2 px-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {setorList.length === 0 ? (
                    <tr><td colSpan={8} className="text-center text-slate-400 py-8">Nenhum dado no período</td></tr>
                  ) : setorList.map(s => (
                    <tr key={s.key} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.cor }} />
                          <span className="font-medium text-slate-800">{s.label}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{s.concluidas}</td>
                      <td className="py-3 px-3 text-slate-600">{s.horas_dia}h/dia</td>
                      <td className="py-3 px-3 text-slate-600">R$ {s.custo_diario}</td>
                      <td className="py-3 px-3">
                        {s.concluidas > 0
                          ? <span className="font-medium text-slate-800">R$ {s.custoPorDemanda.toFixed(0)}</span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-3 px-3 text-slate-600">{s.mediaDiaria.toFixed(1)}/dia</td>
                      <td className="py-3 px-3">
                        <span className={`font-semibold ${getEfficiencyColor(s.eficiencia)}`}>{s.eficiencia}%</span>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-xs">{s.percentual}%</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Insights */}
          {insights.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-500" /> Insights Operacionais
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.map((ins, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${getEfficiencyBg(ins.type === 'success' ? 80 : ins.type === 'warning' ? 50 : 20)}`}>
                    {ins.type === 'success'
                      ? <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      : ins.type === 'warning'
                        ? <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        : <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />}
                    <span className="text-sm text-slate-700">{ins.msg}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}