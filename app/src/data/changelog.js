// Novedades que se muestran una sola vez por versión (o la primera vez que se entra al sitio).
// Cada punto es una lista de partes: texto suelto o un enlace { href, label }.
export const SITE_VERSION = "7.5";

const VERSION_KEY = "juanjos_games_seen_version";

const COPY = {
  es: {
    title: "Novedades de Budsin Games",
    desc: "Este popup solo aparece una vez por versión o la primera vez que entras al sitio.",
    items: [
      ["Budsin Music: escucha música en el navegador, con letras, ecualizador, radios para jugar y Jam para escuchar con otras personas. ", { href: "/musica/", label: "Abrir Budsin Music" }],
      ["Budsin Chat: chat en tiempo real para cuentas de colegio o universidad, con una sala por juego, grupos de clase y mensajes entre amigos. ", { href: "/chat/", label: "Abrir Budsin Chat" }],
      ["Comparte lo que escuchas: desde Budsin Music puedes mandar una canción a Budsin Chat y la música sigue sonando ahí."],
      ["Juego nuevo: That's Not My Neighbor. Eres el portero de un edificio en 1955 y tienes que descubrir a los dobles. ", { href: "/thats-not-my-neighbor/", label: "Jugar ahora" }],
      ["Dos ports nuevos: ", { href: "/meccha-chameleon/index.html", label: "Meccha Chameleon" }, " (escondite multijugador donde te pintas para camuflarte) y ", { href: "/the-stanley-parable-ultra-deluxe/index.html", label: "The Stanley Parable: Ultra Deluxe" }, " (una aventura con narrador)."],
    ],
  },
  en: {
    title: "What's new in Budsin Games",
    desc: "This popup only appears once per version or the first time you visit the site.",
    items: [
      ["Budsin Music: listen to music in your browser, with lyrics, an equalizer, radios to play to and Jam to listen together. ", { href: "/musica/", label: "Open Budsin Music" }],
      ["Budsin Chat: real-time chat for school or university accounts, with a room for each game, class groups and messages between friends. ", { href: "/chat/", label: "Open Budsin Chat" }],
      ["Share what you listen to: from Budsin Music you can send a song to Budsin Chat and the music keeps playing there."],
      ["New game: That's Not My Neighbor. You are the doorman of a building in 1955 and must spot the doppelgangers. ", { href: "/thats-not-my-neighbor/", label: "Play now" }],
      ["Two new ports: ", { href: "/meccha-chameleon/index.html", label: "Meccha Chameleon" }, " (multiplayer hide-and-seek where you paint yourself to blend in) and ", { href: "/the-stanley-parable-ultra-deluxe/index.html", label: "The Stanley Parable: Ultra Deluxe" }, " (a narrated adventure)."],
    ],
  },
  pt: {
    title: "Novidades do Budsin Games",
    desc: "Este pop-up aparece apenas uma vez por versão ou na primeira vez que você entra no site.",
    items: [
      ["Budsin Music: ouça música no navegador, com letras, equalizador, rádios para jogar e Jam para ouvir junto com outras pessoas. ", { href: "/musica/", label: "Abrir o Budsin Music" }],
      ["Budsin Chat: chat em tempo real para contas de escola ou universidade, com uma sala por jogo, turmas e mensagens entre amigos. ", { href: "/chat/", label: "Abrir o Budsin Chat" }],
      ["Compartilhe o que você ouve: do Budsin Music você pode enviar uma música para o Budsin Chat e a música continua tocando lá."],
      ["Jogo novo: That's Not My Neighbor. Você é o porteiro de um prédio em 1955 e precisa descobrir os sósias. ", { href: "/thats-not-my-neighbor/", label: "Jogar agora" }],
      ["Dois ports novos: ", { href: "/meccha-chameleon/index.html", label: "Meccha Chameleon" }, " (esconde-esconde multijogador em que você se pinta para se camuflar) e ", { href: "/the-stanley-parable-ultra-deluxe/index.html", label: "The Stanley Parable: Ultra Deluxe" }, " (uma aventura com narrador)."],
    ],
  },
};

export function changelogForLang(lang) {
  return COPY[lang] || COPY.es;
}

export function shouldShowChangelog() {
  try {
    return localStorage.getItem(VERSION_KEY) !== SITE_VERSION;
  } catch (e) {
    return true;
  }
}

export function markChangelogSeen() {
  try {
    localStorage.setItem(VERSION_KEY, SITE_VERSION);
  } catch (e) {}
}
