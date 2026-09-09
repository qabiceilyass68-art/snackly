import test, { after } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { openDb, seedSettings } from "../src/db.js";
import { ProductRepo, ZoneRepo } from "../src/catalog.js";
import { OrderService } from "../src/orders.js";
import { createTools } from "../src/tools.js";
import { createAgent } from "../src/agent.js";
import { createAdminRouter } from "../src/admin.js";
import { createService } from "../src/httpd.js";
import { config } from "../src/config.js";

function freePort() {
  return new Promise(res => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
  });
}

function buildApp() {
  const db = openDb(":memory:");
  seedSettings(db);
  const products = new ProductRepo(db);
  const zones = new ZoneRepo(db);
  const drafts = new Map();
  const orders = new OrderService(db, products, zones, { drafts });
  products.add({ id: "tacos", name: "تاكوس دجاج", price: 30, category: "تاكوس" });
  products.add({ id: "coca", name: "كوكا", price: 7, category: "مشروبات" });
  zones.add({ name: "أكدال", fee: 10, etaMin: 25 });
  const tools = createTools({ db, products, zones, orders, drafts });
  const agent = createAgent({ db, products, zones, orders, drafts, tools });
  const admin = createAdminRouter({ db, products, zones, orders });
  return { db, products, zones, orders, drafts, tools, agent, admin };
}

async function start(extra = {}) {
  const app = buildApp();
  const port = await freePort();
  const svc = createService({
    ...app,
    verifyToken: extra.verifyToken || "vt",
    appSecret: extra.appSecret || "sec",
    phoneNumberId: "PHONE1",
    accessToken: "TOK",
    live: !!extra.live,
    hook: {
      onInbound: (phone, text) => app.agent.handleText(phone, text).text,
      onSend: async (phone, text) => ({ ok: true, sent: false, id: "f-" + Date.now() }),
    },
  });
  try {
    await svc.listen(port, "127.0.0.1");
  } catch (e) {
    try { await svc.close(); } catch { /* ignore */ }
    throw e;
  }
  track({ svc });
  return { app, svc };
}

async function call(port, method, p, body, headers = {}) {
  return fetch(`http://127.0.0.1:${port}${p}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const started = [];

after(async () => {
  for (const h of started) {
    try { await h.svc.close(); } catch { /* ignore */ }
  }
});

function track(h) { started.push(h); return h; }

test("httpd: webhook GET verify returns challenge", async () => {
  const { svc } = await start();
  const res = await fetch(`http://127.0.0.1:${svc.port}/webhook?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=chg123`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "chg123");
  const bad = await fetch(`http://127.0.0.1:${svc.port}/webhook?hub.mode=subscribe&hub.verify_token=xx&hub.challenge=c`);
  assert.equal(bad.status, 403);
  await svc.close();
});

test("httpd: webhook POST inbound triggers agent reply (echo in dev)", async () => {
  const { svc, app } = await start();
  const body = {
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        field: "messages",
        value: {
          metadata: { phone_number_id: "PHONE1" },
          messages: [{ from: "212650169277", id: "m.1", type: "text", text: { body: "بغيت تاكوس" }, timestamp: "1" }],
        },
      }],
    }],
  };
  const res = await call(svc.port, "POST", "/webhook", body);
  assert.equal(res.status, 200);
  await new Promise(r => setTimeout(r, 150));
  const msgs = app.db.prepare("SELECT * FROM messages").all();
  assert.ok(msgs.length >= 1, "inbound saved");
  await svc.close();
});

test("httpd: webhook POST with bad signature → 401 in live mode", async () => {
  const { svc } = await start({ live: true });
  const res = await call(svc.port, "POST", "/webhook", { object: "whatsapp" });
  assert.equal(res.status, 401);
  await svc.close();
});

test("httpd: admin API behind basic auth; static index serves", async () => {
  const { svc } = await start();
  const unauth = await call(svc.port, "GET", "/api/stats");
  assert.equal(unauth.status, 401);
  const auth = Buffer.from("admin:secret1").toString("base64");
  const ok = await call(svc.port, "GET", "/api/stats", null, { authorization: "Basic " + auth });
  assert.equal(ok.status, 200);
  await svc.close();
});

test("httpd: unknown route → 404", async () => {
  const { svc } = await start();
  const r = await fetch(`http://127.0.0.1:${svc.port}/nope`);
  assert.equal(r.status, 404);
  await svc.close();
});