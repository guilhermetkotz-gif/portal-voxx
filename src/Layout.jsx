import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import ClienteSelector from '@/components/auth/ClienteSelector';
import { Loader2, AlertTriangle } from 'lucide-react';
import { getAccessibleClienteIds, isVoxxAdmin, isVoxxOperacao, logAction } from '@/components/utils/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ChatWidget from '@/components/chat/ChatWidget';
import ReuniaoLembrete from '@/components/agenda/ReuniaoLembrete';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

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
        GestaoSaldoGoogleAds: { title: "Gestão de Saldo Google Ads", subtitle: "Controle financeiro operacional — Google Ads" },
        RecalculoMetaAds: { title: "Recálculo Meta Ads", subtitle: "Investimento diário ideal por unidade" },
        AbrirDemanda: { title: "Abrir Demanda", subtitle: "Nova solicitação" },
        Newsletter: { title: "Newsletter & Insights", subtitle: "Atualizações da Voxx" },
        Ajuda: { title: "Central de Ajuda", subtitle: "Playbook e FAQ" },
        Conta: { title: "Minha Conta", subtitle: "Configurações do perfil" },
        GerenciarAcessos: { title: "Gerenciar Acessos", subtitle: "Controle de usuários e permissões" },
        AgendaVoxx: { title: "Agenda VOXX", subtitle: "Reuniões e organização da equipe" },
        AgendaDashboard: { title: "Dashboard Agenda", subtitle: "Performance do time e disciplina operacional" },
        Comercial: { title: "Comercial", subtitle: "Pipeline de vendas e gestão de leads" },
        LeadDetalhe: { title: "Lead", subtitle: "Detalhes e histórico do lead" },
        Kanban: { title: "Kanban de Demandas", subtitle: "Gerencie demandas por setor" },
                MonitoramentoDemandas: { title: "Monitoramento de Demandas", subtitle: "Analytics e KPIs de demandas" },
        GerenciarContas: { title: "Gerenciar Contas", subtitle: "Gestão de clientes e unidades" },
        PlanoDeAcao: { title: "Plano de Ação", subtitle: "Acompanhamento de ações por cliente" },
        PlanoDeAcaoDetalhe: { title: "Plano de Ação", subtitle: "Detalhes do plano" },
        ReportDiario: { title: "Report Diário", subtitle: "Resumo executivo diário por cliente" },
        InteligenicaUnidades: { title: "Inteligência de Unidades", subtitle: "Performance consolidada da rede Oral Sin" },
        FinanceiroVisaoGeral: { title: "Financeiro — Visão Geral", subtitle: "Dashboard financeiro VOXX" },
        FinanceiroReceitas: { title: "Receitas", subtitle: "Controle de faturamento por cliente" },
        FinanceiroCustos: { title: "Custos & Despesas", subtitle: "Controle de gastos operacionais" },
        FinanceiroFolha: { title: "Folha de Pagamento", subtitle: "CLT + PJ — gestão de equipe" },
        FinanceiroDocumentos: { title: "Documentos Financeiros", subtitle: "Central de comprovantes e documentos" },
        FinanceiroFluxoCaixa: { title: "Fluxo de Caixa (DRE)", subtitle: "Demonstrativo de resultado — visão executiva" },
        FinanceiroCarteira: { title: "Carteira de Clientes", subtitle: "Evolução, churn e crescimento da base" }
                };

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedClienteId, setSelectedClienteId] = useState(null);

  // Use AuthContext instead of re-fetching on every navigation (prevents blank screen)
  const { user, isLoadingAuth: loadingUser } = useAuth();

  // Calculate isVoxxUser early (before hooks that need it)
  const tipoUsuarioAccessEarly = user?.tipo_usuario || user?.tipo_acesso;
  const tipoUsuarioLayout = tipoUsuarioAccessEarly;

  // Redirect oral_sin_franqueadora from Home to InteligenicaUnidades (must be before any return)
  // Redirect voxx_financeiro from Home to FinanceiroVisaoGeral
  useEffect(() => {
    if (tipoUsuarioLayout === 'oral_sin_franqueadora' && (location.pathname === '/' || currentPageName === 'Home')) {
      navigate(createPageUrl('InteligenicaUnidades'));
    }
    if (tipoUsuarioLayout === 'voxx_financeiro' && (location.pathname === '/' || currentPageName === 'Home')) {
      navigate(createPageUrl('FinanceiroVisaoGeral'));
    }
  }, [tipoUsuarioLayout, location.pathname, currentPageName]);
  const isVoxxUserEarly = tipoUsuarioAccessEarly === 'voxx_admin' || tipoUsuarioAccessEarly === 'voxx_operacao' || tipoUsuarioAccessEarly === 'voxx_manager' || tipoUsuarioAccessEarly === 'voxx_financeiro';

  // Check if user has access request (must be called before any conditional returns)
  const { data: userRequest } = useQuery({
    queryKey: ['userRequest', user?.id],
    queryFn: () => base44.entities.AccessRequest.filter({ usuario_id: user?.id }, '-created_date', 1),
    enabled: !!user?.id && (user?.status === 'pendente' || (!user?.status && !isVoxxUserEarly)),
    staleTime: 30 * 1000
  });



  // Fetch all accessible clientes
  const { data: clientes = [], isLoading: loadingClientes, error: clientesError } = useQuery({
    queryKey: ['clientes', user?.tipo_usuario, user?.tipo_acesso, user?.role],
    queryFn: async () => {
      if (!user) return [];
      
      const tipoUsuario = user.tipo_usuario || user.tipo_acesso;
      
      // Base44 admin (role === 'admin') sees ALL clients automatically
      if (user.role === 'admin') {
        return base44.entities.Cliente.list('-updated_date', 500);
      }
      
      // Voxx users see ALL clients automatically ONLY if tipo_usuario is correctly set
      if (tipoUsuario && (tipoUsuario === 'voxx_admin' || tipoUsuario === 'voxx_operacao' || tipoUsuario === 'voxx_manager' || tipoUsuario === 'voxx_financeiro')) {
        return base44.entities.Cliente.list('-updated_date', 500);
      }
      
      // All other users (cliente_admin, cliente_usuario, or users without tipo_usuario)
      // see ONLY assigned clients via UserClientAccess
      const access = await base44.entities.UserClientAccess.filter({
        usuario_id: user.id,
        status: 'ativo'
      });
      
      if (access.length > 0) {
        const clienteIds = access.map(a => a.cliente_id);
        const allClientes = await base44.entities.Cliente.list('-updated_date', 500);
        return allClientes.filter(c => clienteIds.includes(c.id));
      }
      
      return [];
    },
    enabled: !!user,
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
  }, [clientes.length, selectedClienteId]);

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

  const isVoxxUser = isVoxxUserEarly;

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
    return children;
  }

  // Show loading state while fetching user data AND until first cliente is selected
  if (loadingClientes || (clientes.length > 0 && !selectedClienteId)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-4" />
          <p className="text-sm text-slate-500">Carregando sua conta...</p>
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

  // Users with no clients loaded yet (after loading is done) - render page without sidebar selection
  if (user?.status === 'ativo' && !loadingClientes && (!clientes || clientes.length === 0) && !isVoxxUser) {
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

  // Base44 admin bypass - skip all checks
  if (user?.role === 'admin') {
    // Admin has full access, skip to main app
  } else if (!isVoxxUser && (user?.status === 'pendente' || !user?.status)) {
    // Pendente OR new user without status yet → redirect away from any page except BoasVindas/AguardandoAprovacao
    if (currentPageName === 'BoasVindas' || currentPageName === 'AguardandoAprovacao') {
      // Allow these pages
      if (userRequest && userRequest.length > 0) {
        if (currentPageName !== 'AguardandoAprovacao') {
          navigate(createPageUrl('AguardandoAprovacao'));
          return null;
        }
      } else {
        if (currentPageName !== 'BoasVindas') {
          navigate(createPageUrl('BoasVindas'));
          return null;
        }
      }
      return React.cloneElement(children, { user });
    }
    // Any other page → redirect to BoasVindas or AguardandoAprovacao
    if (userRequest && userRequest.length > 0) {
      navigate(createPageUrl('AguardandoAprovacao'));
    } else {
      navigate(createPageUrl('BoasVindas'));
    }
    return null;
  } else if (user?.status === 'ativo' && !isVoxxUser && currentPageName === 'AguardandoAprovacao') {
    // User was approved but is still on AguardandoAprovacao page → redirect to Home
    navigate(createPageUrl('Home'));
    return null;
  }
  // Users with status 'ativo' proceed to main app below

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
          {React.cloneElement(children, { 
            currentCliente: currentCliente || null,
            selectedClienteId: selectedClienteId || null,
            user
          })}
        </div>
      </main>

      {/* Chat Widget for all authenticated users */}
      {user && (
        <ChatWidget user={user} currentCliente={currentCliente} />
      )}

      {/* Lembretes de reunião globais */}
      {user && <ReuniaoLembrete user={user} />}

      {/* Toaster for notifications */}
      <Toaster />
    </div>
  );
}