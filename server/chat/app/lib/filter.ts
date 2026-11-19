// Moderación automática de Budsin Chat. El sitio lo usan muchos menores en colegios, así que el filtro es estricto:
// bloquea groserías (ES/EN/PT, también escritas con símbolos, espacios o letras repetidas), enlaces, correos, teléfonos
// y formas de pasar la conversación a otra app. Devuelve un código (el cliente lo traduce) o null si el texto pasa.
// Ningún filtro es perfecto: por eso además hay reportes, borrado y silencio desde /admin.html.

export type Block = "profanity" | "link" | "contact" | "empty";

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g", "@": "a", $: "s", "!": "i", "|": "i", "+": "t" };

/** Letters only, lowercase, no accents, leetspeak undone, repeated letters collapsed ("fuuuck" -> "fuck"). */
export function fold(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()) out += LEET[ch] ?? ch;
  return out.replace(/(.)\1{2,}/g, "$1$1");
}
const squash = (s: string) => fold(s).replace(/[^a-z]/g, "");
const dedouble = (s: string) => s.replace(/(.)\1+/g, "$1");

// Palabras que nunca deben salir. En un texto se buscan como palabra completa (no dentro de otra: «clase» no es «ass»);
// en un nombre de usuario (sin espacios) se buscan también dentro, solo las de 4 letras o más.
const BAD = [
  // español
  "puta", "puto", "putas", "putos", "putita", "mierda", "joder", "jodete", "coño", "cono", "cabron", "cabrona", "pendejo", "pendeja", "verga", "vergas",
  "chingar", "chingada", "chingado", "chingatumadre", "culero", "culera", "marica", "maricon", "mariconazo", "mamon", "mamada", "mamadas", "malparido",
  "malparida", "gonorrea", "hijueputa", "hijoeputa", "hdp", "hp", "ctm", "ctmr", "concha", "conchatumadre", "conchesumadre", "zorra", "zorro", "pija", "polla", "pene", "vagina",
  "follar", "follando", "coger", "cogiendo", "culo", "tetas", "teta", "pete", "pajero", "pajera", "paja", "idiota", "imbecil", "estupido", "estupida", "tarado",
  "tarada", "retrasado", "retrasada", "mongolo", "subnormal", "sexo", "sexual", "porno", "pornografia", "desnuda", "desnudo", "nudes", "violar", "violacion",
  "suicidate", "matate", "mamahuevo", "huevon", "weon", "weona", "hijodeputa", "hijadeputa", "putamadre", "lameculos", "chupapollas", "cagada", "cagar",
  // inglés
  "fuck", "fucking", "fucker", "motherfucker", "shit", "shitty", "bitch", "asshole", "dick", "dickhead", "pussy", "cunt", "whore", "slut", "bastard", "cock",
  "cum", "porn", "porno", "sex", "nude", "rape", "rapist", "nigger", "nigga", "faggot", "fag", "retard", "retarded", "tranny", "kys", "killyourself", "nazi", "hitler",
  "wanker", "twat", "blowjob", "handjob", "boobs", "tits", "penis", "anal", "milf", "hentai", "dildo", "orgasm", "masturbate", "jerkoff",
  // português
  "caralho", "porra", "merda", "foda", "fodase", "foder", "viado", "buceta", "cuzao", "cu", "vadia", "piranha", "punheta", "arrombado", "desgraca", "filhodaputa", "fdp",
];
const BAD_SET = new Set(BAD.map((w) => dedouble(squash(w))));
const BAD_LONG = [...BAD_SET].filter((w) => w.length >= 4);

// Palabras inocentes que contienen una mala: no cuentan al buscar dentro de un nombre de usuario.
const SAFE_INSIDE = ["computadora", "computador", "putamadre", "compute", "reputacion", "disputa", "disputar", "imputar", "computo", "diputado", "peneloppe", "penelope", "scunthorpe", "class", "assassin", "grass", "bass", "mass", "pass", "analisis", "analista", "canal", "analog", "banal", "sexta", "sextante", "sexto", "essex", "middlesex", "cocktail", "peacock", "hancock", "dickens", "pennsylvania", "cucumber", "document", "circuit", "cucu", "cumple", "cumbre", "cumpleanos", "acumular", "accumulate", "cumulative", "pollo", "pollito", "polloloco", "cogito", "escoger", "recoger", "coger"];

