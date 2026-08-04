import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { formatReleaseDate, isReleased } from "../lib/format";
import { useI18n } from "./I18nContext";

const GatingContext = createContext(null);

export function GatingProvider({ children }) {
  const [gatedGame, setGatedGame] = useState(null);

  const maybeGate = useCallback((game) => {
    if (!isReleased(game.proRelease)) setGatedGame(game);
  }, []);

  const close = useCallback(() => setGatedGame(null), []);

  const value = useMemo(() => ({ maybeGate, close }), [maybeGate, close]);

  return (
    <GatingContext.Provider value={value}>
      {children}
      <ProGatingModal game={gatedGame} onClose={close} />
    </GatingContext.Provider>
  );
}

export function useGating() {
  const ctx = useContext(GatingContext);
  if (!ctx) throw new Error("useGating must be used within GatingProvider");
  return ctx;
}

function ProGatingModal({ game, onClose }) {
  const { lang, t } = useI18n();
  if (!game) return null;

  const freeDate = game.proRelease ? formatReleaseDate(game.proRelease, lang) : null;

  return (
    <div className="modal-overlay is-visible" onClick={onClose}>
      <div className="changelog-card gating-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="changelog-close-wrap">
          <button type="button" className="changelog-close gating-close" onClick={onClose} aria-label={t("proGatingClose", "Cerrar")}>
            ×
          </button>
        </div>
        <span className="gating-icon">🔒</span>
        <h2>{t("proGatingTitle", "Juego exclusivo para Budsin Pro")}</h2>
        <p className="gating-sub">{t("proGatingSub", "Este juego está disponible primero para usuarios Pro.")}</p>
        <div className="gating-benefits">
          <div className="gating-benefits-title">{t("proGatingBenefits", "⭐ Ventajas de ser Pro")}</div>
          <ul>
            <li>{t("proGatingNoAds", "✓ Sin anuncios en el portal")}</li>
            <li>{t("proGatingGoldTheme", "✓ Tema Gold exclusivo")}</li>
            <li>{t("proGatingUnlimitedFavs", "✓ Favoritos ilimitados")}</li>
            <li>{t("proGatingEarlyAccess", "✓ Acceso anticipado a juegos nuevos")}</li>
            <li>{t("proGatingStats", "✓ Estadísticas de tu actividad")}</li>
          </ul>
        </div>
        <div className="gating-price">{t("proGatingPrice", "$2.99 USD / S/ 7 PEN por mes")}</div>
        <a href="#/settings?proCard=1" className="gating-cta">
          {t("proGatingCta", "⭐ Quiero ser Pro")}
        </a>
        {freeDate && (
          <div className="gating-free-date">
            🎉 {lang === "en" ? "This game will be free for everyone on" : lang === "pt" ? "Este jogo será grátis para todos em" : "Este juego será gratis para todos el"}{" "}
            <strong>{freeDate}</strong>.
          </div>
        )}
      </div>
    </div>
  );
}
