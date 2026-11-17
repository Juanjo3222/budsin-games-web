/* Budsin Music · mini-reproductor para Budsin Games.
 *
 * Qué hace
 *  - Budsin Music (/musica/) en otra pestaña: muestra qué suena y la controla (BroadcastChannel).
 *  - Budsin Music en esta misma pestaña (botón "Budsin Games" o atrás): la página muere y el audio con ella, así
 *    que antes de irse guarda la sesión (cola, canción, segundo) en localStorage y este script la retoma con su
 *    propio <audio>. Al abrir Budsin Music otra vez, esa página retoma desde aquí.
 *  - Se cierra la pestaña de Budsin Music mientras suena y hay un portal abierto: el portal sigue con la música.
 *
 * Protocolo (compartido con public/musica/index.html)
 *  - localStorage "bm_session": { v:1, ts, owner:'bm'|'mini', closed, playing, qi, t, queue:[pista…] }
 *    "closed" lo escribe quien se va (pagehide); el que llega sólo retoma si closed && playing && ts reciente.
 *  - BroadcastChannel "budsin-music": hb (latido del que tiene el audio), claim (empiezo a sonar: los demás
 *    pausan), cmd (orden a un dueño concreto), bye (me voy).
 * Una sola página tiene el audio a la vez. */
