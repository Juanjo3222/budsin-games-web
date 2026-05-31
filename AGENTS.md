# 🤖 Configuración de Agentes: Budsin Games (v6.0)

Este archivo centraliza la lógica de desarrollo de `games.budsin.dev`. Es el manual de identidad y comportamiento para las IAs en Zed Pro.

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
   - Favicon: `<link rel="icon" type="image/jpeg" href="https://games.budsin.dev/images.jpeg">`
   - Google Tag Manager: 
     ```html
     <!-- Google Tag Manager -->
     <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
     new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
     j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
     'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
     })(window,document,'script','dataLayer','GTM-WKVW2STJ');</script>
     <!-- End Google Tag Manager -->
     ```
   - Google AdSense:
     ```html
     <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2866089236522641" crossorigin="anonymous"></script>
     ```
   - Inmediatamente después de `<body>`:
     ```html
     <!-- Google Tag Manager (noscript) -->
     <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-WKVW2STJ"
     height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
     <!-- End Google Tag Manager (noscript) -->
     ```
    - Script Classroom Hotkey: `<script src="https://games.budsin.dev/classroom-hotkey.js"></script>` (justo antes de `</body>`)
    - Script Save System (solo si el juego soporta guardado auto): `<script src="https://games.budsin.dev/save-system.js"></script>` (justo antes de `</body>`, después de classroom-hotkey)
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
| Modo offline (SW Cache) | ❌ No disponible | ✅ Sitio completo offline |
| Leaderboards globales | ❌ Solo ver | ✅ Enviar puntuaciones |
| Perfil personalizado (avatar, bio) | ❌ No | ✅ Sí |
| Tema personalizado (colores) | ❌ No | ✅ Sí |
| Modo Focus (sin distracciones) | ❌ No | ✅ Sí |
| Solicitar juegos nuevos | ❌ No | ✅ Prioridad |
| Exportar datos (JSON) | ❌ No | ✅ Sí |
| Compartir colecciones | ❌ No | ✅ Link público |
| Logros/achievements | ✅ Básico | ✅ Completo |
| Estadísticas avanzadas | ❌ No | ✅ Sesiones, streaks, calendario |
| Guardado en nube | Máximo 5 juegos | Ilimitado |

### 📁 Archivos clave del sistema Pro

- **`public/index.html`**: Contiene la lógica principal (Firebase Auth, `applyProFeatures()`, badges, tema, favoritos, polling cada 5 min, verificación al volver a la pestaña, leaderboards, logros, modo Focus, share collections, online status).
- **`public/settings.html`**: Login con Google, muestra estado Pro, fecha de renovación, estadísticas, selector de tema Pro, perfil personalizado, estadísticas avanzadas, game requests, my saves, export data, logros, tema personalizado.
- **`public/admin.html`**: Panel admin para gestionar usuarios. Botones "Hacer Pro", "✅ Pagar este mes", "Revocar Pro". Muestra columna "Pagado hasta" con fecha. Incluye gestión de solicitudes de juegos.
- **`public/sw.js`**: Service Worker con soporte offline para Pro. Cachea juegos visitados y activos estáticos.
- **`public/site-theme.js`**: Maneja temas (light, dark, ps5, custom). El tema "custom" permite colores personalizados para Pro.
- **`public/game-save.js`**: Wrapper GameSave para guardado en nube con detección automática Unity/localStorage.
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
- El popup de gating y el overlay del juego también se traducen (claves `proGating*` en el objeto `I18N` del `index.html`).

### 6. Assets obligatorios
- La página del juego **debe** incluir todos los assets de la Regla de Oro #5 (favicon, GTM, AdSense, classroom-hotkey).
- La portada del juego debe estar en `public/portadas/[nombre].webp`.
- **⚠️ URL absoluta para enlaces Pro**: Si la página tiene `<base>` tag (ej. CDN), los enlaces como `/settings.html#proCard` NO funcionan porque resuelven contra el origen del base. Usar URL absoluta: `https://games.budsin.dev/settings.html#proCard`.
- **⚠️ Font-family**: El overlay del gating debe incluir `font-family: system-ui, -apple-system, sans-serif` para que herede la tipografía del portal.

---

## 💾 Guardado Auto en la Nube (Save System)

### 🎯 Propósito
Guardado automático en Firestore del progreso de los juegos. Cada 5 minutos se guarda el estado del juego. Disponible para usuarios logueados con Google.

### 🔥 Diferencias Free vs Pro

