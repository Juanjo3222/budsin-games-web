import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../context/I18nContext";

/**
 * Buscador con historial desplegable y botón de juego al azar.
 * `onSubmitQuery` recibe cada cambio para guardarlo en el historial.
 */
export default function SearchBar({ query, setQuery, onSubmitQuery, history, onRemoveHistory, onRandom }) {
  const { t } = useI18n();
  const [showHistory, setShowHistory] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowHistory(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const onInput = (e) => {
    setQuery(e.target.value);
    onSubmitQuery(e.target.value);
  };

  const pickHistory = (value) => {
    setQuery(value);
    setShowHistory(false);
  };

  return (
    <div className="search-row">
      <div className="search-wrap glass" ref={wrapRef}>
        <span className="search-icon">🔍</span>
        <input
          type="search"
          className="search-input"
          placeholder={t("searchPlaceholder", "Buscar juego por nombre...")}
          value={query}
          onChange={onInput}
          onFocus={() => setShowHistory(true)}
        />
        {query && (
          <button type="button" className="search-clear" onClick={() => setQuery("")}>×</button>
        )}
        {showHistory && history.length > 0 && (
          <div className="search-history">
            <div className="search-history-title">{t("searchHistoryTitle", "Búsquedas recientes")}</div>
            {history.map((h) => (
              <div key={h} className="search-history-item" onClick={() => pickHistory(h)}>
                <span>🕐 {h}</span>
                <button
                  type="button"
                  className="remove-search"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveHistory(h);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <button type="button" className="btn random-btn" onClick={(e) => onRandom(e.currentTarget)}>🎲 {t("randomGame", "Juego al azar")}</button>
    </div>
  );
}
