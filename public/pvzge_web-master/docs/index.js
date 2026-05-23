System.register(["./application.js"], function (_export, _context) {
  "use strict";

  var Application, canvas, $p, bcr, application;

  function updateLoading(pct) {
    var bar = document.getElementById('loadingBar');
    var pctEl = document.getElementById('loadingPct');
    if (bar) bar.style.width = Math.min(pct, 100) + '%';
    if (pctEl) pctEl.textContent = Math.round(Math.min(pct, 100)) + '%';
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
      canvas = document.getElementById('GameCanvas');
      $p = canvas.parentElement;
      bcr = $p.getBoundingClientRect();
      canvas.width = bcr.width;
      canvas.height = bcr.height;

      // Simular progreso mientras se cargan modulos
      var progress = 0;
      var progTimer = setInterval(function () {
        if (progress < 85) {
          progress += 1 + Math.random() * 3;
          updateLoading(progress);
        }
      }, 200);

      application = new Application();
      topLevelImport('cc').then(function (engine) {
        return application.init(engine);
      }).then(function () {
        clearInterval(progTimer);
        updateLoading(100);
        setTimeout(function () { hideLoading(); }, 200);
        return application.start();
      })["catch"](function (err) {
        clearInterval(progTimer);
        hideLoading();
        console.error(err);
      });
    }
  };
});