function hasBadWord(text: string): boolean {
  const f = fold(text);
  const words = f.split(/[^a-z]+/).filter(Boolean).map(dedouble);
  // plurales: «pendejos», «bitches», «putos»
  if (words.some((w) => BAD_SET.has(w) || BAD_SET.has(w.replace(/s$/, "")) || BAD_SET.has(w.replace(/es$/, "")))) return true;
  // "f u c k", "p.u.t.a": runs of single letters read as one word
  const runs: string[] = [];
  let cur = "";
  for (const t of f.split(/[\s._\-*,;:]+/)) {
    if (t.length === 1) cur += t;
    else {
      if (cur.length >= 3) runs.push(cur);
      cur = "";
    }
  }
  if (cur.length >= 3) runs.push(cur);
  return runs.some((r) => BAD_SET.has(dedouble(r)));
}

const LINK = /(https?:|www\.|ftp:|\b[a-z0-9][a-z0-9-]*\s*(\.|\(dot\)|\[dot\]|\sdot\s|\spunto\s)\s*(com|net|org|io|gg|me|dev|co|ly|tv|xyz|app|link|ru|es|mx|ar|pe|cl|br|us|uk|info|site|online|shop|store|fun|click|top|cc|to|ws|tk|ml|ga|cf|gq)\b|discord\s*\.?\s*gg|\bt\.me\b|\bwa\.me\b|bit\.ly|tinyurl)/i;
const EMAIL = /[\w.+-]+\s*(@|\barroba\b|\(at\)|\[at\])\s*[\w-]+\s*(\.|\bpunto\b|\bdot\b)\s*[a-z]{2,}/i;
const MENTION = /(^|\s)@[\w.]{3,}/;
// Quedar fuera de la plataforma: pedir o dar un contacto en otra app.
const CONTACT_WORDS = /\b(whats\s*app|whatsap|wasap|wsp|telegram|snap\s*chat|snapchat|instagram|insta|messenger|tik\s*tok|tiktok|facebook|face|kik|skype|signal|numero|number|telefono|phone|celular|cel|llamame|call me|texteame|dm me|mi ig|mi insta)\b/i;

function digitsCount(text: string): number {
  // "9 8 7 6 5 4 3 2 1", "987-654-321", "nueve ocho siete…"
  const words: Record<string, string> = { cero: "0", uno: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5", seis: "6", siete: "7", ocho: "8", nueve: "9", zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9" };
  let digits = "";
  for (const tok of text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").split(/[^a-z0-9]+/)) {
    if (/^\d+$/.test(tok)) digits += tok;
    else if (words[tok]) digits += words[tok];
  }
  return digits.length;
}

// ---- enlaces permitidos (lista blanca) ----
// Por defecto NINGÚN enlace pasa. Con una lista de dominios, solo pasan los que apuntan a esos dominios (y a sus subdominios).
// Se comprueba el NOMBRE DE SERVIDOR REAL del enlace, no el texto: «google.com.malo.com», «malogoogle.com» o
// «https://google.com@malo.com» no cuentan como Google. Además se rechazan las redirecciones y proxys conocidos de los
// dominios permitidos (google.com/url?q=…, translate.google.com…), que servirían para llegar a cualquier sitio.
const SCHEME_LINK = /(?<![@\w.-])(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const BARE_LINK = /(?<![@\w.\/-])[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|gg|me|dev|co|ly|tv|xyz|app|link|ru|es|mx|ar|pe|cl|br|us|uk|info|site|online|shop|store|fun|click|top|cc|to|ws|tk|ml|ga|cf|gq|edu|gov|ac)(?:\/[^\s<>"'`]*)?(?![\w@-])/gi;
const PROXY_HOSTS = /^(translate\.google\.com|translate\.goog|webcache\.googleusercontent\.com|cache\.google\.com)$/;
const REDIRECT_PATH = /^\/(url|amp|translate|imgres|aclk|pagead|search\/howsearchworks)(\/|\?|$)/i;

function hostAllowed(host: string, rules: string[]): boolean {
  return rules.some((r) => host === r || host.endsWith("." + r));
}

/** host of a link-like token, or null when it is not a safe, plain, public hostname. */
function linkHost(token: string): { host: string; path: string } | null {
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(token) ? token : "https://" + token); } catch { return null; }
  if (u.username || u.password) return null;                      // https://google.com@malo.com
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!/^[a-z0-9.-]+$/.test(host) || host.split(".").some((l) => !l || l.startsWith("xn--"))) return null;   // IDN: homógrafos
  if (/^\d+(\.\d+){3}$/.test(host) || !host.includes(".")) return null;                                      // IP o nombre interno
  return { host, path: u.pathname + u.search };
}

