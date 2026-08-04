import { useI18n } from "../context/I18nContext";
import { usePro } from "../context/ProContext";
import { useLibrary } from "../context/LibraryContext";
import { useToast } from "../context/ToastContext";
import { useGating } from "../context/GatingContext";
import { incrementRemotePopularity } from "../lib/firebase";
import { isReleased } from "../lib/format";
import { cacheGameForOffline } from "../lib/sw";

export default function GameCard({ game, hits = 0, onPlay }) {
  const { lang, t } = useI18n();
  const { isPro } = usePro();
  const { toggleFavorite, isFavorite } = useLibrary();
  const { showToast } = useToast();
  const { maybeGate } = useGating();

  const fav = isFavorite(game.href);
  const released = isReleased(game.proRelease);
  const showProBadge = game.pro && !isPro && !released;

  const handleFav = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const res = toggleFavorite(game.href);
    if (res.limited) {
      showToast(t("favLimitReached", "Límite de favoritos alcanzado (20). Hazte Pro para ilimitados."), true);
      return;
    }
    if (!fav) showToast("⭐ " + game.title, false, 1500);
  };

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (game.pro && !isPro && !released) {
      incrementRemotePopularity(game.href, game.title, 1);
      maybeGate(game);
      return;
    }
    if (onPlay) {
      onPlay(game);
      return;
    }
    incrementRemotePopularity(game.href, game.title, 1);
    if (isPro) cacheGameForOffline(game.href);
    window.location.href = game.href;
  };
  return (
    <a
      className={`game-card ${showProBadge ? "game-card-pro" : ""} ${fav ? "is-fav" : ""}`}
      href={game.href}
      data-name={game.name}
      data-pro={game.pro ? "true" : undefined}
      data-pro-release={game.proRelease || undefined}
      data-new={game.isNew ? "true" : undefined}
      onClick={handleClick}
    >
      <button type="button" className="favorite-btn" aria-label={t("favoriteSaved", "Favorito")} onClick={handleFav}>
        {fav ? "★" : "☆"}
      </button>
      <div className="cover">
        {game.cover ? (
          <img src={game.cover} alt={game.title} loading="lazy" decoding="async" />
        ) : (
          <div className="cover tools-cover-inner">💬</div>
        )}
        {game.isNew && <span className="new-badge">{t("newBadge", "Nuevo")}</span>}
        {showProBadge && <span className="pro-badge">{t("proBadge", "Anticipado para Pro\npróximamente gratis").split("\n")[0]}</span>}
      </div>
      <div className="content">
        <span className="game-label">{game.label[lang] || game.label.es}</span>
        <strong>{game.title}</strong>
        <p>{game.desc[lang] || game.desc.es}</p>
        <div className="meta-row">
          <span className="category-tag">{game.category[lang] || game.category.es}</span>
          <span className="players">🔥 {Number(hits) || 0}</span>
        </div>
      </div>
    </a>
  );
}
