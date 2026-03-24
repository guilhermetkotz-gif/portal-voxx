import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, TrendingUp } from 'lucide-react';

export default function PrioritizacaoDia({ leads }) {
  const navigate = useNavigate();
  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  // Calcular prioridade: Fit Score + Recência + Etapa + Engajamento
  const calcularPrioridade = (lead) => {
    let score = 0;

    // Fit Score (0-30)
    if (lead.fit_classificacao === 'alto_fit') score += 30;
    else if (lead.fit_classificacao === 'medio_fit') score += 15;

    // Recência (0-30) - mais recente = mais importante
    if (lead.ultima_interacao) {
      const dias = Math.floor((Date.now() - new Date(lead.ultima_interacao)) / (1000 * 60 * 60 * 24));
      if (dias <= 1) score += 30;
      else if (dias <= 3) score += 20;
      else if (dias <= 7) score += 10;
    }

    // Etapa (0-25)
    const etapaPesos = {
      'proposta_enviada': 25,
      'negociacao': 25,
      'qualificado': 20,
      'diagnostico_reuniao': 15,
      'contato_iniciado': 10,
      'novo_lead': 5,
    };
    score += etapaPesos[lead.etapa] || 0;

    // Valor estimado (0-15)
    if (lead.valor_estimado && lead.valor_estimado > 50000) score += 15;
    else if (lead.valor_estimado && lead.valor_estimado > 20000) score += 10;
    else if (lead.valor_estimado) score += 5;

    return score;
  };

  const leadsPrioritizados = leads
    .filter(l => !['fechado_ganho', 'fechado_perdido'].includes(l.etapa))
    .map(l => ({ ...l, prioridade: calcularPrioridade(l) }))
    .sort((a, b) => b.prioridade - a.prioridade)
    .slice(0, 5);

  const getNivelLead = (lead) => {
    const dias = lead.ultima_interacao 
      ? Math.floor((Date.now() - new Date(lead.ultima_interacao)) / (1000 * 60 * 60 * 24))
      : 999;
    
    if (lead.fit_classificacao === 'alto_fit' && dias <= 3) return { label: 'Quente', color: 'bg-red-100 text-red-700' };
    if (dias > 7) return { label: 'Parado', color: 'bg-slate-100 text-slate-700' };
    return { label: 'Morno', color: 'bg-amber-100 text-amber-700' };
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-slate-900 text-sm">🎯 PRIORIDADES DO DIA</h3>
        <Flame className="w-4 h-4 text-orange-600" />
      </div>
      <div className="space-y-2">
        {leadsPrioritizados.map((lead, idx) => {
          const nivel = getNivelLead(lead);
          const dias = lead.ultima_interacao 
            ? Math.floor((Date.now() - new Date(lead.ultima_interacao)) / (1000 * 60 * 60 * 24))
            : null;
          
          return (
            <Card key={lead.id} className="p-3 hover:shadow-md transition-all cursor-pointer" onClick={() => navigate(`/LeadDetalhe?id=${lead.id}`)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-slate-900 truncate">{idx + 1}. {lead.nome_empresa}</span>
                    <Badge className={nivel.color} variant="outline">{nivel.label}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">Fit: {lead.fit_score || '-'}/100 • {capitalize(lead.etapa?.replace(/_/g, ' ') || '')}</p>
                  {dias !== null && (
                    <p className="text-xs text-slate-500">Última: há {dias} dias</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-violet-600">{lead.prioridade}</p>
                  <p className="text-xs text-slate-400">pontos</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}