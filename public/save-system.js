(function () {
    "use strict";

    var SAVE_COLLECTION = "gamesaves";
    var FREE_LIMIT = 5;
    var AUTO_SAVE_INTERVAL = 300000; // 5 min

    var db = null;
    var auth = null;
    var currentUser = null;
    var autoSaveTimers = {};
    var saveCountCache = null;

    function getPro() {
        try {
            return window.localStorage.getItem("budsin_pro_active") === "1";
        } catch (_) { return false; }
    }

    function getUserId() {
        if (currentUser) return currentUser.uid;
        try {
            var raw = window.localStorage.getItem("budsin_pro_user");
            if (raw) {
                var parsed = JSON.parse(raw);
                return parsed.uid || null;
            }
        } catch (_) {}
        return null;
    }

    function docId(uid, game) {
        return uid + "_" + game;
    }

    function initFirebase() {
        if (db) return true;
        if (!window.firebase) return false;
        try {
            var app = window.firebase.apps.length
                ? window.firebase.app()
                : window.firebase.initializeApp({
                    apiKey: "AIzaSyDSq7mtQN0ewJGQ6suMh1gRYFVr_xBvhBs",
                    authDomain: "juanjo-games.firebaseapp.com",
                    projectId: "juanjo-games",
                    storageBucket: "juanjo-games.firebasestorage.app",
                    messagingSenderId: "71973783344",
                    appId: "1:71973783344:web:cc310281715d048aa77c87",
                });
            db = app.firestore();
            auth = app.auth();
            auth.onAuthStateChanged(function (u) {
                currentUser = u;
                saveCountCache = null; // invalidate on auth change
            });
            return true;
        } catch (e) {
            console.warn("[BudsinSave] Firebase init error:", e);
            return false;
        }
    }

    function getSaveRef(userId, gameName) {
        return db.collection(SAVE_COLLECTION).doc(docId(userId, gameName));
    }

    // Count unique games this user has saves for (cached)
    function countUserSaves(userId) {
        if (saveCountCache !== null) return Promise.resolve(saveCountCache);
        return db.collection(SAVE_COLLECTION)
            .where("userId", "==", userId)
            .get()
            .then(function (snap) {
                saveCountCache = snap.size;
                return saveCountCache;
            })
            .catch(function () { return 0; });
    }

    // ─── Public API ───

    window.BudsinSave = {

        /** Init the save system for a game. Returns a promise. */
        init: function () {
            if (!initFirebase()) return Promise.resolve(false);
            return Promise.resolve(true);
        },

        /** Save game data immediately. Overwrites if exists. Returns a promise. */
        saveNow: function (gameName, data) {
            if (!gameName || data === undefined || data === null) {
                return Promise.reject("Invalid arguments");
            }
            if (!initFirebase()) return Promise.reject("Firebase not available");

            var uid = getUserId();
            if (!uid) return Promise.reject("User not logged in");

            var isPro = getPro();

            return new Promise(function (resolve, reject) {
                if (!isPro) {
                    // Check if this game already has a save → doesn't count toward limit
                    getSaveRef(uid, gameName).get().then(function (doc) {
                        if (doc.exists) {
                            // Already saved this game before → just overwrite
                            doSave(uid, gameName, data).then(resolve).catch(reject);
                        } else {
                            // New game → check limit
                            countUserSaves(uid).then(function (count) {
                                if (count >= FREE_LIMIT) {
                                    reject("LIMIT_REACHED");
                                } else {
                                    doSave(uid, gameName, data).then(resolve).catch(reject);
                                }
                            }).catch(reject);
                        }
                    }).catch(function () {
                        // If read fails, try to save anyway
                        doSave(uid, gameName, data).then(resolve).catch(reject);
                    });
                } else {
                    doSave(uid, gameName, data).then(resolve).catch(reject);
                }
            });
        },

        /** Load saved data for a game. Returns a promise with the data or null. */
        load: function (gameName) {
            if (!gameName) return Promise.resolve(null);
            if (!initFirebase()) return Promise.resolve(null);

            var uid = getUserId();
            if (!uid) return Promise.resolve(null);

            return getSaveRef(uid, gameName).get().then(function (doc) {
                if (doc.exists) {
                    var d = doc.data();
                    try {
                        return JSON.parse(d.data);
                    } catch (_) {
                        return d.data;
                    }
                }
                return null;
            }).catch(function () { return null; });
        },

        /** Get save metadata. Returns a promise with { exists, updatedAt } or null. */
        getInfo: function (gameName) {
            if (!gameName) return Promise.resolve(null);
            if (!initFirebase()) return Promise.resolve(null);

            var uid = getUserId();
            if (!uid) return Promise.resolve(null);

            return getSaveRef(uid, gameName).get().then(function (doc) {
                if (doc.exists) {
                    var d = doc.data();
                    return {
                        exists: true,
                        updatedAt: d.updatedAt ? d.updatedAt.toDate() : null,
                        gameName: d.gameName,
                    };
                }
                return { exists: false, updatedAt: null, gameName: gameName };
            }).catch(function () { return null; });
        },

        /** Delete saved data for a game. Returns a promise. */
        remove: function (gameName) {
            if (!gameName) return Promise.resolve();
            if (!initFirebase()) return Promise.resolve();

            var uid = getUserId();
            if (!uid) return Promise.resolve();

            return getSaveRef(uid, gameName).delete().then(function () {
                saveCountCache = null;
            }).catch(function () {});
        },

        /** Start auto-saving every 5 minutes. getDataFn should return the game state. */
        autoSave: function (gameName, getDataFn) {
            if (!gameName || typeof getDataFn !== "function") return;

            // Save immediately on start
            var doAutoSave = function () {
                try {
                    var data = getDataFn();
                    if (data !== undefined && data !== null) {
                        window.BudsinSave.saveNow(gameName, data).catch(function (err) {
                            if (err === "LIMIT_REACHED") {
                                window.BudsinSave.stopAutoSave(gameName);
                            }
                        });
                    }
                } catch (_) {}
            };

            doAutoSave();

            if (autoSaveTimers[gameName]) clearInterval(autoSaveTimers[gameName]);
            autoSaveTimers[gameName] = setInterval(doAutoSave, AUTO_SAVE_INTERVAL);
        },

        /** Stop auto-saving for a game. */
        stopAutoSave: function (gameName) {
            if (autoSaveTimers[gameName]) {
                clearInterval(autoSaveTimers[gameName]);
                delete autoSaveTimers[gameName];
            }
        },

        /** Check if the user can save a new game (for UI). Returns a promise. */
        canSaveNewGame: function () {
            if (getPro()) return Promise.resolve({ allowed: true, count: 0, limit: Infinity });
            var uid = getUserId();
            if (!uid) return Promise.resolve({ allowed: false, count: 0, limit: FREE_LIMIT, reason: "not_logged_in" });
            return countUserSaves(uid).then(function (count) {
                return { allowed: count < FREE_LIMIT, count: count, limit: FREE_LIMIT };
            });
        },
    };

    function doSave(uid, gameName, data) {
        var payload = typeof data === "string" ? data : JSON.stringify(data);
        return getSaveRef(uid, gameName).set({
            userId: uid,
            gameName: gameName,
            data: payload,
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        }).then(function () {
            saveCountCache = null;
        });
    }

})();
