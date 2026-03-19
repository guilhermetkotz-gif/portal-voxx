import React from 'react';
import { Card } from '@/components/ui/card';
import { AlertTriangle, Clock, Flame, FileText } from 'lucide-react';

export default function AlertasInteligentes({ leads, reunioes, onFilterClick }) {
  // Leads sem contato
  const semContato = leads.filter(l => !l.ultima_interacao && l.etapa === 'novo_lead');

  // Leads parados (sem contato há mais de 7 dias)
  const leadsParados = leads.filter(l => {
    if (!l.ultima_interacao) return false;
    const dias = Math.floor((Date.now() - new Date(l.ultima_interacao)) / (1000 * 60 * 60 * 24));
    return dias > 7 && !['fechado_ganho', 'fechado_perdido'].includes(l.etapa);
  });

  // Follow-ups pendentes (interações há mais de 3 dias, não em fechado)
  const followUpsPendentes = leads.filter(l => {
    if (!l.ultima_interacao) return true;
    const dias = Math.floor((Date.now() - new Date(l.ultima_interacao)) / (1000 * 60 * 60 * 24));
    return dias >= 3 && !['fechado_ganho', 'fechado_perdido'].includes(l.etapa);
  });

  // Propostas sem resposta (etapa proposta_enviada há mais de 5 dias)
  const propostasSemResposta = leads.filter(l => {
    if (l.etapa !== 'proposta_enviada' || !l.ultima_interacao) return false;
    const dias = Math.floor((Date.now() - new Date(l.ultima_interacao)) / (1000 * 60 * 60 * 24));
    return dias >= 5;
  });

  // Leads quentes (fit alto + recente)
  const leadsQuentes = leads.filter(l => 
    l.fit_classificacao === 'alto_fit' && 
    l.ultima_interacao && 
    Math.floor((Date.now() - new Date(l.ultima_interacao)) / (1000 * 60 * 60 * 24)) <= 3
  );

  const alertas = [
    { icon: AlertTriangle, label: 'sem contato', count: semContato.length, color: 'text-red-600', bg: 'bg-red-50' },
    { icon: Clock, label: 'follow-ups', count: followUpsPendentes.length, color: 'text-amber-600', bg: 'bg-amber-50' },
    { icon: Flame, label: 'leads parados', count: leadsParados.length, color: 'text-orange-600', bg: 'bg-orange-50' },
    { icon: FileText, label: 'propostas', count: propostasSemResposta.length, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-slate-900 text-sm">🔴 ALERTAS DO DIA</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {alertas.map((alerta, idx) => {
          const Icon = alerta.icon;
          return (
            <Card 
              key={idx}
              className={`p-3 cursor-pointer hover:shadow-md transition-all ${alerta.bg} border-0`}
              onClick={() => onFilterClick(alerta.label)}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${alerta.color} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-600 truncate capitalize">{alerta.label}</p>
                  <p className={`text-lg font-bold ${alerta.color}`}>{alerta.count}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}