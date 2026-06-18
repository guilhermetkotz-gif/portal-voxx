import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function KanbanRetornoBanner({ onVerAlteracoes, onVerAprovacoes, onAbrirPendencias }) {
  const { data: notificacoes = [] } = useQuery({
    queryKey: ['notificacoesAprovacao', 'bannerKanban'],
    queryFn: () => base44.entities.NotificacaoAprovacao.filter({ lida: false }, '-created_date', 100),
    refetchInterval: 30000,
  });

  const [fechado, setFechado] = React.useState(false);

  if (fechado || !notificacoes.length) return null;

  const alteracoes = notificacoes.filter(n => n.tipo_notificacao === 'alteracao_solicitada_cliente');
  const aprovacoes = notificacoes.filter(n => n.tipo_notificacao === 'entrega_aprovada_cliente');

  const total = notificacoes.length;
  if (total === 0) return null;

  return (
    <div className={cn(
      'relative mb-4 p-4 rounded-xl border-2 shadow-md',
      alteracoes.length > 0
        ? 'bg-orange-50 border-orange-400'
        : 'bg-green-50 border-green-400'
    )}>
      <button
        onClick={() => setFechado(true)}
        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        {alteracoes.length > 0 ? (
          <AlertTriangle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-0.5" />
        ) : (
          <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
        )}

        <div className="flex-1 min-w-0">
          <h3 className={cn(
            'text-base font-bold',
            alteracoes.length > 0 ? 'text-orange-800' : 'text-green-800'
          )}>
            {total === 1
              ? 'Existe 1 retorno de cliente aguardando ação'
              : `Existem ${total} retornos de clientes aguardando ação`}
          </h3>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {alteracoes.length > 0 && (
              <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                {alteracoes.length} alteração{alteracoes.length > 1 ? 'ões' : ''} solicitada{alteracoes.length > 1 ? 's' : ''}
              </span>
            )}
            {aprovacoes.length > 0 && (
              <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                {aprovacoes.length} aprovação{aprovacoes.length > 1 ? 'ões' : ''}
              </span>
            )}
          </div>

          {/* Lista compacta das primeiras */}
          <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto">
            {notificacoes.slice(0, 5).map(n => (
              <div key={n.id} className="flex items-center gap-2 text-sm">
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                  n.tipo_notificacao === 'alteracao_solicitada_cliente' ? 'bg-red-500' : 'bg-green-500'
                )} />
                <span className="text-slate-700 truncate">
                  <strong>{n.cliente_nome || 'Cliente'}</strong>
                  {n.tipo_notificacao === 'alteracao_solicitada_cliente' ? ' — Alteração solicitada' : ' — Aprovado'}
                  {n.entrega_nome ? `: ${n.entrega_nome}` : ''}
                </span>
              </div>
            ))}
            {total > 5 && (
              <p className="text-xs text-slate-400 pl-4">...e mais {total - 5} retorno{total - 5 > 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4 pl-9">
        {alteracoes.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-100 h-8 text-xs"
            onClick={onVerAlteracoes}
          >
            Ver alterações solicitadas
          </Button>
        )}
        {aprovacoes.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="border-green-300 text-green-700 hover:bg-green-100 h-8 text-xs"
            onClick={onVerAprovacoes}
          >
            Ver aprovações
          </Button>
        )}
        <Button
          size="sm"
          className="bg-violet-600 hover:bg-violet-700 text-white h-8 text-xs"
          onClick={onAbrirPendencias}
        >
          Abrir pendências de aprovação
        </Button>
      </div>
    </div>
  );
}