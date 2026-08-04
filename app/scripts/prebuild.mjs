import { rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, "..", "..", "public", "react-assets");

rmSync(assetsDir, { recursive: true, force: true });
console.log("cleaned", assetsDir);
