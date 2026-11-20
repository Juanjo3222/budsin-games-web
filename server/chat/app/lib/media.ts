// Imágenes, stickers y notas de voz de Budsin Chat.
//
// Nada de lo que sube una persona se guarda tal cual: se comprueba el tipo por sus primeros bytes y SIEMPRE se
// re-codifica con ffmpeg (quita metadatos como la ubicación GPS, y elimina cualquier archivo "disfrazado"):
//   · imagen  -> WebP, lado mayor 1280 px, solo el primer cuadro (un GIF animado queda quieto)
//   · sticker -> WebP 256x256 con transparencia
//   · audio   -> M4A (AAC mono 32 kbps, máx. 30 s), que suena en todos los navegadores
// Las imágenes y stickers pasan además por un detector de contenido sexual (servicio aparte, ver server/chat/scan).
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type MediaKind = "image" | "sticker" | "audio" | "avatar";

export const LIMITS = {
  imageIn: 5_000_000,       // bytes que se aceptan de entrada
  audioIn: 1_500_000,
  maxPixels: 40_000_000,    // contra "bombas de descompresión"
  audioMaxSec: 30,
};

export class MediaError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const hex = (b: Uint8Array, n = 16) => Buffer.from(b.subarray(0, n)).toString("hex");

/** What the first bytes say the file is, or null. Anything else is refused before ffmpeg ever sees it. */
export function sniff(b: Uint8Array): "jpeg" | "png" | "gif" | "webp" | "webm" | "ogg" | "mp4" | "wav" | "mp3" | null {
  const h = hex(b, 12);
  if (h.startsWith("ffd8ff")) return "jpeg";
  if (h.startsWith("89504e470d0a1a0a")) return "png";
  if (h.startsWith("474946383761") || h.startsWith("474946383961")) return "gif";
  if (h.startsWith("52494646") && h.slice(16, 24) === "57454250") return "webp";
  if (h.startsWith("1a45dfa3")) return "webm";
  if (h.startsWith("4f676753")) return "ogg";
  if (h.slice(8, 16) === "66747970") return "mp4";
  if (h.startsWith("52494646") && h.slice(16, 24) === "57415645") return "wav";
  if (h.startsWith("494433") || /^fff[2-9a-f]/.test(h) || h.startsWith("fff")) return "mp3";
  return null;
}

function run(cmd: string, args: string[], timeoutMs: number): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => { if (out.length < 20_000) out += String(d); });
    p.stderr.on("data", (d) => { if (err.length < 4_000) err += String(d); });
    const t = setTimeout(() => { p.kill("SIGKILL"); reject(new MediaError("media_timeout")); }, timeoutMs);
    p.on("error", (e) => { clearTimeout(t); reject(e); });
    p.on("close", (code) => { clearTimeout(t); resolve({ code: code ?? 1, out, err }); });
  });
}

interface Probe { w: number; h: number; dur: number; hasAudio: boolean; hasVideo: boolean }
async function probe(file: string, ffprobe: string): Promise<Probe> {
  const r = await run(ffprobe, ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file], 10_000);
  if (r.code !== 0) throw new MediaError("bad_media");
  try {
    const j = JSON.parse(r.out);
    const streams: { codec_type?: string; width?: number; height?: number; duration?: string }[] = j.streams ?? [];
    const v = streams.find((s) => s.codec_type === "video");
    const a = streams.find((s) => s.codec_type === "audio");
    const dur = Number(j.format?.duration ?? v?.duration ?? a?.duration ?? 0);
    return { w: v?.width ?? 0, h: v?.height ?? 0, dur: Number.isFinite(dur) ? dur : 0, hasAudio: !!a, hasVideo: !!v };
  } catch {
    throw new MediaError("bad_media");
  }
}

export interface Processed {
  bytes: Buffer;
  mime: string;
  ext: string;
  w: number;
  h: number;
  dur: number;
}

export interface Tools { ffmpeg: string; ffprobe: string }

