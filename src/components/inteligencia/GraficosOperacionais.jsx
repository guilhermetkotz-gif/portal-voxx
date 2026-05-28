import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];
const fmt = (v) => `R$ ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)}`;

export default function GraficosOperacionais({ dados, setorLabels }) {
  const top10 = useMemo(() =>
    dados.slice(0, 10).map(d => ({
      name: d.cliente_nome.length > 18 ? d.cliente_nome.slice(0, 18) + '…' : d.cliente_nome,
      custo: Math.round(d.custo_estimado),
      demandas: d.qtd_demandas,
    })),
    [dados]
  );

  const setorData = useMemo(() => {
    const map = {};
    dados.forEach(c => {
      c.setores.forEach(s => {
        map[s] = (map[s] || 0) + (c.setor_breakdown?.[s] || 1);
      });
    });
    return Object.entries(map)
      .map(([s, v]) => ({ name: setorLabels[s] || s, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [dados, setorLabels]);

  const distribuicao = useMemo(() => {
    const total = dados.reduce((s, c) => s + c.custo_estimado, 0);
    return dados.slice(0, 6).map(d => ({
      name: d.cliente_nome.length > 16 ? d.cliente_nome.slice(0, 16) + '…' : d.cliente_nome,
      value: Math.round(d.custo_estimado),
      pct: total > 0 ? ((d.custo_estimado / total) * 100).toFixed(1) : '0',
    }));
  }, [dados]);

  if (dados.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Top 10 clientes por custo */}
      <Card className="lg:col-span-2 border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Top 10 — Maior Custo Operacional</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={top10} margin={{ top: 0, right: 10, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [fmt(v), 'Custo Est.']} />
              <Bar dataKey="custo" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Setores mais acionados */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Setores Mais Acionados</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={setorData}
                cx="50%"
                cy="45%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => `${name.slice(0,8)} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
                fontSize={9}
              >
                {setorData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Distribuição operacional */}
      <Card className="lg:col-span-3 border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Distribuição Operacional — Top 6 Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {distribuicao.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-slate-600 w-36 truncate font-medium">{d.name}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full transition-all"
                    style={{ width: `${d.pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-700 w-10 text-right">{d.pct}%</span>
                <span className="text-xs text-slate-500 w-20 text-right">{fmt(d.value)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}