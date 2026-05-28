import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, TrendingUp, CalendarRange } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format, startOfMonth, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PERIOD_OPTIONS = [
  { label: 'Mês atual', getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: 'Últimos 7 dias', getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: 'Últimos 30 dias', getValue: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: 'Definir período', getValue: null },
];

export default function DailyLeadsChart({ clienteId, clienteNome }) {
  const [activePeriod, setActivePeriod] = useState(0);
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const isCustom = activePeriod === 3;
  const period = isCustom ? null : PERIOD_OPTIONS[activePeriod].getValue();
  const fromStr = isCustom ? customFrom : format(period.from, 'yyyy-MM-dd');
  const toStr = isCustom ? customTo : format(period.to, 'yyyy-MM-dd');

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ['historicoLeads', clienteId, fromStr, toStr],
    queryFn: () => base44.entities.HistoricoLeadsDiario.filter({ cliente_id: clienteId }),
    enabled: !!clienteId,
    staleTime: 5 * 60 * 1000,
    select: (data) => {
      // Filter by date range and sort
      return data
        .filter(d => d.data_snapshot >= fromStr && d.data_snapshot <= toStr)
        .sort((a, b) => a.data_snapshot.localeCompare(b.data_snapshot))
        .map(d => ({
          ...d,
          dia: format(parseISO(d.data_snapshot), 'dd/MM', { locale: ptBR }),
        }));
    }
  });

  // Usar último snapshot do histórico para os totais (consistente com filtro de período)
  const lastSnapshot = historico.length > 0 ? historico[historico.length - 1] : null;
  const totalMeta = lastSnapshot?.leads_meta || 0;
  const totalGoogle = lastSnapshot?.leads_google || 0;
  const totalGeral = totalMeta + totalGoogle;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-medium text-slate-700">Histórico Diário de Leads</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {PERIOD_OPTIONS.map((opt, idx) => (
              <Button
                key={idx}
                size="sm"
                variant={activePeriod === idx ? 'default' : 'ghost'}
                className={`h-7 text-xs ${activePeriod === idx ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => setActivePeriod(idx)}
              >
                {idx === 3 ? <><CalendarRange className="w-3 h-3 mr-1" />Definir período</> : opt.label}
              </Button>
            ))}
          </div>
          {isCustom && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-7 text-xs w-36"
              />
              <span className="text-xs text-slate-400">até</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-7 text-xs w-36"
              />
            </div>
          )}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-violet-50 rounded-lg p-3 text-center">
          <p className="text-xs text-violet-600 font-medium">Total Meta</p>
          <p className="text-xl font-bold text-violet-700">{totalMeta.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-xs text-blue-600 font-medium">Total Google</p>
          <p className="text-xl font-bold text-blue-700">{totalGoogle.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3 text-center">
          <p className="text-xs text-emerald-600 font-medium">Total Geral</p>
          <p className="text-xl font-bold text-emerald-700">{totalGeral.toLocaleString('pt-BR')}</p>
        </div>
      </div>

      {/* Chart */}
      {historico.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
          <TrendingUp className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Nenhum dado histórico disponível para este período.</p>
          <p className="text-xs mt-1">O histórico é gerado automaticamente todo dia.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={historico} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorMeta" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorGoogle" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
              formatter={(value, name) => [value, name === 'leads_meta' ? 'Meta Ads' : 'Google Ads']}
              labelFormatter={(label) => `Dia: ${label}`}
            />
            <Legend
              formatter={(value) => value === 'leads_meta' ? 'Meta Ads' : 'Google Ads'}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="leads_meta"
              stroke="#7c3aed"
              strokeWidth={2}
              fill="url(#colorMeta)"
              dot={{ r: 3, fill: '#7c3aed' }}
              activeDot={{ r: 5 }}
            />
            <Area
              type="monotone"
              dataKey="leads_google"
              stroke="#2563eb"
              strokeWidth={2}
              fill="url(#colorGoogle)"
              dot={{ r: 3, fill: '#2563eb' }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}