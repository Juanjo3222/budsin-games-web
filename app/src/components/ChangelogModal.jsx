import { useEffect, useState } from "react";
import { useI18n } from "../context/I18nContext";
import { changelogForLang, shouldShowChangelog, markChangelogSeen, SITE_VERSION } from "../data/changelog";

const CLOSE_DELAY = 5000;

export default function ChangelogModal() {
  const { lang, t } = useI18n();
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
    <div className="modal-overlay is-visible" onClick={ready ? close : undefined}>
      <div className="sunset-card" role="alert" aria-live="assertive" onClick={(e) => e.stopPropagation()}>
        <div className="sunset-icon-wrap">
          <span className="sunset-icon">📢</span>
        </div>
        <span className="sunset-badge">{t("sunsetNotice")}</span>
        <h2>{content.title}</h2>
        <p>{content.desc}</p>
        <ul className="sunset-list">
          {content.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <div className="sunset-actions">
          <button
            type="button"
            className="btn sunset-dismiss"
            onClick={close}
            disabled={!ready}
          >
            {ready ? t("sunsetGotIt") : `${(remaining / 1000).toFixed(1)}s`}
          </button>
        </div>
      </div>
    </div>
  );
}