| Característica | Free | Pro |
|---|---|---|
| Juegos con save | Máximo 5 juegos | Ilimitados |
| Frecuencia auto-save | Cada 5 min | Cada 5 min |
| Almacenamiento | Firestore (nube) | Firestore (nube) |

### 📁 Archivo clave
- **`public/save-system.js`**: Script compartido que provee la API `window.BudsinSave`.

### 🧠 API de `window.BudsinSave`

| Método | Descripción |
|---|---|
| `init()` | Inicializa Firebase y el sistema de guardado. Retorna Promise. |
| `saveNow(gameName, data)` | Guarda datos del juego. Retorna Promise. Rechaza con `"LIMIT_REACHED"` si Free y ya tiene 5. |
| `load(gameName)` | Carga datos guardados. Retorna Promise con los datos o `null`. |
| `getInfo(gameName)` | Obtiene metadatos: `{ exists, updatedAt, gameName }`. |
| `remove(gameName)` | Elimina el save de un juego. |
| `autoSave(gameName, getDataFn)` | Inicia auto-guardado cada 5 min. `getDataFn` debe retornar el estado del juego. |
| `stopAutoSave(gameName)` | Detiene auto-guardado para un juego. |
| `canSaveNewGame()` | Retorna Promise con `{ allowed, count, limit, reason? }`. |

### 🔥 Firestore collection `gamesaves`
- Documento: `{userId}_{gameName}` (ej. `abc123_pacman`).
- Campos: `userId`, `gameName`, `data` (string JSON), `updatedAt` (Timestamp).
- La seguridad se maneja con reglas que verifican `request.auth.uid` y que el doc ID contenga el UID.

### 📝 Cómo integrar en un juego HTML (opción 1: BudsinSave bajo nivel)
1. Incluir `save-system.js` antes de `</body>` (después de classroom-hotkey).
2. En el script del juego:
   ```javascript
   // Inicializar
   BudsinSave.init();

   // Cargar datos al iniciar
   BudsinSave.load("nombre-del-juego").then(function(data) {
       if (data) restaurarEstado(data);
   });

   // Auto-guardar cada 5 minutos
   BudsinSave.autoSave("nombre-del-juego", function() {
       return obtenerEstadoActual();
   });
   ```

### 📁 Archivos clave para GameSave
- **`public/game-save.js`**: Wrapper de alto nivel con clases `GameSave` e `IDBGameSave`.

### 🎮 GameSave (para juegos HTML/localStorage)
**Uso para juegos tradicionales (HTML + JavaScript con estado en memoria)**

```javascript
// Inicializar y cargar estado guardado
var gameSave = new GameSave("mi-juego");
gameSave.init().then(function() {
    var state = gameSave.getState();  // Devuelve una copia
    console.log("Estado cargado:", state);
});

// Actualizar estado
gameSave.setState({ score: 100, level: 5 });
gameSave.mergeState({ lives: 3 });  // Fusionar parcialmente

// Guardar ahora
gameSave.saveNow().then(function() {
    console.log("Guardado!");
}).catch(function(err) {
    console.log("Error:", err);  // "LIMIT_REACHED" si Free con 5 juegos
});

// Auto-guardar cada 5 minutos (recomendado)
gameSave.startAutoSave();  // Luego en cada evento del juego, actualizar state
gameSave.stopAutoSave();   // Detener cuando salga del juego

// Obtener metadatos
gameSave.getInfo().then(function(info) {
    console.log("Existe:", info.exists, "Actualizado:", info.updatedAt);
});

// Eliminar guardado
gameSave.delete();
```

**Fallback**: Si Firebase no está disponible, `GameSave` guarda en `localStorage` (clave: `game_mi-juego`).

### 🕹️ IDBGameSave (para juegos Unity / IndexedDB)
**Uso para juegos complejos con múltiples stores IndexedDB**

**⚠️ CRITICAL: Restore BEFORE Unity boots!**

```javascript
// HTML: Include Firebase first
// <script src="https://www.gstatic.com/firebasejs/9/firebase-app.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9/firebase-auth.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9/firebase-firestore.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9/firebase-storage.js"></script>
// <script src="https://games.budsin.dev/save-system.js"></script>
// <script src="https://games.budsin.dev/game-save.js"></script>

// ANTES de createUnityInstance(): Initialize save and restore IDB
var gameSave = new GameSave("nombre-del-juego-unity");
gameSave.init().then(function(snapshot) {
    console.log("✅ IDB restaurada desde cloud:", snapshot);
    
    // Ahora es seguro crear la instancia Unity
    // IDB ya contiene los datos guardados
    createUnityInstance(container, config, onProgress).then(function(unityInstance) {
        console.log("✅ Unity iniciado con IDB restaurada");
        
        // Inicia auto-guardado cada 5 minutos
        gameSave.startAutoSave();
    }).catch(function(err) {
        console.error("❌ Error iniciando Unity:", err);
    });
}).catch(function(err) {
    console.warn("⚠️ No se pudo restaurar IDB, iniciando Unity con datos locales:", err);
    
    // Fallback: Inicia Unity de todas formas
    createUnityInstance(container, config, onProgress).then(function(unityInstance) {
        gameSave.startAutoSave();  // Guardará desde aquí en adelante
    });
});
```