async function withTemp<T>(input: Uint8Array, fn: (dir: string, inFile: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "bchat-"));
  try {
    const inFile = path.join(dir, "in.bin");
    await writeFile(inFile, input);
    return await fn(dir, inFile);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function processImage(input: Uint8Array, kind: "image" | "sticker" | "avatar", tools: Tools): Promise<Processed> {
  if (input.length > LIMITS.imageIn) throw new MediaError("media_too_large");
  const type = sniff(input);
  if (!type || !["jpeg", "png", "gif", "webp"].includes(type)) throw new MediaError("bad_media");
  return withTemp(input, async (dir, inFile) => {
    const p = await probe(inFile, tools.ffprobe);
    if (!p.hasVideo || p.w < 1 || p.h < 1 || p.w * p.h > LIMITS.maxPixels) throw new MediaError("bad_media");
    const out = path.join(dir, "out.webp");
    const vf = kind === "avatar"
      ? "scale=256:256:force_original_aspect_ratio=increase:flags=lanczos,crop=256:256"   // foto de perfil: cuadrada, recortada al centro
      : kind === "sticker"
      ? "scale=256:256:force_original_aspect_ratio=decrease:flags=lanczos,format=rgba,pad=256:256:(ow-iw)/2:(oh-ih)/2:color=0x00000000"
      : "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease:flags=lanczos";
    const r = await run(tools.ffmpeg, ["-nostdin", "-v", "error", "-y", "-threads", "1", "-i", inFile, "-frames:v", "1", "-vf", vf, "-map_metadata", "-1", "-c:v", "libwebp", "-quality", "82", "-f", "webp", out], 20_000);
    if (r.code !== 0) throw new MediaError("bad_media");
    const bytes = await readFile(out);
    const q = await probe(out, tools.ffprobe);
    return { bytes, mime: "image/webp", ext: "webp", w: q.w, h: q.h, dur: 0 };
  });
}

export async function processAudio(input: Uint8Array, tools: Tools): Promise<Processed> {
  if (input.length > LIMITS.audioIn) throw new MediaError("media_too_large");
  const type = sniff(input);
  if (!type || !["webm", "ogg", "mp4", "wav", "mp3"].includes(type)) throw new MediaError("bad_media");
  return withTemp(input, async (dir, inFile) => {
    const p = await probe(inFile, tools.ffprobe);
    if (!p.hasAudio || p.hasVideo && type !== "webm" && type !== "mp4") throw new MediaError("bad_media");
    // MediaRecorder writes webm without a duration in the header on some browsers: then ffmpeg measures it below.
    if (p.dur > LIMITS.audioMaxSec + 5) throw new MediaError("audio_too_long");
    const out = path.join(dir, "out.m4a");
    const r = await run(tools.ffmpeg, ["-nostdin", "-v", "error", "-y", "-threads", "1", "-i", inFile, "-t", String(LIMITS.audioMaxSec), "-vn", "-map_metadata", "-1", "-ac", "1", "-ar", "24000", "-c:a", "aac", "-b:a", "32k", "-movflags", "+faststart", "-f", "mp4", out], 25_000);
    if (r.code !== 0) throw new MediaError("bad_media");
    const bytes = await readFile(out);
    const q = await probe(out, tools.ffprobe);
    if (q.dur < 0.3) throw new MediaError("audio_too_short");
    if (q.dur > LIMITS.audioMaxSec + 1) throw new MediaError("audio_too_long");
    return { bytes, mime: "audio/mp4", ext: "m4a", w: 0, h: 0, dur: Math.round(q.dur * 10) / 10 };
  });
}

/** nsfw probability 0..1 from the scanner service. Throws when the scanner cannot answer: callers must then refuse (fail closed). */
export type Scanner = (webp: Uint8Array) => Promise<number>;

export function httpScanner(url: string, timeoutMs = 15_000): Scanner {
  return async (bytes) => {
    const res = await fetch(`${url.replace(/\/+$/, "")}/scan`, { method: "POST", body: bytes, headers: { "content-type": "image/webp" }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) { await res.body?.cancel().catch(() => {}); throw new MediaError("scan_unavailable"); }
    const j = (await res.json()) as { nsfw?: number };
    if (typeof j.nsfw !== "number" || !Number.isFinite(j.nsfw)) throw new MediaError("scan_unavailable");
    return j.nsfw;
  };
}

export const NSFW_THRESHOLD = Number(process.env.CHAT_NSFW_THRESHOLD) || 0.35;   // conservador: ante la duda, se rechaza

export async function fileSize(f: string): Promise<number> {
  return (await stat(f)).size;
}
