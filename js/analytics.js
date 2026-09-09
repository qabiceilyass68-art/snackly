"use strict";
/* ============================================================
 * analytics.js — التحليلات والذكاء التجاري (محلي، لاغي بإحصاء الطلبات)
 * ============================================================ */
const Analytics = (() => {

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function _hourKey(iso) {
    try { return new Date(iso).getHours(); } catch (_) { return -1; }
  }

  function compute(orders, menu) {
    try {
      const active = orders.filter(o => o.status !== ORDER_STATUS.DONE.key && o.status !== ORDER_STATUS.CANCEL.key);
      const done = orders.filter(o => o.status === ORDER_STATUS.DONE.key);

      /* إيرادات ومعدلات */
      const revenue = orders.reduce((s, o) => o.status === ORDER_STATUS.CANCEL.key ? s : s + (Number(o.total) || 0), 0);
      const paidRevenue = done.reduce((s, o) => s + (Number(o.total) || 0), 0);
      const avgOrder = orders.filter(o => o.status !== ORDER_STATUS.CANCEL.key);
      const avgValue = avgOrder.length ? Math.round((revenue / avgOrder.length) * 10) / 10 : 0;

      /* الأكثر مبيعاً (بالكمية) */
      const qtyById = {};
      orders.forEach(o => { if (o.status !== ORDER_STATUS.CANCEL.key) o.items.forEach(i => { qtyById[i.id] = (qtyById[i.id] || 0) + (i.qty || 1); }); });
      const topProducts = Object.keys(qtyById)
        .map(id => {
          const it = menu.find(m => m.id === id);
          return { id, name: it ? it.name : id, emoji: it ? it.emoji : "🍽️", qty: qtyById[id] };
        })
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      /* توزيع التصنيفات بالكمية */
      const catQty = {};
      orders.forEach(o => {
        if (o.status === ORDER_STATUS.CANCEL.key) return;
        o.items.forEach(i => {
          const it = menu.find(m => m.id === i.id);
          const cat = it ? it.category : "أخرى";
          catQty[cat] = (catQty[cat] || 0) + (i.qty || 1);
        });
      });
      const catTotal = Object.values(catQty).reduce((s, v) => s + v, 0) || 1;
      const catShare = Object.keys(catQty)
        .map(c => ({ cat: c, qty: catQty[c], pct: Math.round((catQty[c] / catTotal) * 100) }))
        .sort((a, b) => b.qty - a.qty);

      /* ساعة الذروة */
      const hourQty = {};
      orders.forEach(o => { const h = _hourKey(o.createdAt); if (h >= 0) hourQty[h] = (hourQty[h] || 0) + 1; });
      const peakHour = Object.keys(hourQty).length ? Number(Object.keys(hourQty).reduce((a, b) => (hourQty[b] > hourQty[a] ? b : a))) : null;

      /* توقع مبسط: متوسط طلبات ساعة الذروة في التمثيل التالي */
      let forecastNext = null;
      if (peakHour !== null) {
        const n = hourQty[peakHour];
        /* إن كنا قبل ساعة الذروة نتوقعها، إن مررناها نتوقع سقوطاً */
        const nowH = new Date().getHours();
        forecastNext = Math.max(0, n + (nowH < peakHour ? 2 : -1));
      }

      return {
        totalOrders: orders.length,
        activeCount: active.length,
        active,
        revenue,
        paidRevenue,
        avgValue,
        topProducts,
        catShare,
        peakHour,
        hourQty,
        forecastNext
      };
    } catch (err) {
      Store.log("error", "التحليلات فشلت", err.message);
      return { totalOrders: 0, activeCount: 0, active: [], revenue: 0, paidRevenue: 0, avgValue: 0, topProducts: [], catShare: [], peakHour: null, hourQty: {}, forecastNext: null };
    }
  }

  return { compute, esc };
})();