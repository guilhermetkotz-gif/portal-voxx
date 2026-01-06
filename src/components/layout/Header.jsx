import React, { useState } from 'react';
import { Bell, Search, Menu } from "lucide-react";
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

export default function Header({ 
  title, 
  subtitle, 
  user,
  cliente,
  clientes = [],
  onChangeCliente,
  notificacoes = [], 
  onMobileMenuClick,
  onNotificationClick 
}) {
  const unreadCount = notificacoes.filter(n => !n.lida).length;

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
          {/* Cliente Context */}
          <ClienteContext 
            user={user} 
            cliente={cliente}
            clientes={clientes}
            onChangeCliente={onChangeCliente}
          />

          {/* Search - hidden on mobile */}
          <div className="hidden md:flex relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Buscar..." 
              className="pl-9 w-48 lg:w-64 bg-slate-50 border-slate-200"
            />
          </div>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="p-3 border-b border-slate-100">
                <h3 className="font-semibold text-sm">Notificações</h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notificacoes.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">
                    Nenhuma notificação
                  </div>
                ) : (
                  notificacoes.slice(0, 5).map((notif) => (
                    <DropdownMenuItem 
                      key={notif.id}
                      className="p-3 cursor-pointer"
                      onClick={() => onNotificationClick?.(notif)}
                    >
                      <div className="flex gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.lida ? 'bg-slate-300' : 'bg-violet-500'}`} />
                        <div>
                          <p className={`text-sm ${notif.lida ? 'text-slate-500' : 'text-slate-900 font-medium'}`}>
                            {notif.titulo}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {formatDistanceToNow(new Date(notif.created_date), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </p>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
              {notificacoes.length > 0 && (
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
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-violet-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}