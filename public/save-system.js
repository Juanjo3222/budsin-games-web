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
    var authResolve = null;
    var authPromise = new Promise(function (resolve) {
        authResolve = resolve;
    });

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
                if (authResolve) {
                    authResolve(true);
                    authResolve = null;
                }
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
            .catch(function (err) {
                console.warn("[BudsinSave] countUserSaves error:", err);
                saveCountCache = null;
                return 0;
            });
    }

    // ─── IDB helpers ───

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
                        var d = req.result;
                        if (!d) { resolve(); return; }
                        var dbData = { version: d.version, stores: {} };
                        var storeNames = [];
                        for (var i = 0; i < d.objectStoreNames.length; i++) {
                            storeNames.push(d.objectStoreNames[i]);
                        }
                        if (storeNames.length === 0) {
                            d.close();
                            results[name] = dbData;
                            resolve();
                            return;
                        }
                        var storeChain = Promise.resolve();
                        storeNames.forEach(function (sn) {
                            storeChain = storeChain.then(function () {
                                return new Promise(function (res2) {
                                    try {
                                        var tx = d.transaction(sn, "readonly");
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
                            d.close();
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
        var chain = Promise.resolve();

        names.forEach(function (name) {
            chain = chain.then(function () {
                return new Promise(function (resolve) {
                    try {
                        var delReq = indexedDB.deleteDatabase(name);
                        var fallback = setTimeout(function () {
                            console.warn("[BudsinSave] Delete DB timed out:", name);
                            resolve();
                        }, 15000);
                        delReq.onsuccess = function () { clearTimeout(fallback); resolve(); };
                        delReq.onerror = function () { clearTimeout(fallback); resolve(); };
                        delReq.onblocked = function () { console.warn("[BudsinSave] Delete blocked:", name); };
                    } catch (e) { resolve(); }
                });
            }).then(function () {
                return new Promise(function (resolve) {
                    var dbData = snapshot[name];
                    if (!dbData) { resolve(); return; }
                    var openReq;
                    try { openReq = indexedDB.open(name, dbData.version || 1); } catch (e) { resolve(); return; }
                    var fallback = setTimeout(function () {
                        console.warn("[BudsinSave] Open DB timed out:", name);
                        resolve();
                    }, 15000);
                    openReq.onupgradeneeded = function (e) {
                        var d = e.target.result;
                        var stores = dbData.stores || {};
                        Object.keys(stores).forEach(function (sn) {
                            if (!d.objectStoreNames.contains(sn)) {
                                d.createObjectStore(sn, { autoIncrement: true });
                            }
                        });
                    };
                    openReq.onsuccess = function () {
                        clearTimeout(fallback);
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
                                        records.forEach(function (rec) {
                                            try { store.put(rec.value, rec.key); } catch (e) {}
                                        });
                                        var txFallback = setTimeout(function () {
                                            console.warn("[BudsinSave] Transaction timed out for", sn);
                                            res2();
                                        }, 15000);
                                        tx.oncomplete = function () { clearTimeout(txFallback); res2(); };
                                        tx.onerror = function () { clearTimeout(txFallback); res2(); };
                                    } catch (e) { res2(); }
                                });
                            });
                        });
                        storeChain.then(function () { d.close(); resolve(); });
                    };
                    openReq.onerror = function () { clearTimeout(fallback); resolve(); };
                    openReq.onblocked = function () {};
                });
            });
        });

        return chain.then(function () {
            console.log("[BudsinSave] Restore complete");
        });
    }

    window.__BudsinIDB = {
        enumerate: enumerateIDB,
        snapshot: snapshotIDB,
        restore: restoreIDB,
    };

    window.BudsinSave = {

        init: function () {
            if (!initFirebase()) return Promise.resolve(false);

            if (currentUser !== null || getUserId() !== null) {
                return Promise.resolve(true);
            }

            return authPromise.then(function () {
                return true;
            });
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
                        if (doc && doc.exists) {
                            doSave(uid, gameName, data).then(resolve).catch(reject);
                        } else {
                            countUserSaves(uid).then(function (count) {
                                if (count >= FREE_LIMIT) {
                                    reject("LIMIT_REACHED");
                                } else {
                                    doSave(uid, gameName, data).then(resolve).catch(reject);
                                }
                            }).catch(function () {
                                doSave(uid, gameName, data).then(resolve).catch(reject);
                            });
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
                if (doc && doc.exists) {
                    var d = doc.data();
                        try {
                            return JSON.parse(d.data);
                        } catch (_) {
                            return d.data;
                        }
                }
                return null;
            }).catch(function (err) {
                console.warn("[BudsinSave] load error:", err);
                return null;
            });
        },

        getInfo: function (gameName) {
            if (!gameName) return Promise.resolve(null);
            if (!initFirebase()) return Promise.resolve(null);

            var uid = getUserId();
            if (!uid) return Promise.resolve(null);

            return getSaveRef(uid, gameName).get().then(function (doc) {
                if (doc && doc.exists) {
                    var d = doc.data();
                    return {
                        exists: true,
                        updatedAt: d.updatedAt ? d.updatedAt.toDate() : null,
                        gameName: d.gameName,
                        gameType: d.gameType || "localstorage",
                    };
                }
                return { exists: false, updatedAt: null, gameName: gameName };
            }).catch(function (err) {
                console.warn("[BudsinSave] getInfo error:", err);
                return null;
            });
        },

        remove: function (gameName) {
            if (!gameName) return Promise.resolve();
            if (!initFirebase()) return Promise.resolve();

            var uid = getUserId();
            if (!uid) return Promise.resolve();

            return getSaveRef(uid, gameName).get().then(function (doc) {
                if (!doc || !doc.exists) return;
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
            }).catch(function (err) {
                console.warn("[BudsinSave] remove error:", err);
            });
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
            }).catch(function () {
                return { allowed: false, count: 0, limit: FREE_LIMIT, reason: "error" };
            });
        },

        saveIDB: function (gameName, snapshot) {
            if (!gameName || !snapshot) return Promise.reject("Invalid arguments");
            if (!initFirebase()) return Promise.reject("Firebase not available");

            var uid = getUserId();
            if (!uid) return Promise.reject("User not logged in");

            var isPro = getPro();

            return new Promise(function (resolve, reject) {
                function doSaveChunked() {
                    var json = JSON.stringify(snapshot);

                    if (json.length <= CHUNK_SIZE) {
                        doSave(uid, gameName, { idbSnapshot: snapshot, gameType: "unity" }).then(resolve).catch(reject);
                        return;
                    }

                    var chunks = [];
                    for (var i = 0; i < json.length; i += CHUNK_SIZE) {
                        chunks.push(json.substring(i, i + CHUNK_SIZE));
                    }

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

                    return batch.commit().then(function () {
                        saveCountCache = null;
                        resolve();
                    }).catch(function (e) {
                        console.error("[BudsinSave] Batch commit error:", e);
                        reject(e);
                    });
                }

                if (!isPro) {
                    getSaveRef(uid, gameName).get().then(function (doc) {
                        if (doc && doc.exists) {
                            doSaveChunked();
                        } else {
                            countUserSaves(uid).then(function (count) {
                                if (count >= FREE_LIMIT) {
                                    reject("LIMIT_REACHED");
                                } else {
                                    doSaveChunked();
                                }
                            }).catch(function () {
                                doSaveChunked();
                            });
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

            var uid = getUserId();
            if (!uid) return Promise.resolve(null);

            return getSaveRef(uid, gameName).get().then(function (doc) {
                if (!doc || !doc.exists) return null;
                var d = doc.data();

                if (d.chunkCount) {
                    return getChunksRef(uid, gameName).get().then(function (snap) {
                        var chunks = [];
                        snap.forEach(function (c) { chunks.push(c.data()); });
                        chunks.sort(function (a, b) { return a.index - b.index; });

                        if (chunks.length === 0) return null;

                        var json = chunks.map(function (c) { return c.data; }).join("");
                        try {
                            return JSON.parse(json);
                        } catch (e) {
                            console.error("[BudsinSave] JSON parse error:", e);
                            return null;
                        }
                    }).catch(function (e) {
                        console.warn("[BudsinSave] loadIDB chunks error:", e);
                        return null;
                    });
                }

                if (d.data) {
                    try {
                        var parsed = JSON.parse(d.data);
                        return parsed.idbSnapshot || parsed;
                    } catch (e) {
                        console.warn("[BudsinSave] loadIDB parse error:", e);
                        return null;
                    }
                }
                return null;
            }).catch(function (e) {
                console.warn("[BudsinSave] loadIDB error:", e);
                return null;
            });
        },

        autoSaveIDB: function (gameName, getSnapshotFn) {
            if (!gameName || typeof getSnapshotFn !== "function") return;

            var doAutoSave = function () {
                try {
                    var snapshot = getSnapshotFn();
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
        }).catch(function (err) {
            console.warn("[BudsinSave] doSave error:", err);
            throw err;
        });
    }

})();
