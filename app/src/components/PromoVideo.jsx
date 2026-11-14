import { useEffect, useRef, useState } from "react";
import { useI18n } from "../context/I18nContext";
import { usePro } from "../context/ProContext";

const DISMISS_KEY = "budsin_promo_dismissed";
const SRC = "promo/budsin-deals.mp4";
const POSTER = "promo/budsin-deals.jpg";

function wasDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch (e) {
    return false;
  }
}

/** Anuncio de vídeo pequeño al pie de la portada. Sin sonido hasta que se pulsa 🔊; se oculta a los Pro. */
export default function PromoVideo() {
  const { t } = useI18n();
  const { isPro } = usePro();
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [muted, setMuted] = useState(true);
  const video = useRef(null);
  const visible = !isPro && !dismissed;

  // Solo reproduce mientras está a la vista, para no gastar batería ni datos fuera de pantalla.
  useEffect(() => {
    const el = video.current;
    if (!visible || !el || !("IntersectionObserver" in window)) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  if (!visible) return null;

  const close = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch (e) {}
  };

  return (
    <aside className="promo-video" aria-label={t("promoAdLabel", "Anuncio")}>
      <video
        ref={video}
        src={SRC}
        poster={POSTER}
        muted={muted}
        loop
        playsInline
        preload="none"
        onClick={() => setMuted((m) => !m)}
      />
      <span className="promo-video-tag">{t("promoAdLabel", "Anuncio")}</span>
      <button type="button" className="promo-video-btn promo-video-sound" onClick={() => setMuted((m) => !m)} aria-label={muted ? t("promoUnmute", "Activar sonido") : t("promoMute", "Silenciar")}>
        {muted ? "🔇" : "🔊"}
      </button>
      <button type="button" className="promo-video-btn promo-video-close" onClick={close} aria-label={t("promoClose", "Cerrar anuncio")}>
        ✕
      </button>
    </aside>
  );
}
