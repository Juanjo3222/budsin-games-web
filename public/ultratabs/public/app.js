// ── app.js ─ Proxy Browser (i18n, Theme, Mobile & Fixes) ──

// DOM refs
const urlInput       = document.getElementById("url-input");
const ntpSearchInput = document.getElementById("ntp-search-input");
const ntpScreen      = document.getElementById("ntp");
const loadingBar     = document.getElementById("loading-bar");
const securityIcon   = document.getElementById("security-icon");
const errorPage      = document.getElementById("error-page");
const framesContainer = document.getElementById("frames-container");
const tabsContainer  = document.getElementById("tabs-container");

const btnBack     = document.getElementById("btn-back");
const btnForward  = document.getElementById("btn-forward");
const btnReload   = document.getElementById("btn-reload");
const btnHome     = document.getElementById("btn-home");
const btnNewTab   = document.getElementById("btn-new-tab");
const btnMenu     = document.getElementById("btn-menu");
const btnBookmark = document.getElementById("btn-bookmark");
const settingsMenu = document.getElementById("settings-menu");
const bookmarksBar = document.getElementById("bookmarks-bar");
const internalPage = document.getElementById("internal-page");

// Context Menu
const ctxMenu = document.getElementById("context-menu");

// Modal
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle   = document.getElementById("modal-title");
const bmNameInput  = document.getElementById("bm-name");
const bmUrlInput   = document.getElementById("bm-url");
const bmUrlRow     = document.getElementById("bm-url-row");
const bmFolderSel  = document.getElementById("bm-folder");
const btnBmCancel  = document.getElementById("bm-cancel");
const btnBmSave    = document.getElementById("bm-save");

// Settings DOM
const prefSearchEngine = document.getElementById("pref-search-engine");
const prefWispUrl      = document.getElementById("pref-wisp-url");
const prefLang         = document.getElementById("pref-lang");
const prefTheme        = document.getElementById("pref-theme");
const btnSaveProxy     = document.getElementById("btn-save-proxy");

// State
let scramjet = null;
let tabs = [];
let activeTabId = null;
let tabCounter = 0;
let scramjetReady = false;

