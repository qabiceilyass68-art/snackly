import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, seedSettings } from "./db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");

export function loadMenuSeedFromSite() {
  const file = path.resolve(here, "..", "..", "js", "data.js");
  if (!fs.existsSync(file)) return null;
  const code = fs.readFileSync(file, "utf8");
  const m = code.match(/const MENU_SEED\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) return null;
  const fn = new Function(`"use strict"; return (${m[1]});`);
  const arr = fn();
  if (!Array.isArray(arr)) return null;
  return arr;
}

export function runSeed({ log = console } = {}) {
  const db = openDb();
  seedSettings(db);
  const n = db.prepare("SELECT COUNT(*) AS n FROM products").get().n;
  if (n > 0) {
    log.log("المنتجات موجودة (" + n + ") — الـseed لا يعيد الكتابة (Dashboard للتعديل).");
    db.close();
    return;
  }
  const menu = loadMenuSeedFromSite();
  if (!menu || menu.length === 0) {
    log.log("تعذّر قراءة MENU_SEED من js/data.js — أضف منتجاتك من لوحة الإدارة.");
    db.close();
    return;
  }
  const ins = db.prepare(
    "INSERT INTO products (id, name, description, price, image, category, emoji, prep_min, available, options, addons) VALUES (?,?,?,?,?,?,?,?,1,'[]','[]')"
  );
  let ok = 0;
  for (const it of menu) {
    ins.run(
      String(it.id || "p" + ok),
      String(it.name || ""),
      String(it.desc || ""),
      Number(it.price) || 0,
      String(it.img || ""),
      String(it.category || "عام"),
      String(it.emoji || "🍽️"),
      Number(it.prep) || 0
    );
    ok++;
  }
  log.log("تم بذر " + ok + " منتجاً من المنيو الحقيقي في الموقع (js/data.js). أعد ضبط الأسعار من Dashboard.");
  db.close();
}

if (path.resolve(process.argv[1] || "") === path.resolve(new URL(import.meta.url).pathname)) {
  runSeed();
}