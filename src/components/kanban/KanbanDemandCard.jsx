import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CalendarDays, User } from 'lucide-react';
import moment from 'moment-timezone';
import ActiveTimerIndicator from './ActiveTimerIndicator';

const KanbanDemandCard = ({ demanda, onClick, isMinimized }) => {
  const { titulo, cliente_nome, prioridade, previsao_entrega, status, urgente, created_by } = demanda;

  const priorityColors = {
    alta: 'bg-red-500',
    media: 'bg-yellow-500',
    baixa: 'bg-green-500',
  };

  const statusColors = {
    recebida: 'bg-blue-500',
    em_triagem: 'bg-indigo-500',
    em_execucao: 'bg-purple-500',
    aguardando_cliente: 'bg-orange-500',
    em_revisao: 'bg-yellow-500',
    concluida: 'bg-green-500',
  };

  if (isMinimized) {
    return (
      <Card 
        className="mb-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(demanda);
        }}
      >
        <CardContent className="p-2 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{titulo}</p>
            <p className="text-xs text-slate-500 truncate">{cliente_nome}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {demanda.cronometro_ativo && (
              <ActiveTimerIndicator 
                cronometro_inicio={demanda.cronometro_inicio}
                cronometro_usuario_nome={demanda.cronometro_usuario_nome}
              />
            )}
            {urgente && <Badge variant="destructive" className="text-xs px-1.5 py-0">!</Badge>}
            <div className={cn(priorityColors[prioridade], 'w-2 h-2 rounded-full')} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="mb-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(demanda);
      }}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3">
        <CardTitle className="text-sm font-semibold line-clamp-2">{titulo}</CardTitle>
        {urgente && <Badge variant="destructive" className="ml-2 shrink-0">Urgente</Badge>}
      </CardHeader>
      <CardContent className="p-3 pt-0 text-xs text-muted-foreground space-y-2">
        <p className="font-medium text-sm text-slate-800 truncate">{cliente_nome}</p>
        
        {demanda.cronometro_ativo && (
          <ActiveTimerIndicator 
            cronometro_inicio={demanda.cronometro_inicio}
            cronometro_usuario_nome={demanda.cronometro_usuario_nome}
          />
        )}
        
        <div className="flex items-center gap-2 flex-wrap">
          {prioridade && (
            <Badge className={cn(priorityColors[prioridade], 'text-white text-xs')}>
              {prioridade.charAt(0).toUpperCase() + prioridade.slice(1)}
            </Badge>
          )}
          <Badge className={cn(statusColors[status], 'text-white text-xs')}>
            {status.replace(/_/g, ' ').charAt(0).toUpperCase() + status.replace(/_/g, ' ').slice(1)}
          </Badge>
        </div>

        {previsao_entrega && (
          <div className="flex items-center gap-1 text-slate-600">
            <CalendarDays className="h-3 w-3" />
            <span>Prazo: {moment(previsao_entrega).tz('America/Sao_Paulo').format('DD/MM/YYYY')}</span>
          </div>
        )}
        
        {created_by && (
          <div className="flex items-center gap-1 text-slate-600">
            <User className="h-3 w-3" />
            <span className="truncate">{created_by}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default KanbanDemandCard;