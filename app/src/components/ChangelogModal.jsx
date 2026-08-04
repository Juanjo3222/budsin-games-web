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
    const tick = () => {
      const left = Math.max(0, CLOSE_DELAY - (performance.now() - start));
      setRemaining(left);
      if (left > 0) {
        requestAnimationFrame(tick);
      } else {
        setReady(true);
      }
    };
    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!visible) return null;
  const content = changelogForLang(lang);

  const close = () => {
    markChangelogSeen();
    setVisible(false);
  };

  return (
    <div className="modal-overlay is-visible">
      <div className="changelog-card" role="status" aria-live="polite">
        <div className="changelog-close-wrap">
          <button
            type="button"
            className="changelog-close"
            onClick={close}
            disabled={!ready}
            aria-label="Cerrar notificación"
          >
            ×
          </button>
          <span className={`changelog-countdown ${ready ? "is-done" : ""}`}>
            {(remaining / 1000).toFixed(3)}s
          </span>
        </div>
        <span>Version {SITE_VERSION}</span>
        <h2>{content.title}</h2>
        <p>{content.desc}</p>
        <ul className="changelog-list">
          {content.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
