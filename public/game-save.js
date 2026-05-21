(function () {
    "use strict";

    var gameName = "";
    try {
        var path = window.location.pathname.split("/").pop();
        gameName = path.replace(/\.html$/i, "").toLowerCase();
        if (!gameName || gameName === "" || gameName === "index") return;
    } catch (_) { return; }

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

    // Read ALL game data from localStorage (exclude budsin_ internal keys)
    function captureLocalStorage() {
        var result = {};
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (!key) continue;
                if (key.indexOf("budsin_") === 0) continue;
                if (key.indexOf("firebase:") === 0) continue;
                result[key] = localStorage.getItem(key);
            }
        } catch (_) {}
        return result;
    }

    // Write saved data back to localStorage (restore progress from cloud)
    function restoreLocalStorage(data) {
        if (!data || typeof data !== "object") return;
        try {
            for (var key in data) {
                if (data.hasOwnProperty(key) && typeof data[key] === "string") {
                    localStorage.setItem(key, data[key]);
                }
            }
        } catch (_) {}
    }

    function trySave() {
        if (!window.BudsinSave || !window.BudsinSave.init) {
            setTimeout(trySave, 500);
            return;
        }

        BudsinSave.init().then(function (ok) {
            if (!ok) return;

            BudsinSave.load(gameName).then(function (data) {
                var session = data || {};
                var prevBrowser = session.browserData || {};

                // Restore game progress from cloud into localStorage
                restoreLocalStorage(prevBrowser);

                session.playCount = (session.playCount || 0) + 1;
                session.lastPlayed = new Date().toISOString();
                var startTime = Date.now();

                // Auto-save every 5 min: captures localStorage game data
                BudsinSave.autoSave(gameName, function () {
                    var elapsed = Date.now() - startTime;
                    return {
                        playCount: session.playCount,
                        totalTimeMs: (session.totalTimeMs || 0) + elapsed,
                        lastPlayed: new Date().toISOString(),
                        browserData: captureLocalStorage(),
                    };
                });

                // Save on page unload
                window.addEventListener("beforeunload", function () {
                    var elapsed = Date.now() - startTime;
                    BudsinSave.saveNow(gameName, {
                        playCount: session.playCount,
                        totalTimeMs: (session.totalTimeMs || 0) + elapsed,
                        lastPlayed: new Date().toISOString(),
                        browserData: captureLocalStorage(),
                    }).catch(function () {});
                });

                // Force first save immediately to push current localStorage data
                setTimeout(function () {
                    BudsinSave.saveNow(gameName, {
                        playCount: session.playCount,
                        totalTimeMs: 0,
                        lastPlayed: new Date().toISOString(),
                        browserData: captureLocalStorage(),
                    }).catch(function () {});
                }, 2000);
            }).catch(function () {});
        }).catch(function () {});
    }

    loadFirebase()
        .then(loadSaveSystem)
        .then(trySave)
        .catch(function () {});
})();