// Settings State
let settings = {
  searchEngine: "google",
  wispUrl: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/wisp/`,
  lang: "auto",
  theme: "auto",
  bgUrl: ""
};

// History State
let browseHistory = [];

// Bookmarks State
let bookmarks = [];

const DEFAULT_FAVICON = `<svg viewBox="0 0 24 24" width="12" height="12"><path fill="#9aa0a6" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`;
const FOLDER_ICON = `<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;

// Utils
function genId() { return Math.random().toString(36).substr(2, 9); }

// ── i18n ──────────────────────────────────────────────────
const dict = {
  en: {
    new_tab_title: "New Tab",
    nav_back: "Back", nav_forward: "Forward", nav_reload: "Reload", nav_home: "Home", nav_menu: "Menu", nav_bookmark: "Bookmark this tab",
    url_placeholder: "Search or enter URL",
    ntp_search: "Search Google or type a URL",
    menu_settings: "Settings",
    settings_title: "Settings",
    settings_appearance: "Appearance & Language",
    settings_lang: "Language",
    lang_auto: "Auto",
    settings_theme: "Theme",
    theme_auto: "Auto", theme_light: "Light", theme_dark: "Dark",
    settings_search: "Search Engine",
    settings_search_desc: "Search engine used in the address bar",
    settings_proxy: "Proxy Settings",
    settings_wisp: "Wisp Server URL",
    settings_wisp_desc: "The websocket server to handle bare-mux proxying.",
    settings_save_proxy: "Save & Reload",
    error_title: "This page isn't working",
    error_retry: "Reload",
    modal_name: "Name", modal_url: "URL", modal_folder: "Folder", modal_cancel: "Cancel", modal_save: "Save",
    ctx_open_new: "Open in new tab", ctx_edit: "Edit...", ctx_delete: "Delete",
    ctx_open_all: "Open all bookmarks ({0})", ctx_rename: "Rename...", ctx_del_folder: "Delete folder",
    ctx_add_folder: "Add folder...",
    bm_root: "Bookmarks bar",
    new_tab: "New Tab",
    new_folder: "New Folder",
    untitled: "Untitled",
    empty: "(Empty)",
    menu_history: "History",
    history_title: "History", history_clear: "Clear browsing data",
    settings_bg: "New Tab Background URL", settings_bg_desc: "Image URL for the new tab page. Leave empty for default.",
    theme_midnight: "Midnight Blue", theme_cyberpunk: "Cyberpunk"
  },
  ja: {
    new_tab_title: "新しいタブ",
    nav_back: "戻る", nav_forward: "進む", nav_reload: "再読み込み", nav_home: "ホーム", nav_menu: "メニュー", nav_bookmark: "このタブをブックマークに追加",
    url_placeholder: "Google で検索または URL を入力",
    ntp_search: "Google で検索または URL を入力",
    menu_settings: "設定",
    settings_title: "設定",
    settings_appearance: "デザインと言語",
    settings_lang: "言語",
    lang_auto: "自動 (OS設定)",
    settings_theme: "テーマ",
    theme_auto: "自動", theme_light: "ライト", theme_dark: "ダーク",
    settings_search: "検索エンジン",
    settings_search_desc: "アドレスバーで使用する検索エンジン",
    settings_proxy: "プロキシ設定",
    settings_wisp: "Wisp サーバー URL",
    settings_wisp_desc: "bare-mux のプロキシ処理を行うWebSocketサーバー",
    settings_save_proxy: "保存して再読み込み",
    error_title: "このページは動作していません",
    error_retry: "再読み込み",
    modal_name: "名前", modal_url: "URL", modal_folder: "フォルダ", modal_cancel: "キャンセル", modal_save: "保存",
    ctx_open_new: "新しいタブで開く", ctx_edit: "編集...", ctx_delete: "削除",
    ctx_open_all: "すべて開く ({0})", ctx_rename: "名前を変更...", ctx_del_folder: "フォルダを削除",
    ctx_add_folder: "フォルダを追加...",
    bm_root: "ブックマークバー",
    new_tab: "新しいタブ",
    new_folder: "新しいフォルダ",
    untitled: "無題",
    empty: "(空)",
    menu_history: "履歴",
    history_title: "履歴", history_clear: "閲覧履歴データの消去",
    settings_bg: "新規タブの壁紙URL", settings_bg_desc: "新規タブの背景画像のURL。デフォルトは空欄。",
    theme_midnight: "ミッドナイトブルー", theme_cyberpunk: "サイバーパンク"
  }
};

function getActiveLang() {
  if (settings.lang !== "auto") return settings.lang;
  return navigator.language.startsWith("ja") ? "ja" : "en";
}
function t(key, ...args) {
  let str = dict[getActiveLang()][key] || dict["en"][key] || key;
  args.forEach((arg, i) => { str = str.replace(`{${i}}`, arg); });
  return str;
}
function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.getAttribute("data-i18n")); });
  document.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = t(el.getAttribute("data-i18n-title")); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = t(el.getAttribute("data-i18n-placeholder")); });
}
function applyTheme() {
  document.documentElement.setAttribute("data-theme", settings.theme);
  if (settings.bgUrl) {
    ntpScreen.style.backgroundImage = `url("${settings.bgUrl}")`;
  } else {
    ntpScreen.style.backgroundImage = "none";
  }
}

// ── Init ──────────────────────────────────────────────────
async function init() {
  console.log("Init started");
  loadSettings();
  applyI18n();
  applyTheme();
  loadBookmarks();
  renderBookmarks();
  loadHistory();

  try {
    if (!('serviceWorker' in navigator)) {
      throw new Error("Service Workers are not supported in this browser.");
    }

    console.log("Loading Scramjet Controller...");
    if (typeof $scramjetLoadController === "undefined") throw new Error("$scramjetLoadController not found.");
    const { ScramjetController } = $scramjetLoadController();
    scramjet = new ScramjetController({
      prefix: "/scramjet/",
      files: {
        wasm: "/scram/scramjet.wasm.wasm",
        all:  "/scram/scramjet.all.js",
        sync: "/scram/scramjet.sync.js",
      },
    });
    
    // 最初に init して設定を IndexedDB に書き込ませる
    await scramjet.init();
    console.log("Scramjet inited");

    console.log("Registering SW...");
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log("SW registered.");
    
    // Wait for SW to be ready
    await navigator.serviceWorker.ready;
    
    // コントローラーがいない場合は、少し待ってから再チェック（リロードはしない）
    if (!navigator.serviceWorker.controller) {
      console.log("Waiting for controller to take effect...");
      await new Promise(r => setTimeout(r, 1000));
    }

    // SWの生存確認（Ping-Pong）
    const isSwReady = await new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (msg) => { if (msg.data === "pong") resolve(true); };
      
      const sendPing = () => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage("ping", [channel.port2]);
        }
      };
      
      sendPing();
      setTimeout(() => resolve(!!navigator.serviceWorker.controller), 2000);
    });

    console.log("Service Worker status check finished.");

    const { BareMuxConnection } = await import("/baremux/index.mjs");
    const connection = new BareMuxConnection("/baremux/worker.js");
    await connection.setTransport("/epoxy/index.mjs", [{ wisp: settings.wispUrl }]);
    console.log("BareMux transport set");

    scramjetReady = true;
    urlInput.disabled = false;
    createNewTab();
    
    setInterval(monitorTitles, 1000);
    console.log("Init finished successfully");
  } catch (e) {
    console.error("Init failed:", e);
    
    if (e.message.includes("object stores was not found") || e.message.includes("IDBDatabase")) {
      const dbs = ["$scramjet", "bare-mux", "keyval-store"];
      dbs.forEach(db => indexedDB.deleteDatabase(db));
      setTimeout(() => window.location.reload(), 500);
      return;
    }

    document.body.innerHTML = `<div style="padding: 20px; color: red; text-align:center; font-family:sans-serif;">
      <h2>Initialization Failed</h2>
      <p>${e.message}</p>
      <button onclick="localStorage.clear(); indexedDB.deleteDatabase('$scramjet'); location.reload();" style="padding: 10px 20px; background: #8ab4f8; border: none; border-radius: 4px; color: #000; cursor: pointer; font-weight:bold;">
        Clear Data & Reload
      </button>
    </div>`;
  }
}

