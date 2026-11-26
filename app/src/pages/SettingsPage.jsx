import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import Topbar from "../components/Topbar";
import Footer from "../components/Footer";
import PaypalSubscribe from "../components/PaypalSubscribe";
import { cancelPaypalSubscription, DONATE_URL } from "../lib/paypal";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../context/AuthContext";
import { usePro } from "../context/ProContext";
import { useTheme, THEMES } from "../context/ThemeContext";
import { useLibrary } from "../context/LibraryContext";
import { useToast } from "../context/ToastContext";
import { readJson } from "../lib/storage";
import { soundsEnabled, setSoundsEnabled } from "../lib/sfx";

const DATE_LOCALES = { es: "es-ES", en: "en-US", pt: "pt-BR" };
const DONATE_AMOUNTS = [1, 3, 5];
const CUSTOM_KEY = "budsin_custom_theme";
const URL_LIST_KEY = "budsin_url_list";
const CLASSROOM_URL_KEY = "budsin_classroom_url";
const HOTKEY_KEY = "budsin_hotkey";
const QUICK_TOGGLE_KEY = "budsin_quick_toggle_visible";
const AUTO_DISGUISE_KEY = "budsin_auto_disguise_ms";   // antigua: aquí se guardaban SEGUNDOS por error
const AUTO_SECONDS_KEY = "budsin_auto_disguise_s";
const COVER_KEY = "budsin_cover";

// Textos del modo oculto (es/en/pt) y lista de disfraces. Las claves coinciden con PRESETS de public/classroom-hotkey.js.
const COVER_PRESETS = ["docs", "classroom", "drive", "slides", "desmos", "khan", "geogebra", "custom"];
const COVER_TEXT = {
  es: {
    title: "Modo oculto", sub: "Tapa el juego con un disfraz al instante.",
    preset: "Disfraz", presets: { docs: "Documentos de Google", classroom: "Google Classroom", drive: "Google Drive", slides: "Presentaciones de Google", desmos: "Desmos", khan: "Khan Academy", geogebra: "GeoGebra", custom: "Mi propia URL" },
    presetNote: "Classroom y Drive no se pueden incrustar: usan su título e ícono, pero muestran un documento. «Mi propia URL» usa la lista de abajo.",
    hotkey: "Tecla para ocultar", change: "Cambiar", press: "Pulsa una tecla… (Esc cancela)", reset: "Restablecer", def: "` o la tecla < >",
    panic: "Tecla de pánico", panicUrl: "URL de pánico", panicNone: "Sin asignar", panicNote: "Te saca de inmediato a esa página (sin dejar el juego en el historial). Usa una combinación rara, por ejemplo Ctrl+Shift+X.",
    combo: "Ctrl+Shift+< o >", comboSub: "Ocultar también con este atajo.",
    corner: "Doble clic en la esquina superior derecha", cornerSub: "Un cuadro invisible de 56×56 px: dos toques seguidos ocultan (sirve en Chromebook táctil).",
    tab: "Ocultar al cambiar de pestaña", tabSub: "Si cambias de pestaña, al volver ya estará tapado.",
    auto: "Auto-ocultar tras inactividad (segundos, 0 = apagado)", test: "Probar ahora", urlHint: "Solo se usa con «Mi propia URL».",
  },
  en: {
    title: "Cover mode", sub: "Cover the game with a disguise instantly.",
    preset: "Disguise", presets: { docs: "Google Docs", classroom: "Google Classroom", drive: "Google Drive", slides: "Google Slides", desmos: "Desmos", khan: "Khan Academy", geogebra: "GeoGebra", custom: "My own URL" },
    presetNote: "Classroom and Drive can't be embedded: they use their title and icon but show a document. “My own URL” uses the list below.",
    hotkey: "Hide key", change: "Change", press: "Press a key… (Esc cancels)", reset: "Reset", def: "` or the < > key",
    panic: "Panic key", panicUrl: "Panic URL", panicNone: "Not set", panicNote: "Takes you to that page immediately (without leaving the game in your history). Use an unusual combo, e.g. Ctrl+Shift+X.",
    combo: "Ctrl+Shift+< or >", comboSub: "Also hide with this shortcut.",
    corner: "Double-click the top-right corner", cornerSub: "An invisible 56×56 px square: two quick taps hide (works on touch Chromebooks).",
    tab: "Hide when switching tabs", tabSub: "If you switch tabs, it will already be covered when you come back.",
    auto: "Auto-hide after inactivity (seconds, 0 = off)", test: "Try it now", urlHint: "Only used with “My own URL”.",
  },
  pt: {
    title: "Modo oculto", sub: "Cubra o jogo com um disfarce na hora.",
    preset: "Disfarce", presets: { docs: "Documentos Google", classroom: "Google Sala de Aula", drive: "Google Drive", slides: "Apresenta\u00e7\u00f5es Google", desmos: "Desmos", khan: "Khan Academy", geogebra: "GeoGebra", custom: "Minha pr\u00f3pria URL" },
    presetNote: "Classroom e Drive n\u00e3o podem ser incorporados: usam o t\u00edtulo e o \u00edcone, mas mostram um documento. \u00abMinha pr\u00f3pria URL\u00bb usa a lista abaixo.",
    hotkey: "Tecla para ocultar", change: "Alterar", press: "Pressione uma tecla\u2026 (Esc cancela)", reset: "Restaurar", def: "` ou a tecla < >",
    panic: "Tecla de p\u00e2nico", panicUrl: "URL de p\u00e2nico", panicNone: "N\u00e3o definida", panicNote: "Leva voc\u00ea imediatamente a essa p\u00e1gina (sem deixar o jogo no hist\u00f3rico). Use uma combina\u00e7\u00e3o rara, por exemplo Ctrl+Shift+X.",
    combo: "Ctrl+Shift+< ou >", comboSub: "Tamb\u00e9m ocultar com este atalho.",
    corner: "Duplo clique no canto superior direito", cornerSub: "Um quadrado invis\u00edvel de 56\u00d756 px: dois toques seguidos ocultam (funciona em Chromebook com toque).",
    tab: "Ocultar ao trocar de aba", tabSub: "Se voc\u00ea trocar de aba, ao voltar j\u00e1 estar\u00e1 coberto.",
    auto: "Auto-ocultar ap\u00f3s inatividade (segundos, 0 = desligado)", test: "Testar agora", urlHint: "S\u00f3 \u00e9 usada com \u00abMinha pr\u00f3pria URL\u00bb.",
  },
};
const keyLabel = (spec) => String(spec || "").replace(/Key([A-Z])/g, "$1").replace(/Digit(\d)/g, "$1").replace("Backquote", "`").replace("IntlBackslash", "< >").replace("Backslash", "\\");

