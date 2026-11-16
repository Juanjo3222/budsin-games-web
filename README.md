# 🎮 Budsin Games - osi

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-brightgreen" />
  <img src="https://img.shields.io/badge/Games-87-blue" />
  <img src="https://img.shields.io/badge/Frontend-React-orange" />
  <img src="https://img.shields.io/badge/Version-7.2-purple" />
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
Los **gustos** son un resumen agregado por artista y género con decaimiento (vida media de 21 días), **no** un historial canción por canción. Las canciones ya escuchadas y las saltadas no salen del navegador.

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

### v7.2
* **Pagos con PayPal**: suscripción Pro de $2.99 USD/mes desde Ajustes, con servicio propio en el VPS (`server/paypal/`). Se puede cancelar desde el sitio y el Pro sigue hasta el fin del periodo pagado. Ver la sección «Pagos con PayPal».
* El Service Worker ya no cachea las rutas `/api/`.
* **WebBlox** (`public/webblox/`): Roblox en el navegador con el cliente web oficial. Ver la sección «WebBlox».
* **Budsin Music** (`public/musica/`): buscador y reproductor de música. Backend propio en el VPS (`server/music/`, basado en [x8rr/music](https://github.com/x8rr/music), AGPL-3.0, con un parche para escuchar solo en `127.0.0.1`), detrás de Caddy en `/api/music/*`. El audio sale de YouTube Music vía yt-dlp y la búsqueda de Tidal. Tarjeta nueva en el portal (ES/EN/PT) y enlace al código fuente en la propia página.
* **Budsin Music, segunda tanda**: rediseño tipo streaming (catálogo por género, álbum/artista/similares, playlists, ♥, cola); **visualizador** de audio (6 modos, 4 paletas y una personalizable); **letras sincronizadas** desde LRCLIB a través del backend (`/api/music/lyrics`), con ajuste de sincronía y selector de versión; **mini-reproductor en el portal** (`public/bm-mini.js`) que sigue sonando al ir a Budsin Games o desde otra pestaña; **recomendaciones «Para ti», radio y autoplay** calculadas en el navegador; **portadas de playlist editables** (mosaico por defecto; la de una canción, una imagen propia recortada a cuadrado y ligera, o color y emoji; se sincronizan con la cuenta); **álbumes guardados** en la biblioteca (el + de cada portada o «Guardar álbum»); fotos de artista con respaldo (búsqueda, o inicial sobre degradado); y **cuentas**: inicio de sesión con Google (misma cuenta y sesión que Budsin Games) con sincronización en Firestore. Ver «Cuentas en Budsin Music».
* **Budsin Music, «Tus gustos»** (`#/taste`): pantalla de transparencia del algoritmo. Muestra qué artistas y géneros pesan, lo que sueles saltar, la actividad reciente con el porqué de cada punto (escuchada entera, saltada, ♥…) y las reglas de decisión; permite «Olvidar» un artista. Las tarjetas de «Para ti» explican su motivo al pasar el cursor. La actividad reciente (`log`), `seen` y `skips` se quedan en el navegador: a la nube solo viajan artistas y géneros agregados.
* **Budsin Music, enlaces de Spotify y YouTube**: pegar un enlace en el buscador (canción o álbum de Spotify, vídeo de YouTube / YouTube Music) lo convierte en una búsqueda por «artista título». Lo resuelve el backend (`/api/music/resolve`, `lib/resolveLink.ts`): solo lee título y artista públicos, solo de una lista fija de hosts (sin SSRF) y no reproduce nada de allí. Requiere `sudo bash server/music/install.sh` en el VPS.
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
