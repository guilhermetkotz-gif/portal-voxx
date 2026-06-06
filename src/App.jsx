import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Comercial from './pages/Comercial';
import LeadDetalhe from './pages/LeadDetalhe';
import PlanoDeAcao from './pages/PlanoDeAcao';
import PlanoDeAcaoDetalhe from './pages/PlanoDeAcaoDetalhe';
import ReportDiario from './pages/ReportDiario';
import InteligenicaUnidades from './pages/InteligenicaUnidades';
import FinanceiroVisaoGeral from './pages/FinanceiroVisaoGeral';
import FinanceiroReceitas from './pages/FinanceiroReceitas.jsx';
import FinanceiroCustos from './pages/FinanceiroCustos';
import FinanceiroFolha from './pages/FinanceiroFolha';
import FinanceiroDocumentos from './pages/FinanceiroDocumentos';
import FinanceiroFluxoCaixa from './pages/FinanceiroFluxoCaixa';
import FinanceiroCarteira from './pages/FinanceiroCarteira';
import AgendaVoxx from './pages/AgendaVoxx';
import AgendaDashboard from './pages/AgendaDashboard';
import PerformanceOperacional from './pages/PerformanceOperacional';
import BriefingClientes from './pages/BriefingClientes';
import BriefingVisualizacao from './pages/BriefingVisualizacao';
import InteligeniciaOperacional from './pages/InteligeniciaOperacional';
import CentralComunicacao from './pages/CentralComunicacao';
import ConfiguracaoWhatsApp from './pages/ConfiguracaoWhatsApp';
import ConfiguracaoInstancias from './pages/ConfiguracaoInstancias';
import Analises from './pages/Analises';
import RadarWhatsApp from './pages/RadarWhatsApp';
import ImportarHistoricoWhatsapp from './pages/ImportarHistoricoWhatsapp';
import MigracaoComunicacao from './pages/MigracaoComunicacao';
import AprovacaoPublica from './pages/AprovacaoPublica';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { RealtimeProvider } from '@/lib/RealtimeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { user, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Rotas públicas — acessíveis sem login
  if (window.location.pathname.startsWith('/aprovacao/')) {
    return (
      <Routes>
        <Route path="/aprovacao/:token" element={<AprovacaoPublica />} />
      </Routes>
    );
  }

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-violet-600 rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-slate-500">Redirecionando para o login...</p>
          </div>
        </div>
      );
    } else {
      // Unknown error (network, domain, etc.) - show message instead of blank screen
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-white p-4">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500 text-xl">!</span>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Erro ao carregar o portal</h2>
            <p className="text-sm text-slate-500 mb-4">{authError.message || 'Não foi possível conectar. Verifique sua conexão e tente novamente.'}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }
  }

  // If user is not authenticated and no error, don't render main app
  if (!user && !authError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/Comercial" element={<LayoutWrapper currentPageName="Comercial"><Comercial /></LayoutWrapper>} />
      <Route path="/LeadDetalhe" element={<LayoutWrapper currentPageName="Comercial"><LeadDetalhe /></LayoutWrapper>} />
      <Route path="/PlanoDeAcao" element={<LayoutWrapper currentPageName="PlanoDeAcao"><PlanoDeAcao /></LayoutWrapper>} />
      <Route path="/PlanoDeAcaoDetalhe" element={<LayoutWrapper currentPageName="PlanoDeAcaoDetalhe"><PlanoDeAcaoDetalhe /></LayoutWrapper>} />
      <Route path="/ReportDiario" element={<LayoutWrapper currentPageName="ReportDiario"><ReportDiario /></LayoutWrapper>} />
      <Route path="/InteligenicaUnidades" element={<LayoutWrapper currentPageName="InteligenicaUnidades"><InteligenicaUnidades /></LayoutWrapper>} />
      <Route path="/FinanceiroVisaoGeral" element={<LayoutWrapper currentPageName="FinanceiroVisaoGeral"><FinanceiroVisaoGeral /></LayoutWrapper>} />
      <Route path="/FinanceiroReceitas" element={<LayoutWrapper currentPageName="FinanceiroReceitas"><FinanceiroReceitas /></LayoutWrapper>} />
      <Route path="/FinanceiroCustos" element={<LayoutWrapper currentPageName="FinanceiroCustos"><FinanceiroCustos /></LayoutWrapper>} />
      <Route path="/FinanceiroFolha" element={<LayoutWrapper currentPageName="FinanceiroFolha"><FinanceiroFolha /></LayoutWrapper>} />
      <Route path="/FinanceiroDocumentos" element={<LayoutWrapper currentPageName="FinanceiroDocumentos"><FinanceiroDocumentos /></LayoutWrapper>} />
      <Route path="/FinanceiroFluxoCaixa" element={<LayoutWrapper currentPageName="FinanceiroFluxoCaixa"><FinanceiroFluxoCaixa /></LayoutWrapper>} />
      <Route path="/FinanceiroCarteira" element={<LayoutWrapper currentPageName="FinanceiroCarteira"><FinanceiroCarteira /></LayoutWrapper>} />
      <Route path="/AgendaVoxx" element={<LayoutWrapper currentPageName="AgendaVoxx"><AgendaVoxx /></LayoutWrapper>} />
      <Route path="/AgendaDashboard" element={<LayoutWrapper currentPageName="AgendaDashboard"><AgendaDashboard /></LayoutWrapper>} />
      <Route path="/PerformanceOperacional" element={<LayoutWrapper currentPageName="PerformanceOperacional"><PerformanceOperacional /></LayoutWrapper>} />
      <Route path="/BriefingClientes" element={<LayoutWrapper currentPageName="BriefingClientes"><BriefingClientes /></LayoutWrapper>} />
      <Route path="/BriefingVisualizacao" element={<LayoutWrapper currentPageName="BriefingClientes"><BriefingVisualizacao /></LayoutWrapper>} />
      <Route path="/InteligeniciaOperacional" element={<LayoutWrapper currentPageName="InteligeniciaOperacional"><InteligeniciaOperacional /></LayoutWrapper>} />
      <Route path="/CentralComunicacao" element={<LayoutWrapper currentPageName="CentralComunicacao"><CentralComunicacao /></LayoutWrapper>} />
      <Route path="/ConfiguracaoWhatsApp" element={<LayoutWrapper currentPageName="ConfiguracaoWhatsApp"><ConfiguracaoWhatsApp /></LayoutWrapper>} />
      <Route path="/ConfiguracaoInstancias" element={<LayoutWrapper currentPageName="ConfiguracaoInstancias"><ConfiguracaoInstancias /></LayoutWrapper>} />
      <Route path="/MigracaoComunicacao" element={<LayoutWrapper currentPageName="CentralComunicacao"><MigracaoComunicacao /></LayoutWrapper>} />
      <Route path="/Analises" element={<LayoutWrapper currentPageName="Analises"><Analises /></LayoutWrapper>} />
      <Route path="/RadarWhatsApp" element={<LayoutWrapper currentPageName="RadarWhatsApp"><RadarWhatsApp /></LayoutWrapper>} />
      <Route path="/ImportarHistoricoWhatsapp" element={<LayoutWrapper currentPageName="Analises"><ImportarHistoricoWhatsapp /></LayoutWrapper>} />
      <Route path="/aprovacao/:token" element={<AprovacaoPublica />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <RealtimeProvider>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster richColors position="top-right" />
        </RealtimeProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App