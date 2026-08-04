import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, updateDoc, getDoc, getDocs, collection, increment, serverTimestamp, Timestamp, onSnapshot, query, orderBy, limit as fsLimit } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCBN77CtgH-J5NYWhVyW6p1jldXdxbok-U",
  authDomain: "juanjo-games.firebaseapp.com",
  projectId: "juanjo-games",
  storageBucket: "juanjo-games.firebasestorage.app",
  messagingSenderId: "927529249414",
  appId: "1:927529249414:web:410a686dc7f0da25ec3f07",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const POPULARITY_COLLECTION = "game_popularity";

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signOutUser() {
  return signOut(auth);
}

export function onUserChange(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function incrementRemotePopularity(href, gameName, amount = 1) {
  try {
    const docRef = doc(db, POPULARITY_COLLECTION, encodeURIComponent(href));
    await setDoc(
      docRef,
      { href, name: gameName, hits: increment(Number(amount) || 1), updatedAt: serverTimestamp() },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn("[Budsin] Error incrementando popularidad remota.", err);
    return false;
  }
}

export function subscribePopularity(cb) {
  return onSnapshot(collection(db, POPULARITY_COLLECTION), (snap) => {
    const map = {};
    snap.docs.forEach((d) => {
      const data = d.data() || {};
      map[data.href || d.id] = Number(data.hits) || 0;
    });
    cb(map);
  });
}

export async function fetchPopularity() {
  const q = query(collection(db, POPULARITY_COLLECTION), orderBy("hits", "desc"), fsLimit(200));
  const snap = await getDocs(q);
  const map = {};
  snap.forEach((d) => {
    const data = d.data() || {};
    map[data.href || d.id] = Number(data.hits) || 0;
  });
  return map;
}

export const ADMIN_EMAILS = ["juvaldiviam@gmail.com", "juanjoseguravegamail@gmail.com"];

export function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.includes(String(email).toLowerCase());
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "object" && value.seconds) return new Date(value.seconds * 1000);
  return null;
}

export async function fetchUserStatus(uid) {
  if (!uid) return { pro: false, paidUntil: null, trialUsed: false };
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return { pro: false, paidUntil: null, trialUsed: false };
    const data = snap.data() || {};
    const paidUntil = toDate(data.paidUntil);
    let isPro = data.pro === true;
    let trialUsed = data.trialUsed === true;
    if (isPro && paidUntil && paidUntil < new Date()) {
      try {
        await updateDoc(doc(db, "users", uid), { pro: false, trial: false, trialUsed: true, paidUntil: null });
      } catch (e) {}
      isPro = false;
    }
    return { pro: isPro, paidUntil, trialUsed, email: data.email, proSince: toDate(data.proSince) };
  } catch (err) {
    console.warn("[Budsin] fetchUserStatus error", err);
    return { pro: false, paidUntil: null, trialUsed: false };
  }
}

export async function activateTrial(uid) {
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await updateDoc(doc(db, "users", uid), {
    pro: true,
    trial: true,
    trialUsed: true,
    proSince: serverTimestamp(),
    paidUntil: Timestamp.fromDate(expiry),
  });
  return expiry;
}

export async function listUsers() {
  const snap = await getDocs(collection(db, "users"));
  const users = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    users.push({
      uid: d.id,
      email: data.email || "",
      pro: data.pro === true,
      proSince: toDate(data.proSince),
      paidUntil: toDate(data.paidUntil),
      trial: data.trial === true,
      trialUsed: data.trialUsed === true,
      createdAt: toDate(data.createdAt),
    });
  });
  return users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function setUserPro(uid, { pro, paidUntil }) {
  const payload = { pro, trial: false, trialUsed: pro ? false : true, proSince: pro ? serverTimestamp() : null };
  if (pro) {
    payload.paidUntil = Timestamp.fromDate(paidUntil);
  } else {
    payload.paidUntil = null;
  }
  await updateDoc(doc(db, "users", uid), payload);
}

export async function payMonth(uid, days = 35) {
  const current = await fetchUserStatus(uid);
  const base = current.paidUntil && current.paidUntil > new Date() ? current.paidUntil : new Date();
  const expiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  await updateDoc(doc(db, "users", uid), {
    pro: true,
    paidUntil: Timestamp.fromDate(expiry),
  });
  return expiry;
}

export async function listGameRequests() {
  const snap = await getDocs(query(collection(db, "game_requests"), orderBy("createdAt", "desc")));
  const requests = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    requests.push({
      id: d.id,
      gameName: data.gameName || "?",
      gameUrl: data.gameUrl || "",
      email: data.email || data.uid || "?",
      status: data.status || "pending",
      createdAt: toDate(data.createdAt),
    });
  });
  return requests;
}

export async function setRequestStatus(id, status) {
  await updateDoc(doc(db, "game_requests", id), {
    status,
    reviewedAt: serverTimestamp(),
  });
}

export async function ensureUserDoc(user) {
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) {
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        displayName: user.displayName || "",
        pro: false,
        createdAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn("[Budsin] ensureUserDoc error", e);
  }
}
