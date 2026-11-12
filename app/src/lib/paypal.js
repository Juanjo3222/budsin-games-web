import { auth } from "./firebase";

// Credenciales PÚBLICAS de PayPal (el Secret vive solo en el servidor). Sandbox hasta pasar a producción:
// al cambiar a Live hay que sustituir CLIENT_ID y PLAN_ID por los de la cuenta real.
export const PAYPAL_CLIENT_ID = "AZdttgce4sOYEFAWwI0EcFWLklyO4tuoW1gGEYvDt_BafdVFqsgNITSxS-8P_buJ7Hsy9L69jIpP3A4S";
export const PAYPAL_PLAN_ID = "P-60L53243VE599341UNL2QGEY";
const API = "https://games.budsin.dev/api/paypal";

async function authFetch(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("NO_USER");
  const token = await user.getIdToken();
  const res = await fetch(API + path, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP_${res.status}`);
  return data;
}

function parse(data) {
  return { pro: !!data.pro, paidUntil: data.paidUntil ? new Date(data.paidUntil) : null, active: !!data.active };
}

// Estado Pro según el servidor de PayPal. Nunca lanza: si falla, el usuario sigue con lo de Firestore.
export async function fetchPaypalStatus() {
  try {
    return parse(await authFetch("/status"));
  } catch (err) {
    return { pro: false, paidUntil: null, active: false };
  }
}

// Avisa al servidor de la suscripción aprobada. PayPal puede tardar unos segundos en pasarla a ACTIVE.
export async function confirmPaypalSubscription(subscriptionId) {
  let last = null;
  for (let i = 0; i < 5; i++) {
    const data = await authFetch("/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId }),
    });
    last = { ...parse(data), subscriptionStatus: data.subscriptionStatus };
    if (last.pro) return last;
    await new Promise((r) => setTimeout(r, 2500));
  }
  return last;
}

let sdkPromise = null;
export function loadPaypalSdk() {
  if (window.paypal?.Buttons) return Promise.resolve(window.paypal);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;
      s.onload = () => resolve(window.paypal);
      s.onerror = () => {
        sdkPromise = null;
        reject(new Error("SDK_LOAD_FAILED"));
      };
      document.head.appendChild(s);
    });
  }
  return sdkPromise;
}
