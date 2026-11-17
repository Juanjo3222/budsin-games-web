/* Budsin Music · radios "Modo Gaming / Radio Focus".
 *
 * Estaciones de reproducción continua, sin comentarios hablados, pensadas para dejarlas de fondo mientras se juega:
 * Phonk, Lo-Fi Beats, Synthwave e Instrumental. Cada estación es un conjunto de búsquedas en el catálogo de Budsin Music
 * (/api/music/search); BmStations.tracks() devuelve canciones nuevas de la estación (sin repetir las que ya están en la
 * cola) marcadas con `station`, para que quien reproduce sepa que no debe hablar el DJ y que, al acabarse la cola, pida
 * más canciones de la misma estación en vez de "parecidas".
 * Lo usan la página de Budsin Music (Explorar) y el menú de música que acompaña a los juegos (bm-mini.js). */
(function () {
  'use strict';
  var SRC = (document.currentScript && document.currentScript.src) || '';
  var API = (/^https?:\/\//.test(SRC) ? SRC.replace(/^(https?:\/\/[^\/]+).*$/, '$1') : location.origin) + '/api/music/';   // absolute: game pages may carry a <base href>
  if (window.BmStations) return;

  var LIST = [
    { id: 'phonk', emoji: '🏎️', grad: 'linear-gradient(135deg,#ef4444,#7f1d1d)',
      name: { es: 'Phonk', en: 'Phonk', pt: 'Phonk' },
      desc: { es: 'Graves pesados y cowbell para partidas intensas.', en: 'Heavy bass and cowbell for intense matches.', pt: 'Graves pesados e cowbell para partidas intensas.' },
      q: ['phonk', 'drift phonk', 'brazilian phonk', 'aggressive phonk'] },
    { id: 'lofi', emoji: '🌙', grad: 'linear-gradient(135deg,#6366f1,#1e1b4b)',
      name: { es: 'Lo-Fi Beats', en: 'Lo-Fi Beats', pt: 'Lo-Fi Beats' },
      desc: { es: 'Ritmos suaves para concentrarte o relajarte entre rondas.', en: 'Soft beats to focus or unwind between rounds.', pt: 'Batidas suaves para focar ou relaxar entre as rodadas.' },
      q: ['lofi hip hop', 'lofi beats', 'chillhop', 'lofi study beats'] },
    { id: 'synthwave', emoji: '🌆', grad: 'linear-gradient(135deg,#ec4899,#3b0764)',
      name: { es: 'Synthwave', en: 'Synthwave', pt: 'Synthwave' },
      desc: { es: 'Neón y sintetizadores de los 80 para jugar de noche.', en: '80s neon and synths for late-night gaming.', pt: 'Neon e sintetizadores dos anos 80 para jogar à noite.' },
      q: ['synthwave', 'retrowave', 'outrun', 'darksynth'] },
    { id: 'instrumental', emoji: '🎹', grad: 'linear-gradient(135deg,#14b8a6,#0f172a)',
      name: { es: 'Instrumental', en: 'Instrumental', pt: 'Instrumental' },
      desc: { es: 'Sin letras: piano, cine y ambient para no distraerte.', en: 'No lyrics: piano, cinematic and ambient so nothing distracts you.', pt: 'Sem letras: piano, cinema e ambient para não distrair.' },
      q: ['instrumental focus', 'cinematic instrumental', 'piano instrumental', 'ambient instrumental'] }
  ];

  function nk(s) { return String(s == null ? '' : s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function primary(tr) { return String(tr.artist || '').split(/\s*(?:,|&|;|\bfeat\.?|\bft\.?|\bx\b)\s*/i)[0].trim(); }
  function titleKey(tr) { return nk(primary(tr)) + '|' + nk(String(tr.title).replace(/\(.*?\)|\[.*?\]/g, '')); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function find(id) { return LIST.filter(function (s) { return s.id === id; })[0] || null; }
  function slim(tr, station) {
    return { id: tr.id, title: tr.title, artist: tr.artist, artistId: tr.artistId, album: tr.album, albumId: tr.albumId, artwork: tr.artwork, duration: tr.duration, explicit: tr.explicit, isrc: tr.isrc, source: tr.source, auto: 1, station: station };
  }
  var cache = {};
  function search(q) {
    var path = 'search?limit=40&q=' + encodeURIComponent(q);
    if (cache[path]) return Promise.resolve(cache[path]);
    return fetch(API + '' + path).then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }).then(function (d) { cache[path] = d.items || []; return cache[path]; }).catch(function () { return []; });
  }
  /* have: { id: 1, 'tk|artist|title': 1 }  -> up to n tracks of the station that are not in it */
  function tracks(id, n, have) {
    var st = find(id); if (!st) return Promise.resolve([]);
    have = have || {};
    return Promise.all(shuffle(st.q.slice()).slice(0, 3).map(search)).then(function (lists) {
      var seen = {}, out = [];
      shuffle([].concat.apply([], lists)).forEach(function (tr) {
        if (!tr || tr.id == null || !tr.title) return;
        var d = +tr.duration; if (d && (d < 90 || d > 420)) return;               // no loops of seconds, no hour-long mixes
        var k = String(tr.id), tk = 't:' + titleKey(tr);
        if (have[k] || have[tk] || seen[k] || seen[tk]) return;
        seen[k] = seen[tk] = 1; out.push(slim(tr, id));
      });
      return out.slice(0, n);
    });
  }
  function lang(l) { return l === 'en' || l === 'pt' ? l : 'es'; }
  window.BmStations = {
    list: LIST,
    get: find,
    tracks: tracks,
    name: function (id, l) { var s = find(id); return s ? s.name[lang(l)] : ''; },
    desc: function (id, l) { var s = find(id); return s ? s.desc[lang(l)] : ''; },
    // ids and title keys of a queue, in the form tracks() expects
    haveOf: function (queue) { var h = {}; (queue || []).forEach(function (q) { h[String(q.id)] = 1; h['t:' + titleKey(q)] = 1; }); return h; }
  };
})();
