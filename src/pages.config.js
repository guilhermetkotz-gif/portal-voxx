import Home from './pages/Home';
import Performance from './pages/Performance';
import Saldos from './pages/Saldos';
import Demandas from './pages/Demandas';
import Timeline from './pages/Timeline';
import AbrirDemanda from './pages/AbrirDemanda';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "Performance": Performance,
    "Saldos": Saldos,
    "Demandas": Demandas,
    "Timeline": Timeline,
    "AbrirDemanda": AbrirDemanda,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};