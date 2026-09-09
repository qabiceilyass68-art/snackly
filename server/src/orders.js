import { ORDER_STATUS } from "./db.js";

export function nextOrderId(db, prefix = "SNK-") {
  const row = db.prepare("SELECT COUNT(*) AS n FROM orders").get();
  return prefix + String(1000 + row.n + 1);
}

export function calcTotals(itemsTotal, deliveryFee = 0) {
  const t = Math.round(itemsTotal * 100) / 100;
  const d = Math.round(deliveryFee * 100) / 100;
  return { itemsTotal: t, deliveryFee: d, total: Math.round((t + d) * 100) / 100 };
}

export class OrderService {
  constructor(db, products, zones, opts = {}) {
    this.db = db;
    this.products = products;
    this.zones = zones;
    this.drafts = opts.drafts || new Map();
  }

  resolveProduct(ref) {
    return this.products.byIdOrAlias(ref);
  }

  createDraft(waPhone, productRef, qty = 1) {
    const p = this.resolveProduct(productRef);
    if (!p) return { error: "product_not_found" };
    const items = [{ id: p.id, name: p.name, qty: Math.max(1, Number(qty) || 1), price: p.price }];
    const t = calcTotals(items.reduce((s, i) => s + i.qty * i.price, 0), 0);
    const o = { id: nextOrderId(this.db), wa_phone: waPhone, items, status: "NEW", ...t };
    this.drafts.set(o.id, o);
    return o;
  }

  _upsertLine(o, id, cursor) {
    const line = o.items.findIndex(i => i.id === id);
    if (line >= 0) o.items[line].qty = cursor;
    else o.items.push({ id: cursorRef(id), name: id, qty: 1, price: 0 }); // لا يُستخدم
    return o;
  }

  addLine(o, productRef, qty = 1) {
    const p = this.resolveProduct(productRef);
    if (!p) return { ...o, error: "product_not_found" };
    const q = Math.max(1, Number(qty) || 1);
    const items = o.items.slice();
    const hit = items.findIndex(i => i.id === p.id);
    if (hit >= 0) items[hit] = { ...items[hit], qty: items[hit].qty + q };
    else items.push({ id: p.id, name: p.name, qty: q, price: p.price });
    const t = calcTotals(items.reduce((s, i) => s + i.qty * i.price, 0), o.delivery_fee || 0);
    const r = { ...o, items, ...t, error: undefined };
    this._sync(r);
    return r;
  }

  setLineQty(o, productRef, qty) {
    const p = this.resolveProduct(productRef);
    if (!p) return { ...o, error: "product_not_found" };
    const items = o.items.slice();
    const hit = items.findIndex(i => i.id === p.id);
    if (hit < 0) return { ...o, error: "line_not_found" };
    items[hit] = { ...items[hit], qty: Math.max(0, Number(qty) || 0) };
    const filtered = items.filter(i => i.qty > 0);
    const t = calcTotals(filtered.reduce((s, i) => s + i.qty * i.price, 0), o.delivery_fee || 0);
    const r = { ...o, items: filtered, ...t, error: undefined };
    this._sync(r);
    return r;
  }

  removeLine(o, productRef) {
    const p = this.resolveProduct(productRef);
    if (!p) return { ...o, error: "product_not_found" };
    const items = o.items.filter(i => i.id !== p.id);
    const t = calcTotals(items.reduce((s, i) => s + i.qty * i.price, 0), o.delivery_fee || 0);
    const r = { ...o, items, ...t, error: undefined };
    this._sync(r);
    return r;
  }

  applyDelivery(o, zoneName) {
    const z = this.zones.findAvailable(zoneName);
    if (!z) return { ...o, error: "zone_not_available" };
    const t = calcTotals(o.items.reduce((s, i) => s + i.qty * i.price, 0), z.fee);
    const r = { ...o, zone: z, delivery_fee: z.fee, zone_id: z.id, ...t, error: undefined };
    this._sync(r);
    return r;
  }

  requestConfirmation(o) {
    if (o.error) return o;
    const r = { ...o, status: "PENDING_CONFIRMATION" };
    this._sync(r);
    return r;
  }

