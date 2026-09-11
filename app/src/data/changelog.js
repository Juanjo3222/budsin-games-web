export const SITE_VERSION = "8.0-sunset";

const VERSION_KEY = "juanjos_games_seen_version";

export function changelogForLang(lang) {
  const shared = {
    title:
      lang === "en"
        ? "\u26A0\uFE0F Budsin Games \u2014 Important Notice"
        : lang === "pt"
        ? "\u26A0\uFE0F Budsin Games \u2014 Aviso Importante"
        : "\u26A0\uFE0F Budsin Games \u2014 Aviso Importante",
    desc:
      lang === "en"
        ? "This site will no longer receive updates. We recommend switching to a personal Google account on your Chromebook for the best experience."
        : lang === "pt"
        ? "Este site n\u00E3o receber\u00E1 mais atualiza\u00E7\u00F5es. Recomendamos mudar para uma conta pessoal do Google no seu Chromebook para a melhor experi\u00EAncia."
        : "Este sitio ya no recibir\u00E1 actualizaciones. Te recomendamos pasar a una cuenta personal de Google en tu Chromebook para la mejor experiencia.",
    items: [
      lang === "en"
        ? "Switch to a personal Google account on your Chromebook \u2014 this gives you access to the full Android game catalog from the Play Store."
        : lang === "pt"
        ? "Mude para uma conta pessoal do Google no seu Chromebook \u2014 isso d\u00E1 acesso ao cat\u00E1logo completo de jogos Android da Play Store."
        : "P\u00E1sate a una cuenta personal de Google en tu Chromebook \u2014 as\u00ED tendr\u00E1s acceso al cat\u00E1logo completo de juegos de Android desde la Play Store.",
      lang === "en"
        ? "Enjoy native Android games, emulators, and full Chromebook unenrollment for unrestricted access."
        : lang === "pt"
        ? "Aproveite jogos Android nativos, emuladores e desvincula\u00E7\u00E3o completa do Chromebook para acesso irrestrito."
        : "Disfruta de juegos Android nativos, emuladores y desenrolamiento completo de la Chromebook para acceso sin restricciones.",
      lang === "en"
        ? "The Play Store offers thousands of games \u2014 much more than what this portal could ever provide."
        : lang === "pt"
        ? "A Play Store oferece milhares de jogos \u2014 muito mais do que este portal poderia oferecer."
        : "La Play Store ofrece miles de juegos \u2014 mucho m\u00E1s de lo que este portal podr\u00EDa ofrecer nunca.",
    ],
  };
  return shared;
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
