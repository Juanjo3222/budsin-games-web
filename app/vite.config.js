import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function publicStaticFallback() {
  return {
    name: "public-static-fallback",
    configureServer(server) {
      const publicDir = path.join(__dirname, "..", "public");
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent(req.url.split("?")[0]);
        if (url === "/" || url.startsWith("/react-assets") || url.startsWith("/src/")) {
          return next();
        }
        const candidate = path.join(publicDir, url);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          res.setHeader("Content-Type", contentType(candidate));
          fs.createReadStream(candidate).pipe(res);
          return;
        }
        next();
      });
    },
  };
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript";
  if (file.endsWith(".css")) return "text/css";
  if (file.endsWith(".json")) return "application/json";
  if (/\.(jpg|jpeg)$/.test(file)) return "image/jpeg";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".webp")) return "image/webp";
  if (file.endsWith(".avif")) return "image/avif";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".mp3")) return "audio/mpeg";
  if (file.endsWith(".mp4")) return "video/mp4";
  if (file.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

export default defineConfig({
  plugins: [react(), publicStaticFallback()],
  root: __dirname,
  base: "/",
  publicDir: false,
  build: {
    outDir: path.join(__dirname, "..", "public"),
    emptyOutDir: false,
    assetsDir: "react-assets",
    rollupOptions: {
      output: {
        entryFileNames: "react-assets/[name]-[hash].js",
        chunkFileNames: "react-assets/[name]-[hash].js",
        assetFileNames: "react-assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
