import { useI18n } from "../context/I18nContext";
import StaticLayout from "../components/StaticLayout";

export default function ContactPage() {
  const { t } = useI18n();
  return (
    <StaticLayout title={t("contactTitle", "Contacto")} subtitle={t("contactSubtitle", "Canales de comunicación con Budsin.")}>
      <h2>Email</h2>
      <p><a href="mailto:budsinjys@gmail.com" className="text-link">budsinjys@gmail.com</a></p>
      <h2>{t("contactSuggestionsTitle", "Sugerencias")}</h2>
      <p>
        {t("contactSuggestionsText", "¿Ideas o mejoras? Envíanos tus sugerencias a través del formulario.")}{" "}
        <a className="text-link" href="https://forms.gle/bUHTy8Lt6Kz1qkAx8" target="_blank" rel="noreferrer">
          {t("suggestionsLink", "Envia tus sugerencias a Budsin")}
        </a>
      </p>
      <h2>{t("contactCommentsTitle", "Comentarios")}</h2>
      <p>
        {t("contactCommentsText", "Deja tu opinión en el tablero de comentarios.")}{" "}
        <a className="text-link" href="#/comentarios">{t("footerComments", "Comentarios")}</a>
      </p>
    </StaticLayout>
  );
}
