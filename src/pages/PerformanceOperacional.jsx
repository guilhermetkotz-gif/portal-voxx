import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import {
  format, subDays, startOfMonth, startOfDay, endOfDay, differenceInDays, isWithinInterval
} from 'date-fns';
import {
  TrendingUp, TrendingDown, Users, Award, Zap, Clock,
  DollarSign, Activity, BarChart3, AlertTriangle, CheckCircle2,
  Layers, Target, Settings2
} from 'lucide-react';
import ConfiguracaoSetoresModal from '@/components/operacional/ConfiguracaoSetoresModal.jsx';

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const SETOR_CONFIG = {
  ATENDIMENTO:       { label: 'Atendimento',                cor: '#6366f1', horas_dia: 8,  custo_diario: 350 },
  TRAFEGO_META:      { label: 'Tráfego – Meta Ads',         cor: '#3b82f6', horas_dia: 8,  custo_diario: 480 },
  TRAFEGO_GOOGLE:    { label: 'Tráfego – Google Ads',       cor: '#0ea5e9', horas_dia: 8,  custo_diario: 480 },
  TRAFEGO_TIKTOK:    { label: 'Tráfego – TikTok Ads',       cor: '#06b6d4', horas_dia: 6,  custo_diario: 300 },
  CRIACAO:           { label: 'Criação (Artes & Peças)',     cor: '#8b5cf6', horas_dia: 8,  custo_diario: 420 },
  EDICAO:            { label: 'Edição de Vídeo',             cor: '#a855f7', horas_dia: 8,  custo_diario: 380 },
  BI_RELATORIO:      { label: 'Relatórios / BI',             cor: '#ec4899', horas_dia: 6,  custo_diario: 320 },
  IMPLANTACAO:       { label: 'Implantação / Acessos',       cor: '#f97316', horas_dia: 8,  custo_diario: 500 },
  FINANCEIRO:        { label: 'Financeiro / Adm.',           cor: '#eab308', horas_dia: 8,  custo_diario: 400 },
  ALTERACAO_CRIACAO: { label: 'Alteração Criação',           cor: '#84cc16', horas_dia: 6,  custo_diario: 280 },
  AUTOMACAO:         { label: 'Automação',                   cor: '#22c55e', horas_dia: 6,  custo_diario: 450 },
  SALDOS:            { label: 'Saldos',                      cor: '#14b8a6', horas_dia: 4,  custo_diario: 200 },
  GESTAO:            { label: 'Gestão',                      cor: '#64748b', horas_dia: 8,  custo_diario: 600 },
  COMERCIAL:         { label: 'Comercial',                   cor: '#f43f5e', horas_dia: 8,  custo_diario: 500 },
};

const PERIOD_OPTIONS = [
  { value: 'today',     label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: '7d',        label: 'Últimos 7 dias' },
  { value: '30d',       label: 'Últimos 30 dias' },
  { value: 'month',     label: 'Este mês' },
];

function getPeriodRange(p) {
  const now = new Date();
  switch (p) {
    case 'today':     return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday': { const y = subDays(now, 1); return { start: startOfDay(y), end: endOfDay(y) }; }
    case '7d':        return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case '30d':       return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case 'month':     return { start: startOfMonth(now), end: endOfDay(now) };
    default:          return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
  }
}

// ─── HELPERS VISUAIS ─────────────────────────────────────────────────────────
function eff(v) { return v >= 80 ? 'text-green-600' : v >= 50 ? 'text-yellow-600' : 'text-red-500'; }
function effBg(v) { return v >= 80 ? 'bg-green-500' : v >= 50 ? 'bg-yellow-400' : 'bg-red-500'; }