/** "block" if any link in the text is not allowed; otherwise the text with each allowed link replaced by a neutral word. */
function scrubLinks(t: string, rules: string[]): { text: string; bad: boolean } | "block" {
  const tokens = [...(t.match(SCHEME_LINK) ?? []), ...(t.replace(SCHEME_LINK, " ").match(BARE_LINK) ?? [])];
  if (tokens.length > 2) return "block";                          // máximo 2 enlaces por mensaje
  let text = t, bad = false;
  for (const raw of tokens) {
    const token = raw.replace(/[.,;:!?)\]}]+$/, "");
    const l = linkHost(token);
    if (!l || !hostAllowed(l.host, rules)) return "block";
    if (PROXY_HOSTS.test(l.host) || REDIRECT_PATH.test(l.path)) return "block";
    if (hasBadWord(decodeURIComponent(l.path.replace(/%(?![0-9a-f]{2})/gi, "")).replace(/[/?&=_+.-]+/g, " "))) bad = true;   // «…?q=porno»
    text = text.split(token).join(" enlace ");
  }
  return { text, bad };
}

/** Why a chat message may not be sent, or null. `links`: dominios cuyos enlaces sí se permiten (vacío = ninguno). */
export function checkMessage(text: string, links?: string[]): Block | null {
  const t = text.trim();
  if (!t || !/[\p{L}\p{N}]/u.test(t)) return "empty";
  let work = t;
  if (links && links.length) {
    const r = scrubLinks(t, links);
    if (r === "block") return "link";
    if (r.bad) return "profanity";
    work = r.text;
  }
  if (hasBadWord(work)) return "profanity";
  if (LINK.test(work) || EMAIL.test(work)) return "link";
  if (MENTION.test(work) || digitsCount(work) >= 7 || CONTACT_WORDS.test(fold(work).replace(/[^a-z ]/g, " ")) ) return "contact";
  return null;
}

/** Normalizes the configured list: "Google.com, https://www.budsin.dev/x" -> ["google.com", "budsin.dev"]. */
export function parseLinkRules(list: string | undefined): string[] {
  return (list ?? "").split(",").map((s) => s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").replace(/^\*\./, "")).filter((s) => /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(s));
}

// ---- nombres de usuario ----
export type NameProblem = "length" | "chars" | "reserved" | "profanity" | "link";
const RESERVED = ["admin", "administrador", "administrator", "moderador", "moderator", "mod", "staff", "soporte", "support", "budsin", "juanjo", "system", "sistema", "owner", "dueno", "root", "oficial", "official", "ayuda", "help", "anonimo", "anonymous", "null", "undefined", "everyone", "todos", "chat"];

/** Same name for the uniqueness check: "Juan_Jose", "juanjose" and "Ju4nJ0s3" are one name. */
export function nameKey(name: string): string {
  return dedouble(squash(name)) || name.toLowerCase();
}

export function checkUsername(name: string, isAdmin = false): NameProblem | null {
  if (name.length < 3 || name.length > 20) return "length";
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]$/.test(name)) return "chars";
  const key = nameKey(name);
  if (!isAdmin && RESERVED.some((r) => key === r || key.startsWith(r))) return "reserved";
  if (LINK.test(name) || EMAIL.test(name)) return "link";
  if (hasBadWord(name.replace(/[._-]+/g, " "))) return "profanity";
  // Un nombre es una sola palabra: también se busca la mala palabra DENTRO («xXputaXx»), salvo palabras inocentes conocidas.
  const sq = squash(name);
  const cleaned = SAFE_INSIDE.reduce((s, w) => s.split(dedouble(w)).join("#"), dedouble(sq));
  if (BAD_LONG.some((w) => cleaned.includes(w))) return "profanity";
  return null;
}

/** Names of rooms (class groups, game rooms): shown to everybody, so same rules as a message plus a size. */
export function checkRoomName(name: string): "length" | Block | null {
  const n = name.trim();
  if (n.length < 3 || n.length > 40) return "length";
  const r = checkMessage(n);
  return r === "empty" ? "length" : r;
}

/** Identity of a room name for "no duplicates": case, accents, spaces and punctuation do not make a new one. */
export function roomKey(name: string): string {
  return dedouble(fold(name).replace(/[^a-z0-9]/g, "")) || name.toLowerCase();
}
