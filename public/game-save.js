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

                // ─── Toast for limit reached ───
                function showLimitToast() {
                    var toast = document.createElement("div");
                    toast.textContent = "L\u00edmite de 5 juegos alcanzado. Hazte Pro para ilimitados.";
                    Object.assign(toast.style, {
                        position: "fixed",
                        top: "56px",
                        left: "10px",
                        zIndex: "2147483647",
                        padding: "10px 16px",
                        borderRadius: "12px",
                        background: "rgba(231,76,60,0.9)",
                        color: "#fff",
                        fontSize: "13px",
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontWeight: "600",
                        maxWidth: "300px",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                        backdropFilter: "blur(4px)",
                        pointerEvents: "none",
                        opacity: "0",
                        transition: "opacity .3s",
                    });
                    document.body.appendChild(toast);
                    requestAnimationFrame(function () {
                        toast.style.opacity = "1";
                    });
                    setTimeout(function () {
                        toast.style.opacity = "0";
                        setTimeout(function () { toast.remove(); }, 400);
                    }, 4000);
                }

                // ─── Save button (top-left corner) ───
                var btn = document.createElement("button");
                btn.id = "budsin-save-btn";
                btn.textContent = "\u{1F4BE}";
                btn.title = "Save progress";
                Object.assign(btn.style, {
                    position: "fixed",
                    top: "10px",
                    left: "10px",
                    zIndex: "2147483647",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    border: "1px solid rgba(255,255,255,0.3)",
                    background: "rgba(0,0,0,0.45)",
                    color: "#fff",
                    fontSize: "16px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(4px)",
                    transition: "transform .15s, background .2s",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                });
                btn.addEventListener("mouseenter", function () {
                    btn.style.transform = "scale(1.1)";
                    btn.style.background = "rgba(0,0,0,0.65)";
                });
                btn.addEventListener("mouseleave", function () {
                    btn.style.transform = "scale(1)";
                    btn.style.background = "rgba(0,0,0,0.45)";
                });
                function doSave(showFeedback) {
                    var now = Date.now();
                    var elapsed = now - startTime;
                    BudsinSave.saveNow(gameName, {
                        playCount: session.playCount,
                        totalTimeMs: (session.totalTimeMs || 0) + elapsed,
                        lastPlayed: new Date().toISOString(),
                        browserData: captureLocalStorage(),
                    }).then(function () {
                        if (!showFeedback) return;
                        btn.textContent = "\u2713";
                        btn.style.background = "rgba(46,204,113,0.7)";
                        setTimeout(function () {
                            btn.textContent = "\u{1F4BE}";
                            btn.style.background = "rgba(0,0,0,0.45)";
                        }, 1200);
                    }).catch(function (err) {
                        if (!showFeedback) return;
                        btn.textContent = "\u2717";
                        btn.style.background = "rgba(231,76,60,0.7)";
                        if (err === "LIMIT_REACHED") {
                            showLimitToast();
                        }
                        setTimeout(function () {
                            btn.textContent = "\u{1F4BE}";
                            btn.style.background = "rgba(0,0,0,0.45)";
                        }, 3000);
                    });
                }

                function doLoad() {
                    BudsinSave.load(gameName).then(function (data) {
                        if (data && data.browserData) {
                            restoreLocalStorage(data.browserData);
                            btn.textContent = "\u{1F504}";
                            btn.style.background = "rgba(52,152,219,0.7)";
                            setTimeout(function () {
                                btn.textContent = "\u{1F4BE}";
                                btn.style.background = "rgba(0,0,0,0.45)";
                            }, 1500);
                            setTimeout(function () { location.reload(); }, 800);
                        } else {
                            btn.textContent = "!";
                            btn.style.background = "rgba(243,156,18,0.7)";
                            setTimeout(function () {
                                btn.textContent = "\u{1F4BE}";
                                btn.style.background = "rgba(0,0,0,0.45)";
                            }, 1500);
                        }
                    }).catch(function () {});
                }

                btn.addEventListener("click", function () {
                    var existing = document.getElementById("budsin-save-menu");
                    if (existing) { existing.remove(); return; }

                    var menu = document.createElement("div");
                    menu.id = "budsin-save-menu";
                    Object.assign(menu.style, {
                        position: "fixed",
                        top: "52px",
                        left: "10px",
                        zIndex: "2147483647",
                        background: "rgba(20,20,30,0.92)",
                        backdropFilter: "blur(8px)",
                        borderRadius: "12px",
                        border: "1px solid rgba(255,255,255,0.15)",
                        padding: "6px",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: "13px",
                        color: "#fff",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        minWidth: "130px",
                    });

                    function makeOption(text, icon, fn) {
                        var opt = document.createElement("button");
                        opt.textContent = icon + " " + text;
                        Object.assign(opt.style, {
                            background: "transparent",
                            border: "none",
                            color: "#fff",
                            padding: "8px 12px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "13px",
                            textAlign: "left",
                            fontFamily: "inherit",
                            transition: "background .15s",
                        });
                        opt.addEventListener("mouseenter", function () { opt.style.background = "rgba(255,255,255,0.1)"; });
                        opt.addEventListener("mouseleave", function () { opt.style.background = "transparent"; });
                        opt.addEventListener("click", function (e) {
                            e.stopPropagation();
                            fn();
                            menu.remove();
                        });
                        return opt;
                    }

                    menu.appendChild(makeOption("Save", "\u{1F4BE}", function () { doSave(true); }));
                    menu.appendChild(makeOption("Load", "\u{1F4C2}", doLoad));

                    document.body.appendChild(menu);
                    setTimeout(function () {
                        document.addEventListener("click", function closeOnOutside(e) {
                            if (!menu.contains(e.target) && e.target !== btn) {
                                menu.remove();
                                document.removeEventListener("click", closeOnOutside);
                            }
                        });
                    }, 0);
                });
                document.body.appendChild(btn);
            }).catch(function () {});
        }).catch(function () {});
    }

    loadFirebase()
        .then(loadSaveSystem)
        .then(trySave)
        .catch(function () {});
})();
