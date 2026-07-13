import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CalendarDays, User, Tag, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import moment from 'moment-timezone';
import ActiveTimerIndicator from './ActiveTimerIndicator';
import TagManagerPopover from './TagManagerPopover';
import AlteracaoManualPopover from './AlteracaoManualPopover';

// Calcula horas úteis decorridas desde uma data (Seg-Sex, 9h-18h, fuso Brasília)
function calcBusinessHours(fromDate) {
  const tz = 'America/Sao_Paulo';
  const now = moment().tz(tz);
  const from = moment(fromDate).tz(tz);
  if (now.isBefore(from)) return 0;

  let totalMinutes = 0;
  const cursor = from.clone();

  while (cursor.isBefore(now)) {
    const dow = cursor.day();
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

const aprovacaoCardStyle = {
  pendente: 'border-yellow-400 bg-yellow-50',
  aprovado: 'border-green-500 bg-green-50',
  solicitacao_alteracao: 'border-red-500 bg-red-50',
};

const ALTERACAO_TAG = 'ajuste-manual';
const ajusteManualStyle = 'border-orange-500 bg-orange-100';

const KanbanDemandCard = ({ demanda, onClick, isMinimized, onUpdateTags, allTags, aprovacaoStatus }) => {
  const { titulo, cliente_nome, prioridade, previsao_entrega, status, urgente, created_by, tags = [] } = demanda;
  const aprovacaoStyle = aprovacaoStatus ? aprovacaoCardStyle[aprovacaoStatus] : null;
  const hasAjusteManual = (demanda.tags || []).includes(ALTERACAO_TAG);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const cardRef = useRef(null);

  // Verifica inatividade > 48h úteis
  const lastActivity = demanda.ultima_atividade_kanban || demanda.created_date;
  const businessHoursInactive = lastActivity ? calcBusinessHours(lastActivity) : 0;
  const isInactive = businessHoursInactive >= 48;

  // Monta lista de notificações
  const notificacoes = [];
  if (isInactive) {
    notificacoes.push({ tipo: 'alerta', texto: `Sem movimentação há ${Math.round(businessHoursInactive)}h úteis` });
  }
  if (urgente) {
    notificacoes.push({ tipo: 'urgente', texto: 'Demanda marcada como urgente' });
  }
  if (aprovacaoStatus === 'pendente') {
    notificacoes.push({ tipo: 'info', texto: 'Aguardando aprovação do cliente' });
  }
  if (aprovacaoStatus === 'solicitacao_alteracao') {
    notificacoes.push({ tipo: 'alerta', texto: 'Cliente solicitou alterações' });
  }
  if (aprovacaoStatus === 'aprovado') {
    notificacoes.push({ tipo: 'ok', texto: 'Entrega aprovada pelo cliente' });
  }
  if (hasAjusteManual) {
    notificacoes.push({ tipo: 'alerta', texto: 'Alteração manual sinalizada — fora do fluxo de aprovação' });
  }
  if (previsao_entrega && moment(previsao_entrega).isBefore(moment())) {
    notificacoes.push({ tipo: 'alerta', texto: `Prazo vencido: ${moment(previsao_entrega).tz('America/Sao_Paulo').format('DD/MM/YYYY')}` });
  }

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

  // Recalcula posição ao mostrar tooltip
  const handleMouseEnter = () => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const tooltipWidth = 288; // w-72 = 18rem = 288px
      const viewportWidth = window.innerWidth;
      let left = rect.left;
      // Se não cabe à direita, alinhar pelo lado direito do card
      if (left + tooltipWidth > viewportWidth - 8) {
        left = rect.right - tooltipWidth;
      }
      // Garantir que não sai pela esquerda
      if (left < 8) left = 8;
      setTooltipPos({ top: rect.bottom + 6, left });
    }
    setShowTooltip(true);
  };

  // Tooltip renderizado via portal para escapar do overflow das colunas
  const TooltipContent = () => {
    if (!showTooltip || notificacoes.length === 0) return null;
    return ReactDOM.createPortal(
      <div
        style={{ position: 'fixed', top: tooltipPos.top, left: tooltipPos.left, zIndex: 9999 }}
        className="w-72 bg-slate-900 text-white rounded-lg shadow-xl p-3 space-y-1.5 pointer-events-none"
      >
        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">Notificações</p>
        {notificacoes.map((n, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            {n.tipo === 'alerta' && <AlertTriangle className="w-3 h-3 text-orange-400 flex-shrink-0 mt-0.5" />}
            {n.tipo === 'urgente' && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />}
            {n.tipo === 'info' && <Clock className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />}
            {n.tipo === 'ok' && <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />}
            <span className="text-slate-200">{n.texto}</span>
          </div>
        ))}
      </div>,
      document.body
    );
  };

  const cardBorderStyle = hasAjusteManual
    ? ajusteManualStyle
    : (aprovacaoStyle || (isInactive ? 'border-orange-400 bg-orange-50' : ''));

  if (isMinimized) {
    return (
      <div
        ref={cardRef}
        className="relative mb-2"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <TooltipContent />
        <Card
          className={cn('cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow', cardBorderStyle)}
          onClick={(e) => { e.stopPropagation(); onClick?.(demanda); }}
        >
          <CardContent className="p-2 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{titulo}</p>
              <p className="text-xs text-slate-500 truncate">{cliente_nome}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {notificacoes.length > 0 && <AlertTriangle className="w-3 h-3 text-orange-500 flex-shrink-0" />}
              {(demanda.cronometros_ativos || []).length > 0 && (
                <ActiveTimerIndicator
                  cronometro_inicio={demanda.cronometros_ativos[0].data_inicio}
                  cronometro_usuario_nome={demanda.cronometros_ativos[0].usuario_nome}
                />
              )}
              {urgente && <Badge variant="destructive" className="text-xs px-1.5 py-0">!</Badge>}
              <div className={cn(priorityColors[prioridade], 'w-2 h-2 rounded-full')} />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className="relative mb-3"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <TooltipContent />
      <Card
        className={cn('cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow', cardBorderStyle)}
        onClick={(e) => { e.stopPropagation(); onClick?.(demanda); }}
      >
        <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3">
          <CardTitle className="text-sm font-semibold line-clamp-2">{titulo}</CardTitle>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {notificacoes.length > 0 && (
              <AlertTriangle className="w-4 h-4 text-orange-500" />
            )}
            {urgente && <Badge variant="destructive" className="shrink-0">Urgente</Badge>}
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-sm text-slate-800 truncate">{cliente_nome}</p>

          {(demanda.cronometros_ativos || []).length > 0 && (
            <ActiveTimerIndicator
              cronometro_inicio={demanda.cronometros_ativos[0].data_inicio}
              cronometro_usuario_nome={
                demanda.cronometros_ativos.length > 1
                  ? `${demanda.cronometros_ativos[0].usuario_nome} +${demanda.cronometros_ativos.length - 1}`
                  : demanda.cronometros_ativos[0].usuario_nome
              }
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
              {tags.map((tag) => (
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

          <div className="flex items-center gap-1.5 flex-wrap">
            {onUpdateTags && (
              <AlteracaoManualPopover
                demanda={demanda}
                onUpdateTags={onUpdateTags}
                hasAjusteManual={hasAjusteManual}
              />
            )}
            {onUpdateTags && (
              <TagManagerPopover
                demanda={demanda}
                onUpdateTags={onUpdateTags}
                availableTags={allTags}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KanbanDemandCard;