import { useI18n } from "../../context/I18nContext";
import { usePro } from "../../context/ProContext";

export default function HeroSection() {
  const { t } = useI18n();
  const { isPro } = usePro();

  return (
    <section className="hero">
      <h1 className="hero-title">{t("heroTitle", "Budsin Games")}</h1>
      <p className="hero-subtitle">{t("heroSubtitle", "Una portada pensada como menu de consola: entra al portal, elige una caratula y salta directo a jugar desde el navegador.")}</p>
      <div className="hero-badges">
        <span>🎮 {t("badgeGames", "40 juegos listos")}</span>
        <span>⚡ {t("badgeQuick", "Entrada rapida")}</span>
        <span>🧩 {t("badgeLibrary", "Biblioteca estilo Switch")}</span>
      </div>
      {isPro && <div className="pro-hero-message">{t("proHeroMessage", "¡Eres Pro! Muchas gracias por apoyarme 🫶")}</div>}
    </section>
  );
}
