/* Budsin Music · DJ Juanjo dentro de Budsin Games.
 *
 * Lo carga bm-mini.js (solo cuando el DJ estaba activo al salir de /musica/) para que la sesión de DJ siga en el portal:
 *  - comentarios hablados entre canciones (plantillas, o la IA del servidor; voz del navegador, Fish Audio o ElevenLabs
 *    según lo elegido en Budsin Music), pedidos con precarga mientras suena la canción anterior;
 *  - la cola se extiende sola con canciones parecidas (autoplay), igual que en Budsin Music.
 * Lee los ajustes y los gustos de localStorage (mismo origen): bm_djfreq, bm_djlang, bm_djvoice, bm_djai, bm_djengine,
 * bm_vol, bm_taste, bm_recs. Las claves de las voces en la nube nunca llegan aquí: las usa el servidor.
 * Las plantillas DJT son copia de las de public/musica/index.html (una prueba del backend avisa si se desincronizan). */
(function () {
  'use strict';
  var SRC = (document.currentScript && document.currentScript.src) || '';
  var API = (/^https?:\/\//.test(SRC) ? SRC.replace(/^(https?:\/\/[^\/]+).*$/, '$1') : location.origin) + '/api/music/';   // absolute: game pages may carry a <base href>
  if (window.BmDj) return;

  function ls(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function cfg() {
    var f = ls('bm_djfreq', 'often');
    return { freq: f === 'sometimes' || f === 'off' ? f : 'often', lang: ls('bm_djlang', 'auto'), voice: ls('bm_djvoice', ''), ai: ls('bm_djai', 1) !== 0,
      engine: ls('bm_djengine', 'browser'), volume: Math.max(0, Math.min(100, +ls('bm_vol', 80) || 0)) };
  }
  function langTag() { var l = cfg().lang; l = l === 'auto' ? (navigator.language || 'en') : l; return /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(l) ? l : 'en'; }
  function langBase() { return langTag().split('-')[0].toLowerCase(); }
  function nk(s) { return String(s == null ? '' : s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function primary(tr) { return String(tr.artist || '').split(/\s*(?:,|&|;|\bfeat\.?|\bft\.?|\bx\b)\s*/i)[0].trim(); }
  function short(title) { var x = String(title || '').replace(/\s*[\(\[][^)\]]*[\)\]]/g, '').replace(/\s+[-–—]\s+.*$/, '').trim(); return x || String(title || ''); }
  function titleKey(tr) { return nk(primary(tr)) + '|' + nk(String(tr.title).replace(/\(.*?\)|\[.*?\]/g, '')); }
  var HALF_LIFE_MS = 21 * 86400000;
  function decayed(e, now) { return e.s * Math.pow(0.5, (now - e.t) / HALF_LIFE_MS); }
  function taste() { var t = ls('bm_taste', null); return t && typeof t === 'object' ? t : { artists: {}, seen: [], skips: {} }; }
  function dayHash(str) { var h = 0, x = str + '|' + new Date().toISOString().slice(0, 10); for (var i = 0; i < x.length; i++) h = (h * 31 + x.charCodeAt(i)) >>> 0; return (h % 1000) / 1000; }

  /* ---- plantillas ---- */
  var DJT = {
    es: {
      first: ['Hola, soy DJ Juanjo. Empezamos con {to}, de {toArtist}.', 'Aquí DJ Juanjo. Arrancamos con {to}, de {toArtist}.', 'Bienvenido. Soy DJ Juanjo y empezamos con {to}, de {toArtist}.'],
      same_artist: ['Seguimos con {toArtist}: ahora, {to}.', 'Más de {toArtist}. Suena {to}.', '{toArtist} sigue en la cabina con {to}.'],
      favorite: ['Uno de tus favoritos, {toArtist}. Aquí va {to}.', 'Sé que te gusta {toArtist}. Ahora, {to}.', 'Para ti, de {toArtist}: {to}.'],
      similar: ['Después de {fromArtist}, algo en la misma onda: {to}, de {toArtist}.', 'Si te gustó {from}, esto te va a gustar: {to}, de {toArtist}.', 'Cambiamos un poco: {to}, de {toArtist}.'],
      discover: ['Algo nuevo para ti: {to}, de {toArtist}.', 'Te propongo descubrir a {toArtist} con {to}.', 'A ver qué te parece: {to}, de {toArtist}.'],
      request: ['Va tu pedido. Empieza {to}, de {toArtist}.', 'Eso viene. Primero, {to}, de {toArtist}.', 'Lo que pediste, con {to}, de {toArtist}.']
    },
    en: {
      first: ["Hi, I'm DJ Juanjo. We start with {to}, by {toArtist}.", "DJ Juanjo here. Kicking off with {to}, by {toArtist}.", "Welcome in. I'm DJ Juanjo, and we begin with {to}, by {toArtist}."],
      same_artist: ["Staying with {toArtist}: here's {to}.", "More {toArtist}. This is {to}.", "{toArtist} is still in the booth with {to}."],
      favorite: ["One of your favorites, {toArtist}. Here's {to}.", "I know you like {toArtist}. Now, {to}.", "For you, from {toArtist}: {to}."],
      similar: ["After {fromArtist}, something in the same vein: {to}, by {toArtist}.", "If you liked {from}, you'll like this: {to}, by {toArtist}.", "Let's shift a little: {to}, by {toArtist}."],
      discover: ["Something new for you: {to}, by {toArtist}.", "Let me introduce you to {toArtist} with {to}.", "Let's see what you think: {to}, by {toArtist}."],
      request: ["Coming right up. First, {to}, by {toArtist}.", "Your request: {to}, by {toArtist}.", "Here's what you asked for, starting with {to}, by {toArtist}."]
    },
    pt: {
      first: ['Oi, eu sou o DJ Juanjo. Começamos com {to}, de {toArtist}.', 'Aqui é o DJ Juanjo. Vamos de {to}, de {toArtist}.', 'Bem-vindo. Eu sou o DJ Juanjo e começamos com {to}, de {toArtist}.'],
      same_artist: ['Seguimos com {toArtist}: agora, {to}.', 'Mais de {toArtist}. Toca {to}.', '{toArtist} continua na cabine com {to}.'],
      favorite: ['Um dos seus favoritos, {toArtist}. Aí vai {to}.', 'Eu sei que você gosta de {toArtist}. Agora, {to}.', 'Para você, de {toArtist}: {to}.'],
      similar: ['Depois de {fromArtist}, algo na mesma vibe: {to}, de {toArtist}.', 'Se você gostou de {from}, vai gostar disto: {to}, de {toArtist}.', 'Vamos mudar um pouco: {to}, de {toArtist}.'],
      discover: ['Algo novo para você: {to}, de {toArtist}.', 'Vou te apresentar {toArtist} com {to}.', 'Vamos ver o que você acha: {to}, de {toArtist}.'],
      request: ['Aí vem o seu pedido. Começa {to}, de {toArtist}.', 'Já vai. Primeiro, {to}, de {toArtist}.', 'O que você pediu, com {to}, de {toArtist}.']
    }
  };
  var last = '';
  function template(reason, from, to) {
    var tpl = DJT[langBase()] || DJT.en, arr = tpl[reason] || tpl.similar;
    var pick = arr[Math.floor(Math.random() * arr.length)];
    if (arr.length > 1 && pick === last) pick = arr[(arr.indexOf(pick) + 1) % arr.length];
    last = pick;
    return pick.replace(/\{toArtist\}/g, primary(to)).replace(/\{to\}/g, short(to.title)).replace(/\{fromArtist\}/g, from ? primary(from) : '').replace(/\{from\}/g, from ? short(from.title) : '');
  }
  function reasonFor(from, to) {
    if (!from) return 'first';
    var tk = nk(primary(to));
    if (tk && tk === nk(primary(from))) return 'same_artist';
    var t = taste(), now = Date.now();
    var ranked = Object.keys(t.artists || {}).map(function (k) { return { k: k, s: decayed(t.artists[k], now) }; }).filter(function (a) { return a.s > 0.4; }).sort(function (a, b) { return b.s - a.s; });
    if (ranked.slice(0, 5).some(function (a) { return a.k === tk; })) return 'favorite';
    if (to.auto || (t.artists && t.artists[tk] && t.artists[tk].s > 0)) return 'similar';
    return 'discover';
  }

  /* ---- servidor: IA y voces ---- */
  var aiOk = null, voices = null, cool = {};
  function checkAi() {
    if (aiOk !== null) return Promise.resolve(aiOk);
    return fetch(API + 'dj/status').then(function (r) { return r.ok ? r.json() : { ai: false }; }).catch(function () { return { ai: false }; }).then(function (d) { aiOk = !!(d && d.ai); return aiOk; });
  }
  function checkVoices() {
    if (voices) return Promise.resolve(voices);
    return fetch(API + 'dj/voices').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (d) { voices = { fish: !!(d && d.fish), eleven: !!(d && d.eleven) }; return voices; });
  }
  function ask(from, to, reason) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, tm = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    var one = function (x) { return x ? { title: short(x.title), artist: primary(x) } : {}; };
    return fetch(API + 'dj', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: one(from), to: one(to), lang: langTag(), reason: reason }), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { return d && typeof d.text === 'string' && d.text ? d.text : null; })
      .catch(function () { return null; }).then(function (x) { clearTimeout(tm); return x; });
  }
  var ttsCache = {}, ttsKeys = [];
  function cloudOn(engine) { return engine !== 'browser' && !!(voices && voices[engine]) && Date.now() > (cool[engine] || 0); }
  function ttsGet(text, engine) {
    engine = engine || cfg().engine;
    if (!cloudOn(engine)) return Promise.resolve(null);
    var key = engine + '|' + langBase() + '|' + text;
    if (ttsCache[key]) return ttsCache[key];
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, tm = setTimeout(function () { if (ctl) ctl.abort(); }, 14000);
    var p = ttsCache[key] = fetch(API + 'dj/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ engine: engine, text: text, lang: langBase() }), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (r.status === 429) cool[engine] = Date.now() + 15 * 60000; return r.ok ? r.blob() : null; })
      .then(function (b) { return b && b.size > 200 ? URL.createObjectURL(b) : null; })
      .catch(function () { return null; })
      .then(function (u) { clearTimeout(tm); if (!u) delete ttsCache[key]; return u; });
    ttsKeys.push(key);
    while (ttsKeys.length > 8) { var old = ttsKeys.shift(), op = ttsCache[old]; delete ttsCache[old]; if (op) op.then(function (u) { if (u) URL.revokeObjectURL(u); }); }
    return p;
  }

  /* ---- hablar ---- */
  var token = 0, audio = null;
  var api = { onSay: null };
  function say(text) { if (api.onSay) { try { api.onSay(text); } catch (e) {} } }
  function browserVoice() {
    var v = []; try { v = (window.speechSynthesis && speechSynthesis.getVoices()) || []; } catch (e) {}
    var b = langBase(), list = v.filter(function (x) { return String(x.lang).toLowerCase().split(/[-_]/)[0] === b; });
    if (!list.length) return null;
    var want = cfg().voice;
    if (want) { var m = list.filter(function (x) { return x.name === want; })[0]; if (m) return m; }
    // DJ Juanjo is a man: with no voice chosen, prefer one whose name is a male name, then the exact locale, then any.
    var tag = langTag().toLowerCase(), exact = list.filter(function (x) { return String(x.lang).toLowerCase().replace('_', '-') === tag; });
    var male = function (x) { return MALE_VOICE.test(x.name); };
    return exact.filter(male)[0] || list.filter(male)[0] || exact[0] || list[0];
  }
  var MALE_VOICE = /\b(jorge|diego|juan|pablo|carlos|raul|raúl|enrique|miguel|antonio|daniel|david|alvaro|álvaro|ricardo|andres|andrés|jose|josé|luis|felipe|paulo|male|hombre|masculin|mark|james|guy|george|ryan|thomas|alex)\b/i;
  function cancel() {
    token++; say('');
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    if (audio) { try { audio.pause(); } catch (e) {} audio = null; }
  }
  // Speaks one line and calls done() exactly once (also when nothing can be heard: the text then stays on screen a moment).
  function speak(text, done, opts) {
    opts = opts || {};
    var c = cfg(), engine = opts.engine || c.engine, my = ++token, over = false, tm;
    var fin = function () { if (over || my !== token) return; over = true; clearTimeout(tm); audio = null; setTimeout(function () { if (my === token) say(''); }, 600); done(); };
    tm = setTimeout(fin, 22000);
    say(text);
    var browserSpeak = function () {
      if (over || my !== token) return;
      var voice = browserVoice();
      if (!('speechSynthesis' in window) || !voice || c.volume === 0) { setTimeout(fin, Math.min(6000, 1500 + text.length * 45)); return; }
      try {
        var u = new SpeechSynthesisUtterance(text);
        u.lang = voice.lang; u.voice = voice; u.volume = Math.min(1, c.volume / 100); u.rate = 1.03;
        u.onend = fin; u.onerror = fin;      // a page nobody has clicked yet may be refused: onerror, and the text is shown anyway
        speechSynthesis.cancel(); speechSynthesis.speak(u);
      } catch (e) { fin(); }
    };
    if (engine === 'browser' || c.volume === 0) { browserSpeak(); return; }
    checkVoices().then(function () {
      if (over || my !== token) return;
      if (!cloudOn(engine)) { browserSpeak(); return; }
      var waited = Promise.race([ttsGet(text, engine), new Promise(function (res) { setTimeout(function () { res(null); }, opts.maxWait || 6000); })]);
      waited.then(function (url) {
        if (over || my !== token) return;
        if (!url) { browserSpeak(); return; }
        var a = new Audio(url); audio = a; a.volume = Math.min(1, c.volume / 100);
        a.onended = fin; a.onerror = browserSpeak;
        var pr = a.play(); if (pr && pr.catch) pr.catch(browserSpeak);
      });
    });
  }

  /* ---- la próxima transición, preparada mientras suena la canción ---- */
  function prepare(from, to) {
    var c = cfg(), reason = reasonFor(from, to);
    var pend = { key: String(from.id) + '>' + String(to.id), text: template(reason, from, to), ai: null, speak: false };
    pend.speak = c.freq !== 'off' && Math.random() <= (c.freq === 'often' ? 0.9 : 0.35);
    if (!pend.speak) return pend;
    checkVoices().then(function () {
      if (c.ai) {
        checkAi().then(function (ok) {
          if (!ok) { ttsGet(pend.text); return; }
          ask(from, to, reason).then(function (txt) { if (txt) pend.ai = txt; ttsGet(pend.ai || pend.text); });
        });
      } else ttsGet(pend.text);
    });
    return pend;
  }
  function wrap(pend, done) {
    if (!pend || !pend.speak || cfg().freq === 'off') return done();
    speak(pend.ai || pend.text, done);
  }

  /* ---- autoplay: canciones parecidas para no quedarse sin cola ---- */
  var cache = {};
  function getJson(path) {
    if (cache[path]) return Promise.resolve(cache[path]);
    return fetch(API + '' + path).then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }).then(function (d) { cache[path] = d; return d; });
  }
  function slim(tr, auto) {
    return { id: tr.id, title: tr.title, artist: tr.artist, artistId: tr.artistId, album: tr.album, albumId: tr.albumId, artwork: tr.artwork, duration: tr.duration, explicit: tr.explicit, isrc: tr.isrc, source: tr.source, auto: auto ? 1 : undefined };
  }
  // seed: the song playing; have: the queue (nothing in it is repeated). Resolves to up to n new tracks, flagged auto.
  function extend(seed, have, n) {
    var name = primary(seed), k = nk(name), t = taste(), now = Date.now(), aff = {}, top = 0;
    Object.keys(t.artists || {}).forEach(function (key) { var s = decayed(t.artists[key], now); if (s > 0.4) { aff[key] = s; if (s > top) top = s; } });
    Object.keys(aff).forEach(function (key) { aff[key] = aff[key] / (top || 1); });
    var haveIds = {}, haveTitles = {};
    (have || []).concat([seed]).forEach(function (q) { haveIds[String(q.id)] = 1; haveTitles[titleKey(q)] = 1; });
    var idP = seed.artistId ? Promise.resolve(seed.artistId) : getJson('lookup/artist?name=' + encodeURIComponent(name)).then(function (d) { return d.id; }).catch(function () { return null; });
    return idP.then(function (id) {
      if (!id) return [];
      return Promise.all([getJson('artist/' + encodeURIComponent(id)).catch(function () { return null; }), getJson('artist/' + encodeURIComponent(id) + '/similar').then(function (d) { return d.artists || []; }).catch(function () { return []; })]).then(function (r) {
        var pool = [];
        if (r[0]) (r[0].tracks || []).forEach(function (tr, i) { pool.push({ tr: tr, sc: 0.9 - i * 0.04 }); });
        var sims = r[1].filter(function (x) { return nk(x.name) !== k; }).slice(0, 5);
        return Promise.all(sims.map(function (x) { return getJson('artist/' + encodeURIComponent(x.id)).catch(function () { return null; }); })).then(function (pages) {
          pages.forEach(function (pg, si) {
            if (pg) (pg.tracks || []).slice(0, 6).forEach(function (tr, i) { pool.push({ tr: tr, sc: 0.8 - si * 0.04 - i * 0.05 + (aff[nk(primary(tr))] || 0) * 0.4 }); });
          });
          var rc = ls('bm_recs', null);
          if (rc && rc.data && rc.data.mix) rc.data.mix.slice(0, 8).forEach(function (tr) { pool.push({ tr: tr, sc: 0.55 }); });
          var seen = {}; (t.seen || []).slice(-40).forEach(function (id) { seen[id] = 1; });
          pool.forEach(function (p) { p.f = p.sc + dayHash(String(p.tr.id)) * 0.15 - (seen[String(p.tr.id)] ? 0.5 : 0); });
          pool.sort(function (a, b) { return b.f - a.f; });
          var out = [], perA = {}, titles = {};
          pool.forEach(function (p) {
            if (out.length >= n || !p.tr || !p.tr.title || p.tr.id == null) return;
            var id2 = String(p.tr.id), ak = nk(primary(p.tr)), tk = titleKey(p.tr);
            if (haveIds[id2] || haveTitles[tk] || titles[tk] || ((t.skips || {})[id2] || 0) >= 2 || (perA[ak] || 0) >= 2) return;
            titles[tk] = 1; perA[ak] = (perA[ak] || 0) + 1; out.push(slim(p.tr, true));
          });
          return out;
        });
      });
    }).catch(function () { return []; });
  }

  api.prepare = prepare; api.wrap = wrap; api.cancel = cancel; api.extend = extend; api.speak = speak; api.config = cfg;
  window.BmDj = api;
})();
