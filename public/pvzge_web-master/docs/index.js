System.register(["./application.js"], function (_export, _context) {
  "use strict";

  var Application, canvas, $p, bcr, application;

  var _loading = { bar: null, pct: null };
  function initLoadingUI() {
    _loading.bar = document.getElementById('loadingBar');
    _loading.pct = document.getElementById('loadingPct');
  }

  var _milestones = [
    { name: 'polyfills', pct: 5, done: false },
    { name: 'systemjs', pct: 10, done: false },
    { name: 'index_js', pct: 20, done: false },
    { name: 'application_js', pct: 30, done: false },
    { name: 'cc_engine', pct: 55, done: false },
    { name: 'game_init', pct: 85, done: false },
    { name: 'game_ready', pct: 100, done: false },
  ];
  var _reachedPct = 0;

  function reachMilestone(name) {
    for (var i = 0; i < _milestones.length; i++) {
      var m = _milestones[i];
      if (m.name === name) { m.done = true; break; }
    }
    var highest = 0;
    for (var j = 0; j < _milestones.length; j++) {
      if (_milestones[j].done) highest = _milestones[j].pct;
    }
    if (highest > _reachedPct) {
      _reachedPct = highest;
      if (_loading.bar) _loading.bar.style.width = highest + '%';
      if (_loading.pct) _loading.pct.textContent = highest + '%';
    }
  }

  function hideLoading() {
    var screen = document.getElementById('loadingScreen');
    if (screen) {
      screen.style.opacity = '0';
      setTimeout(function () { screen.style.display = 'none'; }, 400);
    }
  }

  function topLevelImport(url) {
    return System["import"](url);
  }
  return {
    setters: [function (_applicationJs) {
      Application = _applicationJs.Application;
    }],
    execute: function () {
      initLoadingUI();
      if (window.__polyfillsLoaded) reachMilestone('polyfills');
      if (window.__systemjsLoaded) reachMilestone('systemjs');
      reachMilestone('application_js');

      canvas = document.getElementById('GameCanvas');
      $p = canvas.parentElement;
      bcr = $p.getBoundingClientRect();
      canvas.width = bcr.width;
      canvas.height = bcr.height;
      reachMilestone('index_js');

      application = new Application();
      topLevelImport('cc').then(function (engine) {
        reachMilestone('cc_engine');
        return application.init(engine);
      }).then(function () {
        reachMilestone('game_init');
        return application.start();
      }).then(function () {
        reachMilestone('game_ready');
        setTimeout(function () { hideLoading(); }, 300);
      })["catch"](function (err) {
        hideLoading();
        console.error(err);
      });
    }
  };
});