import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { fetchUserStatus, activateTrial } from "../lib/firebase";
import { notifyProStatus } from "../lib/sw";

const ProContext = createContext(null);

const ACTIVE_KEY = "budsin_pro_active";
const TRIAL_KEY = "budsin_trial_used";
const FREE_FAVORITES_LIMIT = 20;

function readFlag(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch (e) {
    return false;
  }
}

export function ProProvider({ children }) {
  const { user } = useAuth();
  const [isPro, setIsPro] = useState(() => readFlag(ACTIVE_KEY));
  const [trialUsed, setTrialUsed] = useState(() => readFlag(TRIAL_KEY));
  const [paidUntil, setPaidUntil] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const persistPro = useCallback((value) => {
    setIsPro(value);
    try {
      localStorage.setItem(ACTIVE_KEY, value ? "1" : "0");
      window.dispatchEvent(new CustomEvent("budsin-pro-change", { detail: { isPro: value } }));
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!user) {
      persistPro(false);
      try {
        localStorage.setItem(TRIAL_KEY, "0");
      } catch (e) {}
      return;
    }
    let cancelled = false;
    const check = async () => {
      setStatusLoading(true);
      const status = await fetchUserStatus(user.uid);
      if (cancelled) return;
      setStatusLoading(false);
      setPaidUntil(status.paidUntil);
      setTrialUsed(status.trialUsed);
      persistPro(status.pro);
      if (!status.pro) {
        try {
          const favs = JSON.parse(localStorage.getItem("budsin_favorites") || "[]");
          if (favs.length > FREE_FAVORITES_LIMIT) {
            localStorage.setItem("budsin_favorites", JSON.stringify(favs.slice(0, FREE_FAVORITES_LIMIT)));
          }
        } catch (e) {}
      }
    };
    check();
    const poll = setInterval(check, 300000);
    const onVisible = () => {
      if (!document.hidden) check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, persistPro]);

  const startTrial = useCallback(async () => {
    if (!user) throw new Error("NO_USER");
    const expiry = await activateTrial(user.uid);
    setPaidUntil(expiry);
    setTrialUsed(true);
    persistPro(true);
    return expiry;
  }, [user, persistPro]);

  useEffect(() => {
    notifyProStatus(isPro);
    const onControllerChange = () => notifyProStatus(isPro);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    }
  }, [isPro]);

  const value = useMemo(
    () => ({ isPro, trialUsed, paidUntil, statusLoading, startTrial, favoritesLimit: isPro ? Infinity : FREE_FAVORITES_LIMIT }),
    [isPro, trialUsed, paidUntil, statusLoading, startTrial]
  );

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export function usePro() {
  const ctx = useContext(ProContext);
  if (!ctx) throw new Error("usePro must be used within ProProvider");
  return ctx;
}
