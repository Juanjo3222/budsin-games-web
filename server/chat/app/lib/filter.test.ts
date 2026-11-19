import { describe, expect, test } from "bun:test";
import { checkMessage, checkRoomName, checkUsername, nameKey, parseLinkRules, roomKey } from "./filter";

describe("mensajes", () => {
  test("deja pasar charla normal", () => {
    for (const t of ["hola, ¿alguien juega Pacman?", "gg wp", "qué buen juego, me encantó la clase de hoy", "jugando en la computadora", "mi clase de matemáticas es a las 8", "nos vemos mañana en el patio", "level 12 desbloqueado!!!", "I love this game"])
      expect(checkMessage(t)).toBeNull();
  });
  test("bloquea groserías aunque se disfracen", () => {
    for (const t of ["eres un pendejo", "p u t a", "m.i.e.r.d.a", "fuuuuck you", "sh1t", "qué put@", "HIJUEPUTA", "idiota", "f u c k"]) expect(checkMessage(t)).toBe("profanity");
  });
  test("bloquea enlaces y correos", () => {
    for (const t of ["entra a https://x.com", "www.algo.com", "mira discord.gg/abc", "pepe@gmail.com", "pepe arroba gmail punto com", "bit.ly/xyz", "visita mipagina punto com"]) expect(["link", "contact"]).toContain(checkMessage(t));
    expect(checkMessage("mira discord.gg/abc")).toBe("link");
  });
  test("bloquea datos de contacto", () => {
    for (const t of ["mi número es 987654321", "llamame al 9 8 7 6 5 4 3 2 1", "pasame tu whatsapp", "agrégame al insta", "sigueme @juanito", "nueve ocho siete seis cinco cuatro tres"]) expect(checkMessage(t)).toBe("contact");
  });
  test("un número corto de partida o nivel sí pasa", () => {
    expect(checkMessage("saqué 1500 puntos en el nivel 12")).toBeNull();
  });
  test("vacío o solo símbolos", () => {
    expect(checkMessage("   ")).toBe("empty");
    expect(checkMessage("!!!???")).toBe("empty");
  });
});

describe("nombres de usuario", () => {
  test("acepta nombres normales", () => {
    for (const n of ["Juanito", "gamer_pro", "Maria.G", "alumno-3A", "Luna123", "ClaseMate", "classic_gamer"]) expect(checkUsername(n)).toBeNull();
  });
  test("largo y caracteres", () => {
    expect(checkUsername("ab")).toBe("length");
    expect(checkUsername("a".repeat(21))).toBe("length");
    expect(checkUsername("_hola")).toBe("chars");
    expect(checkUsername("hola mundo")).toBe("chars");
    expect(checkUsername("ñandú")).toBe("chars");
  });
  test("reservados: nadie se hace pasar por el admin", () => {
    for (const n of ["admin", "Admin123", "budsin_oficial", "Moderador", "Soporte_Budsin", "BUDSIN"]) expect(checkUsername(n)).toBe("reserved");
    expect(checkUsername("budsin_admin", true)).toBeNull();
  });
  test("groserías dentro del nombre", () => {
    for (const n of ["xXputaXx", "pendejo_pro", "fuck_you", "elmierda", "Sh1tPost", "p.u.t.a"]) expect(checkUsername(n)).toBe("profanity");
  });
  test("palabras inocentes que contienen una mala no se bloquean", () => {
    for (const n of ["ComputadoraMan", "Assassin_Fan", "MassEffect", "Scunthorpe", "Penelope", "Cumpleanos"]) expect(checkUsername(n)).toBeNull();
  });
  test("la clave evita duplicados disfrazados", () => {
    expect(nameKey("Juan_Jose")).toBe(nameKey("juanjose"));
    expect(nameKey("Ju4nJ0s3")).toBe(nameKey("juanjose"));
    expect(nameKey("Juan.Jose")).toBe(nameKey("JUANJOSE"));
    expect(nameKey("Juanjo")).not.toBe(nameKey("Juanjose"));
  });
});

