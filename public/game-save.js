(function () {
    "use strict";

    window.__isUnityGame = function isUnityGame() {
        return typeof window.createUnityInstance === 'function' ||
            typeof window.UnityLoader === 'object' ||
            (typeof window.unityInstance !== 'undefined' && window.unityInstance !== null);
    };

    function normalizeName(name) {
        return (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    function autoDetectGameType(gameName) {
        if (window.__isUnityGame()) return Promise.resolve("unity");

        var norm = normalizeName(gameName);
        if (!window.indexedDB || !window.indexedDB.databases) return Promise.resolve("localstorage");

        return window.indexedDB.databases().then(function (dbs) {
            for (var i = 0; i < dbs.length; i++) {
                var dbNorm = normalizeName(dbs[i].name);
                if (dbNorm && dbNorm.indexOf(norm) !== -1) {
                    return "unity";
                }
                if (norm && norm.indexOf(dbNorm) !== -1) {
                    return "unity";
                }
            }
            return "localstorage";
        }).catch(function () {
            return "localstorage";
        });
    }

    window.GameSave = function (gameName) {
        if (!gameName) throw new Error("gameName is required");
        this.gameName = gameName;
        this.state = {};
        this.gameType = null;
        this.initialized = false;
        this.idbDatabases = null;
    };

    window.GameSave.prototype = {

        init: function () {
            var self = this;

            return autoDetectGameType(self.gameName).then(function (type) {
                self.gameType = type;

                if (self.gameType === "localstorage") {
                    self._loadLocalStorage();

                    if (window.BudsinSave) {
                        return window.BudsinSave.init()
                            .then(function () {
                                return window.BudsinSave.load(self.gameName);
                            })
                            .then(function (data) {
                                if (data) {
                                    try {
                                        self.state = typeof data === "string" ? JSON.parse(data) : data;
                                        self._saveLocalStorage();
                                    } catch (_) {
                                        self.state = data;
                                    }
                                }
                            })
                            .catch(function (err) {
                                console.warn("[GameSave] Firebase load failed (using local):", err);
                            })
                            .then(function () {
                                self.initialized = true;
                                return self.state;
                            });
                    } else {
                        self.initialized = true;
                        return self.state;
                    }
                } else {
                    if (!window.IDBGameSave) {
                        console.warn("[GameSave] IDBGameSave not available");
                        self.initialized = true;
                        return null;
                    }
                    var idbGame = new window.IDBGameSave(self.gameName);
                    self._idbInstance = idbGame;
                    return idbGame.init().then(function (snapshot) {
                        self.initialized = true;
                        return snapshot;
                    });
                }
            }).catch(function (err) {
                console.warn("[GameSave] Init failed:", err);
                self.initialized = true;
                return null;
            });
        },

        getState: function () {
            return JSON.parse(JSON.stringify(this.state));
        },

        setState: function (newState) {
            if (typeof newState !== "object" || newState === null) {
                throw new Error("setState requires an object");
            }
            this.state = JSON.parse(JSON.stringify(newState));
        },

        mergeState: function (partial) {
            if (typeof partial !== "object" || partial === null) {
                throw new Error("mergeState requires an object");
            }
            this.state = Object.assign(this.state, JSON.parse(JSON.stringify(partial)));
        },

        saveNow: function () {
            var self = this;

            if (self.gameType === "unity" && self._idbInstance) {
                return self._idbInstance.saveNow();
            }

            if (!window.BudsinSave) {
                self._saveLocalStorage();
                return Promise.resolve();
            }

            return window.BudsinSave.saveNow(self.gameName, self.state).catch(function (err) {
                if (err === "LIMIT_REACHED") {
                    console.warn("[GameSave] Free tier limit reached");
                    self._saveLocalStorage();
                    return;
                }
                console.warn("[GameSave] Cloud save failed, saving locally:", err);
                self._saveLocalStorage();
            });
        },

        startAutoSave: function () {
            var self = this;

            if (self.gameType === "unity" && self._idbInstance) {
                return self._idbInstance.startAutoSave();
            }

            if (!window.BudsinSave) return;

            window.BudsinSave.autoSave(self.gameName, function () {
                return self.getState();
            });
        },

        stopAutoSave: function () {
            if (this.gameType === "unity" && this._idbInstance) {
                return this._idbInstance.stopAutoSave();
            }

            if (window.BudsinSave) {
                window.BudsinSave.stopAutoSave(this.gameName);
            }
        },

        'delete': function () {
            var self = this;

            if (self.gameType === "unity" && self._idbInstance) {
                return self._idbInstance.delete();
            }

            var key = "game_" + self.gameName;
            try { window.localStorage.removeItem(key); } catch (_) {}

            if (!window.BudsinSave) return Promise.resolve();
            return window.BudsinSave.remove(self.gameName);
        },

        getInfo: function () {
            if (this.gameType === "unity" && this._idbInstance) {
                return this._idbInstance.getInfo();
            }

            if (!window.BudsinSave) return Promise.resolve(null);
            return window.BudsinSave.getInfo(this.gameName);
        },

        _loadLocalStorage: function () {
            var key = "game_" + this.gameName;
            try {
                var stored = window.localStorage.getItem(key);
                if (stored) {
                    this.state = JSON.parse(stored);
                }
            } catch (_) {}
            this.initialized = true;
            return this.state;
        },

        _saveLocalStorage: function () {
            var key = "game_" + this.gameName;
            try {
                window.localStorage.setItem(key, JSON.stringify(this.state));
            } catch (_) {}
            return Promise.resolve();
        },
    };

    window.IDBGameSave = function (gameName) {
        if (!gameName) throw new Error("gameName is required");
        this.gameName = gameName;
        this.snapshot = null;
        this.initialized = false;
    };

    window.IDBGameSave.prototype = {

        init: function () {
            var self = this;
            var idbHelpers = window.__BudsinIDB;

            if (!idbHelpers) {
                console.warn("[IDBGameSave] IDB helpers not available");
                return Promise.resolve(null);
            }

            return idbHelpers.enumerate().then(function (dbNames) {
                return idbHelpers.snapshot(dbNames);
            }).then(function (currentSnapshot) {
                self.snapshot = currentSnapshot;

                if (window.BudsinSave) {
                    return window.BudsinSave.loadIDB(self.gameName).then(function (savedSnapshot) {
                        if (savedSnapshot) {
                            self.snapshot = savedSnapshot;
                            return idbHelpers.restore(savedSnapshot);
                        }
                        return null;
                    }).catch(function (err) {
                        console.warn("[IDBGameSave] Cloud load failed:", err);
                        return null;
                    });
                }
            }).then(function () {
                self.initialized = true;
                return self.snapshot;
            }).catch(function (err) {
                console.warn("[IDBGameSave] Init failed:", err);
                self.initialized = true;
                return null;
            });
        },

        getSnapshot: function () {
            if (!this.snapshot) return null;
            return JSON.parse(JSON.stringify(this.snapshot));
        },

        saveNow: function () {
            var self = this;
            var idbHelpers = window.__BudsinIDB;

            if (!idbHelpers) return Promise.resolve();
            if (!window.BudsinSave) return Promise.resolve();

            return idbHelpers.enumerate().then(function (dbNames) {
                return idbHelpers.snapshot(dbNames);
            }).then(function (currentSnapshot) {
                self.snapshot = currentSnapshot;
                return window.BudsinSave.saveIDB(self.gameName, currentSnapshot);
            }).catch(function (err) {
                if (err === "LIMIT_REACHED") {
                    console.warn("[IDBGameSave] Free tier limit reached");
                } else {
                    console.warn("[IDBGameSave] Save failed:", err);
                }
            });
        },

        startAutoSave: function () {
            var self = this;
            if (!window.BudsinSave) return;

            var idbHelpers = window.__BudsinIDB;
            if (!idbHelpers) return;

            window.BudsinSave.autoSaveIDB(self.gameName, function () {
                return idbHelpers.enumerate()
                    .then(function (names) {
                        return idbHelpers.snapshot(names);
                    })
                    .then(function (snap) {
                        self.snapshot = snap;
                        return snap;
                    })
                    .catch(function (_) {
                        return null;
                    });
            });
        },

        stopAutoSave: function () {
            if (window.BudsinSave) {
                window.BudsinSave.stopAutoSave(this.gameName);
            }
        },

        'delete': function () {
            if (!window.BudsinSave) return Promise.resolve();
            return window.BudsinSave.remove(this.gameName);
        },

        getInfo: function () {
            if (!window.BudsinSave) return Promise.resolve(null);
            return window.BudsinSave.getInfo(this.gameName);
        },
    };

})();

(function () {
    var gameName = "";
    try {
        var path = window.location.pathname.split("/").pop();
        gameName = decodeURIComponent(path).replace(/\.html$/i, "").toLowerCase();
        if (!gameName || gameName === "" || gameName === "index") return;
    } catch (_) { return; }

    function showToast(msg, isError) {
        var toast = document.createElement("div");
        toast.textContent = msg;
        Object.assign(toast.style, {
            position: "fixed",
            top: "56px",
            left: "10px",
            zIndex: "2147483647",
            padding: "10px 16px",
            borderRadius: "12px",
            background: isError ? "rgba(231,76,60,0.9)" : "rgba(46,204,113,0.9)",
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
        requestAnimationFrame(function () { toast.style.opacity = "1"; });
        setTimeout(function () {
            toast.style.opacity = "0";
            setTimeout(function () { toast.remove(); }, 400);
        }, 4000);
    }

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
        return loadScript("https://games.budsin.dev/save-system.js");
    }

    function createButton() {
        try {
            var btn = document.createElement("button");
            btn.id = "budsin-save-btn";
            btn.textContent = "\u{1F4BE}";
            btn.title = "Save / Load";
            Object.assign(btn.style, menuBtnStyle());

            var menu = document.createElement("div");
            menu.id = "budsin-save-menu";
            Object.assign(menu.style, {
                position: "fixed",
                top: "52px",
                left: "10px",
                zIndex: "2147483647",
                display: "none",
                flexDirection: "column",
                gap: "4px",
                padding: "6px",
                borderRadius: "12px",
                background: "rgba(20,20,30,0.92)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.15)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                minWidth: "120px",
                fontFamily: "system-ui, -apple-system, sans-serif",
            });

            function resetBtn() {
                btn.textContent = "\u{1F4BE}";
                btn.style.background = "rgba(0,0,0,0.45)";
            }

            function initAndRun(cb) {
                var timedOut = false;
                var timer = setTimeout(function () {
                    timedOut = true;
                    console.error("[BudsinSave] initAndRun timed out after 15s");
                    showToast("Error: tiempo de espera agotado. Revisa la consola.", true);
                    resetBtn();
                }, 15000);

                loadFirebase().then(loadSaveSystem).then(function () {
                    if (timedOut) return;
                    clearTimeout(timer);
                    if (!window.BudsinSave) {
                        showToast("Error al cargar sistema de guardado", true);
                        resetBtn();
                        return;
                    }
                    BudsinSave.init().then(function () {
                        if (!timedOut) cb();
                    }).catch(function () {
                        if (!timedOut) {
                            clearTimeout(timer);
                            resetBtn();
                        }
                    });
                }).catch(function (e) {
                    if (timedOut) return;
                    clearTimeout(timer);
                    console.error("[BudsinSave] initAndRun error:", e);
                    showToast("Error al conectar con Firebase", true);
                    resetBtn();
                });
            }

            function doSave() {
                if (window.__BudsinIDB && window.__isUnityGame()) {
                    return window.__BudsinIDB.enumerate().then(function (dbNames) {
                        if (dbNames.length === 0) return saveToCloud();
                        return window.__BudsinIDB.snapshot(dbNames).then(function (snap) {
                            return BudsinSave.saveIDB(gameName, snap);
                        }).then(function () {
                            btn.textContent = "\u2713";
                            btn.style.background = "rgba(46,204,113,0.7)";
                            showToast("Progreso Unity guardado en la nube \u2705", false);
                            setTimeout(resetBtn, 1200);
                        }).catch(function (err) {
                            if (err === "LIMIT_REACHED") {
                                showToast("L\u00edmite de 5 juegos alcanzado. Hazte Pro para ilimitados.", true);
                            } else if (err === "User not logged in") {
                                showToast("Inicia sesi\u00f3n con Google para guardar en la nube", true);
                            } else {
                                showToast("Error al guardar Unity: " + err, true);
                            }
                            resetBtn();
                        });
                    });
                }
                return saveToCloud();
            }

            function saveToCloud() {
                var gameData = {};
                try {
                    for (var i = 0; i < localStorage.length; i++) {
                        var key = localStorage.key(i);
                        if (!key) continue;
                        if (key.indexOf("budsin_") === 0) continue;
                        if (key.indexOf("firebase:") === 0) continue;
                        gameData[key] = localStorage.getItem(key);
                    }
                } catch (_) {}

                if (!window.BudsinSave) {
                    try { localStorage.setItem("game_" + gameName, JSON.stringify(gameData)); } catch (_) {}
                    showToast("Guardado local (sin conexi\u00f3n)", false);
                    btn.textContent = "\u2713";
                    btn.style.background = "rgba(46,204,113,0.7)";
                    setTimeout(resetBtn, 1200);
                    return;
                }

                return BudsinSave.saveNow(gameName, gameData).then(function () {
                    btn.textContent = "\u2713";
                    btn.style.background = "rgba(46,204,113,0.7)";
                    showToast("Guardado en la nube \u2705", false);
                    setTimeout(resetBtn, 1200);
                }).catch(function (err) {
                    if (err === "LIMIT_REACHED") {
                        try { localStorage.setItem("game_" + gameName, JSON.stringify(gameData)); } catch (_) {}
                        showToast("L\u00edmite de 5 juegos alcanzado. Guardado local.", true);
                    } else if (err === "User not logged in") {
                        try { localStorage.setItem("game_" + gameName, JSON.stringify(gameData)); } catch (_) {}
                        showToast("Guardado local (sin sesi\u00f3n)", false);
                    } else {
                        try { localStorage.setItem("game_" + gameName, JSON.stringify(gameData)); } catch (_) {}
                        showToast("Error de conexi\u00f3n. Guardado local.", false);
                    }
                    btn.textContent = "\u2713";
                    btn.style.background = "rgba(46,204,113,0.7)";
                    setTimeout(resetBtn, 1200);
                });
            }

            function doLoad() {
                if (!window.BudsinSave) {
                    showToast("Sistema de guardado no disponible", true);
                    resetBtn();
                    return;
                }

                var isUnity = window.__BudsinIDB && window.__isUnityGame();

                return BudsinSave.loadIDB(gameName).then(function (idbSnapshot) {
                    if (idbSnapshot && isUnity) {
                        console.log("[BudsinSave] Restoring Unity save...");
                        var restorePromise = window.__BudsinIDB.restore(idbSnapshot);
                        var timeoutPromise = new Promise(function (_, reject) {
                            setTimeout(function () { reject(new Error("Restore timeout after 120s")); }, 120000);
                        });
                        return Promise.race([restorePromise, timeoutPromise]).then(function () {
                            btn.textContent = "\u2713";
                            btn.style.background = "rgba(52,152,219,0.7)";
                            showToast("Progreso Unity restaurado. Recargando...", false);
                            setTimeout(function () { location.reload(); }, 1000);
                        }).catch(function (err) {
                            console.error("[BudsinSave] Restore failed:", err);
                            showToast("Error al restaurar: " + err.message, true);
                            resetBtn();
                        });
                    }

                    if (isUnity) {
                        showToast("No hay guardado en la nube para este juego", true);
                        resetBtn();
                        return;
                    }

                    return BudsinSave.load(gameName).then(function (data) {
                        if (!data) {
                            var localKey = "game_" + gameName;
                            var localData = null;
                            try { localData = localStorage.getItem(localKey); } catch (_) {}
                            if (localData) {
                                showToast("Datos locales encontrados. Recargando...", false);
                                setTimeout(function () { location.reload(); }, 1000);
                                return;
                            }
                            showToast("No hay datos guardados", true);
                            resetBtn();
                            return;
                        }
                        var restored = 0;
                        try {
                            var savedData = typeof data === "string" ? JSON.parse(data) : data;
                            if (savedData && typeof savedData === "object") {
                                for (var key in savedData) {
                                    if (savedData.hasOwnProperty(key) && typeof savedData[key] === "string") {
                                        localStorage.setItem(key, savedData[key]);
                                        restored++;
                                    }
                                }
                            }
                        } catch (_) {}
                        btn.textContent = "\u2713";
                        btn.style.background = "rgba(52,152,219,0.7)";
                        if (restored > 0) {
                            showToast("Datos restaurados (" + restored + " claves). Recargando...", false);
                            setTimeout(function () { location.reload(); }, 1000);
                        } else {
                            showToast("No se encontraron datos para restaurar", true);
                            setTimeout(resetBtn, 2000);
                        }
                    }).catch(function (err) {
                        console.error("[BudsinSave] Load failed:", err);
                        showToast("Error al cargar datos", true);
                        resetBtn();
                    });
                }).catch(function (err) {
                    console.error("[BudsinSave] Load error:", err);
                    showToast("Error al cargar datos", true);
                    resetBtn();
                });
            }

            var saveOpt = createMenuOption("\u{1F4BE} Save", function () {
                hideMenu();
                btn.textContent = "\u23F3";
                initAndRun(doSave);
            });

            var loadOpt = createMenuOption("\u{1F4C2} Load", function () {
                hideMenu();
                btn.textContent = "\u23F3";
                initAndRun(doLoad);
            });

            menu.appendChild(saveOpt);
            menu.appendChild(loadOpt);
            document.body.appendChild(menu);

            btn.addEventListener("mouseenter", function () {
                btn.style.transform = "scale(1.1)";
                btn.style.background = "rgba(0,0,0,0.65)";
            });
            btn.addEventListener("mouseleave", function () {
                btn.style.transform = "scale(1)";
                btn.style.background = "rgba(0,0,0,0.45)";
            });
            btn.addEventListener("click", function (e) {
                e.stopPropagation();
                menu.style.display = menu.style.display === "flex" ? "none" : "flex";
            });

            document.addEventListener("click", function (e) {
                if (!menu.contains(e.target) && e.target !== btn) {
                    menu.style.display = "none";
                }
            });

            document.body.appendChild(btn);
        } catch (_) {}
    }

    function menuBtnStyle() {
        return {
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
            transition: "transform .15s, background .2s",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        };
    }

    function createMenuOption(text, onClick) {
        var opt = document.createElement("button");
        opt.textContent = text;
        Object.assign(opt.style, {
            background: "transparent",
            color: "#eee",
            border: "none",
            borderRadius: "8px",
            padding: "8px 12px",
            cursor: "pointer",
            fontSize: "13px",
            fontFamily: "system-ui, -apple-system, sans-serif",
            textAlign: "left",
            transition: "background .15s",
        });
        opt.addEventListener("mouseenter", function () { opt.style.background = "rgba(255,255,255,0.1)"; });
        opt.addEventListener("mouseleave", function () { opt.style.background = "transparent"; });
        opt.addEventListener("click", function (e) { e.stopPropagation(); onClick(); });
        return opt;
    }

    function hideMenu() {
        var m = document.getElementById("budsin-save-menu");
        if (m) m.style.display = "none";
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () { setTimeout(createButton, 100); });
    } else {
        setTimeout(createButton, 100);
    }
})();
