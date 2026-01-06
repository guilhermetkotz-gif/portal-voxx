import AbrirDemanda from './pages/AbrirDemanda';
import Ajuda from './pages/Ajuda';
import Conta from './pages/Conta';
import Demandas from './pages/Demandas';
import Home from './pages/Home';
import Newsletter from './pages/Newsletter';
import Performance from './pages/Performance';
import Saldos from './pages/Saldos';
import Timeline from './pages/Timeline';
import GerenciarAcessos from './pages/GerenciarAcessos';
import SolicitarAcesso from './pages/SolicitarAcesso';
import AguardandoAprovacao from './pages/AguardandoAprovacao';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AbrirDemanda": AbrirDemanda,
    "Ajuda": Ajuda,
    "Conta": Conta,
    "Demandas": Demandas,
    "Home": Home,
    "Newsletter": Newsletter,
    "Performance": Performance,
    "Saldos": Saldos,
    "Timeline": Timeline,
    "GerenciarAcessos": GerenciarAcessos,
    "SolicitarAcesso": SolicitarAcesso,
    "AguardandoAprovacao": AguardandoAprovacao,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};