  confirm(o) {
    if (o.items && o.items.length === 0) return { ...o, error: "empty_order" };
    const st = (o.status || "NEW").toUpperCase();
    if (st !== "PENDING_CONFIRMATION" && st !== "NEW") return { ...o, error: "invalid_status" };
    const confirmed = {
      ...o,
      status: "CONFIRMED",
      confirmed_at: new Date().toISOString(),
      items_total: o.items_total ?? o.items.reduce((s, i) => s + i.qty * i.price, 0),
    };
    const t = calcTotals(confirmed.items_total, o.delivery_fee || 0);
    const r = { ...confirmed, ...t };
    this._sync(r);
    return r;
  }

  _sync(o) {
    if (o && o.id && !o.error) this.drafts.set(o.id, o);
    return o;
  }

  transition(o, toStatus) {
    const to = String(toStatus || "").toUpperCase();
    if (!ORDER_STATUS.includes(to)) return { ...o, error: "invalid_status" };
    const from = (o.status || "NEW").toUpperCase();
    const order = [...ORDER_STATUS];
    const fi = order.indexOf(from), ti = order.indexOf(to);
    const allowed = {
      CONFIRMED: ["PREPARING", "CANCELLED"],
      PREPARING: ["OUT_FOR_DELIVERY", "CANCELLED"],
      OUT_FOR_DELIVERY: ["DELIVERED"],
      DELIVERED: [],
      CANCELLED: [],
    };
    if (from === "NEW" && ["PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"].includes(to)) {
      return { ...o, error: "invalid_status" };
    }
    if (allowed[from] && !allowed[from].includes(to)) {
      return { ...o, error: "invalid_status" };
    }
    return this._sync({ ...o, status: to });
  }

  cancel(o, { confirmed = false } = {}) {
    if (confirmed !== true) return o; // require explicit confirm
    const st = (o.status || "NEW").toUpperCase();
    if (["DELIVERED", "CANCELLED"].includes(st)) return { ...o, error: "invalid_status" };
    return this._sync({ ...o, status: "CANCELLED" });
  }

  /** حفظ نهائي للطلب المؤكد في قاعدة البيانات */
  save(o, extra = {}) {
    const items = (o.items || []).map(i => ({
      id: i.id, name: i.name, qty: i.qty, price: i.price,
    }));
    const t = calcTotals(items.reduce((s, i) => s + i.qty * i.price, 0), o.delivery_fee || 0);
    this.db
      .prepare(
        `INSERT INTO orders (id, wa_phone, customer_name, customer_phone, city, area, address, delivery_type, zone_id, notes, items, items_total, delivery_fee, total, status, confirmed_at, ai_summary, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`
      )
      .run(
        String(o.id || nextOrderId(this.db)),
        String(o.wa_phone || ""),
        String(extra.customer_name || o.customer_name || ""),
        String(extra.customer_phone || o.customer_phone || o.wa_phone || ""),
        String(extra.city || o.city || ""),
        String(extra.area || o.area || ""),
        String(extra.address || o.address || ""),
        String(o.delivery_type || "pickup"),
        o.zone_id ?? null,
        String(extra.notes || o.notes || ""),
        JSON.stringify(items),
        t.itemsTotal,
        t.deliveryFee,
        t.total,
        String(o.status || "CONFIRMED"),
        o.confirmed_at || (o.status === "CONFIRMED" ? new Date().toISOString() : null),
        String(extra.ai_summary || o.ai_summary || "")
      );
    return this.load(o.id);
  }

  load(id) {
    const row = this.db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    if (!row) return null;
    return { ...row, items: JSON.parse(row.items || "[]") };
  }

  listFor(phone) {
    return this.db
      .prepare("SELECT * FROM orders WHERE wa_phone = ? ORDER BY created_at DESC LIMIT 20")
      .all(phone)
      .map(r => ({ ...r, items: JSON.parse(r.items || "[]") }));
  }

  list(limit = 100) {
    return this.db
      .prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT ?")
      .all(limit)
      .map(r => ({ ...r, items: JSON.parse(r.items || "[]") }));
  }
}

function cursorRef(id) { return id; }