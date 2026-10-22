import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GAMES } from "../../data/games";
import { useI18n } from "../../context/I18nContext";
import { usePageTransition } from "../../context/TransitionContext";
import { useFavoriteToggle } from "../../hooks/useFavoriteToggle";
import { playSelect } from "../../lib/sfx";
import ConsoleRow, { tileStep } from "./ConsoleRow";
import ConsoleDock from "./ConsoleDock";

const BY_HREF = new Map(GAMES.map((g) => [g.href, g]));
const pick = (hrefs) => hrefs.map((h) => BY_HREF.get(h)).filter(Boolean);

/** Tiempo (ms) que se ignora el scroll como fuente de foco tras un movimiento por teclado. */
const KEY_MOVE_LOCK_MS = 700;

function useClock(lang) {
  // Vacío hasta montar: así el HTML prerenderizado no queda con la hora de la compilación.
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return now ? now.toLocaleTimeString(lang, { hour: "numeric", minute: "2-digit" }) : "";
}

function isBlocked(e) {
  const el = e.target;
  const tag = ((el && el.tagName) || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select" || (el && el.isContentEditable)) return true;
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  // Modo oculto (Classroom Hotkey) o popup Pro abiertos
  if (document.body.classList.contains("juanjo-classroom-open")) return true;
  return !!document.querySelector(".gating-card");
}

/**
 * Inicio estilo menú de consola: título del juego enfocado, fila de carátulas
 * desplazable, dock redondo y ayuda de teclas. Teclado: ← → mueven, Enter juega.
 */
export default function ConsoleHome({ popularity, favorites, recently, onLaunch, onRandom, hasLibrary = false }) {
  const { lang, t } = useI18n();
  const toggleFav = useFavoriteToggle();
  const [source, setSource] = useState("all");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(0);
  const rowRef = useRef(null);
  const sectionRef = useRef(null);
  const focusedRef = useRef(0);
  const onScreen = useRef(true);
  const moveTarget = useRef(null);
  const moveTimer = useRef(0);
  const { run } = usePageTransition();
  const clock = useClock(lang);

  // El orden por popularidad se congela con la primera lectura para que la fila no se reordene mientras se mira.
  const rank = useRef(null);
  if (!rank.current && Object.keys(popularity).length > 0) rank.current = popularity;

  const games = useMemo(() => {
    let base;
    if (source === "favorites") {
      base = pick(favorites);
    } else {
      const recent = pick(recently);
      if (source === "recent") {
        base = recent;
      } else {
        const seen = new Set(recent.map((g) => g.href));
        const score = (g) => Number((rank.current || {})[g.href]) || 0;
        base = [...recent, ...GAMES.filter((g) => !seen.has(g.href)).sort((a, b) => score(b) - score(a))];
      }
    }
    const q = query.trim().toLowerCase();
    return q ? base.filter((g) => (g.title + " " + g.name).toLowerCase().includes(q)) : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, favorites, recently, query, rank.current]);

  // Al cambiar de fuente o llegar el orden por popularidad, el foco vuelve al inicio. La fila se
  // remonta (ver `key` abajo) para empezar en scroll 0: el scroll-snap del navegador, si no,
  // seguiría a la carátula que antes estaba alineada.
  const rowKey = source + (rank.current ? ":ranked" : "");
  useEffect(() => {
    focusedRef.current = 0;
    moveTarget.current = null;
    setFocused(0);
    if (rowRef.current) rowRef.current.scrollLeft = 0;
  }, [rowKey, query]);

  const onScrollFocus = useCallback((index) => {
    if (moveTarget.current !== null) {
      if (index === moveTarget.current) moveTarget.current = null;
      return;
    }
    focusedRef.current = index;
    setFocused(index);
  }, []);

  const moveTo = useCallback(
    (index) => {
      const row = rowRef.current;
      const step = tileStep(row);
      const next = Math.max(0, Math.min(games.length - 1, index));
      focusedRef.current = next;
      setFocused(next);
      moveTarget.current = next;
      clearTimeout(moveTimer.current);
      moveTimer.current = setTimeout(() => { moveTarget.current = null; }, KEY_MOVE_LOCK_MS);
      if (row && step) row.scrollTo({ left: next * step, behavior: "smooth" });
    },
    [games.length]
  );

  useEffect(() => () => clearTimeout(moveTimer.current), []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([entry]) => { onScreen.current = entry.isIntersecting; }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (!onScreen.current || e.defaultPrevented || isBlocked(e)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        moveTo(focusedRef.current + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveTo(focusedRef.current - 1);
      } else if (e.key === "f" || e.key === "F") {
        const game = games[focusedRef.current];
        if (game) {
          e.preventDefault();
          toggleFav(game);
        }
      } else if (e.key === "Enter" && e.target === document.body) {
        const game = games[focusedRef.current];
        if (game) {
          e.preventDefault();
          const tiles = rowRef.current ? rowRef.current.querySelectorAll(".console-tile") : [];
          onLaunch(game, tiles[focusedRef.current]);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [games, moveTo, onLaunch, toggleFav]);

  const closeSearch = useCallback(() => {
    setSearching(false);
    setQuery("");
  }, []);

  const actions = useMemo(
    () => ({
      random: onRandom,
      search: () => {
        playSelect();
        if (searching) {
          closeSearch();
          return;
        }
        setSearching(true);
      },
      grid: () => {
        const browse = document.getElementById("browse");
        if (browse) browse.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      settings: (origin) =>
        run(
          origin,
          () => {
            window.location.hash = "#/settings";
          },
          { settle: "route" }
        ),
    }),
    [onRandom, run, searching, closeSearch]
  );

  const onSearchKey = (e) => {
    if (e.key === "Escape") {
      closeSearch();
    } else if (e.key === "Enter") {
      const game = games[focusedRef.current];
      if (game) onLaunch(game, e.currentTarget);
    }
  };

  const selectSource = useCallback(
    (id) => {
      if (id === source) return;
      playSelect();
      setSource(id);
    },
    [source]
  );

  const current = games[focused];
  const isFav = !!current && favorites.includes(current.href);

  return (
    <section className="console-home" ref={sectionRef} aria-label="Budsin Games">
      <div className="console-head">
        <div className="console-head-right">
          {games.length > 1 && (
            <>
              <button
                type="button"
                className="console-nav"
                aria-label={t("consolePrev", "Anterior")}
                disabled={focused === 0}
                onClick={() => moveTo(focusedRef.current - 1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="console-nav"
                aria-label={t("consoleNext", "Siguiente")}
                disabled={focused >= games.length - 1}
                onClick={() => moveTo(focusedRef.current + 1)}
              >
                ›
              </button>
            </>
          )}
          {current && (
            <button
              type="button"
              className={`console-nav console-fav ${isFav ? "is-on" : ""}`}
              aria-label={t("favoriteSaved", "Favorito")}
              aria-pressed={isFav}
              title={t("favoriteSaved", "Favorito")}
              onClick={() => toggleFav(current)}
            >
              {isFav ? "★" : "☆"}
            </button>
          )}
          <time className="console-clock">{clock}</time>
        </div>
      </div>

      <div className="console-focus">
        <h2 className="console-title" aria-live="polite">{current ? current.title : ""}</h2>
        {games.length === 0 ? (
          <p className="console-empty">
            {query
              ? t("noResults", "No encontramos juegos con ese filtro. Prueba otra búsqueda.")
              : source === "favorites"
              ? t("noFavorites", "Aún no tienes favoritos.")
              : t("noRecent", "Aún no has jugado nada.")}
          </p>
        ) : (
          <div className="console-stage">
            <ConsoleRow key={rowKey} games={games} focused={focused} onFocusChange={onScrollFocus} onLaunch={onLaunch} rowRef={rowRef} />
          </div>
        )}
      </div>

      {searching && (
        <div className="console-search">
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            autoFocus
            className="console-search-input"
            value={query}
            placeholder={t("searchPlaceholder", "Buscar juego por nombre...")}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
          />
          <button type="button" className="console-search-close" aria-label={t("consoleSearchClose", "Cerrar")} onClick={closeSearch}>×</button>
        </div>
      )}

      <ConsoleDock source={source} onSource={selectSource} actions={actions} hasLibrary={hasLibrary} searching={searching} />

      <div className="console-foot">
        {!hasLibrary ? (
          <nav className="console-legal" aria-label="Legal">
            <a href="#/about">{t("footerAbout", "Acerca de")}</a>
            <a href="#/privacidad">{t("footerPrivacy", "Privacidad")}</a>
            <a href="#/terms">{t("footerTerms", "Términos")}</a>
            <a href="#/contacto">{t("footerContact", "Contacto")}</a>
          </nav>
        ) : (
          <span />
        )}
        <div className="console-hints" aria-hidden="true">
          <span><kbd>←</kbd><kbd>→</kbd>{t("consoleHintMove", "Navegar")}</span>
          <span><kbd>Enter</kbd>{t("consoleHintPlay", "Jugar")}</span>
          <span><kbd>F</kbd>{t("consoleHintFav", "Favorito")}</span>
        </div>
      </div>
    </section>
  );
}
