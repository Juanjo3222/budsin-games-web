            const SITE_VERSION = "6.4";
            const STORAGE_KEY = "juanjos_games_seen_version";
            const ENABLE_CHANGELOG_POPUP = true;
            const FAVORITES_KEY = "budsin_favorites";

            function showToast(msg, isProCta) {
                const el = document.getElementById("toast") || (() => {
                    const t = document.createElement("div"); t.id = "toast";
                    t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(239,63,69,.92);color:#fff;padding:12px 22px;border-radius:999px;font-size:.88rem;font-weight:700;z-index:999999;box-shadow:0 8px 24px rgba(0,0,0,.28);opacity:0;transition:opacity .25s;display:flex;align-items:center;gap:10px;white-space:nowrap";
                    document.body.appendChild(t); return t;
                })();
                if (isProCta) {
                    const t = getTranslations();
                    el.innerHTML = `${msg} <a href="settings.html#proCard" style="color:#ffd700;text-decoration:underline;font-weight:800;white-space:nowrap">⭐ ${t.proGatingCta || "Quiero ser Pro"}</a>`;
                } else {
                    el.textContent = msg;
                }
                el.style.opacity = "1";
                clearTimeout(el._hideTimer);
                el._hideTimer = setTimeout(() => { el.style.opacity = "0"; }, 4000);
            }
            const POPULARITY_KEY = "budsin_popularity";
            const PENDING_POPULARITY_KEY = "budsin_popularity_pending";
            const FIREBASE_COLLECTION = "game_popularity";
            const RECENTLY_PLAYED_KEY = "budsin_recently_played";
            const RECENTLY_PLAYED_MAX = 5;
            const SEARCH_HISTORY_KEY = "budsin_search_history";
            const SEARCH_HISTORY_MAX = 5;
            const COLLECTIONS_KEY = "budsin_collections";
            const COLLECTIONS_LIMIT_FREE = 2;
            const popup = document.getElementById("changelogPopup");
            const closeButton = document.getElementById("closeChangelog");
            const countdownLabel =
                document.getElementById("changelogCountdown");
            const CHANGELOG_CLOSE_DELAY_MS = 5000;
            let changelogCloseReady = true;
            let changelogUnlockTimer = null;
            let changelogCountdownFrame = null;

            // Apply saved theme (auto-detect dark mode if no preference saved)
            var savedTheme = localStorage.getItem("budsin_site_theme");
            if (!savedTheme) {
                savedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
            }
            document.documentElement.setAttribute("data-site-theme", savedTheme);

            const searchInput = document.getElementById("gameSearch");
            const typeFilters = document.getElementById("typeFilters");
            const cards = Array.from(document.querySelectorAll(".game-card"));

            // Precargar audio para la transición (Chrome necesita datos cargados para autoplay)
            let preloadedAudioUrl = "bmusic.mp3";
            fetch("bmusic.mp3")
                .then(r => r.blob())
                .then(blob => { preloadedAudioUrl = URL.createObjectURL(blob); })
                .catch(() => {});

            // Inyectar badge "Nuevo" en tarjetas marcadas
            cards.forEach((card) => {
                if (card.dataset.new === "true") {
                    const badge = document.createElement("span");
                    badge.className = "new-badge";
                    const cover = card.querySelector(".cover");
                    if (cover) cover.appendChild(badge);
                }
            });

            // Inyectar badge "Anticipado para Pro" en tarjetas marcadas
            cards.forEach((card) => {
                if (card.dataset.pro === "true") {
                    const isPro = localStorage.getItem("budsin_pro_active") === "1";
                    if (!isPro) {
                        const badge = document.createElement("span");
                        badge.className = "pro-badge";
                        badge.classList.add("i18n-pro-badge");
                        badge.textContent = "Anticipado para Pro\npróximamente gratis";
                        const cover = card.querySelector(".cover");
                        if (cover) cover.appendChild(badge);
                    }
                }
            });

            // Tooltip en cada tarjeta
            cards.forEach((card) => {
                const tooltip = document.createElement("span");
                tooltip.className = "card-tooltip";
                const cat = card.dataset.category || "";
                const types = (card.dataset.type || "")
                    .split(" ")
                    .filter(Boolean)
                    .join(" · ");
                tooltip.textContent = `${cat}${types ? " — " + types : ""}`;
                card.appendChild(tooltip);
            });

            // Inyectar botón de colecciones en cada tarjeta
            cards.forEach((card) => {
                const colBtn = document.createElement("button");
                colBtn.type = "button";
                colBtn.className = "collection-btn";
                colBtn.textContent = "📁";
                colBtn.setAttribute("aria-label", "Add to collection");
                const content = card.querySelector(".content");
                if (content) {
                    content.appendChild(colBtn);
                    colBtn.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        let popup = document.getElementById("collectionsPopup");
                        if (!popup) {
                            popup = document.createElement("div");
                            popup.id = "collectionsPopup";
                            popup.className = "collections-popup";
                            document.body.appendChild(popup);
                        }
                        const href = getCardHref(card);
                        const cols = getCollections();
                        const t = getTranslations();
                        const rect = colBtn.getBoundingClientRect();
                        let html = `<div class="collections-popup-head">${t.collectionsAddTo || "Añadir a colección"}</div>`;
                        if (cols.length) {
                            html += cols.map(c => {
                                const inCol = c.items.includes(href);
                                return `<button type="button" class="collections-popup-item ${inCol ? 'in-collection' : ''}" data-col-name="${c.name}" data-href="${href}">${inCol ? '✓' : '+'} ${escHtml(c.name)}</button>`;
                            }).join("");
                        } else {
                            html += `<div class="collections-popup-empty">${t.collectionsCreateFirst || "Crea una colección primero"}</div>`;
                        }
                        html += `<button type="button" class="collections-popup-item collections-popup-new" data-href="${href}">➕ ${t.collectionsCreate || "Nueva colección..."}</button>`;
                        popup.innerHTML = html;
                        popup.style.position = "fixed";
                        popup.style.top = Math.min(rect.bottom + 4, window.innerHeight - 200) + "px";
                        popup.style.left = Math.max(8, rect.left - 40) + "px";
                        popup.classList.add("is-visible");

                        popup.querySelectorAll(".collections-popup-item").forEach((item) => {
                            item.addEventListener("click", (ev) => {
                                ev.stopPropagation();
                                if (item.classList.contains("collections-popup-new")) {
                                    const name = prompt(t.collectionsCreatePrompt || "Nombre de la nueva colección:");
                                    if (name && name.trim()) {
                                        addCollection(name.trim());
                                        // Re-append to the new collection
                                        const newCols = getCollections();
                                        const newCol = newCols.find(c => c.name === name.trim());
                                        if (newCol) addToCollection(name.trim(), href);
                                    }
                                } else {
                                    const colName = item.dataset.colName;
                                    toggleCollectionItem(colName, href);
                                }
                                popup.classList.remove("is-visible");
                            });
                        });

                        const closePopup = (ev) => {
                            if (!popup.contains(ev.target) && ev.target !== colBtn) {
                                popup.classList.remove("is-visible");
                                document.removeEventListener("click", closePopup);
                            }
                        };
                        setTimeout(() => document.addEventListener("click", closePopup), 10);
                    });
                }
            });

            // Inyectar botón de leaderboard en cada tarjeta
            cards.forEach((card) => {
                var lbBtn = document.createElement("button");
                lbBtn.type = "button";
                lbBtn.className = "collection-btn";
                lbBtn.textContent = "🏆";
                lbBtn.setAttribute("aria-label", "Leaderboard");
                var content = card.querySelector(".content");
                if (content) {
                    content.appendChild(lbBtn);
                    lbBtn.addEventListener("click", function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        var gameName = card.querySelector("strong").textContent;
                        showLeaderboardPopup(gameName);
                    });
                }
            });

            // ─── Budsin Pro: init Firebase Auth + apply features ───
            function initProAuth() {
                if (!window.firebase) return;
                try {
                    const app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(window.BUDSIN_FIREBASE_CONFIG || {
                        apiKey: "AIzaSyCBN77CtgH-J5NYWhVyW6p1jldXdxbok-U",
                        authDomain: "juanjo-games.firebaseapp.com",
                        projectId: "juanjo-games",
                        storageBucket: "juanjo-games.firebasestorage.app",
                        messagingSenderId: "927529249414",
                        appId: "1:927529249414:web:410a686dc7f0da25ec3f07",
                    });
                    if (!app) return;
                    const auth = app.auth();
                    auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch(function(e) { console.warn("[Budsin] Persistence error:", e); });
                    const db = app.firestore();
                    let currentUser = null;
                    let proPollTimer = null;

                    function checkProStatus(user) {
                        if (!user) return;
                        db.collection("users").doc(user.uid).get()
                            .then((doc) => {
                                const data = doc.exists ? doc.data() : {};
                                let isPro = data.pro === true;
                                const paidUntil = data.paidUntil && data.paidUntil.toDate ? data.paidUntil.toDate() : null;
                                const trialUsed = data.trialUsed === true;
                                if (isPro && paidUntil && paidUntil < new Date()) {
                                    db.collection("users").doc(user.uid).update({ pro: false, trial: false, trialUsed: true, paidUntil: null }).catch(() => {});
                                    isPro = false;
                                }
                                localStorage.setItem("budsin_pro_active", isPro ? "1" : "0");
                                localStorage.setItem("budsin_trial_used", trialUsed ? "1" : "0");
                                if (!isPro) {
                                    try {
                                        var favs = JSON.parse(localStorage.getItem("budsin_favorites") || "[]");
                                        if (favs.length > 20) {
                                            localStorage.setItem("budsin_favorites", JSON.stringify(favs.slice(0, 20)));
                                        }
                                    } catch(_) {}
                                    try {
                                        var cols = JSON.parse(localStorage.getItem(COLLECTIONS_KEY) || "[]");
                                        if (cols.length > COLLECTIONS_LIMIT_FREE) {
                                            localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(cols.slice(0, COLLECTIONS_LIMIT_FREE)));
                                        }
                                    } catch(_) {}
                                }
                                updateTrialCard();
                                applyProFeatures(isPro);
                                renderShelves();
                            })
                            .catch(() => {
                                localStorage.setItem("budsin_pro_active", "0");
                                applyProFeatures(false);
                            });
                    }

                    function updateTrialCard() {
                        const card = document.getElementById("trialCtaCard");
                        if (!card) return;
                        const isPro = localStorage.getItem("budsin_pro_active") === "1";
                        const trialUsed = localStorage.getItem("budsin_trial_used") === "1";
                        if (!isPro && !trialUsed) {
                            card.style.display = "block";
                        } else {
                            card.style.display = "none";
                        }
                    }
                    updateTrialCard();

                    window.handleTrialClick = function() {
                        const user = auth.currentUser;
                        if (!user) {
                            // Not logged in → redirect to settings
                            const lang = currentLanguage || "en";
                            window.location.href = "settings.html?lang=" + lang + "#proCard";
                            return;
                        }
                        // Logged in → check if trial already used
                        const trialUsed = localStorage.getItem("budsin_trial_used") === "1";
                        if (trialUsed) {
                            document.getElementById("trialCtaCard").style.display = "none";
                            return;
                        }
                        // Activate trial
                        const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                        db.collection("users").doc(user.uid).update({
                            pro: true,
                            trial: true,
                            trialUsed: true,
                            proSince: window.firebase.firestore.FieldValue.serverTimestamp(),
                            paidUntil: window.firebase.firestore.Timestamp.fromDate(expiry),
                        }).then(() => {
                            localStorage.setItem("budsin_pro_active", "1");
                            localStorage.setItem("budsin_trial_used", "1");
                            document.getElementById("trialCtaCard").style.display = "none";
                            applyProFeatures(true);
                            renderShelves();
                            const t = getTranslations();
                            showToast("🎁 " + (t.trialCtaTitle || "Free trial activated! 7 days"), false);
                        }).catch((err) => {
                            console.warn("[Budsin] Trial activation error:", err);
                        });
                    };

                    auth.onAuthStateChanged((user) => {
                        currentUser = user;
                        if (user) {
                            localStorage.setItem("budsin_pro_user", JSON.stringify({ uid: user.uid, email: user.email }));
                            checkProStatus(user);
                            // Poll every 5 minutes
                            if (proPollTimer) clearInterval(proPollTimer);
                            proPollTimer = setInterval(function() {
                                if (currentUser) checkProStatus(currentUser);
                            }, 300000);
                        } else {
                            if (proPollTimer) { clearInterval(proPollTimer); proPollTimer = null; }
                            localStorage.removeItem("budsin_pro_user");
                            localStorage.setItem("budsin_pro_active", "0");
                            localStorage.setItem("budsin_trial_used", "0");
                            applyProFeatures(false);
                            updateTrialCard();
                            try {
                                var cols = JSON.parse(localStorage.getItem(COLLECTIONS_KEY) || "[]");
                                if (cols.length > COLLECTIONS_LIMIT_FREE) {
                                    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(cols.slice(0, COLLECTIONS_LIMIT_FREE)));
                                }
                            } catch(_) {}
                        }
                    });

                    // Re-check when tab becomes visible again
                    document.addEventListener("visibilitychange", function() {
                        if (!document.hidden && currentUser) checkProStatus(currentUser);
                    });
                } catch (e) { console.warn("[Budsin Pro] Auth init error:", e); }
            }

            function applyProFeatures(isPro) {
                // Hide ads for Pro users
                const adContainer = document.getElementById("container-3822757dc469f188bf377ea7050634be");
                const adScript = document.querySelector('script[src*="profitablecpmratenetwork"]');
                if (adContainer) adContainer.style.display = isPro ? "none" : "";
                if (adScript) adScript.style.display = isPro ? "none" : "";

                // Show/hide Pro hero message
                const proHeroMsg = document.getElementById("proHeroMessage");
                if (proHeroMsg) proHeroMsg.style.display = isPro ? "" : "none";

                // Add/remove Pro badge in UI
                const metaPortal = document.querySelector('[data-i18n="metaPortal"]');
                if (metaPortal) {
                    let badge = document.getElementById("proUIBadge");
                    if (isPro) {
                        if (!badge) {
                            badge = document.createElement("span");
                            badge.id = "proUIBadge";
                            badge.style.cssText = "display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-size:.6rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;vertical-align:middle";
                            badge.textContent = "⭐ PRO";
                            metaPortal.parentNode.insertBefore(badge, metaPortal.nextSibling);
                        }
                        badge.style.display = "";
                    } else if (badge) {
                        badge.style.display = "none";
                    }
                }
            }

            // ─── Focus / Distraction-Free Mode ───
            var isFocusModeActive = function() {
                var el = document.getElementById("focusOverlay");
                return el && el.style.display === "block";
            };
            
            function initFocusMode() {
                var focusBtn = document.getElementById("focusModeBtn");
                var focusOverlay = document.getElementById("focusOverlay");
                var focusExitBtn = document.getElementById("focusExitBtn");
                if (!focusBtn || !focusOverlay || !focusExitBtn) return;
                
                // Show focus button only for Pro
                var isPro = localStorage.getItem("budsin_pro_active") === "1";
                focusBtn.style.display = isPro ? "" : "none";
                
                focusBtn.addEventListener("click", function() {
                    focusOverlay.style.display = "block";
                    document.body.style.overflow = "hidden";
                    if (document.documentElement.requestFullscreen) {
                        document.documentElement.requestFullscreen().catch(function(){});
                    }
                });
                
                window.exitFocusMode = function() {
                    focusOverlay.style.display = "none";
                    document.body.style.overflow = "";
                    if (document.fullscreenElement && document.exitFullscreen) {
                        document.exitFullscreen().catch(function(){});
                    }
                    // Reset focus content for next use
                    var focusContent = document.getElementById("focusContent");
                    if (focusContent) {
                        var t = getTranslations();
                        focusContent.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:1.2rem;line-height:2"><div style="font-size:4rem;margin-bottom:20px">🎮</div><div>' + (t.focusModeDesc || 'Juega a pantalla completa sin distracciones.') + '</div><div style="margin-top:30px;font-size:.9rem;color:var(--muted);opacity:.6">' + (t.focusModeExit || 'Haz clic en un juego para comenzar o presiona ESC para salir.') + '</div></div>';
                    }
                };
                
                function exitFocus() { window.exitFocusMode(); }
                
                focusExitBtn.addEventListener("click", exitFocus);
                document.addEventListener("keydown", function(e) {
                    if (e.key === "Escape" && focusOverlay.style.display === "block") {
                        exitFocus();
                    }
                });
                
                focusOverlay.addEventListener("click", function(e) {
                    if (e.target === focusOverlay || e.target.closest(".focus-hint")) {
                        exitFocus();
                    }
                });
            }
            
            // Intercept navigation: if focus mode is active, load game in overlay instead
            function loadGameInFocus(url) {
                var focusContent = document.getElementById("focusContent");
                if (!focusContent) return false;
                focusContent.innerHTML = '<div style="position:absolute;top:0;left:0;width:100%;height:100%"><iframe src="' + url + '" style="width:100%;height:100%;border:none" allowfullscreen></iframe></div>';
                return true;
            }
            
            // Update Pro UI elements when Pro status changes
            var _origApplyPro = applyProFeatures;
            applyProFeatures = function(isPro) {
                _origApplyPro(isPro);
                var focusBtn = document.getElementById("focusModeBtn");
                if (focusBtn) focusBtn.style.display = isPro ? "" : "none";
                var statusEl = document.getElementById("onlineStatus");
                if (statusEl) {
                    if (isPro) {
                        statusEl.style.display = "";
                        statusEl.textContent = navigator.onLine ? "🟢 Online" : "🔴 Offline — Pro offline active";
                        statusEl.style.background = navigator.onLine ? "rgba(47,201,138,0.12)" : "rgba(239,63,69,0.12)";
                        statusEl.style.color = navigator.onLine ? "var(--green)" : "var(--red)";
                        statusEl.style.borderColor = navigator.onLine ? "rgba(47,201,138,0.3)" : "rgba(239,63,69,0.3)";
                    } else {
                        statusEl.style.display = "none";
                    }
                }
            };
            
            // ─── Achievements System ───
            var ACHIEVEMENTS_KEY = "budsin_achievements";
            var PLAY_STATS_KEY = "budsin_play_stats";
            
            var ACHIEVEMENTS = [
                { id: "first_game", icon: "🎮", category: "firstGame", categoryDesc: "firstGameDesc" },
                { id: "ten_games", icon: "🏆", category: "tenGames", categoryDesc: "tenGamesDesc" },
                { id: "all_categories", icon: "🌐", category: "allCategories", categoryDesc: "allCategoriesDesc" },
                { id: "pro_member", icon: "⭐", category: "proMember", categoryDesc: "proMemberDesc" },
                { id: "fav_five", icon: "❤️", category: "favFive", categoryDesc: "favFiveDesc" },
                { id: "collection", icon: "📁", category: "collection", categoryDesc: "collectionDesc" },
                { id: "streak", icon: "🔥", category: "streak", categoryDesc: "streakDesc" },
                { id: "social", icon: "🤝", category: "social", categoryDesc: "socialDesc" },
            ];
            
            function getAchievements() { return readJson(ACHIEVEMENTS_KEY, {}); }
            function saveAchievements(a) { writeJson(ACHIEVEMENTS_KEY, a); }
            
            function unlockAchievement(id) {
                var ach = getAchievements();
                if (ach[id]) return false;
                ach[id] = { unlocked: true, date: new Date().toISOString() };
                saveAchievements(ach);
                var t = getTranslations();
                var def = ACHIEVEMENTS.find(function(a) { return a.id === id; });
                var name = def ? (t[def.category] || id) : id;
                showToast("🏅 " + (t.achievementsUnlocked || "Logro desbloqueado") + ": " + name, false);
                return true;
            }
            
            function checkAchievements(gameName, category) {
                var t = getTranslations();
                // First game
                var recent = readJson(RECENTLY_PLAYED_KEY, []);
                if (recent.length >= 1) unlockAchievement("first_game");
                if (recent.length >= 10) unlockAchievement("ten_games");
                
                // All categories
                var cats = new Set(recent.map(function(h) {
                    var card = cards.find(function(c) { return getCardHref(c) === h; });
                    return card ? (card.dataset.category || "") : "";
                }).filter(Boolean));
                var allCats = new Set(cards.map(function(c) { return c.dataset.category || ""; }).filter(Boolean));
                var covered = true;
                allCats.forEach(function(c) { if (!cats.has(c)) covered = false; });
                if (covered && allCats.size >= 2) unlockAchievement("all_categories");
                
                // Pro member
                if (localStorage.getItem("budsin_pro_active") === "1") unlockAchievement("pro_member");
                
                // Fav five
                var favs = readJson(FAVORITES_KEY, []);
                if (favs.length >= 5) unlockAchievement("fav_five");
                
                // Collection
                var cols = getCollections();
                if (cols.length >= 1) unlockAchievement("collection");
                
                // Play streak
                var stats = readJson(PLAY_STATS_KEY, {});
                var dates = Object.keys(stats.playDates || {}).sort().reverse();
                if (dates.length >= 7) {
                    var streak = 1;
                    var today = new Date();
                    for (var i = 0; i < dates.length - 1; i++) {
                        var d1 = new Date(dates[i]);
                        var d2 = new Date(dates[i+1]);
                        var diff = (d1 - d2) / 86400000;
                        if (Math.round(diff) === 1) streak++;
                        else break;
                    }
                    if (streak >= 7) unlockAchievement("streak");
                }
            }
            
            function trackPlaySession(gameName) {
                var stats = readJson(PLAY_STATS_KEY, {});
                var today = new Date().toISOString().slice(0, 10);
                if (!stats.playDates) stats.playDates = {};
                if (!stats.playDates[today]) stats.playDates[today] = { count: 0, games: [] };
                stats.playDates[today].count++;
                if (stats.playDates[today].games.indexOf(gameName) === -1) stats.playDates[today].games.push(gameName);
                if (!stats.totalSessions) stats.totalSessions = 0;
                stats.totalSessions++;
                if (!stats.gamesPlayed) stats.gamesPlayed = {};
                stats.gamesPlayed[gameName] = (stats.gamesPlayed[gameName] || 0) + 1;
                writeJson(PLAY_STATS_KEY, stats);
                checkAchievements(gameName);
            }

            // ─── Leaderboards ───
            var LEADERBOARD_COLLECTION = "game_leaderboards";
            
            function submitLeaderboardScore(gameName, score, playerName) {
                if (localStorage.getItem("budsin_pro_active") !== "1") {
                    showToast(getTranslations().leaderboardProOnly || "Solo Pro puede enviar puntuaciones", true);
                    return Promise.reject("PRO_REQUIRED");
                }
                if (!firebaseEnabled || !firebaseDb) {
                    showToast("Firebase no disponible", false);
                    return Promise.reject("FIREBASE_UNAVAILABLE");
                }
                var key = encodeURIComponent(gameName.toLowerCase().replace(/\s+/g, "-"));
                var docRef = firebaseDb.collection(LEADERBOARD_COLLECTION).doc(key);
                return docRef.set({
                    gameName: gameName,
                    lastScore: score,
                    lastPlayer: playerName || "Anonymous",
                    updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
                }, { merge: true }).then(function() {
                    // Also add to scores subcollection
                    return docRef.collection("scores").add({
                        playerName: playerName || "Anonymous",
                        score: Number(score),
                        timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
                    });
                }).then(function() {
                    showToast(getTranslations().leaderboardSubmitted || "Puntuación enviada!", false);
                    return true;
                }).catch(function(err) {
                    console.warn("[Budsin] Leaderboard error:", err);
                    showToast("Error al enviar puntuación", false);
                    return false;
                });
            }
            
            function getLeaderboardScores(gameName) {
                if (!firebaseEnabled || !firebaseDb) return Promise.resolve([]);
                var key = encodeURIComponent(gameName.toLowerCase().replace(/\s+/g, "-"));
                return firebaseDb.collection(LEADERBOARD_COLLECTION).doc(key)
                    .collection("scores")
                    .orderBy("score", "desc")
                    .limit(10)
                    .get()
                    .then(function(snap) {
                        var scores = [];
                        snap.forEach(function(doc) {
                            scores.push(doc.data());
                        });
                        return scores;
                    }).catch(function() { return []; });
            }
            
            // ─── Leaderboard Popup ───
            var _leaderboardCurrentGame = "";
            
            function showLeaderboardPopup(gameName) {
                var popup = document.getElementById("leaderboardPopup");
                var titleEl = document.getElementById("leaderboardGameName");
                var scoresEl = document.getElementById("leaderboardScores");
                var submitEl = document.getElementById("leaderboardSubmitSection");
                if (!popup) return;
                _leaderboardCurrentGame = gameName;
                if (titleEl) titleEl.textContent = gameName;
                if (scoresEl) scoresEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Cargando...</div>';
                popup.style.display = "flex";
                popup.setAttribute("aria-hidden", "false");
                
                // Check if Pro for submission
                var isPro = localStorage.getItem("budsin_pro_active") === "1";
                if (submitEl) submitEl.style.display = isPro ? "block" : "none";
                
                // Load scores
                getLeaderboardScores(gameName).then(function(scores) {
                    if (!scoresEl) return;
                    var t = getTranslations();
                    if (!scores.length) {
                        scoresEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)" data-i18n="leaderboardNoData">' + (t.leaderboardNoData || "Sé el primero en jugar!") + '</div>';
                        return;
                    }
                    scoresEl.innerHTML = '<div style="display:flex;flex-direction:column;gap:6px">' +
                        scores.slice(0, 10).map(function(s, i) {
                            var medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + (i + 1);
                            return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:10px;background:' + (i < 3 ? 'rgba(255,215,0,0.06)' : 'var(--bg-2)') + '">' +
                                '<span style="font-weight:600;font-size:.88rem">' + medal + ' ' + escHtml(s.playerName || "Anonymous") + '</span>' +
                                '<span style="font-weight:800;color:var(--text)">' + Number(s.score || 0).toLocaleString() + '</span>' +
                            '</div>';
                        }).join('') + '</div>';
                }).catch(function() {
                    if (scoresEl) scoresEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--red)">Error loading scores</div>';
                });
            }
            
            function closeLeaderboardPopup() {
                var popup = document.getElementById("leaderboardPopup");
                if (!popup) return;
                popup.style.display = "none";
                popup.setAttribute("aria-hidden", "true");
            }
            
            // ─── Game Requests ───
            var GAME_REQUESTS_COLLECTION = "game_requests";
            
            function submitGameRequest(name, url, description) {
                if (localStorage.getItem("budsin_pro_active") !== "1") {
                    showToast(getTranslations().gameRequestProOnly || "Solo Pro puede solicitar juegos", true);
                    return Promise.reject("PRO_REQUIRED");
                }
                if (!firebaseEnabled || !firebaseDb) {
                    showToast("Firebase no disponible", false);
                    return Promise.reject("FIREBASE_UNAVAILABLE");
                }
                var user = null;
                try {
                    var raw = localStorage.getItem("budsin_pro_user");
                    if (raw) user = JSON.parse(raw);
                } catch(_) {}
                return firebaseDb.collection(GAME_REQUESTS_COLLECTION).add({
                    gameName: name,
                    gameUrl: url,
                    description: description || "",
                    uid: user ? user.uid : "anonymous",
                    email: user ? user.email : "anonymous",
                    status: "pending",
                    createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
                }).then(function() {
                    showToast(getTranslations().gameRequestSuccess || "Solicitud enviada!", false);
                    return true;
                }).catch(function(err) {
                    console.warn("[Budsin] Game request error:", err);
                    showToast("Error al enviar solicitud", false);
                    return false;
                });
            }

            // ─── Onboarding Tutorial ───
            var TUTORIAL_KEY = "budsin_tutorial_done_v2";
            var TUTORIAL_STEPS = [
                { icon: "🌐", titleKey: "tutorialLangTitle", descKey: "tutorialLangDesc", selector: null, placement: "center", action: "language" },
                { icon: "👋", titleKey: "tutorialStep1Title", descKey: "tutorialStep1Desc", selector: null, placement: "center" },
                { icon: "🔍", titleKey: "tutorialStep2Title", descKey: "tutorialStep2Desc", selector: "#gameSearch", placement: "bottom", offsetY: 8 },
                { icon: "🏷️", titleKey: "tutorialStep3Title", descKey: "tutorialStep3Desc", selector: "#typeFilters", placement: "bottom", offsetY: 8 },
                { icon: "🎮", titleKey: "tutorialStep4Title", descKey: "tutorialStep4Desc", selector: "#gamesGrid .game-card", placement: "top", offsetY: -12 },
                { icon: "⭐", titleKey: "tutorialStep5Title", descKey: "tutorialStep5Desc", selector: "#gamesGrid .game-card:first-child .favorite-btn", placement: "top", offsetY: -12 },
                { icon: "📁", titleKey: "tutorialStep6Title", descKey: "tutorialStep6Desc", selector: "#collectionsShelf", placement: "top", offsetY: -12 },
                { icon: "🎲", titleKey: "tutorialStep7Title", descKey: "tutorialStep7Desc", selector: "#randomGameBtn", placement: "bottom", offsetY: 8 },
                { icon: "⌨️", titleKey: "tutorialStepHideTitle", descKey: "tutorialStepHideDesc", selector: null, placement: "center", action: "hotkey" },
                { icon: "⚙️", titleKey: "tutorialStep8Title", descKey: "tutorialStep8Desc", selector: "#settingsPageLink", placement: "bottom", offsetY: 8, action: "settings" },
                { icon: "✅", titleKey: "tutorialStep9Title", descKey: "tutorialStep9Desc", selector: null, placement: "center" },
            ];
            var _tutorialStep = 0;

            function startTutorial(stepIndex) {
                _tutorialStep = typeof stepIndex === "number" ? Math.max(0, Math.min(stepIndex, TUTORIAL_STEPS.length - 1)) : 0;
                var overlay = document.getElementById("tutorialOverlay");
                if (overlay) overlay.style.display = "block";
                renderTutorialStep();
            }

            function renderTutorialStep() {
                var t = getTranslations();
                var overlay = document.getElementById("tutorialOverlay");
                var highlight = document.getElementById("tutorialHighlight");
                var card = document.getElementById("tutorialCard");
                var stepIcon = document.getElementById("tutorialStepIcon");
                var stepTitle = document.getElementById("tutorialStepTitle");
                var stepDesc = document.getElementById("tutorialStepDesc");
                var progress = document.getElementById("tutorialProgress");
                var prevBtn = document.getElementById("tutorialPrevBtn");
                var nextBtn = document.getElementById("tutorialNextBtn");
                var doneBtn = document.getElementById("tutorialDoneBtn");
                if (!overlay || overlay.style.display !== "block") return;

                var step = TUTORIAL_STEPS[_tutorialStep];
                if (stepIcon) stepIcon.textContent = step.icon || "👋";
                if (stepTitle) stepTitle.textContent = t[step.titleKey] || step.titleKey;
                if (stepDesc) stepDesc.textContent = t[step.descKey] || step.descKey;
                if (progress) progress.textContent = (_tutorialStep + 1) + " / " + TUTORIAL_STEPS.length;

                // Show tutorial image only for hotkey step
                var img = document.getElementById("tutorialStepImg");
                if (img) img.style.display = step.action === "hotkey" ? "block" : "none";

                // Language step: show 3 language options inside the tutorial
                if (step.action === "language") {
                    if (prevBtn) prevBtn.style.display = "none";
                    if (nextBtn) nextBtn.style.display = "none";
                    if (doneBtn) doneBtn.style.display = "none";
                    if (stepIcon) stepIcon.textContent = "🌐";
                    if (stepTitle) stepTitle.textContent = t.tutorialLangTitle || "Select your language";
                    if (stepDesc) {
                        stepDesc.innerHTML =
                            '<div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">' +
                                '<button type="button" class="tut-lang-btn" data-lang="es" style="padding:10px 16px;border-radius:12px;border:2px solid var(--line);background:var(--surface-strong);cursor:pointer;font:inherit;font-size:.9rem;font-weight:700;color:var(--text);display:flex;align-items:center;gap:10px;transition:border-color .2s">🇪🇸 Español</button>' +
                                '<button type="button" class="tut-lang-btn" data-lang="en" style="padding:10px 16px;border-radius:12px;border:2px solid var(--line);background:var(--surface-strong);cursor:pointer;font:inherit;font-size:.9rem;font-weight:700;color:var(--text);display:flex;align-items:center;gap:10px;transition:border-color .2s">🇬🇧 English</button>' +
                                '<button type="button" class="tut-lang-btn" data-lang="pt" style="padding:10px 16px;border-radius:12px;border:2px solid var(--line);background:var(--surface-strong);cursor:pointer;font:inherit;font-size:.9rem;font-weight:700;color:var(--text);display:flex;align-items:center;gap:10px;transition:border-color .2s">🇧🇷 Português</button>' +
                            '</div>';
                        stepDesc.querySelectorAll(".tut-lang-btn").forEach(function(btn) {
                            btn.addEventListener("click", function() {
                                var lang = this.dataset.lang;
                                localStorage.setItem("budsin_language", lang);
                                currentLanguage = lang;
                                applyLanguage(lang);
                                _tutorialStep = 1;
                                renderTutorialStep();
                            });
                            btn.addEventListener("mouseenter", function() { this.style.borderColor = "#ffd700"; });
                            btn.addEventListener("mouseleave", function() { this.style.borderColor = ""; });
                        });
                    }
                    if (progress) progress.textContent = "1 / " + TUTORIAL_STEPS.length;
                    // Skip normal step rendering below
                } else
                // Hotkey step: wait for user to press the backtick key
                if (step.action === "hotkey") {
                    if (prevBtn) prevBtn.style.display = _tutorialStep > 0 ? "" : "none";
                    if (nextBtn) nextBtn.style.display = "none";
                    if (doneBtn) doneBtn.style.display = "none";
                    // Read stored hotkey config (default: Backquote)
                    var _hk = [];
                    try {
                        var stored = localStorage.getItem("budsin_hotkey");
                        if (stored) _hk = JSON.parse(stored);
                        if (!Array.isArray(_hk)) _hk = [stored];
                    } catch(_) {}
                    if (!_hk.length) _hk = ["Backquote", "IntlBackslash"];
                    // Save original title/favicon to restore if classroom-hotkey changes them
                    var _origTitle = document.title;
                    var _origFav = (document.querySelector("link[rel~='icon']") || {}).href || "";
                    // One-time capture phase listener on window (same phase as classroom-hotkey)
                    var _hkHandler = function(e) {
                        if (_hk.indexOf(e.code) !== -1) {
                            // Reverse overlay if classroom-hotkey already opened it (runs in same tick, no paint)
                            var _ov = document.getElementById("juanjo-classroom-overlay");
                            if (_ov && _ov.classList.contains("is-open")) {
                                _ov.classList.remove("is-open");
                                document.body.classList.remove("juanjo-classroom-open");
                                _ov.setAttribute("aria-hidden", "true");
                                document.title = _origTitle;
                                var _fi = document.querySelector("link[rel~='icon']");
                                if (_fi && _origFav) _fi.href = _origFav;
                            }
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            window.removeEventListener("keydown", _hkHandler, true);
                            showToast(t.tutorialStepHideSuccess || "✅ Bien!", false);
                            setTimeout(function() { nextTutorialStep(); }, 800);
                        }
                    };
                    window.addEventListener("keydown", _hkHandler, true);
                    // Clean up if user goes back
                    var _origPrev = prevTutorialStep;
                    prevTutorialStep = function() {
                        window.removeEventListener("keydown", _hkHandler, true);
                        _origPrev();
                        prevTutorialStep = _origPrev;
                    };
                } else {
                    if (prevBtn) prevBtn.style.display = _tutorialStep > 0 ? "" : "none";
                    if (nextBtn) nextBtn.style.display = _tutorialStep < TUTORIAL_STEPS.length - 1 ? "" : "none";
                    if (doneBtn) doneBtn.style.display = _tutorialStep === TUTORIAL_STEPS.length - 1 ? "" : "none";
                }

                // Remove previous highlights
                document.querySelectorAll(".tutorial-target-highlight").forEach(function(el) {
                    el.classList.remove("tutorial-target-highlight");
                });

                if (!step.selector) {
                    // Center card - no highlight
                    if (highlight) highlight.style.display = "none";
                    if (card) {
                        card.style.left = "50%";
                        card.style.top = "50%";
                        card.style.transform = "translate(-50%,-50%)";
                        card.style.display = "block";
                    }
                    return;
                }

                var target = document.querySelector(step.selector);
                if (!target || !highlight || !card) {
                    if (card) { card.style.display = "none"; }
                    return;
                }

                // Highlight target
                target.classList.add("tutorial-target-highlight");
                target.scrollIntoView({ block: "center" });
                var rect = target.getBoundingClientRect();
                highlight.style.display = "block";
                highlight.style.left = (rect.left - 6) + "px";
                highlight.style.top = (rect.top - 6) + "px";
                highlight.style.width = (rect.width + 12) + "px";
                highlight.style.height = (rect.height + 12) + "px";

                // Position card near target
                var placement = step.placement || "bottom";
                var offsetY = step.offsetY || 0;
                card.style.transform = "none";
                card.style.position = "fixed";

                if (placement === "bottom") {
                    card.style.left = Math.max(8, Math.min(rect.left + rect.width / 2 - 180, window.innerWidth - 368)) + "px";
                    card.style.top = (rect.bottom + 12 + offsetY) + "px";
                } else if (placement === "top") {
                    card.style.left = Math.max(8, Math.min(rect.left + rect.width / 2 - 180, window.innerWidth - 368)) + "px";
                    card.style.top = (rect.top - 12 - 200 + offsetY) + "px";
                    // If above viewport, show below instead
                    if (parseInt(card.style.top) < 10) {
                        card.style.top = (rect.bottom + 12) + "px";
                    }
                }
                card.style.display = "block";
            }

            function nextTutorialStep() {
                var step = TUTORIAL_STEPS[_tutorialStep];
                if (step && step.action === "settings") {
                    // Save tutorial progress and navigate to settings
                    try { localStorage.setItem(TUTORIAL_KEY + "_step", "settings_visited"); } catch(_) {}
                    window.location.href = "settings.html?tutorial=1";
                    return;
                }
                if (_tutorialStep < TUTORIAL_STEPS.length - 1) {
                    _tutorialStep++;
                    renderTutorialStep();
                } else {
                    finishTutorial();
                }
            }

            function prevTutorialStep() {
                if (_tutorialStep > 0) {
                    _tutorialStep--;
                    renderTutorialStep();
                }
            }

            function finishTutorial() {
                try { localStorage.setItem(TUTORIAL_KEY, "1"); } catch(_) {}
                var overlay = document.getElementById("tutorialOverlay");
                if (overlay) overlay.style.display = "none";
                document.querySelectorAll(".tutorial-target-highlight").forEach(function(el) {
                    el.classList.remove("tutorial-target-highlight");
                });
                try {
                    var seenVersion = localStorage.getItem(STORAGE_KEY);
                    if (ENABLE_CHANGELOG_POPUP && seenVersion !== SITE_VERSION) {
                        showChangelog();
                    }
                } catch (_) {
                    if (ENABLE_CHANGELOG_POPUP) showChangelog();
                }
            }

            // ─── Online Status Indicator ───
            function initOnlineStatus() {
                var el = document.getElementById("onlineStatus");
                if (!el) return;
                function update() {
                    var isOnline = navigator.onLine;
                    var isPro = localStorage.getItem("budsin_pro_active") === "1";
                    if (isPro) {
                        el.style.display = "";
                        el.textContent = isOnline ? "🟢 Online" : "🔴 Offline — Pro offline active";
                        el.style.background = isOnline ? "rgba(47,201,138,0.12)" : "rgba(239,63,69,0.12)";
                        el.style.color = isOnline ? "var(--green)" : "var(--red)";
                        el.style.borderColor = isOnline ? "rgba(47,201,138,0.3)" : "rgba(239,63,69,0.3)";
                    } else {
                        el.style.display = "none";
                    }
                }
                update();
                window.addEventListener("online", update);
                window.addEventListener("offline", update);
                window.addEventListener("storage", function(e) {
                    if (e.key === "budsin_pro_active") update();
                });
            }

            // ─── Share Collection ───
            function shareCollection(name) {
                var isPro = localStorage.getItem("budsin_pro_active") === "1";
                if (!isPro) {
                    showToast(getTranslations().shareCollectionProOnly || "Solo Pro puede compartir colecciones", true);
                    return;
                }
                var cols = getCollections();
                var col = cols.find(function(c) { return c.name === name; });
                if (!col) { showToast("Colección no encontrada", false); return; }
                var data = JSON.stringify({ type: "budsin_collection", name: col.name, items: col.items });
                var encoded = btoa(encodeURIComponent(data));
                var url = window.location.origin + "/?shared_collection=" + encoded;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url).then(function() {
                        showToast(getTranslations().shareCollectionCopied || "🔗 Link copiado!", false);
                    }).catch(function() {
                        fallbackCopy(url);
                    });
                } else {
                    fallbackCopy(url);
                }
                function fallbackCopy(text) {
                    var ta = document.createElement("textarea");
                    ta.value = text;
                    ta.style.position = "fixed";
                    ta.style.opacity = "0";
                    document.body.appendChild(ta);
                    ta.select();
                    try { document.execCommand("copy"); showToast("🔗 Link copiado!", false); } catch(e) { showToast("Error al copiar", false); }
                    document.body.removeChild(ta);
                }
                unlockAchievement("social");
            }

            // ─── Init Online Status ───
            initOnlineStatus();

            // Check localStorage first (set by settings.html), then init Firebase Auth for live updates
            const localPro = localStorage.getItem("budsin_pro_active") === "1";
            applyProFeatures(localPro);
            initProAuth();

            // Contador de juegos en badgeGames
            const totalGames = cards.length;

            // Chips dinámicos de categorías (sin duplicar tipos ya cubiertos por typeFilters)
            const categoryFilters = document.getElementById("categoryFilters");
            const typeValues = new Set(
                Array.from(typeFilters.querySelectorAll(".chip")).map(
                    (c) => c.dataset.type,
                ),
            );
            const typeToCategory = {
                action: "Acción",
                multiplayer: "Multiplayer",
                idle: "Idle",
                classic: "Clásicos",
                clicker: "Idle",
                tools: "Herramientas",
            };
            const coveredCategories = new Set(
                [...typeValues].map((v) => typeToCategory[v]).filter(Boolean),
            );
            const uniqueCategories = [
                ...new Set(
                    cards
                        .map((c) => c.dataset.category || "")
                        .filter(Boolean),
                ),
            ].filter((c) => !coveredCategories.has(c));
            if (categoryFilters && uniqueCategories.length) {
                uniqueCategories.forEach((cat) => {
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "chip";
                    btn.dataset.category = cat;
                    btn.textContent = cat;
                    categoryFilters.appendChild(btn);
                });
            }

            const gamesGrid = document.getElementById("gamesGrid");
            const noResults = document.getElementById("noResults");
            const resultsCount = document.getElementById("resultsCount");
            const favoritesList = document.getElementById("favoritesList");
            const popularList = document.getElementById("popularList");
            const recentlyPlayedList =
                document.getElementById("recentlyPlayedList");
            const appTransition = document.getElementById("appTransition");
            const languageSelect = document.getElementById("languageSelect");
            const settingsPageLink =
                document.getElementById("settingsPageLink");
            const LANGUAGE_KEY = "budsin_language";
            const TRANSLATIONS = {
                es: {
                    htmlLang: "es",
                    pageTitle: "Budsin Games",
                    heroTitle: "Budsin Games",
                    heroSubtitle:
                        "Una portada pensada como menu de consola: entra al portal, elige una caratula y salta directo a jugar desde el navegador.",
                    badgeGames: "40 juegos listos",
                    badgeQuick: "Entrada rapida",
                    badgeLibrary: "Biblioteca estilo Switch",
                    showcaseMode: "Modo consola",
                    showcasePrimaryTitle: "Tu biblioteca al instante",
                    showcasePrimaryText:
                        "Las portadas son el centro de la experiencia, con un inicio mas visual, limpio y rapido para entrar a cada juego.",
                    showcaseFav: "Favoritos",
                    showcaseSecondaryTitle:
                        "Minecraft, FNF, clickers y clasicos del portal",
                    showcaseSecondaryText:
                        "Todo queda a un clic, como una fila de juegos en pantalla principal.",
                    libraryKicker: "Biblioteca",
                    libraryTitle: "Elige tu siguiente partida",
                    libraryText:
                        "Las portadas funcionan como accesos directos. Abre un juego, vuelve al portal y sigue navegando como si fuera el menu de una consola.",
                    metaLive: "Actualizado en vivo",
                    metaPortal: "Budsin Portal",
                    metaReady: "Biblioteca rapida y lista para jugar",
                    searchPlaceholder: "Buscar juego por nombre...",
                    chipAll: "Todos",
                    chipClicker: "Clicker",
                    chipAction: "Acción",
                    chipMultiplayer: "Multiplayer",
                    chipIdle: "Idle",
                    chipClassic: "Clásicos",
                    chipTools: "🛠️ Herramientas",
                    shelfPopular: "🔥 Más jugados",
                    shelfFavorites: "🎮 Tus juegos",
                    noFavorites: "Aún no tienes favoritos.",
                    visibleCategories:
                        "Categorías visibles: Acción · Idle · Multiplayer · Clásicos · 🛠️ Herramientas",
                    noResults:
                        "No encontramos juegos con ese filtro. Prueba otra búsqueda.",
                    suggestionsLink: "Envia tus sugerencias a Budsin",
                    loadingPage: "Cargando página...",
                    loaderLabel: "Cargando",
                    skipLoading: "Saltar 🡥",
                    closeNotification: "Cerrar notificación",
                    changelogTitle: "Novedades de Budsin Games",
                    changelogDesc:
                        "Este popup solo aparece una vez por versión o la primera vez que entras al sitio.",
                    changelogItem1:
                        "Corregidos errores de indexación SEO: eliminadas etiquetas noindex, añadido canonical y robots.txt optimizado.",
                    settingsPageLink: "⚙️ Ajustes",
                    newBadge: "Nuevo",
                    resultsCount: (count) => `${count} juegos`,
                    favoriteSaved: "Guardado",
                    playersLabel: "jugadores",
                    chipRecent: "🆕 Recientes",
                    randomGame: "🎲 Juego al azar",
                    shelfRecent: "🕐 Jugado recientemente",
                    noRecent: "Aún no has jugado nada.",
                    favLimitReached: "Límite de favoritos alcanzado (20). Hazte Pro para ilimitados.",
                    proHeroMessage: "¡Eres Pro! Muchas gracias por apoyarme 🫶",
                    proGatingTitle: "Juego exclusivo para Budsin Pro",
                    proGatingSub: "Este juego está disponible primero para usuarios Pro.",
                    proGatingBenefits: "⭐ Ventajas de ser Pro",
                    proGatingNoAds: "✓ Sin anuncios en el portal",
                    proGatingGoldTheme: "✓ Tema Gold exclusivo",
                    proGatingUnlimitedFavs: "✓ Favoritos ilimitados",
                    proGatingEarlyAccess: "✓ Acceso anticipado a juegos nuevos",
                    proGatingStats: "✓ Estadísticas de tu actividad",
                    proGatingPrice: "$2.99 USD / S/ 7 PEN por mes",
                    proGatingCta: "⭐ Quiero ser Pro",
                    proGatingClose: "Cerrar",
                    proBadge: "Anticipado para Pro\npróximamente gratis",
                    sortLabel: "Ordenar:",
                    sortPopular: "Más jugados",
                    sortAlphabetical: "A-Z",
                    sortNewest: "Más nuevos",
                    trialCtaTitle: "🎁 Prueba Budsin Pro gratis 7 días",
                    trialCtaDesc: "Sin anuncios, tema Gold, favoritos ilimitados y acceso anticipado. Sin compromiso.",
                    searchHistoryTitle: "Búsquedas recientes",
                    shelfCollections: "📁 Mis colecciones",
                    collectionsCreate: "Nueva colección",
                    collectionsCreatePrompt: "Nombre de la nueva colección:",
                    collectionsRename: "Renombrar",
                    collectionsRenamePrompt: "Nuevo nombre para la colección:",
                    collectionsDelete: "Eliminar",
                    collectionsDeleteConfirm: "¿Eliminar colección",
                    collectionsEmpty: "Tus colecciones aparecerán aquí. Crea una y añade juegos desde cada tarjeta.",
                    collectionsAddTo: "Añadir a colección",
                    collectionsCreateFirst: "Crea una colección primero",
                    collectionsLimitReached: "Límite de colecciones alcanzado (2). Hazte Pro para ilimitadas.",
                    categoriesLabel: "Categorías",
                    articlesKicker: "Consejos y guías",
                    articlesTitle: "Tips para sacarle más partido al portal",
                    article1Title: "Cómo usar el modo oculto",
                    article1Desc: "El Classroom Hotkey te permite ocultar el portal al instante. Configura tu tecla de acceso rápido y una URL de disfraz desde la página de Ajustes. Al pulsar la tecla, el sitio se redirige a la URL que prefieras.",
                    article1Cta: "Ir a Ajustes →",
                    article2Title: "Guarda tus favoritos",
                    article2Desc: "Haz clic en la estrella de cualquier juego para añadirlo a tu lista de favoritos. Los favoritos se guardan automáticamente en tu navegador y aparecen en la sección Tus juegos para que los encuentres al instante.",
                    article3Title: "Busca y filtra juegos",
                    article3Desc: "Usa el buscador en tiempo real para encontrar juegos por nombre. También puedes filtrar por categoría: Acción, Idle, Multiplayer, Clásicos o herramientas. El contador de resultados te muestra cuántos juegos coinciden.",
                    article4Title: "Cambia de idioma",
                    article4Desc: "El portal está disponible en español, inglés y portugués. Usa el selector de idioma en la esquina superior derecha para cambiar al instante. Tu preferencia quedará guardada para la próxima visita.",
                    article5Title: "Explora los más jugados",
                    article5Desc: "La sección 'Más jugados' muestra los juegos más populares del portal según el conteo de clics. El ranking se actualiza en tiempo real y te ayuda a descubrir qué están jugando otros usuarios.",
                    article6Title: "Juego al azar",
                    article6Desc: "Usa el botón 'Juego al azar' para descubrir un juego aleatorio del catálogo. Es perfecto cuando no sabes qué jugar y quieres explorar títulos nuevos.",
                    article7Title: "Ranking de popularidad",
                    article7Desc: "Cada juego muestra su contador de jugadores en tiempo real. Los números se actualizan con cada clic y determinan qué juegos aparecen en el ranking de populares.",
                    footerTagline: "Juegos gratis en el navegador",
                    footerAbout: "Acerca de",
                    footerPrivacy: "Privacidad",
                    footerTerms: "Términos",
                    footerContact: "Contacto",
                    footerFeedback: "Comentarios",
                    footerCopy: "© 2026 Budsin Games. Todos los juegos pertenecen a sus respectivos creadores.",
                    // New Pro features v6.2
                    focusModeBtn: "🧘 Focus",
                    focusModeTitle: "Modo sin distracciones",
                    focusModeDesc: "Oculta toda la interfaz para jugar a pantalla completa.",
                    focusModeExit: "Presiona ESC para salir del modo Focus",
                    leaderboardTitle: "🏆 Leaderboards",
                    leaderboardNoData: "Sé el primero en jugar!",
                    leaderboardRank: "#",
                    leaderboardPlayer: "Jugador",
                    leaderboardScore: "Puntuación",
                    leaderboardSubmit: "Enviar puntuación",
                    leaderboardSubmitHint: "Envía tu puntuación a la tabla global",
                    leaderboardScorePlaceholder: "Tu puntuación...",
                    leaderboardSubmitted: "Puntuación enviada!",
                    leaderboardProOnly: "Solo usuarios Pro pueden enviar puntuaciones",
                    profileTitle: "Perfil",
                    profileAvatar: "Avatar",
                    profileDisplayName: "Nombre público",
                    profileBio: "Biografía",
                    profileSaved: "Perfil guardado",
                    profileSave: "Guardar perfil",
                    achievementsTitle: "🏅 Logros",
                    achievementsProgress: "Progreso",
                    achievementsLocked: "🔒",
                    achievementsUnlocked: "✅",
                    achievementFirstGame: "Primer juego",
                    achievementFirstGameDesc: "Juega tu primer juego",
                    achievementTenGames: "Veterano",
                    achievementTenGamesDesc: "Juega 10 juegos diferentes",
                    achievementAllCategories: "Explorador",
                    achievementAllCategoriesDesc: "Prueba juegos de todas las categorías",
                    achievementProMember: "Pro Player",
                    achievementProMemberDesc: "Activa Budsin Pro",
                    achievementFavFive: "Fanático",
                    achievementFavFiveDesc: "Añade 5 juegos a favoritos",
                    achievementCollection: "Coleccionista",
                    achievementCollectionDesc: "Crea tu primera colección",
                    achievementStreak: "Racha",
                    achievementStreakDesc: "Juega 7 días seguidos",
                    achievementSocial: "Social",
                    achievementSocialDesc: "Comparte una colección",
                    exportTitle: "Exportar datos",
                    exportDesc: "Descarga tus datos (favoritos, colecciones, ajustes)",
                    exportBtn: "📥 Exportar JSON",
                    exportSuccess: "Datos exportados",
                    gameRequestTitle: "Solicitar juego",
                    gameRequestName: "Nombre del juego",
                    gameRequestUrl: "URL del juego",
                    gameRequestDesc: "Descripción",
                    gameRequestSubmit: "Enviar solicitud",
                    gameRequestSuccess: "Solicitud enviada! Los admins la revisarán.",
                    gameRequestProOnly: "Solo Pro puede solicitar juegos",
                    mySavesTitle: "Mis guardados en la nube",
                    mySavesEmpty: "No tienes juegos guardados en la nube.",
                    mySavesDelete: "Eliminar",
                    mySavesSync: "Sincronizar",
                    mySavesLastSave: "Último guardado",
                    statsTitle: "Estadísticas avanzadas",
                    statsPlayTime: "Tiempo total jugado",
                    statsSessions: "Sesiones hoy",
                    statsStreak: "Racha actual",
                    statsAvgSession: "Promedio por sesión",
                    statsHours: "horas",
                    statsMinutes: "min",
                    shareCollectionTitle: "Compartir colección",
                    shareCollectionDesc: "Comparte esta colección con tus amigos",
                    shareCollectionBtn: "🔗 Copiar link",
                    shareCollectionCopied: "Link copiado!",
                    shareCollectionProOnly: "Solo Pro puede compartir colecciones",
                    customThemeTitle: "Tema personalizado",
                    customThemeDesc: "Elige tus propios colores (Pro)",
                    customThemePrimary: "Color primario",
                    customThemeSecondary: "Color secundario",
                    customThemeAccent: "Color de acento",
                    customThemeReset: "Restablecer",
                    customThemeSaved: "Tema guardado",
                    onlineStatusOnline: "Conectado",
                    onlineStatusOffline: "Sin conexión — modo offline Pro activo",
                    // Tutorial
                    tutorialNext: "Siguiente",
                    tutorialDone: "✓ Listo",
                    tutorialSkip: "Saltar tutorial",
                    tutorialLangTitle: "🌐 Elige tu idioma",
                    tutorialLangDesc: "Selecciona tu idioma preferido para el portal desde el menú superior.",
                    tutorialStep1Title: "👋 Bienvenido a Budsin Games",
                    tutorialStep1Desc: "Este tutorial rápido te mostrará las partes principales del portal.",
                    tutorialStep2Title: "🔍 Buscador",
                    tutorialStep2Desc: "Escribe el nombre de cualquier juego para encontrarlo al instante.",
                    tutorialStep3Title: "🏷️ Filtros",
                    tutorialStep3Desc: "Filtra juegos por categoría: Acción, Clicker, Multiplayer y más.",
                    tutorialStep4Title: "🎮 Los juegos",
                    tutorialStep4Desc: "Haz clic en cualquier portada para abrir el juego al instante.",
                    tutorialStep5Title: "⭐ Favoritos",
                    tutorialStep5Desc: "Marca juegos como favoritos para tenerlos siempre a mano.",
                    tutorialStep6Title: "📁 Colecciones",
                    tutorialStep6Desc: "Agrupa juegos en colecciones personalizadas.",
                    tutorialStep7Title: "🎲 Juego al azar",
                    tutorialStep7Desc: "¿Sin decidir? Prueba el juego al azar.",
                    tutorialStepHideTitle: "⌨️ Tecla de acceso rápido",
                    tutorialStepHideDesc: "Presiona la tecla « ` » (backtick) para activar el modo oculto. Es la tecla que está junto al 1, encima de Tab.",
                    tutorialStepHideSuccess: "✅ Bien! Así se activa el modo oculto. Puedes cerrarlo con la misma tecla.",
                    tutorialStep8Title: "⚙️ Ajustes y Budsin Pro",
                    tutorialStep8Desc: "En Ajustes puedes configurar el portal y ver Budsin Pro.",
                    tutorialStep9Title: "✅ Tutorial completado",
                    tutorialStep9Desc: "Ya conoces lo básico. ¡Disfruta del portal!",
                },
                en: {
                    htmlLang: "en",
                    pageTitle: "Budsin Games",
                    heroTitle: "Budsin Games",
                    heroSubtitle:
                        "A console-style cover page: enter the portal, pick a game cover, and jump straight into browser gameplay.",
                    badgeGames: "40 games ready",
                    badgeQuick: "Quick access",
                    badgeLibrary: "Switch-style library",
                    showcaseMode: "Console mode",
                    showcasePrimaryTitle: "Your library instantly",
                    showcasePrimaryText:
                        "Game covers are the center of the experience, with a more visual, clean, and faster start for every game.",
                    showcaseFav: "Favorites",
                    showcaseSecondaryTitle:
                        "Minecraft, FNF, clickers, and portal classics",
                    showcaseSecondaryText:
                        "Everything is one click away, like a home screen game row.",
                    libraryKicker: "Library",
                    libraryTitle: "Choose your next match",
                    libraryText:
                        "Covers work as shortcuts. Open a game, return to the portal, and keep browsing like a console menu.",
                    metaLive: "Live updated",
                    metaPortal: "Budsin Portal",
                    metaReady: "Fast library ready to play",
                    searchPlaceholder: "Search game by name...",
                    chipAll: "All",
                    chipClicker: "Clicker",
                    chipAction: "Action",
                    chipMultiplayer: "Multiplayer",
                    chipIdle: "Idle",
                    chipClassic: "Classics",
                    chipTools: "🛠️ Tools",
                    shelfPopular: "🔥 Most played",
                    shelfFavorites: "🎮 Your games",
                    noFavorites: "You have no favorites yet.",
                    visibleCategories:
                        "Visible categories: Action · Idle · Multiplayer · Classics · 🛠️ Tools",
                    noResults:
                        "We couldn't find games with that filter. Try another search.",
                    suggestionsLink: "Send your suggestions to Budsin",
                    loadingPage: "Loading page...",
                    loaderLabel: "Loading",
                    skipLoading: "Skip 🡥",
                    closeNotification: "Close notification",
                    changelogTitle: "What's new in Budsin Games",
                    changelogDesc:
                        "This popup appears only once per version or the first time you enter the site.",
                    changelogItem1:
                        "Fixed SEO indexing issues: removed noindex tags, added canonical link, and optimized robots.txt.",
                    settingsPageLink: "⚙️ Settings",
                    newBadge: "New",
                    resultsCount: (count) => `${count} games`,
                    favoriteSaved: "Saved",
                    playersLabel: "players",
                    chipRecent: "🆕 Recent",
                    randomGame: "🎲 Random game",
                    shelfRecent: "🕐 Recently played",
                    noRecent: "You haven't played anything yet.",
                    favLimitReached: "Favorites limit reached (20). Go Pro for unlimited.",
                    proHeroMessage: "You're Pro! Thank you so much for your support 🫶",
                    proGatingTitle: "Exclusive game for Budsin Pro",
                    proGatingSub: "This game is available first for Pro users.",
                    proGatingBenefits: "⭐ Benefits of going Pro",
                    proGatingNoAds: "✓ No ads on the portal",
                    proGatingGoldTheme: "✓ Exclusive Gold theme",
                    proGatingUnlimitedFavs: "✓ Unlimited favorites",
                    proGatingEarlyAccess: "✓ Early access to new games",
                    proGatingStats: "✓ Activity stats",
                    proGatingPrice: "$2.99 USD / S/ 7 PEN per month",
                    proGatingCta: "⭐ I want to be Pro",
                    proGatingClose: "Close",
                    proBadge: "Early access for Pro\nfree soon",
                    sortLabel: "Sort:",
                    sortPopular: "Most played",
                    sortAlphabetical: "A-Z",
                    sortNewest: "Newest",
                    trialCtaTitle: "🎁 Try Budsin Pro free for 7 days",
                    trialCtaDesc: "No ads, Gold theme, unlimited favorites, and early access. No commitment.",
                    searchHistoryTitle: "Recent searches",
                    shelfCollections: "📁 My collections",
                    collectionsCreate: "New collection",
                    collectionsCreatePrompt: "Name for the new collection:",
                    collectionsRename: "Rename",
                    collectionsRenamePrompt: "New name for the collection:",
                    collectionsDelete: "Delete",
                    collectionsDeleteConfirm: "Delete collection",
                    collectionsEmpty: "Your collections will appear here. Create one and add games from each card.",
                    collectionsAddTo: "Add to collection",
                    collectionsCreateFirst: "Create a collection first",
                    collectionsLimitReached: "Collections limit reached (2). Go Pro for unlimited.",
                    categoriesLabel: "Categories",
                    articlesKicker: "Tips & guides",
                    articlesTitle: "Tips to get the most out of the portal",
                    article1Title: "How to use hidden mode",
                    article1Desc: "The Classroom Hotkey lets you hide the portal instantly. Set up your shortcut key and a disguise URL from the Settings page. Press the key and the site redirects to your preferred URL.",
                    article1Cta: "Go to Settings →",
                    article2Title: "Save your favorites",
                    article2Desc: "Click the star on any game to add it to your favorites list. Favorites are saved automatically in your browser and appear in the Your Games section for instant access.",
                    article3Title: "Search and filter games",
                    article3Desc: "Use the real-time search to find games by name. You can also filter by category: Action, Idle, Multiplayer, Classics, or Tools. The result counter shows matching games.",
                    article4Title: "Change language",
                    article4Desc: "The portal is available in Spanish, English, and Portuguese. Use the language picker in the top-right corner to switch instantly. Your preference is saved for your next visit.",
                    article5Title: "Explore the most played",
                    article5Desc: "The 'Most played' section shows the most popular games on the portal based on click count. The ranking updates in real-time and helps you discover what others are playing.",
                    article6Title: "Random game",
                    article6Desc: "Use the 'Random game' button to discover a random game from the catalog. Perfect when you don't know what to play and want to explore new titles.",
                    article7Title: "Popularity ranking",
                    article7Desc: "Each game shows its real-time player count. Numbers update with every click and determine which games appear in the popular ranking.",
                    footerTagline: "Free browser games",
                    footerAbout: "About",
                    footerPrivacy: "Privacy",
                    footerTerms: "Terms",
                    footerContact: "Contact",
                    footerFeedback: "Feedback",
                    footerCopy: "© 2026 Budsin Games. All games belong to their respective creators.",
                    // New Pro features v6.2
                    focusModeBtn: "🧘 Focus",
                    focusModeTitle: "Distraction-Free Mode",
                    focusModeDesc: "Hide all UI to play in fullscreen.",
                    focusModeExit: "Press ESC to exit Focus Mode",
                    leaderboardTitle: "🏆 Leaderboards",
                    leaderboardNoData: "Be the first to play!",
                    leaderboardRank: "#",
                    leaderboardPlayer: "Player",
                    leaderboardScore: "Score",
                    leaderboardSubmit: "Submit score",
                    leaderboardSubmitHint: "Submit your score to the global leaderboard",
                    leaderboardScorePlaceholder: "Your score...",
                    leaderboardSubmitted: "Score submitted!",
                    leaderboardProOnly: "Only Pro users can submit scores",
                    profileTitle: "Profile",
                    profileAvatar: "Avatar",
                    profileDisplayName: "Display name",
                    profileBio: "Bio",
                    profileSaved: "Profile saved",
                    profileSave: "Save profile",
                    achievementsTitle: "🏅 Achievements",
                    achievementsProgress: "Progress",
                    achievementsLocked: "🔒",
                    achievementsUnlocked: "✅",
                    achievementFirstGame: "First game",
                    achievementFirstGameDesc: "Play your first game",
                    achievementTenGames: "Veteran",
                    achievementTenGamesDesc: "Play 10 different games",
                    achievementAllCategories: "Explorer",
                    achievementAllCategoriesDesc: "Try games from all categories",
                    achievementProMember: "Pro Player",
                    achievementProMemberDesc: "Activate Budsin Pro",
                    achievementFavFive: "Fan",
                    achievementFavFiveDesc: "Add 5 games to favorites",
                    achievementCollection: "Collector",
                    achievementCollectionDesc: "Create your first collection",
                    achievementStreak: "Streak",
                    achievementStreakDesc: "Play 7 days in a row",
                    achievementSocial: "Social",
                    achievementSocialDesc: "Share a collection",
                    exportTitle: "Export data",
                    exportDesc: "Download your data (favorites, collections, settings)",
                    exportBtn: "📥 Export JSON",
                    exportSuccess: "Data exported",
                    gameRequestTitle: "Request game",
                    gameRequestName: "Game name",
                    gameRequestUrl: "Game URL",
                    gameRequestDesc: "Description",
                    gameRequestSubmit: "Submit request",
                    gameRequestSuccess: "Request submitted! Admins will review it.",
                    gameRequestProOnly: "Only Pro can request games",
                    mySavesTitle: "My cloud saves",
                    mySavesEmpty: "No cloud saves yet.",
                    mySavesDelete: "Delete",
                    mySavesSync: "Sync",
                    mySavesLastSave: "Last save",
                    statsTitle: "Advanced stats",
                    statsPlayTime: "Total play time",
                    statsSessions: "Sessions today",
                    statsStreak: "Current streak",
                    statsAvgSession: "Avg per session",
                    statsHours: "hours",
                    statsMinutes: "min",
                    shareCollectionTitle: "Share collection",
                    shareCollectionDesc: "Share this collection with friends",
                    shareCollectionBtn: "🔗 Copy link",
                    shareCollectionCopied: "Link copied!",
                    shareCollectionProOnly: "Only Pro can share collections",
                    customThemeTitle: "Custom theme",
                    customThemeDesc: "Choose your own colors (Pro)",
                    customThemePrimary: "Primary color",
                    customThemeSecondary: "Secondary color",
                    customThemeAccent: "Accent color",
                    customThemeReset: "Reset",
                    customThemeSaved: "Theme saved",
                    onlineStatusOnline: "Online",
                    onlineStatusOffline: "Offline — Pro offline mode active",
                    // Tutorial
                    tutorialNext: "Next",
                    tutorialDone: "✓ Done",
                    tutorialSkip: "Skip tutorial",
                    tutorialLangTitle: "🌐 Choose your language",
                    tutorialLangDesc: "Select your preferred language for the portal from the top menu.",
                    tutorialStep1Title: "👋 Welcome to Budsin Games",
                    tutorialStep1Desc: "This quick tutorial will show you the main parts of the portal.",
                    tutorialStep2Title: "🔍 Search",
                    tutorialStep2Desc: "Type any game name to find it instantly.",
                    tutorialStep3Title: "🏷️ Filters",
                    tutorialStep3Desc: "Filter games by category: Action, Clicker, Multiplayer and more.",
                    tutorialStep4Title: "🎮 Games",
                    tutorialStep4Desc: "Click any cover to open the game instantly.",
                    tutorialStep5Title: "⭐ Favorites",
                    tutorialStep5Desc: "Mark games as favorites to keep them at hand.",
                    tutorialStep6Title: "📁 Collections",
                    tutorialStep6Desc: "Group games into custom collections.",
                    tutorialStep7Title: "🎲 Random game",
                    tutorialStep7Desc: "Can't decide? Try a random game.",
                    tutorialStepHideTitle: "⌨️ Hotkey",
                    tutorialStepHideDesc: "Press the « ` » (backtick) key to activate hidden mode. It's the key next to 1, above Tab.",
                    tutorialStepHideSuccess: "✅ Great! That's how you activate hidden mode. Close it with the same key.",
                    tutorialStep8Title: "⚙️ Settings & Budsin Pro",
                    tutorialStep8Desc: "In Settings you can configure the portal and see Budsin Pro.",
                    tutorialStep9Title: "✅ Tutorial complete",
                    tutorialStep9Desc: "You know the basics. Enjoy the portal!",
                },
                pt: {
                    htmlLang: "pt",
                    pageTitle: "Budsin Games",
                    heroTitle: "Budsin Games",
                    heroSubtitle:
                        "Uma tela pensada como menu de console: entre no portal, escolha uma capa e jogue direto no navegador.",
                    badgeGames: "40 jogos prontos",
                    badgeQuick: "Acesso rápido",
                    badgeLibrary: "Biblioteca estilo Switch",
                    showcaseMode: "Modo console",
                    showcasePrimaryTitle: "Sua biblioteca na hora",
                    showcasePrimaryText:
                        "As capas são o centro da experiência, com um início mais visual, limpo e rápido para cada jogo.",
                    showcaseFav: "Favoritos",
                    showcaseSecondaryTitle:
                        "Minecraft, FNF, clickers e clássicos do portal",
                    showcaseSecondaryText:
                        "Tudo a um clique, como uma fila de jogos na tela principal.",
                    libraryKicker: "Biblioteca",
                    libraryTitle: "Escolha sua próxima partida",
                    libraryText:
                        "As capas funcionam como atalhos. Abra um jogo, volte ao portal e continue navegando como em um menu de console.",
                    metaLive: "Atualizado ao vivo",
                    metaPortal: "Budsin Portal",
                    metaReady: "Biblioteca rápida e pronta para jogar",
                    searchPlaceholder: "Buscar jogo pelo nome...",
                    chipAll: "Todos",
                    chipClicker: "Clicker",
                    chipAction: "Ação",
                    chipMultiplayer: "Multiplayer",
                    chipIdle: "Idle",
                    chipClassic: "Clássicos",
                    chipTools: "🛠️ Ferramentas",
                    shelfPopular: "🔥 Mais jogados",
                    shelfFavorites: "🎮 Seus jogos",
                    noFavorites: "Você ainda não tem favoritos.",
                    visibleCategories:
                        "Categorias visíveis: Ação · Idle · Multiplayer · Clássicos · 🛠️ Ferramentas",
                    noResults:
                        "Não encontramos jogos com esse filtro. Tente outra busca.",
                    suggestionsLink: "Envie suas sugestões ao Budsin",
                    loadingPage: "Carregando página...",
                    loaderLabel: "Carregando",
                    skipLoading: "Pular 🡥",
                    closeNotification: "Fechar notificação",
                    changelogTitle: "Novidades do Budsin Games",
                    changelogDesc:
                        "Este popup aparece apenas uma vez por versão ou na primeira vez que você entra no site.",
                    changelogItem1:
                        "Corrigidos erros de indexação SEO: removidas tags noindex, adicionado canonical e robots.txt otimizado.",
                    settingsPageLink: "⚙️ Configurações",
                    newBadge: "Novo",
                    resultsCount: (count) => `${count} jogos`,
                    favoriteSaved: "Salvo",
                    playersLabel: "jogadores",
                    chipRecent: "🆕 Recentes",
                    randomGame: "🎲 Jogo aleatório",
                    shelfRecent: "🕐 Jogado recentemente",
                    noRecent: "Você ainda não jogou nada.",
                    favLimitReached: "Limite de favoritos atingido (20). Torne-se Pro para ilimitados.",
                    proHeroMessage: "Você é Pro! Muito obrigado pelo apoio 🫶",
                    proGatingTitle: "Jogo exclusivo para Budsin Pro",
                    proGatingSub: "Este jogo está disponível primeiro para usuários Pro.",
                    proGatingBenefits: "⭐ Vantagens de ser Pro",
                    proGatingNoAds: "✓ Sem anúncios no portal",
                    proGatingGoldTheme: "✓ Tema Gold exclusivo",
                    proGatingUnlimitedFavs: "✓ Favoritos ilimitados",
                    proGatingEarlyAccess: "✓ Acesso antecipado a novos jogos",
                    proGatingStats: "✓ Estatísticas da sua atividade",
                    proGatingPrice: "$2.99 USD / S/ 7 PEN por mês",
                    proGatingCta: "⭐ Quero ser Pro",
                    proGatingClose: "Fechar",
                    proBadge: "Antecipado para Pro\nem breve grátis",
                    sortLabel: "Ordenar:",
                    sortPopular: "Mais jogados",
                    sortAlphabetical: "A-Z",
                    sortNewest: "Mais novos",
                    trialCtaTitle: "🎁 Experimente Budsin Pro grátis 7 dias",
                    trialCtaDesc: "Sem anúncios, tema Gold, favoritos ilimitados e acesso antecipado. Sem compromisso.",
                    searchHistoryTitle: "Pesquisas recentes",
                    shelfCollections: "📁 Minhas coleções",
                    collectionsCreate: "Nova coleção",
                    collectionsCreatePrompt: "Nome da nova coleção:",
                    collectionsRename: "Renomear",
                    collectionsRenamePrompt: "Novo nome para a coleção:",
                    collectionsDelete: "Excluir",
                    collectionsDeleteConfirm: "Excluir coleção",
                    collectionsEmpty: "Suas coleções aparecerão aqui. Crie uma e adicione jogos de cada card.",
                    collectionsAddTo: "Adicionar à coleção",
                    collectionsCreateFirst: "Crie uma coleção primeiro",
                    collectionsLimitReached: "Limite de coleções atingido (2). Torne-se Pro para ilimitadas.",
                    categoriesLabel: "Categorias",
                    articlesKicker: "Dicas e guias",
                    articlesTitle: "Dicas para aproveitar melhor o portal",
                    article1Title: "Como usar o modo oculto",
                    article1Desc: "O Classroom Hotkey permite ocultar o portal instantaneamente. Configure sua tecla de atalho e uma URL de disfarce na página de Configurações. Ao pressionar a tecla, o site redireciona para a URL desejada.",
                    article1Cta: "Ir para Configurações →",
                    article2Title: "Salve seus favoritos",
                    article2Desc: "Clique na estrela de qualquer jogo para adicioná-lo à sua lista de favoritos. Os favoritos são salvos automaticamente no seu navegador e aparecem na seção Seus Jogos para acesso instantâneo.",
                    article3Title: "Pesquise e filtre jogos",
                    article3Desc: "Use a busca em tempo real para encontrar jogos pelo nome. Você também pode filtrar por categoria: Ação, Idle, Multiplayer, Clássicos ou Ferramentas. O contador mostra quantos jogos correspondem.",
                    article4Title: "Mude o idioma",
                    article4Desc: "O portal está disponível em espanhol, inglês e português. Use o seletor de idioma no canto superior direito para alternar instantaneamente. Sua preferência será salva para a próxima visita.",
                    article5Title: "Explore os mais jogados",
                    article5Desc: "A seção 'Mais jogados' mostra os jogos mais populares do portal baseado na contagem de cliques. O ranking atualiza em tempo real e ajuda você a descobrir o que outros estão jogando.",
                    article6Title: "Jogo aleatório",
                    article6Desc: "Use o botão 'Jogo aleatório' para descobrir um jogo aleatório do catálogo. Perfeito quando você não sabe o que jogar e quer explorar novos títulos.",
                    article7Title: "Ranking de popularidade",
                    article7Desc: "Cada jogo mostra seu contador de jogadores em tempo real. Os números atualizam a cada clique e determinam quais jogos aparecem no ranking de populares.",
                    footerTagline: "Jogos grátis no navegador",
                    footerAbout: "Sobre",
                    footerPrivacy: "Privacidade",
                    footerTerms: "Termos",
                    footerContact: "Contato",
                    footerFeedback: "Comentários",
                    footerCopy: "© 2026 Budsin Games. Todos os jogos pertencem a seus respectivos criadores.",
                    // New Pro features v6.2
                    focusModeBtn: "🧘 Focus",
                    focusModeTitle: "Modo sem distrações",
                    focusModeDesc: "Oculte toda a interface para jogar em tela cheia.",
                    focusModeExit: "Pressione ESC para sair do Modo Focus",
                    leaderboardTitle: "🏆 Leaderboards",
                    leaderboardNoData: "Seja o primeiro a jogar!",
                    leaderboardRank: "#",
                    leaderboardPlayer: "Jogador",
                    leaderboardScore: "Pontuação",
                    leaderboardSubmit: "Enviar pontuação",
                    leaderboardSubmitHint: "Envie sua pontuação para o ranking global",
                    leaderboardScorePlaceholder: "Sua pontuação...",
                    leaderboardSubmitted: "Pontuação enviada!",
                    leaderboardProOnly: "Apenas usuários Pro podem enviar pontuações",
                    profileTitle: "Perfil",
                    profileAvatar: "Avatar",
                    profileDisplayName: "Nome público",
                    profileBio: "Biografia",
                    profileSaved: "Perfil salvo",
                    profileSave: "Salvar perfil",
                    achievementsTitle: "🏅 Conquistas",
                    achievementsProgress: "Progresso",
                    achievementsLocked: "🔒",
                    achievementsUnlocked: "✅",
                    achievementFirstGame: "Primeiro jogo",
                    achievementFirstGameDesc: "Jogue seu primeiro jogo",
                    achievementTenGames: "Veterano",
                    achievementTenGamesDesc: "Jogue 10 jogos diferentes",
                    achievementAllCategories: "Explorador",
                    achievementAllCategoriesDesc: "Experimente jogos de todas as categorias",
                    achievementProMember: "Pro Player",
                    achievementProMemberDesc: "Ative o Budsin Pro",
                    achievementFavFive: "Fã",
                    achievementFavFiveDesc: "Adicione 5 jogos aos favoritos",
                    achievementCollection: "Colecionador",
                    achievementCollectionDesc: "Crie sua primeira coleção",
                    achievementStreak: "Sequência",
                    achievementStreakDesc: "Jogue 7 dias seguidos",
                    achievementSocial: "Social",
                    achievementSocialDesc: "Compartilhe uma coleção",
                    exportTitle: "Exportar dados",
                    exportDesc: "Baixe seus dados (favoritos, coleções, configurações)",
                    exportBtn: "📥 Exportar JSON",
                    exportSuccess: "Dados exportados",
                    gameRequestTitle: "Solicitar jogo",
                    gameRequestName: "Nome do jogo",
                    gameRequestUrl: "URL do jogo",
                    gameRequestDesc: "Descrição",
                    gameRequestSubmit: "Enviar solicitação",
                    gameRequestSuccess: "Solicitação enviada! Os admins revisarão.",
                    gameRequestProOnly: "Apenas Pro pode solicitar jogos",
                    mySavesTitle: "Meus saves na nuvem",
                    mySavesEmpty: "Nenhum jogo salvo na nuvem.",
                    mySavesDelete: "Excluir",
                    mySavesSync: "Sincronizar",
                    mySavesLastSave: "Último save",
                    statsTitle: "Estatísticas avançadas",
                    statsPlayTime: "Tempo total jogado",
                    statsSessions: "Sessões hoje",
                    statsStreak: "Sequência atual",
                    statsAvgSession: "Média por sessão",
                    statsHours: "horas",
                    statsMinutes: "min",
                    shareCollectionTitle: "Compartilhar coleção",
                    shareCollectionDesc: "Compartilhe esta coleção com amigos",
                    shareCollectionBtn: "🔗 Copiar link",
                    shareCollectionCopied: "Link copiado!",
                    shareCollectionProOnly: "Apenas Pro pode compartilhar coleções",
                    customThemeTitle: "Tema personalizado",
                    customThemeDesc: "Escolha suas próprias cores (Pro)",
                    customThemePrimary: "Cor primária",
                    customThemeSecondary: "Cor secundária",
                    customThemeAccent: "Cor de destaque",
                    customThemeReset: "Restaurar",
                    customThemeSaved: "Tema salvo",
                    onlineStatusOnline: "Conectado",
                    onlineStatusOffline: "Sem conexão — modo offline Pro ativo",
                    // Tutorial
                    tutorialNext: "Próximo",
                    tutorialDone: "✓ Pronto",
                    tutorialSkip: "Pular tutorial",
                    tutorialLangTitle: "🌐 Escolha seu idioma",
                    tutorialLangDesc: "Selecione seu idioma preferido para o portal no menu superior.",
                    tutorialStep1Title: "👋 Bem-vindo ao Budsin Games",
                    tutorialStep1Desc: "Este tutorial rápido mostrará as principais partes do portal.",
                    tutorialStep2Title: "🔍 Busca",
                    tutorialStep2Desc: "Digite o nome de qualquer jogo para encontrá-lo instantaneamente.",
                    tutorialStep3Title: "🏷️ Filtros",
                    tutorialStep3Desc: "Filtre jogos por categoria: Ação, Clicker, Multiplayer e mais.",
                    tutorialStep4Title: "🎮 Jogos",
                    tutorialStep4Desc: "Clique em qualquer capa para abrir o jogo instantaneamente.",
                    tutorialStep5Title: "⭐ Favoritos",
                    tutorialStep5Desc: "Marque jogos como favoritos para tê-los sempre à mão.",
                    tutorialStep6Title: "📁 Coleções",
                    tutorialStep6Desc: "Agrupe jogos em coleções personalizadas.",
                    tutorialStep7Title: "🎲 Jogo aleatório",
                    tutorialStep7Desc: "Sem decidir? Experimente um jogo aleatório.",
                    tutorialStepHideTitle: "⌨️ Tecla de atalho",
                    tutorialStepHideDesc: "Pressione a tecla « ` » (acento grave) para ativar o modo oculto. É a tecla ao lado do 1, acima do Tab.",
                    tutorialStepHideSuccess: "✅ Bem! Assim se ativa o modo oculto. Feche com a mesma tecla.",
                    tutorialStep8Title: "⚙️ Ajustes e Budsin Pro",
                    tutorialStep8Desc: "Em Ajustes você pode configurar o portal e ver o Budsin Pro.",
                    tutorialStep9Title: "✅ Tutorial concluído",
                    tutorialStep9Desc: "Você conhece o básico. Aproveite o portal!",
                },
            };

            let currentLanguage = "en";

            const LOADING_AUDIO_KEY = "budsin_loading_audio";
            const LOADING_DURATION_KEY = "budsin_loading_duration";
            function getLoadingAudioEnabled() {
                return localStorage.getItem(LOADING_AUDIO_KEY) === "1";
            }
            function getLoadingDuration() {
                const v = parseInt(localStorage.getItem(LOADING_DURATION_KEY), 10);
                return (v && v >= 4000) ? v : 9000;
            }

            let activeType = "all";
            let activeCategory = "";
            let activeSort = "popular";
            let keyboardIndex = -1;
            let popularityState = readJson(POPULARITY_KEY, {});
            let firebaseDb = null;
            let firebaseEnabled = false;
            let rankingReady = false;
            function getCardHref(card) {
                return card.dataset.baseHref || card.getAttribute("href") || "";
            }

            const defaultCardOrder = new Map(
                cards.map((card, index) => [getCardHref(card), index]),
            );

            function escHtml(str) {
                const div = document.createElement("div");
                div.textContent = str;
                return div.innerHTML;
            }

            function logFirebase(message, error) {
                if (error) {
                    console.warn(`[Budsin Firebase] ${message}`, error);
                    return;
                }
                console.info(`[Budsin Firebase] ${message}`);
            }

            function removeMergeArtifactText() {
                const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                );
                const toClear = [];
                while (walker.nextNode()) {
                    const value = (walker.currentNode.nodeValue || "").trim();
                    if (!value) continue;
                    if (
                        value.includes("<<<<<<<") ||
                        value.includes(">>>>>>>") ||
                        value.includes("=======") ||
                        value.includes(
                            "codex/add-game-search-and-filtering-features",
                        )
                    ) {
                        toClear.push(walker.currentNode);
                    }
                }

                toClear.forEach((node) => {
                    node.nodeValue = "";
                });
            }

            function hasFirebaseConfig(config) {
                if (!config) return false;
                return ["apiKey", "authDomain", "projectId", "appId"].every(
                    (key) =>
                        typeof config[key] === "string" &&
                        config[key].trim() !== "",
                );
            }

            function initFirebase() {
                if (
                    !window.firebase ||
                    !hasFirebaseConfig(window.BUDSIN_FIREBASE_CONFIG)
                ) {
                    return;
                }

                try {
                    const app = window.firebase.apps.length
                        ? window.firebase.app()
                        : window.firebase.initializeApp(
                              window.BUDSIN_FIREBASE_CONFIG,
                          );
                    firebaseDb = app.firestore();
                    firebaseEnabled = true;
                    logFirebase("Firebase inicializado correctamente.");
                } catch (error) {
                    firebaseEnabled = false;
                    logFirebase("No se pudo inicializar Firebase.", error);
                }
            }

            async function loadRemotePopularity() {
                if (!firebaseEnabled || !firebaseDb) {
                    return false;
                }

                try {
                    const snapshot = await firebaseDb
                        .collection(FIREBASE_COLLECTION)
                        .get();
                    const remotePopularity = {};
                    snapshot.forEach((doc) => {
                        const href = decodeURIComponent(doc.id);
                        const hits = Number(doc.data().hits || 0);
                        if (hits > 0) {
                            remotePopularity[href] = hits;
                        }
                    });
                    popularityState = remotePopularity;
                    writeJson(POPULARITY_KEY, popularityState);
                    logFirebase(
                        `Popularidad remota cargada (${Object.keys(remotePopularity).length} docs).`,
                    );
                    rankingReady = true;
                    return true;
                } catch (error) {
                    logFirebase("Error cargando popularidad remota.", error);
                    return false;
                }
            }

            function saveLocalPopularity() {
                writeJson(POPULARITY_KEY, popularityState);
            }

            function readPendingPopularity() {
                return readJson(PENDING_POPULARITY_KEY, {});
            }

            function savePendingPopularity(value) {
                writeJson(PENDING_POPULARITY_KEY, value);
            }

            function queueRemoteIncrement(href, gameName, amount) {
                const pending = readPendingPopularity();
                const current = pending[href] || { name: gameName, amount: 0 };
                current.name = gameName;
                current.amount =
                    Number(current.amount || 0) + Number(amount || 1);
                pending[href] = current;
                savePendingPopularity(pending);
            }

            function resetAppTransition() {
                if (!appTransition) return;
                const video = document.getElementById("loading-video");
                if (video) { video.pause(); video.currentTime = 0; }
                if (loadAudio) { loadAudio.pause(); loadAudio = null; }
                if (loadTimer) { cancelAnimationFrame(loadTimer); loadTimer = null; }
                const bar = document.getElementById("loading-bar-fill");
                if (bar) bar.style.width = "0%";
                const pct = document.getElementById("loading-pct");
                if (pct) pct.textContent = "0%";
                appTransition.classList.remove("is-open");
                appTransition.setAttribute("aria-hidden", "true");
            }

            function captureCardRects() {
                const rects = new Map();
                cards.forEach((card) => {
                    if (!card.classList.contains("hidden-card")) {
                        rects.set(card, card.getBoundingClientRect());
                    }
                });
                return rects;
            }

            function animateCardReorder(previousRects) {
                cards.forEach((card) => {
                    const first = previousRects.get(card);
                    if (!first || card.classList.contains("hidden-card"))
                        return;
                    const last = card.getBoundingClientRect();
                    const dx = first.left - last.left;
                    const dy = first.top - last.top;
                    if (!dx && !dy) return;

                    card.classList.add("is-reordering");
                    card.style.transition = "none";
                    card.style.transform = `translate(${dx}px, ${dy}px)`;
                    card.getBoundingClientRect();
                    card.style.transition = "";
                    card.style.transform = "";
                });

                window.setTimeout(() => {
                    cards.forEach((card) => {
                        card.classList.remove("is-reordering");
                    });
                }, 480);
            }

            function sortGamesByRanking(withAnimation) {
                if (!gamesGrid) return;

                const previousRects = withAnimation ? captureCardRects() : null;
                const mode = activeSort || "popular";
                const sortedCards = cards.slice().sort((cardA, cardB) => {
                    const hrefA = getCardHref(cardA);
                    const hrefB = getCardHref(cardB);

                    if (mode === "alphabetical") {
                        const nameA = (cardA.dataset.name || "").toLowerCase();
                        const nameB = (cardB.dataset.name || "").toLowerCase();
                        if (nameA < nameB) return -1;
                        if (nameA > nameB) return 1;
                        return 0;
                    }

                    if (mode === "newest") {
                        const newA = cardA.dataset.new === "true" ? 1 : 0;
                        const newB = cardB.dataset.new === "true" ? 1 : 0;
                        if (newA !== newB) return newB - newA;
                    }

                    if (!rankingReady && mode !== "newest") {
                        return (
                            (defaultCardOrder.get(hrefA) || 0) -
                            (defaultCardOrder.get(hrefB) || 0)
                        );
                    }

                    const scoreA = Number(popularityState[hrefA] || 0);
                    const scoreB = Number(popularityState[hrefB] || 0);
                    if (scoreA !== scoreB) {
                        return scoreB - scoreA;
                    }
                    return (
                        (defaultCardOrder.get(hrefA) || 0) -
                        (defaultCardOrder.get(hrefB) || 0)
                    );
                });

                sortedCards.forEach((card) => gamesGrid.appendChild(card));
                if (withAnimation && previousRects) {
                    animateCardReorder(previousRects);
                }
            }

            async function incrementRemotePopularity(href, gameName, amount) {
                if (!firebaseEnabled || !firebaseDb) {
                    return false;
                }

                try {
                    const docRef = firebaseDb
                        .collection(FIREBASE_COLLECTION)
                        .doc(encodeURIComponent(href));
                    await docRef.set(
                        {
                            href,
                            name: gameName,
                            hits: window.firebase.firestore.FieldValue.increment(
                                Number(amount || 1),
                            ),
                            updatedAt:
                                window.firebase.firestore.FieldValue.serverTimestamp(),
                        },
                        { merge: true },
                    );
                    return true;
                } catch (error) {
                    logFirebase(
                        "Error incrementando popularidad remota.",
                        error,
                    );
                    return false;
                }
            }

            async function flushPendingRemoteIncrements() {
                if (!firebaseEnabled || !firebaseDb) {
                    return;
                }

                const pending = readPendingPopularity();
                const entries = Object.entries(pending);
                if (!entries.length) {
                    return;
                }

                for (const [href, payload] of entries) {
                    const ok = await incrementRemotePopularity(
                        href,
                        payload.name || href,
                        Number(payload.amount || 1),
                    );
                    if (ok) {
                        delete pending[href];
                    }
                }

                savePendingPopularity(pending);
            }

            function setChangelogCountdown(valueMs) {
                if (!countdownLabel) return;
                const safeMs = Math.max(0, Number(valueMs) || 0);
                countdownLabel.textContent = (safeMs / 1000).toFixed(3) + "s";
            }

            function showChangelog() {
                if (!popup) return;
                popup.classList.add("is-visible");
                popup.setAttribute("aria-hidden", "false");
                changelogCloseReady = false;
                if (closeButton) {
                    closeButton.disabled = true;
                }
                const unlockAt = performance.now() + CHANGELOG_CLOSE_DELAY_MS;
                setChangelogCountdown(CHANGELOG_CLOSE_DELAY_MS);
                if (changelogCountdownFrame) {
                    window.cancelAnimationFrame(changelogCountdownFrame);
                }
                const tickCountdown = () => {
                    const remaining = unlockAt - performance.now();
                    setChangelogCountdown(remaining);
                    if (remaining > 0) {
                        changelogCountdownFrame =
                            window.requestAnimationFrame(tickCountdown);
                        return;
                    }
                    changelogCloseReady = true;
                    if (closeButton) {
                        closeButton.disabled = false;
                    }
                    if (countdownLabel) {
                        countdownLabel.classList.add("is-done");
                    }
                    changelogCountdownFrame = null;
                };
                changelogCountdownFrame =
                    window.requestAnimationFrame(tickCountdown);
                if (changelogUnlockTimer) {
                    window.clearTimeout(changelogUnlockTimer);
                }
                changelogUnlockTimer = window.setTimeout(() => {
                    changelogCloseReady = true;
                    if (closeButton) {
                        closeButton.disabled = false;
                    }
                    if (countdownLabel) {
                        countdownLabel.classList.add("is-done");
                    }
                    setChangelogCountdown(0);
                }, CHANGELOG_CLOSE_DELAY_MS);
            }

            // ─── Gating Pro: popup para juegos exclusivos ───
            function formatReleaseDate(dateStr, lang) {
                var d = new Date(dateStr + "T00:00:00");
                var day = d.getDate();
                var year = d.getFullYear();
                var months = {
                    es: ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],
                    en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
                    pt: ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"]
                };
                var m = months[lang] ? months[lang][d.getMonth()] : months["es"][d.getMonth()];
                if (lang === "en") return m + " " + day + ", " + year;
                return day + " de " + m + " de " + year;
            }

            function showProGatingPopup() {
                var popup = document.getElementById("proGatingPopup");
                if (!popup) return;
                popup.style.display = "flex";
                popup.setAttribute("aria-hidden", "false");
            }

            function closeProGatingPopup() {
                var popup = document.getElementById("proGatingPopup");
                if (!popup) return;
                popup.style.display = "none";
                popup.setAttribute("aria-hidden", "true");
            }

            function closeChangelog() {
                if (!changelogCloseReady) {
                    return;
                }
                try {
                    localStorage.setItem(STORAGE_KEY, SITE_VERSION);
                } catch (error) {
                    logFirebase(
                        "No se pudo guardar el estado del changelog en localStorage.",
                        error,
                    );
                }
                if (changelogUnlockTimer) {
                    window.clearTimeout(changelogUnlockTimer);
                    changelogUnlockTimer = null;
                }
                if (changelogCountdownFrame) {
                    window.cancelAnimationFrame(changelogCountdownFrame);
                    changelogCountdownFrame = null;
                }
                setChangelogCountdown(0);
                popup.classList.remove("is-visible");
                popup.setAttribute("aria-hidden", "true");
            }

            function readJson(key, fallback) {
                try {
                    return JSON.parse(
                        localStorage.getItem(key) || JSON.stringify(fallback),
                    );
                } catch (error) {
                    return fallback;
                }
            }

            function writeJson(key, value) {
                localStorage.setItem(key, JSON.stringify(value));
            }

            function getTranslations() {
                return TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
            }

            const PT_DESCRIPTIONS = {
                "minecraft 1.12.2":
                    "Explore livremente no navegador. Esta edição não inclui multijogador.",
                "minecraft 1.8":
                    "A versão recomendada para jogar com multijogador.",
                "minecraft 1.21.x":
                    "Um cliente mais novo para explorar no navegador na sua própria página dedicada.",
                "cookie clicker":
                    "A versão mais recomendada para jogar e assar sem parar.",
                "cookie clicker legacy edition":
                    "Use se a versão nova der problemas com os saves.",
                "bitcoin clicker":
                    "Clique, acumule bitcoins e continue crescendo.",
                "geometry dash":
                    "Ritmo, reflexos e saltos no limite na sua página dedicada.",
                "hollow knight":
                    "Explore Hallownest a partir de sua própria página com carregamento dedicado.",
                "hollow silksong":
                    "Jogue Hollow Knight Silksong com carregamento progressivo de assets a partir do cache.",
                "eggy car":
                    "Mantenha o equilíbrio e vá o mais longe possível sem quebrar o ovo.",
                "level devil":
                    "Supere armadilhas imprevisíveis e níveis enganosos.",
                "drive mad": "Supere pontes, saltos e veículos impossíveis.",
                "stickman hook": "Lance a corda e encadeie saltos até o final.",
                superhot:
                    "Shooter tático onde o tempo avança quando você se move.",
                "vex 7": "Corra, pule e supere armadilhas precisas.",
                recoil: "Shooter arcade de reflexos rápidos onde cada tiro também te impulsiona.",
                "among us": "Encontre o impostor ou sabote a tripulação.",
                "fireboy and watergirl 1":
                    "Jogue cooperativo clássico no Templo da Floresta.",
                "smash karts":
                    "Caos de karts multiplayer com power-ups e batalhas rápidas.",
                "rocket goal":
                    "Dirija e marque gols em uma arena de carros com foguetes.",
                "friday night funkin":
                    "Siga o ritmo e encadeie notas na sua página dedicada.",
                "subway surfers":
                    "Corra sem parar, desvie dos trens e colete moedas.",
                "red ball":
                    "Role, pule e supere obstáculos nesta aventura clássica.",
                "snow rider":
                    "Desça em alta velocidade pela neve e desvie dos obstáculos.",
                stacktris:
                    "Empilhe peças com precisão e evite que tudo desmorone.",
                undertale:
                    "Entre no subsolo, fale ou lute, e decida o destino de cada encontro.",
                "we become what we behold":
                    "Observe e altere a multidão nesta sátira inquietante.",
                "super mario 64":
                    "O clássico do Nintendo 64 para jogar direto no navegador.",
                "super mario bros":
                    "O clássico original do NES para correr, pular e salvar o reino.",
                "super mario world":
                    "Plataformas clássicas com Yoshi, segredos e rotas alternativas.",
                "pac-man":
                    "Coma pontos, desvie dos fantasmas e busque a maior pontuação.",
                galaga: "Arcade espacial puro: ondas rápidas, reflexos e muita precisão.",
                "centipede arcade":
                    "Defenda a tela neste arcade clássico de tiros e reflexos.",
                "half-life":
                    "Jogue o shooter clássico com sua capa dedicada e acesso direto.",
                "cooking mama":
                    "Cozinhe receitas clássicas com minijogos rápidos e estilo Nintendo DS.",
                "cooking mama 2":
                    "Mais receitas, mais desafios e o mesmo estilo rápido de culinária arcade.",
                "cooking mama 3":
                    "A terceira entrega com mais receitas, loja e sessões de culinária rápidas.",
                rubdy: "Sobrevivência espacial com combates rápidos e uma capa tipográfica própria.",
                "super smash bros":
                    "O clássico de luta do Nintendo 64 com todos os personagens e cenários originais.",
                soundboard:
                    "Painel de sons com favoritos, busca e controle de reprodução.",
                "budsin ai":
                    "Chat do Budsin AI para te ajudar a partir do portal.",
                "plague inc":
                    "Crie e evolua um vírus para acabar com a humanidade neste clássico de estratégia.",
                "monster tracks":
                    "Dirija veículos monstruosos e domine as pistas neste jogo de corrida.",
                "odd bot out":
                    "Resolva quebra-cabeças de física controlando um robô neste plataforma.",
                "escape road":
                    "Dirija em alta velocidade, desvie do trânsito e fuja da perseguição neste jogo de ação.",
                "crossy road":
                    "Atravesse ruas, desvie de obstáculos e vá o mais longe possível neste clássico arcade.",
                "brawl stars":
                    "Simulador 3D de Brawl Stars com batalhas e personagens no seu navegador.",
                "comentarios":
                    "Deixe sua opiniao e sugestoes para o portal atraves do quadro do Padlet.",
                "bendy and the ink machine":
                    "Sobreviva aos corredores do Joey Drew Studios neste jogo de terror arrepiante.",
                "just shapes & beats":
                    "Sobreviva a padrões de ritmo impossíveis neste bullet-hell musical. Esquive, pule e flua ao ritmo da música.",
                "plants vs zombies 2":
                    "Defenda seu jardim com plantas poderosas contra hordas de zumbis nesta sequência cheia de ação.",
                cuphead:
                    "Enfrente batalhas épicas contra chefes neste shooter de desenhos animados com estilo clássico dos anos 30.",
                "budsin proxy":
                    "Navegue por qualquer site a partir do portal sem service workers. Um proxy leve integrado diretamente no Budsin Games.",
            };

            const PT_CATEGORIES = {
                Acción: "Ação",
                Multiplayer: "Multiplayer",
                Idle: "Idle",
                Clásicos: "Clássicos",
                Herramientas: "Ferramentas",
                Port: "Port",
            };

            const PT_LABELS = {
                Disponible: "Disponível",
                Alternativa: "Alternativa",
                Herramienta: "Ferramenta",
                "Pro · Disponible 22 may": "Pro · Disponível 22 mai",
                "Pro · Disponible 30 may": "Pro · Disponível 30 mai",
            };

            function applyLanguage(language) {
                const nextLanguage = TRANSLATIONS[language] ? language : "es";
                currentLanguage = nextLanguage;
                const t = getTranslations();

                document.documentElement.lang = t.htmlLang;
                document.title = t.pageTitle;

                let homeLabel;
                if (nextLanguage === "en") homeLabel = "Home";
                else if (nextLanguage === "pt") homeLabel = "Início";
                else homeLabel = "Inicio";
                document.documentElement.style.setProperty(
                    "--home-label",
                    `"${homeLabel}"`,
                );

                document.querySelectorAll("[data-i18n]").forEach((node) => {
                    const key = node.dataset.i18n;
                    if (t[key]) {
                        node.textContent = t[key];
                    }
                });

                document
                    .querySelectorAll("[data-i18n-aria]")
                    .forEach((node) => {
                        const key = node.dataset.i18nAria;
                        if (t[key]) {
                            node.setAttribute("aria-label", t[key]);
                        }
                    });

                if (searchInput) {
                    searchInput.placeholder = t.searchPlaceholder;
                }
                if (settingsPageLink) {
                    settingsPageLink.textContent = t.settingsPageLink;
                    settingsPageLink.setAttribute(
                        "href",
                        "settings.html?lang=" + nextLanguage,
                    );
                }

                cards.forEach((card) => {
                    const status = card.querySelector(
                        ".content span[data-label-es]",
                    );
                    if (status) {
                        if (nextLanguage === "en") {
                            status.textContent = status.dataset.labelEn;
                        } else if (nextLanguage === "pt") {
                            status.textContent =
                                PT_LABELS[status.dataset.labelEs] ||
                                status.dataset.labelEs;
                        } else {
                            status.textContent = status.dataset.labelEs;
                        }
                    }

                    const description = card.querySelector(
                        ".content p[data-desc-es]",
                    );
                    if (description) {
                        if (nextLanguage === "en") {
                            description.textContent =
                                description.dataset.descEn;
                        } else if (nextLanguage === "pt") {
                            description.textContent =
                                PT_DESCRIPTIONS[card.dataset.name] ||
                                description.dataset.descEs;
                        } else {
                            description.textContent =
                                description.dataset.descEs;
                        }
                    }

                    const categoryTag = card.querySelector(
                        ".category-tag[data-es]",
                    );
                    if (categoryTag) {
                        if (nextLanguage === "en") {
                            categoryTag.textContent = categoryTag.dataset.en;
                        } else if (nextLanguage === "pt") {
                            categoryTag.textContent =
                                PT_CATEGORIES[categoryTag.dataset.es] ||
                                categoryTag.dataset.es;
                        } else {
                            categoryTag.textContent = categoryTag.dataset.es;
                        }
                    }

                    const favoriteButton = card.querySelector(".favorite-btn");
                    if (favoriteButton) {
                        let favLabel;
                        if (nextLanguage === "en")
                            favLabel = "Add to favorites";
                        else if (nextLanguage === "pt")
                            favLabel = "Adicionar aos favoritos";
                        else favLabel = "Agregar a favoritos";
                        favoriteButton.setAttribute("aria-label", favLabel);
                    }

                    const baseHref =
                        card.dataset.baseHref ||
                        card.getAttribute("href") ||
                        "";
                    if (!card.dataset.baseHref) {
                        card.dataset.baseHref = baseHref;
                    }
                    const nextUrl = new URL(baseHref, window.location.href);
                    nextUrl.searchParams.set("lang", nextLanguage);
                    card.setAttribute(
                        "href",
                        `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
                    );
                });

                if (languageSelect) {
                    languageSelect.value = nextLanguage;
                }

                document.querySelectorAll(".new-badge").forEach((b) => {
                    b.textContent = t.newBadge;
                });
                document.querySelectorAll(".i18n-pro-badge").forEach((b) => {
                    b.textContent = t.proBadge || "Anticipado para Pro\npróximamente gratis";
                });
                renderShelves();
                applyFilters();
                updateDynamicLabels();
                loadBanner(nextLanguage);
            }

            function loadBanner(lang) {
                const spot = document.getElementById("banner-spot");
                if (!spot) return;
                spot.innerHTML = "";
                const s = document.createElement("script");
                s.src = `https://keepandroidopen.org/banner.js?lang=${lang}&id=banner-spot&hidebutton=off`;
                spot.appendChild(s);
            }

            function loadLanguagePreference() {
                try {
                    const savedLanguage = localStorage.getItem(LANGUAGE_KEY);
                    return TRANSLATIONS[savedLanguage] ? savedLanguage : "en";
                } catch (error) {
                    return "en";
                }
            }

            function saveLanguagePreference(language) {
                try {
                    localStorage.setItem(LANGUAGE_KEY, language);
                } catch (error) {
                    // ignore storage errors
                }
            }

            function getSearchHistory() {
                return readJson(SEARCH_HISTORY_KEY, []);
            }
            function saveSearchHistory(history) {
                writeJson(SEARCH_HISTORY_KEY, history.slice(0, SEARCH_HISTORY_MAX));
            }
            function addSearchTerm(term) {
                if (!term) return;
                const history = getSearchHistory();
                const idx = history.indexOf(term);
                if (idx > -1) history.splice(idx, 1);
                history.unshift(term);
                saveSearchHistory(history);
            }
            function renderSearchHistory() {
                const el = document.getElementById("searchHistory");
                if (!el) return;
                const history = getSearchHistory();
                const t = getTranslations();
                if (!history.length) {
                    el.style.display = "none";
                    return;
                }
                el.innerHTML = `<div class="search-history-empty">${t.searchHistoryTitle || "Recent searches"}</div>` +
                    history.map((term) =>
                        `<div class="search-history-item" data-term="${term.replace(/"/g, "&quot;")}">
                            <span>🔍 ${term}</span>
                            <button class="remove-search" data-term="${term.replace(/"/g, "&quot;")}" type="button" aria-label="Remove">✕</button>
                        </div>`
                    ).join("");
                el.querySelectorAll(".search-history-item").forEach((item) => {
                    item.addEventListener("click", (e) => {
                        if (e.target.closest(".remove-search")) return;
                        const term = item.dataset.term;
                        searchInput.value = term;
                        el.classList.remove("is-visible");
                        el.style.display = "none";
                        applyFilters();
                    });
                });
                el.querySelectorAll(".remove-search").forEach((btn) => {
                    btn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        const term = btn.dataset.term;
                        const history = getSearchHistory();
                        const idx = history.indexOf(term);
                        if (idx > -1) history.splice(idx, 1);
                        saveSearchHistory(history);
                        renderSearchHistory();
                    });
                });
                el.classList.add("is-visible");
                el.style.display = "block";
            }

            // ─── Collections management ───
            function getCollections() { return readJson(COLLECTIONS_KEY, []); }
            function saveCollections(cols) { writeJson(COLLECTIONS_KEY, cols); }
            function getCollectionLimit() {
                return localStorage.getItem("budsin_pro_active") === "1" ? Infinity : COLLECTIONS_LIMIT_FREE;
            }
            function addCollection(name) {
                const cols = getCollections();
                const limit = getCollectionLimit();
                if (cols.length >= limit) {
                    const t = getTranslations();
                    showToast(t.collectionsLimitReached || "Límite de colecciones alcanzado. Hazte Pro para más.", true);
                    return false;
                }
                if (cols.find(c => c.name === name)) return false;
                cols.push({ name, items: [] });
                saveCollections(cols);
                renderShelves();
                return true;
            }
            function renameCollection(oldName, newName) {
                const cols = getCollections();
                const col = cols.find(c => c.name === oldName);
                if (!col || cols.find(c => c.name === newName)) return false;
                col.name = newName;
                saveCollections(cols);
                renderShelves();
                return true;
            }
            function deleteCollection(name) {
                const cols = getCollections().filter(c => c.name !== name);
                saveCollections(cols);
                renderShelves();
            }
            function addToCollection(collectionName, href) {
                const cols = getCollections();
                const col = cols.find(c => c.name === collectionName);
                if (!col) return;
                if (col.items.includes(href)) return;
                col.items.push(href);
                saveCollections(cols);
                renderShelves();
            }
            function removeFromCollection(collectionName, href) {
                const cols = getCollections();
                const col = cols.find(c => c.name === collectionName);
                if (!col) return;
                col.items = col.items.filter(h => h !== href);
                saveCollections(cols);
                renderShelves();
            }
            function toggleCollectionItem(collectionName, href) {
                const cols = getCollections();
                const col = cols.find(c => c.name === collectionName);
                if (!col) { addCollection(collectionName); return toggleCollectionItem(collectionName, href); }
                if (col.items.includes(href)) { removeFromCollection(collectionName, href); }
                else { addToCollection(collectionName, href); }
            }

            function renderShelves() {
                const favorites = readJson(FAVORITES_KEY, []);
                const popularity = popularityState;

                // Shelf de favoritos (visual grid con covers)
                if (favoritesList) {
                    if (favorites.length) {
                        favoritesList.innerHTML = favorites
                            .map((href) => {
                                const card = cards.find(
                                    (c) => getCardHref(c) === href,
                                );
                                if (!card) return "";
                                const name = card.querySelector("strong").textContent;
                                const img = card.querySelector(".cover img");
                                const src = img ? img.getAttribute("src") : "";
                                return `<div class="recent-mini" data-fav-href="${href}">${src ? `<img src="${src}" alt="${name}">` : ""}<span class="recent-mini-name">${name}</span></div>`;
                            })
                            .join("");
                        favoritesList.querySelectorAll(".recent-mini").forEach((mini) => {
                            mini.addEventListener("click", () => {
                                const href = mini.dataset.favHref;
                                const card = cards.find((c) => getCardHref(c) === href);
                                if (card) card.click();
                            });
                        });
                    } else {
                        favoritesList.innerHTML = `<span class="recent-empty">${getTranslations().noFavorites}</span>`;
                    }
                }

                const ranking = cards
                    .map((card) => {
                        const href = getCardHref(card);
                        const name = card.querySelector("strong").textContent;
                        return { name, hits: popularity[href] || 0 };
                    })
                    .sort((a, b) => b.hits - a.hits)
                    .slice(0, 6);

                popularList.innerHTML = ranking
                    .map(
                        (item, index) =>
                            `<li><span>#${index + 1} ${item.name}</span><span>${item.hits} ${getTranslations().playersLabel}</span></li>`,
                    )
                    .join("");

                cards.forEach((card) => {
                    const href = getCardHref(card);
                    const hits = Number(popularity[href] || 0);
                    card.querySelector("[data-players]").textContent =
                        `🔥 ${hits}`;
                    const favBtn = card.querySelector(".favorite-btn");
                    const isFavorite = favorites.includes(href);
                    favBtn.classList.toggle("is-favorite", isFavorite);
                    favBtn.textContent = isFavorite ? "★" : "☆";
                });

                // Shelf de jugado recientemente (visual grid)
                const recentlyPlayed = readJson(RECENTLY_PLAYED_KEY, []);
                if (recentlyPlayedList) {
                    if (recentlyPlayed.length) {
                        recentlyPlayedList.innerHTML = recentlyPlayed
                            .map((href) => {
                                const card = cards.find(
                                    (c) => getCardHref(c) === href,
                                );
                                if (!card) return "";
                                const name = card.querySelector("strong").textContent;
                                const img = card.querySelector(".cover img");
                                const src = img ? img.getAttribute("src") : "";
                                return `<div class="recent-mini" data-recent-href="${href}">${src ? `<img src="${src}" alt="${name}">` : ""}<span class="recent-mini-name">${name}</span></div>`;
                            })
                            .join("");
                        recentlyPlayedList.querySelectorAll(".recent-mini").forEach((mini) => {
                            mini.addEventListener("click", () => {
                                const href = mini.dataset.recentHref;
                                const card = cards.find((c) => getCardHref(c) === href);
                                if (card) card.click();
                            });
                        });
                    } else {
                        recentlyPlayedList.innerHTML = `<span class="recent-empty">${getTranslations().noRecent}</span>`;
                    }
                }

                // Shelf de colecciones
                const collectionsContainer = document.getElementById("collectionsContainer");
                if (collectionsContainer) {
                    const cols = getCollections();
                    const t = getTranslations();
                    if (cols.length) {
                        collectionsContainer.innerHTML = cols.map((col, ci) => {
                            const items = col.items.map((href) => {
                                const card = cards.find((c) => getCardHref(c) === href);
                                if (!card) return "";
                                const name = card.querySelector("strong").textContent;
                                const img = card.querySelector(".cover img");
                                const src = img ? img.getAttribute("src") : "";
                                return `<div class="recent-mini" data-col-href="${href}" data-col-name="${col.name}">${src ? `<img src="${src}" alt="${name}">` : ""}<span class="recent-mini-name">${name}</span></div>`;
                            }).join("") || `<div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--muted);font-size:.9rem;line-height:1.5">${t.collectionsEmpty || "Colección vacía. Añade juegos desde cada tarjeta."}</div>`;
                            const limit = getCollectionLimit();
                            return `<div class="collection-shelf">
                                <div class="collection-head">
                                    <strong class="collection-name">📁 ${escHtml(col.name)}</strong>
                                    <div class="collection-actions">
                                        <button class="collection-rename-btn" data-col-name="${col.name}" type="button" title="${t.collectionsRename || "Renombrar"}">✏️</button>
                                        <button class="collection-share-btn" data-col-name="${col.name}" type="button" title="${t.shareCollectionBtn || "Compartir"}">🔗</button>
                                        <button class="collection-delete-btn" data-col-name="${col.name}" type="button" title="${t.collectionsDelete || "Eliminar"}">🗑️</button>
                                    </div>
                                </div>
                                <div class="recent-grid" data-collection-grid="${ci}">${items}</div>
                            </div>`;
                        }).join("");

                        collectionsContainer.querySelectorAll(".recent-mini").forEach((mini) => {
                            mini.addEventListener("click", (e) => {
                                if (e.target.closest(".collection-actions")) return;
                                const href = mini.dataset.colHref;
                                const card = cards.find((c) => getCardHref(c) === href);
                                if (card) card.click();
                            });
                        });
                        collectionsContainer.querySelectorAll(".collection-rename-btn").forEach((btn) => {
                            btn.addEventListener("click", () => {
                                const oldName = btn.dataset.colName;
                                const t = getTranslations();
                                const newName = prompt(t.collectionsRenamePrompt || "Nuevo nombre para la colección:", oldName);
                                if (newName && newName.trim() && newName !== oldName) {
                                    renameCollection(oldName, newName.trim());
                                }
                            });
                        });
                        collectionsContainer.querySelectorAll(".collection-delete-btn").forEach((btn) => {
                            btn.addEventListener("click", () => {
                                const name = btn.dataset.colName;
                                const t = getTranslations();
                                if (confirm((t.collectionsDeleteConfirm || "¿Eliminar colección") + ` "${name}"?`)) {
                                    deleteCollection(name);
                                }
                            });
                        });
                        collectionsContainer.querySelectorAll(".collection-share-btn").forEach((btn) => {
                            btn.addEventListener("click", function(e) {
                                e.stopPropagation();
                                shareCollection(this.dataset.colName);
                            });
                        });
                    } else {
                        collectionsContainer.innerHTML = `<div style="padding:24px 16px;text-align:center;color:var(--muted);font-size:.9rem;line-height:1.5;width:100%">${t.collectionsEmpty || "Tus colecciones aparecerán aquí. Crea una y añade juegos desde cada tarjeta."}</div>`;
                    }
                }
            }

            function applyFilters() {
                const term = (searchInput.value || "").trim().toLowerCase();
                let visibleCount = 0;

                cards.forEach((card) => {
                    const name = card.dataset.name || "";
                    const types = (card.dataset.type || "").split(" ");
                    const descEl = card.querySelector(".content p");
                    const descText = descEl
                        ? (
                              descEl.dataset.descEs ||
                              descEl.textContent ||
                              ""
                          ).toLowerCase()
                        : "";
                    const categoryText = (
                        card.dataset.category || ""
                    ).toLowerCase();
                    const matchSearch =
                        !term ||
                        name.includes(term) ||
                        categoryText.includes(term) ||
                        descText.includes(term);
                    let matchType =
                        activeType === "all" || types.includes(activeType);
                    if (activeType === "recent") {
                        matchType = card.dataset.new === "true";
                    }
                    const matchCat =
                        !activeCategory ||
                        card.dataset.category === activeCategory;
                    const visible = matchSearch && matchType && matchCat;
                    card.classList.toggle("hidden-card", !visible);
                    if (visible) visibleCount += 1;
                });

                resultsCount.textContent =
                    getTranslations().resultsCount(visibleCount);
                noResults.style.display = visibleCount ? "none" : "block";
                sortGamesByRanking(false);
                updateDynamicLabels();
            }

            let loadTimer = null, loadAudio = null, navTimer = null, pendingNavUrl = null, pendingGameName = "", firebasePromise = null;

            function openAppTransition() {
                appTransition.classList.add("is-open");
                appTransition.setAttribute("aria-hidden", "false");

                const video = document.getElementById("loading-video");
                const bar = document.getElementById("loading-bar-fill");
                video.currentTime = 0;
                video.play();

                if (getLoadingAudioEnabled()) {
                    loadAudio = document.getElementById("loading-audio");
                    loadAudio.src = preloadedAudioUrl;
                    loadAudio.currentTime = 0;
                    loadAudio.volume = 1;
                    loadAudio.play().then(() => {
                        loadAudio.currentTime = 69;
                    }).catch(() => {
                        loadAudio.addEventListener("loadedmetadata", () => {
                            loadAudio.currentTime = 69;
                            loadAudio.play().catch(() => {});
                        }, { once: true });
                    });
                }

                let start = performance.now();
                const duration = getLoadingDuration();
                const fadeStart = Math.min(5000, duration * 0.55);

                if (loadTimer) cancelAnimationFrame(loadTimer);
                function tick() {
                    const elapsed = performance.now() - start;
                    const pct = Math.min(100, (elapsed / duration) * 100);
                    bar.style.width = pct + "%";
                    document.getElementById("loading-pct").textContent = Math.round(pct) + "%";
                    if (elapsed >= fadeStart && loadAudio) {
                        const fadeElapsed = elapsed - fadeStart;
                        const fadeDur = duration - fadeStart;
                        loadAudio.volume = Math.max(0, 1 - fadeElapsed / fadeDur);
                    }
                    if (elapsed < duration) {
                        loadTimer = requestAnimationFrame(tick);
                    }
                }
                tick();
            }

            function closeAppTransition() {
                const video = document.getElementById("loading-video");
                video.pause();
                video.currentTime = 0;
                if (loadAudio) { loadAudio.pause(); loadAudio = null; }
                if (loadTimer) { cancelAnimationFrame(loadTimer); loadTimer = null; }
                const bar = document.getElementById("loading-bar-fill");
                bar.style.width = "0%";
                document.getElementById("loading-pct").textContent = "0%";
                appTransition.classList.remove("is-open");
                appTransition.setAttribute("aria-hidden", "true");
            }

            function navigateToGame(url) {
                pendingNavUrl = url;
                const duration = getLoadingDuration();
                navTimer = setTimeout(() => {
                    closeAppTransition();
                    const destination = new URL(url, window.location.href);
                    destination.searchParams.set("lang", currentLanguage);
                    window.location.href = `${destination.pathname}${destination.search}${destination.hash}`;
                }, duration);
            }

            document.getElementById("skip-loading-btn").addEventListener("click", async () => {
                if (navTimer) {
                    clearTimeout(navTimer);
                    navTimer = null;
                }
                if (loadTimer) {
                    cancelAnimationFrame(loadTimer);
                    loadTimer = null;
                }
                const video = document.getElementById("loading-video");
                if (video) { video.pause(); video.currentTime = 0; }
                if (loadAudio) { loadAudio.pause(); loadAudio = null; }
                document.getElementById("loading-bar-fill").style.width = "0%";
                document.getElementById("loading-pct").textContent = "0%";
                if (firebasePromise) {
                    const success = await firebasePromise;
                    if (!success && pendingNavUrl) {
                        queueRemoteIncrement(pendingNavUrl, pendingGameName, 1);
                    }
                }
                if (pendingNavUrl) {
                    const destination = new URL(pendingNavUrl, window.location.href);
                    destination.searchParams.set("lang", currentLanguage);
                    window.location.href = `${destination.pathname}${destination.search}${destination.hash}`;
                }
            });

            const FAVORITES_LIMIT_FREE = 20;

            cards.forEach((card) => {
                const favBtn = card.querySelector(".favorite-btn");
                favBtn.addEventListener("click", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const favorites = readJson(FAVORITES_KEY, []);
                    const href = getCardHref(card);
                    const index = favorites.indexOf(href);
                    if (index >= 0) {
                        favorites.splice(index, 1);
                    } else {
                        const isPro = localStorage.getItem("budsin_pro_active") === "1";
                        if (!isPro && favorites.length >= FAVORITES_LIMIT_FREE) {
                            const msg = getTranslations().favLimitReached || "Límite de favoritos alcanzado (20). Hazte Pro para ilimitados.";
                            showToast(msg, true);
                            return;
                        }
                        favorites.push(href);
                    }
                    writeJson(FAVORITES_KEY, favorites);
                    renderShelves();
                });

                card.addEventListener("click", async (event) => {
                    event.preventDefault();
                    cards.forEach((c) => c.classList.remove("keyboard-focus"));
                    const href = getCardHref(card);
                    const gameName = card.querySelector("strong").textContent;

                    // Gating for Pro-only games
                    if (card.dataset.pro === "true" && localStorage.getItem("budsin_pro_active") !== "1") {
                        var releaseDate = card.dataset.proRelease;
                        var isReleased = releaseDate && new Date(releaseDate + "T00:00:00") <= new Date();
                        if (isReleased) {
                            // Game is now free for everyone
                        } else {
                            firebasePromise = incrementRemotePopularity(href, gameName, 1);
                            const success = await firebasePromise;
                            if (!success) queueRemoteIncrement(href, gameName, 1);
                            // Show the free date if available
                            if (releaseDate) {
                                var freeDateEl = document.getElementById("proGatingFreeDate");
                                if (freeDateEl) {
                                    var freeDateTexts = {
                                        es: "\uD83C\uDF89 Este juego ser\u00E1 gratis para todos el",
                                        en: "\uD83C\uDF89 This game will be free for everyone on",
                                        pt: "\uD83C\uDF89 Este jogo ser\u00E1 gr\u00E1tis para todos em"
                                    };
                                    var prefix = freeDateTexts[currentLanguage] || freeDateTexts["es"];
                                    freeDateEl.innerHTML = prefix + ' <strong style="color:#ffd700">' + formatReleaseDate(releaseDate, currentLanguage) + "</strong>.";
                                    freeDateEl.style.display = "block";
                                }
                            }
                            showProGatingPopup();
                            return;
                        }
                    }

                    // Si el modo Focus está activo, cargar juego en overlay en vez de navegar
                    if (isFocusModeActive()) {
                        pendingNavUrl = href;
                        pendingGameName = gameName;
                        firebasePromise = incrementRemotePopularity(href, gameName, 1);
                        const success = await firebasePromise;
                        if (!success) queueRemoteIncrement(href, gameName, 1);
                        const recent = readJson(RECENTLY_PLAYED_KEY, []);
                        const recentIndex = recent.indexOf(href);
                        if (recentIndex > -1) recent.splice(recentIndex, 1);
                        recent.unshift(href);
                        if (recent.length > RECENTLY_PLAYED_MAX) recent.pop();
                        writeJson(RECENTLY_PLAYED_KEY, recent);
                        renderShelves();
                        trackPlaySession(gameName);
                        popularityState[href] = (Number(popularityState[href]) || 0) + 1;
                        saveLocalPopularity();
                        renderShelves();
                        loadGameInFocus(href);
                        return;
                    }

                    pendingNavUrl = href;
                    // Cache game for Pro offline
                    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
                        navigator.serviceWorker.controller.postMessage({ type: "CACHE_GAME", url: href });
                    }
                    pendingGameName = gameName;
                    firebasePromise = incrementRemotePopularity(href, gameName, 1);
                    openAppTransition();
                    // Guardar en jugado recientemente
                    const recent = readJson(RECENTLY_PLAYED_KEY, []);
                    const recentIndex = recent.indexOf(href);
                    if (recentIndex > -1) recent.splice(recentIndex, 1);
                    recent.unshift(href);
                    if (recent.length > RECENTLY_PLAYED_MAX) recent.pop();
                    writeJson(RECENTLY_PLAYED_KEY, recent);
                    renderShelves();
                    trackPlaySession(gameName);
                    popularityState[href] =
                        (Number(popularityState[href]) || 0) + 1;
                    saveLocalPopularity();
                    renderShelves();
                    const success = await firebasePromise;
                    if (!success) {
                        queueRemoteIncrement(href, gameName, 1);
                    }
                    navigateToGame(href);
                });
            });

            try {
                const seenVersion = localStorage.getItem(STORAGE_KEY);
                const tutorialDone = localStorage.getItem(TUTORIAL_KEY) === "1";
                if (ENABLE_CHANGELOG_POPUP && seenVersion !== SITE_VERSION && tutorialDone) {
                    showChangelog();
                }
            } catch (error) {
                if (ENABLE_CHANGELOG_POPUP) {
                    showChangelog();
                }
            }

            // Gating popup close
            document.getElementById("closeGatingPopup")?.addEventListener("click", closeProGatingPopup);
            document.getElementById("closeGatingBtn")?.addEventListener("click", closeProGatingPopup);
            var gatingPopup = document.getElementById("proGatingPopup");
            if (gatingPopup) {
                gatingPopup.addEventListener("click", function (e) {
                    if (e.target === gatingPopup) closeProGatingPopup();
                });
            }

            // Leaderboard popup
            document.getElementById("closeLeaderboardPopup")?.addEventListener("click", closeLeaderboardPopup);
            document.getElementById("leaderboardPopup")?.addEventListener("click", function(e) {
                if (e.target === this) closeLeaderboardPopup();
            });
            document.getElementById("leaderboardSubmitBtn")?.addEventListener("click", function() {
                var input = document.getElementById("leaderboardScoreInput");
                if (!input) return;
                var score = parseInt(input.value, 10);
                if (isNaN(score) || score < 0) { showToast("Puntuación inválida", false); return; }
                var isPro = localStorage.getItem("budsin_pro_active") === "1";
                if (!isPro) {
                    showToast(getTranslations().leaderboardProOnly || "Solo Pro puede enviar puntuaciones", true);
                    return;
                }
                // Verificar que el usuario haya completado su perfil
                if (!firebaseEnabled || !firebaseDb) {
                    showToast("Firebase no disponible", false);
                    return;
                }
                var userRaw = null;
                try { userRaw = JSON.parse(localStorage.getItem("budsin_pro_user") || "null"); } catch(_) {}
                if (!userRaw || !userRaw.uid) {
                    showToast("Debes iniciar sesión en Settings para enviar puntuaciones", false);
                    return;
                }
                firebaseDb.collection("users").doc(userRaw.uid).get().then(function(doc) {
                    var data = doc.exists ? doc.data() : {};
                    var profile = data.profile || {};
                    var displayName = (profile.displayName || "").trim();
                    if (!displayName) {
                        showToast("Completa tu perfil en Settings (nombre público) antes de enviar puntuaciones", false);
                        return;
                    }
                    submitLeaderboardScore(_leaderboardCurrentGame, score, displayName).then(function() {
                        input.value = "";
                        showLeaderboardPopup(_leaderboardCurrentGame);
                    });
                }).catch(function(err) {
                    console.warn("[Budsin] Profile fetch error:", err);
                    showToast("Error al verificar perfil", false);
                });
            });

            if (closeButton) {
                closeButton.addEventListener("click", closeChangelog);
            }

            if (popup) {
                popup.addEventListener("click", function (event) {
                    if (event.target === popup) {
                        closeChangelog();
                    }
                });
            }

            window.addEventListener("keydown", function (event) {
                if (event.key === "Escape") {
                    if (popup && popup.classList.contains("is-visible")) closeChangelog();
                    const searchHistoryEl = document.getElementById("searchHistory");
                    if (searchHistoryEl && searchHistoryEl.classList.contains("is-visible")) {
                        searchHistoryEl.classList.remove("is-visible");
                        searchHistoryEl.style.display = "none";
                    }
                    if (document.activeElement === searchInput) {
                        searchInput.blur();
                    }
                }

                // Arrow key navigation between game cards (only when not typing in search)
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                    if (document.activeElement === searchInput) return;
                    event.preventDefault();
                    // Re-query DOM each time to match visual order (sort may reorder nodes)
                    const visibleCards = Array.from(document.querySelectorAll(".game-card:not(.hidden-card)"));
                    if (!visibleCards.length) return;
                    if (keyboardIndex === -1) {
                        keyboardIndex = 0;
                    } else {
                        keyboardIndex += event.key === "ArrowRight" ? 1 : -1;
                        if (keyboardIndex < 0) keyboardIndex = visibleCards.length - 1;
                        if (keyboardIndex >= visibleCards.length) keyboardIndex = 0;
                    }
                    document.querySelectorAll(".game-card").forEach((c) => c.classList.remove("keyboard-focus"));
                    const target = visibleCards[keyboardIndex];
                    target.classList.add("keyboard-focus");
                    target.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }

                if (event.key === "Enter") {
                    if (document.activeElement === searchInput) return;
                    const focused = document.querySelector(".game-card.keyboard-focus");
                    if (focused) focused.click();
                }
            });

            window.addEventListener("pageshow", resetAppTransition);

            searchInput.addEventListener("input", () => {
                cards.forEach((c) => c.classList.remove("keyboard-focus"));
                keyboardIndex = -1;
                applyFilters();
            });
            searchInput.addEventListener("focus", () => {
                if (getSearchHistory().length) renderSearchHistory();
            });
            searchInput.addEventListener("blur", () => {
                setTimeout(() => {
                    const el = document.getElementById("searchHistory");
                    if (el) { el.classList.remove("is-visible"); el.style.display = "none"; }
                }, 200);
            });
            searchInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    const term = searchInput.value.trim();
                    if (term) addSearchTerm(term);
                    const el = document.getElementById("searchHistory");
                    if (el) { el.classList.remove("is-visible"); el.style.display = "none"; }
                }
            });
            typeFilters.addEventListener("click", (event) => {
                const button = event.target.closest(".chip");
                if (!button) return;
                activeType = button.dataset.type;
                activeCategory = "";
                keyboardIndex = -1;
                cards.forEach((c) => c.classList.remove("keyboard-focus"));
                typeFilters
                    .querySelectorAll(".chip")
                    .forEach((chip) => chip.classList.remove("active"));
                button.classList.add("active");
                if (categoryFilters) {
                    categoryFilters
                        .querySelectorAll(".chip")
                        .forEach((chip) => chip.classList.remove("active"));
                }
                applyFilters();
            });

            if (categoryFilters) {
                categoryFilters.addEventListener("click", (event) => {
                    const button = event.target.closest(".chip");
                    if (!button) return;
                    if (activeCategory === button.dataset.category) {
                        activeCategory = "";
                        button.classList.remove("active");
                    } else {
                        categoryFilters
                            .querySelectorAll(".chip")
                            .forEach((chip) => chip.classList.remove("active"));
                        activeCategory = button.dataset.category;
                        button.classList.add("active");
                    }
                    activeType = "all";
                    typeFilters
                        .querySelectorAll(".chip")
                        .forEach((chip) => chip.classList.remove("active"));
                    typeFilters.querySelector('[data-type="all"]').classList.add("active");
                    applyFilters();
                });
            }

            // Create collection button
            const createColBtn = document.getElementById("createCollectionBtn");
            if (createColBtn) {
                createColBtn.addEventListener("click", () => {
                    const t = getTranslations();
                    const name = prompt(t.collectionsCreatePrompt || "Nombre de la nueva colección:");
                    if (name && name.trim()) {
                        addCollection(name.trim());
                    }
                });
            }

            // Sort dropdown
            const sortSelect = document.getElementById("sortSelect");
            if (sortSelect) {
                sortSelect.addEventListener("change", () => {
                    activeSort = sortSelect.value;
                    sortGamesByRanking(true);
                });
            }

            // Boton juego al azar
            const randomGameBtn = document.getElementById("randomGameBtn");
            if (randomGameBtn) {
                randomGameBtn.addEventListener("click", () => {
                    const visibleCards = cards.filter(
                        (c) => !c.classList.contains("hidden-card"),
                    );
                    if (!visibleCards.length) return;
                    const pick =
                        visibleCards[Math.floor(Math.random() * visibleCards.length)];
                    pick.click();
                });
            }

            // Actualizar badge de juegos y categorias visibles dinamicamente
            function updateDynamicLabels() {
                const badgeGamesEl = document.querySelector('[data-i18n="badgeGames"]');
                if (badgeGamesEl) {
                    const t = getTranslations();
                    if (currentLanguage === "en") {
                        badgeGamesEl.textContent = `${totalGames} games ready`;
                    } else if (currentLanguage === "pt") {
                        badgeGamesEl.textContent = `${totalGames} jogos prontos`;
                    } else {
                        badgeGamesEl.textContent = `${totalGames} juegos listos`;
                    }
                }
                const visCatEl = document.querySelector('[data-i18n="visibleCategories"]');
                if (visCatEl) {
                    const cats = [
                        ...new Set(
                            cards
                                .filter((c) => !c.classList.contains("hidden-card"))
                                .map((c) => c.dataset.category || "")
                                .filter(Boolean),
                        ),
                    ];
                    const t = getTranslations();
                    if (currentLanguage === "en") {
                        visCatEl.textContent = `Visible categories: ${cats.join(" · ")}`;
                    } else if (currentLanguage === "pt") {
                        visCatEl.textContent = `Categorias visíveis: ${cats.join(" · ")}`;
                    } else {
                        visCatEl.textContent = `Categorías visibles: ${cats.join(" · ")}`;
                    }
                }
            }

            const preferredLanguage = loadLanguagePreference();
            applyLanguage(preferredLanguage);

            if (languageSelect) {
                languageSelect.addEventListener("change", (event) => {
                    const selectedLanguage = event.target.value;
                    saveLanguagePreference(selectedLanguage);
                    applyLanguage(selectedLanguage);
                });
            }

            removeMergeArtifactText();
            resetAppTransition();
            initFirebase();

            (async function initializePopularity() {
                renderShelves();
                applyFilters();
                sortGamesByRanking(false);

                const loadedRemote = await loadRemotePopularity();
                await flushPendingRemoteIncrements();
                renderShelves();
                applyFilters();
                if (loadedRemote) {
                    sortGamesByRanking(true);
                }
                // Init new Pro features
                initFocusMode();
                checkAchievements();

                // Init tutorial
                document.getElementById("tutorialNextBtn")?.addEventListener("click", nextTutorialStep);
                document.getElementById("tutorialPrevBtn")?.addEventListener("click", prevTutorialStep);
                document.getElementById("tutorialDoneBtn")?.addEventListener("click", finishTutorial);
                document.getElementById("tutorialSkipBtn")?.addEventListener("click", finishTutorial);
                document.getElementById("tutorialBackdrop")?.addEventListener("click", finishTutorial);


                window.addEventListener("resize", function() {
                    var overlay = document.getElementById("tutorialOverlay");
                    if (overlay && overlay.style.display === "block") renderTutorialStep();
                });
                try {
                    var urlParams = new URLSearchParams(window.location.search);
                    if (urlParams.get("tutorial") === "true") {
                        localStorage.removeItem(TUTORIAL_KEY);
                        setTimeout(startTutorial, 600);
                    } else if (localStorage.getItem(TUTORIAL_KEY + "_step") === "settings_visited") {
                        // Returning from settings tutorial – skip to last step
                        try { localStorage.removeItem(TUTORIAL_KEY + "_step"); } catch(_) {}
                        setTimeout(function() {
                            _tutorialStep = TUTORIAL_STEPS.length - 1;
                            var overlay = document.getElementById("tutorialOverlay");
                            if (overlay) overlay.style.display = "block";
                            renderTutorialStep();
                        }, 600);
                    } else if (localStorage.getItem(TUTORIAL_KEY) !== "1") {
                        setTimeout(startTutorial, 600);
                    }
                } catch(_) { setTimeout(startTutorial, 600); }
            })();
