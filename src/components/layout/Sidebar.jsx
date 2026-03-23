import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from "@/lib/utils";
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
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
  Activity,
  Calculator,
  HeadphonesIcon,
  Settings,
  Building2,
  ClipboardList,
  FileBarChart2,
  Briefcase,
  DollarSign,
  TrendingDown,
  FolderOpen,
  Users,
  Receipt
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const menuItems = [
  { name: "Home", icon: LayoutDashboard, page: "Home" },
  { name: "Chat", icon: MessageCircle, page: "Chat" },
  { name: "Performance", icon: BarChart3, page: "Performance" },
  { name: "Saldos & Investimentos", icon: Wallet, page: "Saldos" },
  { name: "Demandas", icon: TicketCheck, page: "Demandas", badge: true },
  { name: "Comercial", icon: Briefcase, page: "Comercial", voxxOnly: true },
  { name: "Kanban", icon: KanbanSquare, page: "Kanban", voxxOnly: true },
  { name: "Plano de Ação", icon: ClipboardList, page: "PlanoDeAcao", voxxOnly: true },
  { name: "Report Diário", icon: FileBarChart2, page: "ReportDiario", voxxOnly: true },
  { name: "Performance VOXX | Oral Sin", icon: Building2, page: "InteligenicaUnidades", voxxOnly: true },
  { name: "Monitoramento Demandas", icon: BarChart3, page: "MonitoramentoDemandas", voxxOnly: true },
  { name: "Timeline", icon: Clock, page: "Timeline" },
  { name: "Cronograma", icon: Calendar, page: "Cronograma" },
  { name: "Planejamento Estratégico", icon: TrendingUp, page: "PlanejamentoEstrategico" },
  { name: "Saldo Meta Ads", icon: CreditCard, page: "GestaoSaldoMetaAds", adminOnly: true },
  { name: "Saldo Google Ads", icon: CreditCard, page: "GestaoSaldoGoogleAds", adminOnly: true },
  { name: "Abrir Demanda", icon: PlusCircle, page: "AbrirDemanda", highlight: true },
  { divider: true },
  { name: "CRC - Caixa de Leads", icon: HeadphonesIcon, page: "CrcCaixaLeads" },
  { name: "CRC - Performance", icon: BarChart3, page: "CrcPerformance" },
  { name: "CRC - Configuração", icon: Settings, page: "CrcConfiguracao", adminOnly: true },
  { divider: true },
  { name: "Newsletter", icon: Newspaper, page: "Newsletter" },
  { name: "Central de Ajuda", icon: HelpCircle, page: "Ajuda" },
  { name: "Alertas", icon: Bell, page: "ConfiguracaoAlertas" },
  { divider: true },
  { name: "Dashboard Portfólio", icon: Activity, page: "DashboardPortfolio", adminOnly: true },
  { name: "Monitoramento Meta Ads", icon: Target, page: "MonitoramentoContas", adminOnly: true },
  { name: "Monitoramento Google Ads", icon: TrendingUp, page: "MonitoramentoGoogleAds", adminOnly: true },
  { name: "Recálculo Meta Ads", icon: Calculator, page: "RecalculoMetaAds", adminOnly: true },
  { name: "Cadastro de Cliente", icon: UserPlus, page: "CadastroCliente", adminOnly: true },
  { name: "Gerenciar Contas", icon: Building2, page: "GerenciarContas", adminOnly: true },
  { name: "Gerenciar Acessos", icon: Shield, page: "GerenciarAcessos", adminOnly: true },
  { name: "Gerenciar Chats", icon: MessageCircle, page: "GerenciarChats", voxxOnly: true },
  { divider: true },
  { name: "💰 Financeiro — Visão Geral", icon: DollarSign, page: "FinanceiroVisaoGeral" },
  { name: "Fluxo de Caixa (DRE)", icon: Activity, page: "FinanceiroFluxoCaixa" },
  { name: "Receitas (Clientes)", icon: TrendingUp, page: "FinanceiroReceitas" },
  { name: "Custos & Despesas", icon: TrendingDown, page: "FinanceiroCustos" },
  { name: "Folha (CLT + PJ)", icon: Users, page: "FinanceiroFolha" },
  { name: "Documentos Financeiros", icon: FolderOpen, page: "FinanceiroDocumentos" },
];

export default function Sidebar({ currentPage, collapsed, setCollapsed, pendingDemandas = 0, onLogout, user }) {
  // Fetch user type permissions
  const tipoUsuario = user?.tipo_usuario || user?.tipo_acesso;
  const { data: userPermissions, isLoading: loadingPermissions } = useQuery({
    queryKey: ['userTypePermissions', tipoUsuario],
    queryFn: async () => {
      if (!tipoUsuario) return null;
      const perms = await base44.entities.UserTypePermissions.filter({ 
        tipo_usuario: tipoUsuario 
      });
      return perms[0] || null;
    },
    enabled: !!tipoUsuario,
    staleTime: 5 * 60 * 1000
  });

  const isPageAllowed = (pageName) => {
    // Base44 admin has full access
    if (user?.role === 'admin') return true;
    
    // Check UserTypePermissions from DB (source of truth)
    if (userPermissions?.paginas_permitidas) {
      return userPermissions.paginas_permitidas.includes(pageName);
    }
    
    // While permissions are still loading, hide everything (show nothing until loaded)
    if (!userPermissions && tipoUsuario) return false;

    // If user has no tipo_usuario set at all, show basic pages
    return ['Home', 'Chat', 'Conta', 'Ajuda'].includes(pageName);
  };

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
        {/* While loading permissions, show nothing */}
        {loadingPermissions && tipoUsuario && !collapsed && (
          <div className="px-3 py-4 text-xs text-slate-500">Carregando menu...</div>
        )}
        {menuItems.map((item, index) => {
          if (item.divider) {
            // Don't show dividers if nothing is visible around them
            const prevVisible = menuItems.slice(0, index).reverse().find(i => !i.divider && isPageAllowed(i.page));
            const nextVisible = menuItems.slice(index + 1).find(i => !i.divider && isPageAllowed(i.page));
            if (!prevVisible || !nextVisible) return null;
            return <div key={index} className="h-px bg-slate-800 my-3" />;
          }

          // All access is controlled by UserTypePermissions (DB source of truth)
          if (!isPageAllowed(item.page)) {
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