**Auto-detección**: GameSave detecta automáticamente si el juego usa Unity/IDB escaneando `indexedDB.databases()`. Si encuentra una BD con el nombre del juego (normalizado), activa el modo IDB.

**Métodos en modo Unity**:

```javascript
// Obtener snapshot actual de todas las stores
var snap = gameSave.getSnapshot();  // Devuelve { "dbName": { version, stores: {...} } }

// Guardar manualmente snapshot actual
gameSave.saveNow().then(function() {
    console.log("✅ IDB guardada a Firestore/Storage");
}).catch(function(err) {
    console.log("❌ Error:", err);  // "LIMIT_REACHED" si Free con 5 juegos
});

// Auto-guardar cada 5 minutos (recomendado)
gameSave.startAutoSave();
gameSave.stopAutoSave();

// Metadatos
gameSave.getInfo().then(function(info) {
    console.log("Game type:", info.gameType);  // "unity" o "localstorage"
    console.log("Last updated:", info.updatedAt);
});

// Eliminar guardado
gameSave.delete();
```

**Estructura del snapshot IDB**: 
```
{
  "dbName1": {
    "version": 1,
    "stores": {
      "storeName1": [
        { "key": "key1", "value": {...} },
        { "key": "key2", "value": {...} }
      ]
    }
  }
}
```

### 🔄 Auto-detección de tipo de juego
`GameSave` detecta automáticamente si un juego es localStorage o Unity/IDB:

1. Al llamar `gameSave.init()`, escanea `indexedDB.databases()`.
2. Si encuentra una BD cuyo nombre contiene el nombre del juego (normalizado, sin caracteres especiales), activa modo IDB.
3. Si no encuentra coincidencias, usa modo localStorage.
4. El tipo se almacena en `gameSave.gameType` ("localstorage" o "unity").

### 💾 Almacenamiento en Firebase Storage (para grandes snapshots)
Los snapshots grandes (>900KB) se guardan en **Firebase Storage** en lugar de Firestore (que tiene límite de 1MB):

- **Pequeños** (<900KB): Se guardan directamente en Firestore documento `gamesaves/{uid}_{gameName}`.
- **Grandes** (≥900KB): Se cargan a Storage en `gamesaves/{uid}_{gameName}/idb-snapshot.json`. Firestore solo almacena la referencia (`storagePath`).
- Al descargar, `loadIDB()` detecta automáticamente si está en Storage o Firestore y recupera desde el origen correcto.

**Requisito**: Firebase Storage debe estar habilitado en el proyecto Firebase (`juanjo-games`).

### 🚫 Límite Free: 5 juegos
- Se cuentan documentos en `gamesaves` donde `userId == uid`.
- Al intentar guardar un juego NUEVO (sin save previo) siendo Free con 5 juegos → `saveNow()` / `saveIDB()` rechaza con `"LIMIT_REACHED"`.
- El auto-save se detiene automáticamente al recibir este error.
- Pro: sin límite.

### 🔥 Métodos adicionales de `window.BudsinSave` para Unity
| Método | Descripción |
|---|---|
| `saveIDB(gameName, snapshot)` | Guarda snapshot IDB. Almacena en Storage si > 900KB. |
| `loadIDB(gameName)` | Carga y restaura snapshot IDB desde Firestore / Storage. |
| `autoSaveIDB(gameName, getSnapshotFn)` | Auto-guardar snapshot cada 5 min. |

### 👁️ Helpers IDB (en `window.__BudsinIDB`)
Accesibles para operaciones manuales de snapshot/restore sin Firebase:

| Método | Descripción |
|---|---|
| `enumerate()` | Lista nombres de todas las IndexedDB. Retorna Promise. |
| `snapshot(dbNames)` | Snapshots los stores. Retorna Promise con estructura. |
| `restore(snapshot)` | Restaura IndexedDB desde snapshot. Retorna Promise. |

---

*Última actualización: 21 de mayo de 2026*
