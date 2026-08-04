import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import Topbar from "../components/Topbar";
import Footer from "../components/Footer";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../context/AuthContext";
import { usePro } from "../context/ProContext";
import { useTheme, THEMES } from "../context/ThemeContext";
import { useLibrary } from "../context/LibraryContext";
import { useToast } from "../context/ToastContext";

const CUSTOM_KEY = "budsin_custom_theme";
const URL_LIST_KEY = "budsin_url_list";
const CLASSROOM_URL_KEY = "budsin_classroom_url";
const HOTKEY_KEY = "budsin_hotkey";
const QUICK_TOGGLE_KEY = "budsin_quick_toggle_visible";
const AUTO_DISGUISE_KEY = "budsin_auto_disguise_ms";

function readJson(key, fb) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fb));
  } catch (e) {
    return fb;
  }
}

export default function SettingsPage() {
  const { t, lang } = useI18n();
  const { user, loading, login, logout } = useAuth();
  const { isPro, paidUntil, trialUsed, startTrial } = usePro();
  const { theme, applyTheme, custom, updateCustom } = useTheme();
  const { favorites, recently } = useLibrary();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("proCard")) {
      const el = document.getElementById("proCard");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, [searchParams]);

  const [classroomUrl, setClassroomUrl] = useState(() => localStorage.getItem(CLASSROOM_URL_KEY) || "");
  const [urlList, setUrlList] = useState(() => readJson(URL_LIST_KEY, []));
  const [hotkey, setHotkey] = useState(() => localStorage.getItem(HOTKEY_KEY) || "Backquote");
  const [quickToggle, setQuickToggle] = useState(() => localStorage.getItem(QUICK_TOGGLE_KEY) === "1");
  const [autoDisguise, setAutoDisguise] = useState(() => Number(localStorage.getItem(AUTO_DISGUISE_KEY) || 0));

  const save = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  };

  const onUrlListChange = (list) => {
    setUrlList(list);
    save(URL_LIST_KEY, JSON.stringify(list));
  };

  const renewalDays = useMemo(() => {
    if (!paidUntil) return null;
    const diff = Math.ceil((paidUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return diff;
  }, [paidUntil]);

  const handleExport = () => {
    const data = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      favorites,
      recently,
      theme,
      language: lang,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "budsin-games-data.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("📥 " + t("exportDone", "Datos exportados"), false);
  };

  const handleTrial = async () => {
    try {
      await startTrial();
      showToast("🎁 " + t("trialCtaTitle", "Prueba Budsin Pro gratis 7 días"), false);
    } catch (e) {
      showToast(t("loginRequired", "Inicia sesión primero"), true);
    }
  };

  return (
    <div className="site-shell">
      <Topbar />
      <main className="page-main page-main-narrow">
        <header className="page-header">
          <h1>{t("settingsTitle", "Ajustes")}</h1>
          <p>{t("settingsSubtitle", "Cuenta, tema, modo oculto y más.")}</p>
        </header>

        {/* ── Cuenta ── */}
        <section className="settings-card glass">
          <div className="card-header">
            <div className="card-icon blue">👤</div>
            <div>
              <h2>{t("accountCardTitle", "Cuenta")}</h2>
              <p>{t("accountCardSub", "Inicia sesión para guardar tu progreso Pro.")}</p>
            </div>
          </div>
          {loading ? (
            <p style={{ color: "var(--muted)" }}>...</p>
          ) : user ? (
            <div className="account-logged-in">
              <span className="account-avatar">{(user.email || "?").charAt(0).toUpperCase()}</span>
              <div className="account-info">
                <strong>{user.email}</strong>
                <span>{isPro ? "⭐ PRO" : t("freeUser", "Usuario Free")}</span>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
                {t("proLogout", "Cerrar sesión")}
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-primary" onClick={login}>
              {t("proGoogle", "Iniciar sesión con Google")}
            </button>
          )}
        </section>

        {/* ── Pro ── */}
        <section className="settings-card pro-card" id="proCard">
          <div className="card-header">
            <div className="card-icon gold">⭐</div>
            <div>
              <h2>{t("proCardTitle", "Budsin Pro")}</h2>
              <p>{t("cardProSub", "Inicia sesión con Google para verificar tu suscripción Pro.")}</p>
            </div>
          </div>

          {!user ? (
            <div className="pro-logged-out">
              <div className="pro-price">
                <strong style={{ color: "#ffd700" }}>$2.99 USD</strong>
                <span className="pro-price-sep">/</span>
                <strong style={{ color: "#ffd700" }}>S/ 7 PEN</strong>
                <span> {t("proPriceMonth", "por mes")}</span>
                <br />
                <span style={{ fontSize: ".78rem", color: "var(--muted)" }}>{t("proPriceSub", "Cuota mensual — acceso a funcionalidades Pro.")}</span>
              </div>
              <button type="button" className="btn pro-google-btn" onClick={login}>
                <svg style={{ width: 22, height: 22 }} viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.54 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.84.93 7.45 2.56 10.78l7.98-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <span>{t("proGoogle", "Iniciar sesión con Google")}</span>
              </button>
              <p className="pro-login-hint">{t("proLoginHint", "Al iniciar sesión se verificará tu suscripción. Para ser Pro, escribe a budsinjys@gmail.com.")}</p>
            </div>
          ) : (
            <div className="pro-logged-in">
              <div className="pro-user-row">
                <span className="pro-user-avatar">👤</span>
                <div className="account-info">
                  <strong>{user.email}</strong>
                  <span className={`pro-badge ${isPro ? "active" : ""}`}>{isPro ? "⭐ PRO" : "Free"}</span>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>{t("proLogout", "Cerrar sesión")}</button>
              </div>

              <div className="pro-stats">
                <div className="pro-stat">
                  <div className="pro-stat-value gold">{recently.length}</div>
                  <div className="pro-stat-label">{t("proStatsGames", "Juegos jugados")}</div>
                </div>
                <div className="pro-stat">
                  <div className="pro-stat-value gold">{favorites.length}</div>
                  <div className="pro-stat-label">{t("proStatsFavs", "Favoritos")}</div>
                </div>
                <div className="pro-stat">
                  <div className="pro-stat-value blue">{isPro ? "∞" : "—"}</div>
                  <div className="pro-stat-label">{t("proStatsSaves", "Guardados")}</div>
                </div>
              </div>

              {!isPro && !trialUsed && (
                <div className="pro-trial-cta">
                  <div className="pro-trial-title">{t("proTrialTitle", "🎁 Prueba gratis 7 días")}</div>
                  <p>{t("proTrialDesc", "Accede a todas las funciones Pro sin costo durante 7 días. Solo una vez.")}</p>
                  <button type="button" className="btn pro-trial-btn" onClick={handleTrial}>
                    {t("proTrialBtn", "🎁 Activar prueba gratis")}
                  </button>
                </div>
              )}
              {!isPro && trialUsed && (
                <div className="pro-trial-used">{t("proTrialUsed", "Ya usaste tu prueba gratis. Para ser Pro, contacta a budsinjys@gmail.com.")}</div>
              )}

              {isPro && paidUntil && (
                <div className={`pro-renewal ${renewalDays !== null && renewalDays <= 1 ? "warning" : ""}`}>
                  <span>{t("proRenewalLabel", "🔄 Renovación:")}</span>
                  <strong>{paidUntil.toLocaleDateString()} ({renewalDays} {t("proRenewalDays", "días")})</strong>
                  {renewalDays !== null && renewalDays <= 1 && <span style={{ color: "var(--red)" }}> ⚠️</span>}
                </div>
              )}

              <div className="pro-benefits">
                <div className="pro-benefits-title">{t("proBenefitsTitle", "Beneficios Pro")}</div>
                <ul>
                  <li>✓ {t("proBenefitNoAds", "Sin anuncios")} {t("proBenefitNoAdsSuffix", "en el portal")}</li>
                  <li>✓ {t("proBenefitTheme", "Tema Pro (Gold) exclusivo")}</li>
                  <li>✓ {t("proBenefitFavs", "Favoritos ilimitados")} {t("proBenefitFavsSuffix", "(sin límite de 20)")}</li>
                  <li>✓ {t("proBenefitEarly", "Acceso anticipado")} {t("proBenefitEarlySuffix", "a juegos nuevos")}</li>
                  <li>✓ {t("proBenefitStats", "Estadísticas")} {t("proBenefitStatsSuffix", "de tu actividad")}</li>
                  <li>✓ {t("proBenefitPriority", "Prioridad en nuevas features")}</li>
                </ul>
              </div>
            </div>
          )}
          <div className="pro-contact">
            {t("proContact", "¿Consultas? —")} <a href="mailto:budsinjys@gmail.com">budsinjys@gmail.com</a>
          </div>
        </section>

        {/* ── Tema ── */}
        <section className="settings-card glass">
          <div className="card-header">
            <div className="card-icon">🎨</div>
            <div>
              <h2>{t("cardThemeTitle", "Tema visual")}</h2>
              <p>{t("cardThemeSub", "Personaliza la apariencia del portal.")}</p>
            </div>
          </div>
          <label className="field-label" htmlFor="themeSelect">{t("themeLabel", "Tema")}</label>
          <select id="themeSelect" className="field-select" value={theme} onChange={(e) => applyTheme(e.target.value)}>
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
            <option value="ps5">PlayStation 5</option>
            <option value="steam">Steam</option>
            {isPro && <option value="pro">⭐ Pro (Gold)</option>}
            {isPro && <option value="custom">🎨 Custom</option>}
          </select>
          {theme === "custom" && (
            <div className="custom-theme-picker">
              {[
                ["primary", "Primary"],
                ["secondary", "Secondary"],
                ["accent", "Accent"],
                ["bg", "Background"],
              ].map(([key, label]) => (
                <label key={key} className="custom-color-field">
                  <span>{label}</span>
                  <input
                    type="color"
                    value={custom[key] || "#6366f1"}
                    onChange={(e) => updateCustom({ [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
          )}
        </section>

        {/* ── Modo oculto (classroom) ── */}
        <section className="settings-card glass">
          <div className="card-header">
            <div className="card-icon green">⚙️</div>
            <div>
              <h2>{t("cardBehaviorTitle", "Comportamiento")}</h2>
              <p>{t("cardBehaviorSub", "Opciones del modo oculto.")}</p>
            </div>
          </div>

          <label className="field-label">{t("classroomUrlLabel", "URL de disfraz")}</label>
          <input
            type="url"
            className="field-input"
            value={classroomUrl}
            placeholder="https://..."
            onChange={(e) => {
              setClassroomUrl(e.target.value);
              save(CLASSROOM_URL_KEY, e.target.value);
            }}
          />
          {urlList.length > 0 && (
            <div className="url-list">
              {urlList.map((u) => (
                <div className="url-list-item" key={u.id}>
                  <span>{u.name}</span>
                  <button type="button" onClick={() => onUrlListChange(urlList.filter((x) => x.id !== u.id))}>🗑️</button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => {
              const name = window.prompt(t("urlNamePrompt", "Nombre"));
              const url = window.prompt(t("urlPrompt", "URL"));
              if (name && url) onUrlListChange([...urlList, { id: Date.now(), name, url, active: true }]);
            }}
          >
            ＋ {t("addUrl", "Añadir URL")}
          </button>

          <div className="toggle-row">
            <div>
              <div className="toggle-label">{t("toggleQuickLabel", "Botón flotante \"Ocultar\"")}</div>
              <div className="toggle-sub">{t("toggleQuickSub", "Muestra el botón en esquina inferior izquierda.")}</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={quickToggle} onChange={(e) => { setQuickToggle(e.target.checked); save(QUICK_TOGGLE_KEY, e.target.checked ? "1" : "0"); }} />
              <span className="toggle-track"></span>
            </label>
          </div>

          <label className="field-label" style={{ marginTop: 14 }}>{t("autoDisguiseLabel", "Auto-disfraz (segundos, 0 = off)")}</label>
          <input
            type="number"
            className="field-input"
            min="0"
            value={autoDisguise}
            onChange={(e) => { setAutoDisguise(Number(e.target.value) || 0); save(AUTO_DISGUISE_KEY, String(Number(e.target.value) || 0)); }}
          />
        </section>

        {/* ── Exportar datos ── */}
        {isPro && (
          <section className="settings-card glass">
            <div className="card-header">
              <div className="card-icon blue">📥</div>
              <div>
                <h2>{t("exportCardTitle", "Exportar datos")}</h2>
                <p>{t("exportCardSub", "Descarga tus favoritos y preferencias en JSON.")}</p>
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleExport}>
              {t("exportData", "Exportar JSON")}
            </button>
          </section>
        )}

        <section className="settings-card glass">
          <div className="card-header">
            <div className="card-icon">💡</div>
            <div>
              <h2>{t("requestsCardTitle", "Solicitar juegos")}</h2>
              <p>{t("requestsCardSub", "Sugiere el próximo juego del portal.")}</p>
            </div>
          </div>
          <a className="btn btn-ghost" href="https://forms.gle/bUHTy8Lt6Kz1qkAx8" target="_blank" rel="noreferrer">
            {t("suggestionsLink", "Envia tus sugerencias a Budsin")}
          </a>
        </section>
      </main>
      <Footer />
    </div>
  );
}
