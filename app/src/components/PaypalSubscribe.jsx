import { useEffect, useRef, useState } from "react";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../context/AuthContext";
import { usePro } from "../context/ProContext";
import { useToast } from "../context/ToastContext";
import { PAYPAL_PLAN_ID, loadPaypalSdk, confirmPaypalSubscription } from "../lib/paypal";

// Botón de suscripción mensual con PayPal. La suscripción queda atada al uid de Google (custom_id)
// y el servidor la comprueba contra PayPal antes de dar el Pro.
export default function PaypalSubscribe() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { refreshPro } = usePro();
  const { showToast } = useToast();
  const box = useRef(null);
  const [state, setState] = useState("loading"); // loading | ready | error | confirming
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return undefined;
    let buttons = null;
    let gone = false;
    loadPaypalSdk()
      .then((paypal) => {
        if (gone || !box.current) return;
        buttons = paypal.Buttons({
          style: { shape: "pill", color: "gold", layout: "vertical", label: "subscribe" },
          createSubscription: (data, actions) =>
            actions.subscription.create({ plan_id: PAYPAL_PLAN_ID, custom_id: uid }),
          onApprove: async (data) => {
            setState("confirming");
            try {
              const res = await confirmPaypalSubscription(data.subscriptionID);
              await refreshPro();
              showToast(res?.pro ? t("paypalDone", "¡Gracias! Tu suscripción Pro está activa.") : t("paypalPending", "Pago recibido. En unos minutos se activará tu Pro."));
            } catch (err) {
              showToast(t("paypalConfirmError", "El pago se hizo, pero no pudimos confirmarlo. Escribe a budsinjys@gmail.com con tu correo."), true);
            }
            setState("ready");
          },
          onError: () => showToast(t("paypalError", "No se pudo completar el pago con PayPal."), "error"),
        });
        return buttons.render(box.current).then(() => !gone && setState("ready"));
      })
      .catch(() => !gone && setState("error"));
    return () => {
      gone = true;
      if (buttons && buttons.close) buttons.close();
    };
  }, [uid, refreshPro, showToast, t]);

  return (
    <div className="paypal-subscribe">
      <div className="pro-trial-title">{t("paypalTitle", "💳 Suscríbete con PayPal")}</div>
      <p>{t("paypalDesc", "$2.99 USD al mes. Se renueva solo y puedes cancelar cuando quieras desde tu cuenta de PayPal.")}</p>
      <div ref={box} />
      {state === "loading" && <p className="pro-login-hint">{t("paypalLoading", "Cargando PayPal…")}</p>}
      {state === "confirming" && <p className="pro-login-hint">{t("paypalConfirming", "Confirmando tu pago…")}</p>}
      {state === "error" && <p className="pro-login-hint">{t("paypalUnavailable", "PayPal no está disponible ahora (¿bloqueador de anuncios?). Inténtalo más tarde.")}</p>}
    </div>
  );
}
