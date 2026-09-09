import { createHash, timingSafeEqual } from "node:crypto";

/** التحقق من طلب تفعيل الـwebhook من Meta (GET). */
export function verifyWebhook(query, verifyToken) {
  if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === verifyToken) {
    return query["hub.challenge"] || 403;
  }
  return 403;
}

/** التحقق من إمضاء X-Hub-Signature-256 عبر App Secret. */
export function verifySignature(headers, rawBody, appSecret) {
  const sig = headers["x-hub-signature-256"] || "";
  if (!sig || !appSecret) return false;
  const expected = "sha256=" + createHash("sha256").update(appSecret + rawBody).digest("hex");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** استخراج رسائل النص الواردة من جسم الـwebhook. */
export function extractMessages(body) {
  const out = [];
  const entries = body?.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const ch of changes) {
      const v = ch.value || {};
      const msgs = v.messages || [];
      for (const m of msgs) {
        if (m.type !== "text") continue;
        out.push({
          from: formatCaller(m.from || ""),
          messageId: m.id || "",
          text: (m.text && m.text.body) || "",
          timestamp: m.timestamp || "",
          phoneNumberId: v.metadata?.phone_number_id || "",
          displayPhoneNumber: v.metadata?.display_phone_number || "",
        });
      }
    }
  }
  return out;
}

/** توحيد الصيغة الدولية للأرقام المغربية: بدون + أمامي يعبئه، وبدون صفر رئيسي. */
export function formatCaller(raw) {
  let s = String(raw || "").replace(/\s+/g, "");
  if (s.startsWith("+")) return s;
  if (/^212/.test(s) && s.length === 12) return "+" + s;
  if (s.startsWith("0")) s = s.slice(1);
  if (/^212\d{9}$/.test(s)) return "+" + s;
  return "+" + s;
}

/** الـbackend المرسل عبر Graph API — في وضع sandbox يرجّع دون شبكة. */
export function SEND_BACKEND(opts, hooks = {}) {
  const { live, phoneNumberId, accessToken, graphApiVersion } = opts;
  const log = hooks.log || (() => {});
  return {
    async sendText(to, text, extra = {}) {
      if (!live) {
        log("[whatsapp:dev] سأرسل إلى", to, "->", String(text).slice(0, 60));
        return { ok: true, sent: false, id: `fake-${Date.now()}` };
      }
      const url = `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`;
      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: extra.previewUrl ?? false, body: text },
      };
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        log("[whatsapp:err]", res.status, JSON.stringify(data).slice(0, 300));
        return { ok: false, error: data.error?.message || `HTTP ${res.status}` };
      }
      hooks.onSend && hooks.onSend();
      return { ok: true, sent: true, id: data.messages?.[0]?.id || "" };
    },
  };
}