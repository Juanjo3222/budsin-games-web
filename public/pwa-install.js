/* Budsin Games · invitación a instalar la app (PWA).
 *
 * El portal ya es instalable (manifest + service worker); este script solo lo hace visible: cuando el navegador dice que
 * se puede instalar, muestra un aviso pequeño y descartable arriba. En iPhone/iPad (Safari no avisa) explica el gesto
 * "Compartir > Añadir a pantalla de inicio". No sale si ya está instalada, ni dentro de /musica/ (Budsin Music tiene su
 * propio botón), y si lo cierras no vuelve a salir en 14 días. */
(function () {
  'use strict';
  if (window.__pwaInstall) return;
  window.__pwaInstall = true;
  if (location.pathname.indexOf('/musica/') === 0) return;
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if (standalone) return;

  var KEY = 'budsin_pwa_dismiss';
  function dismissed() { try { return Date.now() - (+localStorage.getItem(KEY) || 0) < 14 * 86400000; } catch (e) { return false; } }
  var lang = 'es';
  try { var l = (localStorage.getItem('budsin_language') || '').slice(0, 2).toLowerCase(); if (l === 'en' || l === 'pt') lang = l; } catch (e) {}
  var TX = {
    es: { t: 'Instala Budsin como app', b: 'Instalar', x: 'Ahora no', ios: 'Toca Compartir y luego «Añadir a pantalla de inicio».' },
    en: { t: 'Install Budsin as an app', b: 'Install', x: 'Not now', ios: 'Tap Share, then “Add to Home Screen”.' },
    pt: { t: 'Instale o Budsin como app', b: 'Instalar', x: 'Agora não', ios: 'Toque em Compartilhar e depois em “Adicionar à Tela de Início”.' }
  }[lang];
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  var ev = null, bar = null;

  function close(remember) {
    if (remember) { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} }
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    bar = null;
  }
  function show() {
    if (bar || dismissed() || !(ev || ios)) return;
    var s = document.createElement('style');
    s.textContent = '#bm-pwa{position:fixed;left:50%;top:74px;transform:translateX(-50%);z-index:140;display:flex;align-items:center;gap:12px;max-width:min(520px,calc(100vw - 24px));padding:10px 12px 10px 16px;' +
      'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:.86rem;color:#fff;background:rgba(24,24,24,.96);backdrop-filter:blur(10px);border-radius:999px;box-shadow:rgba(0,0,0,.5) 0 8px 24px}' +
      '#bm-pwa span{flex:1;min-width:0}#bm-pwa button{border:0;cursor:pointer;font:inherit;border-radius:999px;padding:7px 14px;font-weight:700}' +
      '#bm-pwa .go{background:#25d0b4;color:#000;letter-spacing:.06em;text-transform:uppercase;font-size:.72rem}#bm-pwa .no{background:none;color:#b3b3b3}' +
      '@media(max-width:560px){#bm-pwa{border-radius:16px;top:68px}}';
    document.head.appendChild(s);
    bar = document.createElement('div');
    bar.id = 'bm-pwa'; bar.setAttribute('role', 'dialog'); bar.setAttribute('aria-label', TX.t);
    bar.innerHTML = '<span>📲 ' + (ev ? TX.t : TX.ios) + '</span>' + (ev ? '<button class="go">' + TX.b + '</button>' : '') + '<button class="no">' + TX.x + '</button>';
    document.body.appendChild(bar);
    bar.querySelector('.no').addEventListener('click', function () { close(true); });
    var go = bar.querySelector('.go');
    if (go) go.addEventListener('click', function () {
      var e = ev; ev = null; close(false);
      e.prompt(); if (e.userChoice) e.userChoice.then(function (c) { if (c && c.outcome !== 'accepted') { try { localStorage.setItem(KEY, String(Date.now())); } catch (x) {} } });
    });
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); ev = e; setTimeout(show, 6000); });
  window.addEventListener('appinstalled', function () { ev = null; close(false); });
  if (ios) window.addEventListener('load', function () { setTimeout(show, 8000); });
})();
