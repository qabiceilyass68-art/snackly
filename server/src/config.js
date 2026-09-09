import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dir, "..");

export function loadEnv(file = path.join(ROOT, ".env")) {
  if (!fs.existsSync(file)) return false;
  const raw = fs.readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      val.startsWith('"') && val.endsWith('"') ||
      val.startsWith("'") && val.endsWith("'")
    ) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
  return true;
}

loadEnv();

export const config = {
  port: Number(process.env.PORT || "8787"),
  dbFile: path.resolve(ROOT, process.env.DB_FILE || "data/snackly.db"),
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "snackly-verify-2026",
    appSecret: process.env.WHATSAPP_APP_SECRET || "",
    live: process.env.WHATSAPP_LIVE === "1" || process.env.WHATSAPP_LIVE === "true",
    graphVersion: process.env.GRAPH_API_VERSION || "v19.0",
  },
  admin: {
    user: process.env.ADMIN_USER || "admin",
    pass: process.env.ADMIN_PASS || "snackly2026",
  },
};