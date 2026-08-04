import { GAMES } from "../data/games";

function byHref(href) {
  return GAMES.find((g) => g.href === href);
}

export default function MiniShelf({ title, hrefs, onRemove, emptyText, onShare, isCollection }) {
  const games = hrefs.map(byHref).filter(Boolean);

  const go = (game) => {
    if (game) window.location.href = game.href;
  };

  return (
    <section className="shelf glass">
      <div className="shelf-head">
        <h3 className="shelf-title">{title}</h3>
        {onShare && <button type="button" className="shelf-share-btn" onClick={onShare}>🔗</button>}
      </div>
      {games.length === 0 ? (
        <p className="shelf-empty">{emptyText}</p>
      ) : (
        <div className="shelf-row">
          {games.map((g) => (
            <div key={g.href} className="recent-mini" onClick={() => go(g)}>
              {g.cover ? <img src={g.cover} alt={g.title} loading="lazy" /> : <span className="recent-mini-emoji">💬</span>}
              <span className="recent-mini-name">{g.title}</span>
              {onRemove && (
                <button
                  type="button"
                  className="recent-mini-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(g.href);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
