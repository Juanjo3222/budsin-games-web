import { incrementRemotePopularity } from "./firebase";

/** Cuenta la visita, la añade a "jugado recientemente" y navega al juego. */
export function playGame(game, addRecent) {
  incrementRemotePopularity(game.href, game.title, 1);
  addRecent(game.href);
  window.location.href = game.href;
}
