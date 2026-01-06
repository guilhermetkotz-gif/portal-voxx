import Home from './pages/Home';
import Performance from './pages/Performance';
import Saldos from './pages/Saldos';
import Demandas from './pages/Demandas';
import Timeline from './pages/Timeline';
import AbrirDemanda from './pages/AbrirDemanda';
import Newsletter from './pages/Newsletter';
import Ajuda from './pages/Ajuda';
import Conta from './pages/Conta';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "Performance": Performance,
    "Saldos": Saldos,
    "Demandas": Demandas,
    "Timeline": Timeline,
    "AbrirDemanda": AbrirDemanda,
    "Newsletter": Newsletter,
    "Ajuda": Ajuda,
    "Conta": Conta,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};