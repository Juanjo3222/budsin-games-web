import { describe, expect, test } from "bun:test";
import { DEFAULT_RULES, emailAllowed, parseRules } from "./access";

const admins = new Set(["boss@gmail.com"]);
const ok = (email: string, rules: string[] | null = DEFAULT_RULES, verified = true) => emailAllowed(email, verified, rules, admins);

describe("cuentas de colegio", () => {
  test("acepta .edu, .edu.país y .ac.país", () => {
    for (const e of ["ana@mit.edu", "ana@cs.mit.edu", "juan@ucv.edu.pe", "maria@unam.edu.mx", "luis@alumnos.colegio.edu.co", "tom@ox.ac.uk", "ANA@MIT.EDU"]) expect(ok(e)).toBe(true);
  });
  test("rechaza correos personales y dominios parecidos", () => {
    for (const e of ["ana@gmail.com", "ana@outlook.com", "ana@edu.com", "ana@myedu.com", "ana@mit.edu.com", "ana@notedu", "ana@edu"]) expect(ok(e)).toBe(false);
  });
  test("no se deja engañar con dominios que contienen «edu» pero no terminan bien", () => {
    for (const e of ["ana@school.edu.evil.com", "ana@edu.xyz", "ana@school.edu.xyz", "ana@x.edu.abc", "ana@evil.com.edu.attacker.net", "ana@edu.pe.evil.com", "ana@ac.uk.evil.com"]) expect(ok(e)).toBe(false);
  });
  test("correos raros o sin verificar", () => {
    for (const e of ["", "sin-arroba", "@mit.edu", "a@.mit.edu", "a@mit..edu", "a b@mit.edu", "a@mit.edu\n@evil.com"]) expect(ok(e)).toBe(false);
    expect(ok("ana@mit.edu", DEFAULT_RULES, false)).toBe(false);
  });
  test("dominios añadidos a mano (colegios con dominio propio), con sus subdominios", () => {
    const r = parseRules("colegiosanjose.com, *.edu")!;
    expect(ok("ana@colegiosanjose.com", r)).toBe(true);
    expect(ok("ana@alumnos.colegiosanjose.com", r)).toBe(true);
    expect(ok("ana@xcolegiosanjose.com", r)).toBe(false);
    expect(ok("ana@colegiosanjose.com.evil.net", r)).toBe(false);
    expect(ok("ana@mit.edu", r)).toBe(true);
  });
  test("los administradores entran siempre (con correo verificado)", () => {
    expect(ok("boss@gmail.com")).toBe(true);
    expect(ok("boss@gmail.com", DEFAULT_RULES, false)).toBe(false);
  });
  test("parseRules: vacío = por defecto de colegios; * = abierto", () => {
    expect(parseRules("")).toEqual(DEFAULT_RULES);
    expect(parseRules(undefined)).toEqual(DEFAULT_RULES);
    expect(parseRules("*")).toBeNull();
    expect(ok("cualquiera@gmail.com", null)).toBe(true);
  });
});
