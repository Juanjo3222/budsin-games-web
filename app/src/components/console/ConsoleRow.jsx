import { useCallback, useEffect, useRef } from "react";
import { useI18n } from "../../context/I18nContext";
import { usePro } from "../../context/ProContext";
import { isReleased } from "../../lib/format";

/** Distancia entre el inicio de dos carátulas consecutivas (ancho + hueco). */
export function tileStep(row) {
  const tiles = row ? row.querySelectorAll(".console-tile") : [];
  if (tiles.length > 1) return tiles[1].offsetLeft - tiles[0].offsetLeft;
  return tiles[0] ? tiles[0].offsetWidth : 0;
}

/**
 * Fila horizontal de carátulas con scroll-snap. El juego enfocado es el que
 * queda alineado al inicio de la fila; se calcula a partir del scroll.
 */
export default function ConsoleRow({ games, focused, onFocusChange, onLaunch, rowRef }) {
  const { t } = useI18n();
  const { isPro } = usePro();
  const frame = useRef(0);

  const onScroll = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const row = rowRef.current;
      const step = tileStep(row);
      if (!row || !step) return;
      const index = Math.round(row.scrollLeft / step);
      onFocusChange(Math.max(0, Math.min(games.length - 1, index)));
    });
  }, [games.length, onFocusChange, rowRef]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    <div className="console-row" ref={rowRef} onScroll={onScroll}>
      {games.map((g, i) => {
        const showProBadge = g.pro && !isPro && !isReleased(g.proRelease);
        return (
          <a
            key={g.href}
            className={`console-tile ${i === focused ? "is-focused" : ""}`}
            href={g.href}
            aria-label={g.title}
            aria-current={i === focused ? "true" : undefined}
            onClick={(e) => {
              e.preventDefault();
              onLaunch(g);
            }}
          >
            {g.cover ? (
              <img src={g.cover} alt="" loading={i < 6 ? "eager" : "lazy"} decoding="async" draggable="false" />
            ) : (
              <span className="console-tile-emoji">💬</span>
            )}
            {g.isNew && <span className="new-badge">{t("newBadge", "Nuevo")}</span>}
            {showProBadge && <span className="pro-badge">{t("proBadge", "Anticipado para Pro\npróximamente gratis").split("\n")[0]}</span>}
          </a>
        );
      })}
    </div>
  );
}
