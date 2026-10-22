import { useCallback } from "react";
import { usePro } from "../context/ProContext";
import { usePageTransition } from "../context/TransitionContext";
import { isProLocked } from "../lib/format";
import { useLaunchGame } from "./useLaunchGame";

/**
 * Como `useLaunchGame`, pero con la transición de consola desde `origin`.
 * Los juegos bloqueados por Pro abren su popup sin transición.
 */
export function useAnimatedLaunch(onPlay) {
  const { isPro } = usePro();
  const launch = useLaunchGame(onPlay);
  const { run } = usePageTransition();

  return useCallback(
    (game, origin) => {
      if (isProLocked(game, isPro)) {
        launch(game);
        return;
      }
      run(origin, () => launch(game), { settle: "page" });
    },
    [isPro, launch, run]
  );
}
