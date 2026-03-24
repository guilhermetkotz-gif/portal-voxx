import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, MessageCircle, Calendar, Phone, Zap } from 'lucide-react';

export default function PrioritizacaoDia({ leads, onRegistrarContato, onAgendarReuniao }) {
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
        <h3 className="font-semibold text-slate-900 text-sm">🎯 Prioridades do Dia</h3>
        <Flame className="w-4 h-4 text-orange-500" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
        {leadsPrioritizados.map((lead, idx) => {
          const nivel = getNivelLead(lead);
          const dias = lead.ultima_interacao
            ? Math.floor((Date.now() - new Date(lead.ultima_interacao)) / (1000 * 60 * 60 * 24))
            : null;
          const voxxScore = lead.voxx_analise?.voxx_score ?? lead.score_oportunidade ?? null;
          const voxxClass = lead.voxx_analise?.lead_classification ?? null;

          return (
            <Card key={lead.id} className="p-3 hover:shadow-md transition-all border border-slate-200">
              {/* Header clicável */}
              <div
                className="cursor-pointer"
                onClick={() => navigate(`/LeadDetalhe?id=${lead.id}`)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                  <Badge className={`${nivel.color} text-[10px] px-1.5 py-0`} variant="outline">{nivel.label}</Badge>
                </div>
                <p className="font-semibold text-sm text-slate-900 truncate leading-tight mb-1">{lead.nome_empresa}</p>
                <p className="text-[11px] text-slate-500 truncate">{capitalize(lead.etapa?.replace(/_/g, ' ') || '')}</p>
                <div className="flex flex-wrap gap-x-2 mt-1">
                  {lead.fit_score > 0 && (
                    <span className={`text-[11px] font-semibold ${
                      lead.fit_classificacao === 'alto_fit' ? 'text-emerald-600' :
                      lead.fit_classificacao === 'medio_fit' ? 'text-amber-600' : 'text-slate-400'
                    }`}>Fit {lead.fit_score}</span>
                  )}
                  {voxxScore !== null && (
                    <span className="text-[11px] font-semibold text-violet-600 flex items-center gap-0.5">
                      <Zap className="w-2.5 h-2.5" />{voxxScore}{voxxClass ? ` ${voxxClass}` : ''}
                    </span>
                  )}
                  {dias !== null && (
                    <span className="text-[11px] text-slate-400">{dias}d atrás</span>
                  )}
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-1 mt-2 pt-2 border-t border-slate-100">
                {(lead.whatsapp_lead || lead.telefone) && (
                  <button
                    title="WhatsApp"
                    className="flex-1 flex items-center justify-center gap-1 h-6 text-[11px] rounded border border-green-200 text-green-700 hover:bg-green-50 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      const numero = (lead.whatsapp_lead || lead.telefone)?.replace(/\D/g, '');
                      const msg = lead.mensagem_whatsapp_sugerida ? encodeURIComponent(lead.mensagem_whatsapp_sugerida) : '';
                      window.open(`https://wa.me/${numero}${msg ? `?text=${msg}` : ''}`, '_blank');
                    }}
                  >
                    <MessageCircle className="w-3 h-3" /> WA
                  </button>
                )}
                <button
                  title="Agendar Reunião"
                  className="flex-1 flex items-center justify-center gap-1 h-6 text-[11px] rounded border border-violet-200 text-violet-700 hover:bg-violet-50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onAgendarReuniao) onAgendarReuniao(lead);
                    else navigate(`/LeadDetalhe?id=${lead.id}&tab=reunioes`);
                  }}
                >
                  <Calendar className="w-3 h-3" /> Reunião
                </button>
                <button
                  title="Registrar Contato"
                  className="flex-1 flex items-center justify-center gap-1 h-6 text-[11px] rounded border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRegistrarContato) onRegistrarContato(lead);
                    else navigate(`/LeadDetalhe?id=${lead.id}`);
                  }}
                >
                  <Phone className="w-3 h-3" /> Contato
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}