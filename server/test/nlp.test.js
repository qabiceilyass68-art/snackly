import test from "node:test";
import assert from "node:assert/strict";
import {
  normalize,
  tokenize,
  detectIntent,
  extractQuantity,
  extractProductMentions,
  INTENTS,
} from "../src/nlp.js";

const P = [
  { id: "tacos", name: "تاكوس دجاج", aliases: ["tacos", "taco", "تاكوس", "tks"] },
  { id: "burger", name: "برغر", aliases: ["burger", "برغر", "burgir"] },
  { id: "panini", name: "بانيني", aliases: ["panini", "بانيني"] },
  { id: "pizza", name: "بيتزا", aliases: ["pizza", "بيتزا", "بيتسا"] },
];

test("nlp-normalize: fold Arabic letters + strip French accents", () => {
  assert.equal(normalize("أإآىةؤ"), "ااايهو");
  assert.equal(normalize("É CEst à"), "e cest a");
});

test("nlp-intents: Darija/Arabic/French mix", () => {
  assert.equal(detectIntent("سلام بغيت جوج تاكوس").intent, "order");
  assert.equal(detectIntent("أريد وجبتين تاكوس دجاج").intent, "order");
  assert.equal(detectIntent("Je veux deux tacos poulet").intent, "order");
  assert.equal(detectIntent("واش عندكم panini؟").intent, "availability");
  assert.equal(detectIntent("افتح المنو").intent, "menu");
  assert.equal(detectIntent("شحال الثمن ديال البرغر").intent, "price");
  assert.equal(detectIntent("زيد ليا fromage").intent, "order");
  assert.equal(detectIntent("حيد coca").intent, "order");
  assert.equal(detectIntent("صافي أكد الطلب").intent, "confirm");
  assert.equal(detectIntent("اكد").intent, "confirm");
  assert.equal(detectIntent("بغيت نلغي الطلب").intent, "cancel");
  assert.equal(detectIntent("cancel").intent, "cancel");
  assert.equal(detectIntent("ما بغيتوش الطلب").intent, "cancel");
  assert.equal(detectIntent("بغيت نهضر مع المسؤول").intent, "human");
  assert.equal(detectIntent("عطيني شي واحد").intent, "human");
  assert.equal(detectIntent("تاكو").intent, "order");
});

test("nlp-quantity: words and digits Darija/French/Arabic", () => {
  assert.equal(extractQuantity("جوج تاكوس"), 2);
  assert.equal(extractQuantity("2 تاكوس"), 2);
  assert.equal(extractQuantity("deux tacos"), 2);
  assert.equal(extractQuantity("ثلاثة"), 3);
  assert.equal(extractQuantity("تلاتة"), 3);
  assert.equal(extractQuantity("واحد برغر"), 1);
});

test("nlp-extract: find products amid noise (spelling errors, mixed)", () => {
  const hit = extractProductMentions("بغيت تاكوس دجاج مع fromage وكولا", P);
  assert.deepEqual(hit.map(h => h.id), ["tacos"]);
  const hit2 = extractProductMentions("j ai envie dun burger frite", P, { lang: "fr" });
  assert.equal(hit2[0].id, "burger");
});

test("nlp-extract: quantity attached per product", () => {
  const hits = extractProductMentions("جوج تاكوس وواحد برغر", P, { withQty: true });
  assert.deepEqual(hits.map(h => [h.id, h.qty]), [["tacos", 2], ["burger", 1]]);
});