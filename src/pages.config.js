import AbrirDemanda from './pages/AbrirDemanda';
import AguardandoAprovacao from './pages/AguardandoAprovacao';
import Ajuda from './pages/Ajuda';
import BoasVindas from './pages/BoasVindas';
import CadastroCliente from './pages/CadastroCliente';
import Conta from './pages/Conta';
import Cronograma from './pages/Cronograma';
import Demandas from './pages/Demandas';
import DetalheConta from './pages/DetalheConta';
import GerenciarAcessos from './pages/GerenciarAcessos';
import GerenciarContas from './pages/GerenciarContas';
import GestaoSaldoMetaAds from './pages/GestaoSaldoMetaAds';
import HistoricoOtimizacoesCliente from './pages/HistoricoOtimizacoesCliente';
import Home from './pages/Home';
import Kanban from './pages/Kanban';
import MonitoramentoContas from './pages/MonitoramentoContas';
import Newsletter from './pages/Newsletter';
import OnboardingCliente from './pages/OnboardingCliente';
import Performance from './pages/Performance';
import PlanejamentoEstrategico from './pages/PlanejamentoEstrategico';
import Saldos from './pages/Saldos';
import SolicitarAcesso from './pages/SolicitarAcesso';
import Timeline from './pages/Timeline';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AbrirDemanda": AbrirDemanda,
    "AguardandoAprovacao": AguardandoAprovacao,
    "Ajuda": Ajuda,
    "BoasVindas": BoasVindas,
    "CadastroCliente": CadastroCliente,
    "Conta": Conta,
    "Cronograma": Cronograma,
    "Demandas": Demandas,
    "DetalheConta": DetalheConta,
    "GerenciarAcessos": GerenciarAcessos,
    "GerenciarContas": GerenciarContas,
    "GestaoSaldoMetaAds": GestaoSaldoMetaAds,
    "HistoricoOtimizacoesCliente": HistoricoOtimizacoesCliente,
    "Home": Home,
    "Kanban": Kanban,
    "MonitoramentoContas": MonitoramentoContas,
    "Newsletter": Newsletter,
    "OnboardingCliente": OnboardingCliente,
    "Performance": Performance,
    "PlanejamentoEstrategico": PlanejamentoEstrategico,
    "Saldos": Saldos,
    "SolicitarAcesso": SolicitarAcesso,
    "Timeline": Timeline,
}

export const pagesConfig = {
    mainPage: "GerenciarAcessos",
    Pages: PAGES,
    Layout: __Layout,
};