init();

// ── Title Monitoring & History ───────────────────────────────
function monitorTitles() {
  if (!scramjetReady) return;
  tabs.forEach(tab => {
    if (!tab.isInternal && tab.iframe) {
      try {
        const doc = tab.iframe.contentDocument || tab.iframe.contentWindow.document;
        if (doc && doc.title && doc.title !== tab.title) {
          tab.title = doc.title;
          updateTabUI(tab);
          // 履歴記録（タイトル確定時）
          if (tab.url && !tab.url.startsWith("scram://")) recordHistory(tab.url, tab.title);
        }
      } catch (e) {}
    }
  });
}

function loadHistory() {
  try {
    const saved = localStorage.getItem("scramjet_history");
    if (saved) browseHistory = JSON.parse(saved);
  } catch (e) { browseHistory = []; }
}
function saveHistory() {
  localStorage.setItem("scramjet_history", JSON.stringify(browseHistory));
  renderHistory();
}
function recordHistory(url, title) {
  // すでに直近と同じURLなら記録しない
  if (browseHistory.length > 0 && browseHistory[0].url === url) return;
  
  browseHistory.unshift({ id: genId(), url, title, timestamp: Date.now() });
  if (browseHistory.length > 500) browseHistory = browseHistory.slice(0, 500); // 500件制限
  saveHistory();
}

// ── Tab Management ────────────────────────────────────────
function createNewTab(urlToLoad = null) {
  const id = `tab-${tabCounter++}`;
  const tabDom = document.createElement("div");
  tabDom.className = "tab";
  tabDom.innerHTML = `
    <div class="tab-favicon">${DEFAULT_FAVICON}</div>
    <span class="tab-title">${t("new_tab")}</span>
    <button class="tab-close" title="Close tab">×</button>
  `;
  tabsContainer.appendChild(tabDom);

  let frameObj = null;
  let iframe = null;
  if (scramjetReady) {
    frameObj = scramjet.createFrame();
    iframe = frameObj.frame;
    iframe.className = "proxy-frame";
    framesContainer.appendChild(iframe);
  }

  const tab = {
    id, dom: tabDom, scramjetFrame: frameObj, iframe, url: null, title: t("new_tab"), isInternal: false
  };
  tabs.push(tab);

  tabDom.addEventListener("mousedown", (e) => { if (!e.target.closest(".tab-close")) switchTab(id); });
  tabDom.querySelector(".tab-close").addEventListener("click", (e) => { e.stopPropagation(); closeTab(id); });

  if (frameObj) setupFrameEvents(tab);
  
  switchTab(id);
  if (urlToLoad) navigateTab(tab, urlToLoad);
}

function setupFrameEvents(tab) {
  tab.scramjetFrame.addEventListener("urlchange", (e) => {
    if (e.url && !tab.isInternal) {
      tab.url = e.url;
      try {
        const doc = tab.iframe.contentDocument;
        if (doc && doc.title) tab.title = doc.title;
      } catch(ex){}
      updateTabUI(tab);
      if (activeTabId === tab.id) syncUrlBar();
    }
  });
  tab.iframe.addEventListener("load", () => {
    if (tab.url && !tab.isInternal) {
      finishTabLoading(tab);
      if (activeTabId === tab.id) showFrame(tab.iframe);
      try {
        const doc = tab.iframe.contentDocument;
        if (doc && doc.title) { tab.title = doc.title; updateTabUI(tab); }
      } catch(ex){}
    }
  });
}

