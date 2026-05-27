# 🎮 Budsin Games - osi

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-brightgreen" />
  <img src="https://img.shields.io/badge/Games-50-blue" />
  <img src="https://img.shields.io/badge/Frontend-HTML%20%7C%20CSS%20%7C%20JS-orange" />
  <img src="https://img.shields.io/badge/Version-6.2-purple" />
  <img src="https://img.shields.io/badge/License-MIT-lightgrey" />
</p>

<p align="center">
  Portal de juegos en navegador con experiencia tipo consola 🎮  
</p>

---

## 🚀 Demo

🔗 https://games.budsin.dev

---

## 🧠 Sobre el proyecto

**Budsin Games** es una plataforma web de juegos accesibles directamente desde el navegador.
Inspirada en interfaces de consola (como Nintendo Switch), prioriza velocidad, diseño visual y facilidad de uso.

---

## ✨ Features

* 🎮 **50+ juegos jugables al instante**
* ⚡ **Sin descargas ni instalación**
* ⭐ **Budsin Pro**: suscripción manual con Firebase Auth (Google Sign-In). Sin anuncios, badge Pro y panel admin en `/admin.html`.
* 🧩 **UI tipo consola (portadas interactivas)**
* ⭐ **Sistema de favoritos (localStorage)**
* 📊 **Ranking de popularidad con Firebase**
* 🧠 **Filtros por categorías**
* 🔍 **Búsqueda en tiempo real**
* 🌐 **Soporte multilenguaje (ES / EN / PT)**
* ⚙️ **Ajustes para URL de Classroom Hotkey (guardado local)**

---

## 🗂️ Categorías

* ⚔️ Acción
* 💤 Idle / Clicker
* 🌐 Multiplayer
* 🧱 Clásicos

---

## 🎯 Catálogo completo (40 juegos)

| Juego                          | Categoría   |
| ------------------------------ | ----------- |
| Escape Road                    | Acción      |
| Minecraft 1.12.2               | Acción      |
| Minecraft 1.8                  | Multiplayer |
| Minecraft 1.21.x               | Acción      |
| Cookie Clicker                 | Idle        |
| Cookie Clicker Legacy Edition  | Idle        |
| Bitcoin Clicker                | Idle        |
| Geometry Dash                  | Acción      |
| Monster Tracks                 | Acción      |
| Hollow Knight                  | Acción      |
| Hollow Knight Silksong         | Acción      |
| Eggy Car                       | Acción      |
| Level Devil                    | Acción      |
| Drive Mad                      | Acción      |
| Stickman Hook                  | Acción      |
| SuperHot                       | Acción      |
| Vex 7                          | Acción      |
| Recoil                         | Acción      |
| Among Us                       | Multiplayer |
| Fireboy And Watergirl 1        | Multiplayer |
| Smash Karts                    | Multiplayer |
| Rocket Goal                    | Multiplayer |
| Friday Night Funkin            | Clásicos    |
| Subway Surfers                 | Clásicos    |
| Red Ball                       | Clásicos    |
| Snow Rider                     | Clásicos    |
| Stacktris                      | Clásicos    |
| UNDERTALE                      | Clásicos    |
| We Become What We Behold       | Clásicos    |
| Super Mario 64                 | Clásicos    |
| Super Mario Bros               | Clásicos    |
| Super Mario World              | Clásicos    |
| Pac-Man                        | Clásicos    |
| Galaga                         | Clásicos    |
| Centipede Arcade               | Clásicos    |
| Half-Life                      | Clásicos    |
| Cooking Mama                   | Clásicos    |
| Cooking Mama 2                 | Clásicos    |
| Cooking Mama 3                 | Clásicos    |
| RubDy                          | Clásicos    |
| Soundboard                     | Clásicos    |
| Budsin AI                      | Clásicos    |

---

## 📸 Preview

<p align="center">
  <img src="Snapshot18-1.jpg" alt="Budsin Games Preview" width="800" />
</p>

---

## 🛠️ Tech Stack

* HTML5
* CSS3
* JavaScript (Vanilla)
* Firebase (conteo de popularidad, Auth para Budsin Pro)
* Github Pages

---

## 📁 Estructura del Proyecto

```bash
/
├── README.md
├── AGENTS.md
├── .firebaserc
├── firebase.json
└── public/
    ├── index.html
    ├── 404.html
    ├── about.html            ← Acerca de (información del proyecto)
    ├── contacto.html         ← Contacto y canales de comunicación
    ├── privacidad.html       ← Política de privacidad
    ├── settings.html
    ├── comentarios.html
    ├── [juego].html          ← Páginas de cada juego (estructura plana)
    ├── Funkin-HTML-Port-main/  ← Friday Night Funkin (port completo)
    ├── cookie/               ← Cookie Clicker (port completo)
    ├── fonts/
    ├── images/
    ├── lang/
    ├── lib/
    ├── scripts/
    ├── stylesheets/
    └── [portadas].jpg/jpeg/webp/avif/png/svg
```

> ⚠️ **Regla de estructura**: Todo juego vive en `public/[nombre-del-juego]` (archivo `.html` o subcarpeta).
> No se usa la carpeta `/games`.

