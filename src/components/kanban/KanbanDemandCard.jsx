import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CalendarDays, User, Tag, AlertTriangle } from 'lucide-react';
import moment from 'moment-timezone';
import ActiveTimerIndicator from './ActiveTimerIndicator';
import TagManagerPopover from './TagManagerPopover';

// Calcula horas úteis decorridas desde uma data (Seg-Sex, 9h-18h, fuso Brasília)
function calcBusinessHours(fromDate) {
  const tz = 'America/Sao_Paulo';
  const now = moment().tz(tz);
  const from = moment(fromDate).tz(tz);
  if (now.isBefore(from)) return 0;

  let totalMinutes = 0;
  const cursor = from.clone();

  while (cursor.isBefore(now)) {
    const dow = cursor.day(); // 0=Dom, 6=Sáb
    if (dow >= 1 && dow <= 5) {
      const dayStart = cursor.clone().startOf('day').hour(9);
      const dayEnd = cursor.clone().startOf('day').hour(18);
      const segStart = moment.max(cursor, dayStart);
      const segEnd = moment.min(now, dayEnd);
      if (segEnd.isAfter(segStart)) {
        totalMinutes += segEnd.diff(segStart, 'minutes');
      }
    }
    cursor.add(1, 'day').startOf('day').hour(9);
  }

  return totalMinutes / 60;
}

const KanbanDemandCard = ({ demanda, onClick, isMinimized, onUpdateTags, allTags }) => {
  const { titulo, cliente_nome, prioridade, previsao_entrega, status, urgente, created_by, tags = [] } = demanda;

  // Verifica inatividade > 72h úteis
  const lastActivity = demanda.updated_date || demanda.created_date;
  const businessHoursInactive = lastActivity ? calcBusinessHours(lastActivity) : 0;
  const isInactive = businessHoursInactive >= 72;

  const priorityColors = {
    alta: 'bg-red-500',
    media: 'bg-yellow-500',
    baixa: 'bg-green-500',
  };

  const statusColors = {
    recebida: 'bg-blue-500',
    em_triagem: 'bg-indigo-500',
    programada: 'bg-cyan-500',
    em_execucao: 'bg-purple-500',
    aguardando_cliente: 'bg-orange-500',
    em_revisao: 'bg-yellow-500',
    concluida: 'bg-green-500',
  };

  if (isMinimized) {
    return (
      <Card 
        className={cn('mb-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow',
          isInactive && 'border-amber-400 bg-amber-50'
        )}
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
            {isInactive && <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
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
      className={cn('mb-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow',
        isInactive && 'border-amber-400 bg-amber-50'
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(demanda);
      }}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3">
        <CardTitle className="text-sm font-semibold line-clamp-2">{titulo}</CardTitle>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {isInactive && (
            <span title={`Sem movimentação há ${Math.round(businessHoursInactive)}h úteis`}>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </span>
          )}
          {urgente && <Badge variant="destructive" className="shrink-0">Urgente</Badge>}
        </div>
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

        {tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="w-3 h-3 text-slate-400" />
            {tags.map((tag, idx) => (
              <Badge key={tag} variant="outline" className="text-xs bg-slate-50">
                {tag}
              </Badge>
            ))}
          </div>
        )}

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

        {onUpdateTags && (
          <TagManagerPopover 
            demanda={demanda}
            onUpdateTags={onUpdateTags}
            availableTags={allTags}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default KanbanDemandCard;