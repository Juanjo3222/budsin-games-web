export const SITE_VERSION = "7.0";

const VERSION_KEY = "juanjos_games_seen_version";

export function changelogForLang(lang) {
  const shared = {
    title:
      lang === "en"
        ? "Budsin Games News"
        : lang === "pt"
        ? "Novidades do Budsin Games"
        : "Novedades de Budsin Games",
    desc:
      lang === "en"
        ? "This popup appears only once per version or the first time you enter the site."
        : lang === "pt"
        ? "Este pop-up aparece apenas uma vez por versão ou na primeira vez que você entra no site."
        : "Este popup solo aparece una vez por versión o la primera vez que entras al sitio.",
    items: [
      lang === "en"
        ? "Brand-new glassmorphism design built with React: faster, cleaner and fully responsive."
        : lang === "pt"
        ? "Novo design glassmorphism construído com React: mais rápido, limpo e totalmente responsivo."
        : "Nuevo diseño glassmorphism construido con React: más rápido, limpio y totalmente responsive.",
      lang === "en"
        ? "All pages (portal, settings, admin, about, privacy, terms, contact) migrated to React."
        : lang === "pt"
        ? "Todas as páginas (portal, configurações, admin, sobre, privacidade, termos, contato) migradas para React."
        : "Todas las páginas (portal, ajustes, admin, acerca de, privacidad, términos, contacto) migradas a React.",
    ],
  };
  return shared;
}

export function shouldShowChangelog() {
  try {
    return localStorage.getItem(VERSION_KEY) !== SITE_VERSION;
  } catch (e) {
    return true;
  }
}

export function markChangelogSeen() {
  try {
    localStorage.setItem(VERSION_KEY, SITE_VERSION);
  } catch (e) {}
}
