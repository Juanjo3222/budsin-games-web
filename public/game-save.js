(function () {
    "use strict";

    /**
     * GameSave: High-level wrapper for game save/load with auto-restore.
     * 
     * Automatically detects game type (localStorage vs Unity/IDB) and uses the appropriate backend.
     * 
     * === For localStorage games (HTML + JavaScript) ===
     * Usage:
     *   var gameSave = new GameSave("my-game");
     *   gameSave.init().then(function() {
     *       var state = gameSave.getState();
     *       gameSave.setState({ score: 100 });
     *       gameSave.startAutoSave();
     *   });
     *
     * === For Unity games (before createUnityInstance) ===
     * CRITICAL: Call init() BEFORE createUnityInstance() to restore IDB first!
     * 
     * Usage:
     *   var gameSave = new GameSave("my-unity-game");
     *   gameSave.init().then(function(snapshot) {
     *       // Now IDB is restored from cloud. Create Unity instance AFTER this resolves.
     *       createUnityInstance(container, config, progressUrl).then(unityInstance => {
     *           // Unity now has access to the restored IDB data
     *           gameSave.startAutoSave();  // Auto-save every 5 min
     *       });
     *   });
     *
     * Detection: If any IndexedDB database name contains the game name (normalized),
     * it auto-switches to IDB/Unity mode. Otherwise defaults to localStorage mode.
     */

    /**
     * Auto-detect game type by checking for IDB databases matching game name.
     */
    window.__isUnityGame = function isUnityGame() {
        return typeof window.createUnityInstance === 'function' ||
            typeof window.UnityLoader === 'object' ||
            (typeof window.unityInstance !== 'undefined' && window.unityInstance !== null);
    };

    function autoDetectGameType(gameName) {
        if (window.__isUnityGame()) return Promise.resolve("unity");
        return Promise.resolve("localstorage");
    }

    window.GameSave = function (gameName) {
        if (!gameName) throw new Error("gameName is required");
        this.gameName = gameName;
        this.state = {};
        this.gameType = null; // Auto-detected on init()
        this.initialized = false;
        this.idbDatabases = null; // Cache IDB database names
    };

    window.GameSave.prototype = {

        /**
         * Initialize: Auto-detect game type, then load saved state from Firestore or localStorage fallback.
         * This completes BEFORE the game reads state, ensuring timing is correct.
         */
        init: function () {
            var self = this;

            return autoDetectGameType(self.gameName).then(function (type) {
                self.gameType = type;

                if (self.gameType === "localstorage") {
                    // localStorage path: load from localStorage immediately (synchronous), 
                    // then try Firebase (async) to update in background
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
                                        self._saveLocalStorage(); // Write to localStorage immediately
                                    } catch (_) {
                                        self.state = data;
                                    }
                                }
                            })
                            .catch(function (err) {
                                console.warn("[GameSave] Firebase load failed:", err);
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
                    // Unity/IDB path: use IDBGameSave
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

        /**
         * Get current state.
         */
        getState: function () {
            return JSON.parse(JSON.stringify(this.state));
        },

        /**
         * Set state.
         */
        setState: function (newState) {
            if (typeof newState !== "object" || newState === null) {
                throw new Error("setState requires an object");
            }
            this.state = JSON.parse(JSON.stringify(newState));
        },

        /**
         * Merge partial state.
         */
        mergeState: function (partial) {
            if (typeof partial !== "object" || partial === null) {
                throw new Error("mergeState requires an object");
            }
            this.state = Object.assign(this.state, JSON.parse(JSON.stringify(partial)));
        },

        /**
         * Save now.
         */
        saveNow: function () {
            var self = this;

            if (self.gameType === "unity" && self._idbInstance) {
                return self._idbInstance.saveNow();
            }

            if (!window.BudsinSave) return Promise.resolve();

            return window.BudsinSave.saveNow(self.gameName, self.state).catch(function (err) {
                if (err === "LIMIT_REACHED") {
                    console.warn("[GameSave] Free tier limit reached for new games");
                    return self._saveLocalStorage();
                }
                console.warn("[GameSave] Save failed:", err);
                return self._saveLocalStorage();
            });
        },

        /**
         * Start auto-save (every 5 min).
         */
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

        /**
         * Stop auto-save.
         */
        stopAutoSave: function () {
            if (this.gameType === "unity" && this._idbInstance) {
                return this._idbInstance.stopAutoSave();
            }

            if (window.BudsinSave) {
                window.BudsinSave.stopAutoSave(this.gameName);
            }
        },

        /**
         * Delete saved game.
         */
        'delete': function () {
            var self = this;

            if (self.gameType === "unity" && self._idbInstance) {
                return self._idbInstance.delete();
            }

            if (!window.BudsinSave) return Promise.resolve();
            return window.BudsinSave.remove(self.gameName);
        },

        /**
         * Get save info (exists, updatedAt, etc.).
         */
        getInfo: function () {
            if (this.gameType === "unity" && this._idbInstance) {
                return this._idbInstance.getInfo();
            }

            if (!window.BudsinSave) return Promise.resolve(null);
            return window.BudsinSave.getInfo(this.gameName);
        },

        // ─── Private helpers ───

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

    /**
     * IDBGameSave: For Unity / IndexedDB games.
     * Snapshots all IndexedDB stores and restores them on load.
     */

    window.IDBGameSave = function (gameName) {
        if (!gameName) throw new Error("gameName is required");
        this.gameName = gameName;
        this.snapshot = null;
        this.initialized = false;
    };

    window.IDBGameSave.prototype = {

        /**
         * Initialize: Snapshot current IDB state and try to load saved snapshot from Firestore.
         */
        init: function () {
            var self = this;
            var idbHelpers = window.__BudsinIDB;

            if (!idbHelpers) {
                console.warn("[IDBGameSave] IDB helpers not available");
                return Promise.resolve(null);
            }

            // Snapshot current IDB
            return idbHelpers.enumerate().then(function (dbNames) {
                return idbHelpers.snapshot(dbNames);
            }).then(function (currentSnapshot) {
                self.snapshot = currentSnapshot;

                // Try to load saved snapshot from Firestore
                if (window.BudsinSave) {
                    return window.BudsinSave.loadIDB(self.gameName).then(function (savedSnapshot) {
                        if (savedSnapshot) {
                            self.snapshot = savedSnapshot;
                            // Restore IDB to saved state
                            return idbHelpers.restore(savedSnapshot);
                        }
                        return null;
                    }).catch(function (err) {
                        console.warn("[IDBGameSave] Firestore load failed:", err);
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

        /**
         * Get current IDB snapshot.
         */
        getSnapshot: function () {
            if (!this.snapshot) return null;
            return JSON.parse(JSON.stringify(this.snapshot));
        },

        /**
         * Save current IDB state to Firestore.
         */
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
                }
                console.warn("[IDBGameSave] Save failed:", err);
            });
        },

        /**
         * Start auto-save (every 5 min).
         */
        startAutoSave: function () {
            var self = this;
            if (!window.BudsinSave) return;

            var idbHelpers = window.__BudsinIDB;
            if (!idbHelpers) return;

            window.BudsinSave.autoSaveIDB(self.gameName, function () {
                // Return a properly-timed snapshot for auto-save
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

        /**
         * Stop auto-save.
         */
        stopAutoSave: function () {
            if (window.BudsinSave) {
                window.BudsinSave.stopAutoSave(this.gameName);
            }
        },

        /**
         * Delete saved game.
         */
        'delete': function () {
            if (!window.BudsinSave) return Promise.resolve();
            return window.BudsinSave.remove(this.gameName);
        },

        /**
         * Get save info.
         */
        getInfo: function () {
            if (!window.BudsinSave) return Promise.resolve(null);
            return window.BudsinSave.getInfo(this.gameName);
        },
    };

})();

// ─── Auto-init: Save button (top-left corner) ───
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
        return loadScript("https://budsin-games.pages.dev/save-system.js");
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

            function initAndRun(cb) {
                loadFirebase().then(loadSaveSystem).then(function () {
                    if (!window.BudsinSave) {
                        showToast("Error al cargar sistema de guardado", true);
                        btn.textContent = "\u{1F4BE}";
                        return;
                    }
                    BudsinSave.init().then(function () {
                        cb();
                    });
                }).catch(function () {
                    showToast("Error al conectar con Firebase", true);
                    btn.textContent = "\u{1F4BE}";
                });
            }

            function doSave() {
                if (window.__BudsinIDB && window.__isUnityGame()) {
                    return window.__BudsinIDB.enumerate().then(function (dbNames) {
                        if (dbNames.length === 0) return saveLocalStorage();
                        return window.__BudsinIDB.snapshot(dbNames).then(function (snap) {
                            return BudsinSave.saveIDB(gameName, snap);
                        }).then(function () {
                            btn.textContent = "\u2713";
                            btn.style.background = "rgba(46,204,113,0.7)";
                            showToast("Progreso Unity guardado en la nube \u2705", false);
                            setTimeout(function () {
                                btn.textContent = "\u{1F4BE}";
                                btn.style.background = "rgba(0,0,0,0.45)";
                            }, 1200);
                        });
                    });
                }
                return saveLocalStorage();
            }

            function saveLocalStorage() {
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
                return BudsinSave.saveNow(gameName, gameData).then(function () {
                    btn.textContent = "\u2713";
                    btn.style.background = "rgba(46,204,113,0.7)";
                    showToast("Guardado en la nube \u2705", false);
                    setTimeout(function () {
                        btn.textContent = "\u{1F4BE}";
                        btn.style.background = "rgba(0,0,0,0.45)";
                    }, 1200);
                }).catch(function (err) {
                    btn.textContent = "\u2717";
                    btn.style.background = "rgba(231,76,60,0.7)";
                    if (err === "LIMIT_REACHED") {
                        showToast("L\u00edmite de 5 juegos alcanzado. Hazte Pro para ilimitados.", true);
                    } else if (err === "User not logged in") {
                        showToast("Inicia sesi\u00f3n con Google para guardar en la nube", true);
                    } else {
                        showToast("Error al guardar: " + err, true);
                    }
                    setTimeout(function () {
                        btn.textContent = "\u{1F4BE}";
                        btn.style.background = "rgba(0,0,0,0.45)";
                    }, 3000);
                });
            }

            function doLoad() {
                return BudsinSave.loadIDB(gameName).then(function (idbSnapshot) {
                    if (idbSnapshot && window.__BudsinIDB && window.__isUnityGame()) {
                        return window.__BudsinIDB.restore(idbSnapshot).then(function () {
                            btn.textContent = "\u2713";
                            btn.style.background = "rgba(52,152,219,0.7)";
                            showToast("Progreso Unity restaurado. Recargando...", false);
                            setTimeout(function () { location.reload(); }, 1000);
                        });
                    }
                    return BudsinSave.load(gameName).then(function (data) {
                        if (!data) {
                            showToast("No hay datos guardados en la nube", true);
                            btn.textContent = "\u{1F4BE}";
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
                            setTimeout(function () {
                                btn.textContent = "\u{1F4BE}";
                                btn.style.background = "rgba(0,0,0,0.45)";
                            }, 2000);
                        }
                    });
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

            var loadOpt = createMenuOption("\u{1F4C2} Load", function () {
                hideMenu();
                btn.textContent = "\u23F3";
                loadFirebase().then(loadSaveSystem).then(function () {
                    if (!window.BudsinSave) {
                        showToast("Error al cargar sistema de guardado", true);
                        btn.textContent = "\u{1F4BE}";
                        return;
                    }
                    return BudsinSave.init().then(function (ok) {
                        if (!ok) {
                            showToast("Inicia sesi\u00f3n con Google para restaurar datos", true);
                            btn.textContent = "\u{1F4BE}";
                            return;
                        }
                        return doLoad();
                    });
                }).catch(function () {
                    showToast("Error al conectar con Firebase", true);
                    btn.textContent = "\u{1F4BE}";
                });
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

    // Defer to avoid interfering with game initialization (esp. WebGL canvases)
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () { setTimeout(createButton, 100); });
    } else {
        setTimeout(createButton, 100);
    }
})();

