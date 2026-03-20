import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Trophy, AlertTriangle, TrendingDown } from 'lucide-react';

function RankItem({ pos, nome, cidade, value, label, color }) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0 border-slate-100 cursor-pointer hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors">
      <span className="text-base w-6 text-center">{medals[pos - 1] || `${pos}.`}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{nome}</p>
        <p className="text-xs text-slate-400">{cidade}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold ${color}`}>{value}</p>
        <p className="text-[10px] text-slate-400">{label}</p>
      </div>
    </div>
  );
}

export default function RankingPanel({ unidades, onSelectUnidade }) {
  const topLeads = useMemo(() =>
    [...unidades].filter(u => u.leadsMes > 0).sort((a, b) => b.leadsMes - a.leadsMes).slice(0, 5),
    [unidades]
  );

  const emAlerta = useMemo(() =>
    unidades.filter(u => u.healthStatus === 'critico' || u.healthStatus === 'atencao')
      .sort((a, b) => {
        const order = { critico: 0, atencao: 1 };
        return (order[a.healthStatus] ?? 2) - (order[b.healthStatus] ?? 2);
      }).slice(0, 5),
    [unidades]
  );

  const maiorVariacao = useMemo(() =>
    [...unidades].filter(u => Math.abs(u.variacao) > 0).sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao)).slice(0, 5),
    [unidades]
  );

  const panels = [
    {
      title: 'Top Performance',
      icon: Trophy,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50',
      items: topLeads,
      getValue: u => `${u.leadsMes} leads`,
      getLabel: () => 'no mês',
      getColor: () => 'text-emerald-600',
    },
    {
      title: 'Unidades em Alerta',
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
      items: emAlerta,
      getValue: u => u.healthStatus === 'critico' ? '🔴 Crítico' : '🟡 Atenção',
      getLabel: u => u.cpl > 0 ? `CPL R$ ${u.cpl.toFixed(0)}` : 'Sem dados',
      getColor: u => u.healthStatus === 'critico' ? 'text-red-600' : 'text-amber-600',
    },
    {
      title: 'Maior Variação de CPL',
      icon: TrendingDown,
      iconColor: 'text-indigo-500',
      bgColor: 'bg-indigo-50',
      items: maiorVariacao,
      getValue: u => `${u.variacao > 0 ? '+' : ''}${u.variacao.toFixed(0)}%`,
      getLabel: () => 'vs. 7 dias',
      getColor: u => u.variacao > 0 ? 'text-red-600' : 'text-emerald-600',
    },
  ];

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {panels.map((panel, i) => {
        const Icon = panel.icon;
        return (
          <Card key={i} className="overflow-hidden">
            <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${panel.bgColor}`}>
              <div className={`p-1.5 bg-white rounded-lg shadow-sm`}>
                <Icon className={`w-4 h-4 ${panel.iconColor}`} />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">{panel.title}</h3>
            </div>
            <div className="p-4">
              {panel.items.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Sem dados disponíveis</p>
              ) : (
                panel.items.map((u, idx) => (
                  <div key={u.id} onClick={() => onSelectUnidade(u)}>
                    <RankItem
                      pos={idx + 1}
                      nome={u.nome}
                      cidade={u.cidade}
                      value={panel.getValue(u)}
                      label={panel.getLabel(u)}
                      color={panel.getColor(u)}
                    />
                  </div>
                ))
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}