---

## ⭐ Favoritos

Los usuarios pueden marcar juegos como favoritos ⭐
Estos se almacenan localmente usando:

```js
localStorage.setItem("budsin_favorites", JSON.stringify([...]))
```

---

## 📊 Ranking de Popularidad

Sistema de "Más jugados" integrado con Firebase Firestore.

* Conteo atómico de clics por juego
* Ranking dinámico en tiempo real
* Sin Login ni Auth — solo contadores anónimos
* Colección Firebase: `game_popularity`

---

## 🔧 Instalación local

```bash
git clone https://github.com/tu-usuario/budsin-games.git
cd budsin-games/public
```

Abrir en navegador:

```bash
index.html
```

---

## 🧪 Desarrollo

Proyecto **100% frontend**, sin backend requerido para uso básico.
Firebase se usa únicamente para el conteo de popularidad.

---

## 📝 Changelog

### v6.2
* **Modo offline Pro** — Service Worker con cache completo para usuarios Pro. El sitio funciona sin internet.
* **Leaderboards globales** — Tabla de puntuaciones por juego solo para Pro.
* **Perfiles personalizables** — Avatar, nombre público y biografía (guardado en Firestore).
* **Estadísticas avanzadas** — Sesiones totales, juegos por día, rachas, calendario de actividad.
* **Modo Focus** — Pantalla completa sin distracciones. Oculto para Free.
* **Solicitar juegos** — Formulario para que Pro sugiera juegos, visible en admin.
* **Exportar datos** — Descarga JSON con favoritos, colecciones, logros y ajustes.
* **Compartir colecciones** — Link público para compartir playlists. Solo Pro.
* **Logros/achievements** — 8 logros desbloqueables con tracking automático.
* **Tema personalizado** — Selector de colores para Pro (primary, secondary, accent, bg).
* **Online/Offline indicator** — Indicador de conexión visible para Pro en el portal.
* **Sistema de tracking** — Registro de sesiones de juego para estadísticas y logros.

### v6.1
* **Bendy and the Ink Machine** — primer juego exclusivo Pro. Disponible para todos el 22 de mayo.
* **Pro-Gating**: los juegos con `data-pro="true"` muestran popup de suscripción para usuarios Free.

### v6.0
* **Budsin Pro** — Nuevo sistema de suscripción manual con Firebase Auth + Firestore.
* Los usuarios inician sesión con Google desde **Settings**. El admin gestiona suscripciones desde `/admin.html`.
* Features Pro: sin anuncios, tema Gold exclusivo, badge "⭐ PRO", favoritos ilimitados, acceso anticipado a juegos, estadísticas de actividad.
* Badge "Anticipado para Pro: próximamente gratis" en juegos marcados con `data-pro="true"`.
* Popup informativo "Modificaciones importantes" con obligación de lectura.
* **Bendy and the Ink Machine** — primer juego exclusivo Pro. Disponible para todos el 22 de mayo.
* Pro-Gating: los juegos con `data-pro="true"` muestran popup de suscripción para usuarios Free.

### v5.1
* Se agregó **Escape Road** al catálogo con portada propia, acceso directo desde el index e integración al sistema de ranking/popularidad.

### v5.0
* Se añadieron páginas de **Acerca de**, **Contacto** y **Política de Privacidad** con contenido sustancial para cumplir con los requisitos de AdSense.
* Se mejoró el **SEO del sitio**: meta tags, Open Graph, Twitter Cards y datos estructurados (JSON-LD).
* Se agregó una sección de **artículos/consejos** en la página principal con guías de uso del portal.
* Se implementó un **footer** consistente en todas las páginas con navegación a políticas y páginas legales.
* Se mejoró la **página 404** con diseño propio, navegación y estilo acorde al portal.

### v4.9
* Se agregó **Monster Tracks** al catálogo con portada propia, acceso directo desde el index e integración al sistema de ranking/popularidad.

### v4.8
* Se agregó **Hollow Knight Silksong** al catálogo con portada propia, acceso directo desde el index e integración al sistema de ranking/popularidad.

### v4.7
* Se agregaron **Super Smash Bros 64**, **Crossy Road**, **Plague Inc**, **Odd Bot Out** y **Brawl Stars** al catálogo con portadas propias, acceso directo desde el index e integración al sistema de ranking/popularidad.

---

## 💡 Roadmap

* 🔍 Buscador avanzado de juegos
* 📊 Ranking público visible
* 👤 Sistema de cuentas (opcional)
* 🏆 Leaderboards
* 💾 Guardado de progreso en la nube
* 🎮 Más juegos

---

## ⚠️ Disclaimer

Este proyecto actúa como portal de acceso a juegos web.
Todos los juegos pertenecen a sus respectivos creadores.

---

## 👨‍💻 Autor

**Budsin**
🚀 Creador de Budsin Games

---

## 🤝 Contribuciones

¿Ideas o mejoras?
👉 [Aquí](https://forms.gle/bUHTy8Lt6Kz1qkAx8)

---

## ⭐ Support

Si te gusta el proyecto, dale una estrella ⭐ en GitHub

---

## 📌 Estado

🟢 Activo — En desarrollo constante
