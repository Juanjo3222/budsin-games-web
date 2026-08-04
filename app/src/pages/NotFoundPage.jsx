import { useI18n } from "../context/I18nContext";
import Topbar from "../components/Topbar";
import Footer from "../components/Footer";

export default function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="site-shell">
      <Topbar />
      <main className="page-main page-main-narrow">
        <div className="glass static-content not-found">
          <h1>404</h1>
          <h2>{t("notFoundTitle", "Página no encontrada")}</h2>
          <p>{t("notFoundText", "La página que buscas no existe o fue movida.")}</p>
          <a className="btn btn-primary" href="#/">← {t("backHome", "Volver al portal")}</a>
        </div>
      </main>
      <Footer />
    </div>
  );
}
