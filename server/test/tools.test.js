import test from "node:test";
import assert from "node:assert/strict";
import { openDb, seedSettings } from "../src/db.js";
import { ProductRepo, ZoneRepo } from "../src/catalog.js";
import { OrderService } from "../src/orders.js";
import { createTools } from "../src/tools.js";

function make() {
  const db = openDb(":memory:");
  seedSettings(db);
  const products = new ProductRepo(db);
  const zones = new ZoneRepo(db);
  const drafts = new Map();
  const orders = new OrderService(db, products, zones, { drafts });
  products.add({ id: "tacos", name: "تاكوس دجاج", price: 30, category: "تاكوس", addons: ["جبن", "صوص"] });
  products.add({ id: "coca", name: "كوكا", price: 7, category: "مشروبات" });
  zones.add({ name: "أكدال", fee: 10, etaMin: 25 });
  const tools = createTools({ db, products, zones, orders, drafts });
  return { db, products, zones, orders, tools };
}

test("tools: get_products lists real catalog with prices (no invention)", () => {
  const { tools } = make();
  const r = tools.call("get_products", {});
  assert.equal(r.ok, true);
  assert.equal(r.products.length, 2);
  assert.equal(r.products[0].price, 30);
});

test("tools: get_product by name/alias; unknown → not found", () => {
  const { tools } = make();
  assert.equal(tools.call("get_product", { id: "tacos" }).product.id, "tacos");
  assert.equal(tools.call("get_product", { id: "keshri" }).ok, false);
});

test("tools: calculate_order exact from DB + delivery fee", () => {
  const { tools, zones } = make();
  const z = zones.findAvailable("أكدال");
  const r = tools.call("calculate_order", {
    items: [{ id: "tacos", qty: 2 }, { id: "coca", qty: 1 }],
    deliveryZone: "أكدال",
  });
  assert.equal(r.ok, true);
  assert.equal(r.itemsTotal, 67);
  assert.equal(r.deliveryFee, 10);
  assert.equal(r.total, 77);
});

test("tools: add_item/remove_item/update_item mutate the live draft & recompute", () => {
  const { tools, orders } = make();
  let draft = orders.createDraft("+212600000001", "تاكوس دجاج", 1);
  let r = tools.call("add_item", { orderId: draft.id, productId: "coca", qty: 2 });
  assert.equal(r.ok, true);
  const merged = tools.call("add_item", { orderId: draft.id, productId: "tacos", qty: 1 });
  assert.equal(merged.draft.items.find(i => i.id === "tacos").qty, 2);
  r = tools.call("remove_item", { orderId: draft.id, productId: "coca" });
  assert.equal(r.draft.items.length, 1);
  r = tools.call("update_item", { orderId: draft.id, productId: "tacos", qty: 5 });
  assert.equal(r.draft.items.find(i => i.id === "tacos").qty, 5);
});

test("tools: delivery zones listing & availability", () => {
  const { tools } = make();
  const r = tools.call("get_delivery_zones", {});
  assert.equal(r.ok, true);
  assert.equal(r.zones[0].name, "أكدال");
});

test("tools: create_order/confirm_order/cancel_order lifecycle", () => {
  const { tools } = make();
  const c = tools.call("create_order", {
    waPhone: "+212600000001",
    items: [{ id: "tacos", qty: 2 }],
  });
  assert.equal(c.ok, true);
  assert.equal(c.order.status, "PENDING_CONFIRMATION");
  const conf = tools.call("confirm_order", { orderId: c.order.id });
  assert.equal(conf.ok, true);
  assert.equal(conf.order.status, "CONFIRMED");
  const saved = tools.call("get_order", { orderId: c.order.id });
  assert.equal(saved.status, "CONFIRMED");
  const can = tools.call("cancel_order", { orderId: c.order.id, confirmed: true });
  assert.equal(can.order.status, "CANCELLED");
});

test("tools: handoff_to_human flag; bot persists state", () => {
  const { tools, db } = make();
  const r = tools.call("handoff_to_human", { waPhone: "+212600000001" });
  assert.equal(r.ok, true);
  assert.equal(r.handoff, true);
});

test("tools: unknown product never yields invented price", () => {
  const { tools } = make();
  const r = tools.call("add_item", { orderId: "X", productId: "مشروما", qty: 1 });
  assert.equal(r.ok, false);
});