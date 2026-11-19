// ¿Quién puede usar Budsin Chat? Por defecto, solo cuentas de Google de colegios y universidades (correo verificado).
//
// Reglas (CHAT_ALLOWED_DOMAINS, separadas por comas, sin distinguir mayúsculas):
//   colegio.com          ese dominio exacto (y sus subdominios: alumnos.colegio.com)
//   *.edu                cualquier dominio que termine en .edu (mit.edu, cs.mit.edu)
//   *.edu.??             .edu.<país de 2 letras>: ucv.edu.pe, unam.edu.mx   (? = una letra)
//   *.ac.??              .ac.<país>: ox.ac.uk
//   *                    sin restricción
// OJO: no se aceptan comodines que dejen libre la última parte (p. ej. *.edu.*): cualquiera puede registrar «edu.xyz».
// Los correos de los administradores entran siempre (si el correo está verificado).
//
// Es una barrera, no una prueba: un adulto con un dominio de colegio también pasa, y alguien con un dominio propio
// registrado bajo un .edu.xx abierto de su país también. Sirve porque la cuenta de colegio la gestiona el colegio.

export const DEFAULT_RULES = ["*.edu", "*.edu.??", "*.ac.??"];

function toRegex(rule: string): RegExp {
  const esc = rule.toLowerCase().replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[a-z0-9.-]*").replace(/\?/g, "[a-z]");
  return new RegExp(`^${esc}$`);
}

export function parseRules(list: string | undefined): string[] | null {
  const rules = (list ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!rules.length) return [...DEFAULT_RULES];
  if (rules.includes("*")) return null;                 // abierto a todos
  return rules;
}

/** null rules = everybody. */
export function emailAllowed(email: string, verified: boolean, rules: string[] | null, adminEmails: Set<string>): boolean {
  if (!email || !verified) return false;
  const e = email.toLowerCase();
  if (/\s/.test(e)) return false;
  if (adminEmails.has(e)) return true;
  if (rules === null) return true;
  const at = e.lastIndexOf("@");
  const domain = e.slice(at + 1);
  if (at < 1 || !/^[a-z0-9.-]+$/.test(domain) || domain.startsWith(".") || domain.includes("..")) return false;
  return rules.some((r) => {
    if (!r.includes("*") && !r.includes("?")) return domain === r || domain.endsWith("." + r);   // un dominio, con sus subdominios
    return toRegex(r).test(domain);
  });
}
