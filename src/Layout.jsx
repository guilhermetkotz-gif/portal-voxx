import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const pageTitles = {
  Home: { title: "Resumo Executivo", subtitle: "Visão geral da sua conta" },
  Performance: { title: "Performance", subtitle: "Meta & Google Ads" },
  Saldos: { title: "Saldos & Investimentos", subtitle: "Controle financeiro" },
  Demandas: { title: "Demandas", subtitle: "Acompanhe suas solicitações" },
  Timeline: { title: "Timeline", subtitle: "Histórico de entregas" },
  AbrirDemanda: { title: "Abrir Demanda", subtitle: "Nova solicitação" },
  Newsletter: { title: "Newsletter & Insights", subtitle: "Atualizações da Voxx" },
  Ajuda: { title: "Central de Ajuda", subtitle: "Playbook e FAQ" },
  Conta: { title: "Minha Conta", subtitle: "Configurações do perfil" }
};

export default function Layout({ children, currentPageName }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000
  });

  const { data: notificacoes = [] } = useQuery({
    queryKey: ['notificacoes', user?.email],
    queryFn: () => base44.entities.Notificacao.filter({ user_email: user?.email, lida: false }, '-created_date', 10),
    enabled: !!user?.email,
    staleTime: 60 * 1000
  });

  const { data: pendingDemandas = [] } = useQuery({
    queryKey: ['pendingDemandas', user?.cliente_id],
    queryFn: () => {
      if (user?.tipo_acesso?.startsWith('voxx')) {
        return base44.entities.Demanda.filter({ status: 'aguardando_cliente' }, '-created_date', 50);
      }
      return base44.entities.Demanda.filter({ 
        cliente_id: user?.cliente_id, 
        status: 'aguardando_cliente' 
      }, '-created_date', 50);
    },
    enabled: !!user,
    staleTime: 60 * 1000
  });

  const handleLogout = () => {
    base44.auth.logout('/');
  };

  const pageInfo = pageTitles[currentPageName] || { title: currentPageName, subtitle: "" };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar 
          currentPage={currentPageName}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          pendingDemandas={pendingDemandas.length}
          onLogout={handleLogout}
        />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-slate-900">
          <Sidebar 
            currentPage={currentPageName}
            collapsed={false}
            setCollapsed={() => {}}
            pendingDemandas={pendingDemandas.length}
            onLogout={handleLogout}
          />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className={cn(
        "min-h-screen transition-all duration-300",
        sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
      )}>
        <Header 
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          user={user}
          notificacoes={notificacoes}
          onMobileMenuClick={() => setMobileMenuOpen(true)}
        />
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}