/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AbrirDemanda from './pages/AbrirDemanda';
import AguardandoAprovacao from './pages/AguardandoAprovacao';
import Ajuda from './pages/Ajuda';
import BoasVindas from './pages/BoasVindas';
import CadastroCliente from './pages/CadastroCliente';
import Chat from './pages/Chat';
import ConfiguracaoAlertas from './pages/ConfiguracaoAlertas';
import Conta from './pages/Conta';
import CrcCaixaLeads from './pages/CrcCaixaLeads';
import CrcConfiguracao from './pages/CrcConfiguracao';
import CrcPerformance from './pages/CrcPerformance';
import Cronograma from './pages/Cronograma';
import DashboardPortfolio from './pages/DashboardPortfolio';
import Demandas from './pages/Demandas';
import DetalheConta from './pages/DetalheConta';
import GerenciarAcessos from './pages/GerenciarAcessos';
import GerenciarChats from './pages/GerenciarChats';
import GerenciarContas from './pages/GerenciarContas';
import GerenciarPermissoes from './pages/GerenciarPermissoes';
import GestaoSaldoMetaAds from './pages/GestaoSaldoMetaAds';
import HistoricoOtimizacoesCliente from './pages/HistoricoOtimizacoesCliente';
import Home from './pages/Home';
import Kanban from './pages/Kanban';
import MonitoramentoContas from './pages/MonitoramentoContas';
import MonitoramentoDemandas from './pages/MonitoramentoDemandas';
import Newsletter from './pages/Newsletter';
import OnboardingCliente from './pages/OnboardingCliente';
import Performance from './pages/Performance';
import PlanejamentoEstrategico from './pages/PlanejamentoEstrategico';
import RecalculoMetaAds from './pages/RecalculoMetaAds';
import Saldos from './pages/Saldos';
import SolicitarAcesso from './pages/SolicitarAcesso';
import Timeline from './pages/Timeline';
import MonitoramentoGoogleAds from './pages/MonitoramentoGoogleAds';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AbrirDemanda": AbrirDemanda,
    "AguardandoAprovacao": AguardandoAprovacao,
    "Ajuda": Ajuda,
    "BoasVindas": BoasVindas,
    "CadastroCliente": CadastroCliente,
    "Chat": Chat,
    "ConfiguracaoAlertas": ConfiguracaoAlertas,
    "Conta": Conta,
    "CrcCaixaLeads": CrcCaixaLeads,
    "CrcConfiguracao": CrcConfiguracao,
    "CrcPerformance": CrcPerformance,
    "Cronograma": Cronograma,
    "DashboardPortfolio": DashboardPortfolio,
    "Demandas": Demandas,
    "DetalheConta": DetalheConta,
    "GerenciarAcessos": GerenciarAcessos,
    "GerenciarChats": GerenciarChats,
    "GerenciarContas": GerenciarContas,
    "GerenciarPermissoes": GerenciarPermissoes,
    "GestaoSaldoMetaAds": GestaoSaldoMetaAds,
    "HistoricoOtimizacoesCliente": HistoricoOtimizacoesCliente,
    "Home": Home,
    "Kanban": Kanban,
    "MonitoramentoContas": MonitoramentoContas,
    "MonitoramentoDemandas": MonitoramentoDemandas,
    "Newsletter": Newsletter,
    "OnboardingCliente": OnboardingCliente,
    "Performance": Performance,
    "PlanejamentoEstrategico": PlanejamentoEstrategico,
    "RecalculoMetaAds": RecalculoMetaAds,
    "Saldos": Saldos,
    "SolicitarAcesso": SolicitarAcesso,
    "Timeline": Timeline,
    "MonitoramentoGoogleAds": MonitoramentoGoogleAds,
}

export const pagesConfig = {
    mainPage: "MonitoramentoGoogleAds",
    Pages: PAGES,
    Layout: __Layout,
};