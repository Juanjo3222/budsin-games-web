/*!
 * Budsin · modo oculto (classroom-hotkey.js) — v2
 *
 * Tapa el juego con un «disfraz» (título + ícono + una página que sí se deja incrustar) con una tecla, un gesto o un botón.
 *
 * Qué hace
 *   · Varios disfraces (Documentos, Classroom, Drive, Presentaciones, Desmos, Khan Academy, GeoGebra o tus propias URL).
 *   · Tecla de ocultar (por defecto ` / <>), Ctrl+Shift+< o Ctrl+Shift+> y doble clic/toque en la esquina superior derecha.
 *   · Tecla de pánico: te saca de inmediato a otra URL.
 *   · Ocultar al cambiar de pestaña y auto-ocultar tras N segundos sin actividad.
 *   · Carga el mini-reproductor de Budsin Music y el botón de chat dentro de los juegos.
 *
 * Compatibilidad (no cambiar sin revisar site.js, SettingsPage.jsx, musica/index.html y ConsoleHome.jsx):
 *   · Llaves de localStorage: budsin_hotkey, budsin_url_list, budsin_classroom_url, budsin_quick_toggle_visible,
 *     budsin_auto_disguise_ms (antigua: la página de Ajustes la guardaba en SEGUNDOS) y budsin_language.
 *   · Nuevas: budsin_cover (JSON con el resto de opciones) y budsin_auto_disguise_s (segundos).
 *   · Ids/clases: #juanjo-classroom-overlay, #juanjo-classroom-quick-toggle, body.juanjo-classroom-open.
 *   · API: window.BudsinClassroomHotkey y el evento «juanjo:toggle-classroom».
 */
