import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Users, CheckCircle, Clock, ArrowUpCircle, ArrowDownCircle, UserPlus, UserMinus, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const mesAtual = format(new Date(), 'yyyy-MM');

export default function FinanceiroVisaoGeral() {
  const { data: receitas = [] } = useQuery({
    queryKey: ['fin-receitas', mesAtual],
    queryFn: () => base44.entities.FinanceiroReceita.filter({ mes_referencia: mesAtual }),
  });
  const { data: custos = [] } = useQuery({
    queryKey: ['fin-custos', mesAtual],
    queryFn: () => base44.entities.FinanceiroCusto.filter({ mes_referencia: mesAtual }),
  });
  const { data: folha = [] } = useQuery({
    queryKey: ['fin-folha', mesAtual],
    queryFn: () => base44.entities.FinanceiroFolha.filter({ mes_referencia: mesAtual }),
  });
  const { data: clientesFinanceiros = [] } = useQuery({
    queryKey: ['clientesFinanceiros'],
    queryFn: () => base44.entities.ClienteFinanceiro.list('-created_date', 500),
    staleTime: 60 * 1000
  });

  const kpis = useMemo(() => {
    const mrr = receitas.reduce((s, r) => s + (r.valor_mensal || 0), 0);
    const recebido = receitas.filter(r => r.status === 'pago').reduce((s, r) => s + (r.valor_mensal || 0), 0);
    const pendente = receitas.filter(r => r.status === 'a_vencer').reduce((s, r) => s + (r.valor_mensal || 0), 0);
    const atraso = receitas.filter(r => r.status === 'em_atraso').reduce((s, r) => s + (r.valor_mensal || 0), 0);
    const inadimplencia = mrr > 0 ? ((atraso / mrr) * 100).toFixed(1) : 0;
    const custoFixo = custos.filter(c => c.tipo === 'fixo').reduce((s, c) => s + (c.valor || 0), 0);
    const custoVariavel = custos.filter(c => c.tipo === 'variavel').reduce((s, c) => s + (c.valor || 0), 0);
    const custoTotal = custoFixo + custoVariavel;
    const folhaTotal = folha.reduce((s, f) => {
      if (f.tipo_vinculo === 'clt') {
        const vencimentos = (f.salario || 0) + (f.ajuda_de_custo || 0);
        return s + vencimentos - (f.total_descontos || 0);
      }
      return s + (f.valor_pj || 0);
    }, 0);
    const lucro = recebido - custoTotal - folhaTotal;
    const clientesAtivos = clientesFinanceiros.filter(c => c.status === 'ativo').length;
    const clientesNovos = clientesFinanceiros.filter(c => {
      if (!c.data_inicio) return false;
      return c.data_inicio.startsWith(mesAtual);
    }).length;
    const clientesPerdidos = clientesFinanceiros.filter(c => {
      if (c.status !== 'encerrado') return false;
      // Usa data_fim se disponível, senão usa updated_date (quando o status foi alterado)
      const dataReferencia = c.data_fim || (c.updated_date ? c.updated_date.substring(0, 10) : null);
      if (!dataReferencia) return false;
      return dataReferencia.startsWith(mesAtual);
    }).length;
    return { mrr, recebido, pendente, atraso, inadimplencia, custoFixo, custoVariavel, custoTotal, folhaTotal, lucro, clientesAtivos, clientesNovos, clientesPerdidos };
  }, [receitas, custos, folha]);

  const alertas = useMemo(() => {
    const alerts = [];
    receitas.filter(r => r.status === 'em_atraso').forEach(r =>
      alerts.push({ tipo: 'erro', msg: `${r.cliente_nome} em atraso — ${fmt(r.valor_mensal)}` })
    );
    receitas.filter(r => r.status === 'pago' && !r.comprovante_recebimento).forEach(r =>
      alerts.push({ tipo: 'aviso', msg: `Sem comprovante: receita de ${r.cliente_nome}` })
    );
    custos.filter(c => c.status === 'pago' && !c.comprovante_pagamento).forEach(c =>
      alerts.push({ tipo: 'aviso', msg: `Sem comprovante: despesa "${c.nome}"` })
    );
    return alerts;
  }, [receitas, custos]);

  const kpiCards = [
    { label: 'MRR', value: fmt(kpis.mrr), icon: DollarSign, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
    { label: 'Receita Recebida', value: fmt(kpis.recebido), icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { label: 'Pendente', value: fmt(kpis.pendente), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    { label: 'Inadimplência', value: `${kpis.inadimplencia}%`, icon: AlertCircle, color: parseFloat(kpis.inadimplencia) > 0 ? 'text-red-600' : 'text-slate-500', bg: parseFloat(kpis.inadimplencia) > 0 ? 'bg-red-50' : 'bg-slate-50', border: parseFloat(kpis.inadimplencia) > 0 ? 'border-red-200' : 'border-slate-200' },
    { label: 'Custos Fixos', value: fmt(kpis.custoFixo), icon: TrendingDown, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    { label: 'Custo Variável', value: fmt(kpis.custoVariavel), icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    { label: 'Folha Total', value: fmt(kpis.folhaTotal), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    { label: 'Lucro Estimado', value: fmt(kpis.lucro), icon: TrendingUp, color: kpis.lucro >= 0 ? 'text-emerald-600' : 'text-red-600', bg: kpis.lucro >= 0 ? 'bg-emerald-50' : 'bg-red-50', border: kpis.lucro >= 0 ? 'border-emerald-200' : 'border-red-200' },
  ];

  const carteiraCards = [
    { label: 'Clientes Ativos', value: kpis.clientesAtivos, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
    { label: 'Novos no Mês', value: kpis.clientesNovos, icon: UserPlus, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { label: 'Perdidos no Mês', value: kpis.clientesPerdidos, icon: UserMinus, color: kpis.clientesPerdidos > 0 ? 'text-red-600' : 'text-slate-500', bg: kpis.clientesPerdidos > 0 ? 'bg-red-50' : 'bg-slate-50', border: kpis.clientesPerdidos > 0 ? 'border-red-200' : 'border-slate-200' },
    { label: 'Crescimento Líquido', value: kpis.clientesNovos - kpis.clientesPerdidos >= 0 ? `+${kpis.clientesNovos - kpis.clientesPerdidos}` : kpis.clientesNovos - kpis.clientesPerdidos, icon: Activity, color: kpis.clientesNovos - kpis.clientesPerdidos >= 0 ? 'text-emerald-600' : 'text-red-600', bg: kpis.clientesNovos - kpis.clientesPerdidos >= 0 ? 'bg-emerald-50' : 'bg-red-50', border: kpis.clientesNovos - kpis.clientesPerdidos >= 0 ? 'border-emerald-200' : 'border-red-200' },
  ];

  const chartData = [
    { mes: 'Jan', receita: 0, custos: 0 },
    { mes: 'Fev', receita: 0, custos: 0 },
    { mes: 'Mar', receita: 0, custos: 0 },
    { mes: 'Abr', receita: 0, custos: 0 },
    { mes: 'Mai', receita: 0, custos: 0 },
    { mes: format(new Date(), 'MMM', { locale: ptBR }), receita: kpis.recebido, custos: kpis.custoTotal + kpis.folhaTotal },
  ];

  const quickLinks = [
    { label: 'Receitas', page: 'FinanceiroReceitas', icon: ArrowUpCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', count: receitas.length },
    { label: 'Custos', page: 'FinanceiroCustos', icon: ArrowDownCircle, color: 'text-red-600', bg: 'bg-red-50', count: custos.length },
    { label: 'Folha', page: 'FinanceiroFolha', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', count: folha.length },
    { label: 'Documentos', page: 'FinanceiroDocumentos', icon: DollarSign, color: 'text-violet-600', bg: 'bg-violet-50', count: receitas.filter(r => r.comprovante_recebimento).length + custos.filter(c => c.comprovante_pagamento).length + folha.filter(f => f.holerite_url || f.nota_fiscal_url || f.comprovante_pagamento_url).length },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 to-violet-900 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-violet-600/30 rounded-xl border border-violet-500/30">
            <DollarSign className="w-5 h-5 text-violet-300" />
          </div>
          <div>
            <p className="text-violet-300 text-xs font-semibold uppercase tracking-widest">Módulo Financeiro VOXX</p>
            <h1 className="text-2xl font-bold">Visão Geral Financeira</h1>
          </div>
        </div>
        <p className="text-slate-400 text-sm mt-1">{format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {kpiCards.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <Card key={i} className={`p-4 border ${kpi.border}`}>
              <div className={`w-8 h-8 ${kpi.bg} rounded-lg flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className="text-[10px] text-slate-500 mb-0.5">{kpi.label}</p>
              <p className={`text-sm font-bold ${kpi.color}`}>{kpi.value}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Receita vs Custos (mês atual)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt(v)} />
              <Bar dataKey="receita" fill="#10b981" name="Receita" radius={[4, 4, 0, 0]} />
              <Bar dataKey="custos" fill="#ef4444" name="Custos+Folha" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" /> Alertas ({alertas.length})
          </h2>
          <div className="space-y-2 max-h-[220px] overflow-y-auto">
            {alertas.length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-600 text-sm">
                <CheckCircle className="w-4 h-4" /> Tudo em ordem!
              </div>
            ) : alertas.map((a, i) => (
              <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${a.tipo === 'erro' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{a.msg}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Carteira de Clientes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-500" /> Carteira de Clientes — Mês Atual
          </h2>
          <Link to="/FinanceiroCarteira" className="text-xs text-violet-600 hover:underline">Ver detalhes →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {carteiraCards.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <Card key={i} className={`p-4 border ${kpi.border}`}>
                <div className={`w-8 h-8 ${kpi.bg} rounded-lg flex items-center justify-center mb-2`}>
                  <Icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
                <p className="text-[10px] text-slate-500 mb-0.5">{kpi.label}</p>
                <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickLinks.map((item, i) => {
          const Icon = item.icon;
          return (
            <Link key={i} to={`/${item.page}`}>
              <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer border hover:border-violet-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                    <p className={`text-3xl font-bold ${item.color}`}>{item.count}</p>
                    <p className="text-xs text-slate-400 mt-0.5">registros</p>
                  </div>
                  <div className={`w-12 h-12 ${item.bg} rounded-xl flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${item.color}`} />
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}