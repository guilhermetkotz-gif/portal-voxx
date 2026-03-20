import React from 'react';
import { Card } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

function gerarInsight(unidade) {
  const insights = [];

  const { cpl, variacao, frequencia7d, leadsMes, leadsOntem, healthStatus, googleConta } = unidade;

  // CPL
  if (cpl > 0) {
    if (cpl > 200) insights.push({ tipo: 'critico', texto: `CPL de R$ ${cpl.toFixed(0)} está acima do ideal (>R$ 200). Recomenda-se revisão urgente de segmentação e criativos.` });
    else if (cpl > 120) insights.push({ tipo: 'atencao', texto: `CPL de R$ ${cpl.toFixed(0)} está elevado. Monitorar evolução e avaliar ajuste nos conjuntos de anúncio.` });
    else insights.push({ tipo: 'positivo', texto: `CPL de R$ ${cpl.toFixed(0)} está em patamar saudável para a rede.` });
  }

  // Variação de CPL
  if (Math.abs(variacao) > 5) {
    if (variacao > 20) insights.push({ tipo: 'critico', texto: `CPL subiu ${variacao.toFixed(0)}% vs. 7 dias. Possível saturação de público ou queda de qualidade de criativo.` });
    else if (variacao > 10) insights.push({ tipo: 'atencao', texto: `Variação de CPL +${variacao.toFixed(0)}% — tendência de alta. Ação preventiva recomendada.` });
    else if (variacao < -10) insights.push({ tipo: 'positivo', texto: `CPL reduziu ${Math.abs(variacao).toFixed(0)}% em relação aos últimos 7 dias. Campanha com boa evolução.` });
  }

  // Frequência
  if (frequencia7d > 0) {
    if (frequencia7d > 3) insights.push({ tipo: 'critico', texto: `Frequência de ${frequencia7d.toFixed(2)} está muito alta (>3.0). Risco de fadiga de audiência e queda de performance.` });
    else if (frequencia7d > 2.5) insights.push({ tipo: 'atencao', texto: `Frequência de ${frequencia7d.toFixed(2)} está se aproximando do limite crítico. Avaliar expansão de público.` });
    else insights.push({ tipo: 'positivo', texto: `Frequência de ${frequencia7d.toFixed(2)} dentro do range ideal (< 2.5).` });
  }

  // Leads
  if (leadsMes > 0) {
    if (leadsMes > 30) insights.push({ tipo: 'positivo', texto: `Volume de ${leadsMes} leads no mês demonstra campanha com boa entrega e alcance.` });
    else if (leadsMes < 10) insights.push({ tipo: 'atencao', texto: `Volume baixo de leads (${leadsMes} no mês). Revisar orçamento diário e configurações da campanha.` });
  }

  // Google
  if (googleConta?.conversions > 0) {
    insights.push({ tipo: 'positivo', texto: `Google Ads gerando ${googleConta.conversions.toFixed(0)} conversões com investimento de R$ ${googleConta.cost?.toFixed(0) || '?'}.` });
  }

  if (insights.length === 0) {
    insights.push({ tipo: 'neutro', texto: 'Dados insuficientes para gerar análise automática. Aguarde sincronização dos dados de campanha.' });
  }

  return insights;
}

const TIPO_CONFIG = {
  critico: { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-800' },
  atencao: { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500', text: 'text-amber-800' },
  positivo: { bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-800' },
  neutro: { bg: 'bg-slate-50 border-slate-200', dot: 'bg-slate-400', text: 'text-slate-700' },
};

export default function InsightAutomatico({ unidade }) {
  const insights = gerarInsight(unidade);

  return (
    <Card className="overflow-hidden border-violet-200">
      <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-5 py-3 flex items-center gap-2.5">
        <div className="p-1.5 bg-white/20 rounded-lg">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-white text-sm">Insight Automático</h3>
          <p className="text-violet-200 text-xs">Análise gerada automaticamente com base nos dados da unidade</p>
        </div>
      </div>
      <div className="p-5 space-y-3">
        {insights.map((insight, i) => {
          const cfg = TIPO_CONFIG[insight.tipo];
          return (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg}`}>
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
              <p className={`text-sm ${cfg.text} leading-relaxed`}>{insight.texto}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}