(function () {
  'use strict';
  if (window.__bmMini) return;
  window.__bmMini = true;

  // Absolute URLs: some game pages carry a <base href> pointing at a CDN, which would break "/api/music/...".
  var SELF = (document.currentScript && document.currentScript.src) || '';
  var ORIGIN = /^https?:\/\//.test(SELF) ? SELF.replace(/^(https?:\/\/[^\/]+).*$/, '$1') : location.origin;
  var GAME = /[?&]game=1/.test(SELF);        // injected into a game page by classroom-hotkey.js: a floating button + menu instead of the bottom card
  var KEY = 'bm_session';
  var id = Math.random().toString(36).slice(2);
  var bc = null;
  try { bc = new BroadcastChannel('budsin-music'); } catch (e) {}

  var lang = 'es';
  try {
    var l = (localStorage.getItem('budsin_language') || '').slice(0, 2).toLowerCase();
    if (l === 'en' || l === 'pt') lang = l;
  } catch (e) {}
  var TX = {
    es: { open: 'Abrir Budsin Music', close: 'Cerrar', play: 'Reproducir', pause: 'Pausar', prev: 'Anterior', next: 'Siguiente', tap: 'Toca ▶ para continuar', brand: 'Budsin Music', dj: 'DJ Juanjo: activar o desactivar', menu: 'Menú de Budsin Music', nothing: 'Nada sonando', stations: 'Radio Focus · sin voz', resume: 'Reanudar la última sesión', vol: 'Volumen', pip: 'Mini ventana flotante', pipBack: 'Volver al menú', pipOn: 'Mini ventana abierta', hint: 'Música para jugar' },
    en: { open: 'Open Budsin Music', close: 'Close', play: 'Play', pause: 'Pause', prev: 'Previous', next: 'Next', tap: 'Tap ▶ to continue', brand: 'Budsin Music', dj: 'DJ Juanjo: turn on or off', menu: 'Budsin Music menu', nothing: 'Nothing playing', stations: 'Radio Focus · no voice', resume: 'Resume last session', vol: 'Volume', pip: 'Floating mini window', pipBack: 'Back to the menu', pipOn: 'Mini window open', hint: 'Music to play to' },
    pt: { open: 'Abrir Budsin Music', close: 'Fechar', play: 'Reproduzir', pause: 'Pausar', prev: 'Anterior', next: 'Próxima', tap: 'Toque em ▶ para continuar', brand: 'Budsin Music', dj: 'DJ Juanjo: ligar ou desligar', menu: 'Menu do Budsin Music', nothing: 'Nada tocando', stations: 'Radio Focus · sem voz', resume: 'Retomar a última sessão', vol: 'Volume', pip: 'Mini janela flutuante', pipBack: 'Voltar ao menu', pipOn: 'Mini janela aberta', hint: 'Música para jogar' }
  }[lang];

  var st = { mode: 'none', remote: null, seenPlaying: false, dismiss: null, q: [], qi: -1, blocked: false, errs: 0, dj: false, pend: null, say: '', extending: false, open: false, pip: null };
  var a = null;     // <audio> propio, sólo cuando este script tiene la música
  var ui = null;

  /* ---------- sesión ---------- */
  function readSession() {
    try {
      var s = JSON.parse(localStorage.getItem('bm_session') || 'null');
      return s && s.v === 1 && Array.isArray(s.queue) ? s : null;
    } catch (e) { return null; }
  }
  function writeSession(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  function post(m) { if (bc) { m.id = id; try { bc.postMessage(m); } catch (e) {} } }

  function streamUrl(tr) {
    var p = new URLSearchParams({ id: String(tr.id) });
    if (tr.isrc) p.set('isrc', tr.isrc);
    if (tr.source) p.set('source', tr.source);
    if (tr.title) p.set('title', tr.title);
    if (tr.artist) p.set('artist', tr.artist);
    if (tr.duration) p.set('duration', String(tr.duration));
    return ORIGIN + '/api/music/stream?' + p.toString();
  }

  function snap() {
    var tr = st.q[st.qi];
    if (!tr) return null;
    var d = a && isFinite(a.duration) && a.duration > 0 ? a.duration : (tr.duration || 0);
    return {
      track: { id: tr.id, title: tr.title, artist: tr.artist, artwork: tr.artwork },
      qi: st.qi, n: st.q.length, pos: a ? (a.currentTime || 0) : 0, dur: d, playing: !!a && !a.paused
    };
  }
  function save(closed) {
    writeSession({ v: 1, ts: Date.now(), owner: 'mini', closed: !!closed, playing: !!a && !a.paused, qi: st.qi, t: a ? (a.currentTime || 0) : 0, queue: st.q, dj: st.dj ? 1 : 0 });
  }

  /* ---------- DJ Juanjo en el portal ----------
   * Si el DJ estaba activo al salir de Budsin Music (bandera "dj" en la sesión), sigue aquí: comentarios entre canciones y
   * la cola que se extiende sola. La lógica vive en bm-dj.js, que solo se descarga cuando hace falta. */
  var djLoading = null;
  function loadDj() {
    if (window.BmDj) return Promise.resolve(window.BmDj);
    if (djLoading) return djLoading;
    djLoading = new Promise(function (res) {
      var sc = document.createElement('script');
      sc.src = ORIGIN + '/bm-dj.js?v=1';
      sc.onload = function () { if (window.BmDj) window.BmDj.onSay = function (t) { st.say = t || ''; render(); }; res(window.BmDj || null); };
      sc.onerror = function () { djLoading = null; res(null); };
      document.head.appendChild(sc);
    });
    return djLoading;
  }
  function djStop() { st.pend = null; st.say = ''; if (window.BmDj) window.BmDj.cancel(); }
  // After a song starts: make sure there is a next one, and prepare what the DJ will say between the two.
  function djPrepare() {
    if (!st.dj || st.mode !== 'local') return;
    var c = st.q[st.qi];
    if (c && c.station) { st.pend = null; return; }            // radio stations never talk
    loadDj().then(function (D) {
      if (!D || !st.dj || st.mode !== 'local' || st.q[st.qi] !== c || !c) return;
      var step = function () {
        if (st.q[st.qi] !== c) return;
        var nx = st.q[st.qi + 1];
        if (!nx) { st.pend = null; return; }
        var key = String(c.id) + '>' + String(nx.id);
        if (st.pend && st.pend.key === key) return;
        st.pend = D.prepare(c, nx);
      };
      if (st.q.length - st.qi <= 3 && !st.extending) {
        st.extending = true;
        D.extend(c, st.q, 12).then(function (add) {
          st.extending = false;
          if (st.dj && st.mode === 'local' && add && add.length) { st.q = st.q.concat(add); save(false); }
          step();
        }, function () { st.extending = false; step(); });
      } else step();
    });
  }
  // The song ended: the DJ speaks the prepared line (if this transition was chosen to be spoken) and then the next one starts.
  function onEnded() {
    var c = st.q[st.qi], nx = st.q[st.qi + 1];
    if (st.dj && window.BmDj && st.pend && c && nx && st.pend.key === String(c.id) + '>' + String(nx.id)) {
      var p = st.pend; st.pend = null;
      window.BmDj.wrap(p, function () { if (st.mode === 'local') go(1, true); });
      return;
    }
    go(1, true);
  }
  function toggleDj() {
    if (st.mode !== 'local') return;
    st.dj = !st.dj;
    if (st.dj) djPrepare(); else djStop();
    save(false); render();
  }

  /* ---------- reproducción local ---------- */
  function ensureAudio() {
    if (a) return;
    a = new Audio();
    a.preload = 'auto';
    a.volume = volume();
    a.addEventListener('ended', onEnded);
    a.addEventListener('error', function () {
      if (++st.errs < 3 && st.qi + 1 < st.q.length) go(1, true); else { st.errs = 0; render(); }
    });
    a.addEventListener('playing', function () { st.errs = 0; st.blocked = false; render(); });
    a.addEventListener('play', render);
    a.addEventListener('pause', function () { render(); if (st.mode === 'local') post({ t: 'hb', from: 'mini', st: snap() }); });
    a.addEventListener('timeupdate', render);
  }
  function load(i, seekTo) {
    var tr = st.q[i];
    if (!tr) { stopLocal(); return; }
    st.qi = i; st.blocked = false;
    if (window.BmDj) window.BmDj.cancel();            // saltar de canción corta lo que el DJ estuviera diciendo
    st.pend = null; st.say = '';
    a.src = streamUrl(tr);
    if (seekTo > 0) { try { a.currentTime = seekTo; } catch (e) {} }
    var p = a.play();
    if (p && p.catch) p.catch(function () { st.blocked = true; render(); });   // autoplay bloqueado: queda el botón ▶
    mediaSession(tr);
    render();
    save(false);
    post({ t: 'hb', from: 'mini', st: snap() });
    djPrepare();
    stationPrepare();
  }
  function go(d, auto) {
    var n = st.qi + d;
    if (n < 0) { if (a) a.currentTime = 0; return; }
    if (n >= st.q.length) { if (auto) { if (a) a.pause(); render(); } return; }
    load(n, 0);
  }
  function stopLocal() {
    if (a) { a.pause(); a.removeAttribute('src'); try { a.load(); } catch (e) {} }
    var s = readSession();
    if (s && s.owner === 'mini') { s.playing = false; s.closed = true; s.ts = Date.now(); s.dj = 0; writeSession(s); }
    djStop(); st.dj = false;
    st.mode = 'none'; st.q = []; st.qi = -1; st.blocked = false;
    render();
  }
  function mediaSession(tr) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: tr.title, artist: tr.artist, artwork: tr.artwork ? [{ src: tr.artwork, sizes: '640x640', type: 'image/jpeg' }] : [] });
      navigator.mediaSession.setActionHandler('play', function () { localCmd('play'); });
      navigator.mediaSession.setActionHandler('pause', function () { localCmd('pause'); });
      navigator.mediaSession.setActionHandler('previoustrack', function () { go(-1, false); });
      navigator.mediaSession.setActionHandler('nexttrack', function () { go(1, false); });
    } catch (e) {}
  }
  function localCmd(c, v) {
    if (!a) return;
    if (c === 'toggle') c = a.paused ? 'play' : 'pause';
    if (c === 'play') { var p = a.play(); if (p && p.catch) p.catch(function () { st.blocked = true; render(); }); }
    else if (c === 'pause') a.pause();
    else if (c === 'next') go(1, false);
    else if (c === 'prev') { if (a.currentTime > 3) a.currentTime = 0; else go(-1, false); }
    else if (c === 'seek' && isFinite(v)) a.currentTime = Math.max(0, v);
  }
  function command(c, v) {
    if (st.mode === 'local') return localCmd(c, v);
    if (st.mode === 'remote' && st.remote) post({ t: 'cmd', to: st.remote.from_id, a: c, v: v });
  }

  /* ---------- relevo ---------- */
  // Retoma lo que Budsin Music dejó sonando al irse (misma pestaña, o su pestaña se cerró).
  function evaluate() {
    var s = readSession();
    if (st.mode === 'local' || !s || !s.closed || !s.playing || !s.queue.length) return;
    if (Date.now() - s.ts > 20000) return;
    var cur = readSession();
    if (!cur || cur.ts !== s.ts || !cur.closed) return;           // otra página llegó antes
    writeSession({ v: 1, ts: Date.now(), owner: 'mini', closed: false, playing: true, qi: s.qi, t: s.t, queue: s.queue, dj: s.dj ? 1 : 0 });
    st.mode = 'local'; st.remote = null; st.dismiss = null; st.dj = !!s.dj; st.pend = null; st.say = '';
    st.q = s.queue.slice(); st.qi = Math.max(0, Math.min(s.qi, s.queue.length - 1));
    ensureAudio();
    post({ t: 'claim', from: 'mini' });
    load(st.qi, (s.t || 0) + (Date.now() - s.ts) / 1000);
  }

  if (bc) bc.onmessage = function (e) {
    var m = e.data || {};
    if (!m || m.id === id) return;
    if (m.t === 'hb' && st.mode !== 'local') {
      st.remote = { st: m.st, at: Date.now(), from_id: m.id };
      if (m.st && m.st.playing) st.seenPlaying = true;
      st.mode = 'remote';
      render();
    } else if (m.t === 'claim' && st.mode === 'local') {
      if (a) a.pause();                                           // alguien más empezó a sonar
      djStop(); st.dj = false;
      st.mode = 'none'; render();
    } else if (m.t === 'cmd' && st.mode === 'local' && m.to === id) {
      localCmd(m.a, m.v);
    } else if (m.t === 'bye' && m.closed && m.playing) {
      setTimeout(evaluate, 40 + Math.random() * 250);
    }
  };

  /* ---------- estaciones (Radio Focus) y volumen ---------- */
  function volume() { try { var v = JSON.parse(localStorage.getItem('bm_vol')); return typeof v === 'number' ? Math.max(0, Math.min(1, v / 100)) : 0.8; } catch (e) { return 0.8; } }
  function setVolume(v) { try { localStorage.setItem('bm_vol', JSON.stringify(Math.round(v))); } catch (e) {} if (a) a.volume = volume(); }
  var stnLoading = null;
  function loadStations() {
    if (window.BmStations) return Promise.resolve(window.BmStations);
    if (stnLoading) return stnLoading;
    stnLoading = new Promise(function (res) {
      var sc = document.createElement('script'); sc.src = ORIGIN + '/bm-stations.js?v=1';
      sc.onload = function () { res(window.BmStations || null); }; sc.onerror = function () { stnLoading = null; res(null); };
      document.head.appendChild(sc);
    });
    return stnLoading;
  }
  function stationPrepare() {
    var c = st.q[st.qi];
    if (!c || !c.station || st.mode !== 'local' || st.extending || st.q.length - st.qi > 4) return;
    loadStations().then(function (S) {
      if (!S || st.mode !== 'local') return;
      st.extending = true;
      S.tracks(c.station, 12, S.haveOf(st.q)).then(function (add) {
        st.extending = false;
        if (add && add.length && st.mode === 'local') { st.q = st.q.concat(add); save(false); }
      }, function () { st.extending = false; });
    });
  }
  function takeOver(queue, qi, seek, dj) {
    st.mode = 'local'; st.remote = null; st.dismiss = null; st.dj = !!dj; st.pend = null; st.say = '';
    st.q = queue; st.qi = qi; ensureAudio();
    post({ t: 'claim', from: 'mini' });
    load(qi, seek || 0);
  }
  function startStation(sid) {
    loadStations().then(function (S) {
      if (!S) return;
      S.tracks(sid, 24, {}).then(function (list) { if (list.length) takeOver(list, 0, 0, false); });
    });
  }
  function resumeLast() {
    var s = readSession();
    if (s && s.queue.length) takeOver(s.queue.slice(), Math.max(0, Math.min(s.qi | 0, s.queue.length - 1)), s.t || 0, s.dj);
  }

  /* ---------- interfaz ---------- */
  var ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zm3.5 7L19 5v14z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM5 5l9.5 7L5 19z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z"/></svg>',
    open: '<svg viewBox="0 0 24 24"><path d="M14 3v2h3.6l-9.8 9.8 1.4 1.4L19 6.4V10h2V3zM5 5h6v2H5v12h12v-6h2v8H3V5z"/></svg>',
    dj: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 00-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7a9 9 0 00-9-9z"/></svg>',
    pip: '<svg viewBox="0 0 24 24"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z"/></svg>',
    vol: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>'
  };
  var pipOk = !!(window.documentPictureInPicture && window.documentPictureInPicture.requestWindow);
  function css() {
    var s = document.createElement('style');
    s.textContent =
      '#bm-mini{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:150;width:min(430px,calc(100vw - 24px));display:none;' +
      'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#eef0f4;background:rgba(16,19,25,.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);' +
      'border:1px solid rgba(255,255,255,.12);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.45);overflow:hidden}' +
      '#bm-mini *{box-sizing:border-box}' +
      '#bm-mini .bmm-bar{height:4px;background:rgba(255,255,255,.12);cursor:pointer;position:relative}' +
      '#bm-mini .bmm-bar::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}' +
      '#bm-mini .bmm-fill{height:100%;width:0;background:linear-gradient(90deg,#25d0b4,#1fa7d8);pointer-events:none}' +
      '#bm-mini .bmm-row{display:flex;align-items:center;gap:10px;padding:10px 10px 10px 12px}' +
      '#bm-mini img{width:46px;height:46px;border-radius:8px;object-fit:cover;background:#222;flex:none}' +
      '#bm-mini .bmm-info{flex:1;min-width:0}' +
      '#bm-mini .bmm-brand{font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:#25d0b4;font-weight:800}' +
      '#bm-mini .bmm-t{font-size:.9rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#bm-mini .bmm-a{font-size:.76rem;color:#9aa3b5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#bm-mini .bmm-a.warn{color:#25d0b4;font-weight:700}' +
      '#bm-mini .bmm-a.say{color:#25d0b4;font-weight:600;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}' +
      '#bm-mini button.bmm-dj.on,#bm-mini button.bmm-pip.on{color:#25d0b4;background:rgba(37,208,180,.14)}' +
      '#bm-mini .bmm-ctl{display:flex;align-items:center;gap:2px;flex:none}' +
      '#bm-mini button,#bm-mini a.bmm-b{width:34px;height:34px;border-radius:50%;border:0;background:none;color:#cfd4df;display:grid;place-items:center;cursor:pointer;padding:0;text-decoration:none}' +
      '#bm-mini button:hover,#bm-mini a.bmm-b:hover{background:rgba(255,255,255,.1);color:#fff}' +
      '#bm-mini svg{width:19px;height:19px;fill:currentColor}' +
      '#bm-mini .bmm-play{width:40px;height:40px;background:#eef0f4;color:#0b0d10}' +
      '#bm-mini .bmm-play:hover{background:#fff;color:#000}' +
      '#bm-mini .bmm-x{width:28px;height:28px;color:#8d95a6}' +
      '#bm-mini .bmm-x svg{width:15px;height:15px}' +
      '#bm-mini .bmm-ext{display:none;padding:2px 14px 14px;border-top:1px solid rgba(255,255,255,.08)}' +
      '#bm-mini.bm-game .bmm-ext{display:block}' +
      '#bm-mini .bmm-vol{display:flex;align-items:center;gap:8px;margin:10px 0 4px;color:#9aa3b5}#bm-mini .bmm-vol svg{width:16px;height:16px;flex:none}' +
      '#bm-mini .bmm-vol input{flex:1;accent-color:#25d0b4;height:4px;margin:0}' +
      '#bm-mini .bmm-h{margin:12px 0 6px;font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;color:#8d95a6;font-weight:800}' +
      '#bm-mini .bmm-stns{display:grid;grid-template-columns:1fr 1fr;gap:6px}' +
      '#bm-mini .bmm-stns button{width:auto;height:auto;border-radius:10px;padding:9px 10px;font-size:.78rem;font-weight:700;color:#fff;text-align:left;display:flex;gap:6px;align-items:center;justify-content:flex-start}' +
      '#bm-mini .bmm-stns button.live{box-shadow:inset 0 0 0 2px #fff}' +
      '#bm-mini .bmm-res{width:100%!important;height:auto!important;border-radius:999px!important;padding:9px 12px;margin-top:10px;font-size:.78rem;font-weight:700;background:rgba(255,255,255,.1)!important;letter-spacing:.05em}' +
      '#bm-mini.bm-game{left:auto;right:14px;bottom:68px;transform:none;width:min(330px,calc(100vw - 28px));z-index:999990}' +
      '#bm-fab{position:fixed;right:14px;bottom:14px;width:44px;height:44px;border-radius:50%;border:0;padding:0;z-index:999991;display:grid;place-items:center;cursor:pointer;color:#eef0f4;' +
      'background:rgba(16,19,25,.9);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 6px 20px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.14);opacity:.78;transition:opacity .15s,transform .15s}' +
      '#bm-fab:hover,#bm-fab.open{opacity:1;transform:scale(1.06)}#bm-fab svg{width:22px;height:22px;fill:currentColor}' +
      '#bm-fab.playing{color:#25d0b4;box-shadow:0 6px 20px rgba(0,0,0,.5),inset 0 0 0 2px #25d0b4}#bm-fab.pip::after{content:"";position:absolute;top:5px;right:5px;width:9px;height:9px;border-radius:50%;background:#25d0b4}' +
      '@media(max-width:480px){#bm-mini.bm-game .bmm-row{flex-wrap:wrap}#bm-mini.bm-game .bmm-info{flex-basis:calc(100% - 66px)}#bm-mini.bm-game .bmm-ctl{width:100%;justify-content:space-between;order:3}}' +
      '@media(max-width:560px){#bm-mini .bmm-brand{display:none}#bm-mini .bmm-prev{display:none}}' +
      '@media(max-width:1100px){body.has-bmmini .promo-video{bottom:92px}body.has-bmmini .host-ad{bottom:216px}}' +
      '@media(max-width:560px){#bm-mini:not(.bm-game){bottom:64px}body.has-bmmini .promo-video{bottom:144px}body.has-bmmini .host-ad{bottom:268px}}';
    document.head.appendChild(s);
  }
  function build() {
    css();
    var root = document.createElement('div');
    root.id = 'bm-mini';
    if (GAME) root.className = 'bm-game';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', GAME ? TX.menu : TX.brand);
    root.innerHTML =
      '<div class="bmm-bar"><div class="bmm-fill"></div></div>' +
      '<div class="bmm-row"><img alt="" referrerpolicy="no-referrer">' +
      '<div class="bmm-info"><div class="bmm-brand">' + TX.brand + '</div><div class="bmm-t"></div><div class="bmm-a"></div></div>' +
      '<div class="bmm-ctl">' +
      '<button class="bmm-prev" data-c="prev" aria-label="' + TX.prev + '" title="' + TX.prev + '">' + ICON.prev + '</button>' +
      '<button class="bmm-play" data-c="toggle" aria-label="' + TX.play + '"></button>' +
      '<button data-c="next" aria-label="' + TX.next + '" title="' + TX.next + '">' + ICON.next + '</button>' +
      '<button class="bmm-dj" data-c="dj" aria-label="' + TX.dj + '" title="' + TX.dj + '" style="display:none">' + ICON.dj + '</button>' +
      (pipOk ? '<button class="bmm-pip" data-c="pip" aria-label="' + TX.pip + '" title="' + TX.pip + '">' + ICON.pip + '</button>' : '') +
      '<a class="bmm-b" href="' + ORIGIN + '/musica/" aria-label="' + TX.open + '" title="' + TX.open + '">' + ICON.open + '</a>' +
      '<button class="bmm-x" data-c="close" aria-label="' + TX.close + '" title="' + TX.close + '">' + ICON.close + '</button>' +
      '</div></div>' +
      '<div class="bmm-ext"><div class="bmm-vol">' + ICON.vol + '<input type="range" class="bmm-vr" min="0" max="100" aria-label="' + TX.vol + '"></div>' +
      '<div class="bmm-h">📻 ' + TX.stations + '</div><div class="bmm-stns"></div>' +
      '<button class="bmm-res" data-c="resume" style="display:none">▶ ' + TX.resume + '</button></div>';
    document.body.appendChild(root);
    // Si la portada no carga directa del CDN (filtro de red, extensión), se pide por el propio servidor.
    root.querySelector('img').addEventListener('error', function () {
      var src = this.getAttribute('src') || '';
      if (!this.getAttribute('data-fb') && /^https:\/\/(resources\.tidal\.com|i\.ytimg\.com|[a-z0-9.\-]+\.googleusercontent\.com)\//.test(src)) {
        this.setAttribute('data-fb', '1'); this.src = ORIGIN + '/api/music/art?u=' + encodeURIComponent(src);
      }
    });
    ui = { dj: root.querySelector('.bmm-dj'), pip: root.querySelector('.bmm-pip'), brand: root.querySelector('.bmm-brand'), root: root, img: root.querySelector('img'), t: root.querySelector('.bmm-t'), a: root.querySelector('.bmm-a'), play: root.querySelector('.bmm-play'), fill: root.querySelector('.bmm-fill'), bar: root.querySelector('.bmm-bar'), ext: root.querySelector('.bmm-ext'), vr: root.querySelector('.bmm-vr'), stns: root.querySelector('.bmm-stns'), res: root.querySelector('.bmm-res'), fab: null, last: {} };
    var vr = ui.vr; vr.value = Math.round(volume() * 100);
    vr.addEventListener('input', function () { setVolume(+vr.value); });
    root.addEventListener('click', function (e) {
      var sb = e.target.closest('[data-stn]');
      if (sb) { startStation(sb.getAttribute('data-stn')); return; }
      var b = e.target.closest('[data-c]');
      if (!b) return;
      var c = b.getAttribute('data-c');
      if (c === 'dj') { toggleDj(); return; }
      if (c === 'pip') { pipToggle(); return; }
      if (c === 'resume') { resumeLast(); return; }
      if (c === 'close') {
        if (GAME) { st.open = false; render(); return; }                      // in a game the X only folds the menu: the music goes on
        if (st.mode === 'local') stopLocal();
        else { var v = view(); if (v) st.dismiss = { id: v.track.id, playing: v.playing }; render(); }
        return;
      }
      command(c);
    });
    ui.bar.addEventListener('click', function (e) {
      var v = view();
      if (!v || !v.dur) return;
      var r = ui.bar.getBoundingClientRect();
      command('seek', Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * v.dur);
    });
    if (GAME) {
      var fab = document.createElement('button');
      fab.id = 'bm-fab'; fab.type = 'button'; fab.setAttribute('aria-label', TX.menu); fab.title = TX.menu; fab.innerHTML = ICON.note;
      fab.addEventListener('click', function () { if (st.pip) pipClose(); else st.open = !st.open; render(); });
      document.body.appendChild(fab); ui.fab = fab;
    }
  }
  function view() {
    if (st.mode === 'local') return snap();
    if (st.mode === 'remote' && st.remote && st.remote.st && st.remote.st.track) {
      var s = {}, r = st.remote;
      for (var k in r.st) s[k] = r.st[k];
      if (s.playing) s.pos = (s.pos || 0) + (Date.now() - r.at) / 1000;
      return s;
    }
    return null;
  }
  function render() {
    var v = view();
    var hide;
    if (GAME) hide = !st.open || !!st.pip;                                      // the game menu: only when opened, and not while the mini window is out
    else {
      hide = !v || (st.mode === 'remote' && !st.seenPlaying) || !!st.pip;
      if (v && st.dismiss) { if (st.dismiss.id === v.track.id && st.dismiss.playing === v.playing) hide = true; else st.dismiss = null; }
    }
    if (st.pip) pipRender(v);
    if (hide && !GAME) {
      if (ui) ui.root.style.display = 'none';
      if (document.body) document.body.classList.remove('has-bmmini');
      return;
    }
    if (!ui) build();
    var L = ui.last;
    if (GAME) {
      var playing = !!(v && v.playing);
      ui.fab.classList.toggle('open', st.open && !st.pip); ui.fab.classList.toggle('playing', playing); ui.fab.classList.toggle('pip', !!st.pip);
      ui.root.style.display = hide ? 'none' : 'block';
      if (hide) return;
    } else { ui.root.style.display = 'block'; document.body.classList.add('has-bmmini'); }
    var tr = v ? v.track : { title: TX.nothing, artist: TX.hint, artwork: '' };
    if (L.art !== tr.artwork) { L.art = tr.artwork; ui.img.removeAttribute('data-fb'); ui.img.src = tr.artwork || ''; ui.img.style.visibility = tr.artwork ? '' : 'hidden'; }
    if (L.title !== tr.title) { L.title = tr.title; ui.t.textContent = tr.title || ''; }
    var sub = st.mode === 'local' && st.say ? '~' + st.say : st.mode === 'local' && st.blocked && v && !v.playing ? '!' + TX.tap : (tr.artist || '');
    if (L.sub !== sub) { L.sub = sub; var warn = sub.charAt(0) === '!', talk = sub.charAt(0) === '~'; ui.a.textContent = warn || talk ? sub.slice(1) : sub; ui.a.className = 'bmm-a' + (warn ? ' warn' : talk ? ' say' : ''); }
    var djOn = st.mode === 'local' && st.dj, stn = v && st.mode === 'local' && st.q[st.qi] && st.q[st.qi].station || '';
    var brand = TX.brand + (djOn ? ' · DJ' : stn ? ' · ' + stn : '');
    if (L.brand !== brand) { L.brand = brand; L.djOn = djOn; ui.dj.classList.toggle('on', djOn); ui.brand.textContent = brand; }
    var djShow = st.mode === 'local' && !stn ? '' : 'none';
    if (L.djShow !== djShow) { L.djShow = djShow; ui.dj.style.display = djShow; }
    var pl = !!(v && v.playing);
    if (L.playing !== pl || L.hasV !== !!v) {
      L.playing = pl; L.hasV = !!v;
      ui.play.innerHTML = pl ? ICON.pause : ICON.play;
      ui.play.setAttribute('aria-label', pl ? TX.pause : TX.play);
      [].forEach.call(ui.root.querySelectorAll('[data-c="prev"],[data-c="toggle"],[data-c="next"]'), function (b) { b.style.display = v ? '' : 'none'; });
    }
    if (ui.pip) ui.pip.classList.toggle('on', !!st.pip);
    if (GAME) {
      var sess = readSession(), canResume = !v && sess && sess.queue.length;
      if (L.res !== !!canResume) { L.res = !!canResume; ui.res.style.display = canResume ? 'block' : 'none'; }
      if (!ui.stns.firstChild) {
        loadStations().then(function (S) {
          if (!S || ui.stns.firstChild) return;
          ui.stns.innerHTML = S.list.map(function (x) { return '<button data-stn="' + x.id + '" style="background:' + x.grad + '">' + x.emoji + ' ' + S.name(x.id, lang) + '</button>'; }).join('');
        });
      }
      [].forEach.call(ui.stns.querySelectorAll('button'), function (b) { b.classList.toggle('live', b.getAttribute('data-stn') === stn); });
      ui.ext.querySelector('.bmm-vol').style.display = st.mode === 'local' || !v ? '' : 'none';
    }
    var pct = v && v.dur ? Math.min(100, Math.max(0, v.pos / v.dur * 100)) : 0;
    ui.fill.style.width = pct.toFixed(1) + '%';
  }

  /* ---------- mini ventana (Document Picture-in-Picture): la otra forma de llevar el control; se pasa de una a otra sin parar la música ---------- */
  var PIP_CSS = '*{box-sizing:border-box}html,body{margin:0;height:100%}body{background:#0b0d10;color:#eef0f4;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden}' +
    '#pp{display:flex;flex-direction:column;gap:8px;height:100%;padding:12px 14px;background:linear-gradient(180deg,rgba(37,208,180,.3),#0b0d10 75%)}' +
    '.top{display:flex;align-items:center;gap:10px;min-width:0}#pi{width:52px;height:52px;border-radius:8px;object-fit:cover;background:#1d222c;flex:none}.mm{min-width:0;flex:1}' +
    '#pt{font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#pa{font-size:12px;color:#9aa3b5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '#pb{height:4px;border-radius:4px;background:rgba(255,255,255,.14);cursor:pointer;flex:none;position:relative}#pb::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}#pf{height:100%;width:0;border-radius:4px;background:#fff;pointer-events:none}#pb:hover #pf{background:#25d0b4}' +
    '.ct{display:flex;justify-content:center;align-items:center;gap:10px;margin-top:auto}.ct button{border:0;background:none;color:#eef0f4;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;cursor:pointer;padding:0}' +
    '.ct button:hover{background:rgba(255,255,255,.12)}.ct svg{width:20px;height:20px;fill:currentColor}.ct #pP{background:#fff;color:#0b0d10;width:40px;height:40px}' +
    '#pBack{position:absolute;top:8px;right:8px;border:0;background:rgba(255,255,255,.1);color:#fff;border-radius:999px;padding:4px 10px;font:600 11px system-ui,sans-serif;cursor:pointer}#pBack:hover{background:rgba(255,255,255,.2)}';
  function pipToggle() { if (st.pip) pipClose(); else pipOpen(); }
  function pipClose() { var w = st.pip; st.pip = null; try { if (w) w.close(); } catch (e) {} render(); }
  function pipOpen() {
    if (!pipOk) return;
    window.documentPictureInPicture.requestWindow({ width: 340, height: 190 }).then(function (w) {
      st.pip = w; st.open = false;
      var d = w.document, sty = d.createElement('style'); sty.textContent = PIP_CSS; d.head.appendChild(sty); d.title = TX.brand;
      d.body.innerHTML = '<div id="pp"><button id="pBack">↩ ' + TX.pipBack + '</button><div class="top"><img id="pi" alt=""><div class="mm"><div id="pt"></div><div id="pa"></div></div></div><div id="pb"><div id="pf"></div></div>' +
        '<div class="ct"><button id="pV" aria-label="' + TX.prev + '">' + ICON.prev + '</button><button id="pP" aria-label="' + TX.play + '"></button><button id="pN" aria-label="' + TX.next + '">' + ICON.next + '</button></div></div>';
      d.getElementById('pV').addEventListener('click', function () { command('prev'); });
      d.getElementById('pP').addEventListener('click', function () { command('toggle'); });
      d.getElementById('pN').addEventListener('click', function () { command('next'); });
      d.getElementById('pb').addEventListener('click', function (e) { var v = view(); if (!v || !v.dur) return; var r = this.getBoundingClientRect(); command('seek', Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * v.dur); });
      d.getElementById('pBack').addEventListener('click', function () { st.open = true; pipClose(); });
      w.addEventListener('pagehide', function () { if (st.pip === w) { st.pip = null; render(); } });
      render();
    }).catch(function () {});
  }
  function pipRender(v) {
    var w = st.pip; if (!w) return;
    var d = w.document, g = function (i) { return d.getElementById(i); };
    if (!g('pt')) return;
    var tr = v ? v.track : { title: TX.nothing, artist: TX.hint, artwork: '' };
    if (g('pt').textContent !== tr.title) g('pt').textContent = tr.title || '';
    if (g('pa').textContent !== (tr.artist || '')) g('pa').textContent = tr.artist || '';
    var im = g('pi'); if (im.getAttribute('data-src') !== (tr.artwork || '')) { im.setAttribute('data-src', tr.artwork || ''); im.src = tr.artwork || ''; im.style.visibility = tr.artwork ? '' : 'hidden'; }
    var pl = !!(v && v.playing), ic = pl ? ICON.pause : ICON.play;
    if (g('pP').getAttribute('data-ic') !== ic) { g('pP').innerHTML = ic; g('pP').setAttribute('data-ic', ic); }
    g('pf').style.width = (v && v.dur ? Math.min(100, Math.max(0, v.pos / v.dur * 100)) : 0).toFixed(1) + '%';
  }
  if (!pipOk) { pipToggle = function () {}; }

  /* ---------- ciclo de vida ---------- */
  setInterval(function () {
    if (st.mode === 'local') {
      post({ t: 'hb', from: 'mini', st: snap() });
    } else if (st.mode === 'remote' && st.remote && Date.now() - st.remote.at > 3500) {
      st.mode = 'none'; st.remote = null; st.seenPlaying = false;     // la pestaña de Budsin Music ya no está
    }
    if (st.mode !== 'none') render(); else if (ui && ui.root.style.display !== 'none') render();
  }, 500);
  setInterval(function () { if (st.mode === 'local') save(false); }, 5000);

  window.addEventListener('pagehide', function () {
    if (st.mode !== 'local' || !a) return;
    save(true);
    post({ t: 'bye', from: 'mini', closed: true, playing: !a.paused });
  });
  // Volver con "atrás" puede traer esta página de la caché (bfcache) sin ejecutar el script otra vez.
  window.addEventListener('pageshow', function (e) { if (e.persisted) { st.mode = st.mode === 'local' ? 'none' : st.mode; evaluate(); } });

  evaluate();
  if (GAME) render();
})();
