# 🤖 Configuración de Agentes: Budsin Games (v6.0)

Este archivo centraliza la lógica de desarrollo de `budsin-games.pages.dev`. Es el manual de identidad y comportamiento para las IAs en Zed Pro.

---

## 🏗️ Agente: Arquitecto de Integración (public/)
**Rol**: Especialista en Despliegue y Estructura Plana.
**Objetivo**: Integrar juegos externos en subcarpetas dentro de `public/`.
**Trasfondo**: Aseguras que cada juego sea autónomo. Revisas el `README.md` antes de mover cualquier archivo para no romper la lógica del sitio.

## 🗂️ Agente: Gestor del Index y Telemetría
**Rol**: Desarrollador Frontend y Captura de Clics.
**Objetivo**: Actualizar el `public/index.html` y registrar jugadores activos en Firebase.
**Trasfondo**: Inyectas el código necesario para que cada clic en un juego sea contabilizado. Mantienes el **CHANGELOG** del index sincronizado con el del README.

## 🔥 Agente: Especialista en Firebase (Métricas)
**Rol**: Analista de Impactos.
**Objetivo**: Contar clics de forma atómica sin gestionar datos privados ni sesiones de usuario.
**Trasfondo**: Implementas solo funciones de incremento de contadores. No usas Auth ni bases de datos complejas.

## 📝 Agente: Cronista y Documentador
**Rol**: Guardián del README y el Historial.
**Objetivo**: Sincronizar cambios en `README.md` y la sección de novedades del `index.html`.
**Trasfondo**: Eres extremadamente meticuloso. Si algo cambia en el código, debe quedar reflejado en ambos lugares con la misma información.

---

## 📜 Reglas de Oro y Protocolos Críticos

1. **Prioridad del README**: El `README.md` es el manual maestro. Se debe revisar siempre junto a este archivo.
2. **Ubicación del CHANGELOG**: Duplicado obligatorio en `public/index.html` y `README.md`.
3. **Estructura Plana**: Todo juego vive en `public/[nombre-del-juego]`. No usar la carpeta `/games`.
4. **Firebase Minimalista**: Solo para conteo de impactos. Prohibido crear sistemas de Login/Auth por defecto.

5. **Assets obligatorios en TODA página HTML**: Cualquier `.html` dentro de `public/` **debe incluir** en su `<head>` (lo más alto posible, tras `<meta charset>`):
   - Favicon: `<link rel="icon" type="image/jpeg" href="https://budsin-games.pages.dev/images.jpeg">`
   - Google Tag Manager: 
     ```html
     <!-- Google Tag Manager -->
     <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
     new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
     j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
     'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
     })(window,document,'script','dataLayer','GTM-5ZT26944');</script>
     <!-- End Google Tag Manager -->
     ```
   - Google AdSense:
     ```html
     <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2866089236522641" crossorigin="anonymous"></script>
     ```
   - Inmediatamente después de `<body>`:
     ```html
     <!-- Google Tag Manager (noscript) -->
     <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5ZT26944"
     height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
     <!-- End Google Tag Manager (noscript) -->
     ```
   - Script Classroom Hotkey: `<script src="https://budsin-games.pages.dev/classroom-hotkey.js"></script>` (justo antes de `</body>`)
   - Sin excepción. Aplica a **cualquier** `.html` dentro de `public/`.

6. **Traducciones obligatorias al añadir un juego**: Cada vez que se añada una nueva tarjeta de juego al `index.html`, se deben completar **los 3 idiomas** sin excepción:
   - **HTML** (`<a class="game-card">`): atributos `data-desc-es="..."` y `data-desc-en="..."` en el `<p>` de descripción; `data-label-es="Disponible" data-label-en="Available"` en el `<span>` de estado; `data-es="..."` y `data-en="..."` en el `<span class="category-tag">`.
   - **JS** (`PT_DESCRIPTIONS`): añadir entrada `"nombre del juego (en minúsculas, igual que data-name)": "Descripción en portugués."` al objeto `PT_DESCRIPTIONS` del script principal.
   - **JS** (`PT_CATEGORIES`): verificar que la categoría del juego ya existe en `PT_CATEGORIES`. Si es nueva, añadirla.
   - Un juego sin las 3 traducciones completas se considera **incompleto** y no debe commitearse.