function switchTab(id) {
  activeTabId = id;
  const tab = getActiveTab();
  if (!tab) return;
  tabs.forEach(t => { t.dom.classList.remove("active"); if (t.iframe) t.iframe.classList.remove("active"); });
  tab.dom.classList.add("active");
  
  if (tab.isInternal) {
    ntpScreen.classList.add("hidden");
    internalPage.classList.add("visible");
    document.querySelectorAll(".internal-container").forEach(el => el.classList.remove("active"));
    
    if (tab.url === "scram://settings") { 
      document.getElementById("page-settings").classList.add("active");
      loadSettingsToUI(); 
    } else if (tab.url === "scram://history") {
      document.getElementById("page-history").classList.add("active");
      renderHistory();
    }
  } else if (tab.url) {
    ntpScreen.classList.add("hidden"); internalPage.classList.remove("visible"); showFrame(tab.iframe);
  } else {
    ntpScreen.classList.remove("hidden"); internalPage.classList.remove("visible"); ntpSearchInput.focus();
  }
  syncUrlBar();
}

function closeTab(id) {
  const index = tabs.findIndex(t => t.id === id);
  if (index === -1) return;
  tabs[index].dom.remove();
  if (tabs[index].iframe) tabs[index].iframe.remove();
  tabs.splice(index, 1);
  if (tabs.length === 0) createNewTab();
  else if (activeTabId === id) switchTab((tabs[index] || tabs[index - 1]).id);
}
function getActiveTab() { return tabs.find(t => t.id === activeTabId); }

// ── URL & Navigation ──────────────────────────────────────
function getSearchUrl(query) {
  switch (settings.searchEngine) {
    case "bing": return "https://www.bing.com/search?q=" + encodeURIComponent(query);
    case "duckduckgo": return "https://duckduckgo.com/?q=" + encodeURIComponent(query);
    case "google": default: return "https://www.google.com/search?q=" + encodeURIComponent(query);
  }
}
function normalizeUrl(raw) {
  raw = raw.trim();
  if (!raw) return null;
  if (raw.startsWith("scram://")) return raw;
  if (!raw.includes(".") || raw.includes(" ")) return getSearchUrl(raw);
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  try { new URL(raw); return raw; } catch { return getSearchUrl(raw); }
}

function navigateTab(tab, rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) return;
  tab.url = url;
  
  if (url.startsWith("scram://")) {
    tab.isInternal = true;
    if (url === "scram://settings") tab.title = t("menu_settings");
    else if (url === "scram://history") tab.title = t("menu_history");
    else tab.title = "Internal";
    updateTabUI(tab);
    if (activeTabId === tab.id) switchTab(tab.id);
    return;
  }

  tab.isInternal = false;
  try { tab.title = new URL(url).hostname; } catch { tab.title = url; }
  updateTabUI(tab);
  
  if (activeTabId === tab.id) {
    syncUrlBar();
    ntpScreen.classList.add("hidden"); internalPage.classList.remove("visible");
    showFrame(tab.iframe);
    startTabLoading(tab);
  }
  if (tab.scramjetFrame) tab.scramjetFrame.go(url);
}

function updateTabUI(tab) {
  const titleEl = tab.dom.querySelector(".tab-title");
  const faviconEl = tab.dom.querySelector(".tab-favicon");

  if (!tab.url) { titleEl.textContent = t("new_tab"); faviconEl.innerHTML = DEFAULT_FAVICON; return; }
  if (tab.isInternal) { titleEl.textContent = tab.title; faviconEl.innerHTML = DEFAULT_FAVICON; return; }

  titleEl.textContent = tab.title;
  try {
    const u = new URL(tab.url);
    if (scramjetReady) {
      faviconEl.innerHTML = "";
      const img = document.createElement("img");
      img.src = scramjet.encodeUrl(`${u.origin}/favicon.ico`);
      img.onerror = () => { faviconEl.innerHTML = DEFAULT_FAVICON; };
      faviconEl.appendChild(img);
    }
  } catch { faviconEl.innerHTML = DEFAULT_FAVICON; }
}

