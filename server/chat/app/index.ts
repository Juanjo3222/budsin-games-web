import { mkdirSync } from "node:fs";
import path from "node:path";
import { googleKeyProvider } from "./lib/auth";
import { ChatDb } from "./lib/db";
import { httpScanner } from "./lib/media";
import { createChatServer } from "./lib/server";

const dataDir = process.env.CHAT_DATA_DIR || path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });
const db = new ChatDb(path.join(dataDir, "chat.sqlite"));

const adminEmails = (process.env.CHAT_ADMIN_EMAILS || "juvaldiviam@gmail.com,juanjoseguravegamail@gmail.com").split(",").map((s) => s.trim()).filter(Boolean);
const origins = (process.env.CHAT_ORIGINS || "https://games.budsin.dev").split(",").map((s) => s.trim()).filter(Boolean);

const scanUrl = process.env.CHAT_SCAN_URL || "http://127.0.0.1:3105";
const chat = createChatServer({
  mediaDir: process.env.CHAT_MEDIA_DIR || path.join(dataDir, "media"),
  scan: httpScanner(scanUrl),
  imagesEnabled: process.env.CHAT_IMAGES === "1",   // apagado por defecto (ver README: CSAM)
  mediaMinAgeMs: process.env.CHAT_MEDIA_MIN_AGE_MIN ? Number(process.env.CHAT_MEDIA_MIN_AGE_MIN) * 60_000 : undefined,
  scanHealth: () => fetch(`${scanUrl}/health`, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok, () => false),
  db,
  projectId: process.env.FIREBASE_PROJECT_ID || "juanjo-games",
  keys: googleKeyProvider(),
  adminEmails,
  origins,
  port: Number(process.env.CHAT_PORT) || 3104,
  hostname: process.env.CHAT_HOST || "127.0.0.1",
});
console.log(`[chat] listening on ${process.env.CHAT_HOST || "127.0.0.1"}:${chat.port}`);
