import { useI18n } from "../context/I18nContext";
import StaticLayout from "./StaticLayout";
import { LEGAL, LEGAL_UPDATED } from "../data/legal";

const LABEL = { es: "Última actualización", en: "Last updated", pt: "Última atualização" };

export default function LegalDoc({ kind }) {
  const { lang } = useI18n();
  const l = LEGAL[lang] ? lang : "es";
  const doc = LEGAL[l][kind];
  return (
    <StaticLayout title={doc.title} subtitle={`${LABEL[l]}: ${LEGAL_UPDATED[l]}`}>
      {doc.sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {(s.p || []).map((x, i) => <p key={i}>{x}</p>)}
          {s.ul && <ul>{s.ul.map((x, i) => <li key={i}>{x}</li>)}</ul>}
        </section>
      ))}
    </StaticLayout>
  );
}
