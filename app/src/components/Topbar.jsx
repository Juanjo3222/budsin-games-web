import { useNavigate } from "react-router-dom";
import { useI18n } from "../context/I18nContext";
import { useTheme } from "../context/ThemeContext";
import { usePro } from "../context/ProContext";

export default function Topbar() {
  const { lang, setLang, t } = useI18n();
  const { theme, cycle } = useTheme();
  const { isPro } = usePro();
  const navigate = useNavigate();

  return (
    <header className="topbar glass">
      <a className="topbar-brand" href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
        <span className="topbar-logo">🎮</span>
        <span className="topbar-title">
          Budsin <strong>Games</strong>
        </span>
      </a>
      <nav className="topbar-actions">
        <select
          className="lang-select"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          aria-label={t("langLabel", "Idioma")}
        >
          <option value="es">🇪🇸 ES</option>
          <option value="en">🇬🇧 EN</option>
          <option value="pt">🇧🇷 PT</option>
        </select>
        <button
          type="button"
          className="theme-toggle"
          onClick={cycle}
          title={t("themeToggle", "Cambiar tema")}
        >
          {theme === "light" ? "🌙" : theme === "pro" ? "⭐" : theme === "custom" ? "🎨" : "☀️"}
        </button>
        <a
          className="settings-link"
          href="#/settings"
          onClick={(e) => { e.preventDefault(); navigate("/settings"); }}
        >
          ⚙️ <span className="settings-text">{t("settingsPageLink", "⚙️ Ajustes")}</span>
        </a>
        {isPro && <span className="pro-chip" title="Budsin Pro">⭐ PRO</span>}
      </nav>
    </header>
  );
}
