import test from "node:test";
import assert from "node:assert/strict";
import { openDb, seedSettings } from "../src/db.js";
import { ProductRepo, ZoneRepo } from "../src/catalog.js";
import { OrderService } from "../src/orders.js";
import { createTools } from "../src/tools.js";
import { createAgent } from "../src/agent.js";

function make() {
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
  return { db, products, zones, orders, drafts, tools, agent };
}

test("agent: greeting returns menu handler and products from DB", () => {
  const { agent } = make();
  const r = agent.handleText("+212600000001", "سلام");
  assert.equal(r.replyType, "menu");
  assert.match(r.text, /تاكوس دجاج/);
  assert.match(r.text, /كوكا/);
});

test("agent: order intent adds item, then confirm flow saves order", () => {
  const { agent, orders } = make();
  let r = agent.handleText("+212600000001", "بغيت تاكوس دجاج");
  assert.equal(r.replyType, "order");
  assert.match(r.text, /30/);
  r = agent.handleText("+212600000001", "زيد ليا كوكا");
  assert.match(r.text, /37/); // 30+7
  r = agent.handleText("+212600000001", "ملي زين");
  assert.equal(r.status, "PENDING_CONFIRMATION");
  r = agent.handleText("+212600000001", "confirm");
  assert.equal(r.status, "CONFIRMED");
  assert.equal(orders.listFor("+212600000001").length, 1);
});

test("agent: quantity words respected (تلاتة → 3)", () => {
  const { agent } = make();
  const r = agent.handleText("+212600000001", "عطيني تلاتة تاكوس");
  assert.match(r.text, /3/);
  assert.match(r.text, /90/); // 3×30
});

test("agent: unknown product → never invents price", () => {
  const { agent } = make();
  const r = agent.handleText("+212600000001", "بغيت كشري");
  assert.match(r.text, /ما عندناش/);
});

test("agent: human handoff (عطيني شي واحد)", () => {
  const { agent } = make();
  const r = agent.handleText("+212600000001", "عطيني شي واحد");
  assert.equal(r.handoff, true);
});

test("agent: delivery zone pricing applied on confirm", () => {
  const { agent, orders } = make();
  let r = agent.handleText("+212600000001", "بغيت كوكا");
  r = agent.handleText("+212600000001", "أكدال");
  assert.equal(r.status, "PENDING_CONFIRMATION");
  r = agent.handleText("+212600000001", "confirm");
  const saved = orders.listFor("+212600000001")[0];
  assert.equal(saved.total, 17); // 7 + 10 livraison
});