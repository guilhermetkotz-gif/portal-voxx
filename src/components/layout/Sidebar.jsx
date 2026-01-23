import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BarChart3,
  Wallet,
  TicketCheck,
  Clock,
  Calendar,
  PlusCircle,
  Newspaper,
  HelpCircle,
  User,
  ChevronLeft,
  LogOut,
  Bell,
  Shield,
  KanbanSquare,
  Target,
  TrendingUp,
  UserPlus,
  CreditCard,
  MessageCircle,
  Activity
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const menuItems = [
  { name: "Home", icon: LayoutDashboard, page: "Home" },
  { name: "Performance", icon: BarChart3, page: "Performance" },
  { name: "Saldos & Investimentos", icon: Wallet, page: "Saldos" },
  { name: "Demandas", icon: TicketCheck, page: "Demandas", badge: true },
  { name: "Kanban", icon: KanbanSquare, page: "Kanban", voxxOnly: true },
  { name: "Timeline", icon: Clock, page: "Timeline" },
  { name: "Cronograma", icon: Calendar, page: "Cronograma" },
  { name: "Planejamento Estratégico", icon: TrendingUp, page: "PlanejamentoEstrategico" },
  { name: "Saldo Meta Ads", icon: CreditCard, page: "GestaoSaldoMetaAds", adminOnly: true },
  { name: "Abrir Demanda", icon: PlusCircle, page: "AbrirDemanda", highlight: true },
  { divider: true },
  { name: "Newsletter", icon: Newspaper, page: "Newsletter" },
  { name: "Central de Ajuda", icon: HelpCircle, page: "Ajuda" },
  { name: "Alertas", icon: Bell, page: "ConfiguracaoAlertas" },
  { divider: true },
  { name: "Dashboard Portfólio", icon: Activity, page: "DashboardPortfolio", adminOnly: true },
  { name: "Monitoramento Meta Ads", icon: Target, page: "MonitoramentoContas", adminOnly: true },
  { name: "Cadastro de Cliente", icon: UserPlus, page: "CadastroCliente", adminOnly: true },
  { name: "Gerenciar Acessos", icon: Shield, page: "GerenciarAcessos", adminOnly: true },
  { name: "Gerenciar Chats", icon: MessageCircle, page: "GerenciarChats", voxxOnly: true },
];

export default function Sidebar({ currentPage, collapsed, setCollapsed, pendingDemandas = 0, onLogout, user }) {
  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-slate-900 text-white transition-all duration-300 z-40 flex flex-col",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold tracking-tight">Portal Voxx</h1>
              <p className="text-[10px] text-slate-400 mt-0.5">Performance & Demandas</p>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center mx-auto">
              <span className="text-sm font-bold">V</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "p-1.5 rounded-lg hover:bg-slate-800 transition-colors",
              collapsed && "mx-auto mt-2"
            )}
          >
            <ChevronLeft className={cn(
              "w-4 h-4 transition-transform",
              collapsed && "rotate-180"
            )} />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item, index) => {
          if (item.divider) {
            return <div key={index} className="h-px bg-slate-800 my-3" />;
          }

          // Hide admin-only items for non-admin users
          if (item.adminOnly && user?.role !== 'admin' && user?.tipo_usuario !== 'voxx_admin' && user?.tipo_usuario !== 'voxx_manager') {
            return null;
          }

          // Hide voxx-only items for non-voxx users
          if (item.voxxOnly && user?.role !== 'admin' && user?.tipo_usuario !== 'voxx_admin' && user?.tipo_usuario !== 'voxx_operacao' && user?.tipo_usuario !== 'voxx_manager') {
            return null;
          }

          const isActive = currentPage === item.page;
          const Icon = item.icon;

          return (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive 
                  ? "bg-violet-600 text-white" 
                  : item.highlight 
                    ? "bg-violet-600/20 text-violet-300 hover:bg-violet-600/30"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className={cn(
                "w-5 h-5 flex-shrink-0",
                isActive && "text-white"
              )} />
              {!collapsed && (
                <>
                  <span className="text-sm font-medium flex-1">{item.name}</span>
                  {item.badge && pendingDemandas > 0 && (
                    <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">
                      {pendingDemandas}
                    </Badge>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800 space-y-1">
        <Link
          to={createPageUrl("Conta")}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
            currentPage === "Conta"
              ? "bg-violet-600 text-white"
              : "text-slate-400 hover:bg-slate-800 hover:text-white"
          )}
        >
          <User className="w-5 h-5" />
          {!collapsed && <span className="text-sm font-medium">Minha Conta</span>}
        </Link>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="text-sm font-medium">Sair</span>}
        </button>
      </div>
    </aside>
  );
}