/** Botón que captura la siguiente tecla (con Ctrl/Alt/Shift/Meta) y devuelve algo como «Ctrl+Shift+KeyX». */
function KeyCapture({ value, onCapture, onReset, idle, press, change, reset }) {
  const [listening, setListening] = useState(false);
  useEffect(() => {
    if (!listening) return undefined;
    window.__budsinCapturingKey = true;     // classroom-hotkey.js ignora las teclas mientras tanto
    const handler = (e) => {
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") { setListening(false); return; }
      const mods = [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Meta"].filter(Boolean);
      onCapture(mods.concat(e.code).join("+"));
      setListening(false);
    };
    window.addEventListener("keydown", handler, true);
    return () => { window.removeEventListener("keydown", handler, true); window.__budsinCapturingKey = false; };
  }, [listening]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <code style={{ display: "inline-flex", alignItems: "center", minWidth: 120, height: 40, padding: "0 14px", margin: 0, borderRadius: 12, border: "1px solid rgba(120,130,150,.35)", fontFamily: "inherit", fontWeight: 700, fontSize: 14 }}>{listening ? press : (value ? keyLabel(value) : idle)}</code>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setListening((v) => !v)}>{change}</button>
      {value ? <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>{reset}</button> : null}
    </div>
  );
}

export default function SettingsPage() {
  const { t, lang } = useI18n();
  const cv = COVER_TEXT[lang] || COVER_TEXT.es;
  const { user, loading, login, logout } = useAuth();
  const { isPro, paidUntil, trialUsed, paypalActive, paypalState, refreshPro, startTrial } = usePro();
  const { theme, applyTheme, custom, updateCustom } = useTheme();
  const { favorites, recently } = useLibrary();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [cancelling, setCancelling] = useState(false);

  const handleCancelPaypal = async () => {
    if (!window.confirm(t("paypalCancelConfirm", "¿Cancelar tu suscripción? Dejará de cobrarse y tu Pro seguirá activo hasta el fin del periodo ya pagado."))) return;
    setCancelling(true);
    try {
      await cancelPaypalSubscription();
      await refreshPro();
      showToast(t("paypalCancelled", "Suscripción cancelada. Tu Pro sigue activo hasta el fin del periodo pagado."));
    } catch (err) {
      showToast(t("paypalCancelError", "No se pudo cancelar. Inténtalo de nuevo o cancélala desde PayPal → Pagos automáticos."), true);
    }
    setCancelling(false);
  };

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
  const [sounds, setSounds] = useState(soundsEnabled);
  const [autoDisguise, setAutoDisguise] = useState(() => {
    const s = parseInt(localStorage.getItem(AUTO_SECONDS_KEY), 10);
    if (!Number.isNaN(s)) return Math.max(0, s);
    const old = parseInt(localStorage.getItem(AUTO_DISGUISE_KEY), 10);     // clave antigua: <1000 eran segundos
    return Number.isNaN(old) || old <= 0 ? 0 : (old < 1000 ? old : Math.round(old / 1000));
  });
  const readCover = () => readJson(COVER_KEY, {}) || {};
  const [cover, setCoverState] = useState(readCover);
  const setCover = (patch) => {
    setCoverState((prev) => ({ ...prev, ...patch }));
    const api = window.BudsinClassroomHotkey;
    if (api && api.setConfig) api.setConfig(patch);      // guarda y aplica al instante
    else save(COVER_KEY, JSON.stringify({ ...readCover(), ...patch }));
  };
  const [hideKey, setHideKey] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem(HOTKEY_KEY) || "null"); return Array.isArray(v) ? v[0] || "" : (typeof v === "string" ? v : ""); } catch (e) { return localStorage.getItem(HOTKEY_KEY) || ""; }
  });
  const coverPreset = cover.preset || (classroomUrl || urlList.length ? "custom" : "docs");

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

              {!isPro && <PaypalSubscribe />}
              {isPro && paypalActive && (
                <div className="pro-trial-used">
                  <p>{t("paypalManage", "Suscripción mensual con PayPal activa.")}</p>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={cancelling} onClick={handleCancelPaypal}>
                    {cancelling ? t("paypalCancelling", "Cancelando…") : t("paypalCancelBtn", "Cancelar suscripción")}
                  </button>
                </div>
              )}
              {isPro && !paypalActive && paypalState === "CANCELLED" && paidUntil && (
                <div className="pro-trial-used">{t("paypalCancelledNote", "Suscripción cancelada: no se renovará.")}</div>
              )}

              {isPro && paidUntil && (
                <div className={`pro-renewal ${renewalDays !== null && renewalDays <= 1 ? "warning" : ""}`}>
                  <span>{paypalState === "CANCELLED" ? t("proUntilLabel", "⏳ Pro hasta:") : t("proRenewalLabel", "🔄 Renovación:")}</span>
                  <strong>{paidUntil.toLocaleDateString(DATE_LOCALES[lang] || undefined)} ({renewalDays} {t("proRenewalDays", "días")})</strong>
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

          <div className="toggle-row">
            <div>
              <div className="toggle-label">{t("toggleSoundsLabel", "Sonidos del menú")}</div>
              <div className="toggle-sub">{t("toggleSoundsSub", "Efecto al entrar a un juego o sección.")}</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={sounds} onChange={(e) => { setSounds(e.target.checked); setSoundsEnabled(e.target.checked); }} />
              <span className="toggle-track"></span>
            </label>
          </div>

          <label className="field-label" style={{ marginTop: 14 }}>{cv.auto}</label>
          <input
            type="number"
            className="field-input"
            min="0"
            value={autoDisguise}
            onChange={(e) => {
              const n = Math.max(0, Number(e.target.value) || 0);
              setAutoDisguise(n);
              save(AUTO_SECONDS_KEY, String(n));
              try { localStorage.removeItem(AUTO_DISGUISE_KEY); } catch (err) {}
              if (window.BudsinClassroomHotkey && window.BudsinClassroomHotkey.setConfig) window.BudsinClassroomHotkey.setConfig({});   // reinicia el temporizador
            }}
          />
        </section>

        {/* ── Modo oculto: disfraz, teclas y gestos ── */}
        <section className="settings-card glass" id="coverCard">
          <div className="card-header">
            <div className="card-icon purple">🕶️</div>
            <div>
              <h2>{cv.title}</h2>
              <p>{cv.sub}</p>
            </div>
          </div>

          <label className="field-label">{cv.preset}</label>
          <select className="field-input" value={coverPreset} onChange={(e) => setCover({ preset: e.target.value })}>
            {COVER_PRESETS.map((id) => <option key={id} value={id}>{cv.presets[id]}</option>)}
          </select>
          <p className="toggle-sub" style={{ marginTop: 6 }}>{cv.presetNote}{coverPreset === "custom" ? " " + cv.urlHint : ""}</p>

          <label className="field-label" style={{ marginTop: 14 }}>{cv.hotkey}</label>
          <KeyCapture
            value={hideKey} idle={cv.def} press={cv.press} change={cv.change} reset={cv.reset}
            onCapture={(spec) => { setHideKey(spec); save(HOTKEY_KEY, JSON.stringify([spec])); }}
            onReset={() => { setHideKey(""); try { localStorage.removeItem(HOTKEY_KEY); } catch (e) {} }}
          />

          <div className="toggle-row">
            <div>
              <div className="toggle-label">{cv.combo}</div>
              <div className="toggle-sub">{cv.comboSub}</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={cover.comboGesture !== false} onChange={(e) => setCover({ comboGesture: e.target.checked })} />
              <span className="toggle-track"></span>
            </label>
          </div>

          <div className="toggle-row">
            <div>
              <div className="toggle-label">{cv.corner}</div>
              <div className="toggle-sub">{cv.cornerSub}</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={!!cover.cornerGesture} onChange={(e) => setCover({ cornerGesture: e.target.checked })} />
              <span className="toggle-track"></span>
            </label>
          </div>

          <div className="toggle-row">
            <div>
              <div className="toggle-label">{cv.tab}</div>
              <div className="toggle-sub">{cv.tabSub}</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={!!cover.hideOnTabSwitch} onChange={(e) => setCover({ hideOnTabSwitch: e.target.checked })} />
              <span className="toggle-track"></span>
            </label>
          </div>

          <label className="field-label" style={{ marginTop: 14 }}>{cv.panic}</label>
          <KeyCapture
            value={(cover.panicKeys || [])[0] || ""} idle={cv.panicNone} press={cv.press} change={cv.change} reset={cv.reset}
            onCapture={(spec) => setCover({ panicKeys: [spec] })}
            onReset={() => setCover({ panicKeys: [] })}
          />
          <label className="field-label" style={{ marginTop: 10 }}>{cv.panicUrl}</label>
          <input
            type="url"
            className="field-input"
            value={cover.panicUrl || ""}
            placeholder="https://classroom.google.com/"
            onChange={(e) => setCover({ panicUrl: e.target.value })}
          />
          <p className="toggle-sub" style={{ marginTop: 6 }}>{cv.panicNote}</p>

          <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={() => window.BudsinClassroomHotkey && window.BudsinClassroomHotkey.toggle()}>
            {cv.test}
          </button>
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

        <section className="settings-card glass">
          <div className="card-header">
            <div className="card-icon gold">💛</div>
            <div>
              <h2>{t("donateTitle", "Apoya el proyecto")}</h2>
              <p>{t("donateSub", "Budsin Games es gratis. Si te gusta, puedes invitarme un café con PayPal.")}</p>
            </div>
          </div>
          <div className="donate-row">
            {DONATE_AMOUNTS.map((n) => (
              <a key={n} className="btn btn-ghost" href={`${DONATE_URL}/${n}USD`} target="_blank" rel="noopener noreferrer">${n}</a>
            ))}
            <a className="btn btn-primary" href={DONATE_URL} target="_blank" rel="noopener noreferrer">{t("donateOther", "Otro monto")}</a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