function syncUrlBar() {
  const tab = getActiveTab();
  if (!tab) return;

  if (tab.url) {
    urlInput.value = tab.url;
    if (tab.isInternal) {
      securityIcon.className = "secure";
      securityIcon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`;
    } else {
      try {
        if (new URL(tab.url).protocol === "https:") {
          securityIcon.className = "secure";
          securityIcon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"/></svg>`;
        } else {
          securityIcon.className = "";
          securityIcon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
        }
      } catch {}
    }
    const isBookmarked = getBookmarkByUrl(tab.url);
    if (isBookmarked) {
      btnBookmark.classList.add("active");
      btnBookmark.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.45 4.73L5.82 21z"/></svg>`;
    } else {
      btnBookmark.classList.remove("active");
      btnBookmark.innerHTML = `<svg viewBox="0 0 24 24"><path d="M22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.45 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"/></svg>`;
    }
    btnBack.disabled = false; btnForward.disabled = false;
  } else {
    urlInput.value = "";
    securityIcon.className = "";
    securityIcon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`;
    btnBack.disabled = true; btnForward.disabled = true;
    btnBookmark.classList.remove("active");
    btnBookmark.innerHTML = `<svg viewBox="0 0 24 24"><path d="M22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.45 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"/></svg>`;
  }
}

// ── Bookmarks Core ─────────────────────────────────────────
function loadBookmarks() {
  try {
    const saved = localStorage.getItem("scramjet_bookmarks_v2");
    if (saved) bookmarks = JSON.parse(saved);
  } catch (e) { bookmarks = []; }
}
function saveBookmarks() {
  localStorage.setItem("scramjet_bookmarks_v2", JSON.stringify(bookmarks));
  renderBookmarks();
  syncUrlBar();
}
function getBookmarkByUrl(url) { return bookmarks.find(b => b.type === 'link' && b.url === url); }

// ── Bookmarks UI ───────────────────────────────────────────
function renderBookmarks() {
  bookmarksBar.innerHTML = "";
  const roots = bookmarks.filter(b => b.parentId === null);
  roots.forEach(b => {
    if (b.type === 'link') bookmarksBar.appendChild(createBookmarkElement(b));
    else bookmarksBar.appendChild(createFolderElement(b));
  });
}
function getGoogleFavicon(urlStr) {
  try { const u = new URL(urlStr); return `https://www.google.com/s2/favicons?domain=${u.hostname}`; } catch { return null; }
}

function createBookmarkElement(b) {
  const btn = document.createElement("a");
  btn.className = "bookmark-item"; btn.href = b.url; btn.title = b.title;
  
  const icon = document.createElement("div"); icon.className = "bookmark-icon";
  if (b.url.startsWith("scram://")) icon.innerHTML = DEFAULT_FAVICON;
  else {
    const src = getGoogleFavicon(b.url);
    if (src) {
      const img = document.createElement("img"); img.src = src;
      img.onerror = () => { icon.innerHTML = DEFAULT_FAVICON; };
      icon.appendChild(img);
    } else { icon.innerHTML = DEFAULT_FAVICON; }
  }
  
  const text = document.createElement("span"); text.textContent = b.title;
  btn.appendChild(icon); btn.appendChild(text);

  btn.addEventListener("click", (e) => { e.preventDefault(); const tab = getActiveTab(); if (tab) navigateTab(tab, b.url); });
  btn.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); showContextMenu(e.clientX, e.clientY, "link", b); });
  return btn;
}

function createFolderElement(f) {
  const btn = document.createElement("div");
  btn.className = "bookmark-item folder-closed";
  
  const icon = document.createElement("div");
  icon.className = "bookmark-icon"; icon.innerHTML = FOLDER_ICON;
  
  const text = document.createElement("span"); text.textContent = f.title;
  btn.appendChild(icon); btn.appendChild(text);

  const dropdown = document.createElement("div");
  dropdown.className = "bookmark-dropdown";
  const children = bookmarks.filter(b => b.parentId === f.id);
  
  children.forEach(c => {
    if (c.type === 'link') {
      const a = document.createElement("a");
      a.className = "dropdown-item"; a.href = c.url; a.title = c.title;
      const i = document.createElement("div"); i.className = "bookmark-icon";
      const src = getGoogleFavicon(c.url);
      if (src) {
        const img = document.createElement("img"); img.src = src;
        img.onerror = () => { i.innerHTML = DEFAULT_FAVICON; };
        i.appendChild(img);
      } else { i.innerHTML = DEFAULT_FAVICON; }
      const span = document.createElement("span"); span.textContent = c.title;
      a.appendChild(i); a.appendChild(span);
      a.addEventListener("click", (e) => { e.preventDefault(); const tab = getActiveTab(); if (tab) navigateTab(tab, c.url); });
      a.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); showContextMenu(e.clientX, e.clientY, "link", c); });
      dropdown.appendChild(a);
    }
  });

  if (children.length === 0) {
    const empty = document.createElement("div");
    empty.className = "dropdown-item"; empty.textContent = t("empty"); empty.style.opacity = "0.5";
    dropdown.appendChild(empty);
  }
  
  btn.appendChild(dropdown);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".folder-open").forEach(el => { if(el !== btn) el.classList.remove("folder-open"); });
    btn.classList.toggle("folder-open");
  });
  btn.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); showContextMenu(e.clientX, e.clientY, "folder", f); });
  return btn;
}

