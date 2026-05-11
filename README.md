# 🎮 Budsin Games - osi

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-brightgreen" />
  <img src="https://img.shields.io/badge/Games-40-blue" />
  <img src="https://img.shields.io/badge/Frontend-HTML%20%7C%20CSS%20%7C%20JS-orange" />
  <img src="https://img.shields.io/badge/Version-4.8-purple" />
  <img src="https://img.shields.io/badge/License-MIT-lightgrey" />
</p>

<p align="center">
  Portal de juegos en navegador con experiencia tipo consola 🎮  
</p>

---

## 🚀 Demo

🔗 https://budsin-games.pages.dev

---

## 🧠 Sobre el proyecto

**Budsin Games** es una plataforma web de juegos accesibles directamente desde el navegador.
Inspirada en interfaces de consola (como Nintendo Switch), prioriza velocidad, diseño visual y facilidad de uso.

---

## ✨ Features

* 🎮 **40 juegos jugables al instante**
* ⚡ **Sin descargas ni instalación**
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
| Minecraft 1.12.2               | Acción      |
| Minecraft 1.8                  | Multiplayer |
| Minecraft 1.21.x               | Acción      |
| Cookie Clicker                 | Idle        |
| Cookie Clicker Legacy Edition  | Idle        |
| Bitcoin Clicker                | Idle        |
| Geometry Dash                  | Acción      |
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
* Firebase (conteo de popularidad, sin Auth)
* Cloudflare Pages

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

### v5.0
* Se añadieron páginas de **Acerca de**, **Contacto** y **Política de Privacidad** con contenido sustancial para cumplir con los requisitos de AdSense.
* Se mejoró el **SEO del sitio**: meta tags, Open Graph, Twitter Cards y datos estructurados (JSON-LD).
* Se agregó una sección de **artículos/consejos** en la página principal con guías de uso del portal.
* Se implementó un **footer** consistente en todas las páginas con navegación a políticas y páginas legales.
* Se mejoró la **página 404** con diseño propio, navegación y estilo acorde al portal.

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
