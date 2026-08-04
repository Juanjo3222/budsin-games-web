export function formatReleaseDate(dateStr, lang) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDate();
  const year = d.getFullYear();
  const months = {
    es: ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],
    en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    pt: ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"],
  };
  const m = months[lang] ? months[lang][d.getMonth()] : months.es[d.getMonth()];
  if (lang === "en") return m + " " + day + ", " + year;
  return day + " de " + m + " de " + year;
}

export function isReleased(proRelease) {
  return !!proRelease && new Date(proRelease + "T00:00:00") <= new Date();
}
