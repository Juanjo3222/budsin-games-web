import { useI18n } from "../context/I18nContext";
import Topbar from "../components/Topbar";
import Footer from "../components/Footer";

export default function CommentsPage() {
  const { t } = useI18n();
  return (
    <div className="site-shell">
      <Topbar />
      <main className="page-main page-main-narrow">
        <header className="page-header">
          <h1>{t("commentsTitle", "Comentarios")}</h1>
          <p>{t("commentsSubtitle", "Deja tu opinión y sugerencias para el portal.")}</p>
        </header>
        <div className="glass static-content" style={{ padding: 12 }}>
          <div className="padlet-embed" style={{ border: "1px solid rgba(0,0,0,0.1)", borderRadius: 2, boxSizing: "border-box", overflow: "hidden", position: "relative", width: "100%", background: "#F4F4F4" }}>
            <p style={{ padding: 0, margin: 0 }}>
              <iframe src="https://padlet.com/embed/nrmo5v8eovoaefgw" title="Padlet" allow="camera;microphone;geolocation;display-capture;clipboard-write" style={{ width: "100%", height: 608, display: "block", padding: 0, margin: 0 }} />
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
