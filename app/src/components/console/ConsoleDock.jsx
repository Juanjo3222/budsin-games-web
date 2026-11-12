import { useI18n } from "../../context/I18nContext";
import { usePro } from "../../context/ProContext";

const ITEMS = [
  { id: "all", icon: "🎮", key: "consoleDockAll", fallback: "Inicio", source: true },
  { id: "favorites", icon: "⭐", key: "consoleDockFavorites", fallback: "Favoritos", source: true },
  { id: "recent", icon: "🕐", key: "consoleDockRecent", fallback: "Recientes", source: true },
  { id: "random", icon: "🎲", key: "consoleDockRandom", fallback: "Al azar" },
  { id: "search", icon: "🔍", key: "consoleDockSearch", fallback: "Buscar" },
  { id: "grid", icon: "▦", key: "consoleDockGrid", fallback: "Ver todos" },
  { id: "settings", icon: "⚙️", key: "consoleDockSettings", fallback: "Ajustes" },
  { id: "pro", icon: "⭐", key: "consoleDockPro", fallback: "Pro", cta: true },
  { id: "donate", icon: "💛", key: "consoleDockDonate", fallback: "Donar", cta: true },
];

/** Dock de botones redondos. Los de tipo `source` cambian lo que muestra la fila. */
export default function ConsoleDock({ source, onSource, actions, hasLibrary, searching }) {
  const { t } = useI18n();
  const { isPro } = usePro();

  return (
    <nav className="console-dock" aria-label="Menú">
      {ITEMS.filter((item) => (item.id !== "grid" || hasLibrary) && !(item.id === "pro" && isPro)).map((item) => {
        const label = t(item.key, item.fallback);
        const active = item.source ? source === item.id : item.id === "search" && searching;
        return (
          <button
            key={item.id}
            type="button"
            className={`console-dock-btn ${item.cta ? `console-dock-cta is-${item.id}` : ""} ${active ? "is-active" : ""}`}
            title={label}
            aria-label={label}
            aria-pressed={item.source || item.id === "search" ? active : undefined}
            onClick={(e) => (item.source ? onSource(item.id) : actions[item.id](e.currentTarget))}
          >
            {item.icon}
            {item.cta && <span className="console-dock-cta-label">{label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
