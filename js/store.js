"use strict";
/* ============================================================
 * store.js — طبقة التخزين الموحدة (localStorage) + سجل الأحداث
 * الوحيدة المسموح لها بلمس localStorage. API عام واحد فقط.
 * ============================================================ */
const Store = (() => {
  const NS = "snackly_";
  const MAX_LOG = 200;

  /* ---------- السجل الداخلي (غير متزامن، حلقي، بلا تكرار) ---------- */
  let _buffer = [];
  try {
    const persisted = JSON.parse(localStorage.getItem(NS + "log") || "null");
    if (Array.isArray(persisted)) _buffer = persisted;
  } catch (_) { /* افتراضي فارغ */ }

  function _persistLog() {
    try { localStorage.setItem(NS + "log", JSON.stringify(_buffer)); } catch (_) { /* تجاهل */ }
  }

  function log(level, msg, data) {
    const entry = {
      t: new Date().toISOString(),
      lv: level, // info | warn | error
      msg: String(msg),
      data: data === undefined ? "" : safeJson(data)
    };
    _buffer.push(entry);
    if (_buffer.length > MAX_LOG) _buffer.splice(0, _buffer.length - MAX_LOG);
    try {
      const sink = console[level] || console.log;
      sink.call(console, "[snackly:" + level + "] " + entry.msg + (entry.data ? " " + entry.data : ""));
    } catch (_) { /* بيئة بلا console */ }
    _persistLog();
    return entry;
  }

  /* JSON آمن يتحمل الدوال/الدرهمات وحالات الغرق */
  function safeJson(value) {
    try {
      const seen = new WeakSet();
      return JSON.stringify(value, (_k, v) => {
        if (typeof v === "function") return "[fn]";
        if (typeof v === "bigint") return String(v);
        if (typeof v === "object" && v !== null) {
          if (seen.has(v)) return "[circular]";
          seen.add(v);
        }
        return v;
      });
    } catch (_) { return String(value); }
  }

  /* ---------- تخزين عام ---------- */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(NS + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      log("error", "فشلت قراءة المفتاح " + key, err && err.message);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value));
      return true;
    } catch (err) {
      log("error", "فشلت كتابة المفتاح " + key + " (ربما التخزين ممتلئ)", err && err.message);
      return false;
    }
  }

  function remove(key) {
    try { localStorage.removeItem(NS + key); return true; }
    catch (err) { log("error", "فشل حذف المفتاح " + key, err && err.message); return false; }
  }

  /* ---------- الجرد ---------- */
  function getMenu() {
    const stored = read("menu", null);
    if (!Array.isArray(stored) || stored.length === 0) {
      const ok = write("menu", MENU_SEED);
      if (!ok) log("warn", "تعذر حفظ الجرد الافتراضي — سيستخدم المؤقت فقط");
      return MENU_SEED.slice();
    }
    /* هجرة: يحدّث الصور من البذرة للأصناف المخزّنة القدام (مؤطئة/ميتة) دون مساس بالأسعار المعدّلة */
    const byId = new Map(MENU_SEED.map(m => [m.id, m]));
    let changed = false;
    const merged = stored.map(m => {
      if (!m || typeof m !== "object") return m;
      const canon = byId.get(m.id);
      if (!canon) return m;
      const next = Object.assign({}, m);
      if (canon.img && next.img !== canon.img) { next.img = canon.img; changed = true; }
      if (!next.emoji && canon.emoji) { next.emoji = canon.emoji; changed = true; }
      return next;
    });
    if (changed) {
      write("menu", merged);
      log("info", "هجرة الجرد: أضيفت الصور للأصناف المخزنة القدام");
    }
    return merged;
  }

  function saveMenu(menu) {
    if (!Array.isArray(menu) || menu.length === 0) { log("warn", "رفض حفظ جرد فارغ"); return false; }
    if (!write("menu", menu)) { log("error", "فشل حفظ الجرد"); return false; }
    log("info", "تم تحديث الجرد (" + menu.length + " صنف)");
    return true;
  }

  /* ---------- الجلسة الزبون ---------- */
  function newSession() {
    const ph = Math.floor(Math.random() * 10);
    const stamp = Date.now().toString(36).toUpperCase();
    const id = "SES-" + stamp + "-" + ph;
    write("sessionId", id);
    write("session", { id, firstSeenAt: new Date().toISOString(), views: {}, adds: [] });
    log("info", "جلسة جديدة " + id);
    return id;
  }

  function getSession() {
    let ses = read("session", null);
    if (ses && ses.id) return ses;
    const id = read("sessionId", null) || newSession();
    ses = read("session", null);
    return ses && ses.id ? ses : newSession();
  }

  function patchSession(patch) {
    const ses = getSession();
    const next = Object.assign({}, ses, patch);
    if (!write("session", next)) log("error", "فشل حفظ الجلسة");
    return next;
  }

  /* ---------- السلة ---------- */
  function getCart() {
    const cart = read("cart", {});
    return typeof cart === "object" && cart !== null ? cart : {};
  }

  function saveCart(cart) {
    const clean = {};
    for (const id of Object.keys(cart)) {
      if (cart[id] && cart[id].qty > 0) clean[id] = { qty: cart[id].qty };
    }
    if (!write("cart", clean)) log("error", "فشل حفظ السلة");
    return clean;
  }

  /* ---------- الطلبات ---------- */
  function getOrders() {
    const orders = read("orders", []);
    return Array.isArray(orders) ? orders : [];
  }

  function saveOrders(orders) {
    if (!Array.isArray(orders)) return false;
    if (!write("orders", orders)) { log("error", "فشل حفظ الطلبات"); return false; }
    return true;
  }

  /* ---------- حجوزات الطاولات ---------- */
  function getReservations() {
    const list = read("reservations", []);
    return Array.isArray(list) ? list : [];
  }

  function saveReservation(entry) {
    const all = getReservations();
    const now = new Date();
    const res = {
      id: "RSV-" + now.getTime().toString(36).toUpperCase(),
      createdAt: now.toISOString(),
      name: String(entry.name || "").trim(),
      date: String(entry.date || ""),
      time: String(entry.time || ""),
      guests: String(entry.guests || "")
    };
    if (!res.name || !res.date || !res.time) return false;
    all.push(res);
    if (!write("reservations", all)) return false;
    return true;
  }

  function nextOrderId() {
    const orders = getOrders();
    let n = read("orderSeq", 0) + 1;
    while (orders.some(o => o.id === "SNK-" + String(n).padStart(4, "0"))) n++;
    write("orderSeq", n);
    return "SNK-" + String(n).padStart(4, "0");
  }

  /* إنشاء طلب جديد: البيئة تحسب الإجمالي والأولوية */
  function createOrder(entry) {
    try {
      const items = entry.items.map(it => ({
        id: it.id, name: it.name, emoji: it.emoji, qty: it.qty, price: it.price, prep: it.prep
      }));
      const count = items.reduce((s, it) => s + it.qty, 0);
      const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
      const totalPrep = items.reduce((s, it) => s + it.prep * it.qty, 0);
      const order = {
        id: nextOrderId(),
        createdAt: new Date().toISOString(),
        sessionId: entry.sessionId || (getSession().id || ""),
        customer: {
          name: String(entry.customer.name || "").trim(),
          phone: String(entry.customer.phone || "").trim(),
          address: String(entry.customer.address || "").trim(),
          payment: String(entry.customer.payment || "cash")
        },
        items,
        count,
        subtotal,
        deliveryFee: 0,
        total: subtotal,
        status: ORDER_STATUS.NEW.key,
        statusHistory: [{ to: ORDER_STATUS.NEW.key, at: new Date().toISOString() }],
        totalPrep,
        priority: 0
      };
      if (!order.customer.name || !order.customer.phone || !order.customer.address) {
        throw new Error("معطيات الزبون ناقصة");
      }
      if (entry.priority !== undefined) order.priority = Number(entry.priority) || 0;
      const orders = getOrders();
      orders.unshift(order);
      if (!saveOrders(orders)) throw new Error("فشل حفظ الطلب");
      log("info", "طلب جديد " + order.id + " — " + count + " صنف، " + order.total, { id: order.id, name: order.customer.name });
      return order;
    } catch (err) {
      log("error", "إنشاء الطلب فشل", err.message);
      return null;
    }
  }

  /* تحديث حالة طلب مع إجبار صحة التسلسل */
  function updateStatus(orderId, toKey, allowAny) {
    const orders = getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) { log("warn", "تحديث حالة طلب غير موجود " + orderId); return null; }
    const order = orders[idx];
    const to = ORDER_STATUS[toKey];
    if (!to) { log("error", "حالة غير معروفة: " + toKey); return null; }
    const stKey = String(order.status || "").toUpperCase();
    const from = ORDER_STATUS[stKey] || ORDER_STATUS.NEW;
    const forward = to.seq >= 0 && to.seq === from.seq + 1;
    const cancelOk = to.seq === -1 && from.seq >= 0 && from.seq < ORDER_STATUS.DONE.seq;
    if (!allowAny && !forward && !cancelOk) {
      log("warn", "تبديل حالة غير مسموح: " + order.status + " -> " + toKey);
      return null;
    }
    order.status = to.key;
    order.statusHistory.push({ to: to.key, at: new Date().toISOString() });
    if (!saveOrders(orders)) { log("error", "فشل حفظ تحديث الحالة " + orderId); return null; }
    log("info", "الطلب " + orderId + " تحول إلى " + to.label);
    return order;
  }

  /* ---------- السجل اليومي الدائم (لا يُمسح إلا يدوياً) ---------- */
  function _dayKey(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  function _readDaily() {
    const map = read("daily", null);
    return map && typeof map === "object" ? map : {};
  }

  function _writeDaily(map) {
    return write("daily", map);
  }

  /* يدمج الحالي مع الطلبات: يعيد حساب كل يوم موجود في الطلبات ويُبقي أيام الماضي المحفوظة
     حتى لو تروّق الطلبات القديمة — عمود الخصوصية الوحيد للتاريخ */
  function _reconcileDaily() {
    const map = _readDaily();
    const byDay = {};
    getOrders().forEach(o => {
      const k = _dayKey(o.createdAt);
      if (!k) return;
      const row = byDay[k] || (byDay[k] = { orders: 0, count: 0, revenue: 0, delivered: 0 });
      row.orders++;
      if (o.status === ORDER_STATUS.CANCEL.key) return;
      row.count++;
      row.revenue += Number(o.total) || 0;
      if (o.status === ORDER_STATUS.DONE.key) row.delivered++;
    });
    let changed = false;
    Object.keys(byDay).forEach(k => {
      const r = byDay[k];
      if (!map[k] || map[k].orders !== r.orders || map[k].count !== r.count || map[k].revenue !== r.revenue || map[k].delivered !== r.delivered) changed = true;
      map[k] = r;
    });
    if (changed) { _writeDaily(map); log("info", "السجل اليومي حُدث"); }
    return map;
  }

  /* مفاتيح الأيام المطلوبة حسب النطاق: اليوم / البارحة / الأسبوع / الشهر / الكل */
  function _rangeKeys(range) {
    const now = new Date();
    if (range === "today") return [_dayKey(now.toISOString())].filter(Boolean);
    if (range === "yesterday") return [_dayKey(new Date(now.getTime() - 86400000).toISOString())].filter(Boolean);
    const n = range === "month" ? 30 : range === "week" ? 7 : 0;
    const keys = [];
    for (let i = n - 1; i >= 0; i--) {
      const k = _dayKey(new Date(now.getTime() - i * 86400000).toISOString());
      if (k) keys.push(k);
    }
    return keys;
  }

  /* إحصاء حسب الفترة: عدد الطلبات، الإيرادات (من غير الملغيات)، معدل الطلب، المسلّمة */
  function getDailyLog(range) {
    const map = _reconcileDaily();
    let keys = Object.keys(map);
    if (range && range !== "all") {
      const wanted = {};
      _rangeKeys(range).forEach(k => { if (k) wanted[k] = true; });
      keys = keys.filter(k => wanted[k]);
    }
    return keys.map(k => {
      const r = map[k] || {};
      return {
        date: k,
        orders: r.orders || 0,
        count: r.count || 0,
        revenue: Math.round((Number(r.revenue) || 0) * 100) / 100,
        delivered: r.delivered || 0,
        avg: (r.count || 0) ? Math.round(((Number(r.revenue) || 0) / r.count) * 10) / 10 : 0
      };
    }).sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  /* مسح يدوي فقط من طرف المالك */
  function clearDailyLog() {
    remove("daily");
    _reconcileDaily();
    log("info", "تم مسح السجل اليومي (يبقى الحالي المستمد من الطلبات)");
    return true;
  }

  /* ---------- سجل الأحداث (عرض للوحة) ---------- */
  function getLog() {
    return _buffer.slice(-MAX_LOG);
  }

  function clearLog() {
    _buffer.length = 0;
    remove("log");
    log("info", "تم مسح سجل النظام");
    return true;
  }

  /* seed بيانات تجريبية للتجربة السريعة في لوحة الإدارة */
  function seedDemoIfEmpty() {
    const orders = getOrders();
    if (orders.length > 0) return false;
    const names = ["يوسف العلوي", "سلمى بناني", "مهدي الإدريسي", "خديجة الزهراوي"];
    const phones = ["0661234567", "0677654321", "0655500123", "0612348765"];
    for (let i = 0; i < 4; i++) {
      const pick = MENU_SEED[i % MENU_SEED.length];
      const created = new Date(Date.now() - (i + 1) * 5400000 + i * 1000).toISOString();
      const order = {
        id: "SNK-" + String(1000 + i).padStart(4, "0"),
        createdAt: created,
        sessionId: "seed-" + i,
        customer: { name: names[i], phone: phones[i], address: "حي أكدال " + (i + 5) + "، الرباط", payment: "cash" },
        items: [{ id: pick.id, name: pick.name, emoji: pick.emoji, qty: 1 + (i % 2), price: pick.price, prep: pick.prep }],
        count: 1 + (i % 2),
        subtotal: pick.price * (1 + (i % 2)),
        deliveryFee: 0,
        total: pick.price * (1 + (i % 2)),
        status: i === 0 ? ORDER_STATUS.NEW.key : i === 1 ? ORDER_STATUS.PREP.key : i === 2 ? ORDER_STATUS.READY.key : ORDER_STATUS.DONE.key,
        statusHistory: [{ to: ORDER_STATUS.NEW.key, at: created }],
        totalPrep: pick.prep * (1 + (i % 2)),
        priority: 0
      };
      orders.push(order);
    }
    saveOrders(orders);
    log("info", "زُرعت بيانات تجريبية (4 طلبات) لسهولة المعاينة");
    return true;
  }

  return {
    log,
    safeJson,
    read,
    write,
    remove,
    getMenu,
    saveMenu,
    getSession,
    patchSession,
    newSession,
    getCart,
    saveCart,
    getOrders,
    saveOrders,
    nextOrderId,
    getReservations,
    saveReservation,
    createOrder,
    updateStatus,
    getDailyLog,
    clearDailyLog,
    getLog,
    clearLog,
    seedDemoIfEmpty
  };
})();