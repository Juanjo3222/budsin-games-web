// Efectos de sonido del menú, sintetizados con Web Audio (sin archivos de audio).
// Se pueden apagar desde Ajustes; por defecto están activados.

const SOUNDS_KEY = "budsin_sounds";

let ctx = null;

export function soundsEnabled() {
  try {
    return localStorage.getItem(SOUNDS_KEY) !== "0";
  } catch (e) {
    return true;
  }
}

export function setSoundsEnabled(on) {
  try {
    localStorage.setItem(SOUNDS_KEY, on ? "1" : "0");
  } catch (e) {}
}

function audio() {
  if (!soundsEnabled()) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(c, { freq, to, start = 0, dur = 0.12, type = "sine", gain = 0.08 }) {
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

/** Entrar a un juego o sección: barrido ascendente y dos notas de cierre. */
export function playOpen() {
  const c = audio();
  if (!c) return;
  tone(c, { freq: 220, to: 880, dur: 0.28, type: "triangle", gain: 0.07 });
  tone(c, { freq: 659.25, start: 0.22, dur: 0.18, gain: 0.08 });
  tone(c, { freq: 987.77, start: 0.3, dur: 0.3, gain: 0.07 });
}

/** Cambiar de sección dentro del menú: tic corto. */
export function playSelect() {
  const c = audio();
  if (!c) return;
  tone(c, { freq: 880, to: 1175, dur: 0.07, type: "square", gain: 0.035 });
}