### ⚠️ Protocolo de Anulación (Override)
5. **Cumplimiento Estricto**: La IA **nunca** debe ignorar las prohibiciones de este archivo (ej. no crear carpetas fuera de `public` o no usar Auth) por iniciativa propia o por ambigüedad del usuario.
7. **Excepción Explícita**: Si el usuario solicita algo prohibido por este `agents.md`, la IA debe advertir de la contradicción. Solo podrá proceder e ignorar la regla si el usuario da una **instrucción explícita** para ignorar el `agents.md` o anular la regla específica en ese turno de chat. Sin esa orden directa, el `agents.md` es inamovible.

---

## 🗺️ Backlog de Funcionalidades Pendientes

Estas funcionalidades fueron **aprobadas por el usuario** y deben implementarse en orden de prioridad. Marcar como `[x]` cuando estén completas.

### 🔴 Alta prioridad
- [x] **Badge "Nuevo"** (`data-new="true"`): Inyectar via JS un `<span class="new-badge">Nuevo</span>` en las tarjetas con `data-new="true"`. Estilo: píldora verde-azul, esquina inferior-izquierda de la portada. Sin Firebase.

### 🟢 Implementado
- [x] **Budsin Pro (Firebase Auth)**: Sistema de suscripción manual con Firebase Auth + Firestore. El admin gestiona usuarios Pro desde `/admin.html`. Los usuarios inician sesión en Settings. Features Pro: sin anuncios, badge "⭐ PRO" en el portal.

---

## ⭐ Budsin Pro VS Gratis — Lo que toda IA debe saber

### 💰 Precio y suscripción
- **$2.99 USD / S/ 7 PEN por mes** (cuota mensual).
- El admin marca "Pagado este mes" desde `/admin.html` → extiende `paidUntil` 35 días.
- Si el admin no marca pago en todo el mes, el Pro se auto-revoca a los 35 días.

### 🔥 Diferencias Free vs Pro

| Característica | Free | Pro |
|---|---|---|
| Anuncios | ✅ Se muestran | ❌ Ocultos |
| Favoritos | Máximo 20 juegos | Ilimitados |
| Tema Gold (Dark+Oro) | ❌ No disponible | ✅ Exclusivo |
| Badge ⭐ PRO | ❌ No | ✅ Visible en portal |
| Estadísticas (juegos jugados, favoritos) | ❌ No | ✅ En Settings |
| Acceso anticipado a juegos nuevos | ❌ No | ✅ Prioridad |
| Badge "Anticipado para Pro" | ✅ Se muestra en tarjetas marcadas | ❌ Oculto |

### 📁 Archivos clave del sistema Pro

- **`public/index.html`**: Contiene la lógica principal (Firebase Auth, `applyProFeatures()`, badges, tema, favoritos, polling cada 5 min, verificación al volver a la pestaña).
- **`public/settings.html`**: Login con Google, muestra estado Pro, fecha de renovación, estadísticas, selector de tema Pro.
- **`public/admin.html`**: Panel admin para gestionar usuarios. Botones "Hacer Pro", "✅ Pagar este mes", "Revocar Pro". Muestra columna "Pagado hasta" con fecha.
- **`AGENTS.md`**: Este archivo.
- **`README.md`**: Changelog duplicado.

### 🔐 Firebase

- **Auth**: Solo Google Sign-In (sin email/password para usuarios).
- **Firestore collection `users`**: Cada documento tiene `uid → { email, pro, proSince, paidUntil, createdAt }`.
- **Admin emails hardcodeados**: `juvaldiviam@gmail.com`, `juanjoseguravegamail@gmail.com`.
- `paidUntil` es un `Timestamp` de Firestore. Si `paidUntil < now`, el Pro se auto-revoca.

### 🧠 Lógica de verificación en cliente

1. **Al cargar la página**: `localStorage` cachea `budsin_pro_active` (0/1) para respuesta inmediata.
2. **Firebase Auth** se inicializa con `initializeApp()` en `index.html` y `settings.html`.
3. **`onAuthStateChanged`** detecta sesión activa y consulta Firestore (`users/{uid}`).
4. **Polling** cada 5 minutos re-consulta Firestore (`setInterval(300000)`).
5. **`visibilitychange`** re-consulta al volver a la pestaña.
6. **Auto-revocación**: Si `paidUntil` expiró, se setea `pro: false` en Firestore y se truncan favoritos a 20.

### 🎨 Tema Pro (Gold + Dark)
- CSS en `index.html` (línea ~1631) y `settings.html` (línea ~702).
- Sobrescribe variables CSS (`--bg`, `--text`, `--muted`, `--surface`, etc.) en `html[data-site-theme="pro"]`.
- Selector de tema en Settings, oculto para no-Pro.
- Traducción: `themePro: "⭐ Pro (Gold)"` en ES/EN/PT.

