import { useI18n } from "../context/I18nContext";
import StaticLayout from "../components/StaticLayout";

export default function AboutPage() {
  const { t } = useI18n();
  return (
    <StaticLayout title={t("aboutTitle", "Acerca de Budsin Games")} subtitle={t("aboutSubtitle", "La plataforma de juegos en navegador con experiencia tipo consola. Juega al instante, sin descargas, desde cualquier dispositivo.")}>
      <h2>{t("aboutWhatTitle", "Qué es Budsin Games")}</h2>
      <p>{t("aboutWhatText1", "Budsin Games es un portal web que reúne decenas de juegos jugables directamente desde el navegador. Inspirado en la interfaz de consolas como Nintendo Switch, el sitio prioriza la velocidad, el diseño visual y la facilidad de uso. Cada juego tiene su propia portada y acceso directo, creando una experiencia de biblioteca interactiva.")}</p>
      <p>{t("aboutWhatText2", "El proyecto nació como un experimento personal para explorar hasta dónde se podía llevar la idea de un \"menú de consola\" en la web. Con el tiempo, creció hasta convertirse en un catálogo con más de 40 juegos que abarcan desde clásicos arcade hasta títulos modernos, todo sin necesidad de instalar nada.")}</p>
      <h2>{t("aboutFeaturesTitle", "Características principales")}</h2>
      <p>{t("aboutFeature1", "Todos los juegos se ejecutan directamente en el navegador. No necesitas instalar nada.")}</p>
      <p>{t("aboutFeature2", "Portadas interactivas que funcionan como accesos directos, similares al menú de una Nintendo Switch.")}</p>
      <p>{t("aboutFeature3", "Guarda tus juegos preferidos con un clic. Todo se almacena localmente en tu navegador.")}</p>
      <p>{t("aboutFeature4", "Encuentra cualquier juego al instante con el buscador en tiempo real y los filtros por categoría.")}</p>
      <p>{t("aboutFeature5", "El portal está disponible en español, inglés y portugués. Cambia de idioma al instante.")}</p>
      <h2>{t("aboutHowTitle", "Cómo funciona")}</h2>
      <p>{t("aboutHowText1", "El portal está construido con React y tecnologías web estándar, y se aloja en Firebase Hosting y GitHub Pages. No requiere backend ni servidor propio. Los juegos son emuladores o ports que funcionan completamente en el lado del cliente.")}</p>
      <p>{t("aboutHowText2", "Para el ranking de popularidad, utilizamos Firebase Firestore con un sistema de conteo atómico anónimo. No se requiere inicio de sesión ni se almacenan datos personales.")}</p>
      <h2>{t("aboutLicenseTitle", "Licencia y atribuciones")}</h2>
      <p>{t("aboutLicenseText", "Budsin Games actúa como un portal de acceso a juegos web. Todos los juegos, marcas y activos pertenecen a sus respectivos creadores y titulares de derechos.")}</p>
    </StaticLayout>
  );
}
