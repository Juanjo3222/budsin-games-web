import { useI18n } from "../../context/I18nContext";

export default function FilterBar({ categories, category, setCategory, count, sort, setSort }) {
  const { t } = useI18n();

  return (
    <>
      <div className="chips" id="categoryFilters" aria-label={t("categoriesLabel", "Categorías")}>
        {categories.map((c) => (
          <button key={c} type="button" className={`chip ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>
            {c === "Todos" ? t("chipAll", "Todos") : c}
          </button>
        ))}
      </div>
      <div className="results-row">
        <span className="results-count">{t("resultsCount", (n) => `${n} juegos`)(count)}</span>
        <label className="sort-label">
          {t("sortLabel", "Ordenar:")}
          <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="popular">{t("sortPopular", "Más jugados")}</option>
            <option value="alphabetical">{t("sortAlphabetical", "A-Z")}</option>
            <option value="newest">{t("sortNewest", "Más nuevos")}</option>
          </select>
        </label>
      </div>
    </>
  );
}
