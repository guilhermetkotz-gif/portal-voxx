import React from 'react';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { AlertTriangle } from 'lucide-react';

const ETAPAS = [
  'novo_lead',
  'contato_iniciado',
  'diagnostico_reuniao',
  'qualificado',
  'proposta_enviada',
  'negociacao',
  'fechado_ganho',
];

export default function PerformanceFunilDashboard({ leads }) {
  // Distribuição por etapa
  const distribuicao = ETAPAS.map(etapa => ({
    name: etapa.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    leads: leads.filter(l => l.etapa === etapa).length,
  }));

  // Taxa de conversão entre etapas
  const taxasConversao = [];
  for (let i = 0; i < ETAPAS.length - 1; i++) {
    const atual = leads.filter(l => l.etapa === ETAPAS[i]).length;
    const proxima = leads.filter(l => l.etapa === ETAPAS[i + 1]).length;
    const taxa = atual > 0 ? Math.round((proxima / atual) * 100) : 0;
    taxasConversao.push({
      name: `${ETAPAS[i].replace(/_/g, ' ').substring(0, 8)} →`,
      taxa,
      isGargalo: taxa < 30,
    });
  }

  // Tempo médio por etapa (calculado a partir de ultima_interacao)
  const tempoMedioPorEtapa = ETAPAS.map(etapa => {
    const leadsEtapa = leads.filter(l => l.etapa === etapa);
    if (leadsEtapa.length === 0) return { name: etapa.replace(/_/g, ' ').substring(0, 8), dias: 0 };
    
    const totalDias = leadsEtapa.reduce((s, l) => {
      if (!l.ultima_interacao) return s + 7; // assumir 7 dias
      return s + Math.floor((Date.now() - new Date(l.ultima_interacao)) / (1000 * 60 * 60 * 24));
    }, 0);
    
    return {
      name: etapa.replace(/_/g, ' ').substring(0, 8),
      dias: Math.round(totalDias / leadsEtapa.length),
    };
  });

  // Gargalos (taxa < 30%)
  const gargalos = taxasConversao.filter(t => t.isGargalo);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900 text-sm">📈 PERFORMANCE DO FUNIL</h3>
      
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Distribuição */}
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-700 mb-3">Distribuição por Etapa</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={distribuicao}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="leads" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Taxa de conversão */}
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-700 mb-3">Taxa de Conversão Entre Etapas</p>
          <div className="space-y-2">
            {taxasConversao.map((taxa, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{taxa.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-slate-200 rounded h-1.5">
                    <div
                      className={`h-full rounded ${taxa.isGargalo ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(taxa.taxa, 100)}%` }}
                    />
                  </div>
                  <span className={`font-semibold ${taxa.isGargalo ? 'text-red-600' : 'text-emerald-600'}`}>
                    {taxa.taxa}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Tempo médio */}
      <Card className="p-4">
        <p className="text-xs font-semibold text-slate-700 mb-3">Tempo Médio por Etapa (dias)</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={tempoMedioPorEtapa}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="dias" stroke="#8b5cf6" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Gargalos */}
      {gargalos.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-red-900">Gargalos Identificados</p>
            <p className="text-xs text-red-700 mt-1">
              {gargalos.map(g => g.name).join(', ')} têm taxa de conversão abaixo de 30%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}