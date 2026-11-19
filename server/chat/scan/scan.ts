// Detector de contenido sexual para las imágenes y stickers de Budsin Chat (servicio aparte, 127.0.0.1:3105).
//
// Modelo: AdamCodd/vit-base-nsfw-detector (Apache-2.0), exportado a ONNX y cuantizado a int8 (~88 MB), entrada 384x384.
// install.sh lo descarga y verifica su SHA-256. Cada imagen: ffmpeg la deja en 384x384 RGB (con los fondos transparentes
// sobre blanco) y el modelo devuelve la probabilidad de "nsfw". El chat rechaza lo que pase de su umbral.
//
// Es un servicio separado para que su memoria (~350 MB) no compita con el chat, y para que, si falla, el chat siga
// funcionando y simplemente NO acepte imágenes (falla cerrado), nunca las deje pasar sin revisar.
import * as ort from "onnxruntime-node";

const PORT = Number(process.env.SCAN_PORT) || 3105;
const HOST = process.env.SCAN_HOST || "127.0.0.1";
const MODEL = process.env.SCAN_MODEL || "/var/lib/budsin-chat-scan/model_int8.onnx";
const SIZE = 384;
const MAX_BODY = 6_000_000;

const session = await ort.InferenceSession.create(MODEL, { intraOpNumThreads: Number(process.env.SCAN_THREADS) || 2 });
const input = session.inputNames[0];
const output = session.outputNames[0];
const NSFW_INDEX = 1;     // id2label del modelo: 0 = sfw, 1 = nsfw

async function toRgb(bytes: Uint8Array): Promise<Float32Array> {
  const p = Bun.spawn(
    ["ffmpeg", "-nostdin", "-v", "error", "-threads", "1", "-f", "lavfi", "-i", `color=white:s=${SIZE}x${SIZE}`, "-i", "pipe:0",
      "-filter_complex", `[1:v]scale=${SIZE}:${SIZE}:flags=bilinear,format=rgba[f];[0:v][f]overlay=shortest=1:format=auto,format=rgb24`,
      "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
    { stdin: "pipe", stdout: "pipe", stderr: "ignore" },
  );
  p.stdin.write(bytes);
  p.stdin.end();
  const timer = setTimeout(() => p.kill(9), 15_000);
  const buf = new Uint8Array(await new Response(p.stdout).arrayBuffer());
  clearTimeout(timer);
  await p.exited;
  if (buf.length !== SIZE * SIZE * 3) throw new Error("bad image");
  const out = new Float32Array(3 * SIZE * SIZE);
  const plane = SIZE * SIZE;
  for (let i = 0; i < plane; i++) for (let c = 0; c < 3; c++) out[c * plane + i] = (buf[i * 3 + c] / 255 - 0.5) / 0.5;
  return out;
}

async function nsfwScore(bytes: Uint8Array): Promise<number> {
  const tensor = new ort.Tensor("float32", await toRgb(bytes), [1, 3, SIZE, SIZE]);
  const res = await session.run({ [input]: tensor });
  const logits = Array.from(res[output].data as Float32Array);
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  return exps[NSFW_INDEX] / exps.reduce((a, b) => a + b, 0);
}

// de a una imagen por vez; si hay mucha cola se responde 503 en vez de acumular memoria
let active = 0;
const waiting: (() => void)[] = [];
async function gated<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 1) {
    if (waiting.length >= 8) throw new Error("busy");
    await new Promise<void>((r) => waiting.push(r));
  }
  active++;
  try { return await fn(); } finally { active--; waiting.shift()?.(); }
}

Bun.serve({
  port: PORT,
  hostname: HOST,
  maxRequestBodySize: MAX_BODY,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/health") return Response.json({ ok: true });
    if (url.pathname !== "/scan" || req.method !== "POST") return new Response("not found", { status: 404 });
    const body = new Uint8Array(await req.arrayBuffer());
    if (!body.length || body.length > MAX_BODY) return Response.json({ error: "bad size" }, { status: 400 });
    try {
      const nsfw = await gated(() => nsfwScore(body));
      return Response.json({ nsfw });
    } catch (e) {
      const busy = e instanceof Error && e.message === "busy";
      if (!busy) console.error("[scan] failed:", e instanceof Error ? e.message : e);
      return Response.json({ error: busy ? "busy" : "failed" }, { status: busy ? 503 : 422 });
    }
  },
});
console.log(`[scan] listening on ${HOST}:${PORT}, model ${MODEL}`);
