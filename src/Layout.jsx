import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getAccessibleClienteIds, isVoxxAdmin, isVoxxOperacao, logAction } from '@/components/utils/auth';
import { Card } from "@/components/ui/card";
import ClienteSelector from '@/components/auth/ClienteSelector';
import { Loader2 } from 'lucide-react';

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
  const [selectedClienteId, setSelectedClienteId] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const userData = await base44.auth.me();
      // Update last access
      if (userData?.id) {
        await base44.entities.User.update(userData.id, {
          ultimo_acesso: new Date().toISOString()
        }).catch(() => {});
      }
      return userData;
    },
    staleTime: 5 * 60 * 1000
  });

  // Fetch all accessible clientes
  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes', user?.tipo_usuario, user?.cliente_id, user?.clientes_atribuidos],
    queryFn: async () => {
      if (!user) return [];
      
      const accessibleIds = getAccessibleClienteIds(user);
      
      if (accessibleIds === 'all') {
        return base44.entities.Cliente.list('-updated_date', 500);
      }
      
      if (Array.isArray(accessibleIds) && accessibleIds.length > 0) {
        const allClientes = await base44.entities.Cliente.list('-updated_date', 500);
        return allClientes.filter(c => accessibleIds.includes(c.id));
      }
      
      return [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000
  });

  // Set initial selected cliente
  useEffect(() => {
    if (clientes.length > 0 && !selectedClienteId) {
      // Try to restore from localStorage
      const stored = localStorage.getItem('voxx_selected_cliente_id');
      if (stored && clientes.find(c => c.id === stored)) {
        setSelectedClienteId(stored);
      } else {
        // Default to first cliente
        setSelectedClienteId(clientes[0].id);
      }
    }
  }, [clientes, selectedClienteId]);

  // Save selected cliente to localStorage
  useEffect(() => {
    if (selectedClienteId) {
      localStorage.setItem('voxx_selected_cliente_id', selectedClienteId);
    }
  }, [selectedClienteId]);

  const currentCliente = clientes.find(c => c.id === selectedClienteId);

  const { data: notificacoes = [] } = useQuery({
    queryKey: ['notificacoes', user?.email, selectedClienteId],
    queryFn: () => {
      const filters = { user_email: user?.email, lida: false };
      if (!isVoxxAdmin(user)) {
        filters.cliente_id = selectedClienteId;
      }
      return base44.entities.Notificacao.filter(filters, '-created_date', 10);
    },
    enabled: !!user?.email && !!selectedClienteId,
    staleTime: 60 * 1000
  });

  const { data: pendingDemandas = [] } = useQuery({
    queryKey: ['pendingDemandas', selectedClienteId, user?.tipo_usuario],
    queryFn: async () => {
      if (isVoxxAdmin(user)) {
        return base44.entities.Demanda.filter({ status: 'aguardando_cliente' }, '-created_date', 50);
      }
      if (isVoxxOperacao(user)) {
        const all = await base44.entities.Demanda.filter({ status: 'aguardando_cliente' }, '-created_date', 50);
        return all.filter(d => user?.clientes_atribuidos?.includes(d.cliente_id));
      }
      return base44.entities.Demanda.filter({ 
        cliente_id: selectedClienteId, 
        status: 'aguardando_cliente' 
      }, '-created_date', 50);
    },
    enabled: !!user && !!selectedClienteId,
    staleTime: 60 * 1000
  });

  const handleLogout = async () => {
    if (user) {
      await logAction('logout', user.id, user.email, selectedClienteId);
    }
    base44.auth.logout('/');
  };

  const handleChangeCliente = (cliente) => {
    setSelectedClienteId(cliente.id);
  };

  const pageInfo = pageTitles[currentPageName] || { title: currentPageName, subtitle: "" };

  // Show cliente selector for Voxx users without selected cliente
  if (user && (isVoxxAdmin(user) || isVoxxOperacao(user)) && clientes.length > 0 && !selectedClienteId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Selecione um Cliente</h1>
          <ClienteSelector 
            clientes={clientes}
            onSelectCliente={handleChangeCliente}
          />
        </Card>
      </div>
    );
  }

  // Show loading state
  if (loadingClientes || !user || !currentCliente) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

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
          cliente={currentCliente}
          clientes={clientes}
          onChangeCliente={handleChangeCliente}
          notificacoes={notificacoes}
          onMobileMenuClick={() => setMobileMenuOpen(true)}
        />
        <div className="p-4 lg:p-8">
          {React.cloneElement(children, { 
            currentCliente,
            selectedClienteId,
            user
          })}
        </div>
      </main>
    </div>
  );
}