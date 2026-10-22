import { useEffect, useMemo, useState, useCallback } from "react";
import { GAMES } from "../data/games";
import GameCard from "../components/GameCard";
import MiniShelf from "../components/MiniShelf";
import AdsSlot from "../components/AdsSlot";
import Topbar from "../components/Topbar";
import Footer from "../components/Footer";
import HeroSection from "../components/home/HeroSection";
import SearchBar from "../components/home/SearchBar";
import FilterBar from "../components/home/FilterBar";
import CollectionsPanel from "../components/home/CollectionsPanel";
import ArticlesSection from "../components/home/ArticlesSection";
import { useI18n } from "../context/I18nContext";
import { useLibrary } from "../context/LibraryContext";
import { useToast } from "../context/ToastContext";
import { subscribePopularity } from "../lib/firebase";
import { playGame } from "../lib/play";
import { readJson, writeJson } from "../lib/storage";

const SEARCH_HISTORY_KEY = "budsin_search_history";
const SEARCH_HISTORY_MAX = 8;

const CATEGORIES = ["Todos", ...new Set(GAMES.map((g) => g.category.es))];

export default function HomePage() {
  const { lang, t } = useI18n();
  const { favorites, recently, addRecent, toggleFavorite, importSharedCollection } = useLibrary();
  const { showToast } = useToast();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [sort, setSort] = useState("popular");
  const [popularity, setPopularity] = useState({});
  const [searchHistory, setSearchHistory] = useState(() => readJson(SEARCH_HISTORY_KEY, []));

  useEffect(() => subscribePopularity(setPopularity), []);

  // Importa una colección compartida desde ?shared_collection= y limpia la URL.
  useEffect(() => {
    const shared = new URLSearchParams(window.location.search).get("shared_collection");
    if (!shared) return;
    const data = importSharedCollection(shared);
    if (!data) return;
    showToast("📁 Colección importada: " + data.name, false);
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const randomGame = () => {
    playGame(GAMES[Math.floor(Math.random() * GAMES.length)], addRecent);
  };

  const onPlay = useCallback((game) => playGame(game, addRecent), [addRecent]);

  return (
    <div className="site-shell">
      <Topbar />
      <main className="page-main">
        <HeroSection />

        <section className="search-section">
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

        <ArticlesSection />
      </main>
      <Footer />
    </div>
  );
}
