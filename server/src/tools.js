/** أدوات AI — كل عملية خلفية، تُحسب الأسعار من قاعدة البيانات حصراً. */

let __seq = 0;
function nextId(db) {
  const prefix = "WA-";
  __seq++;
  return prefix + String(Date.now().toString(36)).toUpperCase() + __seq;
}
export function createTools(deps) {
  const { db, products, zones, orders } = deps;
  const drafts = deps.drafts || new Map();

  function canon(orderId) {
    const id = orderId || nextId(db);
    if (!drafts.has(id)) drafts.set(id, { id, items: [], status: "NEW", delivery_fee: 0 });
    return drafts.get(id);
  }

  return {
    call(name, args = {}) {
      switch (name) {
        case "get_products": {
          const all = products.all().filter(p => p.available === 1);
          return { ok: true, products: all.map(p => ({ id: p.id, name: p.name, price: p.price, category: p.category, emoji: p.emoji, addons: JSON.parse(p.addons || "[]"), options: JSON.parse(p.options || "[]") })) };
        }
        case "get_product": {
          const p = products.byIdOrAlias(args.id || args.name || "");
          if (!p) return { ok: false, error: "not_found" };
          return { ok: true, product: { id: p.id, name: p.name, price: p.price, category: p.category, emoji: p.emoji, available: !!p.available, addons: JSON.parse(p.addons || "[]"), options: JSON.parse(p.options || "[]") } };
        }
        case "search_products": {
          const q = String(args.q || "");
          const rows = products.find(q);
          return { ok: true, products: rows.map(p => ({ id: p.id, name: p.name, price: p.price })) };
        }
        case "calculate_order": {
          const items = Array.isArray(args.items) ? args.items : [];
          let itemsTotal = 0;
          for (const it of items) {
            const p = products.byIdOrAlias(it.id || it.productId || "");
            if (!p) return { ok: false, error: "product_not_found", productRef: it.id || it.productId };
            itemsTotal += (Number(it.qty) || 1) * p.price;
          }
          let deliveryFee = 0;
          if (args.deliveryZone) {
            const z = zones.findAvailable(args.deliveryZone);
            if (!z) return { ok: false, error: "zone_not_available", zone: args.deliveryZone };
            deliveryFee = z.fee;
          }
          const total = Math.round((itemsTotal + deliveryFee) * 100) / 100;
          return { ok: true, itemsTotal, deliveryFee, total };
        }
        case "calculate_delivery_fee": {
          const z = zones.findAvailable(args.zone || "");
          if (!z) return { ok: false, error: "zone_not_available" };
          return { ok: true, fee: z.fee, etaMin: z.eta_min, zone: z.name };
        }
        case "get_delivery_zones": {
          return { ok: true, zones: zones.list().filter(z => z.available === 1).map(z => ({ id: z.id, name: z.name, fee: z.fee, etaMin: z.eta_min })) };
        }
        case "add_item": {
          const d = canon(args.orderId);
          const p = products.byIdOrAlias(args.productId || args.product || "");
          if (!p) return { ok: false, error: "product_not_found" };
          const qty = Math.max(1, Number(args.qty) || 1);
          const hit = d.items.findIndex(i => i.id === p.id);
          if (hit >= 0) d.items[hit] = { ...d.items[hit], qty: d.items[hit].qty + qty };
          else d.items.push({ id: p.id, name: p.name, qty, price: p.price });
          drafts.set(args.orderId, d);
          return { ok: true, draft: d };
        }
        case "remove_item": {
          const d = canon(args.orderId);
          const p = products.byIdOrAlias(args.productId || args.product || "");
          if (!p) return { ok: false, error: "product_not_found" };
          d.items = d.items.filter(i => i.id !== p.id);
          drafts.set(args.orderId, d);
          return { ok: true, draft: d };
        }
        case "update_item": {
          const d = canon(args.orderId);
          const p = products.byIdOrAlias(args.productId || args.product || "");
          if (!p) return { ok: false, error: "product_not_found" };
          const qty = Math.max(0, Number(args.qty) || 0);
          const hit = d.items.findIndex(i => i.id === p.id);
          if (hit < 0) return { ok: false, error: "line_not_found" };
          d.items[hit] = { ...d.items[hit], qty };
          d.items = d.items.filter(i => i.qty > 0);
          drafts.set(args.orderId, d);
          return { ok: true, draft: d };
        }
        case "create_order": {
          const items = Array.isArray(args.items) ? args.items : [];
          const d = { id: nextId(db), wa_phone: args.waPhone || "", items: [], status: "NEW", delivery_fee: 0 };
          for (const it of items) {
            const p = products.byIdOrAlias(it.id || "");
            if (!p) return { ok: false, error: "product_not_found", productRef: it.id };
            const qty = Math.max(1, Number(it.qty) || 1);
            const hit = d.items.findIndex(i => i.id === p.id);
            if (hit >= 0) d.items[hit] = { ...d.items[hit], qty: d.items[hit].qty + qty };
            else d.items.push({ id: p.id, name: p.name, qty, price: p.price });
          }
          if (d.items.length === 0) return { ok: false, error: "empty_order" };
          d.status = "PENDING_CONFIRMATION";
          drafts.set(d.id, d);
          return { ok: true, order: d };
        }
        case "confirm_order": {
          const d = canon(args.orderId);
          d.status = "CONFIRMED";
          d.confirmed_at = new Date().toISOString();
          const itemsTotal = d.items.reduce((s, i) => s + i.qty * i.price, 0);
          d.total = Math.round((itemsTotal + (d.delivery_fee || 0)) * 100) / 100;
          drafts.set(args.orderId, d);
          orders.save(d, { ...args });
          return { ok: true, order: { ...d, saved: true } };
        }
        case "get_order": {
          const row = orders.load(args.orderId);
          if (!row) return { ok: false, error: "not_found" };
          return row;
        }
        case "update_order": {
          const d = canon(args.orderId);
          if (args.deliveryZone !== undefined) {
            const z = zones.findAvailable(args.deliveryZone);
            if (!z) return { ok: false, error: "zone_not_available" };
            d.zone = z.name;
            d.zone_id = z.id;
            d.delivery_fee = z.fee;
          }
          if (args.address !== undefined) d.address = args.address;
          if (args.area !== undefined) d.area = args.area;
          if (args.notes !== undefined) d.notes = args.notes;
          if (args.customer_name !== undefined) d.customer_name = args.customer_name;
          drafts.set(args.orderId, d);
          return { ok: true, draft: d };
        }
        case "cancel_order": {
          const d = canon(args.orderId);
          if (args.confirmed !== true) return { ok: false, error: "confirmed_required" };
          d.status = "CANCELLED";
          const row = orders.load(args.orderId);
          if (row && row.status === "CONFIRMED") {
            orders.cancel(row, { confirmed: true });
          }
          drafts.set(args.orderId, d);
          return { ok: true, order: d };
        }
        case "handoff_to_human": {
          return { ok: true, handoff: true };
        }
        default:
          return { ok: false, error: "unknown_tool" };
      }
    },
  };
}