// ── Context Menu ───────────────────────────────────────────
function showContextMenu(x, y, type, targetData) {
  ctxMenu.innerHTML = "";
  
  const addOption = (label, onClick) => {
    const btn = document.createElement("button");
    btn.className = "ctx-item"; btn.textContent = label;
    btn.addEventListener("click", () => { ctxMenu.classList.remove("visible"); onClick(); });
    ctxMenu.appendChild(btn);
  };
  const addDivider = () => {
    const div = document.createElement("div"); div.className = "ctx-divider"; ctxMenu.appendChild(div);
  };

  if (type === "link") {
    addOption(t("ctx_open_new"), () => createNewTab(targetData.url));
    addDivider();
    addOption(t("ctx_edit"), () => openBookmarkModal(targetData));
    addOption(t("ctx_delete"), () => {
      bookmarks = bookmarks.filter(b => b.id !== targetData.id);
      saveBookmarks();
    });
  } else if (type === "folder") {
    const childrenCount = bookmarks.filter(b => b.parentId === targetData.id && b.type === 'link').length;
    addOption(t("ctx_open_all", childrenCount), () => {
      const children = bookmarks.filter(b => b.parentId === targetData.id && b.type === 'link');
      children.forEach(c => createNewTab(c.url));
    });
    addDivider();
    addOption(t("ctx_rename"), () => openBookmarkModal(targetData));
    addOption(t("ctx_del_folder"), () => {
      bookmarks = bookmarks.filter(b => b.id !== targetData.id && b.parentId !== targetData.id);
      saveBookmarks();
    });
  } else if (type === "bar") {
    addOption(t("ctx_add_folder"), () => {
      openBookmarkModal({ id: genId(), type: 'folder', title: t("new_folder"), parentId: null });
    });
    const allLinks = bookmarks.filter(b => b.type === 'link');
    addDivider();
    addOption(t("ctx_open_all", allLinks.length), () => {
      allLinks.forEach(l => createNewTab(l.url));
    });
  }

  // Position adjustment for screen boundaries
  ctxMenu.style.left = `${x}px`;
  ctxMenu.style.top = `${y}px`;
  ctxMenu.classList.add("visible");
  
  const rect = ctxMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) ctxMenu.style.left = `${window.innerWidth - rect.width}px`;
  if (rect.bottom > window.innerHeight) ctxMenu.style.top = `${window.innerHeight - rect.height}px`;
}

bookmarksBar.addEventListener("contextmenu", (e) => {
  if (e.target === bookmarksBar) {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, "bar", null);
  }
});

document.addEventListener("click", () => {
  ctxMenu.classList.remove("visible");
  document.querySelectorAll(".folder-open").forEach(el => el.classList.remove("folder-open"));
});

// ── Modal Logic ────────────────────────────────────────────
let editingBookmark = null;

function openBookmarkModal(data) {
  editingBookmark = data;
  modalTitle.textContent = data.type === 'folder' ? (bookmarks.find(b=>b.id===data.id) ? t("ctx_rename") : t("new_folder")) : t("ctx_edit");
  
  bmNameInput.value = data.title;
  
  if (data.type === 'link') {
    bmUrlRow.style.display = "flex";
    bmUrlInput.value = data.url;
  } else {
    bmUrlRow.style.display = "none";
  }

  bmFolderSel.innerHTML = `<option value="root">${t("bm_root")}</option>`;
  const folders = bookmarks.filter(b => b.type === 'folder' && b.id !== data.id);
  folders.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f.id; opt.textContent = f.title;
    bmFolderSel.appendChild(opt);
  });
  bmFolderSel.value = data.parentId ? data.parentId : "root";

  modalOverlay.classList.add("visible");
  bmNameInput.focus();
}

