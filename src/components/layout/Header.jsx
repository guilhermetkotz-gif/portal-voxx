import React, { useState } from 'react';
import { Bell, Search, Menu, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ClienteContext from './ClienteContext';
import RealtimeIndicator from './RealtimeIndicator';
import moment from 'moment-timezone';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';

export default function Header({ 
  title, 
  subtitle, 
  user,
  cliente,
  clientes = [],
  onChangeCliente,
  notificacoes = [],
  notificacoesAprovacao = [],
  onMobileMenuClick,
  onNotificationClick 
}) {
  const navigate = useNavigate();
  const unreadCount = notificacoes.filter(n => !n.lida).length;
  const alteracoesCount = notificacoesAprovacao.filter(n => n.tipo_notificacao === 'alteracao_solicitada_cliente').length;
  const aprovacoesCount = notificacoesAprovacao.filter(n => n.tipo_notificacao === 'entrega_aprovada_cliente').length;
  const totalAprovacaoCount = notificacoesAprovacao.length;

  // Mescla notificações tradicionais + aprovação para exibição no dropdown
  const todasNotificacoes = [
    // Prioridade: alterações primeiro
    ...notificacoesAprovacao
      .filter(n => n.tipo_notificacao === 'alteracao_solicitada_cliente')
      .map(n => ({ ...n, _tipo: 'aprovacao_alteracao' })),
    ...notificacoesAprovacao
      .filter(n => n.tipo_notificacao === 'entrega_aprovada_cliente')
      .map(n => ({ ...n, _tipo: 'aprovacao_aprovada' })),
    ...notificacoes.map(n => ({ ...n, _tipo: 'geral' })),
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="flex items-center justify-between px-4 lg:px-8 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMobileMenuClick}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900">{title}</h1>
            {subtitle && (
              <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Indicador Realtime */}
          <RealtimeIndicator />

          {/* Cliente Context */}
          <ClienteContext 
            user={user} 
            cliente={cliente}
            clientes={clientes}
            onChangeCliente={onChangeCliente}
          />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className={alteracoesCount > 0 ? 'w-5 h-5 text-red-500' : 'w-5 h-5 text-slate-600'} />
                {totalAprovacaoCount > 0 && (
                  <span className={`absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-[10px] font-bold rounded-full flex items-center justify-center ${
                    alteracoesCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500'
                  }`}>
                    {totalAprovacaoCount}
                  </span>
                )}
                {totalAprovacaoCount === 0 && unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-sm">Notificações</h3>
                {alteracoesCount > 0 && (
                  <Badge className="bg-red-100 text-red-700 text-[10px] h-5">
                    {alteracoesCount} alteração{alteracoesCount > 1 ? 'ões' : ''}
                  </Badge>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {todasNotificacoes.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">
                    Nenhuma notificação
                  </div>
                ) : (
                  todasNotificacoes.slice(0, 8).map((notif) => {
                    const isAprovacao = notif._tipo === 'aprovacao_alteracao' || notif._tipo === 'aprovacao_aprovada';
                    return (
                      <DropdownMenuItem 
                        key={notif.id}
                        className="p-3 cursor-pointer"
                        onClick={() => {
                          if (isAprovacao && notif.demanda_id) {
                            navigate(`${createPageUrl('Kanban')}?demanda=${notif.demanda_id}`);
                          } else if (notif._tipo === 'geral') {
                            onNotificationClick?.(notif);
                          }
                        }}
                      >
                        <div className="flex gap-3">
                          {isAprovacao ? (
                            notif._tipo === 'aprovacao_alteracao' ? (
                              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            )
                          ) : (
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.lida ? 'bg-slate-300' : 'bg-violet-500'}`} />
                          )}
                          <div className="min-w-0">
                            {isAprovacao ? (
                              <>
                                <p className="text-sm text-slate-900 font-medium truncate">
                                  {notif._tipo === 'aprovacao_alteracao' ? '✏️ Alteração solicitada' : '✅ Entrega aprovada'}
                                </p>
                                <p className="text-xs text-slate-600 truncate">
                                  {notif.cliente_nome}: {notif.entrega_nome}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {notif.data_resposta_cliente
                                    ? moment(notif.data_resposta_cliente).tz('America/Sao_Paulo').fromNow()
                                    : ''}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className={`text-sm ${notif.lida ? 'text-slate-500' : 'text-slate-900 font-medium'}`}>
                                  {notif.titulo}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {formatDistanceToNow(new Date(notif.created_date), { 
                                    addSuffix: true, 
                                    locale: ptBR 
                                  })}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </DropdownMenuItem>
                    );
                  })
                )}
              </div>
              {todasNotificacoes.length > 0 && (
                <div className="p-2 border-t border-slate-100">
                  <Button variant="ghost" size="sm" className="w-full text-violet-600">
                    Ver todas
                  </Button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User */}
          <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-slate-900">{user?.full_name || 'Usuário'}</p>
              <p className="text-xs text-slate-500">{user?.cargo || user?.tipo_acesso}</p>
            </div>
            {user?.profile_picture ? (
              <img 
                src={user.profile_picture} 
                alt={user?.full_name}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-violet-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}