import { useI18n } from "../context/I18nContext";

export default function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer glass">
      <p className="footer-tagline">{t("footerTagline", "Juegos gratis en el navegador")}</p>
      <nav className="footer-links">
        <a href="#/about">{t("footerAbout", "Acerca de")}</a>
        <a href="#/privacidad">{t("footerPrivacy", "Privacidad")}</a>
        <a href="#/terms">{t("footerTerms", "Términos")}</a>
        <a href="#/contacto">{t("footerContact", "Contacto")}</a>
        <a href="#/comentarios">{t("footerComments", "Comentarios")}</a>
      </nav>
      <p className="footer-copy">© {year} Budsin Games</p>
    </footer>
  );
}
