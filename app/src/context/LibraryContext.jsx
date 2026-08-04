import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { usePro } from "./ProContext";

const LibraryContext = createContext(null);

const FAVORITES_KEY = "budsin_favorites";
const RECENTLY_KEY = "budsin_recently_played";
const COLLECTIONS_KEY = "budsin_collections";
const RECENTLY_MAX = 5;
const COLLECTIONS_LIMIT_FREE = 2;

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

export function LibraryProvider({ children }) {
  const { isPro, favoritesLimit } = usePro();
  const [favorites, setFavorites] = useState(() => readJson(FAVORITES_KEY, []));
  const [recently, setRecently] = useState(() => readJson(RECENTLY_KEY, []));
  const [collections, setCollections] = useState(() => readJson(COLLECTIONS_KEY, []));

  const collectionsLimit = useMemo(() => (isPro ? Infinity : COLLECTIONS_LIMIT_FREE), [isPro]);

  useEffect(() => writeJson(FAVORITES_KEY, favorites), [favorites]);
  useEffect(() => writeJson(RECENTLY_KEY, recently), [recently]);
  useEffect(() => writeJson(COLLECTIONS_KEY, collections), [collections]);

  const isFavorite = useCallback((href) => favorites.includes(href), [favorites]);

  const toggleFavorite = useCallback(
    (href) => {
      let next;
      if (favorites.includes(href)) {
        next = favorites.filter((f) => f !== href);
      } else {
        if (favorites.length >= favoritesLimit) return { limited: true };
        next = [...favorites, href];
      }
      setFavorites(next);
      return { limited: false };
    },
    [favorites, favoritesLimit]
  );

  const addRecent = useCallback((href) => {
    setRecently((prev) => {
      const next = [href, ...prev.filter((h) => h !== href)];
      return next.slice(0, RECENTLY_MAX);
    });
  }, []);

  const createCollection = useCallback(
    (name) => {
      const trimmed = (name || "").trim();
      if (!trimmed) return { error: "EMPTY" };
      if (collections.some((c) => c.name === trimmed)) return { error: "DUPLICATE" };
      if (collections.length >= collectionsLimit) return { limited: true };
      setCollections((prev) => [...prev, { name: trimmed, items: [] }]);
      return { ok: true };
    },
    [collections, collectionsLimit]
  );

  const addToCollection = useCallback((name, href) => {
    setCollections((prev) =>
      prev.map((c) =>
        c.name === name && !c.items.includes(href)
          ? { ...c, items: [...c.items, href] }
          : c
      )
    );
  }, []);

  const removeFromCollection = useCallback((name, href) => {
    setCollections((prev) =>
      prev.map((c) =>
        c.name === name ? { ...c, items: c.items.filter((h) => h !== href) } : c
      )
    );
  }, []);

  const renameCollection = useCallback((oldName, newName) => {
    setCollections((prev) => prev.map((c) => (c.name === oldName ? { ...c, name: newName } : c)));
  }, []);

  const deleteCollection = useCallback((name) => {
    setCollections((prev) => prev.filter((c) => c.name !== name));
  }, []);

  const importSharedCollection = useCallback((encoded) => {
    try {
      const json = decodeURIComponent(atob(encoded));
      const data = JSON.parse(json);
      if (data && data.type === "budsin_collection" && data.name && Array.isArray(data.items)) {
        setCollections((prev) => {
          if (prev.some((c) => c.name === data.name)) return prev;
          return [...prev, { name: data.name, items: data.items }];
        });
        return data;
      }
      return null;
    } catch (e) {
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({
      favorites,
      recently,
      collections,
      isFavorite,
      toggleFavorite,
      addRecent,
      collectionsLimit,
      createCollection,
      addToCollection,
      removeFromCollection,
      renameCollection,
      deleteCollection,
      importSharedCollection,
    }),
    [favorites, recently, collections, isFavorite, toggleFavorite, addRecent, collectionsLimit, createCollection, addToCollection, removeFromCollection, renameCollection, deleteCollection, importSharedCollection]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
