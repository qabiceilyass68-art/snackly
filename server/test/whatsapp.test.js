import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verifyWebhook, verifySignature, extractMessages, formatCaller, SEND_BACKEND } from "../src/whatsapp.js";

test("whatsapp: verifyWebhook uses configured verify token", () => {
  const ok = verifyWebhook({ "hub.mode": "subscribe", "hub.verify_token": "secret-123", "hub.challenge": "chg" }, "secret-123");
  assert.equal(ok, "chg");
  const bad = verifyWebhook({ "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "chg" }, "secret-123");
  assert.equal(bad, 403);
});

test("whatsapp: verifySignature validates HMAC-SHA256 for known app secret", () => {
  const secret = "app-secret-key";
  const raw = JSON.stringify({ foo: "bar" });
  const sig = "sha256=" + createHash("sha256").update(secret + raw).digest("hex");
  assert.equal(verifySignature({ "x-hub-signature-256": sig }, raw, secret), true);
  const bad = "sha256=" + createHash("sha256").update("other" + raw).digest("hex");
  assert.equal(verifySignature({ "x-hub-signature-256": bad }, raw, secret), false);
  // بدون إمضاء → يرفض في وضع live
  assert.equal(verifySignature({}, raw, secret), false);
});

test("whatsapp: extractMessages handles a single inbound text message", () => {
  const body = {
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          metadata: { display_phone_number: "1650212345", phone_number_id: "PHONE1" },
          contacts: [{ wa_id: "212650169277" }],
          messages: [{ from: "212650169277", id: "wamid.1", type: "text", text: { body: "بغيت تاكوس" }, timestamp: "1699999999" }],
        },
      }],
    }],
  };
  const msgs = extractMessages(body);
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].from, "+212650169277");
  assert.equal(msgs[0].text, "بغيت تاكوس");
  assert.equal(msgs[0].phoneNumberId, "PHONE1");
});

test("whatsapp: extractMessages ignores statuses / empty", () => {
  const statusesOnly = JSON.parse('{"entry":[{"changes":[{"field":"messages","value":{"statuses":[{"id":"x"}]}}]}]}');
  assert.equal(extractMessages(statusesOnly).length, 0);
  assert.equal(extractMessages({}).length, 0);
});

test("whatsapp: formatCaller normalizes + and long digits", () => {
  assert.equal(formatCaller("212650169277"), "+212650169277");
  assert.equal(formatCaller("+212650169277"), "+212650169277");
});

test("whatsapp: sendBackend counts messages; sandbox replies without network", async () => {
  let sent = 0;
  const opts = { live: false, phoneNumberId: "PHONE1", accessToken: "TOK", graphApiVersion: "v19.0" };
  const send = SEND_BACKEND(opts, { log: () => {}, onSend: () => sent++ });
  const r = await send.sendText("+212650169277", "مرحبا", { echo: false });
  // sandbox: لا استدعاء خارجي، يرجّع fake id
  assert.equal(r.ok, true);
  assert.equal(r.sent, false);
  assert.equal(sent, 0);
});