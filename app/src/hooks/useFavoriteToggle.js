import { useCallback } from "react";
import { useI18n } from "../context/I18nContext";
import { useLibrary } from "../context/LibraryContext";
import { useToast } from "../context/ToastContext";

/** Devuelve `toggle(game)`: alterna el favorito y avisa del límite Free o de que se guardó. */
export function useFavoriteToggle() {
  const { t } = useI18n();
  const { toggleFavorite, isFavorite } = useLibrary();
  const { showToast } = useToast();

  return useCallback(
    (game) => {
      const wasFavorite = isFavorite(game.href);
      const res = toggleFavorite(game.href);
      if (res.limited) {
        showToast(t("favLimitReached", "Límite de favoritos alcanzado (20). Hazte Pro para ilimitados."), true);
        return;
      }
      if (!wasFavorite) showToast("⭐ " + game.title, false, 1500);
    },
    [isFavorite, toggleFavorite, showToast, t]
  );
}
