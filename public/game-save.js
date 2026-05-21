(function () {
    "use strict";

    var gameName = "";
    try {
        var path = window.location.pathname.split("/").pop();
        gameName = path.replace(/\.html$/i, "").toLowerCase();
        if (!gameName || gameName === "" || gameName === "index") return;
    } catch (_) { return; }

    // Load Firebase SDK dynamically if not present
    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            if (document.querySelector('script[src="' + src + '"]')) {
                resolve();
                return;
            }
            var s = document.createElement("script");
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    function loadFirebase() {
        if (window.firebase) return Promise.resolve();
        return loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js")
            .then(function () {
                return loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js");
            })
            .then(function () {
                return loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js");
            });
    }

    function loadSaveSystem() {
        if (window.BudsinSave) return Promise.resolve();
        return loadScript("https://budsin-games.pages.dev/save-system.js");
    }

    function trySave() {
        if (!window.BudsinSave || !window.BudsinSave.init) {
            setTimeout(trySave, 500);
            return;
        }

        BudsinSave.init().then(function (ok) {
            if (!ok) return;

            BudsinSave.load(gameName).then(function (data) {
                var session = data || { playCount: 0, totalTimeMs: 0 };

                session.playCount = (session.playCount || 0) + 1;
                session.lastPlayed = new Date().toISOString();
                var startTime = Date.now();

                BudsinSave.autoSave(gameName, function () {
                    var elapsed = Date.now() - startTime;
                    return {
                        playCount: session.playCount,
                        totalTimeMs: (session.totalTimeMs || 0) + elapsed,
                        lastPlayed: new Date().toISOString(),
                    };
                });

                window.addEventListener("beforeunload", function () {
                    var elapsed = Date.now() - startTime;
                    BudsinSave.saveNow(gameName, {
                        playCount: session.playCount,
                        totalTimeMs: (session.totalTimeMs || 0) + elapsed,
                        lastPlayed: new Date().toISOString(),
                    }).catch(function () {});
                });
            }).catch(function () {});
        }).catch(function () {});
    }

    // Load Firebase → load save-system → start saving
    loadFirebase()
        .then(loadSaveSystem)
        .then(trySave)
        .catch(function () {});
})();