describe("nombres de grupo", () => {
  test("largo y filtro", () => {
    expect(checkRoomName("3A Matemáticas")).toBeNull();
    expect(checkRoomName("ab")).toBe("length");
    expect(checkRoomName("los pendejos de 3A")).toBe("profanity");
    expect(checkRoomName("grupo https://x.com")).toBe("link");
  });
  test("mismo grupo con otra forma de escribirlo", () => {
    expect(roomKey("3A Matemáticas")).toBe(roomKey("3a  matematicas"));
    expect(roomKey("3°A - Matemáticas")).toBe(roomKey("3a matematicas"));
    expect(roomKey("3B Matemáticas")).not.toBe(roomKey("3A Matemáticas"));
  });
});

describe("enlaces permitidos (lista blanca)", () => {
  const L = ["budsin.dev", "google.com", "prescott.edu.pe"];
  const ok = (t: string) => expect(checkMessage(t, L)).toBeNull();
  const no = (t: string, why = "link") => expect(checkMessage(t, L)).toBe(why as any);
  test("sin lista no pasa ningún enlace (como antes)", () => {
    expect(checkMessage("mira https://google.com")).toBe("link");
    expect(checkMessage("mira https://google.com", [])).toBe("link");
  });
  test("pasan los dominios de la lista y sus subdominios, con o sin esquema", () => {
    for (const t of ["mira https://games.budsin.dev/musica/", "entra a budsin.dev", "https://docs.google.com/document/d/1AbCdEfGh/edit", "classroom.google.com", "www.google.com", "https://campus.prescott.edu.pe/aula", "https://alumnos.prescott.edu.pe", "mira (https://google.com)."]) ok(t);
  });
  test("un enlace permitido con números largos en la ruta NO cuenta como teléfono", () => {
    ok("https://docs.google.com/d/1234567890123/edit");
  });
  test("engaños de dominio: no cuentan como Google ni como Budsin", () => {
    for (const t of ["https://google.com.malo.com", "https://malogoogle.com", "google.com.evil.net", "https://budsin.dev.malo.xyz", "https://notprescott.edu.pe", "https://google.com@malo.com", "https://budsin.dev:pass@malo.com/x", "https://xn--ggle-0nda.com", "http://127.0.0.1/x", "https://localhost", "https://google.co"]) no(t);
  });
  test("redirecciones y proxys de un dominio permitido tampoco", () => {
    for (const t of ["https://www.google.com/url?q=https://malo.com", "https://translate.google.com/translate?u=https://malo.com", "https://www.google.com/amp/s/malo.com", "https://webcache.googleusercontent.com/x"]) no(t);
  });
  test("un enlace permitido con una grosería en la ruta se bloquea", () => {
    no("https://www.google.com/search?q=porno", "profanity");
  });
  test("si hay UN enlace no permitido junto a uno permitido, se bloquea todo; y máximo 2", () => {
    no("https://google.com y https://malo.com");
    no("https://google.com https://budsin.dev https://prescott.edu.pe");
    ok("https://google.com y budsin.dev");
  });
  test("correos, @usuarios y teléfonos siguen bloqueados aunque haya un enlace permitido", () => {
    expect(checkMessage("escríbeme a ana@google.com", L)).toBe("link");
    expect(checkMessage("sígueme @juanito https://google.com", L)).toBe("contact");
    expect(checkMessage("mi número 987654321 y https://google.com", L)).toBe("contact");
    expect(checkMessage("pásame tu whatsapp https://google.com", L)).toBe("contact");
  });
  test("parseLinkRules limpia la lista", () => {
    expect(parseLinkRules("Google.com, https://www.budsin.dev/x, *.prescott.edu.pe, , basura")).toEqual(["google.com", "budsin.dev", "prescott.edu.pe"]);
  });
});
