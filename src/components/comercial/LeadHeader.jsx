import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FitScoreDisplay } from './FitScoreCalculator';
import { Phone, MapPin, User, Clock, DollarSign, ChevronRight, MessageSquare, Calendar, ArrowRight } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ETAPA_LABELS = {
  novo_lead: 'Novo Lead', contato_iniciado: 'Contato Iniciado',
  diagnostico_reuniao: 'Diagnóstico/Reunião', qualificado: 'Qualificado',
  proposta_enviada: 'Proposta Enviada', negociacao: 'Negociação',
  fechado_ganho: 'Fechado (Ganho)', fechado_perdido: 'Fechado (Perdido)'
};

const ETAPAS_ORDER = ['novo_lead','contato_iniciado','diagnostico_reuniao','qualificado','proposta_enviada','negociacao','fechado_ganho','fechado_perdido'];

function getStatusVisual(lead) {
  if (!lead.ultima_interacao) return { color: 'bg-red-500', label: 'Sem contato', textColor: 'text-red-700 bg-red-50' };
  const dias = Math.floor((Date.now() - new Date(lead.ultima_interacao)) / (1000 * 60 * 60 * 24));
  if (dias <= 3) return { color: 'bg-emerald-500', label: 'Ativo', textColor: 'text-emerald-700 bg-emerald-50' };
  if (dias <= 7) return { color: 'bg-amber-400', label: 'Aguardando', textColor: 'text-amber-700 bg-amber-50' };
  return { color: 'bg-red-500', label: 'Parado', textColor: 'text-red-700 bg-red-50' };
}

export default function LeadHeader({ lead, onAvancarEtapa, onRegistrarInteracao, onAgendarReuniao }) {
  const statusVisual = getStatusVisual(lead);
  const etapaIdx = ETAPAS_ORDER.indexOf(lead.etapa);
  const proximaEtapa = ETAPAS_ORDER[etapaIdx + 1];

  const ultimaInteracaoStr = lead.ultima_interacao
    ? formatDistanceToNow(parseISO(lead.ultima_interacao), { addSuffix: true, locale: ptBR })
    : 'nunca';

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-b-none">
      {/* Status bar */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`w-2 h-2 rounded-full ${statusVisual.color} ring-2 ring-white/20`} />
        <span className="text-xs font-medium text-slate-300">{statusVisual.label}</span>
        <span className="text-slate-600 text-xs">·</span>
        <span className="text-xs text-slate-400">Última interação {ultimaInteracaoStr}</span>
      </div>

      {/* Empresa + Fit Score */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h2 className="text-2xl font-bold leading-tight">{lead.nome_empresa}</h2>
          <p className="text-slate-300 text-sm mt-0.5">{lead.nome_contato}</p>
        </div>
        {lead.fit_score > 0 && (
          <div className="flex-shrink-0">
            <FitScoreDisplay score={lead.fit_score} classificacao={lead.fit_classificacao} />
          </div>
        )}
      </div>

      {/* Dados rápidos */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-300 mb-4">
        {lead.telefone && (
          <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{lead.telefone}</span>
        )}
        {lead.cidade && (
          <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{lead.cidade}{lead.estado ? `, ${lead.estado}` : ''}</span>
        )}
        {lead.responsavel_nome && (
          <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{lead.responsavel_nome}</span>
        )}
        {lead.valor_estimado > 0 && (
          <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" />R$ {lead.valor_estimado?.toLocaleString('pt-BR')}/mês</span>
        )}
      </div>

      {/* Etapa atual + avançar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-violet-600 text-white border-0 text-xs px-2.5 py-1">
            {ETAPA_LABELS[lead.etapa]}
          </Badge>
          {proximaEtapa && lead.etapa !== 'fechado_ganho' && lead.etapa !== 'fechado_perdido' && (
            <button
              onClick={() => onAvancarEtapa(proximaEtapa)}
              className="flex items-center gap-1 text-xs text-violet-300 hover:text-white transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Avançar para {ETAPA_LABELS[proximaEtapa]}
            </button>
          )}
        </div>

        {/* Ações rápidas */}
        <div className="flex gap-2">
          <button
            onClick={onRegistrarInteracao}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Registrar
          </button>
          <button
            onClick={onAgendarReuniao}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 rounded-lg text-xs font-medium transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" /> Agendar
          </button>
        </div>
      </div>
    </div>
  );
}