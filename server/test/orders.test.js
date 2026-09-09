import test from "node:test";
import assert from "node:assert/strict";
import { openDb, seedSettings } from "../src/db.js";
import { ProductRepo, ZoneRepo } from "../src/catalog.js";
import { OrderService, calcTotals } from "../src/orders.js";

function make() {
  const db = openDb(":memory:");
  seedSettings(db);
  const products = new ProductRepo(db);
  const zones = new ZoneRepo(db);
  const orders = new OrderService(db, products, zones);
  products.add({ id: "tacos", name: "تاكوس دجاج", price: 30, category: "تاكوس" });
  products.add({ id: "coca", name: "كوكا", price: 7, category: "مشروبات" });
  zones.add({ name: "أكدال", fee: 10, etaMin: 25 });
  return { db, products, zones, orders };
}

test("orders: create draft, add/remove/update line, price from DB", () => {
  const { orders } = make();
  const o = orders.createDraft("+212600000001", "تاكوس دجاج", 1);
  assert.equal(o.items.length, 1);
  const o2 = orders.addLine(o, "كوكا", 1);
  assert.equal(o2.items.length, 2);
  const o3 = orders.addLine(o2, "تاكوس دجاج", 2); // يدمج الكمية
  assert.equal(o3.items.find(i => i.id === "tacos").qty, 3);
  const o4 = orders.setLineQty(o3, "كوكا", 2);
  assert.equal(o4.items.find(i => i.id === "coca").qty, 2);
  const o5 = orders.removeLine(o4, "تاكوس دجاج");
  assert.equal(o5.items.length, 1);
  assert.equal(o5.items[0].id, "coca");
});

test("orders: calcTotals exact (Tacos30×2 + Coca7×1 + Livraison10 = 77)", () => {
  const { orders, zones } = make();
  let o = orders.createDraft("+212600000001", "تاكوس دجاج", 2);
  o = orders.addLine(o, "كوكا", 1);
  const itemsTotal = o.items.reduce((s, i) => s + i.qty * i.price, 0);
  const zone = zones.findAvailable("أكدال");
  const fees = calcTotals(itemsTotal, zone ? zone.fee : 0);
  assert.equal(itemsTotal, 67);
  assert.equal(fees.deliveryFee, 10);
  assert.equal(fees.total, 77);
});

test("orders: confirm only from PENDING_CONFIRMATION / NEW; status flow to DELIVERED", () => {
  const { orders } = make();
  let o = orders.createDraft("+212600000001", "تاكوس دجاج", 1);
  o = orders.requestConfirmation(o);
  assert.equal(o.status, "PENDING_CONFIRMATION");
  o = orders.confirm(o);
  assert.equal(o.status, "CONFIRMED");
  o = orders.transition(o, "PREPARING");
  o = orders.transition(o, "OUT_FOR_DELIVERY");
  o = orders.transition(o, "DELIVERED");
  assert.equal(o.status, "DELIVERED");
  const bad = orders.transition(o, "CONFIRMED");
  assert.ok(bad.error && bad.status, "invalid → error & status unjarred");
});

test("orders: cancel allowed before PREPARING, requires confirm flag", () => {
  const { orders } = make();
  let o = orders.createDraft("+212600000001", "تاكوس دجاج", 1);
  o = orders.requestConfirmation(o);
  o = orders.cancel(o, { confirmed: false });
  assert.notEqual(o.status, "CANCELLED");
  o = orders.cancel(o, { confirmed: true });
  assert.equal(o.status, "CANCELLED");
});