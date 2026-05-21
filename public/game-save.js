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
    function autoDetectGameType(gameName) {
        if (!window.indexedDB || !window.indexedDB.databases) {
            return Promise.resolve("localstorage");
        }
        return window.indexedDB.databases()
            .then(function (dbs) {
                var dbNames = dbs.map(function (d) { return d.name; });
                // Check if any IDB database contains the game name (normalized)
                var gameNameLower = gameName.toLowerCase().replace(/[^a-z0-9]/g, "");
                for (var i = 0; i < dbNames.length; i++) {
                    var dbLower = dbNames[i].toLowerCase().replace(/[^a-z0-9]/g, "");
                    if (dbLower.includes(gameNameLower) || gameNameLower.includes(dbLower)) {
                        return "unity";
                    }
                }
                return "localstorage";
            })
            .catch(function () {
                return "localstorage";
            });
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
        delete: function () {
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
        delete: function () {
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
