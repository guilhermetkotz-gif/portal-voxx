import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Users, TrendingUp, DollarSign, Send, CheckCircle, XCircle, Target, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { startOfMonth } from 'date-fns';

const ETAPA_LABELS = {
  novo_lead: 'Novo Lead', contato_iniciado: 'Contato Iniciado',
  diagnostico_reuniao: 'Diagnóstico', qualificado: 'Qualificado',
  proposta_enviada: 'Proposta', negociacao: 'Negociação',
  fechado_ganho: 'Ganho', fechado_perdido: 'Perdido'
};

const ETAPA_COLORS = ['#8b5cf6','#6366f1','#3b82f6','#0ea5e9','#14b8a6','#f59e0b','#22c55e','#ef4444'];

export default function DashboardComercial() {
  const { data: leads = [] } = useQuery({
    queryKey: ['leadsComercialDash'],
    queryFn: () => base44.entities.LeadComercial.list('-created_date', 500),
    staleTime: 60 * 1000
  });

  const inicioMes = startOfMonth(new Date()).toISOString();
  const leadsMes = leads.filter(l => l.created_date >= inicioMes);

  const totalLeads = leads.length;
  const emNegociacao = leads.filter(l => !['fechado_ganho','fechado_perdido'].includes(l.etapa));
  const ganhos = leads.filter(l => l.etapa === 'fechado_ganho');
  const perdidos = leads.filter(l => l.etapa === 'fechado_perdido');
  const propostas = leads.filter(l => l.proposta?.status === 'enviada' || l.etapa === 'proposta_enviada');
  const valorNegociacao = emNegociacao.reduce((s, l) => s + (l.valor_estimado || 0), 0);
  const ticketMedio = ganhos.length > 0
    ? ganhos.reduce((s, l) => s + (l.proposta?.valor_proposto || l.valor_estimado || 0), 0) / ganhos.length
    : 0;
  const taxaConversao = (totalLeads > 0 ? (ganhos.length / totalLeads) * 100 : 0).toFixed(1);

  const porEtapa = Object.entries(ETAPA_LABELS).map(([key, label]) => ({
    name: label,
    total: leads.filter(l => l.etapa === key).length
  }));

  const kpis = [
    { label: 'Total de Leads', value: totalLeads, icon: Users, color: 'text-violet-600 bg-violet-100' },
    { label: 'Em Negociação', value: emNegociacao.length, icon: TrendingUp, color: 'text-blue-600 bg-blue-100' },
    { label: 'Propostas Enviadas', value: propostas.length, icon: Send, color: 'text-amber-600 bg-amber-100' },
    { label: 'Fechados (Ganho)', value: ganhos.length, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-100' },
    { label: 'Taxa de Conversão', value: `${taxaConversao}%`, icon: Target, color: 'text-indigo-600 bg-indigo-100' },
    { label: 'Ticket Médio', value: ticketMedio > 0 ? `R$ ${Math.round(ticketMedio).toLocaleString('pt-BR')}` : '-', icon: DollarSign, color: 'text-teal-600 bg-teal-100' },
    { label: 'Valor em Negociação', value: `R$ ${Math.round(valorNegociacao).toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-purple-600 bg-purple-100' },
    { label: 'Leads no Mês', value: leadsMes.length, icon: Clock, color: 'text-pink-600 bg-pink-100' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <Card key={kpi.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">{kpi.label}</p>
                <p className="text-xl font-bold text-slate-900">{kpi.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">Leads por Etapa do Funil</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={porEtapa} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="total" fill="#8b5cf6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">Distribuição por Fit Score</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Alto Fit', value: leads.filter(l => l.fit_classificacao === 'alto_fit').length },
                  { name: 'Médio Fit', value: leads.filter(l => l.fit_classificacao === 'medio_fit').length },
                  { name: 'Baixo Fit', value: leads.filter(l => l.fit_classificacao === 'baixo_fit').length },
                  { name: 'Não avaliado', value: leads.filter(l => !l.fit_classificacao).length },
                ]}
                cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                dataKey="value" paddingAngle={3}
              >
                {['#22c55e','#f59e0b','#ef4444','#94a3b8'].map((color, i) => (
                  <Cell key={i} fill={color} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Alertas */}
      {leads.filter(l => l.alerta_inatividade).length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50">
          <h3 className="font-semibold text-amber-800 mb-2 text-sm">⚠️ Alertas de Inatividade</h3>
          <div className="space-y-1">
            {leads.filter(l => l.alerta_inatividade).map(l => (
              <p key={l.id} className="text-sm text-amber-700">• {l.nome_empresa} — sem interação recente</p>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}