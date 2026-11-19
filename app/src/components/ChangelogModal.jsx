import { useEffect, useState } from "react";
import { useI18n } from "../context/I18nContext";
import { changelogForLang, shouldShowChangelog, markChangelogSeen, SITE_VERSION } from "../data/changelog";

const CLOSE_DELAY = 3000;

export default function ChangelogModal() {
  const { lang } = useI18n();
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [remaining, setRemaining] = useState(CLOSE_DELAY);

  useEffect(() => {
    if (!shouldShowChangelog()) return;
    setVisible(true);
    const start = performance.now();
    let frame = 0;
    const tick = () => {
      const left = Math.max(0, CLOSE_DELAY - (performance.now() - start));
      setRemaining(left);
      if (left > 0) frame = requestAnimationFrame(tick);
      else setReady(true);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!visible) return null;
  const content = changelogForLang(lang);

  const close = () => {
    markChangelogSeen();
    setVisible(false);
  };

  return (
    <div className="modal-overlay is-visible" onClick={ready ? close : undefined}>
      <div className="changelog-card" role="dialog" aria-modal="true" aria-label={content.title} onClick={(e) => e.stopPropagation()}>
        <div className="changelog-close-wrap">
          <button type="button" className="changelog-close" onClick={close} disabled={!ready} aria-label="Cerrar">
            ×
          </button>
          <span className={`changelog-countdown ${ready ? "is-done" : ""}`}>{ready ? "" : `${(remaining / 1000).toFixed(1)}s`}</span>
        </div>
        <span>Version {SITE_VERSION}</span>
        <h2>{content.title}</h2>
        <p>{content.desc}</p>
        <ul className="changelog-list">
          {content.items.map((parts, i) => (
            <li key={i}>
              {parts.map((part, j) =>
                typeof part === "string" ? (
                  <span key={j}>{part}</span>
                ) : (
                  <a key={j} href={part.href} className="changelog-link" onClick={markChangelogSeen}>
                    {part.label}
                  </a>
                )
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
