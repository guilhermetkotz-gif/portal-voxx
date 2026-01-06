import Home from './pages/Home';
import Performance from './pages/Performance';
import Saldos from './pages/Saldos';
import Demandas from './pages/Demandas';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "Performance": Performance,
    "Saldos": Saldos,
    "Demandas": Demandas,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};