import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import ClienteSelector from '@/components/auth/ClienteSelector';
import { Loader2 } from 'lucide-react';
import { getAccessibleClienteIds, isVoxxAdmin, isVoxxOperacao, logAction } from '@/components/utils/auth';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ChatWidget from '@/components/chat/ChatWidget';
import { Toaster } from '@/components/ui/toaster';

const pageTitles = {
      Home: { title: "Resumo Executivo", subtitle: "Visão geral da sua conta" },
      Chat: { title: "Chat & Suporte", subtitle: "Fale com nossa equipe" },
      Performance: { title: "Performance", subtitle: "Meta & Google Ads" },
        DashboardPortfolio: { title: "Dashboard do Portfólio", subtitle: "Performance agregada de contas" },
        Saldos: { title: "Saldos & Investimentos", subtitle: "Controle financeiro" },
        Demandas: { title: "Demandas", subtitle: "Acompanhe suas solicitações" },
        Timeline: { title: "Timeline", subtitle: "Histórico de entregas" },
        Cronograma: { title: "Cronograma", subtitle: "Cronograma Oral Sin" },
        PlanejamentoEstrategico: { title: "Planejamento Estratégico", subtitle: "Planejamento mensal por unidade" },
        GestaoSaldoMetaAds: { title: "Gestão de Saldo Meta Ads", subtitle: "Controle financeiro operacional" },
        RecalculoMetaAds: { title: "Recálculo Meta Ads", subtitle: "Investimento diário ideal por unidade" },
        AbrirDemanda: { title: "Abrir Demanda", subtitle: "Nova solicitação" },
        Newsletter: { title: "Newsletter & Insights", subtitle: "Atualizações da Voxx" },
        Ajuda: { title: "Central de Ajuda", subtitle: "Playbook e FAQ" },
        Conta: { title: "Minha Conta", subtitle: "Configurações do perfil" },
        GerenciarAcessos: { title: "Gerenciar Acessos", subtitle: "Controle de usuários e permissões" },
        Kanban: { title: "Kanban de Demandas", subtitle: "Gerencie demandas por setor" },
                MonitoramentoDemandas: { title: "Monitoramento de Demandas", subtitle: "Analytics e KPIs de demandas" }
                };

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedClienteId, setSelectedClienteId] = useState(null);

  const { data: user, isLoading: loadingUser, error: userError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        const userData = await base44.auth.me();
        // Update last access
        if (userData?.id) {
          await base44.entities.User.update(userData.id, {
            ultimo_acesso: new Date().toISOString()
          }).catch(() => {});
        }
        return userData;
      } catch (error) {
        // User not authenticated
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false
  });

  // Check if user has access request (must be called before any conditional returns)
  const { data: userRequest } = useQuery({
    queryKey: ['userRequest', user?.id],
    queryFn: () => base44.entities.AccessRequest.filter({ usuario_id: user?.id }, '-created_date', 1),
    enabled: !!user?.id && user?.status === 'pendente',
    staleTime: 30 * 1000
  });

  // Fetch user's client access (UserClientAccess)
  const { data: userAccess, isLoading: loadingAccess, error: accessError } = useQuery({
    queryKey: ['userAccess', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Base44 admin (role === 'admin') has full access
      if (user.role === 'admin') {
        return 'all';
      }
      
      // Voxx users might not have UserClientAccess, they use clientes_atribuidos or tipo_acesso
      if (user.tipo_acesso === 'voxx_admin') {
        return 'all'; // Admin sees all
      }
      
      if (user.tipo_acesso === 'voxx_operacao') {
        // Get clientes from clientes_atribuidos
        if (user.clientes_atribuidos?.length > 0) {
          return user.clientes_atribuidos.map(id => ({ cliente_id: id, status: 'ativo' }));
        }
        return [];
      }
      
      // For client users, get from UserClientAccess
      const access = await base44.entities.UserClientAccess.filter({
        usuario_id: user.id,
        status: 'ativo'
      });
      
      return access || [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    retry: 2
  });

  // Fetch all accessible clientes based on UserClientAccess
  const { data: clientes = [], isLoading: loadingClientes, error: clientesError } = useQuery({
    queryKey: ['clientes', user?.tipo_usuario, userAccess],
    queryFn: async () => {
      if (!user) return [];
      
      if (userAccess === 'all') {
        return base44.entities.Cliente.list('-updated_date', 500);
      }
      
      if (Array.isArray(userAccess) && userAccess.length > 0) {
        const clienteIds = userAccess.map(a => a.cliente_id);
        const allClientes = await base44.entities.Cliente.list('-updated_date', 500);
        return allClientes.filter(c => clienteIds.includes(c.id));
      }
      
      return [];
    },
    enabled: !!user && userAccess !== undefined,
    staleTime: 2 * 60 * 1000,
    retry: 2
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
  }, [clientes.length]);

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
    queryKey: ['pendingDemandas', selectedClienteId, user?.tipo_acesso],
    queryFn: async () => {
      if (user?.tipo_acesso === 'voxx_admin') {
        return base44.entities.Demanda.filter({ status: 'aguardando_cliente' }, '-created_date', 50);
      }
      if (user?.tipo_acesso === 'voxx_operacao') {
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
  if (user && (user.tipo_acesso === 'voxx_admin' || user.tipo_acesso === 'voxx_operacao') && clientes.length > 0 && !selectedClienteId) {
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

  // Users with no clients but status 'ativo' - allow access but will show message in Home
  if (user?.status === 'ativo' && (!clientes || clientes.length === 0)) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header 
          title="Resumo Executivo"
          subtitle="Visão geral da sua conta"
          user={user}
          cliente={null}
          clientes={[]}
          onChangeCliente={() => {}}
          notificacoes={[]}
          onMobileMenuClick={() => setMobileMenuOpen(true)}
        />
        <div className="p-4 lg:p-8">
          {React.cloneElement(children, { 
            currentCliente: null,
            selectedClienteId: null,
            user
          })}
        </div>
      </div>
    );
  }

  // Show loading state while checking authentication
  if (loadingUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  // User not authenticated → show content (will be BoasVindas in Home page)
  if (!user) {
    return React.cloneElement(children, { user: null });
  }

  // Show loading state for user data
  if (loadingClientes || loadingAccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-4" />
          <p className="text-sm text-slate-500">Carregando seus dados...</p>
        </div>
      </div>
    );
  }

  // Show error if failed to load
  if (clientesError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Erro ao carregar dados</h2>
          <p className="text-slate-600 mb-4">
            {clientesError.message || 'Não foi possível carregar suas informações.'}
          </p>
          <Button onClick={() => window.location.reload()}>
            Recarregar Página
          </Button>
        </Card>
      </div>
    );
  }

  // Base44 admin bypass - skip all checks
  if (user?.role === 'admin') {
    // Admin has full access, skip to main app
  } else {
    // 2. User is pendente WITH request → redirect to AguardandoAprovacao
    if (user?.status === 'pendente' && userRequest && userRequest.length > 0) {
      if (currentPageName !== 'AguardandoAprovacao') {
        navigate(createPageUrl('AguardandoAprovacao'));
        return null;
      }
      return React.cloneElement(children, { user });
    }

    // 3. User is pendente WITHOUT request → redirect to BoasVindas
    if (user?.status === 'pendente' && (!userRequest || userRequest.length === 0)) {
      if (currentPageName !== 'BoasVindas') {
        navigate(createPageUrl('BoasVindas'));
        return null;
      }
      return React.cloneElement(children, { user });
    }

    // 4. Users with status 'ativo' can access the app even without clients
    // They will see an appropriate message on the Home page
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
          user={user}
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
            user={user}
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
          {currentCliente ? React.cloneElement(children, { 
            currentCliente,
            selectedClienteId,
            user
          }) : children}
        </div>
        </main>

        {/* Chat Widget for all authenticated users */}
        {user && (
        <ChatWidget user={user} currentCliente={currentCliente} />
        )}

        {/* Toaster for notifications */}
        <Toaster />
        </div>
        );
        }