"use strict";
/* ============================================================
 * app.js — ربط الواجهة بالكامل: المنيو، السلة، إتمام الطلب،
 * التتبع، لوحة الإدارة، التوصيات، المساعد الذكي، السجل.
 * ============================================================ */
(() => {
  const esc = Analytics.esc;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* بوابة تفاعل الصور: التخفي/الحركة فقط عندما تعمل الجافا سكربت */
  try { document.documentElement.classList.add("motion"); } catch (_) {}

  /* مراقب كشف الوصول: أي عنصر [data-reveal] يظهر بحركة عند بلوغه (الموقع يتفاعل مع المستخدم) */
  const revealIO = ("IntersectionObserver" in window) ? new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        en.target.classList.add("is-in");
        revealIO.unobserve(en.target);
      }
    }
  }, { threshold: 0.12 }) : null;

  function observeReveals(scope, stagger) {
    const root = scope || document;
    $$("[data-reveal]", root).forEach((el, i) => {
      if (stagger) el.style.setProperty("--reveal-delay", (i % stagger) * 0.045 + "s");
      if (!revealIO) { el.classList.add("is-in"); return; }
      const r = el.getBoundingClientRect();
      if (r.top < (window.innerHeight || document.documentElement.clientHeight) * 0.96 && r.bottom > 0) el.classList.add("is-in");
      else revealIO.observe(el);
    });
  }

  /* مسح إضافي عند التمرير: أي عنصر كشف يصل إلى الشاشة يظهر فوراً (يعمل في كل البيئات) */
  function scanReveals() {
    $$("[data-reveal]:not(.is-in)").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < (window.innerHeight || document.documentElement.clientHeight) * 0.96 && r.bottom > 0) el.classList.add("is-in");
    });
  }
  let revealRaf = 0;
  window.addEventListener("scroll", () => {
    if (revealRaf) return;
    revealRaf = requestAnimationFrame(() => { revealRaf = 0; scanReveals(); });
  });
  /* ضمان إضافي: مسح دوري خفيف يتوقف عند اكتمال كشف كل العناصر (يعمل في كل البيئات) */
  const revealTimer = window.setInterval(() => {
    scanReveals();
    if ($$("[data-reveal]:not(.is-in)").length === 0) window.clearInterval(revealTimer);
  }, 200);

  const state = { tab: "customer", category: "all", query: "", dailyRange: "week" };

  /* سقوط صورة فاشلة إلى الإيموجي (رابط ميت/بلا إنترنت) */
  window.imgFail = function (el) {
    try {
      const emoji = el && el.getAttribute && el.getAttribute("data-emoji");
      if (!emoji || !el.parentNode) return;
      const span = document.createElement("span");
      span.className = "card-emoji";
      span.setAttribute("aria-hidden", "true");
      span.textContent = emoji;
      el.replaceWith(span);
    } catch (err) { Store.log("warn", "بديل الصورة فشل", err.message); }
  };

  /* بوابة لوحة الإدارة: الرمز في BUSINESS.adminPin (مخزّن في الجلسة) بذاكرة احتياطية */
  const AUTH_KEY = "snackly_admin_ok";
  let _authCache = null;
  function adminAuthed() {
    if (_authCache === null) {
      try { _authCache = sessionStorage.getItem(AUTH_KEY) === "1"; }
      catch (_) { _authCache = false; }
    }
    return _authCache;
  }
  function setAdminAuth() {
    _authCache = true;
    try { sessionStorage.setItem(AUTH_KEY, "1"); } catch (_) { /* تبقى في الذاكرة */ }
  }
  function clearAdminAuth() {
    _authCache = false;
    try { sessionStorage.removeItem(AUTH_KEY); } catch (_) { /* تجاهل */ }
  }
  function openPinModal() {
    $("#pin-modal").hidden = false;
    document.body.style.overflow = "hidden";
    const pin = $("#pin-form").pin;
    if (pin && pin.focus) pin.focus();
  }
  function closePinModal() {
    $("#pin-modal").hidden = true;
    document.body.style.overflow = "";
    $("#pin-error").textContent = "";
    const pin = $("#pin-form").pin;
    if (pin) pin.value = "";
  }
  function openQrModal() {
    const site = location.href;
    $("#qr-img").src = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=" + encodeURIComponent(site);
    $("#qr-link").setAttribute("href", site);
    $("#qr-modal").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeQrModal() {
    $("#qr-modal").hidden = true;
    document.body.style.overflow = "";
  }
  function submitPin(ev) {
    ev.preventDefault();
    const pin = $("#pin-form").pin;
    const val = (pin && pin.value || "").trim();
    if (checkAdminPin(val)) {
      setAdminAuth();
      Store.log("info", "فتحت لوحة الإدارة بالرمز الصحيح");
      closePinModal();
      switchTab("admin");
      toast("مرحبا بيك فاللوحة 🔓", "ok");
    } else {
      Store.log("warn", "رمز دخول خاطئ للوحة الإدارة");
      $("#pin-error").textContent = "الرمز غالط، عاود جرب";
      if (pin) { pin.value = ""; pin.focus(); }
    }
  }

  /* ---------- أدوات عامة ---------- */
  function toast(msg, kind) {
    const wrap = $("#toast-wrap");
    const el = document.createElement("div");
    el.className = "toast " + (kind || "ok");
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; }, 3200);
    setTimeout(() => el.remove(), 3600);
  }

  const fmtMoney = n => (Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ---------- المظهر ---------- */
  function initTheme() {
    const saved = Store.read("theme", null);
    const dark = saved === "dark" || (saved === null && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }
  function toggleTheme() {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    Store.write("theme", next);
    Store.log("info", "المظهر تبدل إلى " + next);
  }

  /* ---------- الجرد والجلسة ---------- */
  let menu = [];

  function loadMenu() {
    menu = Store.getMenu();
  }

  function menuById(id) { return menu.find(m => m.id === id) || null; }

  /* ---------- السلة ---------- */
  function cart() { return Store.getCart(); }

  function cartCount() { return Object.values(cart()).reduce((s, l) => s + (l.qty || 0), 0); }

  function cartTotal() {
    return Object.keys(cart()).reduce((sum, id) => {
      const it = menuById(id);
      const line = cart()[id];
      return it ? sum + it.price * line.qty : sum;
    }, 0);
  }

  function cartLines() {
    return Object.keys(cart()).map(id => {
      const it = menuById(id);
      const qty = cart()[id].qty || 0;
      return it ? { it, qty, total: it.price * qty } : null;
    }).filter(Boolean);
  }

  function addToCart(id) {
    const c = cart();
    c[id] = { qty: (c[id] && c[id].qty || 0) + 1 };
    Store.saveCart(c);
    const ses = Store.getSession();
    const adds = (ses.adds || []).concat(id).slice(-20);
    Store.patchSession({ adds });
    renderCartUI();
    Store.log("info", "أُضيف للسلة: " + id);
    toast("زدناه فالسلة ✅");
  }

  function changeQty(id, delta) {
    const c = cart();
    const cur = (c[id] && c[id].qty || 0) + delta;
    if (cur <= 0) delete c[id]; else c[id] = { qty: cur };
    Store.saveCart(c);
    renderCartUI();
  }

  function removeFromCart(id) {
    const c = cart();
    delete c[id];
    Store.saveCart(c);
    renderCartUI();
  }

  /* ---------- رسم السلة والواجهة العلوية ---------- */
  function renderCartUI() {
    const count = cartCount();
    const badge = $("#cart-count");
    badge.hidden = count === 0;
    badge.textContent = count;
    renderCartDrawer();
  }

  function renderCartDrawer() {
    const box = $("#cart-items");
    const lines = cartLines();
    if (lines.length === 0) {
      box.innerHTML = '<p class="empty-note">' + esc(Lang.t("cart_empty")) + '</p>';
    } else {
      box.innerHTML = lines.map(l => `
        <div class="cart-item">
          <span class="ci-emoji">${l.it.emoji}</span>
          <div class="ci-info">
            <div class="ci-name">${esc(Lang.dish(l.it.id))}</div>
            <div class="ci-price">${l.it.price} ${esc(Lang.t("currency"))} × ${l.qty}</div>
          </div>
          <div class="qty-ctl" data-qty="${l.it.id}">
            <button class="qty-btn" type="button" data-q="down" aria-label="نقص">−</button>
            <span class="qty-num">${l.qty}</span>
            <button class="qty-btn" type="button" data-q="up" aria-label="زيد">+</button>
          </div>
          <button class="ci-remove" type="button" data-remove="${l.it.id}">🗑</button>
        </div>`).join("");
    }
    $("#cart-total").textContent = fmtMoney(cartTotal());
    $("#checkout-total").textContent = fmtMoney(cartTotal());
    const btn = $("#cart-checkout");
    btn.disabled = lines.length === 0;
    renderCheckoutLines();
  }

  function renderCheckoutLines() {
    const box = $("#checkout-items");
    box.innerHTML = cartLines().map(l => `<div class="line"><span>${esc(l.it.emoji)} ${esc(Lang.dish(l.it.id))} × ${l.qty}</span><strong>${fmtMoney(l.total)}</strong></div>`).join("")
      || '<p class="empty-note">' + esc(Lang.t("cart_empty")) + '</p>';
  }

  /* ---------- المنيو ---------- */
  function buildChips() {
    const counts = {};
    menu.forEach(m => { counts[m.category] = (counts[m.category] || 0) + 1; });
    $("#cat-chips").innerHTML = CATEGORIES.map(c => {
      const count = counts[c.key] || 0;
      return `<button class="chip ${state.category === c.key ? "is-active" : ""}" type="button" data-cat="${esc(c.key)}">
        ${c.emoji} ${esc(Lang.cat(c.key))} <span class="chip-count">${count}</span></button>`;
    }).join("");
  }

  function trackView(id) {
    const ses = Store.getSession();
    const views = Object.assign({}, ses.views || {});
    views[id] = (views[id] || 0) + 1;
    Store.patchSession({ views });
  }

  function renderMenu() {
    buildChips();
    const q = state.query.trim().toLowerCase();
    const list = menu.filter(m => (state.category === "all" ? true : m.category === state.category))
      .filter(m => !q || m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q));
    $("#menu-empty").hidden = list.length > 0;
    const grid = $("#menu-grid");
    grid.innerHTML = list.map(m => menuCard(m)).join("");
    observeReveals(grid, 8);
    list.forEach(m => trackView(m.id));
  }

  /* صورة الصنف مع سقوط آمن إلى الإيموجي عند فشل التحميل + حركة وصول */
  function itemVisual(it) {
    return '<img class="card-img" src="' + it.img + '" alt="' + esc(it.name) + '" data-emoji="' + it.emoji + '" loading="lazy" onerror="imgFail(this)" data-reveal>';
  }

  function menuCard(m) {
    const inCart = cart()[m.id];
    return `
      <article class="menu-card glass-card is-new" role="listitem">
        <div class="card-visual">
          ${itemVisual(m)}
          ${m.hot ? '<span class="badge-hot badge-hot-corner">' + esc(Lang.t("hot")) + '</span>' : ""}
        </div>
        <h3>${esc(Lang.dish(m.id))}</h3>
        <p>${esc(Lang.dish(m.id, "desc"))}</p>
        <div class="prep-note">${esc(Lang.t("prep_note"))} ~${m.prep} ${esc(Lang.t("prep_min"))}</div>
        <div class="card-foot">
          <span class="price">${m.price} <small>${esc(Lang.t("currency"))}</small></span>
          <button class="btn btn-primary btn-sm" type="button" data-add="${m.id}">${inCart ? esc(Lang.t("add_more")) : esc(Lang.t("add"))}</button>
        </div>
      </article>`;
  }

  /* ---------- التوصيات ---------- */
  function renderRecommendations() {
    const recs = AI.recommend(6, cart(), Store.getSession());
    const row = $("#rec-row");
    $("#rec-hint").textContent = recs.length ? Lang.t("rec_h1") : Lang.t("rec_h0");
    row.innerHTML = recs.map(r => `
      <div class="rec-card glass-card" role="listitem">
        <span class="rec-reason">${esc(recReasonText(r.reason))}</span>
        <div class="rec-visual">${itemVisual(r.item)}</div>
        <h4>${esc(Lang.dish(r.item.id))}</h4>
        <div class="rec-foot">
          <span class="price">${r.item.price} <small>${esc(Lang.t("currency"))}</small></span>
          <button class="btn btn-outline btn-sm" type="button" data-add="${r.item.id}">${esc(Lang.t("add"))}</button>
        </div>
      </div>`).join("");
    observeReveals(row, 6);
  }

  function recReasonText(reason) {
    if (!reason) return "";
    const mapList = [
      [/الأكثر/, Lang.t("rec_reason_top") + " 🔥"],
      [/تحب/, Lang.t("rec_reason_you")],
      [/الزبناء/, Lang.t("rec_reason_loved")],
      [/سلتك/, Lang.t("rec_reason_pair")],
      [/ذكي/, Lang.t("rec_reason_smart")],
      [/جديد/, Lang.t("rec_reason_new")],
      [/الساخن/, Lang.t("rec_reason_menu")]
    ];
    for (const pair of mapList) if (pair[0].test(reason)) return pair[1];
    return reason;
  }

  function renderAllCustomer() {
    renderMenu();
    renderRecommendations();
    renderTracking();
  }

  /* ---------- التواصل والموقع ---------- */
  function renderContact() {
    const mapSrc = mapEmbedUrl();
    $("#map-frame").src = mapSrc;
    const openLink = "https://www.openstreetmap.org/?mlat=" + BUSINESS.location.lat + "&mlon=" + BUSINESS.location.lng + "#map=15/" + BUSINESS.location.lat + "/" + BUSINESS.location.lng;
    $("#contact-address").textContent = BUSINESS.address;
    $("#contact-hours").textContent = Lang.t("hours_ph") + " " + BUSINESS.openHour + ":00 " + Lang.t("hours_sep") + " " + BUSINESS.closeHour + ":00";
    $("#contact-phone").textContent = BUSINESS.phone;
    $("#contact-wa-num").textContent = "+" + BUSINESS.whatsapp;
    const waUrl = waHref(Lang.t("wa_msg_first") + " " + BUSINESS.name + " 😊");
    $("#wa-fab").href = waUrl;
    $("#contact-wa-btn").href = waUrl;
    $("#contact-phone-btn").href = openLink;
    const callFab = $("#call-fab");
    if (callFab) callFab.href = "tel:" + BUSINESS.phone;
    const fc = $("#footer-city");
    if (fc) fc.textContent = BUSINESS.city || "";
    const pp = $("#promo-poster");
    if (pp && GALLERY && GALLERY.promo) pp.src = GALLERY.promo;
    hydratePromoVideo();
    const st = $("#store-img");
    if (st && GALLERY && GALLERY.storefront) st.src = GALLERY.storefront;
    observeReveals(document);
    renderSocials();
  }

  function hydratePromoVideo() {
    const box = $("#promo-video");
    if (!box) return;
    const reel = $("#promo-reel");
    const stored = Store.read("promoVideo", "");
    if (stored && reel) {
      reel.src = stored;
      reel.muted = true;
      box.classList.add("has-video");
      reel.play().catch(() => { /* autoplay قد يُحجب حتى التفاعل — يكفي العرض */ });
    } else if (reel) {
      reel.removeAttribute("src");
      box.classList.remove("has-video");
    }
  }

  function updatePromoVideoState() {
    const st = $("#promo-video-state");
    if (!st) return;
    st.textContent = Store.read("promoVideo", "") ? "✓ فيديو محمّل — الآن يعرض في الريلز 9:16" : "لا فيديو بعد — البوستر ظاهر";
  }

  function onPromoVideoUpload(e) {
    const input = e.target;
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 3.5 * 1024 * 1024) {
      toast("الفيديو كبير جداً — الحد التخزيني للمتصفح ≈3.5MB؛ اختر مقطعاً قصيراً أو ضغّطه", "err");
      input.value = "";
      return;
    }
    const rd = new FileReader();
    rd.onload = () => {
      const dataUrl = String(rd.result || "");
      if (!Store.write("promoVideo", dataUrl)) {
        toast("ما كانسال الحفظ — التخزين المحلي ممتلئ", "err");
        input.value = "";
        return;
      }
      Store.log("info", "رُفع فيديو ترويجي (" + Math.round(file.size / 1024) + " KB)");
      hydratePromoVideo();
      updatePromoVideoState();
      toast("تم رفع الفيديو الترويجي 🎬", "ok");
      input.value = "";
    };
    rd.onerror = () => { toast("تعذّرت قراءة الملف", "err"); };
    rd.readAsDataURL(file);
  }

  function onPromoVideoClear() {
    Store.remove("promoVideo");
    Store.log("info", "مُسح الفيديو الترويجي");
    hydratePromoVideo();
    updatePromoVideoState();
    toast("تم مسح الفيديو الترويجي", "ok");
  }

  /* ---------- M15: الشريط / الآراء / المنصات / الحجز / الشكاوى / اللغة ---------- */
  function renderTicker() {
    const track = $("#ticker-track");
    if (!track) return;
    const items = (Lang.ticker() || []).map(t => '<span class="ticker-item">' + esc(t) + '</span>').join("");
    track.innerHTML = items + items;
  }

  function starsHtml(n) {
    const s = Math.max(0, Math.min(5, Math.round(n || 0)));
    return "★".repeat(s) + "☆".repeat(5 - s);
  }

  function renderReviews() {
    const box = $("#reviews-row");
    if (!box) return;
    box.innerHTML = (REVIEWS || []).map(r => `
      <article class="review-card glass-card" role="listitem" data-reveal>
        <div class="review-head">
          <span class="review-ava">${r.avatar ? '<img class="ava-img" src="' + esc(r.avatar) + '" alt="" loading="lazy" onerror="this.remove()">' : esc(String(r.name || "؟").slice(0, 1))}</span>
          <span class="review-stars">${starsHtml(r.stars)}</span>
        </div>
        <p class="review-text">${esc(r.text)}</p>
        <span class="review-meta">${esc(r.name)} • ${esc(r.date)}</span>
      </article>`).join("");
    observeReveals(box, 4);
  }

  function renderSocials() {
    const row = $("#socials-row");
    if (!row) return;
    row.innerHTML = (SOCIALS || []).map(s => {
      const href = s.id === "whatsapp" ? waHref(BUSINESS.name) : (s.href || "#");
      return '<a class="social-link" href="' + esc(href) + '" target="_blank" rel="noopener" data-social="' + esc(s.id) + '" data-reveal>' + esc(s.emoji) + ' ' + esc(s.label) + '</a>';
    }).join("");
    observeReveals(row, 4);
  }

  function submitReserve(ev) {
    ev.preventDefault();
    const f = ev.target;
    const err = $("#reserve-error");
    err.textContent = "";
    const name = String(f.res_name.value || "").trim();
    const date = String(f.res_date.value || "").trim();
    const time = String(f.res_time.value || "").trim();
    if (name.length < 3 || !date || !time) { err.textContent = Lang.t("reserve_err"); return; }
    Store.saveReservation({ name, date, time, guests: f.res_guests.value });
    Store.log("info", "حجز طاولة جديد: " + name + " — " + date + " " + time);
    toast(Lang.t("reserve_ok"), "ok");
    f.reset();
    f.res_guests.value = "2";
  }

  function sendComplaint() {
    const url = waHref(Lang.t("compl_def"));
    if (window.open) window.open(url, "_blank", "noopener");
    else location.href = url;
    toast(Lang.t("compl_ok"), "ok");
  }

  function setLang(code) {
    Lang.set(code);
    syncLang();
  }

  function syncLang() {
    renderTicker();
    renderAllCustomer();
    renderContact();
    renderCartDrawer();
    renderCheckoutLines();
  }

  function toggleLangMenu() {
    const menu = $("#lang-menu"), btn = $("#lang-btn");
    menu.hidden = !menu.hidden;
    btn.setAttribute("aria-expanded", menu.hidden ? "false" : "true");
  }

  function hideLangMenu() {
    const menu = $("#lang-menu"), btn = $("#lang-btn");
    if (!menu.hidden) { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }
  }

  /* ---------- التتبع ---------- */
  function progressFor(order) {
    if (order.status === ORDER_STATUS.CANCEL.key) return `<span class="progress-step is-cancel">${ORDER_STATUS.CANCEL.emoji} ${ORDER_STATUS.CANCEL.label}</span>`;
    const seq = ORDER_STATUS[order.status.toUpperCase()] ? ORDER_STATUS[order.status.toUpperCase()].seq : 0;
    return [ORDER_STATUS.NEW, ORDER_STATUS.PREP, ORDER_STATUS.READY, ORDER_STATUS.DONE].map(st => {
      const cls = st.seq < seq ? "is-done" : st.seq === seq ? "is-current" : "";
      return `<span class="progress-step ${cls}">${st.emoji} ${st.label}</span>`;
    }).join("");
  }

  function renderTracking() {
    const sid = Store.getSession().id;
    const mine = Store.getOrders().filter(o => o.sessionId === sid && o.status !== ORDER_STATUS.DONE.key).slice(0, 5);
    const box = $("#tracking-list");
    if (!mine.length) {
      box.innerHTML = '<p class="empty-note">' + esc(Lang.t("track_empty")) + '</p>';
      return;
    }
    box.innerHTML = mine.map(o => `
      <article class="track-card glass-card">
        <div class="track-head">
          <strong class="track-id">${esc(o.id)}</strong>
          <span>${ORDER_STATUS[o.status.toUpperCase()] ? ORDER_STATUS[o.status.toUpperCase()].label : esc(o.status)}</span>
        </div>
        <div class="track-items">${esc(o.items.map(i => Lang.dish(i.id) + " × " + i.qty).join(" • "))} — ${fmtMoney(o.total)} ${esc(Lang.t("currency"))}</div>
        <div class="progress">${progressFor(o)}</div>
      </article>`).join("");
  }

  /* ---------- السلة / النوافذ ---------- */
  function openDrawer() { $("#cart-drawer").classList.add("is-open"); $("#cart-drawer").setAttribute("aria-hidden", "false"); $("#overlay").hidden = false; }
  function closeDrawer() { $("#cart-drawer").classList.remove("is-open"); $("#cart-drawer").setAttribute("aria-hidden", "true"); $("#overlay").hidden = true; }
  function openModal() {
    renderCartDrawer();
    $("#checkout-modal").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal() { $("#checkout-modal").hidden = true; document.body.style.overflow = ""; $("#checkout-error").textContent = ""; }

  /* ---------- إتمام الطلب ---------- */
  function submitOrder(ev) {
    ev.preventDefault();
    const form = $("#checkout-form");
    const errBox = $("#checkout-error");
    errBox.textContent = "";
    $$(".field input.is-invalid", form).forEach(i => i.classList.remove("is-invalid"));

    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const address = form.address.value.trim();
    const payment = (form.querySelector('input[name="payment"]:checked') || {}).value || "cash";

    const invalid = [];
    if (name.length < 3) invalid.push("السمية");
    if (!/^[0-9+ ()-]{9,18}$/.test(phone)) invalid.push("رقم الهاتف");
    if (address.length < 5) invalid.push("العنوان");
    if (invalid.length) {
      errBox.textContent = "رجاء إكمال: " + invalid.join("، ") + " بشكل صحيح";
      [["name", name.length < 3], ["phone", !/^[0-9+ ()-]{9,18}$/.test(phone)], ["address", address.length < 5]].forEach(([key, bad]) => {
        if (bad) form[key].classList.add("is-invalid");
      });
      return;
    }

    const lines = cartLines();
    if (!lines.length) { errBox.textContent = "السلة خاوية — زيد شي صنف الأول"; return; }

    const base = {
      customer: { name, phone, address, payment },
      items: lines.map(l => ({ id: l.it.id, name: l.it.name, emoji: l.it.emoji, qty: l.qty, price: l.it.price, prep: l.it.prep }))
    };
    const order = Store.createOrder(Object.assign({}, base, { sessionId: Store.getSession().id }));
    if (!order) { errBox.textContent = "تعذر حفظ الطلب — جرب من جديد"; return; }

    order.priority = AI.computePriority(order);
    const orders = Store.getOrders();
    const idx = orders.findIndex(o => o.id === order.id);
    if (idx > -1) { orders[idx].priority = order.priority; Store.saveOrders(orders); }

    Store.saveCart({});
    renderCartUI();
    closeModal();
    closeDrawer();
    renderTracking();
    renderMenu();
    renderRecommendations();
    toast("تم الطلب بنجاح! رقمه: " + order.id + " 🎉", "ok");
    const trackSection = $("#tracking");
    if (trackSection && trackSection.scrollIntoView) trackSection.scrollIntoView({ behavior: "smooth" });
  }

  /* ---------- لوحة الإدارة ---------- */
  function labelsForPriority(p) {
    if (p >= 170) return { cls: "prio-high", txt: "أولوية قصوى 🚨", val: "عاجل" };
    if (p >= 145) return { cls: "prio-medium", txt: "أولوية متوسطة ⚡", val: "متوسط" };
    return { cls: "prio-low", txt: "أولوية عادية 🐢", val: "عادي" };
  }

  function adminCards(a) {
    const peak = a.peakHour === null ? "—" : a.peakHour + ":00";
    const cards = [
      { label: "طلبات نشطة", value: a.activeCount, sub: "فالطابور دابا" },
      { label: "الإيرادات", value: fmtMoney(a.revenue) + " د", sub: "من غير الملغيات" },
      { label: "معدل الطلب", value: fmtMoney(a.avgValue) + " د", sub: "متوسط السلة" },
      { label: "ساعة الذروة", value: peak, sub: a.forecastNext === null ? "" : "توقع: ~" + a.forecastNext + " طلب قريباً" }
    ];
    $("#admin-cards").innerHTML = cards.map(c => `
      <div class="admin-card glass-card">
        <span class="a-label">${esc(c.label)}</span>
        <span class="a-value">${esc(c.value)}</span>
        <span class="a-sub">${esc(c.sub)}</span>
      </div>`).join("");
  }

  function renderOrdersQueue() {
    const orders = AI.sortQueue(Store.getOrders());
    const active = orders.filter(o => o.status !== ORDER_STATUS.DONE.key && o.status !== ORDER_STATUS.CANCEL.key);
    $("#orders-hint").textContent = "مرتبين بالذكاء: العاجل لول الطابور";
    const box = $("#order-queue");
    if (!active.length) {
      box.innerHTML = '<p class="empty-note">ما كتبش طلب جديد — الكل تم ✅</p>';
      return;
    }
    box.innerHTML = active.map(o => {
      const prio = labelsForPriority(o.priority || AI.computePriority(o));
      const st = ORDER_STATUS[o.status.toUpperCase()] || ORDER_STATUS.NEW;
      const nextKey = o.status === ORDER_STATUS.NEW.key ? "PREP" : o.status === ORDER_STATUS.PREP.key ? "READY" : "DONE";
      const nextBtn = o.status !== ORDER_STATUS.DONE.key && o.status !== ORDER_STATUS.CANCEL.key
        ? `<button class="btn btn-success btn-sm" type="button" data-status="${o.id}:${nextKey}">${ORDER_STATUS[nextKey].emoji} ${ORDER_STATUS[nextKey].label}</button>`
        : "";
      const cancelBtn = o.status !== ORDER_STATUS.DONE.key && o.status !== ORDER_STATUS.CANCEL.key
        ? `<button class="btn btn-danger btn-sm" type="button" data-status="${o.id}:CANCEL">❌ أُلغي</button>`
        : "";
      const wait = o.status === ORDER_STATUS.PREP.key || o.status === ORDER_STATUS.READY.key ? AI.estimateWait(o) + " دقيقة متبقية" : "";
      return `
      <article class="order-item ${prio.cls}">
        <div class="oi-head">
          <span class="oi-id">${esc(o.id)}</span>
          <span class="oi-status">${st.emoji} ${st.label}</span>
        </div>
        <div class="oi-title">${esc(o.customer.name)} — ${esc(o.items.map(i => i.name + "×" + i.qty).join(" • "))}</div>
        <div class="oi-meta">📞 ${esc(o.customer.phone)} • 📍 ${esc(o.customer.address)} • 💳 ${esc({ cash: "كاش", card: "كارت", cmi: "CMI" }[o.customer.payment] || o.customer.payment)}</div>
        <div class="oi-priority">${prio.txt} (${o.priority || AI.computePriority(o)}) ${wait ? "• ⏱ " + esc(wait) : ""}</div>
        <div class="oi-actions">
          ${nextBtn}
          ${cancelBtn}
          <span class="oi-total">${fmtMoney(o.total)} درهم</span>
        </div>
      </article>`;
    }).join("");
  }

  function renderAnalytics(a) {
    const body = $("#analytics-body");
    const maxTop = a.topProducts.reduce((s, p) => Math.max(s, p.qty), 1);
    const top = a.topProducts.length
      ? a.topProducts.map(p => `
        <div class="bar-row">
          <span class="bar-label">${esc(p.emoji)} ${esc(p.name)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${Math.round((p.qty / maxTop) * 100)}%"></span></span>
          <span class="bar-value">${p.qty}</span>
        </div>`).join("")
      : '<p class="empty-note">كيبداو الطلبات، كنشوفو الأكثر مبيعاً.</p>';
    const cats = a.catShare.length
      ? a.catShare.map(c => `<span class="pill">${esc(c.cat)} ${c.pct}%</span>`).join("")
      : '<p class="empty-note">لا إحصائيات بعد.</p>';
    body.innerHTML = `
      <div class="anl-block">
        <h4>⬆️ الأكثر مبيعاً (بالكمية)</h4>
        <div class="bar-list">${top}</div>
      </div>
      <div class="anl-block">
        <h4>🗂 توزيع التصنيفات</h4>
        <div class="pill-row">${cats}</div>
      </div>`;
  }

  function renderLog() {
    const log = Store.getLog();
    $("#log-view").innerHTML = log.length
      ? log.slice().reverse().map(e => {
          const time = new Date(e.t).toLocaleTimeString("ar-MA") || "";
          return `<div class="log-line lv-${e.lv}"><span class="lv">[${esc(e.lv)}]</span> ${esc(time)} — ${esc(e.msg)}${e.data && e.data !== "[]" && e.data !== "{}" ? " " + esc(e.data) : ""}</div>`;
        }).join("")
      : '<p class="empty-note">السجل خاوي.</p>';
  }

  function renderDailyLog() {
    const rows = Store.getDailyLog(state.dailyRange);
    const now = new Date();
    const today = now.getFullYear() + "-" + ("0" + (now.getMonth() + 1)).slice(-2) + "-" + ("0" + now.getDate()).slice(-2);
    $("#daily-hint").textContent = "دائم — لا يُمسح إلا بزر المسح من طرف المالك. الملغي ما كيتحتسبش فالإيرادات" + (rows.length ? "" : " • بانتظار أول طلب");
    $("#daily-body").innerHTML = rows.length
      ? rows.map(r => `
        <tr class="${r.date === today ? "d-today" : ""}">
          <td>${esc(r.date)}${r.date === today ? " ⭐ اليوم" : ""}</td>
          <td class="d-num">${r.orders}</td>
          <td class="d-num">${fmtMoney(r.revenue)} درهم</td>
          <td class="d-num">${fmtMoney(r.avg)} درهم</td>
          <td class="d-num">${r.delivered}</td>
        </tr>`).join("")
      : '<tr><td colspan="5" class="d-empty">ما كاينش سجل فهاد الفترة.</td></tr>';
  }

  function refreshAdmin() {
    const a = Analytics.compute(Store.getOrders(), menu);
    adminCards(a);
    renderOrdersQueue();
    renderAnalytics(a);
    renderDailyLog();
    renderLog();
    updatePromoVideoState();
  }

  /* ---------- المساعد الذكي ---------- */
  function chatOpen() { $("#chat-panel").classList.add("is-open"); $("#chat-panel").setAttribute("aria-hidden", "false"); $("#chat-field").focus(); }
  function chatClose() { $("#chat-panel").classList.remove("is-open"); $("#chat-panel").setAttribute("aria-hidden", "true"); }

  function chatBubble(text, who) {
    const log = $("#chat-log");
    const div = document.createElement("div");
    div.className = "msg " + (who === "user" ? "msg-user" : "msg-bot");
    if (who === "user") {
      div.textContent = text;
    } else {
      div.innerHTML = esc(text).replace(/(https:\/\/wa\.me\/\S+)/g, '<a class="chat-link" href="$1" target="_blank" rel="noopener" dir="ltr">$1</a>');
    }
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function chatTyping() {
    const log = $("#chat-log");
    const div = document.createElement("div");
    div.className = "msg msg-bot msg-typing";
    div.innerHTML = "<span></span><span></span><span></span>";
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function sendChat(text) {
    if (!text.trim()) return;
    chatBubble(text, "user");
    const ghost = chatTyping();
    setTimeout(() => {
      ghost.remove();
      chatBubble(AI.chatAnswer(text), "bot");
    }, 550 + Math.random() * 500);
  }

  function welcomeChat() {
    if (Store.read("chatWelcomed", false)) return;
    Store.write("chatWelcomed", true);
    setTimeout(() => chatBubble("السلام عليكم! 👋 أنا سنوكلي الذكي. اسألني على المنيو، الثمن، ولا طلبك.", "bot"), 600);
  }

  /* ---------- التبويبات ---------- */
  function switchTab(tab) {
    if (tab === "admin" && !adminAuthed()) { openPinModal(); return; }
    state.tab = tab;
    $$(".tab-btn").forEach(b => b.classList.toggle("is-active", b.dataset.tab === tab));
    $("#view-customer").classList.toggle("is-visible", tab === "customer");
    $("#view-admin").classList.toggle("is-visible", tab === "admin");
    $(".site-header").scrollIntoView({ behavior: "smooth", block: "start" });
    if (tab === "admin") refreshAdmin();
    if (tab === "customer") renderAllCustomer();
  }

  /* ---------- ربط الأحداث ---------- */
  function bindEvents() {
    document.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-add]");
      if (addBtn) { addToCart(addBtn.dataset.add); renderRecommendations(); return; }

      const qtyBtn = e.target.closest("[data-qty]");
      if (qtyBtn) {
        const id = qtyBtn.dataset.qty;
        const dir = e.target.closest("[data-q]").dataset.q;
        changeQty(id, dir === "up" ? 1 : -1);
        renderRecommendations();
        return;
      }
      const rmBtn = e.target.closest("[data-remove]");
      if (rmBtn) { removeFromCart(rmBtn.dataset.remove); return; }

      const chipBtn = e.target.closest("[data-cat]");
      if (chipBtn) { state.category = chipBtn.dataset.cat; state.query = ""; $("#menu-search-input").value = ""; renderMenu(); return; }

      const dailyBtn = e.target.closest("[data-daily]");
      if (dailyBtn) {
        state.dailyRange = dailyBtn.dataset.daily;
        $$("[data-daily]").forEach(b => b.classList.toggle("is-active", b === dailyBtn));
        renderDailyLog();
        return;
      }

      const statusBtn = e.target.closest("[data-status]");
      if (statusBtn) {
        const [oid, key] = statusBtn.dataset.status.split(":");
        const res = Store.updateStatus(oid, key, key === "CANCEL");
        if (res) { toast("الطلب " + oid + " → " + ORDER_STATUS[key].label, "ok"); renderOrdersQueue(); refreshAdmin(); if (state.tab === "customer") renderTracking(); }
        else toast("تبديل الحالة غير مسموح ⚠️", "err");
        return;
      }

      const tabBtn = e.target.closest("[data-tab]");
      if (tabBtn) { switchTab(tabBtn.dataset.tab); return; }

      const scrollBtn = e.target.closest("[data-scroll-to]");
      if (scrollBtn) { const el = $(scrollBtn.dataset.scrollTo); if (el) el.scrollIntoView({ behavior: "smooth" }); return; }

      if (e.target.closest("[data-cart-close]") || e.target.closest("#overlay")) closeDrawer();
      if (e.target.closest("[data-checkout-close]")) closeModal();
      if (e.target.closest("[data-pin-close]")) { closePinModal(); return; }
      if (e.target.closest("[data-qr-close]")) { closeQrModal(); return; }
      if (e.target.closest("[data-chat-open]")) { chatOpen(); return; }
      if (e.target.closest("[data-chat-close]")) { chatClose(); return; }

      const langBtn = e.target.closest("#lang-btn");
      if (langBtn) { toggleLangMenu(); return; }
      const langPick = e.target.closest("[data-lang]");
      if (langPick) { setLang(langPick.dataset.lang); hideLangMenu(); return; }
      if (!e.target.closest("#lang-switch-head")) hideLangMenu();
    });

    const reserveForm = $("#reserve-form");
    if (reserveForm) reserveForm.addEventListener("submit", submitReserve);
    const complaintBtn = $("#complaint-send");
    if (complaintBtn) complaintBtn.addEventListener("click", sendComplaint);

    $("#cart-open").addEventListener("click", () => { renderCartDrawer(); openDrawer(); });
    $("#cart-checkout").addEventListener("click", () => { if (!cartCount()) return; openModal(); });
    $("#checkout-form").addEventListener("submit", submitOrder);
    $("#theme-toggle").addEventListener("click", toggleTheme);
    $("#menu-search-input").addEventListener("input", (e) => { state.query = e.target.value; renderMenu(); });
    $("#admin-refresh").addEventListener("click", () => { refreshAdmin(); toast("تم تحديث اللوحة ↻", "ok"); });
    $("#admin-logout").addEventListener("click", () => { clearAdminAuth(); Store.log("info", "خرج من لوحة الإدارة"); switchTab("customer"); toast("خرجتي من اللوحة 🔒", "ok"); });
    $("#pin-form").addEventListener("submit", submitPin);
    $("#log-clear").addEventListener("click", () => { Store.clearLog(); renderLog(); toast("تم مسح السجل", "ok"); });
    const promoFile = $("#promo-video-file");
    if (promoFile) promoFile.addEventListener("change", onPromoVideoUpload);
    const promoClear = $("#promo-video-clear");
    if (promoClear) promoClear.addEventListener("click", onPromoVideoClear);
    $("#daily-clear").addEventListener("click", () => { Store.clearDailyLog(); renderDailyLog(); toast("تم مسح السجل اليومي 🗑", "ok"); });
    $("#chat-fab").addEventListener("click", chatOpen);
    const qrFab = $("#qr-fab");
    if (qrFab) qrFab.addEventListener("click", openQrModal);
    $("#chat-form").addEventListener("submit", (e) => { e.preventDefault(); sendChat($("#chat-field").value); $("#chat-field").value = ""; });
  }

  /* ---------- الإقلاع ---------- */
  function init() {
    try {
      initTheme();
      storeSeedIfNeeded();
      loadMenu();
      Lang.apply();
      bindEvents();
      renderCartUI();
      renderAllCustomer();
      renderContact();
      renderTicker();
      renderReviews();
      updateHero();
      scanReveals();
      switchTab("customer");
      welcomeChat();
      Store.log("info", "الموقع إقلع بنجاح — جاهز للاستخدام");
    } catch (err) {
      Store.log("error", "فشل الإقلاع", err && err.stack || err && err.message || String(err));
    }
  }

  function storeSeedIfNeeded() {
    const fresh = Store.getMenu();
    if (fresh.length === MENU_SEED.length) Store.seedDemoIfEmpty();
  }

  function updateHero() {
    $("#stat-items").textContent = menu.length;
    $("#stat-orders").textContent = Store.getOrders().length;
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();