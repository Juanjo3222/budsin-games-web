'use strict';
const report = { browser: navigator.userAgent, secureContext: isSecureContext,
  crossOriginIsolated, sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
  offscreenCanvas: typeof OffscreenCanvas !== 'undefined', hardwareConcurrency: navigator.hardwareConcurrency,
  deviceMemoryGB: navigator.deviceMemory || 'not reported' };
report.deviceMemoryNote = 'Approximate browser-provided value; report installed RAM separately.';
// Tiny module declaring a shared 64-bit memory, matching the engine's requirement.
report.wasmMemory64 = typeof WebAssembly !== 'undefined' && WebAssembly.validate(
  new Uint8Array([0,97,115,109,1,0,0,0,5,4,1,7,0,1]));
const output = document.getElementById('report');
const launchLinks = [...document.querySelectorAll('a[href^="/?"], a[href="/"]')];
// En este sitio el juego vive en /gta-5/ (la raíz es el portal de Budsin Games): los botones «Play» y los
// perfiles de rendimiento apuntaban a "/?low=1&..." y abrían el portal en vez del juego.
for (const link of launchLinks) link.setAttribute('href', '/gta-5/' + link.getAttribute('href').slice(1));
function allowLaunch(allowed) {
  for (const link of launchLinks) {
    link.setAttribute('aria-disabled', String(!allowed));
    link.style.opacity = allowed ? '' : '.5';
    link.title = allowed ? '' : 'Launch unavailable until browser requirements pass';
  }
}
allowLaunch(false);
for (const link of launchLinks) link.addEventListener('click', e => {
  if (link.getAttribute('aria-disabled') === 'true') {
    e.preventDefault(); document.getElementById('status').scrollIntoView({block:'center'});
  }
});
report.startupFailure = new URLSearchParams(location.search).get('startup') || undefined;
async function check() {
  let device;
  try {
    try {
      report.storagePersisted = await navigator.storage?.persisted();
      const estimate = await navigator.storage?.estimate();
      report.storageUsageMB = estimate ? Math.round(estimate.usage / 1048576) : 'not reported';
      report.storageQuotaMB = estimate ? Math.round(estimate.quota / 1048576) : 'not reported';
    } catch { report.storageCheck = 'unavailable'; }
    if (!report.secureContext) throw new Error('This engine requires HTTPS or localhost.');
    if (!report.crossOriginIsolated || !report.sharedArrayBuffer) throw new Error('Shared WebAssembly memory is unavailable. Open the site directly in your browser, outside embedded app browsers.');
    if (!report.wasmMemory64) throw new Error('This browser does not support the shared 64-bit WebAssembly memory required by this game. On iPhone/iPad, check for an iOS update and rerun this check. Lower-memory mode cannot fix this requirement; this engine cannot run in your current browser.');
    if (!report.offscreenCanvas) throw new Error('OffscreenCanvas is unavailable; this engine cannot render in the current browser.');
    const response = await fetch('/gta-5/', { cache: 'no-store' });
    report.pageHTTP = response.status;
    const html = await response.text();
    const build = html.match(/\/b\/([a-zA-Z0-9_-]+)\//);
    if (build) {
      const manifest = globalThis.GAME_CHUNKS;
      const entry = manifest?.files?.[`/b/${build[1]}/game.wasm`];
      // El archivo se sirve troceado: el trozo i está en `${prefix}/${i}.bin` (4 dígitos), como en chunk-fetch.js.
      // Pedir solo el prefijo da 404 siempre, también en el origen, y daba un falso «delivery check failed».
      const chunkUrl = entry?.prefix ? `${entry.prefix}/0000.bin` : entry?.url;
      if (!chunkUrl) throw new Error('Game chunk manifest is unavailable.');
      const wasm = await fetch(chunkUrl, { cache: 'no-store' });
      report.wasmHTTP = wasm.status;
      report.wasmChunkHTTP = wasm.status;
      if (wasm.ok) {
        const bytes = new Uint8Array(await wasm.arrayBuffer());
        report.wasmSignature = Array.from(bytes.slice(0, 4)).join(',') === '0,97,115,109';
        report.assetCheck = report.wasmSignature ? 'Chunk delivery verified.' : 'Invalid WASM chunk signature.';
      } else {
        await wasm.body?.cancel();
        report.wasmSignature = false;
      }
    } else report.assetCheck = 'Cannot identify build; run file verification.';
    if (!navigator.gpu) throw new Error('WebGPU unavailable. Check browser updates and graphics acceleration.');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No WebGPU adapter available. Check chrome://gpu or edge://gpu.');
    report.adapter = adapter.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, description: adapter.info.description } : 'not reported';
    report.features = [...adapter.features].sort();
    if (!adapter.features.has('texture-compression-bc')) throw new Error('This GPU/browser lacks BC texture compression, which the current game renderer uses without a fallback. Lower-memory mode cannot fix this; mobile texture support requires a renderer update.');
    report.limits = Object.fromEntries(['maxBufferSize', 'maxStorageBufferBindingSize', 'maxTextureDimension2D', 'maxInterStageShaderVariables'].map(k => [k, adapter.limits[k]]));
    device = await adapter.requestDevice();
    report.deviceCreation = 'passed (basic device only; gameplay uses additional features)';
  } catch (error) { report.error = error.message; }
  finally { device?.destroy(); }
  output.textContent = JSON.stringify(report, null, 2);
  const passed = !report.error && report.crossOriginIsolated && report.sharedArrayBuffer && report.offscreenCanvas && report.wasmSignature;
  allowLaunch(passed);
  document.getElementById('status').textContent = passed
    ? 'Basic checks passed. Start with lower memory; gameplay still depends on your GPU and the complete game data.'
    : (report.error || 'Game file delivery check failed. See the report below.') + ' Play links are disabled to prevent returning here repeatedly.';
}
document.getElementById('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(output.textContent); document.getElementById('copy').textContent = 'Copied'; }
  catch { document.getElementById('copy').textContent = 'Select and copy the report above'; }
});
check();