function KPI({ title, value, sub, icon: Icon, color = 'violet' }) {
  const c = {
    violet: 'bg-violet-50 text-violet-600', green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600', slate: 'bg-slate-100 text-slate-600',
  }[color];
  return (
    <Card className="p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${c}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-bold text-slate-900 leading-tight">{value}</div>
      <div className="text-xs font-semibold text-slate-600 mt-0.5">{title}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </Card>
  );
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export default function PerformanceOperacional() {
  const [period, setPeriod] = useState('30d');
  const [filterSetor, setFilterSetor] = useState('all');
  const [filterUsuario, setFilterUsuario] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showConfig, setShowConfig] = useState(false);

  // Queries
  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas_perf_op'],
    queryFn: () => base44.entities.Demanda.list('-created_date', 3000),
    staleTime: 2 * 60 * 1000,
  });
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios_perf'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: configSetores = [] } = useQuery({
    queryKey: ['config_setores'],
    queryFn: () => base44.entities.ConfiguracaoSetorOperacional.list(),
    staleTime: 5 * 60 * 1000,
  });

  // Mapa email → usuario
  const userMap = useMemo(() => {
    const m = {};
    usuarios.forEach(u => { if (u.email) m[u.email] = u; });
    return m;
  }, [usuarios]);

  const voxxEmails = useMemo(() =>
    new Set(usuarios.filter(u => {
      const t = u.tipo_usuario || u.tipo_acesso || '';
      return t.startsWith('voxx_') || u.role === 'admin';
    }).map(u => u.email)),
    [usuarios]
  );

  const { start, end } = useMemo(() => getPeriodRange(period), [period]);
  const diasPeriodo = useMemo(() => Math.max(1, differenceInDays(end, start) + 1), [start, end]);

  // Demandas no período (sem filtro de setor/usuário ainda — esses filtros se aplicam após computar)
  const demandasPeriodo = useMemo(() =>
    demandas.filter(d => {
      const date = d.updated_date || d.created_date;
      if (!date) return false;
      try { return isWithinInterval(new Date(date), { start, end }); } catch { return false; }
    }),
    [demandas, start, end]
  );

  // ─── LÓGICA CENTRAL: PARTICIPAÇÃO ─────────────────────────────────────────
  // Para cada demanda, coletamos os emails Voxx participantes e seus setores
  const { participacaoSetores, participacaoUsuarios, totalParticipacoes } = useMemo(() => {
    // setorKey → { key, label, cor, demandasIds, concluidasIds, emails, minutosTotal, count }
    const setores = {};
    // email → { nome, setor, setorLabel, cor, demandasIds, concluidasIds }
    const usuariosM = {};

    const reg = (email, demandaId, concluida, minutos = 0) => {
      if (!email || !voxxEmails.has(email)) return;
      const u = userMap[email];
      if (!u) return;
      const setorKey = u.setor_responsavel;
      const setorCfg = setorKey ? SETOR_CONFIG[setorKey] : null;

      // Por usuário
      if (!usuariosM[email]) {
        usuariosM[email] = {
          email, nome: u.full_name || email,
          setor: setorKey || null,
          setorLabel: setorCfg?.label || 'Sem setor',
          cor: setorCfg?.cor || '#94a3b8',
          demandasIds: new Set(), concluidasIds: new Set(), minutosTotal: 0,
        };
      }
      usuariosM[email].demandasIds.add(demandaId);
      if (concluida) usuariosM[email].concluidasIds.add(demandaId);
      usuariosM[email].minutosTotal += minutos;

      // Por setor
      if (!setorKey || !setorCfg) return;
      if (!setores[setorKey]) {
        setores[setorKey] = {
          key: setorKey, label: setorCfg.label, cor: setorCfg.cor,
          demandasIds: new Set(), concluidasIds: new Set(),
          emails: new Set(), minutosTotal: 0,
        };
      }
      setores[setorKey].demandasIds.add(demandaId);
      if (concluida) setores[setorKey].concluidasIds.add(demandaId);
      setores[setorKey].emails.add(email);
      setores[setorKey].minutosTotal += minutos;
    };

    let totalPart = 0;
    demandasPeriodo.forEach(d => {
      const concluida = d.status === 'concluida' || d.status === 'finalizada';
      // 1. Criador
      if (d.created_by) { reg(d.created_by, d.id, concluida); totalPart++; }
      // 2. Histórico de tempo
      if (Array.isArray(d.historico_tempo_trabalho)) {
        d.historico_tempo_trabalho.forEach(h => {
          const u = usuarios.find(u2 => u2.id === h.usuario_id);
          if (u?.email) { reg(u.email, d.id, concluida, h.minutos || 0); totalPart++; }
        });
      }
      // 3. Cronômetro ativo
      if (d.cronometro_usuario_id) {
        const u = usuarios.find(u2 => u2.id === d.cronometro_usuario_id);
        if (u?.email) reg(u.email, d.id, concluida);
      }
    });

    const cfgMap = {};
    configSetores.forEach(c => { cfgMap[c.setor_nome] = c; });

    const setoresArr = Object.values(setores).map(s => {
      const db = cfgMap[s.key];
      const base = SETOR_CONFIG[s.key];
      const horas_dia = db?.horas_disponiveis_dia ?? base.horas_dia;
      const custo_diario = db?.custo_diario_setor ?? base.custo_diario;
      const meta_diaria = db?.meta_diaria_demandas ?? null;
      const demandas_c = s.demandasIds.size;
      const concluidas_c = s.concluidasIds.size;
      const custoTotal = custo_diario * diasPeriodo;
      const capacidade = meta_diaria ? meta_diaria * diasPeriodo : (horas_dia * diasPeriodo) / 4;
      const effReal = capacidade > 0 ? Math.round((concluidas_c / capacidade) * 100) : 0;
      return {
        ...s,
        demandas: demandas_c, concluidas: concluidas_c,
        usuarios: s.emails.size,
        horas_dia, custo_diario, meta_diaria, custoTotal,
        mediaDiaria: (demandas_c / diasPeriodo).toFixed(1),
        custoPorDemanda: concluidas_c > 0 ? custoTotal / concluidas_c : 0,
        eficiencia: Math.min(100, effReal),
        eficienciaReal: effReal,
      };
    }).sort((a, b) => b.demandas - a.demandas);

    const usuariosArr = Object.values(usuariosM).map(u => ({
      ...u,
      demandas: u.demandasIds.size,
      concluidas: u.concluidasIds.size,
      mediaDiaria: (u.demandasIds.size / diasPeriodo).toFixed(1),
      pctConclusao: u.demandasIds.size > 0 ? Math.round((u.concluidasIds.size / u.demandasIds.size) * 100) : 0,
    })).sort((a, b) => b.demandas - a.demandas);

    return { participacaoSetores: setoresArr, participacaoUsuarios: usuariosArr, totalParticipacoes: totalPart };
  }, [demandasPeriodo, userMap, voxxEmails, usuarios, diasPeriodo, configSetores]);

  // Filtros aplicados sobre os arrays já computados
  const setoresFiltrados = useMemo(() =>
    filterSetor === 'all' ? participacaoSetores : participacaoSetores.filter(s => s.key === filterSetor),
    [participacaoSetores, filterSetor]
  );
  const usuariosFiltrados = useMemo(() => {
    let arr = participacaoUsuarios;
    if (filterSetor !== 'all') arr = arr.filter(u => u.setor === filterSetor);
    if (filterUsuario !== 'all') arr = arr.filter(u => u.email === filterUsuario);
    return arr;
  }, [participacaoUsuarios, filterSetor, filterUsuario]);

  // KPIs globais
  const totalConcluidasGlobal = useMemo(() => {
    const ids = new Set();
    participacaoSetores.forEach(s => s.concluidasIds.forEach(id => ids.add(id)));
    return ids.size;
  }, [participacaoSetores]);
  const setoresAtivos = participacaoSetores.filter(s => s.demandas > 0).length;
  const usuariosAtivos = participacaoUsuarios.filter(u => u.demandas > 0).length;
  const eficienciaMedia = useMemo(() => {
    const arr = participacaoSetores.filter(s => s.demandas > 0);
    return arr.length > 0 ? Math.round(arr.reduce((a, s) => a + s.eficiencia, 0) / arr.length) : 0;
  }, [participacaoSetores]);
  const custoTotal = useMemo(() =>
    participacaoSetores.reduce((a, s) => a + s.custoTotal, 0),
    [participacaoSetores]
  );
  const custoMedioDemanda = totalConcluidasGlobal > 0 ? custoTotal / totalConcluidasGlobal : 0;
  const tempoMedioTotal = useMemo(() => {
    const all = participacaoUsuarios.filter(u => u.minutosTotal > 0);
    return all.length > 0 ? Math.round(all.reduce((a, u) => a + u.minutosTotal, 0) / all.length) : 0;
  }, [participacaoUsuarios]);

  // Dados para gráficos
  const barSetorData = setoresFiltrados.map(s => ({
    name: s.label.length > 13 ? s.label.slice(0, 13) + '…' : s.label,
    participações: s.demandas, concluídas: s.concluidas, fill: s.cor,
  }));

  const pieData = participacaoSetores.filter(s => s.demandas > 0).map(s => ({
    name: s.label, value: s.demandas, fill: s.cor,
  }));

  const evolucaoDiaria = useMemo(() => {
    const map = {};
    demandasPeriodo.forEach(d => {
      if (d.status !== 'concluida' && d.status !== 'finalizada') return;
      const date = d.updated_date || d.created_date;
      if (!date) return;
      const k = format(new Date(date), 'dd/MM');
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => {
        const [da, ma] = a.split('/').map(Number);
        const [db, mb] = b.split('/').map(Number);
        return ma !== mb ? ma - mb : da - db;
      })
      .map(([date, total]) => ({ date, total }));
  }, [demandasPeriodo]);

  // Gargalos
  const gargalos = useMemo(() => {
    const result = [];
    participacaoUsuarios.forEach(u => {
      if (u.demandas > 10 && u.demandas / diasPeriodo > 1.5)
        result.push({ tipo: 'usuario', nome: u.nome, msg: `${u.demandas} participações em ${diasPeriodo} dias`, setor: u.setorLabel, cor: u.cor });
    });
    participacaoSetores.forEach(s => {
      if (s.eficienciaReal > 110)
        result.push({ tipo: 'setor', nome: s.label, msg: `Eficiência ${s.eficienciaReal}% — acima da capacidade!`, setor: s.label, cor: s.cor });
      if (s.demandas > 0 && s.concluidas === 0)
        result.push({ tipo: 'setor', nome: s.label, msg: 'Participações sem nenhuma conclusão registrada', setor: s.label, cor: s.cor });
    });
    return result;
  }, [participacaoSetores, participacaoUsuarios, diasPeriodo]);

  return (
    <div className="space-y-5">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Performance Operacional</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Central de gestão operacional · baseada na participação real da equipe Voxx
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" variant="outline" onClick={() => setShowConfig(true)}
            className="text-xs border-violet-200 text-violet-700 hover:bg-violet-50 gap-1.5">
            <Settings2 className="w-3.5 h-3.5" /> Configurar Setores
          </Button>
          {PERIOD_OPTIONS.map(p => (
            <Button key={p.value} size="sm"
              variant={period === p.value ? 'default' : 'outline'}
              onClick={() => setPeriod(p.value)} className="text-xs">
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* ── FILTROS ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterSetor} onValueChange={setFilterSetor}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Todos os setores" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {Object.entries(SETOR_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterUsuario} onValueChange={setFilterUsuario}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Todos os usuários" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os usuários</SelectItem>
            {participacaoUsuarios.map(u => <SelectItem key={u.email} value={u.email}>{u.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-xs text-slate-400 self-center ml-1">
          {format(start, 'dd/MM/yyyy')} — {format(end, 'dd/MM/yyyy')} · {diasPeriodo} dias
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
            <KPI title="Participações" value={totalParticipacoes} icon={Activity} color="violet" sub="ações operacionais" />
            <KPI title="Concluídas" value={totalConcluidasGlobal} icon={CheckCircle2} color="green" sub="no período" />
            <KPI title="Usuários Ativos" value={usuariosAtivos} icon={Users} color="blue" sub="colaboradores" />
            <KPI title="Setores Ativos" value={setoresAtivos} icon={Layers} color="slate" />
            <KPI title="Média Diária" value={(totalConcluidasGlobal / diasPeriodo).toFixed(1)} icon={TrendingUp} color="green" sub="entregas/dia" />
            <KPI title="Tempo Médio" value={tempoMedioTotal > 0 ? tempoMedioTotal >= 60 ? `${Math.floor(tempoMedioTotal / 60)}h${tempoMedioTotal % 60}m` : `${tempoMedioTotal}min` : '—'} icon={Clock} color="amber" sub="por usuário" />
            <KPI title="Eficiência Média" value={`${eficienciaMedia}%`} icon={Zap} color={eficienciaMedia >= 70 ? 'green' : eficienciaMedia >= 40 ? 'amber' : 'red'} />
            <KPI title="Custo Operacional" value={`R$ ${(custoTotal / 1000).toFixed(0)}k`} icon={DollarSign} color="slate" sub="total período" />
            <KPI title="Custo/Demanda" value={custoMedioDemanda > 0 ? `R$ ${custoMedioDemanda.toFixed(0)}` : '—'} icon={Target} color="slate" />
          </div>

          {/* ── TABS ─────────────────────────────────────────────────────────── */}
          <Tabs defaultValue="setores" className="space-y-5">
            <TabsList className="grid w-full grid-cols-4 max-w-xl">
              <TabsTrigger value="setores" className="text-xs">Por Setor</TabsTrigger>
              <TabsTrigger value="usuarios" className="text-xs">Por Usuário</TabsTrigger>
              <TabsTrigger value="distribuicao" className="text-xs">Distribuição</TabsTrigger>
              <TabsTrigger value="gargalos" className="text-xs">Gargalos</TabsTrigger>
            </TabsList>

            {/* ─ POR SETOR ────────────────────────────────────────────────── */}
            <TabsContent value="setores" className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Gráfico barras */}
                <Card className="p-4">
                  <h3 className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-violet-500" /> Participações e Conclusões por Setor
                  </h3>
                  {barSetorData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={barSetorData} margin={{ top: 0, right: 8, bottom: 40, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="participações" fill="#818cf8" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="concluídas" fill="#4ade80" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-xs text-slate-400 py-8 text-center">Sem dados no período</p>}
                </Card>

                {/* Evolução diária */}
                <Card className="p-4">
                  <h3 className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Evolução Diária de Conclusões
                  </h3>
                  {evolucaoDiaria.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={evolucaoDiaria} margin={{ top: 0, right: 8, bottom: 0, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={v => [v, 'Concluídas']} />
                        <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <p className="text-xs text-slate-400 py-8 text-center">Sem dados</p>}
                </Card>
              </div>

              {/* Tabela por setor */}
              <Card className="p-4">
                <h3 className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-500" /> Tabela Operacional por Setor
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Setor','Usuários','Participações','Concluídas','Média/dia','Custo Total','Custo/Dem.','Eficiência','% Operação'].map(h =>
                          <th key={h} className="text-left font-semibold text-slate-500 py-2 px-2.5 whitespace-nowrap">{h}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {setoresFiltrados.length === 0
                        ? <tr><td colSpan={9} className="text-center text-slate-400 py-6">Nenhum dado no período</td></tr>
                        : setoresFiltrados.map(s => {
                          const pctOp = participacaoSetores.reduce((a, x) => a + x.demandas, 0);
                          const pct = pctOp > 0 ? ((s.demandas / pctOp) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={s.key} className="border-b border-slate-50 hover:bg-slate-50">
                              <td className="py-2.5 px-2.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full" style={{ background: s.cor }} />
                                  <span className="font-medium text-slate-800 whitespace-nowrap">{s.label}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-2.5 text-slate-700">{s.usuarios}</td>
                              <td className="py-2.5 px-2.5 font-bold text-slate-900">{s.demandas}</td>
                              <td className="py-2.5 px-2.5">
                                <span className={s.concluidas > 0 ? 'text-green-600 font-semibold' : 'text-slate-400'}>{s.concluidas}</span>
                              </td>
                              <td className="py-2.5 px-2.5 text-slate-600">{s.mediaDiaria}/dia</td>
                              <td className="py-2.5 px-2.5 text-slate-700">R$ {s.custoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
                              <td className="py-2.5 px-2.5">{s.concluidas > 0 ? `R$ ${s.custoPorDemanda.toFixed(0)}` : '—'}</td>
                              <td className="py-2.5 px-2.5">
                                <div className="flex items-center gap-1.5 min-w-[80px]">
                                  <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                                    <div className={`h-1.5 rounded-full ${effBg(s.eficiencia)}`} style={{ width: `${s.eficiencia}%` }} />
                                  </div>
                                  <span className={`font-semibold ${eff(s.eficiencia)}`}>{s.eficienciaReal}%</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-2.5">
                                <Badge variant="outline" className="text-xs">{pct}%</Badge>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </TabsContent>

            {/* ─ POR USUÁRIO ──────────────────────────────────────────────── */}
            <TabsContent value="usuarios" className="space-y-5">
              {participacaoUsuarios.length === 0 ? (
                <Card className="p-8 text-center border-dashed">
                  <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Nenhuma participação de usuários Voxx identificada no período.</p>
                  <p className="text-xs text-slate-400 mt-1">Configure o <strong>setor_responsavel</strong> dos usuários em Gerenciar Acessos.</p>
                </Card>
              ) : (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-500" /> Ranking Operacional por Usuário
                    </h3>
                    <span className="text-xs text-slate-400">{usuariosFiltrados.length} usuários</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100">
                          {['#','Usuário','Setor','Participações','Concluídas','Média/dia','% Conclusão','Ranking'].map(h =>
                            <th key={h} className="text-left font-semibold text-slate-500 py-2 px-2.5 whitespace-nowrap">{h}</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {usuariosFiltrados.map((u, i) => (
                          <tr key={u.email} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="py-2.5 px-2.5 font-bold text-slate-400">{i + 1}</td>
                            <td className="py-2.5 px-2.5">
                              <p className="font-semibold text-slate-800">{u.nome}</p>
                              <p className="text-slate-400 text-[10px]">{u.email}</p>
                            </td>
                            <td className="py-2.5 px-2.5">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{ background: u.cor + '22', color: u.cor }}>
                                {u.setorLabel}
                              </span>
                            </td>
                            <td className="py-2.5 px-2.5 font-bold text-slate-900">{u.demandas}</td>
                            <td className="py-2.5 px-2.5">
                              <span className={u.concluidas > 0 ? 'text-green-600 font-semibold' : 'text-slate-400'}>{u.concluidas}</span>
                            </td>
                            <td className="py-2.5 px-2.5 text-slate-600">{u.mediaDiaria}/dia</td>
                            <td className="py-2.5 px-2.5">
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 bg-slate-100 rounded-full h-1.5 min-w-[50px]">
                                  <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${u.pctConclusao}%` }} />
                                </div>
                                <span className="text-slate-600">{u.pctConclusao}%</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2.5">
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-slate-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </TabsContent>

            {/* ─ DISTRIBUIÇÃO ─────────────────────────────────────────────── */}
            <TabsContent value="distribuicao" className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Pizza setores */}
                <Card className="p-4">
                  <h3 className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-pink-500" /> Distribuição por Setor (participações)
                  </h3>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" outerRadius={85} dataKey="value" nameKey="name"
                          label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                        </Pie>
                        <Tooltip formatter={(v, n) => [v + ' demandas', n]} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-xs text-slate-400 py-8 text-center">Sem dados</p>}
                </Card>

                {/* Carga por usuário top 10 */}
                <Card className="p-4">
                  <h3 className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-500" /> Top 10 Usuários — Carga Operacional
                  </h3>
                  {participacaoUsuarios.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart
                        data={participacaoUsuarios.slice(0, 10).map(u => ({
                          name: u.nome.split(' ')[0],
                          participações: u.demandas,
                          fill: u.cor,
                        }))}
                        margin={{ top: 0, right: 8, bottom: 30, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={v => [v, 'Participações']} />
                        <Bar dataKey="participações" radius={[3, 3, 0, 0]}>
                          {participacaoUsuarios.slice(0, 10).map((u, i) => <Cell key={i} fill={u.cor} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-xs text-slate-400 py-8 text-center">Sem dados</p>}
                </Card>
              </div>

              {/* Heatmap operacional — barras horizontais por setor */}
              <Card className="p-4">
                <h3 className="text-xs font-semibold text-slate-600 mb-4 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-violet-500" /> Heatmap Operacional — Carga por Setor
                </h3>
                <div className="space-y-2">
                  {participacaoSetores.filter(s => s.demandas > 0).map(s => {
                    const maxD = Math.max(...participacaoSetores.map(x => x.demandas), 1);
                    const pct = Math.round((s.demandas / maxD) * 100);
                    return (
                      <div key={s.key} className="flex items-center gap-3">
                        <div className="w-32 text-right text-xs text-slate-600 whitespace-nowrap truncate">{s.label}</div>
                        <div className="flex-1 bg-slate-100 rounded-full h-5 relative">
                          <div className="h-5 rounded-full transition-all" style={{ width: `${pct}%`, background: s.cor + 'cc' }} />
                          <span className="absolute right-2 top-0.5 text-[10px] font-semibold text-slate-700">{s.demandas}</span>
                        </div>
                        <div className="w-10 text-xs text-slate-500 text-right">{s.usuarios}u</div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </TabsContent>

            {/* ─ GARGALOS ─────────────────────────────────────────────────── */}
            <TabsContent value="gargalos" className="space-y-4">
              {gargalos.length === 0 ? (
                <Card className="p-8 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 font-medium">Nenhum gargalo identificado no período</p>
                  <p className="text-xs text-slate-400 mt-1">A operação está dentro dos parâmetros normais.</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {gargalos.map((g, i) => (
                    <Card key={i} className="p-4 border-l-4" style={{ borderLeftColor: g.cor }}>
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: g.cor }} />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{g.nome}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{g.msg}</p>
                          <Badge variant="outline" className="mt-1 text-xs">{g.tipo === 'usuario' ? 'Usuário' : 'Setor'}</Badge>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Tabela de sobrecarga */}
              {participacaoUsuarios.length > 0 && (
                <Card className="p-4">
                  <h3 className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-red-500" /> Distribuição de Carga por Usuário
                  </h3>
                  <div className="space-y-2">
                    {participacaoUsuarios.slice(0, 15).map(u => {
                      const max = participacaoUsuarios[0]?.demandas || 1;
                      const pct = Math.round((u.demandas / max) * 100);
                      const sobrecarga = pct > 80;
                      return (
                        <div key={u.email} className="flex items-center gap-2">
                          <div className="w-28 text-right text-xs text-slate-600 truncate">{u.nome.split(' ')[0]}</div>
                          <div className="flex-1 bg-slate-100 rounded-full h-4 relative">
                            <div className={`h-4 rounded-full ${sobrecarga ? 'bg-red-400' : 'bg-violet-400'}`} style={{ width: `${pct}%` }} />
                            <span className="absolute right-1.5 top-0 text-[10px] font-semibold text-slate-700 leading-4">{u.demandas}</span>
                          </div>
                          {sobrecarga && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {showConfig && (
        <ConfiguracaoSetoresModal onClose={() => setShowConfig(false)} existingConfigs={configSetores} />
      )}
    </div>
  );
}