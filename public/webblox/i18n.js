// Textos de WebBlox (es / en / pt), con el mismo idioma que el portal (localStorage "budsin_language").
const D = {
  es: {
    title: "WebBlox", sub: "Roblox en tu navegador, sin instalar nada.",
    search: "Buscar un juego…", searchBtn: "Buscar", paste: "Pega el enlace de un juego de Roblox", pasteBtn: "Abrir",
    play: "Jugar", noresults: "No se encontraron juegos.", searching: "Buscando…", neterr: "No se pudo conectar con Roblox. Inténtalo de nuevo.",
    signedin: "Sesión de Roblox detectada", signedout: "Aún no has iniciado sesión en Roblox",
    signin: "Iniciar sesión en Roblox", signinHelp: "Se abre el navegador integrado de Budsin. Inicia sesión allí (código por correo) y vuelve a esta página.",
    recheck: "Ya inicié sesión", badlink: "No reconozco ese enlace. Debe contener el número del juego (placeId).",
    needSession: "Necesitas iniciar sesión en Roblox para jugar.", needSessionBtn: "Ir a iniciar sesión",
    unsupported: "Tu navegador no puede ejecutar WebBlox.", needIso: "Falta el aislamiento entre orígenes (COOP/COEP). Recarga la página; si sigue igual, usa Chrome o Firefox actualizados.",
    needSW: "Tu navegador no admite service workers (¿modo privado?).", needWT: "Tu navegador no admite WebTransport, que Roblox necesita para jugar.",
    connecting: "Conectando con Roblox…", starting: "Iniciando…", back: "Volver a WebBlox", notice: "WebBlox usa el cliente web oficial de Roblox. No está afiliado ni respaldado por Roblox Corporation.",
    privacy: "Tu sesión de Roblox se queda en este navegador: Budsin no la recibe ni la guarda.",
    friend: "Unirse a un amigo", friendPh: "Nombre de usuario del amigo", friendBtn: "Buscar", friendNone: "Ese amigo no está jugando ahora mismo.",
  },
  en: {
    title: "WebBlox", sub: "Roblox in your browser, nothing to install.",
    search: "Search for a game…", searchBtn: "Search", paste: "Paste a Roblox game link", pasteBtn: "Open",
    play: "Play", noresults: "No games found.", searching: "Searching…", neterr: "Couldn't reach Roblox. Try again.",
    signedin: "Roblox session detected", signedout: "You haven't signed in to Roblox yet",
    signin: "Sign in to Roblox", signinHelp: "Opens Budsin's built-in browser. Sign in there (email code) and come back to this page.",
    recheck: "I signed in", badlink: "I don't recognize that link. It must contain the game number (placeId).",
    needSession: "You need to sign in to Roblox to play.", needSessionBtn: "Go to sign in",
    unsupported: "Your browser can't run WebBlox.", needIso: "Cross-origin isolation (COOP/COEP) is missing. Reload the page; if it persists, use an up-to-date Chrome or Firefox.",
    needSW: "Your browser doesn't support service workers (private mode?).", needWT: "Your browser doesn't support WebTransport, which Roblox needs to play.",
    connecting: "Connecting to Roblox…", starting: "Starting…", back: "Back to WebBlox", notice: "WebBlox uses Roblox's official web client. It is not affiliated with or endorsed by Roblox Corporation.",
    privacy: "Your Roblox session stays in this browser: Budsin neither receives nor stores it.",
    friend: "Join a friend", friendPh: "Friend's username", friendBtn: "Find", friendNone: "That friend isn't playing right now.",
  },
  pt: {
    title: "WebBlox", sub: "Roblox no seu navegador, sem instalar nada.",
    search: "Buscar um jogo…", searchBtn: "Buscar", paste: "Cole o link de um jogo do Roblox", pasteBtn: "Abrir",
    play: "Jogar", noresults: "Nenhum jogo encontrado.", searching: "Buscando…", neterr: "Não foi possível conectar ao Roblox. Tente novamente.",
    signedin: "Sessão do Roblox detectada", signedout: "Você ainda não entrou no Roblox",
    signin: "Entrar no Roblox", signinHelp: "Abre o navegador integrado da Budsin. Entre lá (código por e-mail) e volte a esta página.",
    recheck: "Já entrei", badlink: "Não reconheço esse link. Ele deve conter o número do jogo (placeId).",
    needSession: "Você precisa entrar no Roblox para jogar.", needSessionBtn: "Ir para o login",
    unsupported: "Seu navegador não consegue executar o WebBlox.", needIso: "Falta o isolamento entre origens (COOP/COEP). Recarregue a página; se persistir, use um Chrome ou Firefox atualizado.",
    needSW: "Seu navegador não suporta service workers (modo privado?).", needWT: "Seu navegador não suporta WebTransport, que o Roblox precisa para jogar.",
    connecting: "Conectando ao Roblox…", starting: "Iniciando…", back: "Voltar ao WebBlox", notice: "O WebBlox usa o cliente web oficial do Roblox. Não é afiliado nem endossado pela Roblox Corporation.",
    privacy: "Sua sessão do Roblox fica neste navegador: a Budsin não a recebe nem a guarda.",
    friend: "Entrar com um amigo", friendPh: "Nome de usuário do amigo", friendBtn: "Buscar", friendNone: "Esse amigo não está jogando agora.",
  },
};
export function lang() {
  let l = "";
  try { l = localStorage.getItem("budsin_language") || ""; } catch {}
  l = (l || navigator.language || "es").slice(0, 2).toLowerCase();
  return D[l] ? l : "en";
}
export const t = (k) => D[lang()][k] ?? D.en[k] ?? k;
export function apply(root = document) {
  document.documentElement.lang = lang();
  root.querySelectorAll("[data-t]").forEach((el) => (el.textContent = t(el.dataset.t)));
  root.querySelectorAll("[data-t-ph]").forEach((el) => (el.placeholder = t(el.dataset.tPh)));
}
