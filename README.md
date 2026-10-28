# 🎮 Budsin Games - osi

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-brightgreen" />
  <img src="https://img.shields.io/badge/Games-87-blue" />
  <img src="https://img.shields.io/badge/Frontend-React-orange" />
  <img src="https://img.shields.io/badge/Version-7.1-purple" />
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

* 🎮 **80+ juegos jugables al instante**
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

## 🆕 Ports añadidos desde wasm.rip (33 juegos)

Ports web de [wasm.rip](https://github.com/wasmdotrip/wasm.rip). Cada juego vive en `public/<nombre>/` y carga sus archivos desde el repositorio de su porter, por lo que dependen de que ese origen siga disponible.

PEAK carga directamente desde jsDelivr (`wasmdotrip/Peak-Port`, fijado al commit `f1924c4`) con su propio cargador en `public/peak/index.html`; ya no depende de `truffled.lol`, que algunas redes bloquean.

| Juego | Categoría | Port por |
| ----- | --------- | -------- |
| MiSide | Port | crackers |
| Baldi's Basics Birthday Bash | Port | crackers |
| Boil Noodles at Night | Port | sexyplankton |
| Cheese Rolling | Acción | sexyplankton |
| Brotato Paws n' Claws | Acción | dude |
| OneShot: World Machine Edition | Port | shayder |
| Helltaker | Port | shxyder |
| Stardew Valley | Port | cirsius |
| Dice A Million | Port | NotRexed |
| The Man From The Window 2 | Port | dude |
| Fez | Port | gurtmuncher |
| Beatblock | Port | sunsuke |
| Azahar | Herramientas | sexyplankton |
| Happy Room | Port | gurtmuncher |
| Inscryption | Port | reeyuki |
| Lobotomy Corporation | Port | reeyuki |
| Ages of Conflict | Port | sexyplankton |
| While True: Learn() | Port | dasher |
| Granny 3 | Port | crax |
| GTA 3 | Port | shxyder |
| ClusterTruck | Acción | NotRexed |
| How To Fish | Port | NotRexed |
| Global Strike (CS 1.6) | Acción | crackers |
| Crashout Crew | Acción | x8r |
| RimWorld | Port | sexyplankton |
| The Message From Deep Space | Port | dasher |
| Dude, Stop | Acción | dasher |
| Hill Climb Racing | Acción | NotRexed |
| Toasterball | Acción | dasher |
| Superflight | Acción | zay |
| Keep Talking And Nobody Explodes | Port | zay |
| PEAK | Port | dasher |
| Horsey Game | Port | crackers |

---

## 🚗 GTA V (proxificado)

GTA V está disponible en `https://games.budsin.dev/gta-5/` mediante un proxy de Caddy hacia `gta5-87g.pages.dev`. Sus archivos grandes permanecen en el hosting remoto; Budsin Games solo sirve localmente la portada (`public/portadas/gta-5.png`).

**Requisitos del navegador:** WebGPU, memoria WebAssembly de 64 bits y compresión de texturas BC. El motor exige además aislamiento entre orígenes, así que la ruta `/gta-5/` (y sus recursos) debe responder con `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp`; sin ellas la página muestra «not cross-origin isolated» y el juego no arranca. Las envía el servidor (Caddy o Cloudflare), no este repositorio.

**Chromebook:** `public/gta-5/index.html` detecta ChromeOS y, si la URL no lo indica, arranca con `?low=1&scale=0.75` (perfil de poca memoria: sin sombras, texturas a un cuarto y 2 hilos; dibuja al 75 %). Para anularlo, abre `/gta-5/?low=0&scale=1`. Otras opciones del juego: `?scale=0.5` (más rápido), `?res=1280x720` (tamaño fijo) y `?shadows=1` (sombras al mínimo).

---

## 📸 Preview

<p align="center">
  <img src="Snapshot18-1.jpg" alt="Budsin Games Preview" width="800" />
</p>

---

## 🛠️ Tech Stack

* React 18 + React Router 6 (SPA)
* Vite 5 (build directo a `public/`)
* CSS3 glassmorphism
* Firebase (conteo de popularidad, Auth para Budsin Pro)
* Github Pages / Firebase Hosting

---

## 📁 Estructura del Proyecto

```bash
/
├── README.md
├── AGENTS.md
├── .firebaserc
├── firebase.json
├── app/                      ← Código fuente React (Vite)
│   └── src/
│       ├── components/
│       ├── context/
│       ├── data/
│       ├── lib/
│       ├── pages/
│       └── styles/
└── public/                   ← Build de producción (raíz de deploy)
    ├── index.html
    ├── 404.html              ← Fallback SPA para GitHub Pages
    ├── settings.html         ← Stub de redirect → /#/settings
    ├── [juego].html          ← Páginas de cada juego (estructura plana)
    ├── react-assets/         ← JS/CSS generados por Vite
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

### v7.1
* **33 juegos nuevos** (ports de [wasm.rip](https://github.com/wasmdotrip/wasm.rip)): MiSide, Stardew Valley, Fez, Inscryption, RimWorld, PEAK, Superflight, Hill Climb Racing, Keep Talking And Nobody Explodes y más. Ver la tabla de ports más arriba.
* Cada página incluye favicon, Google Tag Manager, AdSense y Classroom Hotkey, y todas las portadas están en `public/portadas/`.
* GTA V: la página ahora incluye los recursos obligatorios y, en Chromebook, arranca con un perfil ligero (`?low=1&scale=0.75`).

### v7.0
* Nuevo diseño **glassmorphism** construido con **React**: más rápido, limpio y totalmente responsive.
* Migradas a React **todas las páginas** del sitio: portal, ajustes, admin, acerca de, privacidad, términos y contacto.
* Enrutamiento SPA con hash (`/#/settings`, `/#/admin`…) compatible con GitHub Pages y Firebase Hosting sin configurar rewrites.
* Las URLs antiguas (`/settings.html`, `/admin.html`, `/about.html`, etc.) redirigen automáticamente al portal React.

### v6.4
* Corregidos errores de indexación SEO: eliminadas etiquetas noindex, añadido canonical y robots.txt optimizado.

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
