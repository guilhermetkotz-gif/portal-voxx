import React from 'react';
import { Card } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

export default function InsightsAutomaticos({ leads }) {
  const insights = [];

  // Análise de queda de conversão
  const taxaConversao = leads.filter(l => l.etapa === 'fechado_ganho').length / Math.max(leads.length, 1);
  if (taxaConversao < 0.15) {
    insights.push({
      tipo: 'alerta',
      texto: `Taxa de conversão abaixo de 15%. Considere revisar qualificação ou aumentar follow-ups.`,
    });
  }

  // Aumento de leads parados
  const leadsParados = leads.filter(l => {
    if (l.ultima_interacao) {
      const dias = Math.floor((Date.now() - new Date(l.ultima_interacao)) / (1000 * 60 * 60 * 24));
      return dias >= 7 && !['fechado_ganho', 'fechado_perdido'].includes(l.etapa);
    }
    return false;
  }).length;

  if (leadsParados > leads.length * 0.2) {
    insights.push({
      tipo: 'alerta',
      texto: `${leadsParados} leads parados (${Math.round((leadsParados / leads.length) * 100)}% do total). Ative follow-ups urgente.`,
    });
  }

  // Crescimento de qualificados
  const qualificados = leads.filter(l => ['qualificado', 'proposta_enviada', 'negociacao'].includes(l.etapa)).length;
  if (qualificados > leads.length * 0.3) {
    insights.push({
      tipo: 'positivo',
      texto: `${qualificados} leads em estágios avançados. Funil saudável!`,
    });
  }

  // Gargalo em etapa específica
  const novo = leads.filter(l => l.etapa === 'novo_lead').length;
  const contato = leads.filter(l => l.etapa === 'contato_iniciado').length;
  if (novo > 0 && contato === 0) {
    insights.push({
      tipo: 'atenção',
      texto: `Gargalo em "Novo Lead → Contato Iniciado". ${novo} leads aguardando primeiro contato.`,
    });
  }

  // Fit score baixo
  const fitMedio = leads.length > 0 ? Math.round(leads.reduce((s, l) => s + (l.fit_score || 0), 0) / leads.length) : 0;
  if (fitMedio < 50) {
    insights.push({
      tipo: 'atenção',
      texto: `Fit score médio baixo (${fitMedio}/100). Qualidade de leads pode estar comprometida.`,
    });
  }

  // Oportunidade: leads sem contato
  const semContato = leads.filter(l => !l.ultima_interacao && l.etapa === 'novo_lead').length;
  if (semContato > 0) {
    insights.push({
      tipo: 'oportunidade',
      texto: `${semContato} leads novos esperando contato inicial. Priorize estes!`,
    });
  }

  const iconMap = {
    alerta: '🔴',
    atenção: '🟡',
    oportunidade: '💡',
    positivo: '🟢',
  };

  const colorMap = {
    alerta: 'bg-red-50 border-red-200',
    atenção: 'bg-amber-50 border-amber-200',
    oportunidade: 'bg-blue-50 border-blue-200',
    positivo: 'bg-emerald-50 border-emerald-200',
  };

  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-slate-900 text-sm">💡 INSIGHTS AUTOMÁTICOS</h3>
        <Lightbulb className="w-4 h-4 text-amber-600" />
      </div>
      <div className="space-y-2">
        {insights.map((insight, idx) => (
          <Card key={idx} className={`p-3 border ${colorMap[insight.tipo]}`}>
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">{iconMap[insight.tipo]}</span>
              <p className="text-xs text-slate-700 leading-relaxed">{insight.texto}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}