btnBmCancel.addEventListener("click", () => modalOverlay.classList.remove("visible"));

btnBmSave.addEventListener("click", () => {
  if (!editingBookmark) return;
  const newName = bmNameInput.value.trim() || t("untitled");
  const newUrl = bmUrlInput.value.trim();
  const parentId = bmFolderSel.value === "root" ? null : bmFolderSel.value;

  const existingIdx = bookmarks.findIndex(b => b.id === editingBookmark.id);
  if (existingIdx !== -1) {
    bookmarks[existingIdx].title = newName;
    bookmarks[existingIdx].parentId = parentId;
    if (editingBookmark.type === 'link') bookmarks[existingIdx].url = newUrl;
  } else {
    bookmarks.push({
      id: editingBookmark.id,
      type: editingBookmark.type,
      title: newName,
      url: editingBookmark.type === 'link' ? newUrl : null,
      parentId
    });
  }
  
  saveBookmarks();
  modalOverlay.classList.remove("visible");
});

btnBookmark.addEventListener("click", () => {
  const tab = getActiveTab();
  if (tab && tab.url) {
    const existing = getBookmarkByUrl(tab.url);
    if (existing) {
      bookmarks = bookmarks.filter(b => b.id !== existing.id);
      saveBookmarks();
    } else {
      const newBm = { id: genId(), type: 'link', title: tab.title, url: tab.url, parentId: null };
      bookmarks.push(newBm);
      saveBookmarks();
      openBookmarkModal(newBm);
    }
  }
});


// ── Settings (scram://settings) ───────────────────────────
function loadSettings() {
  try {
    const saved = localStorage.getItem("scramjet_settings");
    if (saved) settings = { ...settings, ...JSON.parse(saved) };
  } catch (e) {}
}
function saveSettings() { localStorage.setItem("scramjet_settings", JSON.stringify(settings)); }

const prefBgUrl = document.getElementById("pref-bg-url");

function loadSettingsToUI() {
  prefSearchEngine.value = settings.searchEngine;
  prefWispUrl.value = settings.wispUrl;
  prefLang.value = settings.lang;
  prefTheme.value = settings.theme;
  prefBgUrl.value = settings.bgUrl || "";
}
prefSearchEngine.addEventListener("change", (e) => { settings.searchEngine = e.target.value; saveSettings(); });
prefLang.addEventListener("change", (e) => { settings.lang = e.target.value; saveSettings(); applyI18n(); });
prefTheme.addEventListener("change", (e) => { settings.theme = e.target.value; saveSettings(); applyTheme(); });
prefBgUrl.addEventListener("change", (e) => { settings.bgUrl = e.target.value.trim(); saveSettings(); applyTheme(); });

btnSaveProxy.addEventListener("click", () => {
  settings.wispUrl = prefWispUrl.value; saveSettings();
  location.reload();
});

// ── History UI ───────────────────────────────────────────
const historyContainer = document.getElementById("history-container");
const btnClearHistory = document.getElementById("btn-clear-history");

function renderHistory() {
  historyContainer.innerHTML = "";
  if (browseHistory.length === 0) {
    historyContainer.innerHTML = `<div style="padding: 20px; color: var(--chrome-text-secondary); text-align: center;">${t("empty")}</div>`;
    return;
  }
  
  let lastDay = "";
  browseHistory.forEach(item => {
    const date = new Date(item.timestamp);
    const dayStr = date.toLocaleDateString();
    if (dayStr !== lastDay) {
      const dayEl = document.createElement("div"); dayEl.className = "history-day"; dayEl.textContent = dayStr;
      historyContainer.appendChild(dayEl);
      lastDay = dayStr;
    }
    
    const row = document.createElement("a");
    row.className = "history-item"; row.href = item.url;
    
    const timeEl = document.createElement("div"); timeEl.className = "history-time"; timeEl.textContent = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    const iconEl = document.createElement("div"); iconEl.className = "history-icon";
    const src = getGoogleFavicon(item.url);
    if (src) {
      const img = document.createElement("img"); img.src = src;
      img.onerror = () => { iconEl.innerHTML = DEFAULT_FAVICON; };
      iconEl.appendChild(img);
    } else { iconEl.innerHTML = DEFAULT_FAVICON; }
    
    const titleEl = document.createElement("div"); titleEl.className = "history-title"; titleEl.textContent = item.title || item.url;
    const urlEl = document.createElement("div"); urlEl.className = "history-url"; urlEl.textContent = item.url;
    
    const delBtn = document.createElement("button"); delBtn.className = "history-del"; delBtn.innerHTML = `×`; delBtn.title = t("ctx_delete");
    delBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      browseHistory = browseHistory.filter(h => h.id !== item.id);
      saveHistory();
    });
    
    row.addEventListener("click", (e) => { e.preventDefault(); const tab = getActiveTab(); if(tab) navigateTab(tab, item.url); });
    
    row.appendChild(timeEl); row.appendChild(iconEl); row.appendChild(titleEl); row.appendChild(urlEl); row.appendChild(delBtn);
    historyContainer.appendChild(row);
  });
}

