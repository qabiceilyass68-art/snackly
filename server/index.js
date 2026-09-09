import { openDb, seedSettings } from "./src/db.js";
import { ProductRepo, ZoneRepo } from "./src/catalog.js";
import { OrderService } from "./src/orders.js";
import { createTools } from "./src/tools.js";
import { createAgent } from "./src/agent.js";
import { createAdminRouter } from "./src/admin.js";
import { createService } from "./src/httpd.js";
import { config } from "./src/config.js";

const db = openDb(config.dbFile);
seedSettings(db);
const products = new ProductRepo(db);
const zones = new ZoneRepo(db);
const drafts = new Map();
const orders = new OrderService(db, products, zones, { drafts });
const tools = createTools({ db, products, zones, orders, drafts });
const agent = createAgent({ db, products, zones, orders, drafts, tools });
const admin = createAdminRouter({ db, products, zones, orders });

const svc = createService({ db, products, zones, orders, drafts, tools, agent, admin });
svc.listen(config.port).then(s => {
  console.log(`[snackly-api] جاهز على http://localhost:${s.port}`);
  console.log(`[snackly-api] لوحة التحكم: http://localhost:${s.port}/admin.html`);
});