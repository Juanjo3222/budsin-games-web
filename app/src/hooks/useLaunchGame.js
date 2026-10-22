import { useCallback } from "react";
import { usePro } from "../context/ProContext";
import { useGating } from "../context/GatingContext";
import { incrementRemotePopularity } from "../lib/firebase";
import { isProLocked } from "../lib/format";
import { cacheGameForOffline } from "../lib/sw";

/**
 * Devuelve `launch(game)`: respeta el gating Pro (popup para juegos anticipados)
 * y, si el juego es jugable, delega en `onPlay` o navega directamente.
 */
export function useLaunchGame(onPlay) {
  const { isPro } = usePro();
  const { maybeGate } = useGating();

  return useCallback(
    (game) => {
      if (isProLocked(game, isPro)) {
        incrementRemotePopularity(game.href, game.title, 1);
        maybeGate(game);
        return;
      }
      if (onPlay) {
        onPlay(game);
        return;
      }
      incrementRemotePopularity(game.href, game.title, 1);
      if (isPro) cacheGameForOffline(game.href);
      window.location.href = game.href;
    },
    [isPro, maybeGate, onPlay]
  );
}
