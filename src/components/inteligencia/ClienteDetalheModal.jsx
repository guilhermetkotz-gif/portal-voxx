import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TicketCheck, Clock, Users, Activity, DollarSign, TrendingUp } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const STATUS_LABELS = {
  recebida: 'Recebida', em_triagem: 'Triagem', programada: 'Programada',
  em_execucao: 'Em Execução', aguardando_cliente: 'Aguard. Cliente',
  em_revisao: 'Em Revisão', concluida: 'Concluída', finalizada: 'Finalizada',
};
const STATUS_COLORS = {
  recebida: 'bg-slate-100 text-slate-700', em_triagem: 'bg-yellow-100 text-yellow-700',
  programada: 'bg-blue-100 text-blue-700', em_execucao: 'bg-violet-100 text-violet-700',
  aguardando_cliente: 'bg-amber-100 text-amber-700', em_revisao: 'bg-orange-100 text-orange-700',
  concluida: 'bg-green-100 text-green-700', finalizada: 'bg-emerald-100 text-emerald-700',
};

export default function ClienteDetalheModal({ cliente, open, onClose, setorLabels }) {
  const setorChartData = useMemo(() => {
    if (!cliente) return [];
    return Object.entries(cliente.setor_breakdown || {})
      .map(([s, v]) => ({ name: setorLabels[s] || s, demandas: v }))
      .sort((a, b) => b.demandas - a.demandas);
  }, [cliente, setorLabels]);

  const statusBreakdown = useMemo(() => {
    if (!cliente) return [];
    const map = {};
    (cliente.demandas_raw || []).forEach(d => {
      map[d.status] = (map[d.status] || 0) + 1;
    });
    return Object.entries(map).map(([s, v]) => ({ status: s, count: v }));
  }, [cliente]);

  const recentDemandas = useMemo(() => {
    if (!cliente) return [];
    return (cliente.demandas_raw || []).slice(0, 15);
  }, [cliente]);

  if (!cliente) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {cliente.cliente_nome}
          </DialogTitle>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`${cliente.intensidade.color} border-0`}>{cliente.intensidade.label}</Badge>
            <span className="text-sm text-slate-500">{cliente.qtd_demandas} demandas no período</span>
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* KPIs rápidos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Demandas', value: cliente.qtd_demandas, icon: TicketCheck, color: 'text-violet-600', bg: 'bg-violet-50' },
              { label: 'Custo Est.', value: fmt(cliente.custo_estimado), icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Setores', value: cliente.setores.length, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Usuários', value: cliente.usuarios.length || '—', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            ].map((k, i) => (
              <div key={i} className={`${k.bg} rounded-xl p-3 flex items-center gap-3`}>
                <k.icon className={`w-5 h-5 ${k.color}`} />
                <div>
                  <p className="text-lg font-bold text-slate-900">{k.value}</p>
                  <p className="text-xs text-slate-500">{k.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Demandas por setor */}
          {setorChartData.length > 0 && (
            <Card className="border-0 bg-slate-50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-slate-700">Demandas por Setor</CardTitle>
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={setorChartData} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="demandas" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Status breakdown */}
          {statusBreakdown.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Status das Demandas</p>
              <div className="flex flex-wrap gap-2">
                {statusBreakdown.map((s, i) => (
                  <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[s.status] || 'bg-slate-100 text-slate-700'}`}>
                    {STATUS_LABELS[s.status] || s.status}: {s.count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Setores e usuários */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Setores Participantes</p>
              <div className="flex flex-wrap gap-1.5">
                {cliente.setores.map((s, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{setorLabels[s] || s}</Badge>
                ))}
                {cliente.setores.length === 0 && <span className="text-xs text-slate-400">—</span>}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Usuários Envolvidos</p>
              <div className="flex flex-wrap gap-1.5">
                {cliente.usuarios.slice(0, 10).map((u, i) => (
                  <Badge key={i} variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">{u}</Badge>
                ))}
                {cliente.usuarios.length === 0 && <span className="text-xs text-slate-400">Sem registro</span>}
              </div>
            </div>
          </div>

          {/* Métricas operacionais */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-slate-900">{fmt(cliente.custo_por_demanda)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Custo por demanda</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-slate-900">{cliente.percentual.toFixed(1)}%</p>
              <p className="text-xs text-slate-500 mt-0.5">% da operação total</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-slate-900">{Math.round(cliente.minutos_total / 60)}h</p>
              <p className="text-xs text-slate-500 mt-0.5">Tempo operacional est.</p>
            </div>
          </div>

          {/* Últimas demandas */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Demandas Recentes</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {recentDemandas.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-3 rounded-lg bg-slate-50">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status] || 'bg-slate-100 text-slate-700'}`}>
                    {STATUS_LABELS[d.status] || d.status}
                  </span>
                  <span className="flex-1 text-slate-700 truncate">{d.titulo}</span>
                  <span className="text-slate-400 whitespace-nowrap">{d.setor ? (setorLabels[d.setor] || d.setor) : '—'}</span>
                </div>
              ))}
              {recentDemandas.length === 0 && <span className="text-xs text-slate-400">Nenhuma demanda encontrada</span>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}