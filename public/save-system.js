(function () {
    "use strict";

    var SAVE_COLLECTION = "gamesaves";
    var FREE_LIMIT = 5;
    var AUTO_SAVE_INTERVAL = 300000;

    var CHUNK_SIZE = 400000;

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
                saveCountCache = null;
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

    function getChunksRef(userId, gameName) {
        return getSaveRef(userId, gameName).collection("chunks");
    }

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

    // ─── IDB helpers (no Firebase dependency) ───

    function enumerateIDB() {
        if (!window.indexedDB || !window.indexedDB.databases) {
            return Promise.resolve([]);
        }
        return window.indexedDB.databases().then(function (dbs) {
            return dbs.map(function (d) { return d.name; }).filter(Boolean);
        }).catch(function () { return []; });
    }

    function snapshotIDB(dbNames) {
        var results = {};
        var chain = Promise.resolve();

        dbNames.forEach(function (name) {
            chain = chain.then(function () {
                return new Promise(function (resolve) {
                    var req;
                    try { req = indexedDB.open(name); } catch (e) { resolve(); return; }
                    req.onupgradeneeded = function () {};
                    req.onsuccess = function () {
                        var db = req.result;
                        if (!db) { resolve(); return; }
                        var dbData = { version: db.version, stores: {} };
                        var storeNames = [];
                        for (var i = 0; i < db.objectStoreNames.length; i++) {
                            storeNames.push(db.objectStoreNames[i]);
                        }
                        if (storeNames.length === 0) {
                            db.close();
                            results[name] = dbData;
                            resolve();
                            return;
                        }
                        var storeChain = Promise.resolve();
                        storeNames.forEach(function (sn) {
                            storeChain = storeChain.then(function () {
                                return new Promise(function (res2) {
                                    try {
                                        var tx = db.transaction(sn, "readonly");
                                        var store = tx.objectStore(sn);
                                        var records = [];
                                        var cursorReq = store.openCursor();
                                        cursorReq.onsuccess = function (e) {
                                            var cursor = e.target.result;
                                            if (cursor) {
                                                records.push({ key: cursor.key, value: cursor.value });
                                                cursor.continue();
                                            } else {
                                                dbData.stores[sn] = records;
                                                res2();
                                            }
                                        };
                                        cursorReq.onerror = function () { res2(); };
                                    } catch (e) { res2(); }
                                });
                            });
                        });
                        storeChain.then(function () {
                            db.close();
                            results[name] = dbData;
                            resolve();
                        });
                    };
                    req.onerror = function () { resolve(); };
                    req.onblocked = function () { resolve(); };
                });
            });
        });

        return chain.then(function () { return results; });
    }

    function restoreIDB(snapshot) {
        var names = Object.keys(snapshot);
        console.log("[BudsinSave] Restoring", names.length, "databases:", names.join(", "));
        var chain = Promise.resolve();

        names.forEach(function (name) {
            chain = chain.then(function () {
                console.log("[BudsinSave] Deleting DB:", name);
                return new Promise(function (resolve) {
                    try {
                        var delReq = indexedDB.deleteDatabase(name);
                        var resolved = false;
                        function done() { if (!resolved) { resolved = true; resolve(); } }
                        delReq.onsuccess = function () { console.log("[BudsinSave] Deleted DB:", name); done(); };
                        delReq.onerror = function () { console.warn("[BudsinSave] Delete error:", name); done(); };
                        delReq.onblocked = function () { console.warn("[BudsinSave] Delete blocked:", name); done(); };
                        setTimeout(done, 5000);
                    } catch (e) { console.warn("[BudsinSave] Delete exception:", name, e); resolve(); }
                });
            }).then(function () {
                return new Promise(function (resolve) {
                    var dbData = snapshot[name];
                    if (!dbData) { resolve(); return; }
                    console.log("[BudsinSave] Opening DB:", name, "v" + (dbData.version || 1));
                    var openReq;
                    try { openReq = indexedDB.open(name, dbData.version || 1); } catch (e) { console.warn("[BudsinSave] Open exception:", name, e); resolve(); return; }
                    openReq.onupgradeneeded = function (e) {
                        var d = e.target.result;
                        var stores = dbData.stores || {};
                        Object.keys(stores).forEach(function (sn) {
                            if (!d.objectStoreNames.contains(sn)) {
                                d.createObjectStore(sn, { autoIncrement: true });
                                console.log("[BudsinSave] Created store:", sn, "in", name);
                            }
                        });
                    };
                    openReq.onsuccess = function () {
                        var d = openReq.result;
                        var stores = dbData.stores || {};
                        var storeNames = Object.keys(stores);
                        if (storeNames.length === 0) { d.close(); resolve(); return; }
                        var storeChain = Promise.resolve();
                        storeNames.forEach(function (sn) {
                            storeChain = storeChain.then(function () {
                                return new Promise(function (res2) {
                                    try {
                                        var tx = d.transaction(sn, "readwrite");
                                        var store = tx.objectStore(sn);
                                        var records = stores[sn] || [];
                                        console.log("[BudsinSave] Restoring", records.length, "records to", sn);
                                        records.forEach(function (rec) {
                                            try { store.put(rec.value, rec.key); } catch (e) { console.warn("[BudsinSave] put error:", e); }
                                        });
                                        tx.oncomplete = function () { res2(); };
                                        tx.onerror = function () { res2(); };
                                    } catch (e) { res2(); }
                                });
                            });
                        });
                        storeChain.then(function () { d.close(); resolve(); });
                    };
                    openReq.onerror = function () { console.warn("[BudsinSave] Open error:", name); resolve(); };
                    openReq.onblocked = function () { console.warn("[BudsinSave] Open blocked:", name); resolve(); };
                });
            });
        });

        return chain.then(function () {
            console.log("[BudsinSave] Restore complete");
        });
    }

    // ─── Helpers exposed for game-save.js ───
    window.__BudsinIDB = {
        enumerate: enumerateIDB,
        snapshot: snapshotIDB,
        restore: restoreIDB,
    };

    // ─── Public API ───

    window.BudsinSave = {

        init: function () {
            if (!initFirebase()) return Promise.resolve(false);
            return Promise.resolve(true);
        },

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
                    getSaveRef(uid, gameName).get().then(function (doc) {
                        if (doc.exists) {
                            doSave(uid, gameName, data).then(resolve).catch(reject);
                        } else {
                            countUserSaves(uid).then(function (count) {
                                if (count >= FREE_LIMIT) {
                                    reject("LIMIT_REACHED");
                                } else {
                                    doSave(uid, gameName, data).then(resolve).catch(reject);
                                }
                            }).catch(reject);
                        }
                    }).catch(function () {
                        doSave(uid, gameName, data).then(resolve).catch(reject);
                    });
                } else {
                    doSave(uid, gameName, data).then(resolve).catch(reject);
                }
            });
        },

        load: function (gameName) {
            if (!gameName) return Promise.resolve(null);
            if (!initFirebase()) return Promise.resolve(null);

            var uid = getUserId();
            if (!uid) return Promise.resolve(null);

            return getSaveRef(uid, gameName).get().then(function (doc) {
                if (doc.exists) {
                    var d = doc.data();
                    if (d.storagePath) return null; // IDB game, not localStorage
                    try {
                        return JSON.parse(d.data);
                    } catch (_) {
                        return d.data;
                    }
                }
                return null;
            }).catch(function () { return null; });
        },

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
                        gameType: d.gameType || "localstorage",
                    };
                }
                return { exists: false, updatedAt: null, gameName: gameName };
            }).catch(function () { return null; });
        },

        remove: function (gameName) {
            if (!gameName) return Promise.resolve();
            if (!initFirebase()) return Promise.resolve();

            var uid = getUserId();
            if (!uid) return Promise.resolve();

            return getSaveRef(uid, gameName).get().then(function (doc) {
                var d = doc.data();
                var chain = Promise.resolve();

                if (d && d.chunkCount) {
                    chain = getChunksRef(uid, gameName).get().then(function (snap) {
                        var batch = db.batch();
                        snap.forEach(function (c) { batch.delete(c.ref); });
                        return batch.commit();
                    }).catch(function () {});
                }

                return chain.then(function () {
                    return getSaveRef(uid, gameName).delete();
                }).then(function () {
                    saveCountCache = null;
                });
            }).catch(function () {});
        },

        autoSave: function (gameName, getDataFn) {
            if (!gameName || typeof getDataFn !== "function") return;

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

        stopAutoSave: function (gameName) {
            if (autoSaveTimers[gameName]) {
                clearInterval(autoSaveTimers[gameName]);
                delete autoSaveTimers[gameName];
            }
        },

        canSaveNewGame: function () {
            if (getPro()) return Promise.resolve({ allowed: true, count: 0, limit: Infinity });
            var uid = getUserId();
            if (!uid) return Promise.resolve({ allowed: false, count: 0, limit: FREE_LIMIT, reason: "not_logged_in" });
            return countUserSaves(uid).then(function (count) {
                return { allowed: count < FREE_LIMIT, count: count, limit: FREE_LIMIT };
            });
        },

        // ─── IDB / Unity game save/load ───

        saveIDB: function (gameName, snapshot) {
            if (!gameName || !snapshot) return Promise.reject("Invalid arguments");
            if (!initFirebase()) return Promise.reject("Firebase not available");

            var uid = getUserId();
            if (!uid) return Promise.reject("User not logged in");

            var isPro = getPro();

            return new Promise(function (resolve, reject) {
                function doSaveChunked() {
                    var json = JSON.stringify(snapshot);
                    console.log("[BudsinSave] saveIDB size:", (json.length / 1024).toFixed(1), "KB");

                    if (json.length <= CHUNK_SIZE) {
                        console.log("[BudsinSave] Saving directly (small)");
                        doSave(uid, gameName, { idbSnapshot: snapshot, gameType: "unity" }).then(resolve).catch(reject);
                        return;
                    }

                    var chunks = [];
                    for (var i = 0; i < json.length; i += CHUNK_SIZE) {
                        chunks.push(json.substring(i, i + CHUNK_SIZE));
                    }
                    console.log("[BudsinSave] Splitting into", chunks.length, "chunks of", CHUNK_SIZE / 1024, "KB");

                    var batch = db.batch();
                    batch.set(getSaveRef(uid, gameName), {
                        userId: uid,
                        gameName: gameName,
                        chunkCount: chunks.length,
                        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
                        gameType: "unity",
                    }, { merge: true });

                    var pad = String(chunks.length).length;
                    for (var j = 0; j < chunks.length; j++) {
                        var chunkRef = getChunksRef(uid, gameName).doc(String(j).padStart(pad, "0"));
                        batch.set(chunkRef, { data: chunks[j], index: j });
                    }

                    console.log("[BudsinSave] Committing batch write...");
                    return batch.commit().then(function () {
                        console.log("[BudsinSave] Save complete");
                        saveCountCache = null;
                        resolve();
                    }).catch(function (e) {
                        console.error("[BudsinSave] Batch commit error:", e);
                        reject(e);
                    });
                }

                if (!isPro) {
                    getSaveRef(uid, gameName).get().then(function (doc) {
                        if (doc.exists) {
                            doSaveChunked();
                        } else {
                            countUserSaves(uid).then(function (count) {
                                if (count >= FREE_LIMIT) {
                                    reject("LIMIT_REACHED");
                                } else {
                                    doSaveChunked();
                                }
                            }).catch(reject);
                        }
                    }).catch(function () { doSaveChunked(); });
                } else {
                    doSaveChunked();
                }
            });
        },

        loadIDB: function (gameName) {
            if (!gameName) return Promise.resolve(null);
            if (!initFirebase()) return Promise.resolve(null);
            console.log("[BudsinSave] loadIDB starting for", gameName);

            var uid = getUserId();
            if (!uid) return Promise.resolve(null);

            return getSaveRef(uid, gameName).get().then(function (doc) {
                if (!doc.exists) { console.log("[BudsinSave] No save doc found"); return null; }
                var d = doc.data();

                if (d.storagePath) { console.log("[BudsinSave] Old storagePath save, skipping"); return null; }

                if (d.chunkCount) {
                    console.log("[BudsinSave] Loading", d.chunkCount, "chunks for", gameName);
                    return getChunksRef(uid, gameName).get().then(function (snap) {
                        console.log("[BudsinSave] Chunk query returned", snap.size, "docs");
                        var chunks = [];
                        snap.forEach(function (c) { chunks.push(c.data()); });
                        chunks.sort(function (a, b) { return a.index - b.index; });
                        console.log("[BudsinSave] Sorted", chunks.length, "chunks");
                        if (chunks.length !== d.chunkCount) {
                            console.warn("[BudsinSave] Chunk count mismatch: expected", d.chunkCount, "got", chunks.length);
                        }
                        var json = chunks.map(function (c) { return c.data; }).join("");
                        console.log("[BudsinSave] Parsing snapshot (", (json.length / 1024).toFixed(1), "KB )");
                        try {
                            var result = JSON.parse(json);
                            console.log("[BudsinSave] Load complete");
                            return result;
                        } catch (e) {
                            console.error("[BudsinSave] JSON parse error:", e);
                            return null;
                        }
                    }).catch(function (e) { console.warn("[BudsinSave] loadIDB chunks error:", e); return null; });
                }

                if (d.data) {
                    try {
                        var parsed = JSON.parse(d.data);
                        return parsed.idbSnapshot || parsed;
                    } catch (e) {
                        return null;
                    }
                }
                return null;
            }).catch(function (e) { console.warn("[BudsinSave] loadIDB error:", e); return null; });
        },

        autoSaveIDB: function (gameName, getSnapshotFn) {
            if (!gameName || typeof getSnapshotFn !== "function") return;

            var doAutoSave = function () {
                try {
                    var snapshot = getSnapshotFn();
                    // Handle both Promise and synchronous returns
                    if (snapshot && typeof snapshot.then === "function") {
                        snapshot.then(function (snap) {
                            if (snap) {
                                window.BudsinSave.saveIDB(gameName, snap).catch(function (err) {
                                    if (err === "LIMIT_REACHED") {
                                        window.BudsinSave.stopAutoSave(gameName);
                                    }
                                });
                            }
                        }).catch(function (_) {});
                    } else if (snapshot) {
                        window.BudsinSave.saveIDB(gameName, snapshot).catch(function (err) {
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
