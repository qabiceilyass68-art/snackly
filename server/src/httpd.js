import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { verifyWebhook, verifySignature, extractMessages, SEND_BACKEND } from "./whatsapp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** تجميع كل شيء في خادم HTTP واحد: /webhook + /api + static + لوحة. */
export function createService(deps) {
  const { db, products, zones, orders, drafts, tools, agent, admin } = deps;
  const verifyToken = deps.verifyToken || config.whatsappVerifyToken;
  const appSecret = deps.appSecret || config.whatsappAppSecret;
  const live = !!deps.live || !!config.whatsappLive;
  const phoneNumberId = deps.phoneNumberId || config.whatsappPhoneNumberId;
  const accessToken = deps.accessToken || config.whatsappAccessToken;
  const graphApiVersion = config.graphApiVersion || "v19.0";

  const send = SEND_BACKEND(
    { live, phoneNumberId, accessToken, graphApiVersion },
    {
      log: msg => console.log(msg),
      onSend: () => {},
    }
  );

  const processed = new Set(); // dedup بواسطة message id

  function persistInbound(msg) {
    db.prepare(
      "INSERT OR IGNORE INTO conversations (wa_phone, last_activity) VALUES (?, datetime('now'))"
    ).run(msg.from);
    db.prepare(
      "INSERT INTO messages (wa_phone, direction, text, status, wa_msg_id) VALUES (?, 'in', ?, 'received', ?)"
    ).run(msg.from, msg.text, msg.messageId);
  }

  async function processInbound(msg) {
    if (processed.has(msg.messageId)) return;
    processed.add(msg.messageId);
    persistInbound(msg);

    const conv = db.prepare("SELECT * FROM conversations WHERE wa_phone = ?").get(msg.from);
    const enabled = conv ? conv.bot_enabled : 1;
    const globalOn = Number(db.prepare("SELECT value FROM settings WHERE key='bot_global_enabled'").get()?.value || "1");

    if (!enabled || !globalOn) {
      await send.sendText(msg.from, "شكراً على رسالتك! المالك سيرد عليك شخصياً قريباً 💙");
      return;
    }

    const reply = agent.handleText(msg.from, msg.text);
    await send.sendText(msg.from, reply.text);
    db.prepare("INSERT INTO messages (wa_phone, direction, text, status) VALUES (?, 'out', ?, 'delivered')").run(msg.from, reply.text);
    if (reply.handoff) {
      db.prepare("UPDATE conversations SET bot_enabled = 0 WHERE wa_phone = ?").run(msg.from);
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://" + req.headers.host);
    const pathname = decodeURIComponent(url.pathname);

    // ===== Webhook (Meta WhatsApp) =====
    if (pathname === "/webhook") {
      if (req.method === "GET") {
        const challenge = verifyWebhook(Object.fromEntries(url.searchParams), verifyToken);
        if (challenge === 403) {
          res.writeHead(403, { "content-type": "text/plain" });
          res.end("Invalid token");
          return;
        }
        res.writeHead(200, { "content-type": "text/plain" });
        res.end(String(challenge));
        return;
      }
      if (req.method === "POST") {
        let raw = "";
        req.setEncoding("utf8");
        for await (const chunk of req) raw += chunk;
        if (live && appSecret) {
          const ok = verifySignature(req.headers, raw, appSecret);
          if (!ok) {
            res.writeHead(401, { "content-type": "text/plain" });
            res.end("Invalid signature");
            return;
          }
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ received: true }));
        const body = JSON.parse(raw || "{}");
        const msgs = extractMessages(body);
        for (const m of msgs) {
          processInbound(m).catch(e => console.error("[webhook:inbound]", e.message));
        }
        return;
      }
      res.writeHead(405); res.end();
      return;
    }

    // ===== Admin API =====
    if (pathname.startsWith("/api/")) {
      let raw = "";
      req.setEncoding("utf8");
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw || "{}") : {};
      const outcome = admin.route(req.method, pathname, body, req.headers);
      res.writeHead(outcome.status, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(outcome.body));
      return;
    }

    // ===== Static: index.html + لوحة admin =====
    const publicDir = deps.publicDir || path.join(__dirname, "..", "public");
    let file = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    file = path.basename(file) || "index.html";
    const safe = path.join(publicDir, file);
    if (!safe.startsWith(path.resolve(publicDir))) {
      res.writeHead(403); res.end(); return;
    }
    if (fs.existsSync(safe) && fs.statSync(safe).isFile()) {
      const ext = path.extname(safe);
      const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
      res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
      fs.createReadStream(safe).pipe(res);
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found");
  });

  return {
    server,
    port: null,
    listen(port, host = "0.0.0.0") {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          this.port = server.address().port;
          resolve(this);
        });
      });
    },
    close() {
      return new Promise(res => {
        if (typeof server.closeAllConnections === "function") server.closeAllConnections();
        server.close(() => res());
      });
    },
  };
}