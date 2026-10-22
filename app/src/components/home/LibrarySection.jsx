import { useCallback, useMemo, useState } from "react";
import { GAMES } from "../../data/games";
import GameCard from "../GameCard";
import MiniShelf from "../MiniShelf";
import AdsSlot from "../AdsSlot";
import SearchBar from "./SearchBar";
import FilterBar from "./FilterBar";
import CollectionsPanel from "./CollectionsPanel";
import ArticlesSection from "./ArticlesSection";
import { useI18n } from "../../context/I18nContext";
import { useLibrary } from "../../context/LibraryContext";
import { useAnimatedLaunch } from "../../hooks/useAnimatedLaunch";
import { readJson, writeJson } from "../../lib/storage";

const SEARCH_HISTORY_KEY = "budsin_search_history";
const SEARCH_HISTORY_MAX = 8;

const CATEGORIES = ["Todos", ...new Set(GAMES.map((g) => g.category.es))];

/**
 * Todo lo que va debajo de la consola: buscador y filtros, estantes, colecciones,
 * cuadrícula completa, anuncio y artículos.
 */
export default function LibrarySection({ popularity, onPlay }) {
  const { lang, t } = useI18n();
  const { favorites, recently, toggleFavorite } = useLibrary();
  const launch = useAnimatedLaunch(onPlay);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [sort, setSort] = useState("popular");
  const [searchHistory, setSearchHistory] = useState(() => readJson(SEARCH_HISTORY_KEY, []));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = GAMES.filter((g) => {
      if (category !== "Todos" && g.category.es !== category) return false;
      if (q && !(g.title + " " + g.name).toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === "alphabetical") {
      list = list.slice().sort((a, b) => a.title.localeCompare(b.title, lang));
    } else if (sort === "newest") {
      list = list.slice().sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    } else if (sort === "popular") {
      list = list.slice().sort((a, b) => (Number(popularity[b.href]) || 0) - (Number(popularity[a.href]) || 0));
    }
    return list;
  }, [query, category, sort, popularity, lang]);

  const pushHistory = useCallback((value) => {
    const q = value.trim();
    if (!q) return;
    setSearchHistory((prev) => {
      const next = [q, ...prev.filter((h) => h !== q)].slice(0, SEARCH_HISTORY_MAX);
      writeJson(SEARCH_HISTORY_KEY, next);
      return next;
    });
  }, []);

  const removeHistory = useCallback((value) => {
    setSearchHistory((prev) => {
      const next = prev.filter((h) => h !== value);
      writeJson(SEARCH_HISTORY_KEY, next);
      return next;
    });
  }, []);

  const randomGame = useCallback(
    (origin) => {
      launch(GAMES[Math.floor(Math.random() * GAMES.length)], origin);
    },
    [launch]
  );

  return (
    <>
      <section className="search-section" id="browse">
        <SearchBar
          query={query}
          setQuery={setQuery}
          onSubmitQuery={pushHistory}
          history={searchHistory}
          onRemoveHistory={removeHistory}
          onRandom={randomGame}
        />
        <FilterBar
          categories={CATEGORIES}
          category={category}
          setCategory={setCategory}
          count={filtered.length}
          sort={sort}
          setSort={setSort}
        />
      </section>

      {favorites.length > 0 && (
        <MiniShelf
          title={t("shelfFavorites", "🎮 Tus juegos")}
          hrefs={favorites}
          onRemove={toggleFavorite}
          emptyText={t("noFavorites", "Aún no tienes favoritos.")}
        />
      )}
      {recently.length > 0 && (
        <MiniShelf title={t("shelfRecent", "🕐 Jugado recientemente")} hrefs={recently} emptyText={t("noRecent", "Aún no has jugado nada.")} />
      )}

      <CollectionsPanel />

      <section className="library-section" id="library">
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

      <ArticlesSection />
    </>
  );
}
