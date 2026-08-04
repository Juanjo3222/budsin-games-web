const store = new Map();
const localStorageMock = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size; },
};

const elem = () => ({
  style: {},
  setAttribute() {},
  getAttribute() { return null; },
  appendChild() {},
  removeChild() {},
  addEventListener() {},
  removeEventListener() {},
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  focus() {},
  click() {},
  set innerHTML(_) {},
  get innerHTML() { return ""; },
  dataset: {},
  scrollIntoView() {},
});

globalThis.window = {
  location: { href: "https://games.budsin.dev/", pathname: "/", search: "", hash: "", origin: "https://games.budsin.dev", hostname: "games.budsin.dev", protocol: "https:" },
  history: {
    length: 1,
    state: null,
    scrollRestoration: "auto",
    pushState(_s, _d, _u) {},
    replaceState(_s, _d, _u) {},
    back() {},
    forward() {},
    go() {},
  },
  localStorage: localStorageMock,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() { return true; },
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  setTimeout,
  clearTimeout,
  setInterval: () => 0,
  clearInterval() {},
  navigator: { language: "es", userAgent: "node" },
  devicePixelRatio: 1,
  innerWidth: 1280,
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
};
globalThis.self = globalThis.window;
globalThis.document = {
  defaultView: globalThis.window,
  documentElement: elem(),
  body: elem(),
  head: elem(),
  createElement: () => elem(),
  getElementById: () => elem(),
  querySelector: () => elem(),
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
  title: "",
  currentScript: { src: "" },
  cookie: "",
};
Object.defineProperty(globalThis, "navigator", { value: globalThis.window.navigator, configurable: true });
globalThis.localStorage = localStorageMock;
globalThis.location = globalThis.window.location;
globalThis.HTMLElement = class {};
globalThis.Element = class {};
globalThis.Node = class {};
globalThis.getComputedStyle = globalThis.window.getComputedStyle;
globalThis.DOMParser = class { parseFromString() { return { body: { innerHTML: "" } }; } };
globalThis.history = { pushState() {}, replaceState() {}, go() {}, back() {}, forward() {} };
globalThis.fetch = globalThis.fetch;

import React from "react";
import { renderToString } from "react-dom/server";

import App from "../src/App";
import { I18nProvider } from "../src/context/I18nContext";
import { ThemeProvider } from "../src/context/ThemeContext";
import { AuthProvider } from "../src/context/AuthContext";
import { ProProvider } from "../src/context/ProContext";
import { LibraryProvider } from "../src/context/LibraryContext";
import { ToastProvider } from "../src/context/ToastContext";
import { GatingProvider } from "../src/context/GatingContext";

const PATH_MAP = {
  "/settings": "#/settings",
  "/admin": "#/admin",
  "/about": "#/about",
  "/privacidad": "#/privacidad",
  "/terms": "#/terms",
  "/contacto": "#/contacto",
  "/comentarios": "#/comentarios",
  "/no-such-page": "#/no-such-page",
};

function renderAt(path) {
  globalThis.window.location.pathname = "/";
  globalThis.window.location.hash = PATH_MAP[path] || "#/";
  return renderToString(
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <ProProvider>
            <LibraryProvider>
              <ToastProvider>
                <GatingProvider>
                  <App />
                </GatingProvider>
              </ToastProvider>
            </LibraryProvider>
          </ProProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

let failures = 0;
function check(name, fn) {
  try {
    const out = fn();
    console.log(`ok ${name} (${typeof out === "number" ? out : "ok"})`);
  } catch (e) {
    failures++;
    console.error(`FAIL ${name}: ${e.message}\n${e.stack}`);
  }
}

check("HOME", () => {
  const home = renderAt("/");
  if (!home.includes("game-card")) throw new Error("no game cards");
  const n = (home.match(/class="game-card/g) || []).length;
  if (n < 50) throw new Error("expected >=50 cards, got " + n);
  return n;
});

check("SETTINGS", () => renderAt("/settings"));
check("ADMIN", () => renderAt("/admin"));
check("ABOUT", () => renderAt("/about"));
check("PRIVACIDAD", () => renderAt("/privacidad"));
check("TERMS", () => renderAt("/terms"));
check("CONTACTO", () => renderAt("/contacto"));
check("COMENTARIOS", () => renderAt("/comentarios"));
check("NOT FOUND", () => renderAt("/no-such-page"));

if (failures) {
  console.error(failures + " FAILURES");
  process.exit(1);
}
console.log("ALL ROUTES RENDER OK");
