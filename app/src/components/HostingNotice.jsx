import { useEffect, useState } from "react";
import { useI18n } from "../context/I18nContext";
import { usePro } from "../context/ProContext";

const DISMISS_KEY = "budsin_hostad_dismissed";
const URL = "https://budsin.dev/hosting/";

function wasDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch (e) {
    return false;
  }
}

/** Aviso (anuncio) que promociona Budsin Hosting. Fijo abajo a la izquierda, traducido y oculto para los Pro. */
export default function HostingNotice() {
  const { t } = useI18n();
  const { isPro } = usePro();
  const [dismissed, setDismissed] = useState(wasDismissed);
  const visible = !isPro && !dismissed;

  useEffect(() => {
    if (!visible) return undefined;
    document.body.classList.add("has-hostad");
    return () => document.body.classList.remove("has-hostad");
  }, [visible]);

  if (!visible) return null;

  const close = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch (e) {}
  };

  return (
    <aside className="host-ad" aria-label={t("promoAdLabel", "Anuncio")}>
      <span className="host-ad-tag">{t("promoAdLabel", "Anuncio")}</span>
      <button type="button" className="host-ad-close" onClick={close} aria-label={t("promoClose", "Cerrar anuncio")}>
        ✕
      </button>
      <strong className="host-ad-title">🌐 {t("hostAdTitle", "Tu web en tunombre.budsin.dev")}</strong>
      <p className="host-ad-text">{t("hostAdText", "Publica tu sitio gratis con Budsin Hosting: sube tus archivos y listo.")}</p>
      <a className="host-ad-cta" href={URL} target="_blank" rel="noopener">
        {t("hostAdCta", "Probar Budsin Hosting")} →
      </a>
    </aside>
  );
}
