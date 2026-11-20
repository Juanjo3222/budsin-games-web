# 🎮 Budsin Games - osi

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-brightgreen" />
  <img src="https://img.shields.io/badge/Games-87-blue" />
  <img src="https://img.shields.io/badge/Frontend-React-orange" />
  <img src="https://img.shields.io/badge/Version-7.3-purple" />
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

**Chromebook:** `public/gta-5/index.html` detecta ChromeOS y, si la URL no trae `low`, `scale`, `res` ni `fps`, arranca con `?low=1&scale=0.75` (perfil de poca memoria: sin sombras, texturas a un cuarto y 2 hilos; dibuja al 75 %). Para anularlo, abre `/gta-5/?low=0&scale=1`. Otras opciones del juego: `?scale=0.5` (más rápido), `?res=1280x720` (tamaño fijo) y `?shadows=1` (sombras al mínimo).

---

## 🕶️ Budsin Proxy (InvisiProxy LTS)

`proxy.budsin.dev` es [InvisiProxy LTS](https://github.com/InvisiProxy/InvisiProxyLTS) (AGPL-3.0, sin modificar, fijado en el commit `c075470`): Scramjet 2 + su propio servidor Wisp (`wispurr`), todo en un único proceso Node ≥ 26. Sustituye al antiguo proxy de Scramjet 1 + Wisp de Render. `/proxy.html` redirige a `https://proxy.budsin.dev/working`.

| Pieza (en el VPS) | Detalle |
|---|---|
| `/opt/node/` | Node 26 (tarball oficial) + pnpm; no toca el Node del sistema. Requiere `libatomic1`. |
| `/opt/invisiproxy/app/` | Clon del repo (usuario `invisiproxy`), `config.json` con `title` y `port: 8081`. Build: `pnpm install --frozen-lockfile && pnpm exec vite build --configLoader native`. |
| `invisiproxy.service` | systemd: usuario sin privilegios, `ProtectSystem=strict`, `MemoryMax=1200M`, `TasksMax=512`. No hay Tor ni regiones. |
| `/etc/invisiproxy.nft` | Tabla nftables cargada por el servicio: el puerto 8081 solo admite loopback (el servidor escucha en `0.0.0.0` y no es configurable) y el usuario `invisiproxy` no puede abrir conexiones nuevas a servicios locales (solo a sus 4 Wisp internos, 4432-4435) ni a la red local/rangos privados. Así ni el Wisp alcanza el servicio de Hosting, PayPal, Caddy o la LAN. |
| Caddy `http://proxy.budsin.dev:8080` | `reverse_proxy 127.0.0.1:8081` (con `X-Forwarded-For`/`X-Real-IP` = `CF-Connecting-IP`) y `/webblox/*` estático. InvisiProxy recomienda NGINX; por eso las reglas de red de arriba. |

**Actualizar**: `git pull` + build como `invisiproxy`, `systemctl restart invisiproxy` y `bash app/scripts/invisiproxy-info.sh` (cada build cambia las rutas aleatorias). Sin el cron de rebuild de pm2, las rutas solo cambian al reconstruir a mano.

**Riesgo asumido**: el tráfico saliente del proxy sale por la IP de la casa. Se bloquean IPs privadas, IP directa, SMTP (25/465/587) y todo salvo los puertos 80/443 (config por defecto de InvisiProxy).

---

## 🧱 WebBlox (Roblox en el navegador)

`public/webblox/` ejecuta el **cliente web oficial de Roblox** (`WebClientApp`, una build de Emscripten/wasm con pthreads). No es un port nuestro: se descarga de la CDN de Roblox y se sirve desde este origen. No está afiliado ni respaldado por Roblox Corporation.

| Archivo | Función |
|---|---|
| `index.html` + `launcher.js` | Lanzador: buscar juegos (`omni-search`), pegar un enlace de Roblox, unirse a un amigo (presencia) y ver si hay sesión. |
| `player.html` + `player.js` | Página del reproductor (pestaña propia, nunca un iframe): comprueba el entorno, registra el service worker, abre el puente de red y carga `engine/WasmPlayer.js`. |
| `sw.js` | Service worker (scope `/webblox/`): intercepta las peticiones del motor (página y workers) a `*.roblox.com`/`*.rbxcdn.com` y las pasa a la página. |
| `net.js` + `roblox.js` + `epoxy.js` | Puente: salen por el **Wisp de InvisiProxy con epoxy** (el TLS termina en el navegador), jar de cookies en `localStorage`, reescrituras de Roblox (`rbx-user-agent`, `join-game` → `join-game-instance`, `gameFqdn`). |
| `session.js` | Lee `.ROBLOSECURITY` del jar de Scramjet (`$scramjet`/`cookies`, o `__scramjet_controller`/`state` en Scramjet 2). La sesión se queda en el navegador: Budsin no la recibe. |
| `engine.json`, `flags.json` | Versión del motor fijada y sus flags (una actualización de flags de Roblox no rompe un motor antiguo). |
| `engine/<versión>/` | El motor (~220 MB, **no está en git**). Se baja con `python3 app/scripts/webblox-fetch.py`. |

**Despliegue**
1. WebBlox se sirve desde **`proxy.budsin.dev/webblox/`** (mismo origen que Budsin Proxy, para poder leer su jar de cookies); `games.budsin.dev/webblox/*` redirige allí. Caddy sirve `public/webblox/` en ese host con `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: credentialless` (el motor usa pthreads sobre `WebAssembly.Memory` compartida; `credentialless` y no `require-corp` para que sigan cargando AdSense y GTM, regla 5 de `AGENTS.md`; Safari no lo soporta y verá un aviso).
2. Tras el deploy normal, en el VPS: `python3 app/scripts/webblox-fetch.py --root /var/www/budsin-games-web/public/webblox` ejecutado como `github-runner` (solo hace falta al fijar una versión nueva; `--latest` consulta y fija la actual).
3. `bash app/scripts/invisiproxy-info.sh` escribe `public/webblox/proxy.json` con la ruta del Wisp de InvisiProxy (se aleatoriza en cada build). No está en git.
4. El reproductor necesita WebTransport (el tráfico de juego va directo a `*.qdmux.roblox.com`, no por Wisp) y `?placeId=` en la URL.

**Inicio de sesión**: el usuario abre Budsin Proxy (`proxy.budsin.dev`), pasa su verificación inicial, escribe `roblox.com/login` en la barra, inicia sesión (código por correo) y vuelve a `/webblox/`. `session.js` lee `.ROBLOSECURITY` de `__scramjet_controller` → `state` → `cookies` (`{updatedAt, cookies: "<JSON>"}`, claves `.dominio@ruta@nombre`). Sin sesión, Roblox responde 524 «Not authorized»; el reproductor lo avisa antes de cargar el motor.

**Pendiente / no verificado**: la unión real a un juego necesita una sesión de Roblox válida y no se ha podido probar sin una (el motor arranca, dibuja y completa las peticiones HTTP; con una cookie falsa responde 401 como se espera). La derivación de `gameFqdn` sigue el formato descrito por un despliegue funcional y debe confirmarse con un join real. La interceptación automática del botón «Jugar» de roblox.com dentro del proxy no está hecha (habría que escribir un plugin de frame de Scramjet 2).

---

## 💳 Pagos con PayPal (suscripción Pro)

El botón «Suscríbete con PayPal» de **Ajustes** cobra $2.99 USD al mes. La suscripción queda atada al `uid` de Google del usuario y el Pro se activa sin intervención del admin. El alta manual desde `/admin.html` sigue funcionando: un usuario es Pro si Firestore **o** PayPal lo dicen.

Como la web es estática, hay un pequeño servicio en el VPS (`server/paypal/`, Python sin dependencias + SQLite) que:

* valida la sesión del usuario con Firebase Auth (solo como identidad; no escribe en Firebase);
* consulta a PayPal con el Secret y comprueba plan, estado y propietario de cada suscripción;
* expone `/api/paypal/status`, `/subscribe`, `/cancel`, `/webhook` y `/health` a través de Caddy.

**Instalar o actualizar en el VPS** (desde `server/paypal/`; el Secret se guarda aparte con `sudo budsin-paypal-set-secret`):

```bash
cd server/paypal && ssh root@VPS 'mkdir -p /root/budsin-paypal-install' && scp budsin_paypal.py env.example budsin-paypal.service install.sh caddy-snippet.txt root@VPS:/root/budsin-paypal-install/ && ssh root@VPS 'bash /root/budsin-paypal-install/install.sh'
```

Pruebas del servicio: `python3 -I -m unittest discover -s server/paypal/tests`. Funciona en **producción (Live)**. Para volver a probar en Sandbox hay que cambiar `PAYPAL_API_BASE`, `PAYPAL_CLIENT_ID`, `PAYPAL_PLAN_ID` y `PAYPAL_WEBHOOK_ID` en `/etc/budsin-paypal.env` (y el Secret) y `PAYPAL_CLIENT_ID`/`PAYPAL_PLAN_ID` en `app/src/lib/paypal.js`.

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

## 🎵 Cuentas en Budsin Music

Budsin Music usa **la misma cuenta de Google que Budsin Games** (mismo proyecto de Firebase, `juanjo-games`). Como `/musica/` y el portal comparten origen (`games.budsin.dev`), la sesión iniciada en uno vale en el otro. Budsin Hosting vive en otro origen (`budsin.dev`): comparte el *uid* (mismo proyecto), pero cada sitio pide iniciar sesión.

**Qué se sincroniza** (siempre local-first: sin sesión todo funciona en `localStorage`): ♥, álbumes guardados, playlists, gustos y preferencias.
Los **gustos** son un resumen agregado por artista y género con decaimiento (vida media de 21 días). Por orden explícita del usuario (17-nov-2026) con la sesión iniciada también se sincronizan, dentro de `kv/taste`, la **actividad reciente** (últimas 40 entradas), las **canciones ya escuchadas** (últimas 150) y los **saltos** (hasta 300 canciones), para que el algoritmo y «Tus gustos» sigan al usuario entre dispositivos. «Borrar lo que aprendió de mí» y «Borrar mis datos de la nube» los eliminan. Lo que llega de la nube se valida (tipos y tamaños) antes de aplicarse.

| Ruta en Firestore | Contenido |
|---|---|
| `music_profiles/{uid}/kv/likes` | `items` (hasta 1000 canciones), `updatedAt` |
| `music_profiles/{uid}/kv/albums` | `items` (álbumes guardados, hasta 500), `updatedAt` |
| `music_profiles/{uid}/kv/taste` | `artists`, `genres`, `updatedAt` |
| `music_profiles/{uid}/kv/prefs` | autoplay, visualizador, ajustes de letras, `updatedAt` |
| `music_profiles/{uid}/playlists/{id}` | `name`, `tracks` (hasta 1000), `updatedAt` |

Gana la escritura más reciente (`updatedAt`). Al iniciar sesión por primera vez en un navegador con datos locales se **unen** con los de la nube; si en el navegador había datos de **otra** cuenta, se reemplazan (nunca se mezclan). Al cerrar sesión (aquí o en Games) se borran del navegador los datos de la cuenta. «Borrar mis datos de la nube» elimina todo `music_profiles/{uid}`.

### ⚠️ Reglas de Firestore (se publican en la consola de Firebase, no desde este repositorio)

**Las reglas que había eran `allow read, write: if true;` para toda la base de datos.** Con eso cualquiera que tenga la clave pública del proyecto (está en el JS del sitio) puede leer y escribir todo: darse de alta con `pro: true`, ponerse Pro, leer los correos de todos los usuarios, sobrescribir los guardados de otros o inflar el ranking. Con esas reglas abiertas, el apartado de Music también «funciona», pero sin ninguna protección.

`firestore.rules.proposed` las sustituye por unas que cubren cada colección que usa el sitio (inventario hecho leyendo `app/src`, `public/site.js`, `public/save-system.js` y `public/musica/index.html`) y **deniegan todo lo demás**:

| Colección | Quién puede |
|---|---|
| `users/{uid}` | leer: el dueño o un admin. Crear: solo el dueño y siempre con `pro:false`. Actualizar: un admin; el dueño solo para **quitarse un Pro vencido** o **activar la prueba de 7 días una única vez** |
| `game_popularity/{id}` | leer: todos. Escribir: cualquiera, solo sumas de 1 a 5 y sin tocar nada más |
| `game_leaderboards/{juego}` y `/scores` | leer: todos. Escribir: solo usuarios con `pro: true` en su documento |
| `game_requests/{id}` | crear: cualquiera (siempre `pending`, y a su propio nombre o `anonymous`). Leer, aprobar o borrar: admin |
| `gamesaves/{uid}_{juego}` y `/chunks` | solo su dueño (el id empieza por su uid) |
| `music_profiles/{uid}/**` | solo su dueño |

Admins (mismos correos que el panel): `juvaldiviam@gmail.com`, `juanjoseguravegamail@gmail.com`, con correo verificado. El mismo par de correos está en `ADMIN_EMAILS` de Budsin Hosting.

**Quién más usa este proyecto de Firebase**: todo Budsin comparte `juanjo-games`. **Budsin Hosting** (repositorio `Juanjo3222/budsin.dev`) usa solo **Firebase Auth** (inicio de sesión con Google; su servicio verifica el token con Identity Toolkit) y guarda sus datos en `/var/lib/budsin-hosting`: no toca Firestore, así que estas reglas no le afectan. Si alguna aplicación nueva usa Firestore en este proyecto, hay que añadir su bloque de reglas **antes** de publicar (lo no listado queda denegado).

**Pruebas**: `firestore.rules.test.mjs` (60 comprobaciones: lo que el sitio hace y los ataques que hoy se permiten) contra el emulador oficial. Con las reglas propuestas pasan 60/60; con las abiertas de hoy fallan 37 (los ataques). Cómo correrlas está en la cabecera del archivo.

**Antes de publicar**
1. Publica en Firestore › Reglas. La consola guarda un historial para revertir al instante.
2. Prueba, con una cuenta Free y con la de admin: iniciar sesión, ver el estado Pro en Ajustes, activar la prueba, el panel `/admin`, un guardado en la nube, el ranking y Budsin Music (♥, playlist).

**Lo que las reglas no pueden arreglar** (son límites del diseño actual, donde el navegador decide): el tope de 5 guardados para Free es solo del cliente; la prueba gratuita se puede repetir con otra cuenta de Google; cualquiera puede sumar clics a la popularidad (acotado a 5 por escritura). Las reglas de **Firebase Storage** (guardados grandes de Unity) son aparte y conviene revisarlas igual.

---

## 📝 Changelog

### v7.3
* **Budsin Chat** en el portal: tarjeta nueva (ES/EN/PT, categoría «Social») que abre `/chat/`, chat en tiempo real solo para cuentas de colegio o universidad (ver «Budsin Chat»).
* **Popup de novedades** restaurado (`ChangelogModal`, una vez por versión; el botón de cerrar se activa a los 3 s), con enlaces directos a **Budsin Music** y **Budsin Chat**. Los textos viven en `app/src/data/changelog.js` (ES/EN/PT); subir `SITE_VERSION` lo vuelve a mostrar.
* Budsin Music: botón **💬 Compartir en Budsin Chat** y la música sigue sonando en el chat; ver video oficial; Jam; Radio Focus y menú de música dentro de los juegos.
* El portal se recompiló con `cd app && npm ci && npm run build` (genera `public/react-assets/` y reinyecta el prerender en `public/index.html`); la compilación sin cambios reproduce exactamente lo publicado.

### v7.2
* **Pagos con PayPal**: suscripción Pro de $2.99 USD/mes desde Ajustes, con servicio propio en el VPS (`server/paypal/`). Se puede cancelar desde el sitio y el Pro sigue hasta el fin del periodo pagado. Ver la sección «Pagos con PayPal».
* El Service Worker ya no cachea las rutas `/api/`.
* **WebBlox** (`public/webblox/`): Roblox en el navegador con el cliente web oficial. Ver la sección «WebBlox».
* **Budsin Music** (`public/musica/`): buscador y reproductor de música. Backend propio en el VPS (`server/music/`, basado en [x8rr/music](https://github.com/x8rr/music), AGPL-3.0, con un parche para escuchar solo en `127.0.0.1`), detrás de Caddy en `/api/music/*`. El audio sale de YouTube Music vía yt-dlp y la búsqueda de Tidal. Tarjeta nueva en el portal (ES/EN/PT) y enlace al código fuente en la propia página.
* **Budsin Music, segunda tanda**: rediseño tipo streaming (catálogo por género, álbum/artista/similares, playlists, ♥, cola); **visualizador** de audio (6 modos, 4 paletas y una personalizable); **letras sincronizadas** desde LRCLIB a través del backend (`/api/music/lyrics`), con ajuste de sincronía y selector de versión; **mini-reproductor en el portal** (`public/bm-mini.js`) que sigue sonando al ir a Budsin Games o desde otra pestaña; **recomendaciones «Para ti», radio y autoplay** calculadas en el navegador; **portadas de playlist editables** (mosaico por defecto; la de una canción, una imagen propia recortada a cuadrado y ligera, o color y emoji; se sincronizan con la cuenta); **álbumes guardados** en la biblioteca (el + de cada portada o «Guardar álbum»); fotos de artista con respaldo (búsqueda, o inicial sobre degradado); y **cuentas**: inicio de sesión con Google (misma cuenta y sesión que Budsin Games) con sincronización en Firestore. Ver «Cuentas en Budsin Music».
* **Budsin Music, «Tus gustos»** (`#/taste`): pantalla de transparencia del algoritmo. Muestra qué artistas y géneros pesan, lo que sueles saltar, la actividad reciente con el porqué de cada punto (escuchada entera, saltada, ♥…) y las reglas de decisión; permite «Olvidar» un artista. Las tarjetas de «Para ti» explican su motivo al pasar el cursor. La actividad reciente (`log`), `seen` y `skips` se quedan en el navegador: a la nube solo viajan artistas y géneros agregados.
* **Budsin Music, enlaces de Spotify y YouTube**: pegar un enlace en el buscador (canción o álbum de Spotify, vídeo de YouTube / YouTube Music) lo convierte en una búsqueda por «artista título». Lo resuelve el backend (`/api/music/resolve`, `lib/resolveLink.ts`): solo lee título y artista públicos, solo de una lista fija de hosts (sin SSRF) y no reproduce nada de allí. Requiere `sudo bash server/music/install.sh` en el VPS.
* **Budsin Music, navegación a artista y álbum**: el artista y el álbum de cada canción son siempre enlaces, también en las de YouTube Music (que no traen ids del catálogo: la página se busca por nombre al hacer clic, con `lookup/artist` y `lookup/album`). El menú ⋯ de cada canción siempre ofrece «Ir al artista» e «Ir al álbum», que es la vía en el móvil.
* **Budsin Music, color de la portada y tipografía**: el acento, el segundo color y un brillo en la parte alta de la página siguen la portada de la canción que suena (se lee a través de `/api/music/art`, mismo origen, en un canvas de 32×32; portadas grises o casi negras dejan el verde original). Se apaga en Biblioteca («Colores de la portada», `localStorage` `bm_dyn`). Tipografía Inter (Google Fonts) con respaldo del sistema.
* **Budsin Music, clic derecho y varios artistas**: clic derecho (o pulsación larga) en una canción, una tarjeta o el reproductor abre el mismo menú que ⋯ en el puntero (cola, radio, ♥, playlists, ir al artista/álbum, quitar de la playlist). Si una canción tiene varios artistas («A & B», «A, B», «A feat. B»), cada uno es su propio enlace y el menú ofrece «Ir al artista: X» por cada uno; antes solo se podía entrar al primero.
* **Budsin Music, mini ventana flotante y números**: botón opcional (icono de ventana en la barra del reproductor) que abre una mini ventana siempre visible sobre otras aplicaciones, con portada, título, la línea de letra actual, barra de progreso y anterior/play/siguiente. Usa la API Document Picture-in-Picture (Chrome/Edge de escritorio y ChromeOS); donde no existe, el botón no aparece. Arreglo: una fila que ya estaba sonando al dibujar la lista (playlist, álbum…) perdía su número al cambiar de canción (`data-n` ahora siempre se guarda).
* **Budsin Music, traducción de letras, color en todo el reproductor y espejo**: botón «🌐 Traducir» en el panel de letras (a ES/EN/PT según el idioma de la app) que pone la traducción bajo cada línea; también sale en el subtítulo del visualizador y en la mini ventana. La traduce el backend (`POST /api/music/lyrics/translate`, `lib/translate.ts`, una petición por canción, en caché 24 h, 12/min por IP) con el endpoint público de Google Translate, que **no es oficial** (sin clave ni garantía: si deja de responder, la letra queda sin traducir). Si la letra ya está en tu idioma lo avisa. Además: el título del reproductor, las barras de progreso y volumen y la línea actual de la letra usan el color de la portada; el visualizador tiene control de «Sensibilidad» y el modo Espejo usa una curva que ya no se llena al máximo. Requiere `sudo bash server/music/install.sh` en el VPS.
* **Budsin Music, panel «reproduciendo», PiP adaptable y mejor color**: (1) botón en el reproductor que abre un panel lateral estilo Spotify con portada, título, artista y la letra sincronizada (con la traducción si está activa), apagado por defecto, recordado (`bm_npv`) y solo en pantallas de 1000 px o más; (2) la mini ventana flotante (PiP) ahora se escala con el tamaño de la ventana (primero oculta la letra, luego los tiempos y la portada, los controles siempre caben), usa todo el espacio sin márgenes y suma control de volumen con porcentaje; la barra superior con el dominio la dibuja Chrome y no se puede quitar; (3) el punto de la barra de avance es siempre visible; (4) el color de la portada ahora lo decide el área que ocupa cada color (antes pesaba la saturación y un detalle pequeño y vivo podía ganar).
* **Budsin Music, Ajustes, tema claro/oscuro y degradado personalizable**: nueva pantalla `#/settings` (enlace «Ajustes» en la barra lateral). (1) Tema Oscuro / Claro / Automático (sigue al sistema), recordado en `bm_theme` y aplicado antes de pintar para evitar parpadeos; el visualizador, la letra y el hero se mantienen oscuros en el tema claro. (2) Colores y degradado de la página: «De la portada» (sigue la portada de la canción), «Paleta» (10 paletas de dos colores o dos colores propios, con intensidad ajustable de 0 a 50 % y la opción de usar el color también como acento) o «Predeterminado». (3) Interruptor del panel lateral. Todo se guarda en el navegador (`bm_lookmode`, `bm_lc1`, `bm_lc2`, `bm_lstr`, `bm_lacc`); no se sincroniza con la cuenta. Además: el panel lateral se puede ensanchar arrastrando su borde (260–560 px, doble clic lo restablece), la fila de volumen del PiP se ve también en ventanas pequeñas y una portada sin color (negra, gris o blanca) usa un tono neutro en vez del verde.
* **Budsin Music, actividad y algoritmo en la cuenta**: `kv/taste` ahora incluye también `seen`, `skips` y `log` además del resumen por artista y género (ver «Cuentas en Budsin Music»). Los textos de «Tus gustos» y de la biblioteca lo dicen con claridad. Además: barras de progreso y volumen visibles en el tema oscuro (una variable CSS se referenciaba a sí misma), porcentaje de volumen en el reproductor, ajuste «Portadas sin color» (arcoíris / color de Budsin / neutro), panel lateral con la portada fija y la letra que baja sola, emojis sustituidos por iconos simples que siguen el color de la página y un PiP rehecho al estilo de letras mini (línea anterior, actual y siguiente; se ve la letra incluso en ventanas pequeñas).
* **Budsin Music, mini ventana configurable y huevo de pascua**: (1) la mini ventana (PiP) tiene corazón de favoritos, tres diseños (Completa / Letra / Mini; se cambian con el botón de la esquina de la ventana o en Ajustes), ajuste para mostrar u ocultar la portada y letra actual con degradado horizontal sacado de la paleta de la portada (el fondo se desvanece en vertical: patrón opuesto; es un degradado estático, sin animaciones); se guarda en `bm_pipcover`, `bm_pippreset` y `bm_pipgrad` y se aplica en vivo a una ventana abierta. (2) Huevo de pascua: «Hopes and Dreams», «SAVE the World», «His Theme», «Final Power» y «Burn in Despair!» de Toby Fox ponen siempre el arcoíris (solo con el modo «De la portada»), una etiqueta «Asriel Dreemurr» en el panel lateral y un aviso una vez por sesión.
* **Budsin Music, pantalla completa «Reproduciendo», loop/casa en el PiP y animaciones**: (1) nuevo botón (o tecla `F`) que abre una vista a pantalla completa dentro del sitio con la portada grande, la letra grande que baja sola (actual / anterior / pasadas, con traducción si está activa; clic en una línea salta a ese momento) y controles completos (corazón, aleatorio, anterior, play, siguiente, loop, volumen con %); arriba tiene botón Casa (cierra y va a Inicio), botón de pantalla completa real del navegador (Fullscreen API) y cerrar; `Esc` la cierra. Fondo con degradado (sin desenfoque, para no cargar la GPU) y se mantiene oscura en el tema claro. (2) El PiP suma botón de loop (apagado / todo / una) y botón Casa (enfoca la pestaña y va a Inicio). (3) Animaciones al cambiar de línea: en el PiP la línea nueva entra deslizándose y las vecinas se mueven; en el panel lateral y la pantalla completa la línea actual se desplaza o escala con transición; se respeta `prefers-reduced-motion`.
* **Budsin Music, «DJ Juanjo»**: una radio personal con comentarios hablados entre canciones (inspirada en el DJ de Spotify, que no es una playlist sino una sesión). Se inicia desde la tarjeta de Inicio (con un cuadro para pedirle algo: «tranquilo», «rock», «fiesta»…, que se traduce a búsquedas) o con el botón de auriculares del reproductor. Rellena la cola con el algoritmo (gustos + autoplay + radio); la presentación inicial usa una plantilla (la música arranca al instante) y, mientras suena cada canción, se prepara la línea de la siguiente (con IA tarda 5–10 s, por eso se pide con tiempo); al terminar, la dice con la voz del navegador (`speechSynthesis`) y recién entonces pasa a la siguiente. Si eliges otra canción mientras habla, se calla. **Idiomas**: el DJ tiene su propio idioma (automático = el del navegador, o uno de 16 a elegir); con IA habla en cualquiera, y las plantillas locales existen en ES, EN y PT (cualquier otro idioma cae en inglés); si el dispositivo no tiene voz para ese idioma, el comentario sale solo como texto. **IA opcional**: `POST /api/music/dj` (`lib/dj.ts`) llama a un gateway compatible con OpenAI (por defecto `gpt-6-luna`), con límite de 10/min por visitante, tope diario (`DJ_DAILY_MAX`, 2000), caché de 6 h y los datos de la canción dentro de etiquetas `<data>` con la orden de no tratarlos como instrucciones; la clave (`DJ_API_KEY`, ver `server/music/env.example`) vive **solo** en `/etc/budsin-music.env` del VPS. Sin clave, o ante cualquier error, el sitio usa las plantillas. **Selección de canciones con IA** (`POST /api/music/dj/pick`, 4/min por visitante): para un pedido («algo tranquilo para estudiar») el navegador arma una lista numerada de candidatos (búsqueda + «Para ti») y manda solo título, artista y una marca `fav` (si el artista está entre los favoritos del oyente; sin ids ni historial); el modelo devuelve un JSON con números de esa lista y una razón por canción, y el servidor **descarta cualquier número que no esté en la lista**, repetidos y textos inválidos, así que la IA ordena y elige pero no puede inventar canciones. **Pedido de un artista** («Toby Fox», «Peso Pluma»): si el nombre coincide con un artista (`lookup/artist` + su página), la cola se arma con sus canciones populares (filtrando las que no lo tienen acreditado: nada de nombres parecidos ni ruido), 12 seguidas de él y luego sus pendientes alternados con canciones de artistas parecidos (24 en total, sin el tope de 3 por artista); la IA recibe `mode:"artist"` y ordena con «las del artista primero, varias seguidas» (se usa la razón de apertura `artist`, con plantillas ES/EN/PT en la página y en `bm-dj.js`). Un pedido de ánimo («algo tranquilo») o que no es un artista sigue el camino de siempre. **Nadie espera a la IA** (tarda 5–20 s con el proveedor): tanto en un inicio normal como con un pedido, la música arranca al instante (con el algoritmo, o con el orden de la búsqueda y de tu rincón del género) y, en segundo plano, la IA elige y ordena lo que sigue; su respuesta reemplaza la parte pendiente de la cola cuando llega, salvo que el oyente haya editado la cola mientras tanto o la sesión haya cambiado. El tope de la selección en el servidor es de 30 s. Sin IA, o ante un error, se usa el orden del algoritmo/búsqueda. **Control de gasto** (el proveedor cobra también las llamadas que fallan o caducan): el tope diario es en unidades (un comentario = 1, una selección = 4; `DJ_DAILY_MAX`, por defecto 5000, unas 1250 selecciones al día), máximo 4 llamadas simultáneas (`DJ_MAX_CONCURRENT`), 30 candidatos como máximo y la selección ya no pide una razón por canción (la página no la muestra); y un interruptor de emergencia: 3 fallos o caducidades en 5 minutos pausan la IA 10 minutos (el estado `/api/music/dj/status` pasa a `ai:false` y la página usa plantillas y el orden del algoritmo). Ajustes → «DJ Juanjo»: frecuencia (seguido / de vez en cuando / sin voz), idioma, voz, IA sí/no y «Probar la voz». Requiere `sudo bash server/music/install.sh` para la parte de IA.
* **Budsin Music, ♥ y álbumes entre dispositivos**: arreglo de «los ♥ no se sincronizan» y mezcla automática. Causa: Firestore rechaza los valores `undefined` (los ♥ guardados traen campos como `album` o `isrc` vacíos) y el error ocurría dentro de un temporizador, así que nunca se subía nada y el estado se quedaba en «Sincronizando…» hasta recargar; ahora todo se limpia (`fbClean`) antes de escribir y cualquier error se captura. Además, los ♥ y los álbumes guardados dejan de ser «gana el último que escribe» y pasan a **unirse**: lo que un dispositivo tiene y el otro no se añade en ambos (aunque se editen a la vez, o un dispositivo vuelva con más canciones tras estar sin conexión). Cada elemento nuevo lleva `at` y lo quitado viaja como «tumba» con fecha (`removed` en `kv/likes` y `kv/albums`, máx. 500 y 120 días), de modo que quitar un ♥ en un dispositivo lo quita en todos y no resucita; dar ♥ otra vez después de quitarlo gana a la tumba. Los ♥ antiguos sin fecha se tratan como los más viejos. Las playlists siguen con «gana la última edición» por playlist. Sin cambios en el backend ni en las reglas de Firestore.
* **Budsin Music, reproducción más rápida**: medido en producción (373 reproducciones en 12 h), una canción nueva tardaba una mediana de ~7 s (p90 12 s) en sonar. Causa: el primer cliente de yt-dlp (`web_embedded`) respondía «Requested format is not available» con todas las canciones probadas y cada fallo costaba 3-5 s antes de probar el siguiente, que sí servía el archivo en ~3 s. Ahora el orden por defecto es `default,tv_embedded,web_embedded,web_safari,mweb,ios` (`YTM_PLAYER_CLIENTS` sigue mandando) y el cliente que sirvió la última canción pasa al primer lugar (si YouTube cambia qué clientes funcionan, se corrige solo tras una canción lenta). Además, **precarga**: mientras suena una canción, la página pide a `/api/music/stream` (rango `bytes=0-1`, sin descargar audio) las dos siguientes de la cola, de una en una y tras 2,5 s de reproducción, para que el servidor ya las tenga en disco cuando toque el cambio; no se hace con aleatorio ni repetir una, ni con «ahorro de datos». El streaming por trozos se descartó: con el arreglo de clientes una canción nueva baja en ~3 s, de los cuales ~2,5 s son resolver el enlace (no se puede trocear), así que ganaría menos de 1 s a cambio de reescribir el servidor de rangos. Requiere `sudo bash server/music/install.sh` en el VPS para la parte del servidor.
* **Budsin Music, navegación, DJ personalizado y ventana flotante**: botones atrás / adelante / inicio junto al buscador (siguen el historial del navegador y se apagan sin destino cuando el navegador lo indica). Con los colores de la portada activos, el panel «Destacado» sigue el color de la página en vez del de su propia portada. La ventana flotante: la letra de dos versos en una línea se reduce para caber (antes se perdía por combinar `line-clamp` con el degradado del texto) y se puede hacer clic en la línea anterior o siguiente para saltar a ella. DJ Juanjo: un pedido de género o ánimo («trap argentino») se personaliza con lo que escuchas: los artistas que ya oyes dentro de ese género, sus canciones y los artistas parecidos van primero.
* **Budsin Music, DJ Juanjo como botón con su propia interfaz**: la tarjeta grande del inicio desaparece. Ahora hay un botón «🎧 DJ Juanjo» (primero en la fila de chips del inicio, con un punto que parpadea mientras está en el aire) y el de los auriculares del reproductor; ambos abren la misma ventana: estado (en el aire / apagado), caja de pedido con «Iniciar DJ» / «Cambiar pedido», ideas rápidas (Tranquilo, Fiesta, Estudiar, Gym, Triste, Romántico), cuánto habla (seguido / de vez en cuando / sin voz), interruptor de comentarios con IA, botón Detener y enlace a los ajustes completos. Esc o clic fuera la cierra y el DJ sigue sonando.
* **Budsin Music, voces del DJ (navegador, Fish Audio y ElevenLabs)**: en la ventana del DJ hay una sección «Voz» con tres motores y un ▶ para probar cada uno (para recoger opiniones). El navegador sigue siendo el predeterminado y el respaldo. Fish Audio y ElevenLabs los llama el **backend** (`lib/tts.ts`, `GET /api/music/dj/voices` y `POST /api/music/dj/tts`): las claves viven solo en `/etc/budsin-music.env` (`FISH_API_KEY`, `ELEVENLABS_API_KEY`; ver `env.example`), el navegador nunca las ve; un motor sin clave aparece desactivado. Límites: 20 peticiones/min por IP, texto de hasta 240 caracteres, caché por frase (7 días) y un **tope diario por motor** (`FISH_DAILY_BYTES`, `ELEVENLABS_DAILY_CHARS`); al agotarse o fallar, habla la voz del navegador. La frase se pide a la nube mientras suena la canción anterior, así que no hay silencio. Solo se envía la frase del DJ al tercero. Idiomas: los 16 del DJ (ElevenLabs recibe el código de idioma y, si lo rechaza, reintenta sin él; Fish lo detecta). **Pendiente de revisar antes de depender de ello: el plan gratis de ambos puede no permitir uso comercial** (el sitio tiene anuncios). Requiere `sudo bash server/music/install.sh` y poner las claves en el VPS.
* **Budsin Music, el DJ sigue en Budsin Games**: si el DJ está encendido al salir de `/musica/` (mismo tab, atrás o cerrando la pestaña), el mini-reproductor del portal (`public/bm-mini.js`) lo sigue: la sesión (`bm_session`) lleva una bandera `dj` y `public/bm-dj.js` (solo se descarga cuando hace falta) hace lo del DJ en el portal: comentarios entre canciones (plantillas, IA y voz del navegador / Fish Audio / ElevenLabs según lo elegido, con la voz pedida mientras suena la canción anterior) y la cola que se extiende sola con canciones parecidas. El mini-reproductor muestra la frase del DJ en su segunda línea, tiene un botón de auriculares para encender o apagar el DJ desde el portal y, al volver a Music, el DJ se recupera con la canción que iba sonando. Lee los ajustes y los gustos de `localStorage`; las claves de las voces nunca salen del servidor. **Las plantillas `DJT` están copiadas en `bm-dj.js`** (una prueba del backend, `djTemplates.test.ts`, falla si se desincronizan). Limitación: en el portal la voz del navegador puede ser rechazada por Chrome hasta que la página reciba un clic (entonces se ve la frase pero no se oye); las voces de Fish y ElevenLabs no tienen ese problema.
* **Budsin Music, DJ Juanjo es un hombre**: las voces en la nube pasan a ser masculinas por defecto (ElevenLabs: Liam; Fish Audio: «Adam», una voz de locutor de su biblioteca pública), cambiables con `ELEVENLABS_VOICE_ID` y `FISH_VOICE_ID`; la IA recibe la instrucción de hablar de sí mismo en masculino; y, si no se eligió una voz del navegador, se prefiere una con nombre masculino. Cuidado al elegir voces de la biblioteca de Fish: muchas imitan a famosos o personajes (derechos); usar voces genéricas.
* **Budsin Music, rediseño inspirado en la guía de diseño de Spotify (`DESIGN.md`)**: superficies casi negras (`#121212` / `#181818` / `#1f1f1f`, hover `#2a2a2a`), texto blanco y gris plata `#b3b3b3`; botones en píldora con la etiqueta en mayúsculas y espaciado ancho (los secundarios, contorno gris); buscador en píldora con el borde interior de la guía; tarjetas de 8 px que se aclaran con sombra al pasar el cursor; menús y ventanas con sombra pesada y sin borde; barras (lateral, reproductor, cola) separadas por sombra y no por línea; titulares más compactos y rótulos decorativos en gris (el color de acento queda para lo funcional: reproducir, activo, ♥). Se mantiene el acento de Budsin y los colores de la portada, Inter en lugar de la tipografía propietaria de Spotify, y el tema claro con sus propios valores. Todo el bloque está al final de la hoja de estilos, bajo «Design system inspired by Spotify».
* **Apps instalables (PWA) sin tienda**: se pueden instalar desde el navegador (Chrome, Edge, Android; en iPhone, «Compartir > Añadir a pantalla de inicio»), sin Google Play. **Budsin Music** pasa a ser una app independiente: `public/musica/manifest.webmanifest` (scope `/musica/`, ventana propia, íconos 192/512 y maskable, accesos directos a Buscar / Biblioteca / Me gusta), registra el service worker raíz y tiene botón «📲 Instalar app» en la barra lateral y una caja en Ajustes (en iPhone explica el gesto; dentro de la app instalada dice que ya está instalada). **Budsin Games** ya era instalable (`manifest.json`); `public/pwa-install.js` (cargado en las páginas del portal, sin reconstruir React) muestra un aviso pequeño «Instala Budsin como app» cuando el navegador lo permite, descartable y sin volver en 14 días, y que no sale dentro de `/musica/` ni si ya está instalada. Se comprobó con `Page.getInstallabilityErrors` de Chrome (sin errores). Limitación: un Chromebook administrado puede bloquear la instalación por política del administrador.
* **Budsin Music, rediseño UI/UX (fase 1 del plan de mejoras)**: **barra lateral**: sin tarjeta de cuenta ni texto legal; ícono (i) junto al logo que abre el aviso de terceros con el enlace al código fuente (AGPL), que además está en Ajustes > Acerca de y al pie de cada vista; «Tu biblioteca» con píldoras Playlists / Álbumes / Artistas (se recuerda la elegida, `bm_libfilter`) y portadas de 48 px con 4 px de radio. **Perfil** circular de 36 px arriba a la derecha con menú (Cuenta, Ajustes, Instalar app, Sincronización, Cerrar sesión); la cuenta también está en Ajustes. **Inicio**: el degradado de arriba se funde a 350 px y, si no suena nada, toma el color de la portada del banner; cuadrícula de accesos rápidos de 3×2 (Me gusta, playlists, lo reciente) de 56 px; chips de vidrio (`rgba(255,255,255,.1)` + `blur(12px)`, sin borde); el banner «Destacado» ya no tiene caja (portada con sombra profunda y texto sobre el degradado). **Panel derecho** con pestañas SIGUIENTE (cola que se reordena arrastrando y se vacía con ✕) / LETRA (con botón Expandir a pantalla completa) / SIMILARES (radio de la canción, con ＋ para añadir a la cola), con la canción y su contenido en tarjetas separadas de 12 px y `#18181b`; los botones Cola y Letra lo abren en pantallas anchas. **Letras**: la línea activa en blanco puro, peso 700 y `scale(1.03)`; las demás a `opacity .35` con `transition: all .3s ease` (sustituye al tinte de acento en la línea activa). **Reproductor**: barras de progreso y volumen en blanco en reposo y en el acento al pasar el cursor, con el círculo indicador solo en ese momento (se mantiene el acento propio de Budsin, no un morado fijo); el botón «Ocultar» del portal es un círculo oscuro con ⌄ en la esquina de la portada que solo aparece al pasar el cursor; a la derecha solo Letra, Cola, Volumen y Pantalla completa, y el resto (Visualizador, DJ, Vista de reproducción, Mini ventana) en un menú ⋮ (`MORE_EXTRA` para que otros módulos añadan entradas).
* **Budsin Music, audio, DJ y social (fase 2 del plan de mejoras)**: **ecualizador** de 5 bandas (60 Hz, 230 Hz, 910 Hz, 3,6 kHz, 14 kHz, `BiquadFilterNode`) con presets Plano / Bass Boost / Vocal / Electrónica (menú ⋮, se guarda; el audio pasa por un grafo de Web Audio compartido con el visualizador, que solo se crea desde un clic). **Temporizador** de 15 / 30 / 45 min o fin de la canción, con fundido de salida de 10 s antes de pausar. **Crossfade con la voz del DJ**: cuando le tocan comentario, entra ~5 s antes del final, la música baja al 25 % bajo su voz y la siguiente canción sube poco a poco sin silencio (`GainNode`, o `audio.volume` si no hay grafo). **«¿Por qué?»** abre un popover que explica el algoritmo con tus artistas («Basado en tus reproducciones recientes de A y B»). **Fuente visual** del panel derecho: Portada o Canvas (animación que reacciona a la música; no se ofrece vídeo de YouTube por sus términos). **Compartir frase**: al seleccionar de 1 a 4 líneas de la letra aparece el botón y se genera una tarjeta PNG de 1080×1920 (colores de la portada, portada, versos y logo; en móvil usa el menú de compartir). **Crear playlist con IA** (barra lateral y Biblioteca): describes un escenario y DJ Juanjo arma 20 canciones personalizadas con portada (degradado + emoji) y descripción (la de la IA si está activa; si no, una plantilla); las playlists ahora tienen `description` y se sincroniza con la cuenta.
* **Budsin Music, Radio Focus y menú dentro de los juegos (fase 3)**: (1) Explorar tiene la sección «Modo Gaming · Radio Focus» con 4 estaciones sin voz (Phonk, Lo-Fi Beats, Synthwave, Instrumental; `public/bm-stations.js`): cola continua que se extiende sola con canciones de la misma estación. (2) Todos los juegos (`classroom-hotkey.js`, que ya carga cada página) inyectan `bm-mini.js?game=1`: un botón flotante 🎵 abajo a la derecha que abre un menú con portada, controles, volumen, las 4 estaciones, «Reanudar la última sesión», mini ventana flotante (Picture-in-Picture, solo Chrome/Edge de escritorio) y enlace a Budsin Music. El menú del overlay de Budsin y la mini ventana son intercambiables (al abrir una se cierra la otra y la música no se corta; «↩ Volver al menú» en la mini ventana). Los scripts usan URLs absolutas (juegos con `<base href>` de un CDN). Se apaga en Budsin Music › perfil › «Menú de música en los juegos» (`localStorage bm_gamemenu=0`).
* **Budsin Music, Jam (escuchar juntos, fase 3)**: perfil › «🎧 Jam · Escuchar juntos» (`#/jam`). La anfitriona crea una sala con código de 6 caracteres y comparte el enlace `…/musica/#/jam/CODIGO`; quien entra oye la misma canción a la vez (sigue pausa, salto y cambio de canción; corrige la deriva con el reloj del servidor de Firestore). Barra flotante con código, nº de oyentes, «Copiar enlace» y «Terminar»/«Salir». Datos en Firestore `music_jams/{código}` + `members/{uid}`: **excepción de la Regla 4 solo para Jam** (ver AGENTS.md). **Requiere pegar las reglas nuevas de `firestore.rules.proposed` en la consola de Firebase** (bloque «Jam»); sin ellas Jam no funciona. Pruebas: `firestore.rules.test.mjs` (78 casos) y Playwright con Firestore simulado (dos navegadores).
* **Budsin Music, video oficial**: si la canción tiene video musical oficial en YouTube Music aparece el botón 🎬 en el reproductor (y «Ver video oficial» en el menú ⋮). Lo busca el backend (`GET /api/music/video?title&artist&duration`, `lib/ytmVideo.ts`): búsqueda de YouTube Music filtrada a videos, y solo acepta filas marcadas `MUSIC_VIDEO_TYPE_OMV` del mismo artista, misma canción y misma versión (sin «Live», «Remix»…); si no hay, no sale el botón. El video **no usa el reproductor de YouTube** (muchas redes de colegio/oficina, p. ej. Fortinet, bloquean youtube.com): el backend lo descarga con yt-dlp (360p, h264+aac unidos con ffmpeg, ~10 MB) y lo sirve desde el propio sitio en `GET /api/music/video/file/:id` con Range; solo acepta ids que haya validado la búsqueda anterior, comparte el cupo de descargas del audio y su carpeta (`data/ytm-cache/video`) se limita a 500 MB (`YTM_VIDEO_CACHE_MB`). Mientras se ve, la música de Budsin se pausa y **no hay letras** (ni panel, ni pestaña, ni pantalla completa, ni línea del PiP). Al abrirlo, el video arranca en el segundo por el que iba la canción (más la intro del video). Al cerrar el video —o al irse a Budsin Games con él abierto— la canción sigue **solo como audio desde el punto al que llegó el video** (se resta la diferencia de duración, hasta 90 s, porque los videos suelen traer intro); si el video estaba en pausa, el audio queda en pausa. **Requiere `sudo bash server/music/install.sh` en el VPS** (endpoints nuevos; el instalador añade `ffmpeg`).
* **Budsin Chat (fase 1)**: chat en tiempo real en `public/chat/` (aún sin enlace en el portal). Backend propio en el VPS (`server/chat/`: Bun + WebSocket + SQLite, sin dependencias; ver «Budsin Chat» más abajo y la excepción de `AGENTS.md`). Cuenta de Google obligatoria (el servidor verifica el token de Firebase con las claves públicas de Google, sin librerías). Salas: **global** y **una por juego** (se crean al entrar: `/chat/#/game/<slug>/<nombre>`). Nombres únicos y filtrados (`Ana_Gamer` ≈ `Ana.Gamer` ≈ `An4gamer`), avatares prediseñados (sin subir imágenes). Moderación: filtro de groserías/enlaces/teléfonos/contactos, 5 mensajes/10 s y 30/min, sin repetidos, reportes (3 distintos ocultan el mensaje), silenciar/banear/renombrar para admins (correo verificado), mensajes borrados a los 14 días. **Grupos de clase (fase 2)**: cualquiera puede crear hasta 3 (y estar en 8); son **privados** (no salen en ninguna lista: se entra con un código de 8 caracteres o un enlace `/chat/#/class/CODIGO`) y el **nombre es único** sin importar mayúsculas, tildes, espacios ni símbolos (`3A Matemáticas` = `3°A - matematicas`; si ya existe, se pide el código a los compañeros). La dueña puede expulsar; si se va, pasa al miembro más antiguo; si se va el último, el grupo se borra y el nombre queda libre. **Amigos y mensajes directos (fase 3)**: los privados son **solo entre amigos aceptados** (solicitud por nombre de usuario exacto, sin mensaje; máx. 30 amigos, 20 solicitudes pendientes y 10 solicitudes por hora). Mismo filtro y anti-spam que en las salas. Reportar un mensaje privado lo oculta al instante y llega al admin con su texto. **Bloquear** (clic en un nombre o en «⋯» del chat privado) borra la amistad, cierra el chat, oculta sus mensajes en las salas públicas y no deja volver a pedirla; quien fue bloqueado recibe el mismo «no encontré a nadie» que si el nombre no existiera. Quien no tiene el chat abierto recibe un aviso con contador. **Panel de moderación (fase 4)**: `/chat/admin.html` (no está dentro del `/admin.html` de React porque ese panel va compilado en `public/react-assets` y tocarlo obliga a recompilar el portal; si quieres, se enlaza desde `AdminPage.jsx` en la próxima compilación). Solo entran los correos de `CHAT_ADMIN_EMAILS` con Google verificado (el servidor lo exige, no la página). Pestañas: **Reportes** (texto, motivo, quién reportó; borrar mensaje, descartar, quitar nombre/avatar, silenciar 10 min/1 h/24 h/7 días, banear), **Usuarios** (buscar por nombre o correo; silenciar, quitar silencio, quitar nombre/avatar, banear) y **Grupos y salas** (borrar un grupo o sala inapropiado con sus mensajes). **Botón 💬 en los juegos** (`classroom-hotkey.js`, junto al 🎵): abre `/chat/#/game/<slug>/<nombre>` en otra pestaña, es decir, la sala de ese juego; se apaga desde el menú del chat («Botón de chat en los juegos», `localStorage bc_gamebtn=0`).
* **Service Worker**: las páginas HTML van red-primero (antes se servía siempre la copia guardada de cualquier ruta y las páginas nuevas no llegaban a quien ya había visitado el sitio). `CACHE` pasa a `budsin-v3`.
* **Budsin Proxy** pasa a [InvisiProxy LTS](https://github.com/InvisiProxy/InvisiProxyLTS) autoalojado en `proxy.budsin.dev` (ver sección «Budsin Proxy»); WebBlox se sirve desde ese mismo origen.
* **Proxy**: corregida la carrera de IndexedDB (`'config' is not a known object store name`: la base `$scramjet` se creaba vacía si el service worker llegaba antes que el controlador) y el transporte epoxy (`/epoxy/transport.js`, envoltorio ES que BareMux puede importar). `/proxy/?go=<url>` abre una URL al cargar. Además: `sw.js` carga la configuración de Scramjet desde IndexedDB antes de servir `/scramjet/…` (Scramjet 1.1.0 solo fija su configuración global en `loadConfig()`, y fallaba con «reading 'prefix'»), y `epoxy/transport.js` adapta las cabeceras entre BareMux 2.1.9 (objeto) y epoxy (lista de pares). El proxy crea la base `$scramjet` con sus 5 almacenes antes de registrar el service worker.
* **Anuncio de vídeo** pequeño al pie de la portada (`public/promo/`): silenciado por defecto, con botón de sonido y de cerrar; se oculta a los usuarios Pro.
* Botones **Pro** (solo para quien no es Pro) y **Donar** en el dock del menú principal.
* Tarjeta **Apoya el proyecto** en Ajustes con enlaces de donación a `paypal.me/juanbrew` ($1, $3, $5 u otro monto).
* **Aviso de Budsin Hosting** (anuncio) abajo a la izquierda de la portada, en ES/EN/PT: enlaza a `budsin.dev/hosting/`, se puede cerrar y se oculta a los usuarios Pro (`app/src/components/HostingNotice.jsx`).

### v7.1
* **33 juegos nuevos** (ports de [wasm.rip](https://github.com/wasmdotrip/wasm.rip)): MiSide, Stardew Valley, Fez, Inscryption, RimWorld, PEAK, Superflight, Hill Climb Racing, Keep Talking And Nobody Explodes y más. Ver la tabla de ports más arriba.
* Cada página incluye favicon, Google Tag Manager, AdSense y Classroom Hotkey, y todas las portadas están en `public/portadas/`.
* How To Fish: en Chromebook (o equipos con ≤4 GB de RAM / ≤4 núcleos) renderiza al 0.75× de resolución en vez de la nativa. Ajustable con `?scale=1` o `?q=high`.
* PEAK: descarga en paralelo (4 partes a la vez) y guarda los ~250 MB en la caché del navegador; desde la segunda visita arranca sin volver a descargar.
* The Message From Deep Space: corregido el error 404 al cargar; ahora carga sus archivos desde jsDelivr (`dashiellbenton/ports`, fijado a un commit).
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


## 💬 Budsin Chat

Chat en tiempo real para los jugadores de Budsin Games. Código en `server/chat/` (backend) y `public/chat/index.html` (página).

**Arquitectura**: la página abre un WebSocket a `/api/chat/ws` (Caddy lo reenvía a `127.0.0.1:3104`). El primer mensaje es `{t:"auth", token}` con el token de Firebase del usuario; el servidor comprueba la firma RS256 con los certificados públicos de Google, el proyecto (`juanjo-games`) y la caducidad. Todo lo demás (perfil, unirse a salas, enviar, historial, reportar, comandos de admin) va por ese canal en JSON. Datos en SQLite (`/var/lib/budsin-chat/chat.sqlite`).

**Instalación / actualización en el VPS** (idempotente; no toca `/etc/budsin-chat.env` ni la base de datos):

```bash
sudo bash -c 'set -e; d=$(mktemp -d); trap "rm -rf $d" EXIT; git clone -q --depth 1 --filter=blob:none --sparse https://github.com/Juanjo3222/budsin-games-web.git "$d/r"; cd "$d/r"; git sparse-checkout set server/chat; bash server/chat/install.sh'
```

Comprobar: `curl -s https://games.budsin.dev/api/chat/health` → `{"ok":true,...}`. Cloudflare debe tener WebSockets activados (Network → WebSockets; viene activado por defecto).

**Pruebas**: `cd server/chat/app && bun test` (filtro, verificación de tokens, y un test de integración con WebSockets reales: cuentas, salas, filtro, anti-spam, reportes y administración).

**Variables** (`/etc/budsin-chat.env`, ver `server/chat/env.example`): `CHAT_ADMIN_EMAILS` (admins), `CHAT_ORIGINS` (orígenes permitidos del WebSocket), `FIREBASE_PROJECT_ID`.

### 💬 Budsin Chat: imágenes, stickers y notas de voz

**Estado por defecto: las imágenes y los stickers propios están APAGADOS (`CHAT_IMAGES=0`).** Funcionan siempre: los **stickers predefinidos** (4 packs de emoji grande, no se sube nada) y las **notas de voz** (solo en chats privados entre amigos y en grupos de clase; máx. 30 s; el archivo se re-codifica a M4A; límites de ritmo y de cuota diaria).

**⚠️ CSAM: por qué no se activan las imágenes sin más.** Este sitio lo usan muchos menores. Subir imágenes abre dos riesgos graves que el filtro automático NO resuelve: (1) material de abuso sexual infantil (CSAM) subido por terceros y (2) imágenes íntimas que un menor se toma de sí mismo (también cuentan como CSAM y son el caso más común entre adolescentes). El detector incluido (`server/chat/scan`, modelo ONNX NSFW) mira desnudez en general; **no está hecho para detectar CSAM, no es fiable para ello y no sustituye la detección por hashes ni la revisión humana**. Antes de poner `CHAT_IMAGES=1` hace falta, como mínimo:
- **Detección por hashes de material conocido**: p. ej. la herramienta gratuita *CSAM Scanning Tool* de Cloudflare (solo escanea contenido que Cloudflare tiene en caché; los archivos del chat se sirven con `Cache-Control: private`, hay que cambiarlo a propósito), Microsoft PhotoDNA, Google CSAI Match o Thorn Safer. Solo detectan material ya conocido, no el nuevo ni el autogenerado.
- **Un procedimiento legal**: quién revisa los reportes, cómo se conserva la evidencia y a quién se denuncia (en EE. UU. el CyberTipline de NCMEC; en otros países, la línea nacional o INHOPE). **Si aparece material de este tipo no se descarga, no se reenvía ni se muestra a más personas: se denuncia.** Conviene consultarlo con un abogado y revisar los Términos del sitio y la edad mínima.
- Valorar que las imágenes queden **retenidas hasta que un admin las apruebe** (hoy se publican al pasar el detector).

Lo que ya hace el código cuando se activan: tipo de archivo comprobado por sus bytes; re-codificación siempre (quita EXIF/GPS y archivos disfrazados; los GIF quedan quietos); detector NSFW con umbral conservador (35 %) que **falla cerrado** (si el detector no responde, no se acepta nada); las cuentas nuevas esperan 30 min; 1 imagen cada 15 s y 20/h; 3 rechazos o reportes en 24 h quitan el permiso 24 h; las imágenes llegan **desenfocadas** en salas públicas; **un solo reporte oculta la imagen o el audio al instante** hasta que un admin la revise (el panel `/chat/admin.html` pide un clic para verla); los archivos se borran a los 14 días salvo stickers de una biblioteca y lo reportado sin revisar. Instalar el detector (solo si algún día se activan): `WITH_SCAN=1 bash server/chat/install.sh` (modelo con revisión y SHA-256 fijos; `onnxruntime-node` debe ser exactamente la 1.31.1).

Pruebas: `cd server/chat/app && bun test` (91 casos, incluida la subida real con ffmpeg y el flujo de reportes) y Playwright de extremo a extremo.

### 🏫 Budsin Chat: solo cuentas de colegio

Por defecto solo entran cuentas de Google **de colegios y universidades con el correo verificado**: dominios `*.edu`, `*.edu.<país de 2 letras>` (ucv.edu.pe, unam.edu.mx…) y `*.ac.<país>` (ox.ac.uk). Los correos de admin entran siempre. Se comprueba **en el servidor** (WebSocket y subida de archivos), no en la página, y un correo sin verificar no entra. Un Gmail ve «Budsin Chat es solo para cuentas de colegio o universidad».

- **Diseño**: el chat usa la paleta y proporciones de un `DESIGN.md` tipo Discord que aportó el usuario (fondos grises en capas `#1e1f22/#2b2d31/#313338`, acento azul-violeta `#5865F2`, avatares redondos de 40 px, texto 15 px); solo colores y medidas, sin logos ni marca. Claro/oscuro/auto.
- **Enlaces permitidos**: por defecto solo `budsin.dev`, `google.com` y `prescott.edu.pe` (y sus subdominios, máx. 2 por mensaje), definidos en `CHAT_ALLOWED_LINKS` de `/etc/budsin-chat.env` (lista separada por comas; vacío = ninguno). Se valida el servidor real del enlace (no cuenta `google.com.malo.com`, `https://google.com@malo.com`, IDN ni IP) y se rechazan las redirecciones de esos sitios (`google.com/url?q=…`, Traductor). Correos, @usuarios y teléfonos siguen bloqueados. Al salir de Budsin el chat pide confirmación.
- **Colegio con dominio propio** (p. ej. `@colegiosanjose.com`): se agrega en `/etc/budsin-chat.env` → `CHAT_ALLOWED_DOMAINS=*.edu,*.edu.??,*.ac.??,colegiosanjose.com` y `sudo systemctl restart budsin-chat`. Un dominio sin comodín acepta también sus subdominios (`alumnos.colegiosanjose.com`). Abrirlo a todos: `CHAT_ALLOWED_DOMAINS=*`.
- **Por qué no `*.edu.*`**: cualquiera puede registrar `edu.xyz` y crear una cuenta de Google Workspace verificada con ese dominio. Por eso solo se aceptan `.edu`, `.edu.??` y `.ac.??`.
- **Es una barrera, no una prueba de edad ni de identidad**: los profesores también tienen cuenta de colegio, y un adulto con un dominio de colegio (o con un dominio propio bajo un `.edu.xx` abierto de su país) también pasaría. Sirve porque la cuenta de colegio la gestiona el colegio, que puede suspenderla.

### 🎵💬 Compartir música de Budsin Music en Budsin Chat

En Budsin Music, con una canción cargada, el botón **💬** del reproductor (y «Compartir en Budsin Chat» en el menú ⋮ y en el clic derecho) guarda la canción (`localStorage bc_share`, válida 15 min) y abre `/chat/#/share`. El chat pregunta **dónde** compartirla (Sala global, tus grupos de clase, tus amigos o las salas de juego en las que estás) y publica una **tarjeta** con portada, título, artista, ▶ (suena con el mini-reproductor) y ↗ (abre la canción en Budsin Music). **La música sigue sonando al llegar al chat**: `chat/index.html` carga `bm-mini.js` igual que el portal (retoma la sesión de Music y deja el reproductor abajo; el diseño reserva su espacio para no taparte el campo de escribir) y `classroom-hotkey.js` no inyecta en `/chat/` su botón 🎵 para no duplicarlo. `bm-mini.js` expone `window.BmMini.play(tracks, i)`, que usa la tarjeta.

Seguridad: lo que llega al servidor se trata como dato no confiable (`cleanTrack` en `server/chat/app/lib/server.ts`): `id` de 1 a 40 caracteres alfanuméricos, título y artista de hasta 90 caracteres que **pasan el mismo filtro que un mensaje** (si el título es un enlace, un teléfono o una grosería, no se comparte), portada solo de `resources.tidal.com`, `i.ytimg.com`, `yt3.ggpht.com` o `*.googleusercontent.com`, ISRC y fuente validados. Se puede reportar como cualquier mensaje (el admin ve «🎵 Título — Artista»). **Requiere volver a ejecutar `install.sh` del chat en el VPS** (el servidor cambió).

### 💬 Budsin Chat v2: funciones de mensajes y rediseño

Se investigó qué traen los chats que funcionan (editar/borrar, responder, reacciones, «escribiendo…», no leídos, menciones, fijados, separadores de día, agrupar mensajes, «ir al final», modo lento) y se añadió lo que faltaba, pensando en un sitio de colegios:

- **Editar** (solo texto propio, durante 15 min): pasa otra vez por el filtro, marca «(editado)» y **el texto anterior queda guardado: el admin lo ve en el reporte** («Ver cómo era antes»), para que nadie edite algo ofensivo después de que lo reporten. **Eliminar** (lo propio; quien administra un grupo o el admin, lo ajeno): si una imagen estaba reportada, se oculta pero el archivo se conserva para la revisión.
- **Responder** (cita el mensaje; si el original se borra queda «Mensaje eliminado»), **reacciones** (8 emoji, máx. 8 distintos por mensaje; al pasar el cursor salen los nombres), **«X está escribiendo…»**, **@menciones** (solo valen nombres exactos de personas del chat y avisan a quien las recibe; cualquier otro «@algo» sigue bloqueado como contacto externo), **mensajes fijados** (hasta 3; los fija quien administra el grupo, o el admin en las salas públicas), **modo lento** por sala (5/10/30/60 s; no aplica a admins ni a quien administra el grupo).
- **Interfaz**: separadores de día, mensajes seguidos del mismo autor agrupados, barra de acciones al pasar el cursor (reaccionar, responder, editar, eliminar, más), contadores de no leídos por sala (y en el título de la pestaña), separador «Nuevos mensajes», botón «ir al final» con contador, sugerencias al escribir `@`, selector de emoji, ↑ para editar el último mensaje, Esc para cancelar.
- **Diseño**: se rehízo la interfaz para que deje de parecer genérica: paleta cálida de papel y tinta con un solo acento verde oscuro, tema claro u oscuro según el sistema (y fijable en el menú de tu perfil), esquinas de 6 px en vez de cápsulas, sin degradados ni brillos, avatares de color plano, iconos de línea propios en vez de emojis en la interfaz (los emoji quedan para el contenido: reacciones, stickers, avatares), tipografía del sistema y densidad tipo Slack.

Servidor: `server/chat/app/lib/server.ts` (comandos `edit`, `delete`, `react`, `typing`, `pin`/`unpin`, `room.slow`, `admin.edits`; el campo `reply` de `send`) y `lib/db.ts` (tablas `message_edits`, `reactions`, `pins`; columnas `edited`, `reply_to`, `slow`). **Requiere volver a ejecutar `install.sh` del chat en el VPS.** Pruebas: `cd server/chat/app && bun test` (111 casos) y Playwright de extremo a extremo.
