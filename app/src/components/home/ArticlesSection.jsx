import { useI18n } from "../../context/I18nContext";

const ARTICLES = [
  {
    icon: "🎮",
    title: ["article1Title", "Cómo usar el modo oculto"],
    desc: ["article1Desc", "El Classroom Hotkey te permite ocultar el portal al instante. Configura tu tecla de acceso rápido y una URL de disfraz desde la página de Ajustes. Al pulsar la tecla, el sitio se redirige a la URL que prefieras."],
    cta: { key: "article1Cta", fallback: "Ir a Ajustes →", href: "#/settings" },
  },
  {
    icon: "⭐",
    title: ["article2Title", "Guarda tus favoritos"],
    desc: ["article2Desc", "Haz clic en la estrella de cualquier juego para añadirlo a tu lista de favoritos. Los favoritos se guardan automáticamente en tu navegador y aparecen en la sección Tus juegos para que los encuentres al instante."],
  },
  {
    icon: "🔍",
    title: ["article3Title", "Busca y filtra juegos"],
    desc: ["article3Desc", "Usa el buscador en tiempo real para encontrar juegos por nombre. También puedes filtrar por categoría: Acción, Idle, Multiplayer, Clásicos o herramientas. El contador de resultados te muestra cuántos juegos coinciden."],
  },
];

export default function ArticlesSection() {
  const { t } = useI18n();

  return (
    <section className="articles-section">
      <div className="articles-head">
        <span className="articles-kicker">{t("articlesKicker", "Consejos y guías")}</span>
        <h2>{t("articlesTitle", "Tips para sacarle más partido al portal")}</h2>
      </div>
      <div className="articles-grid">
        {ARTICLES.map((a) => (
          <article key={a.title[0]} className="article-card glass">
            <div className="article-icon">{a.icon}</div>
            <h3>{t(...a.title)}</h3>
            <p>{t(...a.desc)}</p>
            {a.cta && <a href={a.cta.href} className="article-link">{t(a.cta.key, a.cta.fallback)}</a>}
          </article>
        ))}
      </div>
    </section>
  );
}
