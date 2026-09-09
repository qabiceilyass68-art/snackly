import crypto from "node:crypto";
import { ORDER_STATUS, STATUS_LABELS } from "./db.js";
import { config } from "./config.js";

const json = (status, body) => ({ status, body, contentType: "application/json; charset=utf-8" });
const bad = msg => json(400, { ok: false, error: msg });
const okJ = body => json(200, body);

/** مصادقة: Basic (admin/pass) عند أول طلب، ثم Bearer token في جلسة الآلة. */
export function createAdminRouter(deps) {
  const { db, products, zones, orders } = deps;
  const sessions = new Map(); // token -> createdAt
  const authUser = config.adminUser || "admin";
  const authPass = config.adminPass || "secret1";

  function check(h) {
    const auth = h.authorization || "";
    if (auth.startsWith("Basic ")) {
      const [u, p] = Buffer.from(auth.slice(6), "base64").toString("utf8").split(":");
      if (u === authUser && p === authPass) return true;
    }
    if (auth.startsWith("Bearer ")) {
      const tok = auth.slice(7);
      if (sessions.has(tok)) return true;
    }
    return false;
  }

  function handle(method, pathname, body, headers) {
    if (!check(headers)) return json(401, { ok: false, error: "unauthorized" });

    // /api/session — إصدار + إبطال token
    if (method === "POST" && pathname === "/api/session") {
      if (body.action === "logout") {
        const auth = headers.authorization || "";
        if (auth.startsWith("Bearer ")) sessions.delete(auth.slice(7));
        return okJ({ ok: true });
      }
      const token = crypto.randomBytes(24).toString("hex");
      sessions.set(token, Date.now());
      return okJ({ ok: true, token });
    }

    if (method === "GET" && pathname === "/api/stats") {
      const stats = db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM orders) AS orders,
             (SELECT COUNT(*) FROM orders WHERE status='NEW') AS new_orders,
             (SELECT COUNT(*) FROM orders WHERE status IN ('CONFIRMED','PREPARING','OUT_FOR_DELIVERY')) AS active_orders,
             (SELECT COUNT(*) FROM products) AS products,
             (SELECT COUNT(*) FROM conversations) AS conversations`
        )
        .get();
      return okJ({ ...stats });
    }

    // المنتجات
    if (method === "GET" && pathname === "/api/products") {
      return okJ({ products: products.all().map(p => ({ ...p, options: JSON.parse(p.options || "[]"), addons: JSON.parse(p.addons || "[]") })) });
    }
    if (method === "POST" && pathname === "/api/products") {
      const p = body || {};
      if (!p.id || !p.name || p.price == null) return bad("id/name/price required");
      if (products.get(p.id)) return bad("product exists");
      const created = products.add({ ...p, category: p.category || "عام" });
      return okJ({ ok: true, product: created });
    }
    const mProduct = pathname.match(/^\/api\/products\/([^/]+)$/);
    if (mProduct) {
      const id = decodeURIComponent(mProduct[1]);
      if (method === "GET") {
        const p = products.get(id);
        return p ? okJ({ product: p }) : json(404, { ok: false });
      }
      if (method === "PUT") {
        const updated = products.update(id, body || {});
        return updated ? okJ({ ok: true, product: updated }) : json(404, { ok: false });
      }
      if (method === "DELETE") {
        products.remove(id);
        return okJ({ ok: true });
      }
    }

    // مناطق التوصيل
    if (method === "GET" && pathname === "/api/zones") return okJ({ zones: zones.list() });
    if (method === "POST" && pathname === "/api/zones") {
      const z = body || {};
      if (!z.name) return bad("name required");
      return okJ({ ok: true, zone: zones.add(z) });
    }
    const mZone = pathname.match(/^\/api\/zones\/(\d+)$/);
    if (mZone) {
      const id = Number(mZone[1]);
      if (method === "PUT") return okJ({ ok: true, zone: zones.update(id, body || {}) });
      if (method === "DELETE") {
        zones.remove(id);
        return okJ({ ok: true });
      }
    }

    // الطلبات
    if (method === "GET" && pathname === "/api/orders") return okJ({ orders: orders.list(200) });
    const mOrder = pathname.match(/^\/api\/orders\/([^/]+)$/);
    if (mOrder && method === "GET") {
      const o = orders.load(decodeURIComponent(mOrder[1]));
      return o ? okJ({ order: o }) : json(404, { ok: false });
    }
    if (mOrder && method === "PUT") {
      const o = orders.load(decodeURIComponent(mOrder[1]));
      if (!o) return json(404, { ok: false });
      const status = (body?.status || "").toUpperCase();
      if (status && ORDER_STATUS.includes(status)) {
        const next = orders.transition(o, status);
        if (next.error) return bad(next.error);
        orders.save(next);
        return okJ({ ok: true, order: orders.load(o.id) });
      }
      const saved = orders.save(o, body || {});
      return okJ({ ok: true, order: saved });
    }

    // المحادثات
    if (method === "GET" && pathname === "/api/conversations") {
      const rows = db.prepare("SELECT * FROM conversations ORDER BY last_activity DESC LIMIT 200").all();
      return okJ({ conversations: rows });
    }
    const mConv = pathname.match(/^\/api\/conversations\/([^/]+)$/);
    if (mConv) {
      const phone = decodeURIComponent(mConv[1]);
      if (method === "GET") {
        const c = db.prepare("SELECT * FROM conversations WHERE wa_phone = ?").get(phone);
        if (!c) return json(404, { ok: false });
        const msgs = db.prepare("SELECT * FROM messages WHERE wa_phone = ? ORDER BY id").all(phone);
        const convOrders = orders.listFor(phone);
        return okJ({ conversation: c, messages: msgs, orders: convOrders });
      }
      if (method === "PUT") {
        const patch = body || {};
        const cur = db.prepare("SELECT * FROM conversations WHERE wa_phone = ?").get(phone);
        if (!cur) return json(404, { ok: false });
        const bot = patch.bot_enabled != null ? Number(patch.bot_enabled) : cur.bot_enabled;
        db.prepare("UPDATE conversations SET bot_enabled = ?, last_activity = datetime('now') WHERE wa_phone = ?").run(bot, phone);
        return okJ({ ok: true, conversation: db.prepare("SELECT * FROM conversations WHERE wa_phone = ?").get(phone) });
      }
    }
    const mConvSend = pathname.match(/^\/api\/conversations\/([^/]+)\/send$/);
    if (mConvSend && method === "POST") {
      const phone = decodeURIComponent(mConvSend[1]);
      const text = String((body || {}).text || "").trim();
      if (!text) return bad("text required");
      const c = db.prepare("SELECT * FROM conversations WHERE wa_phone = ?").get(phone);
      if (!c) return json(404, { ok: false });
      db.prepare("INSERT INTO messages (wa_phone, direction, text, status) VALUES (?, 'out', ?, 'manual')").run(phone, text);
      db.prepare("UPDATE conversations SET last_activity = datetime('now') WHERE wa_phone = ?").run(phone);
      return okJ({ ok: true });
    }

    // الإعدادات
    if (method === "GET" && pathname === "/api/settings") {
      const all = {};
      for (const r of db.prepare("SELECT key, value FROM settings").all()) all[r.key] = r.value;
      return okJ(all);
    }
    if (method === "POST" && pathname === "/api/settings") {
      const allowed = new Set(["bot_global_enabled", "default_delivery_fee", "order_prefix", "admin_user", "admin_pass"]);
      for (const [k, v] of Object.entries(body || {})) {
        if (allowed.has(k)) db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(k, String(v));
      }
      return okJ({ ok: true });
    }

    return json(404, { ok: false, error: "not_found" });
  }

  return { route: handle, STATUS_LABELS, ORDER_STATUS };
}