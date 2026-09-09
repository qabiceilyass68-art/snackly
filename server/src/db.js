import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export function openDb(file = config.dbFile) {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL,
  image TEXT DEFAULT '',
  category TEXT DEFAULT 'عام',
  emoji TEXT DEFAULT '🍽️',
  prep_min INTEGER DEFAULT 0,
  available INTEGER NOT NULL DEFAULT 1,
  options TEXT DEFAULT '[]',
  addons TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS delivery_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  fee REAL NOT NULL DEFAULT 0,
  eta_min INTEGER NOT NULL DEFAULT 30,
  available INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  wa_phone TEXT NOT NULL,
  customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  city TEXT DEFAULT '',
  area TEXT DEFAULT '',
  address TEXT DEFAULT '',
  delivery_type TEXT NOT NULL DEFAULT 'pickup',
  zone_id INTEGER,
  notes TEXT DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]',
  items_total REAL NOT NULL DEFAULT 0,
  delivery_fee REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'NEW',
  ai_summary TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  confirmed_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(wa_phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE TABLE IF NOT EXISTS conversations (
  wa_phone TEXT PRIMARY KEY,
  wa_name TEXT DEFAULT '',
  bot_enabled INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT '{}',
  draft TEXT NOT NULL DEFAULT '{}',
  last_activity TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wa_phone TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'in',
  text TEXT NOT NULL DEFAULT '',
  status TEXT DEFAULT 'received',
  wa_msg_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(wa_phone);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);
  return db;
}

export function seedSettings(db) {
  const st = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  st.run("bot_global_enabled", "1");
  st.run("default_delivery_fee", "0");
  st.run("order_prefix", "SNK-");
}

export const ORDER_STATUS = [
  "NEW",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
];

export const STATUS_LABELS = {
  NEW: "جديد",
  PENDING_CONFIRMATION: "بانتظار التأكيد",
  CONFIRMED: "مؤكد",
  PREPARING: "في التحضير",
  OUT_FOR_DELIVERY: "في الطريق للتوصيل",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغي",
};