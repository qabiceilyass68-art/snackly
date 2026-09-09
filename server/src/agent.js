import { detectIntent, extractQuantity, normalize } from "./nlp.js";

export function createAgent(deps) {
  const { products, drafts, tools } = deps;
  const states = new Map(); // phone -> { draftId, awaiting }

  function stateFor(phone) {
    let s = states.get(phone);
    if (!s) {
      s = { awaiting: null, draftId: null };
      states.set(phone, s);
    }
    return s;
  }

  function draftFor(phone) {
    const s = states.get(phone);
    return s && s.draftId ? drafts.get(s.draftId) || null : null;
  }

  function fmtItems(items) {
    return items
      .map(i => `· ${i.name} ×${i.qty} = ${i.price * i.qty} دهم`)
      .join("\n");
  }

  function fmtTotals(o) {
    const itemsTotal = o.items.reduce((s, i) => s + i.qty * i.price, 0);
    let txt = `الإجمالي: ${itemsTotal} دهم`;
    if (o.delivery_fee) txt += `\nالتوصيل: ${o.delivery_fee} دهم\nالمجموع: ${o.total} دهم`;
    return txt;
  }

  function respond(text, replyType = "text", extra = {}) {
    return { text, replyType, handoff: false, ...extra };
  }

  /** البحث عن منتج من جملة: مطابقة الاسم الطبيعي داخل النص المدخَّل */
  function findProductInText(text) {
    const norm = normalize(text);
    const all = tools.call("get_products", {}).products;
    let best = null;
    for (const p of all) {
      const pNorm = normalize(p.name);
      if (norm.includes(pNorm)) {
        if (!best || pNorm.length > best.pLen) best = { p, pLen: pNorm.length };
      }
    }
    if (best) return best.p;
    // محاولة أخيرة: آخر كلمة (قد تكون الاسم باللاتيني أو مختصر)
    const words = norm.split(/\s+/).filter(Boolean);
    for (let i = words.length - 1; i >= 0; i--) {
      const probe = products.byIdOrAlias(words[i]);
      if (probe) return probe;
    }
    return null;
  }

  function handleText(phone, rawText) {
    const s = stateFor(phone);
    const text = String(rawText || "").trim();
    if (!text) return respond("بغيتني نقرى ليك؟ 😄");

    const intent = detectIntent(text).intent;

    // 1) انتقال للبشري في أي وقت
    if (intent === "human") {
      s.awaiting = null;
      return respond(
        "واش بغيت تكلّم مع واحد حقيقي؟ أكتر التساني شوية 🌟 راجل خصّك إن شاء الله يوصلك.",
        "text",
        { handoff: true }
      );
    }

    // 2) تأكيد أو إلغاء
    if (intent === "confirm") {
      const d = draftFor(phone);
      if (!d) return respond("ماعنديش طلب حالي باش نأكّد 😅 قُول شنو كتبغى (بصي: \"تاكوس دجاج\").");
      // إذا ما زال NEW ننتقل إلى planمرحلة تأكيد أولاً
      if (!d.status || d.status === "NEW") {
        d.status = "PENDING_CONFIRMATION";
        drafts.set(d.id, d);
        s.awaiting = null;
        return respond(
          `ها ملخص طلبك، تأكد من كل حاجة وجاوب "confirm" للتأكيد النهائي:\n${fmtItems(d.items)}\n${fmtTotals(d)}`,
          "confirm_pending",
          { status: "PENDING_CONFIRMATION" }
        );
      }
      const r = tools.call("confirm_order", { orderId: d.id });
      if (r.ok) {
        s.awaiting = null;
        return respond(
          `✅ تأكد طلبك!\n${fmtItems(d.items)}\n${fmtTotals(d)}\nنستانو منك خير إن شاء الله 🔥`,
          "order_confirmed",
          { status: "CONFIRMED", orderId: d.id }
        );
      }
      return respond("ما قدرتش نأكّد الطلب، جرّب مرة أخرى 🙏");
    }
    if (intent === "cancel") {
      const d = draftFor(phone);
      if (!d) return respond("ماعنديش طلب حالي باش نقصو 😄");
      const r = tools.call("cancel_order", { orderId: d.id, confirmed: true });
      s.awaiting = null;
      return respond(r.ok ? "قصينا الطلب ✅ جرّب طلب آخر على راحتك 😊" : "ما نقص، جرّب مرة ثانية 🙏");
    }

    // 3) القائمة أو التحية
    if (intent === "menu" || intent === "greet") {
      const r = tools.call("get_products", {});
      const cats = {};
      for (const p of r.products) (cats[p.category] = cats[p.category] || []).push(p);
      let txt = "أهلا وسهلا 😋 ها كتالوجنا:\n\n";
      for (const [cat, items] of Object.entries(cats)) {
        txt += `《${cat}》\n`;
        txt += items.map(p => `  ${p.emoji} ${p.name} — ${p.price} دهم`).join("\n") + "\n";
      }
      txt += "\nقول الجزء اللي بغيتيه (بصي: \"تاكوس دجاج\") ونضيفوه لطلبك.";
      return respond(txt, "menu");
    }

    // 4) إدخال منطقة التوصيل (ننتظر الرد) — لكن ليس إذا كانت رسالة إضافة صنف
    if (s.awaiting === "delivery_zone" && !["add", "order"].includes(intent)) {
      const d = draftFor(phone);
      if (d) {
        const zr = tools.call("get_delivery_zones", {});
        const r = tools.call("calculate_order", {
          items: d.items.map(i => ({ id: i.id, qty: i.qty })),
          deliveryZone: text,
        });
        if (r.ok) {
          tools.call("update_order", { orderId: d.id, deliveryZone: text });
          const dd = drafts.get(d.id);
          dd.status = "PENDING_CONFIRMATION";
          drafts.set(dd.id, dd);
          s.awaiting = null;
          return respond(
            `زيان، ${text}. التوصيل ${r.deliveryFee} دهم.\n${fmtItems(dd.items)}\n${fmtTotals(dd)}\n\nبرّد \"confirm\" للتأكد ✅`,
            "confirm_pending",
            { status: "PENDING_CONFIRMATION" }
          );
        }
        return respond(
          `ما عرفتش المنطقة هادي 😅 جرّب: ${zr.zones.map(z => z.name).join("، ")}. وإلا نقصو بلا توصيل.`,
          "text"
        );
      }
      s.awaiting = null;
    }

    // 5) طلب/إضافة صنف
    if (["add", "order"].includes(intent)) {
      const p = findProductInText(text);
      if (p) {
        const qty = extractQuantity(text);
        const r = tools.call("add_item", { orderId: s.draftId || "", productId: p.id, qty });
        if (r.ok) {
          s.draftId = r.draft.id;
          const dd = drafts.get(s.draftId);
          dd.wa_phone = phone;
          drafts.set(dd.id, dd);
          const zonePg = tools.call("get_delivery_zones", {}).zones;
          s.awaiting = "delivery_zone";
          let txt = `زيدناه ليك ✓\n${fmtItems(dd.items)}\n${fmtTotals(dd)}`;
          if (dd.items.length === 1) {
            txt = `ها طلبك حتى البدايه 😋\n${fmtItems(dd.items)}\n${fmtTotals(dd)}`;
          }
          txt += "\n\nواش التوصيل؟ (قول المنطقة أعلاه)";
          return respond(txt, "order", { status: "NEW" });
        }
      }
      return respond(
        `هذا الصنف ما عندناش احصنه فالكتالوج 😕 اكتب \"القائمة\" باش تشوف الخيارات.`,
        "text",
        { productNotFound: true }
      );
    }

    // 6) سلالة مساعدة
    return respond(
      `خير؟ سهرانين 🚀\n• اكتب "القائمة" باش تشوف الأصناف\n• طلب مباشر: "بغيت تاكوس دجاج"\n• واش عندك طلب حالي؟ "confirm"`,
      "assist"
    );
  }

  return { handleText };
}