(function () {
  "use strict";
  if (window.__budsinCoverLoaded) return;      // la página puede incluir el script dos veces
  window.__budsinCoverLoaded = true;

  // ───────────────────────────── llaves y constantes ─────────────────────────────
  var KEYS = {
    LANGUAGE:      "budsin_language",
    CLASSROOM_URL: "budsin_classroom_url",
    URL_LIST:      "budsin_url_list",
    HOTKEY:        "budsin_hotkey",
    QUICK_TOGGLE:  "budsin_quick_toggle_visible",
    AUTO_DISGUISE: "budsin_auto_disguise_ms",
    AUTO_SECONDS:  "budsin_auto_disguise_s",
    COVER:         "budsin_cover",
  };
  var IDS = {
    OVERLAY: "juanjo-classroom-overlay", FRAME: "juanjo-classroom-frame", CLOSE: "juanjo-classroom-close",
    QUICK: "juanjo-classroom-quick-toggle", CORNER: "juanjo-classroom-corner", FOCUS_TRAP: "juanjo-classroom-focus-trap",
    THEME_BTN: "budsin-theme-toggle", FULLSCREEN_BTN: "budsin-fullscreen-toggle",
  };
  var DEFAULT_DOC = "https://docs.google.com/document/d/1gwlAb1OGRGyBkAvdOzILU-i9UquM4nauJ6X3uSnyUXE/preview";
  var DEFAULT_CODES = ["Backquote", "IntlBackslash"];
  var DEFAULT_KEYS = ["|", "°", "º"];
  var DEFAULT_PANIC_URL = "https://classroom.google.com/";

  // Disfraces. Classroom y Drive no se pueden incrustar (X-Frame-Options), así que muestran su título/ícono pero el contenido
  // es una página que sí se deja incrustar.
  var PRESETS = {
    docs:      { label: { es: "Documentos de Google", en: "Google Docs", pt: "Documentos Google" },
                 title: { es: "Documento sin título - Documentos de Google", en: "Untitled document - Google Docs", pt: "Documento sem título - Documentos Google" },
                 icon: "docs.google.com", url: DEFAULT_DOC },
    classroom: { label: { es: "Google Classroom", en: "Google Classroom", pt: "Google Sala de Aula" },
                 title: { es: "Clases", en: "Classes", pt: "Turmas" }, icon: "classroom.google.com", url: DEFAULT_DOC },
    drive:     { label: { es: "Google Drive", en: "Google Drive", pt: "Google Drive" },
                 title: { es: "Mi unidad - Google Drive", en: "My Drive - Google Drive", pt: "Meu Drive - Google Drive" }, icon: "drive.google.com", url: DEFAULT_DOC },
    slides:    { label: { es: "Presentaciones de Google", en: "Google Slides", pt: "Apresentações Google" },
                 title: { es: "Presentación sin título - Presentaciones de Google", en: "Untitled presentation - Google Slides", pt: "Apresentação sem título - Apresentações Google" },
                 icon: "docs.google.com", url: DEFAULT_DOC },
    desmos:    { label: { es: "Desmos", en: "Desmos", pt: "Desmos" },
                 title: { es: "Desmos | Calculadora gráfica", en: "Desmos | Graphing Calculator", pt: "Desmos | Calculadora gráfica" },
                 icon: "desmos.com", url: "https://www.desmos.com/calculator" },
    khan:      { label: { es: "Khan Academy", en: "Khan Academy", pt: "Khan Academy" },
                 title: { es: "Khan Academy", en: "Khan Academy", pt: "Khan Academy" }, icon: "khanacademy.org", url: "https://www.khanacademy.org/" },
    geogebra:  { label: { es: "GeoGebra", en: "GeoGebra", pt: "GeoGebra" },
                 title: { es: "Calculadora gráfica - GeoGebra", en: "Graphing Calculator - GeoGebra", pt: "Calculadora gráfica - GeoGebra" },
                 icon: "geogebra.org", url: "https://www.geogebra.org/graphing" },
    custom:    { label: { es: "Mi propia URL", en: "My own URL", pt: "Minha própria URL" }, title: null, icon: null, url: null },
  };

  // ───────────────────────────── almacenamiento ─────────────────────────────
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (_) {} }
  function parseJson(s) { try { return JSON.parse(s); } catch (_) { return null; } }

  function lang() {
    try {
      var p = new URL(window.location.href).searchParams.get("lang");
      if (p) { var r = p === "en" || p === "pt" ? p : "es"; lsSet(KEYS.LANGUAGE, r); return r; }
    } catch (_) {}
    var l = (lsGet(KEYS.LANGUAGE) || "").slice(0, 2);
    return l === "en" || l === "pt" ? l : "es";
  }
  var TEXT = {
    es: { close: "Cerrar modo oculto", hide: "Ocultar", hideAria: "Activar modo ocultar" },
    en: { close: "Close cover mode", hide: "Hide", hideAria: "Toggle hidden mode" },
    pt: { close: "Fechar modo oculto", hide: "Ocultar", hideAria: "Ativar modo oculto" },
  };
  function tx() { return TEXT[lang()]; }

  /** URL activa de la lista del usuario → clave antigua → null. */
  function customUrl() {
    var list = parseJson(lsGet(KEYS.URL_LIST));
    if (Array.isArray(list) && list.length) {
      var a = list.filter(function (e) { return e && e.active; })[0] || list[0];
      if (a && a.url) return a.url;
    }
    return lsGet(KEYS.CLASSROOM_URL) || "";
  }

  /** Configuración completa con valores por defecto. */
  function config() {
    var c = parseJson(lsGet(KEYS.COVER)) || {};
    var preset = PRESETS[c.preset] ? c.preset : (customUrl() ? "custom" : "docs");   // quien ya tenía URL propia la conserva
    if (preset === "custom" && !customUrl()) preset = "docs";
    return {
      preset: preset,
      panicKeys: Array.isArray(c.panicKeys) ? c.panicKeys : [],
      panicUrl: /^https?:\/\//i.test(c.panicUrl || "") ? c.panicUrl : DEFAULT_PANIC_URL,
      hideOnTabSwitch: !!c.hideOnTabSwitch,
      comboGesture: c.comboGesture !== false,
      cornerGesture: !!c.cornerGesture,
    };
  }
  function setConfig(patch) {
    var c = parseJson(lsGet(KEYS.COVER)) || {};
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) c[k] = patch[k];
    lsSet(KEYS.COVER, JSON.stringify(c));
    applyConfigChange();
  }

  /** Segundos de auto-ocultar. La clave antigua «_ms» la llenaba la página de Ajustes con SEGUNDOS: <1000 se lee como segundos. */
  function autoSeconds() {
    var s = parseInt(lsGet(KEYS.AUTO_SECONDS), 10);
    if (!isNaN(s)) return Math.max(0, s);
    var old = parseInt(lsGet(KEYS.AUTO_DISGUISE), 10);
    if (isNaN(old) || old <= 0) return 0;
    return old < 1000 ? old : Math.round(old / 1000);
  }
  function quickVisible() { return lsGet(KEYS.QUICK_TOGGLE) !== "0"; }

  /** Teclas de ocultar: JSON con códigos o un código suelto (formato de site.js); si no hay nada, las de siempre. */
  function toggleKeys() {
    var s = lsGet(KEYS.HOTKEY);
    if (s) {
      var p = parseJson(s);
      return { codes: Array.isArray(p) ? p : [s], keys: [] };
    }
    return { codes: DEFAULT_CODES, keys: DEFAULT_KEYS };
  }

  // ───────────────────────────── teclas ─────────────────────────────
  /** «Ctrl+Shift+KeyX» → ¿coincide con el evento? Sin «+», se compara solo el código o la tecla. */
  function matchSpec(e, spec) {
    if (!spec) return false;
    var parts = String(spec).split("+"), last = parts.pop(), need = { ctrl: 0, alt: 0, shift: 0, meta: 0 };
    for (var i = 0; i < parts.length; i++) { var m = parts[i].toLowerCase(); if (m === "control") m = "ctrl"; if (m in need) need[m] = 1; }
    if (parts.length && (!!e.ctrlKey !== !!need.ctrl || !!e.altKey !== !!need.alt || !!e.shiftKey !== !!need.shift || !!e.metaKey !== !!need.meta)) return false;
    return e.code === last || e.key === last;
  }
  function isToggleKey(e) {
    var t = toggleKeys(), i;
    for (i = 0; i < t.codes.length; i++) if (matchSpec(e, t.codes[i])) return true;
    for (i = 0; i < t.keys.length; i++) if (e.key === t.keys[i]) return true;
    return false;
  }
  /** Ctrl+Shift+< o Ctrl+Shift+> (en teclados con «<>» propia es IntlBackslash; en US, Shift+coma/punto). */
  function isComboGesture(e) {
    if (!e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey) return false;
    return e.key === "<" || e.key === ">" || e.code === "IntlBackslash" || e.code === "Comma" || e.code === "Period";
  }
  function isPanicKey(e) {
    var keys = config().panicKeys;
    for (var i = 0; i < keys.length; i++) if (matchSpec(e, keys[i])) return true;
    return false;
  }
  function isEditable(el) {
    var t = el && el.tagName ? el.tagName.toLowerCase() : "";
    return t === "input" || t === "textarea" || t === "select" || (el && el.isContentEditable);
  }

  /** Un solo manejador para la página y para los iframes del mismo origen. Devuelve true si consumió la tecla. */
  function onKeydown(e) {
    if (e.defaultPrevented || window.__budsinCapturingKey) return false;   // Ajustes está capturando una tecla nueva
    if (isPanicKey(e)) { e.preventDefault(); e.stopPropagation(); panic(); return true; }
    if (isToggleKey(e) || (config().comboGesture && isComboGesture(e))) {
      e.preventDefault(); e.stopPropagation(); toggle(); return true;
    }
    return false;
  }

  // ───────────────────────────── favicon y título ─────────────────────────────
  var origTitle = document.title, origIcons = null, createdIcon = null;
  function iconLinks() { return Array.prototype.slice.call(document.querySelectorAll("link[rel~='icon']")); }
  function applyFavicon(href) {
    var links = iconLinks();
    if (origIcons === null) origIcons = links.map(function (l) { return { el: l, href: l.getAttribute("href") }; });
    if (!links.length) { createdIcon = document.createElement("link"); createdIcon.rel = "icon"; document.head.appendChild(createdIcon); links = [createdIcon]; }
    links.forEach(function (l) { l.setAttribute("href", href); });
  }
  function restoreFavicon() {
    if (origIcons) origIcons.forEach(function (o) { if (o.href === null) o.el.removeAttribute("href"); else o.el.setAttribute("href", o.href); });
    if (createdIcon && createdIcon.parentNode) createdIcon.parentNode.removeChild(createdIcon);
    origIcons = null; createdIcon = null;
  }
  function faviconFor(domain) { return "https://www.google.com/s2/favicons?sz=64&domain=" + encodeURIComponent(domain); }

  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (_) { return ""; } }
  function titleFromUrl(u) {
    try {
      var url = new URL(u), seg = url.pathname.replace(/^\/+|\/+$/g, "").split("/").pop() || "";
      var name = decodeURIComponent(seg).replace(/[-_]/g, " ").replace(/\.[^.]+$/, "");
      if (name && name.length > 1) return name.charAt(0).toUpperCase() + name.slice(1);
    } catch (_) {}
    return hostOf(u) || "Documento";
  }
  /** Lo que se va a mostrar ahora mismo: { title, icon, url }. */
  function disguise() {
    var c = config(), p = PRESETS[c.preset], L = lang();
    if (c.preset === "custom") {
      var u = frameable(customUrl());
      return { title: titleFromUrl(u), icon: faviconFor(hostOf(u) || "google.com"), url: u };
    }
    return { title: p.title[L], icon: faviconFor(p.icon), url: p.url };
  }
  /** Los Documentos de Google solo se dejan incrustar con /preview. */
  function frameable(u) {
    var m = /^(https:\/\/docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/[^/?#]+)\/(?:edit|view)?/.exec(u || "");
    return m ? m[1] + "/preview" : u;
  }

  // ───────────────────────────── cubierta ─────────────────────────────
  var overlay = null, frame = null, closeBtn = null;
  function isOpen() { return !!(overlay && overlay.classList.contains("is-open")); }

  function injectStyles() {
    if (document.getElementById("juanjo-classroom-style")) return;
    var st = document.createElement("style");
    st.id = "juanjo-classroom-style";
    st.textContent = [
      "#" + IDS.OVERLAY + "{position:fixed;inset:0;z-index:999999;display:none;background:#fff}",
      "#" + IDS.OVERLAY + ".is-open{display:block}",
      "#" + IDS.OVERLAY + " iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#fff}",
      // el botón de cerrar casi no se ve (para que parezca un documento normal): aparece al acercar el mouse a la esquina
      "#" + IDS.CLOSE + "{position:fixed;top:10px;right:10px;z-index:1000000;width:38px;height:38px;border:0;border-radius:50%;background:rgba(32,33,36,.86);color:#fff;font:600 22px/1 Arial,sans-serif;cursor:pointer;display:grid;place-items:center;opacity:.04;transition:opacity .15s}",
      "#" + IDS.CLOSE + ":hover,#" + IDS.CLOSE + ":focus-visible{opacity:.95}",
      "@media (hover:none){#" + IDS.CLOSE + "{opacity:.35}}",
      "#" + IDS.QUICK + "{position:fixed;left:12px;bottom:12px;z-index:1000001;height:34px;min-width:34px;padding:0 12px;border:0;border-radius:999px;background:rgba(17,24,39,.72);color:#fff;font:600 12px/1 system-ui,Arial,sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px;backdrop-filter:blur(8px);opacity:.55;transition:opacity .15s,background .15s}",
      "#" + IDS.QUICK + ":hover,#" + IDS.QUICK + ":focus-visible{opacity:1;background:rgba(17,24,39,.92)}",
      "#" + IDS.CORNER + "{position:fixed;top:0;right:0;width:56px;height:56px;z-index:1000002;background:transparent}",
      "body.juanjo-classroom-open{overflow:hidden}",
    ].join("\n");
    document.head.appendChild(st);
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    injectStyles();
    overlay = document.createElement("div");
    overlay.id = IDS.OVERLAY;
    overlay.setAttribute("aria-hidden", "true");

    closeBtn = document.createElement("button");
    closeBtn.id = IDS.CLOSE; closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", tx().close);
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", function () { toggle(); });

    frame = document.createElement("iframe");
    frame.id = IDS.FRAME;
    frame.setAttribute("allow", "fullscreen");
    frame.setAttribute("allowfullscreen", "");
    // La página disfrazada es de terceros (otro origen), así que allow-same-origin solo le deja usar su propio almacenamiento.
    // Si algún día se apunta a una URL del mismo dominio, QUITAR allow-same-origin.
    frame.setAttribute("sandbox", "allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts");

    overlay.appendChild(closeBtn);
    overlay.appendChild(frame);
    document.body.appendChild(overlay);
    return overlay;
  }

  function loadFrame(url) {
    if (!frame) return;
    if (frame.getAttribute("data-url") !== url) { frame.src = url; frame.setAttribute("data-url", url); }
  }

  function syncControls(disable) {
    [IDS.THEME_BTN, IDS.FULLSCREEN_BTN].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (disable) { el.dataset.juanjoWasDisabled = el.disabled ? "1" : "0"; el.disabled = true; el.setAttribute("aria-disabled", "true"); }
      else { el.disabled = el.dataset.juanjoWasDisabled === "1"; el.removeAttribute("aria-disabled"); delete el.dataset.juanjoWasDisabled; }
    });
  }

  function paint(open) {
    var ov = ensureOverlay();
    if (open) {
      var d = disguise();
      loadFrame(d.url);
      if (!isOpen()) origTitle = document.title;     // lo que había antes de disfrazar
      document.title = d.title;
      applyFavicon(d.icon);
    } else {
      document.title = origTitle;
      restoreFavicon();
    }
    ov.classList.toggle("is-open", open);
    document.body.classList.toggle("juanjo-classroom-open", open);
    ov.setAttribute("aria-hidden", open ? "false" : "true");
    syncControls(open);
  }

  // pantalla completa: hay que salir antes de tapar
  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function exitFs() { try { if (document.exitFullscreen) return document.exitFullscreen(); if (document.webkitExitFullscreen) document.webkitExitFullscreen(); } catch (_) {} return null; }
  function afterFsExit(cb) {
    var done = false;
    function finish() { if (done) return; done = true; document.removeEventListener("fullscreenchange", on); document.removeEventListener("webkitfullscreenchange", on); cb(); }
    function on() { if (!fsElement()) finish(); }
    document.addEventListener("fullscreenchange", on); document.addEventListener("webkitfullscreenchange", on);
    setTimeout(finish, 400);
  }

  function createFunkinTimestamp() {
    var fromFloat = window.haxe_Int64Helper && window.haxe_Int64Helper.fromFloat;
    var now = (window.performance && typeof window.performance.now === "function")
      ? window.performance.now() : Date.now();
    return fromFloat ? fromFloat(now) : { high: 0, low: now | 0 };
  }

  function triggerFunkinEscape() {
    var flixel  = window.flixel_FlxG;
    var game    = flixel && flixel.game;
    var openfl  = window.openfl_Lib;
    var current = openfl && openfl.get_current && openfl.get_current();
    var stage   = current && current.stage;
    var win     = stage && stage.application && stage.application.__window
      ? stage.application.__window : stage && stage.window;
    if (!game || !win) return;
    var key = 27, mod = 0;
    if (win.onKeyDown)         win.onKeyDown.dispatch(key, mod);
    if (win.onKeyDownPrecise)  win.onKeyDownPrecise.dispatch(key, mod, createFunkinTimestamp());
    if (win.onKeyUp)           win.onKeyUp.dispatch(key, mod);
    if (win.onKeyUpPrecise)    win.onKeyUpPrecise.dispatch(key, mod, createFunkinTimestamp());
  }

  function setOpen(open) {
    if (open === isOpen() && overlay) return;
    triggerFunkinEscape();
    resetAutoTimer();
    if (open && fsElement()) { afterFsExit(function () { paint(true); }); exitFs(); return; }
    paint(open);
  }
  function toggle() { setOpen(!isOpen()); }

  /** Tecla de pánico: fuera, ya, a otra URL (sin dejar el juego en el historial). */
  function panic() {
    var url = config().panicUrl;
    try { window.location.replace(url); } catch (_) { window.location.href = url; }
  }

  // ───────────────────────────── auto-ocultar por inactividad ─────────────────────────────
  var autoTimer = null;
  function resetAutoTimer() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    var s = autoSeconds();
    if (!s) return;
    autoTimer = setTimeout(function () { if (!isOpen()) setOpen(true); }, s * 1000);
  }
  function startActivityListeners() {
    ["mousemove", "keydown", "pointerdown", "wheel", "touchstart"].forEach(function (ev) {
      window.addEventListener(ev, resetAutoTimer, { passive: true, capture: true });
    });
    resetAutoTimer();
  }

  // ───────────────────────────── ocultar al cambiar de pestaña ─────────────────────────────
  function onVisibility() {
    if (document.visibilityState === "hidden" && config().hideOnTabSwitch && !isOpen()) paint(true);
  }

  // ───────────────────────────── botón rápido y esquina ─────────────────────────────
  function ensureQuickButton() {
    var el = document.getElementById(IDS.QUICK);
    if (!quickVisible()) { if (el) el.remove(); return; }
    if (el) return;
    injectStyles();
    el = document.createElement("button");
    el.id = IDS.QUICK; el.type = "button";
    el.setAttribute("aria-label", tx().hideAria);
    el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="m1 1 22 22"/></svg><span>' + tx().hide + "</span>";
    el.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); toggle(); });
    document.body.appendChild(el);
  }

  /** Doble clic / doble toque en la esquina superior derecha. Es un cuadro transparente de 56×56 px (así también capta toques sobre un iframe). */
  var lastCornerTap = 0;
  function ensureCorner() {
    var el = document.getElementById(IDS.CORNER);
    if (!config().cornerGesture) { if (el) el.remove(); return; }
    if (el) return;
    injectStyles();
    el = document.createElement("div");
    el.id = IDS.CORNER;
    el.setAttribute("aria-hidden", "true");
    el.addEventListener("pointerdown", function (e) {
      var now = Date.now();
      if (now - lastCornerTap < 450) { lastCornerTap = 0; e.preventDefault(); toggle(); } else lastCornerTap = now;
    });
    document.body.appendChild(el);
  }

  function applyConfigChange() {
    ensureQuickButton(); ensureCorner(); resetAutoTimer();
    if (isOpen()) { var d = disguise(); loadFrame(d.url); document.title = d.title; applyFavicon(d.icon); }
  }

  // ───────────────────────────── foco del teclado con juegos en iframe ─────────────────────────────
  // Una tecla pulsada dentro de un iframe de OTRO origen no llega a esta página. Cuando el usuario toca un juego, se recupera el foco
  // para que la tecla de ocultar siga funcionando (comportamiento heredado de la versión 1).
  var focusLoop = null, forceFocusFromIframe = false;
  function ensureFocusTrap() {
    var el = document.getElementById(IDS.FOCUS_TRAP);
    if (el) return el;
    el = document.createElement("button");
    el.id = IDS.FOCUS_TRAP; el.type = "button"; el.tabIndex = -1; el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none";
    document.body.appendChild(el);
    return el;
  }
  function recoverFocus() { var el = ensureFocusTrap(); try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); } }
  function isGameIframe(el) { return !!(el && el.tagName && el.tagName.toLowerCase() === "iframe" && el.id !== IDS.FRAME); }
  function needFocusLoop() { return isGameIframe(fsElement()) || forceFocusFromIframe || isGameIframe(document.activeElement); }
  function stopFocusLoop() { if (focusLoop) { clearInterval(focusLoop); focusLoop = null; } }
  function syncFocusLoop() {
    if (!needFocusLoop()) { stopFocusLoop(); return; }
    recoverFocus();
    if (!focusLoop) focusLoop = setInterval(function () { if (!needFocusLoop()) stopFocusLoop(); else recoverFocus(); }, 350);
  }
  function bindIframe(iframe) {
    if (!iframe || iframe.__budsinCoverBound) return;
    iframe.__budsinCoverBound = true;
    function bindNow() {
      try {
        var w = iframe.contentWindow, d = iframe.contentDocument;
        if (!w || !d) return;
        w.addEventListener("keydown", onKeydown, true);
        d.addEventListener("keydown", onKeydown, true);
      } catch (_) {}                                   // otro origen: no se puede, se usa el truco del foco
    }
    iframe.addEventListener("load", bindNow);
    iframe.addEventListener("pointerdown", function () {
      if (iframe.id === IDS.FRAME) return;
      if (!fsElement()) forceFocusFromIframe = true;
      setTimeout(syncFocusLoop, 0);
    });
    bindNow();
  }
  function bindAllIframes() { Array.prototype.forEach.call(document.getElementsByTagName("iframe"), bindIframe); }

  // ───────────────────────────── Budsin Music y Budsin Chat dentro de los juegos ─────────────────────────────
  // Música: mini-reproductor (bm-mini.js, modo «game»). Chat: botón que abre la sala de este juego. Ninguno en /musica/, /chat/,
  // el portal, admin/settings ni dentro de iframes; se apagan desde sus propios menús (bm_gamemenu / bc_gamebtn).
  function ensureMusicMenu() {
    try {
      if (window.top !== window) return;
      if (location.pathname.indexOf("/musica/") === 0 || location.pathname.indexOf("/chat/") === 0) return;   // /chat/ carga su propio mini-reproductor
      if (!/(^|\.)budsin\.dev$/.test(location.hostname) && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
      if (/^\/(index\.html)?$/.test(location.pathname) || /\/(admin|settings)\.html$/.test(location.pathname)) return;   // the portal has its own card
      if (localStorage.getItem("bm_gamemenu") === "0") return;
      if (document.getElementById("bm-music-loader")) return;
      var s = document.createElement("script");
      s.id = "bm-music-loader";
      s.src = "https://games.budsin.dev/bm-mini.js?game=1&v=4";
      s.async = true;
      document.head.appendChild(s);
    } catch (e) {}
  }

  // ─────────────────────────────────────────────
  //  Budsin Chat button inside games: opens the chat room of this game in a new tab (/chat/#/game/<slug>/<name>).
  //  Next to the music button (bottom right). Not in the chat/music pages, not inside iframes; can be turned off from the chat menu.
  // ─────────────────────────────────────────────
  function ensureChatButton() {
    try {
      if (window.top !== window) return;
      var path = location.pathname;
      if (path.indexOf("/musica/") === 0 || path.indexOf("/chat/") === 0) return;
      if (!/(^|\.)budsin\.dev$/.test(location.hostname) && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
      if (/^\/(index\.html)?$/.test(path) || /\/(admin|settings)\.html$/.test(path)) return;   // the portal has its own entry
      if (localStorage.getItem("bc_gamebtn") === "0") return;
      if (document.getElementById("bc-fab")) return;
      var slug = (path.split("/").filter(Boolean)[0] || "").replace(/\.html?$/i, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
      if (!slug) return;
      var name = String(document.title || "").split(/\s[|\u2013\u2014-]\s/)[0].replace(/\s+/g, " ").trim().slice(0, 40);
      var lang = "es";
      try { var l = (localStorage.getItem("budsin_language") || "").slice(0, 2).toLowerCase(); if (l === "en" || l === "pt") lang = l; } catch (e) {}
      var label = { es: "Chat de este juego", en: "Chat for this game", pt: "Chat deste jogo" }[lang];
      var a = document.createElement("a");
      a.id = "bc-fab";
      a.href = "https://games.budsin.dev/chat/#/game/" + slug + (name ? "/" + encodeURIComponent(name) : "");
      a.target = "_blank";
      a.rel = "noopener";
      a.title = label;
      a.setAttribute("aria-label", label);
      a.textContent = "\uD83D\uDCAC";
      a.style.cssText = "position:fixed;right:66px;bottom:14px;width:44px;height:44px;border-radius:50%;z-index:999991;display:grid;place-items:center;font-size:20px;text-decoration:none;background:rgba(16,19,25,.9);box-shadow:0 6px 20px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.14);opacity:.78;cursor:pointer;";
      a.addEventListener("mouseenter", function () { a.style.opacity = "1"; });
      a.addEventListener("mouseleave", function () { a.style.opacity = ".78"; });
      document.body.appendChild(a);
    } catch (e) {}
  }

  // ───────────────────────────── arranque ─────────────────────────────
  window.addEventListener("keydown", onKeydown, true);
  window.addEventListener("focus", syncFocusLoop, true);
  document.addEventListener("focusin", syncFocusLoop, true);
  document.addEventListener("fullscreenchange", syncFocusLoop);
  document.addEventListener("webkitfullscreenchange", syncFocusLoop);
  document.addEventListener("pointerdown", function (e) { if (isGameIframe(e.target)) return; forceFocusFromIframe = false; syncFocusLoop(); }, true);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("juanjo:toggle-classroom", function () { toggle(); });
  window.addEventListener("storage", function (e) { if (e.key && e.key.indexOf("budsin_") === 0) applyConfigChange(); });   // ajustes cambiados en otra pestaña

  window.BudsinClassroomHotkey = {
    toggle: toggle,
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    isOpen: isOpen,
    panic: panic,
    getActiveUrl: function () { return disguise().url; },
    getConfig: config,
    setConfig: setConfig,
    presets: PRESETS,
    KEYS: KEYS,
    version: 2,
  };

  function init() {
    ensureQuickButton();
    ensureCorner();
    ensureMusicMenu();
    ensureChatButton();
    bindAllIframes();
    startActivityListeners();
  }
  if (document.body) init(); else document.addEventListener("DOMContentLoaded", init);
})();
