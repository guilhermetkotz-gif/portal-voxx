import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FitScoreDisplay } from './FitScoreCalculator';
import { Phone, MapPin, User, AlertTriangle, Clock, Flame } from 'lucide-react';
import { formatDistanceToNow, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calcularTemperaturaLead, calcularScorePrioridade, avaliarTriggers } from '@/lib/comercial/inteligencia';

const ORIGEM_LABEL = {
  indicacao: 'Indicação', inbound: 'Inbound', outbound: 'Outbound',
  evento: 'Evento', redes_sociais: 'Redes Sociais', outro: 'Outro'
};

export default function LeadCard({ lead, onClick }) {
  const diasSemInteracao = lead.ultima_interacao
    ? Math.floor((Date.now() - new Date(lead.ultima_interacao)) / (1000 * 60 * 60 * 24))
    : null;

  const temperatura = calcularTemperaturaLead(lead);
  const score = calcularScorePrioridade(lead);

  // Triggers críticos para mostrar no card
  const triggers = avaliarTriggers(lead);
  const triggerCritico = triggers.find(t => ['critico', 'alto'].includes(t.nivel));
  const triggerOportunidade = triggers.find(t => t.nivel === 'oportunidade');

  // Bordas e destaque baseados no estado
  const bordaColor = triggerOportunidade
    ? 'border-l-emerald-400'
    : triggerCritico
      ? 'border-l-red-400'
      : temperatura.label === 'Quente'
        ? 'border-l-orange-400'
        : 'border-l-violet-300';

  return (
    <Card
      className={`p-3 cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 ${bordaColor} bg-white`}
      onClick={() => onClick(lead)}
    >
      <div className="space-y-2">
        {/* Header: nome + temperatura */}
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900 text-sm truncate">{lead.nome_empresa}</p>
            <p className="text-xs text-slate-500 truncate">{lead.nome_contato}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-sm">{temperatura.emoji}</span>
            {(lead.alerta_inatividade || triggerCritico) && (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            )}
          </div>
        </div>

        {/* Trigger crítico ou oportunidade */}
        {(triggerCritico || triggerOportunidade) && (
          <p className={`text-[10px] font-medium px-1.5 py-0.5 rounded truncate ${
            triggerOportunidade ? 'bg-emerald-50 text-emerald-700' :
            triggerCritico?.nivel === 'critico' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'
          }`}>
            {triggerOportunidade ? triggerOportunidade.titulo : triggerCritico?.titulo}
          </p>
        )}

        {lead.telefone && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Phone className="w-3 h-3" />
            <span>{lead.telefone}</span>
          </div>
        )}

        {lead.cidade && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="w-3 h-3" />
            <span>{lead.cidade}</span>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-1">
          {lead.origem && (
            <Badge variant="outline" className="text-xs px-1.5 py-0.5">
              {ORIGEM_LABEL[lead.origem] || lead.origem}
            </Badge>
          )}
          {lead.valor_estimado > 0 && (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              R$ {lead.valor_estimado?.toLocaleString('pt-BR')}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          {lead.responsavel_nome && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <User className="w-3 h-3" />
              <span className="truncate max-w-[70px]">{lead.responsavel_nome}</span>
            </div>
          )}
          {lead.fit_score > 0
            ? <FitScoreDisplay score={lead.fit_score} classificacao={lead.fit_classificacao} size="sm" />
            : <span className="text-[10px] text-slate-300">Fit n/a</span>
          }
        </div>

        {/* Score de prioridade + dias */}
        <div className="flex items-center justify-between pt-0.5 border-t border-slate-100">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] text-slate-400">
              {diasSemInteracao === null ? 'Nunca' :
               diasSemInteracao === 0 ? 'Hoje' :
               `${diasSemInteracao}d atrás`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-10 h-1 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${score >= 70 ? 'bg-emerald-400' : score >= 40 ? 'bg-amber-400' : 'bg-slate-300'}`}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400">{score}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}