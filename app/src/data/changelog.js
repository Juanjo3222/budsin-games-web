// Novedades que se muestran una sola vez por versión (o la primera vez que se entra al sitio).
// Cada punto es una lista de partes: texto suelto o un enlace { href, label }.
export const SITE_VERSION = "7.6";

const VERSION_KEY = "juanjos_games_seen_version";

const COPY = {
  es: {
    title: "Novedades de Budsin Games",
    desc: "Este popup solo aparece una vez por versión o la primera vez que entras al sitio.",
    items: [
      ["Geometry Dash completo: ahora juegas el Geometry Dash de verdad (versión 2.2091), con niveles oficiales, editor de niveles, niveles online de la comunidad y progreso guardado. Abre a pantalla completa, sin salir del sitio. ", { href: "/geometry-dash.html", label: "Jugar Geometry Dash" }],
      ["Juegos nuevos: ", { href: "/gamers-mod.html", label: "Gamer's Mod" }, " (sandbox estilo Garry's Mod, con mapas y modos; no es el GMod oficial) y ", { href: "/gta-vice-city.html", label: "GTA Vice City" }, " (se abre en otra pestaña y trae modo demo)."],
      ["Arreglados: ", { href: "/Cuphead.html", label: "Cuphead" }, " vuelve a funcionar y ahora tiene barra de carga (la primera vez baja ~1.3 GB). ", { href: "/rocket-goal.html", label: "Rocket Goal" }, " ahora usa nitro.car, con partidas en vivo."],
      ["Modo oculto renovado: varios disfraces (Documentos, Classroom, Drive, Desmos…), tecla de pánico que te saca a otra página, ocultar al cambiar de pestaña y atajos como Ctrl+Shift+< o >. Se configura en Ajustes."],
      ["Budsin AI estrena logo y ahora lleva a aif.budsin.dev."],
      ["Pequeñas mejoras en ", { href: "/musica/", label: "Budsin Music" }, " y ", { href: "/chat/", label: "Budsin Chat" }, "."],
    ],
  },
  en: {
    title: "What's new in Budsin Games",
    desc: "This popup only appears once per version or the first time you visit the site.",
    items: [
      ["Full Geometry Dash: you now play the real Geometry Dash (version 2.2091), with official levels, the level editor, online community levels and saved progress. It opens full screen without leaving the site. ", { href: "/geometry-dash.html", label: "Play Geometry Dash" }],
      ["New games: ", { href: "/gamers-mod.html", label: "Gamer's Mod" }, " (a Garry's Mod-style sandbox with maps and modes; not the official GMod) and ", { href: "/gta-vice-city.html", label: "GTA Vice City" }, " (opens in a new tab and has a demo mode)."],
      ["Fixed: ", { href: "/Cuphead.html", label: "Cuphead" }, " works again and now has a loading bar (the first time it downloads ~1.3 GB). ", { href: "/rocket-goal.html", label: "Rocket Goal" }, " now uses nitro.car, with live matches."],
      ["Cover mode revamped: several disguises (Docs, Classroom, Drive, Desmos…), a panic key that takes you to another page, hide when switching tabs and shortcuts like Ctrl+Shift+< or >. Set it up in Settings."],
      ["Budsin AI has a new logo and now goes to aif.budsin.dev."],
      ["Small improvements to ", { href: "/musica/", label: "Budsin Music" }, " and ", { href: "/chat/", label: "Budsin Chat" }, "."],
    ],
  },
  pt: {
    title: "Novidades do Budsin Games",
    desc: "Este pop-up aparece apenas uma vez por versão ou na primeira vez que você entra no site.",
    items: [
      ["Geometry Dash completo: agora você joga o Geometry Dash de verdade (versão 2.2091), com fases oficiais, editor de fases, fases online da comunidade e progresso salvo. Abre em tela cheia, sem sair do site. ", { href: "/geometry-dash.html", label: "Jogar Geometry Dash" }],
      ["Jogos novos: ", { href: "/gamers-mod.html", label: "Gamer's Mod" }, " (sandbox estilo Garry's Mod, com mapas e modos; não é o GMod oficial) e ", { href: "/gta-vice-city.html", label: "GTA Vice City" }, " (abre em outra aba e tem modo demo)."],
      ["Corrigidos: ", { href: "/Cuphead.html", label: "Cuphead" }, " voltou a funcionar e agora tem barra de carregamento (na primeira vez baixa ~1,3 GB). ", { href: "/rocket-goal.html", label: "Rocket Goal" }, " agora usa o nitro.car, com partidas ao vivo."],
      ["Modo oculto renovado: vários disfarces (Documentos, Sala de Aula, Drive, Desmos…), tecla de pânico que leva você a outra página, ocultar ao trocar de aba e atalhos como Ctrl+Shift+< ou >. Configure em Ajustes."],
      ["O Budsin AI ganhou um logo novo e agora leva para aif.budsin.dev."],
      ["Pequenas melhorias no ", { href: "/musica/", label: "Budsin Music" }, " e no ", { href: "/chat/", label: "Budsin Chat" }, "."],
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
