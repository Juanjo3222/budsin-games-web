import { useI18n } from "../../context/I18nContext";
import { usePro } from "../../context/ProContext";
import { useLibrary } from "../../context/LibraryContext";
import { useToast } from "../../context/ToastContext";
import MiniShelf from "../MiniShelf";

export default function CollectionsPanel() {
  const { t } = useI18n();
  const { isPro } = usePro();
  const { collections, createCollection, renameCollection, deleteCollection } = useLibrary();
  const { showToast } = useToast();

  if (collections.length === 0) return null;

  const share = (name) => {
    if (!isPro) {
      showToast(t("shareCollectionProOnly", "Solo Pro puede compartir colecciones"), true);
      return;
    }
    const col = collections.find((c) => c.name === name);
    if (!col) return;
    const data = JSON.stringify({ type: "budsin_collection", name: col.name, items: col.items });
    const url = window.location.origin + "/?shared_collection=" + btoa(encodeURIComponent(data));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => showToast("🔗 Link copiado!", false));
    } else {
      showToast(url, false);
    }
  };

  const create = () => {
    const name = window.prompt(t("collectionsCreatePrompt", "Nombre de la nueva colección:"));
    const res = createCollection(name);
    if (res.limited) showToast(t("collectionsLimitReached", "Límite de colecciones alcanzado (2). Hazte Pro para ilimitadas."), true);
    else if (res.error === "DUPLICATE") showToast(t("collectionsCreateDuplicate", "Ya existe una colección con ese nombre."), true);
  };

  const rename = (col) => {
    const next = window.prompt(t("collectionsRenamePrompt", "Nuevo nombre para la colección:"), col.name);
    if (next) renameCollection(col.name, next);
  };

  const remove = (col) => {
    if (window.confirm(t("collectionsDeleteConfirm", "¿Eliminar colección") + " '" + col.name + "'?")) deleteCollection(col.name);
  };

  return (
    <section className="shelf glass">
      <div className="shelf-head">
        <h3 className="shelf-title">📁 {t("shelfCollections", "Mis colecciones")}</h3>
        <button type="button" className="btn create-collection-btn" onClick={create}>
          ＋ {t("collectionsCreate", "Nueva colección")}
        </button>
      </div>
      {collections.map((col) => (
        <div className="collection-shelf" key={col.name}>
          <div className="collection-head">
            <strong className="collection-name">📁 {col.name}</strong>
            <div className="collection-actions">
              <button type="button" className="collection-action-btn" title={t("collectionsShare", "Compartir")} onClick={() => share(col.name)}>🔗</button>
              <button type="button" className="collection-action-btn" title={t("collectionsRename", "Renombrar")} onClick={() => rename(col)}>✏️</button>
              <button type="button" className="collection-action-btn" title={t("collectionsDelete", "Eliminar")} onClick={() => remove(col)}>🗑️</button>
            </div>
          </div>
          <MiniShelf hrefs={col.items} emptyText={t("collectionsEmpty", "Tus colecciones aparecerán aquí. Crea una y añade juegos desde cada tarjeta.")} />
        </div>
      ))}
    </section>
  );
}
