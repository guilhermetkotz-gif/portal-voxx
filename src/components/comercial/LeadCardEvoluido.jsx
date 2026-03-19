import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Flame, Clock, AlertCircle } from 'lucide-react';

export default function LeadCardEvoluido({ lead, onFollowUp }) {
  const getNivelLead = () => {
    if (!lead.fit_classificacao) return { emoji: '❓', label: 'Indefinido', color: 'text-slate-500' };
    if (lead.fit_classificacao === 'alto_fit') return { emoji: '🔥', label: 'Quente', color: 'text-red-600' };
    if (lead.fit_classificacao === 'medio_fit') return { emoji: '🌡️', label: 'Morno', color: 'text-amber-600' };
    return { emoji: '❄️', label: 'Frio', color: 'text-blue-600' };
  };

  const getStatusFollowUp = () => {
    if (!lead.ultima_interacao) return { emoji: '🔴', label: 'Sem contato', color: 'text-red-600' };
    const dias = Math.floor((Date.now() - new Date(lead.ultima_interacao)) / (1000 * 60 * 60 * 24));
    if (dias <= 3) return { emoji: '🟢', label: 'Em dia', color: 'text-green-600' };
    if (dias <= 7) return { emoji: '🟡', label: 'A vencer', color: 'text-amber-600' };
    return { emoji: '🔴', label: 'Atrasado', color: 'text-red-600' };
  };

  const getTempoUltimaInteracao = () => {
    if (!lead.ultima_interacao) return 'Nunca';
    const dias = Math.floor((Date.now() - new Date(lead.ultima_interacao)) / (1000 * 60 * 60 * 24));
    if (dias === 0) return 'Hoje';
    if (dias === 1) return 'Ontem';
    return `há ${dias}d`;
  };

  const nivel = getNivelLead();
  const statusFollowUp = getStatusFollowUp();

  return (
    <Card className="p-3 hover:shadow-md transition-all bg-white border cursor-pointer group">
      <div className="space-y-2">
        {/* Cabeçalho com nome e nível */}
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-slate-900 truncate">{lead.nome_empresa}</p>
            <p className="text-xs text-slate-600 truncate">{lead.nome_contato}</p>
          </div>
          <span className={`text-lg flex-shrink-0 ${nivel.color}`}>{nivel.emoji}</span>
        </div>

        {/* Localização e telefone */}
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="w-3 h-3" />
          <span className="truncate">{lead.cidade || '-'}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Phone className="w-3 h-3" />
          <span className="truncate">{lead.telefone?.slice(-8) || '-'}</span>
        </div>

        {/* Fit Score e Etapa */}
        <div className="flex items-center gap-1 text-xs">
          <Badge variant="outline" className="text-xs">{lead.fit_score || '-'}/100</Badge>
          <span className="text-slate-600 capitalize truncate">{lead.etapa?.replace(/_/g, ' ')}</span>
        </div>

        {/* Última interação com cor */}
        <div className="flex items-center gap-1 text-xs">
          <Clock className={`w-3 h-3 ${
            getTempoUltimaInteracao() === 'Hoje' ? 'text-green-600' :
            getTempoUltimaInteracao() === 'Ontem' ? 'text-amber-600' :
            'text-slate-500'
          }`} />
          <span className="text-slate-600">Última: {getTempoUltimaInteracao()}</span>
        </div>

        {/* Status do Follow-up */}
        <div className="flex items-center gap-1 text-xs">
          <span>{statusFollowUp.emoji}</span>
          <span className={`font-medium ${statusFollowUp.color}`}>{statusFollowUp.label}</span>
        </div>

        {/* Alerta se necessário */}
        {lead.alerta_inatividade && (
          <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 p-1.5 rounded">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">Lead parado</span>
          </div>
        )}

        {/* Botão de follow-up rápido */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFollowUp?.(lead);
          }}
          className="w-full text-xs py-1.5 rounded bg-violet-50 text-violet-700 font-medium hover:bg-violet-100 transition-colors opacity-0 group-hover:opacity-100"
        >
          + Follow-up Rápido
        </button>
      </div>
    </Card>
  );
}