### 🏷️ Tarjetas de juego `data-pro="true"`
- Cualquier `<a class="game-card">` con `data-pro="true"` muestra un badge "Anticipado para Pro" (solo visible para usuarios Free).
- Si el usuario es Pro, el badge no se inyecta.
- El badge tiene clase `.pro-badge` (píldora dorada, esquina inferior-derecha de la portada).

### 🚫 Límite de favoritos
- Free: máx 20. Al llegar al límite, toast rojo con mensaje traducido.
- Pro: sin límite.
- Al perder Pro, los favoritos se truncan a 20 automáticamente.
- Los favoritos se muestran en grid visual con covers (como "Jugado recientemente").

### 🗓️ Renovación y alertas
- En Settings (logueado Pro): muestra "🔄 Renovación: [fecha] (X días)".
- Si faltan ≤1 día o han pasado hasta 5 días: muestra ⚠️ roja.

---

## 🚪 Pro-Gating: Cómo añadir un juego exclusivo Pro

Cuando añadas un juego que será **exclusivo para usuarios Pro** (o anticipado), sigue estas reglas:

### 1. Marcar la tarjeta en `index.html`
- Añadir `data-pro="true"` al `<a class="game-card">`.
- Añadir `data-pro-release="AAAA-MM-DD"` con la fecha en que estará disponible para todos.
- Si el juego ya existe y lo haces Pro, cambiar `data-label-es`/`data-label-en` a "Pro" / "Available May 22".
- El badge "Anticipado para Pro: próximamente gratis" se inyecta automáticamente vía JS para usuarios Free.

### 2. Gating al hacer clic (en `index.html`)
- Si un usuario **Free** hace clic en una tarjeta `data-pro="true"`:
  1. Se cuenta el clic en Firebase (`incrementRemotePopularity`) igual que siempre.
  2. Se compara `data-pro-release` con la fecha actual. Si ya pasó esa fecha → el juego se libera y se navega normal (sin popup).
  3. Si la fecha de liberación aún no llega → se muestra un **popup** (modal) con:
     - "🔒 Juego exclusivo para Budsin Pro"
     - Lista de ventajas Pro (sin anuncios, tema Gold, favoritos ilimitados, acceso anticipado, estadísticas).
     - Precio: "$2.99 USD / S/ 7 PEN por mes".
     - Botón "⭐ Quiero ser Pro" que enlaza a `settings.html#proCard`.
     - Botón "Cerrar" (circular).
     - Texto: "🎉 Será gratis para todos el [fecha]".
- Si el usuario es **Pro** → navega normal al juego.

### 3. Gating en la página del juego (`.html` dentro de `public/`)
- El HTML del juego debe incluir al inicio del `<body>` un script que:
  1. Lee `localStorage.getItem("budsin_pro_active")`.
  2. Compara `data-pro-release` con la fecha actual: `new Date() >= new Date(releaseDate)`.
  3. Si es Pro O la fecha de liberación ya pasó → muestra el juego normalmente (overlay oculto).
  4. Si NO es Pro y la fecha aún no llega → muestra un overlay fullscreen con:
     - Misma info que el popup del portal.
     - El juego NO debe ser accesible (oculto tras overlay).
     - Botón cerrar circular.
     - Texto: "🎉 Será gratis para todos el [fecha]".
- También debe contar el clic en Firebase al cargarse.

### 4. Firebase en páginas de juego
- Inicializar Firebase en la página del juego (misma config que `index.html`).
- Llamar a `incrementRemotePopularity(href, gameName, 1)` para contar el acceso.

### 5. Traducciones
- Las tarjetas Pro siguen las mismas reglas de traducción (ES/EN/PT en HTML y JS).
- El popup de gating no necesita traducción (usar español por ahora).

### 6. Assets obligatorios
- La página del juego **debe** incluir todos los assets de la Regla de Oro #5 (favicon, GTM, AdSense, classroom-hotkey).
- La portada del juego debe estar en `public/portadas/[nombre].webp`.
- **⚠️ URL absoluta para enlaces Pro**: Si la página tiene `<base>` tag (ej. CDN), los enlaces como `/settings.html#proCard` NO funcionan porque resuelven contra el origen del base. Usar URL absoluta: `https://budsin-games.pages.dev/settings.html#proCard`.
- **⚠️ Font-family**: El overlay del gating debe incluir `font-family: system-ui, -apple-system, sans-serif` para que herede la tipografía del portal.

---

*Última actualización: 20 de mayo de 2026*
