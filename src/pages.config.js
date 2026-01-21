import AbrirDemanda from './pages/AbrirDemanda';
import AguardandoAprovacao from './pages/AguardandoAprovacao';
import Ajuda from './pages/Ajuda';
import BoasVindas from './pages/BoasVindas';
import Conta from './pages/Conta';
import Cronograma from './pages/Cronograma';
import Demandas from './pages/Demandas';
import DetalheConta from './pages/DetalheConta';
import GerenciarAcessos from './pages/GerenciarAcessos';
import GerenciarContas from './pages/GerenciarContas';
import HistoricoOtimizacoesCliente from './pages/HistoricoOtimizacoesCliente';
import Home from './pages/Home';
import Kanban from './pages/Kanban';
import MonitoramentoContas from './pages/MonitoramentoContas';
import Newsletter from './pages/Newsletter';
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
    "Conta": Conta,
    "Cronograma": Cronograma,
    "Demandas": Demandas,
    "DetalheConta": DetalheConta,
    "GerenciarAcessos": GerenciarAcessos,
    "GerenciarContas": GerenciarContas,
    "HistoricoOtimizacoesCliente": HistoricoOtimizacoesCliente,
    "Home": Home,
    "Kanban": Kanban,
    "MonitoramentoContas": MonitoramentoContas,
    "Newsletter": Newsletter,
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