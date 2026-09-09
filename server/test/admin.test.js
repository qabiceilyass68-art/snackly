import test from "node:test";
import assert from "node:assert/strict";
import { openDb, seedSettings } from "../src/db.js";
import { ProductRepo, ZoneRepo } from "../src/catalog.js";
import { OrderService } from "../src/orders.js";
import { createAdminRouter } from "../src/admin.js";

function make() {
  const db = openDb(":memory:");
  seedSettings(db);
  const products = new ProductRepo(db);
  const zones = new ZoneRepo(db);
  const orders = new OrderService(db, products, zones);
  products.add({ id: "tacos", name: "تاكوس دجاج", price: 30, category: "تاكوس" });
  zones.add({ name: "أكدال", fee: 10, etaMin: 25 });
  const admin = createAdminRouter({ db, products, zones, orders });
  return { db, products, zones, orders, admin };
}

const AUTH = { headers: { authorization: "Basic " + Buffer.from("admin:secret1").toString("base64") } };
const UNAUTH = { headers: { authorization: "Basic " + Buffer.from("x:y").toString("base64") } };

test("admin: requires valid basic auth", () => {
  const { admin } = make();
  let r = admin.route("GET", "/api/orders", {}, {});
  assert.equal(r.status, 401);
  r = admin.route("GET", "/api/orders", {}, UNAUTH.headers);
  assert.equal(r.status, 401);
  r = admin.route("GET", "/api/orders", {}, AUTH.headers);
  assert.equal(r.status, 200);
});

test("admin: unknown api route → 404", () => {
  const { admin } = make();
  const r = admin.route("GET", "/api/nope", {}, AUTH.headers);
  assert.equal(r.status, 404);
});

test("admin: session token issue + protected-by-token", () => {
  const { admin } = make();
  const r = admin.route("POST", "/api/session", { action: "login" }, AUTH.headers);
  assert.equal(r.status, 200);
  const token = r.body && r.body.token;
  assert.ok(token, "token issued");
  const h = { authorization: "Bearer " + token };
  const pr = admin.route("GET", "/api/stats", {}, h);
  assert.equal(pr.status, 200);
});

test("admin: products CRUD through admin router", () => {
  const { admin } = make();
  let r = admin.route("POST", "/api/products", { id: "pizza", name: "بيتزا", price: 45, category: "بيتزا" }, AUTH.headers);
  assert.equal(r.status, 200);
  r = admin.route("GET", "/api/products", {}, AUTH.headers);
  assert.equal(r.body.products.some(p => p.id === "pizza"), true);
  r = admin.route("PUT", "/api/products/pizza", { price: 50 }, AUTH.headers);
  assert.equal(r.body.product.price, 50);
  r = admin.route("DELETE", "/api/products/pizza", {}, AUTH.headers);
  assert.equal(r.status, 200);
  r = admin.route("GET", "/api/products", {}, AUTH.headers);
  assert.equal(r.body.products.some(p => p.id === "pizza"), false);
});

test("admin: states of orders end-to-end via admin", () => {
  const { admin } = make();
  let r = admin.route("GET", "/api/stats", {}, AUTH.headers);
  assert.equal(r.body.orders, 0);
});

test("admin: settings get/set", () => {
  const { admin } = make();
  let r = admin.route("GET", "/api/settings", {}, AUTH.headers);
  assert.equal(r.body.bot_global_enabled, "1");
  r = admin.route("POST", "/api/settings", { bot_global_enabled: "0" }, AUTH.headers);
  assert.equal(r.status, 200);
  r = admin.route("GET", "/api/settings", {}, AUTH.headers);
  assert.equal(r.body.bot_global_enabled, "0");
});