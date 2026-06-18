import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, AlertTriangle, CheckCircle, ExternalLink, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import moment from 'moment-timezone';

const ALERT_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export default function RetornoClienteToast() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fechado, setFechado] = React.useState({});
  const [somAtivo, setSomAtivo] = React.useState(() => {
    return localStorage.getItem('voxx_som_retorno_cliente') !== 'false';
  });
  const audioRef = useRef(null);
  const idsTocadosRef = useRef(new Set());

  const { data: notificacoes = [] } = useQuery({
    queryKey: ['notificacoesAprovacao', 'naoLidas'],
    queryFn: () => base44.entities.NotificacaoAprovacao.filter(
      { lida: false },
      '-created_date',
      50
    ),
    refetchInterval: 30000,
  });

  // Tocar som para novas notificações de alteração
  useEffect(() => {
    if (!somAtivo || !notificacoes.length) return;

    const novasAlteracoes = notificacoes.filter(
      n => n.tipo_notificacao === 'alteracao_solicitada_cliente' && !idsTocadosRef.current.has(n.id)
    );

    if (novasAlteracoes.length > 0) {
      novasAlteracoes.forEach(n => idsTocadosRef.current.add(n.id));

      const audio = new Audio(ALERT_SOUND_URL);
      audio.volume = 0.7;
      audio.play().catch(() => {});
    }
  }, [notificacoes, somAtivo]);

  const marcarLida = async (notif) => {
    await base44.entities.NotificacaoAprovacao.update(notif.id, {
      lida: true,
      visualizada_em: new Date().toISOString()
    });
    queryClient.invalidateQueries({ queryKey: ['notificacoesAprovacao'] });
  };

  const abrirDemanda = (notif) => {
    marcarLida(notif);
    setFechado(prev => ({ ...prev, [notif.id]: true }));
    if (notif.demanda_id) {
      navigate(`${createPageUrl('Kanban')}?demanda=${notif.demanda_id}`);
    }
  };

  const toggleSom = () => {
    const novo = !somAtivo;
    setSomAtivo(novo);
    localStorage.setItem('voxx_som_retorno_cliente', novo.toString());
  };

  const visiveis = notificacoes.filter(n => !fechado[n.id]);

  if (!visiveis.length) return null;

  const alteracoes = visiveis.filter(n => n.tipo_notificacao === 'alteracao_solicitada_cliente');
  const aprovacoes = visiveis.filter(n => n.tipo_notificacao === 'entrega_aprovada_cliente');

  return (
    <div className="fixed top-20 right-4 z-[100] space-y-3 max-w-md w-full pointer-events-none">
      {/* Prioridade: alterações primeiro */}
      {alteracoes.map(notif => (
        <NotificacaoCard
          key={notif.id}
          notif={notif}
          tipo="alteracao"
          onFechar={() => setFechado(prev => ({ ...prev, [notif.id]: true }))}
          onAbrir={() => abrirDemanda(notif)}
        />
      ))}
      {aprovacoes.map(notif => (
        <NotificacaoCard
          key={notif.id}
          notif={notif}
          tipo="aprovacao"
          onFechar={() => setFechado(prev => ({ ...prev, [notif.id]: true }))}
          onAbrir={() => abrirDemanda(notif)}
        />
      ))}

      {/* Botão de som */}
      <div className="pointer-events-auto flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-slate-400 hover:text-slate-600 bg-white/80 backdrop-blur shadow-sm h-7"
          onClick={toggleSom}
        >
          {somAtivo ? <Volume2 className="h-3 w-3 mr-1" /> : <VolumeX className="h-3 w-3 mr-1" />}
          {somAtivo ? 'Som ativo' : 'Som mudo'}
        </Button>
      </div>
    </div>
  );
}

function NotificacaoCard({ notif, tipo, onFechar, onAbrir }) {
  const isAlteracao = tipo === 'alteracao';

  return (
    <Card className={cn(
      'relative overflow-hidden shadow-xl pointer-events-auto animate-in slide-in-from-right duration-300',
      isAlteracao
        ? 'border-l-4 border-l-red-500 bg-red-50 border-red-200'
        : 'border-l-4 border-l-green-500 bg-green-50 border-green-200'
    )}>
      <button
        onClick={onFechar}
        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="p-4 pr-8">
        {/* Cabeçalho */}
        <div className="flex items-center gap-2 mb-3">
          {isAlteracao ? (
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          )}
          <h3 className={cn(
            'text-sm font-bold uppercase tracking-wide',
            isAlteracao ? 'text-red-800' : 'text-green-800'
          )}>
            {isAlteracao ? 'ALTERAÇÃO SOLICITADA PELO CLIENTE' : 'ENTREGA APROVADA PELO CLIENTE'}
          </h3>
        </div>

        {/* Detalhes */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Cliente:</span>
            <span className="font-medium text-slate-800">{notif.cliente_nome || '—'}</span>
          </div>
          {notif.demanda_titulo && (
            <div className="flex justify-between">
              <span className="text-slate-500">Demanda:</span>
              <span className="font-medium text-slate-800 truncate max-w-[200px]">{notif.demanda_titulo}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Entrega:</span>
            <span className="font-medium text-slate-800 truncate max-w-[200px]">{notif.entrega_nome || '—'}</span>
          </div>
          {notif.comentario_cliente && (
            <div className="mt-2 p-2 bg-white/70 rounded border border-slate-200">
              <p className="text-xs text-slate-500 mb-0.5">Comentário do cliente:</p>
              <p className="text-xs text-slate-700 italic">"{notif.comentario_cliente}"</p>
            </div>
          )}
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>
              {notif.data_resposta_cliente
                ? moment(notif.data_resposta_cliente).tz('America/Sao_Paulo').format('DD/MM/YYYY [às] HH:mm')
                : ''}
            </span>
          </div>
        </div>

        {/* Botão */}
        <Button
          onClick={onAbrir}
          className={cn(
            'w-full mt-3 h-9 font-semibold text-sm',
            isAlteracao
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          )}
        >
          <ExternalLink className="h-4 w-4 mr-1.5" />
          Abrir demanda
        </Button>
      </div>
    </Card>
  );
}