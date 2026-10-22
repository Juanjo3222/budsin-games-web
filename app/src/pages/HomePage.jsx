import { useEffect, useState, useCallback } from "react";
import { GAMES } from "../data/games";
import Topbar from "../components/Topbar";
import Footer from "../components/Footer";
import ConsoleHome from "../components/console/ConsoleHome";
import LibrarySection from "../components/home/LibrarySection";
import { useI18n } from "../context/I18nContext";
import { useLibrary } from "../context/LibraryContext";
import { useToast } from "../context/ToastContext";
import { subscribePopularity } from "../lib/firebase";
import { useAnimatedLaunch } from "../hooks/useAnimatedLaunch";
import { playGame } from "../lib/play";

/**
 * Muestra bajo la consola el buscador, la cuadrícula completa, los artículos y el pie.
 * En `false` la portada es solo la consola (los enlaces legales pasan a su pie).
 */
const SHOW_LIBRARY = false;

export default function HomePage() {
  const { t } = useI18n();
  const { favorites, recently, addRecent, importSharedCollection } = useLibrary();
  const { showToast } = useToast();
  const [popularity, setPopularity] = useState({});

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

  const onPlay = useCallback((game) => playGame(game, addRecent), [addRecent]);
  const launch = useAnimatedLaunch(onPlay);

  const randomGame = useCallback(
    (origin) => {
      launch(GAMES[Math.floor(Math.random() * GAMES.length)], origin);
    },
    [launch]
  );

  return (
    <div className="site-shell">
      <Topbar />
      <main className="page-main">
        <h1 className="sr-only">{t("heroTitle", "Budsin Games")}</h1>
        <ConsoleHome
          popularity={popularity}
          favorites={favorites}
          recently={recently}
          onLaunch={launch}
          onRandom={randomGame}
          hasLibrary={SHOW_LIBRARY}
        />
        {SHOW_LIBRARY && <LibrarySection popularity={popularity} onPlay={onPlay} />}
      </main>
      {SHOW_LIBRARY && <Footer />}
    </div>
  );
}
