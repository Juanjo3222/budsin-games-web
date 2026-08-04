import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { GAMES } from "../data/games";
import GameCard from "../components/GameCard";
import MiniShelf from "../components/MiniShelf";
import AdsSlot from "../components/AdsSlot";
import ChangelogModal from "../components/ChangelogModal";
import Topbar from "../components/Topbar";
import Footer from "../components/Footer";
import { useI18n } from "../context/I18nContext";
import { usePro } from "../context/ProContext";
import { useLibrary } from "../context/LibraryContext";
import { useToast } from "../context/ToastContext";
import { subscribePopularity, incrementRemotePopularity } from "../lib/firebase";

const SEARCH_HISTORY_KEY = "budsin_search_history";
const SEARCH_HISTORY_MAX = 8;

function readJson(key, fb) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fb));
  } catch (e) {
    return fb;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

export default function HomePage() {
  const { lang, t } = useI18n();
  const { isPro } = usePro();
  const { favorites, recently, collections, addRecent, toggleFavorite, collectionsLimit, createCollection, renameCollection, deleteCollection, importSharedCollection } = useLibrary();
  const { showToast } = useToast();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [sort, setSort] = useState("popular");
  const [popularity, setPopularity] = useState({});
  const [rankingReady, setRankingReady] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(() => readJson(SEARCH_HISTORY_KEY, []));
  const searchRef = useRef(null);

  useEffect(() => {
    const unsub = subscribePopularity((map) => {
      setPopularity(map);
      setRankingReady(true);
    });
    return () => unsub && unsub();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get("shared_collection");
    if (shared) {
      const data = importSharedCollection(shared);
      if (data) {
        showToast("📁 Colección importada: " + data.name, false);
        try {
          history.replaceState({}, "", window.location.pathname + window.location.hash);
        } catch (e) {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowHistory(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const categories = useMemo(() => {
    const set = new Set(GAMES.map((g) => g.category.es));
    return ["Todos", ...Array.from(set)];
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = GAMES.filter((g) => {
      if (category !== "Todos" && g.category.es !== category) return false;
      if (q) {
        const hay = (g.title + " " + g.name).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort === "alphabetical") {
      list = list.slice().sort((a, b) => a.title.localeCompare(b.title, lang));
    } else if (sort === "newest") {
      list = list.slice().sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    } else if (sort === "popular") {
      list = list.slice().sort((a, b) => {
        const sa = Number(popularity[a.href]) || 0;
        const sb = Number(popularity[b.href]) || 0;
        if (sa !== sb) return sb - sa;
        return 0;
      });
    }
    return list;
  }, [query, category, sort, popularity, lang]);

  const pushHistory = useCallback((value) => {
    const q = value.trim();
    if (!q) return;
    setHistory((prev) => {
      const next = [q, ...prev.filter((h) => h !== q)].slice(0, SEARCH_HISTORY_MAX);
      writeJson(SEARCH_HISTORY_KEY, next);
      return next;
    });
  }, []);

  const removeHistory = useCallback((value) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h !== value);
      writeJson(SEARCH_HISTORY_KEY, next);
      return next;
    });
  }, []);

  const onSearchInput = (e) => {
    setQuery(e.target.value);
    pushHistory(e.target.value);
  };

  const randomGame = () => {
    const pick = GAMES[Math.floor(Math.random() * GAMES.length)];
    incrementRemotePopularity(pick.href, pick.title, 1);
    addRecent(pick.href);
    window.location.href = pick.href;
  };

  const onPlay = useCallback(
    (game) => {
      incrementRemotePopularity(game.href, game.title, 1);
      addRecent(game.href);
      window.location.href = game.href;
    },
    [addRecent]
  );

  const handleShare = (name) => {
    if (!isPro) {
      showToast(t("shareCollectionProOnly", "Solo Pro puede compartir colecciones"), true);
      return;
    }
    const col = collections.find((c) => c.name === name);
    if (!col) return;
    const data = JSON.stringify({ type: "budsin_collection", name: col.name, items: col.items });
    const encoded = btoa(encodeURIComponent(data));
    const url = window.location.origin + "/?shared_collection=" + encoded;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => showToast("🔗 Link copiado!", false));
    } else {
      showToast(url, false);
    }
  };

  const handleCreateCollection = () => {
    const name = window.prompt(t("collectionsCreatePrompt", "Nombre de la nueva colección:"));
    const res = createCollection(name);
    if (res.limited) showToast(t("collectionsLimitReached", "Límite de colecciones alcanzado (2). Hazte Pro para ilimitadas."), true);
    else if (res.error === "DUPLICATE") showToast(t("collectionsCreateDuplicate", "Ya existe una colección con ese nombre."), true);
  };

  return (
    <div className="site-shell">
      <Topbar />
      <main className="page-main">
        <section className="hero">
          <h1 className="hero-title">{t("heroTitle", "Budsin Games")}</h1>
          <p className="hero-subtitle">{t("heroSubtitle", "Una portada pensada como menu de consola: entra al portal, elige una caratula y salta directo a jugar desde el navegador.")}</p>
          <div className="hero-badges">
            <span>🎮 {t("badgeGames", "40 juegos listos")}</span>
            <span>⚡ {t("badgeQuick", "Entrada rapida")}</span>
            <span>🧩 {t("badgeLibrary", "Biblioteca estilo Switch")}</span>
          </div>
          {isPro && (
            <div className="pro-hero-message">{t("proHeroMessage", "¡Eres Pro! Muchas gracias por apoyarme 🫶")}</div>
          )}
        </section>

        <section className="search-section">
          <div className="search-row">
            <div className="search-wrap glass" ref={searchRef}>
              <span className="search-icon">🔍</span>
              <input
                type="search"
                className="search-input"
                placeholder={t("searchPlaceholder", "Buscar juego por nombre...")}
                value={query}
                onChange={onSearchInput}
                onFocus={() => setShowHistory(true)}
              />
              {query && (
                <button type="button" className="search-clear" onClick={() => setQuery("")}>×</button>
              )}
              {showHistory && history.length > 0 && (
                <div className="search-history">
                  <div className="search-history-title">{t("searchHistoryTitle", "Búsquedas recientes")}</div>
                  {history.map((h) => (
                    <div key={h} className="search-history-item" onClick={() => { setQuery(h); setShowHistory(false); }}>
                      <span>🕐 {h}</span>
                      <button type="button" className="remove-search" onClick={(e) => { e.stopPropagation(); removeHistory(h); }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="btn random-btn" onClick={randomGame}>🎲 {t("randomGame", "Juego al azar")}</button>
          </div>
          <div className="chips" id="categoryFilters" aria-label={t("categoriesLabel", "Categorías")}>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className={`chip ${category === c ? "active" : ""}`}
                onClick={() => setCategory(c)}
              >
                {c === "Todos" ? t("chipAll", "Todos") : c}
              </button>
            ))}
          </div>
          <div className="results-row">
            <span className="results-count">{t("resultsCount", (n) => `${n} juegos`)(filtered.length)}</span>
            <label className="sort-label">
              {t("sortLabel", "Ordenar:")}
              <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="popular">{t("sortPopular", "Más jugados")}</option>
                <option value="alphabetical">{t("sortAlphabetical", "A-Z")}</option>
                <option value="newest">{t("sortNewest", "Más nuevos")}</option>
              </select>
            </label>
          </div>
        </section>

        {favorites.length > 0 && (
          <MiniShelf
            title={t("shelfFavorites", "🎮 Tus juegos")}
            hrefs={favorites}
            onRemove={(href) => toggleFavorite(href)}
            emptyText={t("noFavorites", "Aún no tienes favoritos.")}
          />
        )}
        {recently.length > 0 && (
          <MiniShelf title={t("shelfRecent", "🕐 Jugado recientemente")} hrefs={recently} emptyText={t("noRecent", "Aún no has jugado nada.")} />
        )}

        {collections.length > 0 && (
          <section className="shelf glass">
            <div className="shelf-head">
              <h3 className="shelf-title">📁 {t("shelfCollections", "Mis colecciones")}</h3>
              <button type="button" className="btn create-collection-btn" onClick={handleCreateCollection}>
                ＋ {t("collectionsCreate", "Nueva colección")}
              </button>
            </div>
            {collections.map((col) => (
              <div className="collection-shelf" key={col.name}>
                <div className="collection-head">
                  <strong className="collection-name">📁 {col.name}</strong>
                  <div className="collection-actions">
                    <button type="button" className="collection-action-btn" title={t("collectionsShare", "Compartir")} onClick={() => handleShare(col.name)}>🔗</button>
                    <button
                      type="button"
                      className="collection-action-btn"
                      title={t("collectionsRename", "Renombrar")}
                      onClick={() => {
                        const next = window.prompt(t("collectionsRenamePrompt", "Nuevo nombre para la colección:"), col.name);
                        if (next) renameCollection(col.name, next);
                      }}
                    >✏️</button>
                    <button
                      type="button"
                      className="collection-action-btn"
                      title={t("collectionsDelete", "Eliminar")}
                      onClick={() => {
                        if (window.confirm(t("collectionsDeleteConfirm", "¿Eliminar colección") + " '" + col.name + "'?")) deleteCollection(col.name);
                      }}
                    >🗑️</button>
                  </div>
                </div>
                <MiniShelf hrefs={col.items} emptyText={t("collectionsEmpty", "Tus colecciones aparecerán aquí. Crea una y añade juegos desde cada tarjeta.")} />
              </div>
            ))}
          </section>
        )}

        <section className="library-section">
          {filtered.length === 0 ? (
            <div className="no-results">{t("noResults", "No encontramos juegos con ese filtro. Prueba otra búsqueda.")}</div>
          ) : (
            <div className="games-grid">
              {filtered.map((g) => (
                <GameCard key={g.href} game={g} hits={popularity[g.href]} onPlay={onPlay} />
              ))}
            </div>
          )}
        </section>

        <div className="suggestions-cta">
          <a className="suggestions-link" href="https://forms.gle/bUHTy8Lt6Kz1qkAx8" target="_blank" rel="noreferrer">
            {t("suggestionsLink", "Envia tus sugerencias a Budsin")}
          </a>
        </div>

        <AdsSlot />

        <section className="articles-section">
          <div className="articles-head">
            <span className="articles-kicker">{t("articlesKicker", "Consejos y guías")}</span>
            <h2>{t("articlesTitle", "Tips para sacarle más partido al portal")}</h2>
          </div>
          <div className="articles-grid">
            <article className="article-card glass">
              <div className="article-icon">🎮</div>
              <h3>{t("article1Title", "Cómo usar el modo oculto")}</h3>
              <p>{t("article1Desc", "El Classroom Hotkey te permite ocultar el portal al instante. Configura tu tecla de acceso rápido y una URL de disfraz desde la página de Ajustes. Al pulsar la tecla, el sitio se redirige a la URL que prefieras.")}</p>
              <a href="#/settings" className="article-link">{t("article1Cta", "Ir a Ajustes →")}</a>
            </article>
            <article className="article-card glass">
              <div className="article-icon">⭐</div>
              <h3>{t("article2Title", "Guarda tus favoritos")}</h3>
              <p>{t("article2Desc", "Haz clic en la estrella de cualquier juego para añadirlo a tu lista de favoritos. Los favoritos se guardan automáticamente en tu navegador y aparecen en la sección Tus juegos para que los encuentres al instante.")}</p>
            </article>
            <article className="article-card glass">
              <div className="article-icon">🔍</div>
              <h3>{t("article3Title", "Busca y filtra juegos")}</h3>
              <p>{t("article3Desc", "Usa el buscador en tiempo real para encontrar juegos por nombre. También puedes filtrar por categoría: Acción, Idle, Multiplayer, Clásicos o herramientas. El contador de resultados te muestra cuántos juegos coinciden.")}</p>
            </article>
          </div>
        </section>
      </main>
      <Footer />
      <ChangelogModal />
    </div>
  );
}
