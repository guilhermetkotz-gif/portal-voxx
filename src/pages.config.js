import AbrirDemanda from './pages/AbrirDemanda';
import AguardandoAprovacao from './pages/AguardandoAprovacao';
import Ajuda from './pages/Ajuda';
import BoasVindas from './pages/BoasVindas';
import Conta from './pages/Conta';
import Cronograma from './pages/Cronograma';
import Demandas from './pages/Demandas';
import GerenciarAcessos from './pages/GerenciarAcessos';
import GerenciarContas from './pages/GerenciarContas';
import Home from './pages/Home';
import Newsletter from './pages/Newsletter';
import Performance from './pages/Performance';
import Saldos from './pages/Saldos';
import SolicitarAcesso from './pages/SolicitarAcesso';
import Timeline from './pages/Timeline';
import Kanban from './pages/Kanban';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AbrirDemanda": AbrirDemanda,
    "AguardandoAprovacao": AguardandoAprovacao,
    "Ajuda": Ajuda,
    "BoasVindas": BoasVindas,
    "Conta": Conta,
    "Cronograma": Cronograma,
    "Demandas": Demandas,
    "GerenciarAcessos": GerenciarAcessos,
    "GerenciarContas": GerenciarContas,
    "Home": Home,
    "Newsletter": Newsletter,
    "Performance": Performance,
    "Saldos": Saldos,
    "SolicitarAcesso": SolicitarAcesso,
    "Timeline": Timeline,
    "Kanban": Kanban,
}

export const pagesConfig = {
    mainPage: "GerenciarAcessos",
    Pages: PAGES,
    Layout: __Layout,
};