import { useI18n } from "../context/I18nContext";
import StaticLayout from "../components/StaticLayout";

export default function TermsPage() {
  const { t } = useI18n();
  return (
    <StaticLayout title={t("termsTitle", "Términos de Uso")}>
      <h2>{t("termsUsageTitle", "Uso del servicio")}</h2>
      <p>{t("termsUsageText", "Budsin Games es un portal de acceso a juegos web. Los juegos y contenidos pertenecen a sus respectivos creadores. Al usar este sitio aceptas estas condiciones.")}</p>
      <h2>{t("termsResponsibilityTitle", "Responsabilidad")}</h2>
      <p>{t("termsResponsibilityText", "El sitio se proporciona \"tal cual\", sin garantías. No nos hacemos responsables del mal funcionamiento de juegos de terceros ni del uso indebido del portal.")}</p>
      <h2>{t("termsProTitle", "Budsin Pro")}</h2>
      <p>{t("termsProText", "Budsin Pro es una suscripción mensual gestionada manualmente. La suscripción se renueva cada mes y se puede revocar si no se confirma el pago.")}</p>
      <h2>{t("termsContactTitle", "Contacto")}</h2>
      <p>{t("termsContactText", "Para consultas legales o de otro tipo: budsinjys@gmail.com.")}</p>
    </StaticLayout>
  );
}
