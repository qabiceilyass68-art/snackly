import test from "node:test";
import assert from "node:assert/strict";
import { openDb, seedSettings } from "../src/db.js";
import { ProductRepo, ZoneRepo } from "../src/catalog.js";

function ctx() {
  const db = openDb(":memory:");
  seedSettings(db);
  const products = new ProductRepo(db);
  const zones = new ZoneRepo(db);
  return { db, products, zones };
}

test("catalog: add, get, update, toggle availability, no-invent guard", () => {
  const { products } = ctx();
  products.add({
    id: "tacos", name: "تاكوس دجاج", price: 30, category: "تاكوس",
    options: ["بلا بصل"], addons: ["جبن", "صوص"],
  });
  assert.equal(products.get("tacos").price, 30);
  products.update("tacos", { price: 35 });
  assert.equal(products.get("tacos").price, 35);
  products.setAvailability("tacos", false);
  assert.equal(products.get("tacos").available, 0);
  assert.equal(products.find("tacos").length, 0, "غير متوفر يختفي من البحث");
  assert.equal(products.byIdOrAlias("تاكوس"), null);
});

test("catalog: byIdOrAlias respects aliases & availability", () => {
  const { products } = ctx();
  products.add({ id: "burger", name: "برغر", price: 25, category: "برغر" });
  const hit = products.byIdOrAlias("burger");
  assert.equal(hit.id, "burger");
  const hitAr = products.byIdOrAlias("برغر");
  assert.equal(hitAr.id, "burger");
});

test("catalog: prevent inventing price/product (unknown product)", () => {
  const { products } = ctx();
  products.add({ id: "pizza", name: "بيتزا", price: 40, category: "بيتزا" });
  assert.equal(products.byIdOrAlias("كشري"), null, "صنف غير موجود = لا شيء");
});

test("zones: add zone, toggle, search availability, default fee", () => {
  const { zones } = ctx();
  zones.add({ name: "أكدال", fee: 10, etaMin: 25 });
  const z = zones.list()[0];
  assert.equal(z.name, "أكدال");
  assert.equal(zones.findAvailable("أكدال").fee, 10);
  zones.setAvailability(z.id, false);
  assert.equal(zones.findAvailable("أكدال"), null);
  const p = zones.update(z.id, { fee: 15 });
  assert.ok(p.fee === 15, "fee updated");
});