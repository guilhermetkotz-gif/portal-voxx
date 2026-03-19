import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Flame, AlertTriangle, TrendingUp } from 'lucide-react';

export default function InteligenciaRiscoDashboard({ leads }) {
  // Leads em risco (critérios múltiplos)
  const leadsEmRisco = leads.filter(l => {
    if (['fechado_ganho', 'fechado_perdido'].includes(l.etapa)) return false;
    
    let risco = 0;
    
    // Sem interação recente (5+ dias)
    if (l.ultima_interacao) {
      const dias = Math.floor((Date.now() - new Date(l.ultima_interacao)) / (1000 * 60 * 60 * 24));
      if (dias >= 5) risco += 2;
    } else {
      risco += 3;
    }
    
    // Proposta enviada sem resposta (3+ dias)
    if (l.etapa === 'proposta_enviada' && l.ultima_interacao) {
      const dias = Math.floor((Date.now() - new Date(l.ultima_interacao)) / (1000 * 60 * 60 * 24));
      if (dias >= 3) risco += 2;
    }
    
    // Tempo alto na etapa (7+ dias)
    if (l.ultima_interacao) {
      const dias = Math.floor((Date.now() - new Date(l.ultima_interacao)) / (1000 * 60 * 60 * 24));
      if (dias >= 7) risco += 1;
    }
    
    return risco >= 2;
  });

  // Leads quentes (fit alto + recente + estágio avançado)
  const leadsQuentes = leads.filter(l => {
    const fitAlto = l.fit_classificacao === 'alto_fit';
    const recente = l.ultima_interacao && 
      Math.floor((Date.now() - new Date(l.ultima_interacao)) / (1000 * 60 * 60 * 24)) <= 2;
    const avancado = ['qualificado', 'proposta_enviada', 'negociacao'].includes(l.etapa);
    return fitAlto && recente && avancado;
  });

  // Fit score médio
  const fitMedio = leads.length > 0
    ? Math.round(leads.reduce((s, l) => s + (l.fit_score || 0), 0) / leads.length)
    : 0;

  // Distribuição por origem
  const origens = [...new Set(leads.map(l => l.origem).filter(Boolean))];
  const distribuicaoOrigem = origens.map(origem => ({
    name: origem.charAt(0).toUpperCase() + origem.slice(1),
    value: leads.filter(l => l.origem === origem).length,
  }));

  const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981'];

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900 text-sm">🧠 INTELIGÊNCIA & RISCO</h3>
      
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Leads em Risco */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-xs font-semibold text-slate-700">Leads em Risco</p>
            <Badge className="bg-red-100 text-red-700 text-xs">{leadsEmRisco.length}</Badge>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {leadsEmRisco.slice(0, 4).map(lead => (
              <div key={lead.id} className="text-xs p-1.5 bg-red-50 rounded truncate">
                {lead.nome_empresa}
              </div>
            ))}
            {leadsEmRisco.length > 4 && (
              <p className="text-xs text-slate-500 italic">+ {leadsEmRisco.length - 4} mais em risco</p>
            )}
          </div>
        </Card>

        {/* Leads Quentes */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-orange-600" />
            <p className="text-xs font-semibold text-slate-700">Leads Quentes</p>
            <Badge className="bg-orange-100 text-orange-700 text-xs">{leadsQuentes.length}</Badge>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {leadsQuentes.slice(0, 4).map(lead => (
              <div key={lead.id} className="text-xs p-1.5 bg-orange-50 rounded truncate">
                🔥 {lead.nome_empresa}
              </div>
            ))}
            {leadsQuentes.length > 4 && (
              <p className="text-xs text-slate-500 italic">+ {leadsQuentes.length - 4} mais quentes</p>
            )}
          </div>
        </Card>
      </div>

      {/* Fit Score e Origem */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-700 mb-3">Fit Score Médio</p>
          <div className="flex items-end gap-3">
            <div className="text-3xl font-bold text-violet-600">{fitMedio}</div>
            <div className="text-xs text-slate-500 mb-1">/100</div>
          </div>
          <div className="mt-3 w-full bg-slate-200 rounded h-2">
            <div
              className="bg-violet-600 rounded h-2 transition-all"
              style={{ width: `${fitMedio}%` }}
            />
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-700 mb-3">Origem dos Leads</p>
          {distribuicaoOrigem.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie
                  data={distribuicaoOrigem}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={50}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {distribuicaoOrigem.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-slate-500">Sem dados</p>
          )}
        </Card>
      </div>
    </div>
  );
}