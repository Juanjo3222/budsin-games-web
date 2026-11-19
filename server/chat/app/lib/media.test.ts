import { beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import { LIMITS, MediaError, processAudio, processImage, sniff } from "./media";

const tools = { ffmpeg: "ffmpeg", ffprobe: "ffprobe" };
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
const t = hasFfmpeg ? test : test.skip;
const ff = (args: string[]) => Buffer.from(spawnSync("ffmpeg", ["-v", "error", "-y", ...args, "pipe:1"], { maxBuffer: 50_000_000 }).stdout);

let png: Buffer, jpg: Buffer, gif: Buffer, wavTone: Buffer, mp4Video: Buffer;
beforeAll(() => {
  if (!hasFfmpeg) return;
  png = ff(["-f", "lavfi", "-i", "testsrc=size=640x480", "-frames:v", "1", "-f", "image2pipe", "-c:v", "png"]);
  jpg = ff(["-f", "lavfi", "-i", "testsrc=size=2000x1000", "-frames:v", "1", "-f", "image2pipe", "-c:v", "mjpeg"]);
  gif = ff(["-f", "lavfi", "-i", "testsrc=size=100x100:duration=1:rate=5", "-f", "gif"]);
  wavTone = ff(["-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-f", "wav"]);
  mp4Video = Buffer.from(spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc=size=64x64:duration=1", "-f", "lavfi", "-i", "sine=duration=1", "-shortest", "-movflags", "frag_keyframe+empty_moov", "-f", "mp4", "pipe:1"], { maxBuffer: 5_000_000 }).stdout);
});

describe("sniff", () => {
  test("reconoce por los primeros bytes", () => {
    expect(sniff(Buffer.from("89504e470d0a1a0a0000", "hex"))).toBe("png");
    expect(sniff(Buffer.from("ffd8ffe000104a46", "hex"))).toBe("jpeg");
    expect(sniff(Buffer.from("GIF89a....", "latin1"))).toBe("gif");
    expect(sniff(Buffer.from("RIFF\0\0\0\0WEBP", "latin1"))).toBe("webp");
    expect(sniff(Buffer.from("RIFF\0\0\0\0WAVE", "latin1"))).toBe("wav");
    expect(sniff(Buffer.from("1a45dfa3", "hex"))).toBe("webm");
    expect(sniff(Buffer.from("OggS\0\0", "latin1"))).toBe("ogg");
  });
  test("rechaza lo demás: html, svg, exe, texto", () => {
    for (const s of ["<html><script>", "<svg xmlns=", "MZ\x90\x00", "hola mundo", ""]) expect(sniff(Buffer.from(s, "latin1"))).toBeNull();
  });
});

describe("imágenes", () => {
  t("un PNG/JPEG sale como WebP, reducido a 1280 px", async () => {
    const a = await processImage(png, "image", tools);
    expect(a.mime).toBe("image/webp");
    expect(sniff(a.bytes)).toBe("webp");
    expect([a.w, a.h]).toEqual([640, 480]);
    const b = await processImage(jpg, "image", tools);
    expect(b.w).toBe(1280);
    expect(b.h).toBe(640);
  });
  t("un GIF animado queda como una sola imagen", async () => {
    const g = await processImage(gif, "image", tools);
    expect(sniff(g.bytes)).toBe("webp");
  });
  t("sticker: 256x256 con transparencia", async () => {
    const s = await processImage(png, "sticker", tools);
    expect([s.w, s.h]).toEqual([256, 256]);
  });
  t("se quitan los metadatos (EXIF/GPS) al re-codificar", async () => {
    const withMeta = ff(["-f", "lavfi", "-i", "testsrc=size=64x64", "-frames:v", "1", "-metadata", "comment=GPS-12.3,45.6 secreto", "-f", "image2pipe", "-c:v", "mjpeg"]);
    const out = await processImage(withMeta, "image", tools);
    expect(out.bytes.includes(Buffer.from("secreto"))).toBe(false);
  });
  t("rechaza archivos que no son imagen aunque traigan otro nombre", async () => {
    await expect(processImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"), "image", tools)).rejects.toThrow("bad_media");
    await expect(processImage(Buffer.from("MZ\x90\x00 programa"), "image", tools)).rejects.toThrow("bad_media");
    await expect(processImage(wavTone, "image", tools)).rejects.toThrow("bad_media");
  });
  t("un video con cabecera de imagen o un mp4 no pasa como imagen", async () => {
    await expect(processImage(mp4Video, "image", tools)).rejects.toThrow("bad_media");
  });
  t("demasiado grande", async () => {
    await expect(processImage(Buffer.alloc(LIMITS.imageIn + 1, 0x89), "image", tools)).rejects.toBeInstanceOf(MediaError);
  });
  t("un PNG truncado/corrupto se rechaza", async () => {
    await expect(processImage(png.subarray(0, 200), "image", tools)).rejects.toBeInstanceOf(MediaError);
  });
});

describe("audio", () => {
  t("un WAV sale como M4A corto", async () => {
    const a = await processAudio(wavTone, tools);
    expect(a.mime).toBe("audio/mp4");
    expect(a.dur).toBeGreaterThan(1.5);
    expect(a.dur).toBeLessThan(2.6);
    expect(a.bytes.subarray(4, 8).toString()).toBe("ftyp");
  });
  t("más de ~35 s se rechaza", async () => {
    const f = `/tmp/bchat-long-${process.pid}.m4a`;
    spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=300:duration=40", "-c:a", "aac", "-b:a", "24k", f]);
    await expect(processAudio(readFileSync(f), tools)).rejects.toThrow("audio_too_long");
    unlinkSync(f);
  });
  t("una grabación sin duración en la cabecera (MediaRecorder) se recorta a 30 s en vez de pasar entera", async () => {
    const long = ff(["-f", "lavfi", "-i", "sine=frequency=300:duration=40", "-c:a", "libopus", "-b:a", "24k", "-f", "webm"]);
    const a = await processAudio(long, tools);
    expect(a.dur).toBeLessThanOrEqual(30.5);
  });
  t("un audio de 32 s se recorta a 30", async () => {
    const mid = ff(["-f", "lavfi", "-i", "sine=frequency=300:duration=32", "-c:a", "libopus", "-b:a", "24k", "-f", "webm"]);
    const a = await processAudio(mid, tools);
    expect(a.dur).toBeLessThanOrEqual(30.5);
  });
  t("no acepta imágenes ni texto", async () => {
    await expect(processAudio(png, tools)).rejects.toThrow("bad_media");
    await expect(processAudio(Buffer.from("hola"), tools)).rejects.toThrow("bad_media");
  });
  t("una nota casi vacía (<0.3 s) se rechaza", async () => {
    const tiny = ff(["-f", "lavfi", "-i", "sine=frequency=300:duration=0.1", "-f", "wav"]);
    await expect(processAudio(tiny, tools)).rejects.toThrow("audio_too_short");
  });
});
