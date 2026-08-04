import { useI18n } from "../context/I18nContext";
import StaticLayout from "../components/StaticLayout";

export default function PrivacyPage() {
  const { t } = useI18n();
  return (
    <StaticLayout title={t("privacyTitle", "Política de Privacidad")}>
      <h2>{t("privacyIntroTitle", "Información general")}</h2>
      <p>{t("privacyIntroText", "En Budsin Games respetamos tu privacidad. Este sitio no requiere registro para jugar y no recopila datos personales más allá de los mínimos necesarios para ofrecer la experiencia.")}</p>
      <h2>{t("privacyDataTitle", "Datos que almacenamos")}</h2>
      <p>{t("privacyDataText", "Tus favoritos, configuración de idioma y tema se guardan exclusivamente en tu navegador (localStorage). No se envían a nuestros servidores.")}</p>
      <h2>{t("privacyFirebaseTitle", "Firebase y Budsin Pro")}</h2>
      <p>{t("privacyFirebaseText", "Si inicias sesión con Google para Budsin Pro, Firebase almacena tu email y el estado de tu suscripción para verificar tu acceso. No usamos estos datos para otro fin.")}</p>
      <h2>{t("privacyAdsTitle", "Publicidad")}</h2>
      <p>{t("privacyAdsText", "El sitio muestra anuncios de Google AdSense y redes de terceros. Estas redes pueden usar cookies para personalizar anuncios. Consulta las políticas de Google para más información.")}</p>
      <h2>{t("privacyContactTitle", "Contacto")}</h2>
      <p>{t("privacyContactText", "Para cualquier consulta sobre privacidad, escríbenos a budsinjys@gmail.com.")}</p>
    </StaticLayout>
  );
}
