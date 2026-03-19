import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FitScoreDisplay } from './FitScoreCalculator';
import { Phone, MapPin, User, AlertTriangle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ORIGEM_LABEL = {
  indicacao: 'Indicação', inbound: 'Inbound', outbound: 'Outbound',
  evento: 'Evento', redes_sociais: 'Redes Sociais', outro: 'Outro'
};

export default function LeadCard({ lead, onClick }) {
  const diasSemInteracao = lead.ultima_interacao
    ? Math.floor((Date.now() - new Date(lead.ultima_interacao)) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Card
      className="p-3 cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 border-l-violet-400 bg-white"
      onClick={() => onClick(lead)}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 text-sm truncate">{lead.nome_empresa}</p>
            <p className="text-xs text-slate-500 truncate">{lead.nome_contato}</p>
          </div>
          {lead.alerta_inatividade && (
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          )}
        </div>

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
              <span className="truncate max-w-[80px]">{lead.responsavel_nome}</span>
            </div>
          )}
          {lead.fit_score > 0 && (
            <FitScoreDisplay score={lead.fit_score} classificacao={lead.fit_classificacao} size="sm" />
          )}
        </div>

        {diasSemInteracao !== null && (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            <span>
              {diasSemInteracao === 0 ? 'Hoje' : `Há ${diasSemInteracao} dia${diasSemInteracao !== 1 ? 's' : ''}`}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}