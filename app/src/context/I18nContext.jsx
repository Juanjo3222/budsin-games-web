import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { TRANSLATIONS } from "../data/translations";

const I18nContext = createContext(null);

const LANGS = ["es", "en", "pt"];
const STORAGE_KEY = "budsin_language";

function resolveLang(l) {
  return LANGS.includes(l) ? l : "es";
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      const fromUrl = new URL(window.location.href).searchParams.get("lang");
      return resolveLang(fromUrl || localStorage.getItem(STORAGE_KEY) || "es");
    } catch (e) {
      return "es";
    }
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}
  }, [lang]);

  const t = useCallback(
    (key, fallback) => {
      const dict = TRANSLATIONS[lang] || TRANSLATIONS.es || {};
      const val = dict[key];
      if (typeof val === "function") return val;
      return val ?? fallback ?? key;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
