import { describe, expect, test } from "bun:test";
import { checkMessage, checkRoomName, checkUsername, nameKey, roomKey } from "./filter";

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
