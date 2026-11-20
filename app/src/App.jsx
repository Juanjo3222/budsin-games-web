import { useLocation, Routes, Route, HashRouter as Router } from "react-router-dom";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";
import AboutPage from "./pages/AboutPage";
import ExternalRedirect from "./components/ExternalRedirect";
import ContactPage from "./pages/ContactPage";
import CommentsPage from "./pages/CommentsPage";
import NotFoundPage from "./pages/NotFoundPage";

function Routed() {
  const location = useLocation();
  return (
    <Routes location={location}>
      <Route path="/" element={<HomePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/privacidad" element={<ExternalRedirect to="https://budsin.dev/privacidad" />} />
      <Route path="/terms" element={<ExternalRedirect to="https://budsin.dev/terminos" />} />
      <Route path="/contacto" element={<ContactPage />} />
      <Route path="/comentarios" element={<CommentsPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <Routed />
    </Router>
  );
}
