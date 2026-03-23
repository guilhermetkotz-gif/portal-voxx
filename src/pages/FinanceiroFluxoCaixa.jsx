import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  TrendingUp, TrendingDown, DollarSign, Users, Wrench,
  AlertCircle, CheckCircle, ArrowDown, ArrowUp, BarChart3,
  Minus, Activity
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart
} from 'recharts';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
const fmtPct = (v) => `${(v || 0).toFixed(1)}%`;

function KPIBlock({ label, value, sub, color, icon: Icon, trend }) {
  return (
    <div className={`rounded-2xl border p-5 ${color}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium opacity-70">{label}</p>
        {Icon && <Icon className="w-5 h-5 opacity-50" />}
      </div>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          {trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          <span className="text-xs font-medium">{trend > 0 ? '+' : ''}{fmtPct(trend)} vs mês anterior</span>
        </div>
      )}
    </div>
  );
}

function DRELine({ label, value, indent = false, bold = false, separator = false, color = '' }) {
  return (
    <>
      {separator && <div className="border-t border-slate-200 my-2" />}
      <div className={`flex items-center justify-between py-2 ${indent ? 'pl-6' : ''}`}>
        <span className={`text-sm ${bold ? 'font-bold text-slate-800' : 'text-slate-600'} ${indent ? 'text-slate-500' : ''}`}>{label}</span>
        <span className={`text-sm font-semibold ${color || (bold ? 'text-slate-900' : 'text-slate-700')}`}>{value}</span>
      </div>
    </>
  );
}

export default function FinanceiroFluxoCaixa() {
  const now = new Date();
  const [mes, setMes] = useState(format(now, 'yyyy-MM'));

  // Fetch 6 months for chart
  const meses = Array.from({ length: 6 }, (_, i) => format(subMonths(now, 5 - i), 'yyyy-MM'));

  const { data: receitas = [] } = useQuery({
    queryKey: ['fluxo-receitas', mes],
    queryFn: () => base44.entities.FinanceiroReceita.filter({ mes_referencia: mes }),
  });
  const { data: custos = [] } = useQuery({
    queryKey: ['fluxo-custos', mes],
    queryFn: () => base44.entities.FinanceiroCusto.filter({ mes_referencia: mes }),
  });
  const { data: folha = [] } = useQuery({
    queryKey: ['fluxo-folha', mes],
    queryFn: () => base44.entities.FinanceiroFolha.filter({ mes_referencia: mes }),
  });

  // Multi-month data for chart
  const { data: receitasAll = [] } = useQuery({
    queryKey: ['fluxo-receitas-all'],
    queryFn: () => base44.entities.FinanceiroReceita.list('-mes_referencia', 500),
  });
  const { data: custosAll = [] } = useQuery({
    queryKey: ['fluxo-custos-all'],
    queryFn: () => base44.entities.FinanceiroCusto.list('-mes_referencia', 500),
  });
  const { data: folhaAll = [] } = useQuery({
    queryKey: ['fluxo-folha-all'],
    queryFn: () => base44.entities.FinanceiroFolha.list('-mes_referencia', 500),
  });

  const calc = useMemo(() => {
    // Receitas
    const recReal = receitas.filter(r => r.status === 'pago').reduce((s, r) => s + (r.valor_mensal || 0), 0);
    const recPrev = receitas.filter(r => r.status !== 'pago').reduce((s, r) => s + (r.valor_mensal || 0), 0);
    const recAtras = receitas.filter(r => r.status === 'em_atraso').reduce((s, r) => s + (r.valor_mensal || 0), 0);
    const recTotal = receitas.reduce((s, r) => s + (r.valor_mensal || 0), 0);

    // Folha
    const folhaCLT = folha.filter(f => f.tipo_vinculo === 'clt')
      .reduce((s, f) => s + (f.salario || 0) + (f.vale_alimentacao || 0) + (f.vale_transporte || 0) + (f.outros_beneficios || 0), 0);
    const folhaPJ = folha.filter(f => f.tipo_vinculo === 'pj')
      .reduce((s, f) => s + (f.valor_pj || 0), 0);
    const totalFolha = folhaCLT + folhaPJ;
    const folhaPago = folha.filter(f => f.status === 'pago')
      .reduce((s, f) => s + (f.tipo_vinculo === 'clt' ? (f.salario || 0) + (f.vale_alimentacao || 0) + (f.vale_transporte || 0) + (f.outros_beneficios || 0) : (f.valor_pj || 0)), 0);

    // Custos
    const fixos = custos.filter(c => c.tipo === 'fixo').reduce((s, c) => s + (c.valor || 0), 0);
    const variaveis = custos.filter(c => c.tipo === 'variavel').reduce((s, c) => s + (c.valor || 0), 0);
    const totalCustos = fixos + variaveis;
    const custosPago = custos.filter(c => c.status === 'pago').reduce((s, c) => s + (c.valor || 0), 0);

    const totalSaidas = totalCustos + totalFolha;
    const lucroBruto = recTotal - totalCustos;
    const lucroLiquido = recTotal - totalSaidas;
    const margem = recTotal > 0 ? (lucroLiquido / recTotal) * 100 : 0;

    const lucroReal = recReal - (custosPago + folhaPago);
    const lucroPrevisto = recTotal - totalSaidas;

    return { recReal, recPrev, recAtras, recTotal, folhaCLT, folhaPJ, totalFolha, folhaPago, fixos, variaveis, totalCustos, custosPago, totalSaidas, lucroBruto, lucroLiquido, margem, lucroReal, lucroPrevisto };
  }, [receitas, custos, folha]);

  const chartData = useMemo(() => meses.map(m => {
    const recs = receitasAll.filter(r => r.mes_referencia === m);
    const csts = custosAll.filter(c => c.mes_referencia === m);
    const fols = folhaAll.filter(f => f.mes_referencia === m);
    const receita = recs.reduce((s, r) => s + (r.valor_mensal || 0), 0);
    const custoTotal = csts.reduce((s, c) => s + (c.valor || 0), 0);
    const folhaTotal = fols.reduce((s, f) => s + (f.tipo_vinculo === 'clt' ? (f.salario || 0) + (f.vale_alimentacao || 0) + (f.vale_transporte || 0) + (f.outros_beneficios || 0) : (f.valor_pj || 0)), 0);
    const saidas = custoTotal + folhaTotal;
    return {
      mes: m.slice(5),
      Receita: receita,
      Saídas: saidas,
      Resultado: receita - saidas,
    };
  }), [receitasAll, custosAll, folhaAll, meses]);

  const alertas = [];
  if (calc.margem < 20 && calc.recTotal > 0) alertas.push({ type: 'red', msg: `Margem baixa: ${fmtPct(calc.margem)} — abaixo de 20%` });
  if (calc.recAtras > 0) alertas.push({ type: 'red', msg: `${fmt(calc.recAtras)} em receitas atrasadas` });
  if (calc.lucroLiquido < 0) alertas.push({ type: 'red', msg: `Resultado negativo: prejuízo de ${fmt(Math.abs(calc.lucroLiquido))}` });
  if (calc.totalFolha > calc.recTotal * 0.5 && calc.recTotal > 0) alertas.push({ type: 'yellow', msg: `Folha representa mais de 50% da receita` });
  if (calc.recPrev > calc.recReal && calc.recTotal > 0) alertas.push({ type: 'yellow', msg: `Mais receita prevista (${fmt(calc.recPrev)}) do que recebida (${fmt(calc.recReal)})` });

  const lucroCor = calc.lucroLiquido > 0 ? 'text-emerald-600' : 'text-red-600';
  const margemCor = calc.margem >= 30 ? 'text-emerald-600' : calc.margem >= 15 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-xl">
            <Activity className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Fluxo de Caixa</h1>
            <p className="text-slate-500 text-sm">DRE simplificada — visão executiva do negócio</p>
          </div>
        </div>
        <input
          type="month"
          value={mes}
          onChange={e => setMes(e.target.value)}
          className="border border-input rounded-md px-3 py-1.5 text-sm bg-white"
        />
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium
              ${a.type === 'red' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* KPIs topo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPIBlock label="Receita Total" value={fmt(calc.recTotal)} sub={`Recebida: ${fmt(calc.recReal)}`} color="bg-emerald-50 border-emerald-200 text-emerald-800" icon={TrendingUp} />
        <KPIBlock label="Total Saídas" value={fmt(calc.totalSaidas)} sub={`Folha: ${fmt(calc.totalFolha)} · Custos: ${fmt(calc.totalCustos)}`} color="bg-red-50 border-red-200 text-red-800" icon={TrendingDown} />
        <KPIBlock label="Lucro Líquido" value={fmt(calc.lucroLiquido)} sub={`Real: ${fmt(calc.lucroReal)}`} color={calc.lucroLiquido >= 0 ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'} icon={DollarSign} />
        <KPIBlock label="Margem" value={fmtPct(calc.margem)} sub={calc.margem >= 30 ? '✅ Saudável' : calc.margem >= 15 ? '⚠️ Atenção' : '🔴 Crítica'} color={calc.margem >= 30 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : calc.margem >= 15 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-800'} icon={BarChart3} />
      </div>

      {/* DRE + Gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DRE */}
        <Card className="p-6">
          <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-violet-600" /> Demonstrativo de Resultado
          </h2>
          <div className="space-y-0">
            <DRELine label="(+) Receita Total" value={fmt(calc.recTotal)} bold />
            <DRELine label="Recebida" value={fmt(calc.recReal)} indent color="text-emerald-600" />
            <DRELine label="Prevista / Pendente" value={fmt(calc.recPrev)} indent color="text-amber-600" />
            {calc.recAtras > 0 && <DRELine label="Em Atraso" value={fmt(calc.recAtras)} indent color="text-red-600" />}

            <DRELine label="(-) Folha de Pagamento" value={`-${fmt(calc.totalFolha)}`} bold separator color="text-red-600" />
            <DRELine label="CLT" value={fmt(calc.folhaCLT)} indent />
            <DRELine label="PJ" value={fmt(calc.folhaPJ)} indent />

            <DRELine label="(-) Custos Fixos" value={`-${fmt(calc.fixos)}`} bold separator color="text-red-600" />
            <DRELine label="(-) Custos Variáveis" value={`-${fmt(calc.variaveis)}`} bold color="text-red-600" />

            <DRELine label="= LUCRO BRUTO" value={fmt(calc.lucroBruto)} bold separator color={calc.lucroBruto >= 0 ? 'text-emerald-600' : 'text-red-600'} />
            <DRELine label="= LUCRO LÍQUIDO" value={fmt(calc.lucroLiquido)} bold color={calc.lucroLiquido >= 0 ? 'text-emerald-700' : 'text-red-700'} />
            <DRELine label="Margem Líquida" value={fmtPct(calc.margem)} bold color={margemCor} />
          </div>
        </Card>

        {/* Previsto vs Real */}
        <Card className="p-6">
          <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-violet-600" /> Previsto vs Realizado
          </h2>
          <div className="space-y-4">
            {/* Receita */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Receita</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-emerald-600 mb-1">Realizado</p>
                  <p className="text-xl font-bold text-emerald-700">{fmt(calc.recReal)}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Previsto</p>
                  <p className="text-xl font-bold text-slate-600">{fmt(calc.recPrev)}</p>
                </div>
              </div>
            </div>
            {/* Custos */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Custos</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-red-600 mb-1">Pago</p>
                  <p className="text-xl font-bold text-red-700">{fmt(calc.custosPago + calc.folhaPago)}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Previsto</p>
                  <p className="text-xl font-bold text-slate-600">{fmt(calc.totalSaidas - calc.custosPago - calc.folhaPago)}</p>
                </div>
              </div>
            </div>
            {/* Resultado */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Resultado</p>
              <div className="grid grid-cols-2 gap-3">
                <div className={`border rounded-xl p-3 text-center ${calc.lucroReal >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <p className={`text-xs mb-1 ${calc.lucroReal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Real</p>
                  <p className={`text-xl font-bold ${calc.lucroReal >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(calc.lucroReal)}</p>
                </div>
                <div className={`border rounded-xl p-3 text-center ${calc.lucroPrevisto >= 0 ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="text-xs text-slate-500 mb-1">Projetado</p>
                  <p className={`text-xl font-bold ${calc.lucroPrevisto >= 0 ? 'text-slate-600' : 'text-red-600'}`}>{fmt(calc.lucroPrevisto)}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Gráfico evolução */}
      <Card className="p-6">
        <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-violet-600" /> Evolução Mensal — Receita vs Saídas vs Resultado
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
            <Tooltip formatter={v => fmt(v)} />
            <Legend />
            <Bar dataKey="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="Resultado" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Detalhe custos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-slate-800 text-sm">Folha de Pagamento</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-2">{fmt(calc.totalFolha)}</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">CLT</span><span className="font-medium">{fmt(calc.folhaCLT)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">PJ</span><span className="font-medium">{fmt(calc.folhaPJ)}</span></div>
            <div className="flex justify-between border-t pt-1.5"><span className="text-slate-500">Pago</span><span className="font-medium text-emerald-600">{fmt(calc.folhaPago)}</span></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="w-4 h-4 text-amber-600" />
            <h3 className="font-semibold text-slate-800 text-sm">Custos Fixos</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-2">{fmt(calc.fixos)}</p>
          <div className="space-y-1.5 text-sm">
            {custos.filter(c => c.tipo === 'fixo').slice(0, 4).map(c => (
              <div key={c.id} className="flex justify-between">
                <span className="text-slate-500 truncate max-w-[120px]">{c.nome}</span>
                <span className={`font-medium ${c.status === 'pago' ? 'text-emerald-600' : c.is_previsto ? 'text-slate-400' : 'text-amber-600'}`}>{fmt(c.valor)}</span>
              </div>
            ))}
            {custos.filter(c => c.tipo === 'fixo').length > 4 && (
              <p className="text-xs text-slate-400">+{custos.filter(c => c.tipo === 'fixo').length - 4} itens</p>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-purple-600" />
            <h3 className="font-semibold text-slate-800 text-sm">Custos Variáveis</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-2">{fmt(calc.variaveis)}</p>
          <div className="space-y-1.5 text-sm">
            {custos.filter(c => c.tipo === 'variavel').slice(0, 4).map(c => (
              <div key={c.id} className="flex justify-between">
                <span className="text-slate-500 truncate max-w-[120px]">{c.nome}</span>
                <span className={`font-medium ${c.status === 'pago' ? 'text-emerald-600' : c.is_previsto ? 'text-slate-400' : 'text-amber-600'}`}>{fmt(c.valor)}</span>
              </div>
            ))}
            {custos.filter(c => c.tipo === 'variavel').length === 0 && <p className="text-xs text-slate-400">Nenhum custo variável</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}