btnClearHistory.addEventListener("click", () => {
  if (confirm("Clear all browsing history?")) {
    browseHistory = [];
    saveHistory();
  }
});

// ── UI Helpers ────────────────────────────────────────────
function showFrame(iframe) { if (iframe) iframe.classList.add("active"); }
function hideAllFrames() { tabs.forEach(t => { if (t.iframe) t.iframe.classList.remove("active"); }); }
function startTabLoading(tab) {
  if (activeTabId === tab.id) { loadingBar.style.transition = "width 0.3s ease"; loadingBar.style.width = "30%"; }
  if (tab.loadingTimer) clearTimeout(tab.loadingTimer);
  tab.loadingTimer = setTimeout(() => { if (activeTabId === tab.id) loadingBar.style.width = "70%"; }, 300);
}
function finishTabLoading(tab) {
  if (tab.loadingTimer) clearTimeout(tab.loadingTimer);
  if (activeTabId === tab.id) {
    loadingBar.style.width = "100%";
    setTimeout(() => { loadingBar.style.transition = "none"; loadingBar.style.width = "0%"; }, 300);
  }
}

// ── General Events ────────────────────────────────────────
btnNewTab.addEventListener("click", () => createNewTab());
btnBack.addEventListener("click", () => { const t = getActiveTab(); if (t && t.scramjetFrame && !t.isInternal) t.scramjetFrame.back(); });
btnForward.addEventListener("click", () => { const t = getActiveTab(); if (t && t.scramjetFrame && !t.isInternal) t.scramjetFrame.forward(); });
btnReload.addEventListener("click", () => { const t = getActiveTab(); if (t && t.url && t.scramjetFrame && !t.isInternal) { startTabLoading(t); t.scramjetFrame.reload(); } });
btnHome.addEventListener("click", () => {
  const tab = getActiveTab();
  if (tab) {
    tab.url = null; tab.isInternal = false; updateTabUI(tab); syncUrlBar();
    hideAllFrames(); ntpScreen.classList.remove("hidden"); ntpSearchInput.focus();
  }
});
btnMenu.addEventListener("click", (e) => { e.stopPropagation(); settingsMenu.classList.toggle("visible"); });
document.addEventListener("click", (e) => {
  if (!settingsMenu.contains(e.target) && e.target !== btnMenu) settingsMenu.classList.remove("visible");
});
document.getElementById("menu-settings").addEventListener("click", () => {
  settingsMenu.classList.remove("visible"); const tab = getActiveTab(); if (tab) navigateTab(tab, "scram://settings");
});
document.getElementById("menu-history").addEventListener("click", () => {
  settingsMenu.classList.remove("visible"); const tab = getActiveTab(); if (tab) navigateTab(tab, "scram://history");
});
urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { const t = getActiveTab(); if (t) navigateTab(t, urlInput.value); urlInput.blur(); } });
urlInput.addEventListener("focus", () => urlInput.select());
ntpSearchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { const t = getActiveTab(); if (t) navigateTab(t, ntpSearchInput.value); ntpSearchInput.value = ""; } });
document.getElementById("ntp-search").addEventListener("click", () => ntpSearchInput.focus());

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey && e.key === "l") || e.key === "F6") { e.preventDefault(); urlInput.focus(); urlInput.select(); }
  if (e.ctrlKey && e.key === "t") { e.preventDefault(); createNewTab(); }
  if (e.ctrlKey && e.key === "w") { e.preventDefault(); if (activeTabId) closeTab(activeTabId); }
  if (e.key === "F5") { e.preventDefault(); const t = getActiveTab(); if (t && t.url && t.scramjetFrame && !t.isInternal) { startTabLoading(t); t.scramjetFrame.reload(); } }
  if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); const t = getActiveTab(); if (t && t.scramjetFrame && !t.isInternal) t.scramjetFrame.back(); }
  if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); const t = getActiveTab(); if (t && t.scramjetFrame && !t.isInternal) t.scramjetFrame.forward(); }
});