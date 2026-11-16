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
    es: { open: 'Abrir Budsin Music', close: 'Cerrar', play: 'Reproducir', pause: 'Pausar', prev: 'Anterior', next: 'Siguiente', tap: 'Toca ▶ para continuar', brand: 'Budsin Music' },
    en: { open: 'Open Budsin Music', close: 'Close', play: 'Play', pause: 'Pause', prev: 'Previous', next: 'Next', tap: 'Tap ▶ to continue', brand: 'Budsin Music' },
    pt: { open: 'Abrir Budsin Music', close: 'Fechar', play: 'Reproduzir', pause: 'Pausar', prev: 'Anterior', next: 'Próxima', tap: 'Toque em ▶ para continuar', brand: 'Budsin Music' }
  }[lang];

  var st = { mode: 'none', remote: null, seenPlaying: false, dismiss: null, q: [], qi: -1, blocked: false, errs: 0 };
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
    return '/api/music/stream?' + p.toString();
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
    writeSession({ v: 1, ts: Date.now(), owner: 'mini', closed: !!closed, playing: !!a && !a.paused, qi: st.qi, t: a ? (a.currentTime || 0) : 0, queue: st.q });
  }

  /* ---------- reproducción local ---------- */
  function ensureAudio() {
    if (a) return;
    a = new Audio();
    a.preload = 'auto';
    a.addEventListener('ended', function () { go(1, true); });
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
    a.src = streamUrl(tr);
    if (seekTo > 0) { try { a.currentTime = seekTo; } catch (e) {} }
    var p = a.play();
    if (p && p.catch) p.catch(function () { st.blocked = true; render(); });   // autoplay bloqueado: queda el botón ▶
    mediaSession(tr);
    render();
    save(false);
    post({ t: 'hb', from: 'mini', st: snap() });
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
    if (s && s.owner === 'mini') { s.playing = false; s.closed = true; s.ts = Date.now(); writeSession(s); }
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
    writeSession({ v: 1, ts: Date.now(), owner: 'mini', closed: false, playing: true, qi: s.qi, t: s.t, queue: s.queue });
    st.mode = 'local'; st.remote = null; st.dismiss = null;
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
      st.mode = 'none'; render();
    } else if (m.t === 'cmd' && st.mode === 'local' && m.to === id) {
      localCmd(m.a, m.v);
    } else if (m.t === 'bye' && m.closed && m.playing) {
      setTimeout(evaluate, 40 + Math.random() * 250);
    }
  };

  /* ---------- interfaz ---------- */
  var ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zm3.5 7L19 5v14z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM5 5l9.5 7L5 19z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z"/></svg>',
    open: '<svg viewBox="0 0 24 24"><path d="M14 3v2h3.6l-9.8 9.8 1.4 1.4L19 6.4V10h2V3zM5 5h6v2H5v12h12v-6h2v8H3V5z"/></svg>'
  };
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
      '#bm-mini .bmm-ctl{display:flex;align-items:center;gap:2px;flex:none}' +
      '#bm-mini button,#bm-mini a.bmm-b{width:34px;height:34px;border-radius:50%;border:0;background:none;color:#cfd4df;display:grid;place-items:center;cursor:pointer;padding:0;text-decoration:none}' +
      '#bm-mini button:hover,#bm-mini a.bmm-b:hover{background:rgba(255,255,255,.1);color:#fff}' +
      '#bm-mini svg{width:19px;height:19px;fill:currentColor}' +
      '#bm-mini .bmm-play{width:40px;height:40px;background:#eef0f4;color:#0b0d10}' +
      '#bm-mini .bmm-play:hover{background:#fff;color:#000}' +
      '#bm-mini .bmm-x{width:28px;height:28px;color:#8d95a6}' +
      '#bm-mini .bmm-x svg{width:15px;height:15px}' +
      '@media(max-width:560px){#bm-mini .bmm-brand{display:none}#bm-mini .bmm-prev{display:none}}' +
      '@media(max-width:1100px){body.has-bmmini .promo-video{bottom:92px}body.has-bmmini .host-ad{bottom:216px}}' +
      // En celular el botón flotante "Ocultar" del portal ocupa la esquina inferior izquierda: el overlay va encima.
      '@media(max-width:560px){#bm-mini{bottom:64px}body.has-bmmini .promo-video{bottom:144px}body.has-bmmini .host-ad{bottom:268px}}';
    document.head.appendChild(s);
  }
  function build() {
    css();
    var root = document.createElement('div');
    root.id = 'bm-mini';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', TX.brand);
    root.innerHTML =
      '<div class="bmm-bar"><div class="bmm-fill"></div></div>' +
      '<div class="bmm-row"><img alt="" referrerpolicy="no-referrer">' +
      '<div class="bmm-info"><div class="bmm-brand">' + TX.brand + '</div><div class="bmm-t"></div><div class="bmm-a"></div></div>' +
      '<div class="bmm-ctl">' +
      '<button class="bmm-prev" data-c="prev" aria-label="' + TX.prev + '" title="' + TX.prev + '">' + ICON.prev + '</button>' +
      '<button class="bmm-play" data-c="toggle" aria-label="' + TX.play + '"></button>' +
      '<button data-c="next" aria-label="' + TX.next + '" title="' + TX.next + '">' + ICON.next + '</button>' +
      '<a class="bmm-b" href="/musica/" aria-label="' + TX.open + '" title="' + TX.open + '">' + ICON.open + '</a>' +
      '<button class="bmm-x" data-c="close" aria-label="' + TX.close + '" title="' + TX.close + '">' + ICON.close + '</button>' +
      '</div></div>';
    document.body.appendChild(root);
    ui = { root: root, img: root.querySelector('img'), t: root.querySelector('.bmm-t'), a: root.querySelector('.bmm-a'), play: root.querySelector('.bmm-play'), fill: root.querySelector('.bmm-fill'), bar: root.querySelector('.bmm-bar'), art: null, playing: null, last: {} };
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-c]');
      if (!b) return;
      var c = b.getAttribute('data-c');
      if (c === 'close') {
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
    var hide = !v || (st.mode === 'remote' && !st.seenPlaying);
    if (v && st.dismiss) {
      if (st.dismiss.id === v.track.id && st.dismiss.playing === v.playing) hide = true; else st.dismiss = null;
    }
    if (hide) {
      if (ui) ui.root.style.display = 'none';
      if (document.body) document.body.classList.remove('has-bmmini');
      return;
    }
    if (!ui) build();
    var L = ui.last;
    ui.root.style.display = 'block';
    document.body.classList.add('has-bmmini');
    if (L.art !== v.track.artwork) { L.art = v.track.artwork; ui.img.src = v.track.artwork || ''; }
    if (L.title !== v.track.title) { L.title = v.track.title; ui.t.textContent = v.track.title || ''; }
    var sub = st.mode === 'local' && st.blocked && !v.playing ? '!' + TX.tap : (v.track.artist || '');
    if (L.sub !== sub) { L.sub = sub; var warn = sub.charAt(0) === '!'; ui.a.textContent = warn ? sub.slice(1) : sub; ui.a.className = 'bmm-a' + (warn ? ' warn' : ''); }
    if (L.playing !== v.playing) {
      L.playing = v.playing;
      ui.play.innerHTML = v.playing ? ICON.pause : ICON.play;
      ui.play.setAttribute('aria-label', v.playing ? TX.pause : TX.play);
    }
    var pct = v.dur ? Math.min(100, Math.max(0, v.pos / v.dur * 100)) : 0;
    ui.fill.style.width = pct.toFixed(1) + '%';
  }

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
})();
