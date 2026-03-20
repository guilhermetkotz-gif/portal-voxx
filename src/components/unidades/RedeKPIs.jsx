import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Users, TrendingUp, DollarSign, Activity, Zap, BarChart3 } from 'lucide-react';

export default function RedeKPIs({ unidades, contasMeta = [] }) {
  const kpis = useMemo(() => {
    const ativas = unidades.filter(u => u.status === 'ativo' || !u.status);
    const totalLeads = unidades.reduce((s, u) => s + (u.leadsMes || 0), 0);

    // Somar amount_spent apenas das contas que têm match com alguma unidade oral_sin
    const contasComMatch = contasMeta.filter(m =>
      unidades.some(u =>
        u.meta_ads_account_name?.toLowerCase() === m.account_name?.toLowerCase() ||
        m.account_name?.toLowerCase().includes(u.nome?.toLowerCase())
      )
    );
    const totalInvestimento = contasComMatch.reduce((s, m) => s + (m.amount_spent || 0), 0);
    const cpls = unidades.filter(u => u.cpl > 0).map(u => u.cpl);
    const cplMedio = cpls.length > 0 ? cpls.reduce((s, v) => s + v, 0) / cpls.length : 0;
    const totalConversoes = unidades.reduce((s, u) => s + (u.googleConta?.conversions || 0), 0);
    const frequencias = unidades.filter(u => u.frequencia7d > 0).map(u => u.frequencia7d);
    const frequenciaMedia = frequencias.length > 0 ? frequencias.reduce((s, v) => s + v, 0) / frequencias.length : 0;
    const criticas = unidades.filter(u => u.healthStatus === 'critico').length;

    return [
      {
        label: 'Unidades Ativas',
        value: ativas.length,
        icon: Users,
        color: 'text-violet-600',
        bg: 'bg-violet-50',
        border: 'border-violet-200',
      },
      {
        label: 'Leads do Mês',
        value: totalLeads.toLocaleString('pt-BR'),
        icon: TrendingUp,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
      },
      {
        label: 'CPL Médio da Rede',
        value: cplMedio > 0 ? `R$ ${cplMedio.toFixed(0)}` : '—',
        icon: BarChart3,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
      },
      {
        label: 'Investimento Total',
        value: totalInvestimento > 0 ? `R$ ${(totalInvestimento / 1000).toFixed(1)}k` : '—',
        icon: DollarSign,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
      },
      {
        label: 'Conversões Google',
        value: totalConversoes.toLocaleString('pt-BR'),
        icon: Zap,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
      },
      {
        label: 'Frequência Média 7d',
        value: frequenciaMedia > 0 ? frequenciaMedia.toFixed(2) : '—',
        icon: Activity,
        color: criticas > 0 ? 'text-red-600' : 'text-slate-600',
        bg: criticas > 0 ? 'bg-red-50' : 'bg-slate-50',
        border: criticas > 0 ? 'border-red-200' : 'border-slate-200',
        sub: criticas > 0 ? `${criticas} unidade(s) crítica(s)` : null,
      },
    ];
  }, [unidades]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi, i) => {
        const Icon = kpi.icon;
        return (
          <Card key={i} className={`p-4 border ${kpi.border}`}>
            <div className={`w-9 h-9 ${kpi.bg} rounded-lg flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 ${kpi.color}`} />
            </div>
            <p className="text-xs text-slate-500 mb-0.5">{kpi.label}</p>
            <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
            {kpi.sub && <p className="text-[10px] text-red-500 mt-0.5">{kpi.sub}</p>}
          </Card>
        );
      })}
    </div>
  );
}