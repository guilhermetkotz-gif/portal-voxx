import React from 'react';
import { Card } from "@/components/ui/card";
import StatusBadge from '@/components/ui/StatusBadge';
import { Clock, Calendar, Paperclip, ChevronRight, AlertCircle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function DemandaCard({ demanda, onClick }) {
  const isAguardando = demanda.status === 'aguardando_cliente';
  
  return (
    <Card 
      className={`p-4 cursor-pointer transition-all hover:shadow-md ${
        isAguardando ? 'border-amber-300 bg-amber-50/50' : 'hover:border-violet-200'
      }`}
      onClick={() => onClick?.(demanda)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge type="setor" value={demanda.setor} size="xs" />
            {demanda.urgente && (
              <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                URGENTE
              </span>
            )}
          </div>
          
          <h3 className="font-semibold text-slate-900 truncate">{demanda.titulo}</h3>
          
          {demanda.descricao && (
            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{demanda.descricao}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-3">
            <StatusBadge type="status" value={demanda.status} size="sm" />
            <StatusBadge type="prioridade" value={demanda.prioridade} size="xs" />
            
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(demanda.created_date), { 
                addSuffix: true, 
                locale: ptBR 
              })}
            </div>

            {demanda.previsao_entrega && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Calendar className="w-3 h-3" />
                Prev: {format(new Date(demanda.previsao_entrega), "dd/MM")}
              </div>
            )}

            {demanda.anexos?.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Paperclip className="w-3 h-3" />
                {demanda.anexos.length}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <ChevronRight className="w-5 h-5 text-slate-300" />
          {isAguardando && (
            <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
              <AlertCircle className="w-3 h-3" />
              Ação necessária
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}