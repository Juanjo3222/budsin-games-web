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
    es: { open: 'Abrir Budsin Music', close: 'Cerrar', play: 'Reproducir', pause: 'Pausar', prev: 'Anterior', next: 'Siguiente', tap: 'Toca ▶ para continuar', brand: 'Budsin Music', dj: 'DJ Juanjo: activar o desactivar' },
    en: { open: 'Open Budsin Music', close: 'Close', play: 'Play', pause: 'Pause', prev: 'Previous', next: 'Next', tap: 'Tap ▶ to continue', brand: 'Budsin Music', dj: 'DJ Juanjo: turn on or off' },
    pt: { open: 'Abrir Budsin Music', close: 'Fechar', play: 'Reproduzir', pause: 'Pausar', prev: 'Anterior', next: 'Próxima', tap: 'Toque em ▶ para continuar', brand: 'Budsin Music', dj: 'DJ Juanjo: ligar ou desligar' }
  }[lang];

  var st = { mode: 'none', remote: null, seenPlaying: false, dismiss: null, q: [], qi: -1, blocked: false, errs: 0, dj: false, pend: null, say: '', extending: false };
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
      sc.src = '/bm-dj.js?v=1';
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

  /* ---------- interfaz ---------- */
  var ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zm3.5 7L19 5v14z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM5 5l9.5 7L5 19z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z"/></svg>',
    open: '<svg viewBox="0 0 24 24"><path d="M14 3v2h3.6l-9.8 9.8 1.4 1.4L19 6.4V10h2V3zM5 5h6v2H5v12h12v-6h2v8H3V5z"/></svg>',
    dj: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 00-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7a9 9 0 00-9-9z"/></svg>'
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
      '#bm-mini .bmm-a.say{color:#25d0b4;font-weight:600;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}' +
      '#bm-mini button.bmm-dj.on{color:#25d0b4;background:rgba(37,208,180,.14)}' +
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
      '<button class="bmm-dj" data-c="dj" aria-label="' + TX.dj + '" title="' + TX.dj + '" style="display:none">' + ICON.dj + '</button>' +
      '<a class="bmm-b" href="/musica/" aria-label="' + TX.open + '" title="' + TX.open + '">' + ICON.open + '</a>' +
      '<button class="bmm-x" data-c="close" aria-label="' + TX.close + '" title="' + TX.close + '">' + ICON.close + '</button>' +
      '</div></div>';
    document.body.appendChild(root);
    // Si la portada no carga directa del CDN (filtro de red, extensión), se pide por el propio servidor.
    root.querySelector('img').addEventListener('error', function () {
      var src = this.getAttribute('src') || '';
      if (!this.getAttribute('data-fb') && /^https:\/\/(resources\.tidal\.com|i\.ytimg\.com|[a-z0-9.\-]+\.googleusercontent\.com)\//.test(src)) {
        this.setAttribute('data-fb', '1'); this.src = '/api/music/art?u=' + encodeURIComponent(src);
      }
    });
    ui = { dj: root.querySelector('.bmm-dj'), brand: root.querySelector('.bmm-brand'), root: root, img: root.querySelector('img'), t: root.querySelector('.bmm-t'), a: root.querySelector('.bmm-a'), play: root.querySelector('.bmm-play'), fill: root.querySelector('.bmm-fill'), bar: root.querySelector('.bmm-bar'), art: null, playing: null, last: {} };
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-c]');
      if (!b) return;
      var c = b.getAttribute('data-c');
      if (c === 'dj') { toggleDj(); return; }
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
    if (L.art !== v.track.artwork) { L.art = v.track.artwork; ui.img.removeAttribute('data-fb'); ui.img.src = v.track.artwork || ''; }
    if (L.title !== v.track.title) { L.title = v.track.title; ui.t.textContent = v.track.title || ''; }
    var sub = st.mode === 'local' && st.say ? '~' + st.say : st.mode === 'local' && st.blocked && !v.playing ? '!' + TX.tap : (v.track.artist || '');
    if (L.sub !== sub) { L.sub = sub; var warn = sub.charAt(0) === '!', talk = sub.charAt(0) === '~'; ui.a.textContent = warn || talk ? sub.slice(1) : sub; ui.a.className = 'bmm-a' + (warn ? ' warn' : talk ? ' say' : ''); }
    var djOn = st.mode === 'local' && st.dj;
    if (L.djOn !== djOn) { L.djOn = djOn; ui.dj.classList.toggle('on', djOn); ui.brand.textContent = TX.brand + (djOn ? ' · DJ' : ''); }
    var djShow = st.mode === 'local' ? '' : 'none';
    if (L.djShow !== djShow) { L.djShow = djShow; ui.dj.style.display = djShow; }
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
