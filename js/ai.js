"use strict";
/* ============================================================
 * ai.js — محرك الذكاء المحلي ثلاثي الوظائف:
 *  1) توصيات ذكية (شعبية + سلوك الجلسة co-occurrence)
 *  2) مساعد ذكي (تعريف نوايا بالداريجة عبر keywords)
 *  3) توجيه الطلبات (معادلة أولوية أتماتيكية)
 * ============================================================ */
const AI = (() => {

  /* ---------- 1) التوصيات ---------- */
  function _popularityScores(orders, menu) {
    const scores = {};
    for (const it of menu) scores[it.id] = 0;
    orders.forEach(o => {
      o.items.forEach(it => {
        if (scores[it.id] !== undefined) scores[it.id] += it.qty;
      });
    });
    return scores;
  }

  /* من استخدم هذا الصنف، ماذا أخذ معه؟ (co-occurrence) */
  function _cooccurrence(orders, couples) {
    const paired = new Set(); // "idA|idB" متناظر مفهرسة مرتين فقط
    orders.forEach(o => {
      const ids = o.items.map(i => i.id);
      if (ids.length < 2) return;
      const sorted = ids.slice().sort();
      for (let a = 0; a < sorted.length; a++) {
        for (let b = a + 1; b < sorted.length; b++) {
          const left = sorted[a], right = sorted[b];
          if (left === right) continue;
          const key = left < right ? left + "|" + right : right + "|" + left;
          if (!paired.has(left + "|" + right)) { paired.add(left + "|" + right); couples[key] = (couples[key] || 0) + 1; }
        }
      }
    });
  }

  /* اقترح k صنفاً: الجدد للجلسة، ما هو موجود في السلة، والأغلى منطقياً */
  function recommend(k, cart, session) {
    try {
      const orders = Store.getOrders();
      const menu = Store.getMenu();
      const pop = _popularityScores(orders, menu);
      const couples = {};
      _cooccurrence(orders, couples);

      const inCart = new Set(Object.keys(cart || {}));
      const views = (session && session.views) || {};
      const recentAdds = (session && session.adds) || [];

      const scores = menu.map(it => {
        let s = 0;
        // 1) شعبية تاريخية (وزن 40%)
        s += (pop[it.id] || 0) * 40;
        // 2) نضارة: الصنف الجديد ما زال في الجلسة مفتوحاً (وزن 5%)
        s += (views[it.id] || 0) * 5;
        // 3) علاقة تجميعية: شوهد/أُضيف إلى السلة مع آخر إضافات (وزن 60%)
        recentAdds.forEach(addId => {
          if (addId === it.id) return;
          const key = addId < it.id ? addId + "|" + it.id : it.id + "|" + addId;
          s += (couples[key] || 0) * 60;
        });
        // 4) دعم: صنف رائج بثبات
        if (it.hot) s += 3;
        return { item: it, score: s };
      });
      // استثن الموجود في السلة، رتب تنازلياً، خذ k
      const picks = scores
        .filter(x => !inCart.has(x.item.id))
        .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
        .slice(0, k);
      if (picks.length === 0) return [];
      const top = picks[0].score;
      return picks.map(p => ({
        item: p.item,
        reason: _reasonFor(p, top, couples, recentAdds, pop)
      }));
    } catch (err) {
      Store.log("warn", "التوصيات فشلت", err.message);
      const menu = Store.getMenu();
      return menu.filter(m => !(cart && cart[m.id])).slice(0, k).map(m => ({ item: m, reason: "من المنيو الساخن 🔥" }));
    }
  }

  function _reasonFor(p, topScore, couples, recentAdds, pop) {
    if (p.item.hot) return "من الأكثر طلباً 🔥";
    if (pop[p.item.id] > 0) return "أحبوه الزبناء كتير ⭐";
    if (recentAdds.length > 0) return "كيمشي مزيان مع سلتك 🤝";
    if (p.score >= topScore * 0.7) return "خيار ذكي ويناسبك ✨";
    return "اقتراح جديد ليك 🆕";
  }

  /* ---------- 2) المساعد الذكي ---------- */
  const INTENTS = [
    /* طلبات التواصل مع صاحب الموقع — أولاًّ كي لا تخطفها نوايا القائمة/الطلب */
    {
      id: "owner",
      keys: ["المالك", "صاحب المحل", "صاحب الموقع", "الرقم ديال", "الرقم ديالو", "بغيت نهدر مع", "بغيت نتواصل مع", "نتواصل معكم", "نتكلم مع", "عندي شكوى", "شكوى", "طلب خاص", "برا المنيو", "خارج المنيو", "كمية كبيرة", "بالجملة", "بجملة", "مشكل", "مشكلة", "بزنس", "نتعامل معكم", "عندي ملاحظة"],
      answer: () => `صاحب الموقع (سنوكلي) كيجاوبك مباشرة على الواتساب 💬\nالرقم: +${BUSINESS.whatsapp}\nراسلو من هنا: ${waHref(BUSINESS.name + " 🤝")}\nسؤالك ديالي ولطلبات الخاصة تبقى بين الكل 🤝`
    },
    {
      id: "greet",
      keys: ["سلام", "السلام", "العليك", "عليكم السلام", "سلامو", "اهلا", "أهلا", "مرحبا", "بونجور", "بونور", "صباح", "مساء", "صباح الخير", "هاى", "هاي", "salam", "bonjour"],
      answer: () => `أهلا بيك في ${BUSINESS.name} 👋
شحال نقدر نعاونك؟
- اكتب "المنيو" باش تشوف الأصناف
- "شحال الثمن" باش تعرف الأسعار
- "فين طلبي" باش تتبع طلبك
- ولا سولني على شي حاجة أخرى 😊`
    },
    {
      id: "menu",
      keys: ["المنيو", "شكون عندكم", "شنو عندكم", "لائحة", "الأصناف", "المتوفر", "عندكم", "الاصناف", "فالمنيو"],
      answer: () => {
        const menu = Store.getMenu();
        const cats = [...new Set(menu.map(m => m.category))];
        return `عندنا ${menu.length} أصناف مزيانة 🍟 في هاد التصنيفات:\n${cats.map(c => "• " + c).join("\n")}\nقلّب على أي تصنيف فوق فالمكان، ولا اشري من غير عبر شرائح التصنيف 👆`
      }
    },
    {
      id: "price",
      keys: ["الثمن", "الأسعار", "بقدش", "شحال", "بكم", "قداش", "قداه", "كم الثمن", "سعر", "aros", "بشحال", "الثمن الحقيقي"],
      answer: (input) => {
        const menu = Store.getMenu();
        const words = input.replace(/[^\p{L}\p{N}\s]/gu, " ").toLowerCase().split(/\s+/);
        const hit = menu.find(m => words.some(w => w.length > 2 && m.name.toLowerCase().includes(w)));
        if (hit) return `${hit.emoji} ${hit.name} تمنو ${hit.price} درهم.`
        const cheap = menu.slice().sort((a, b) => a.price - b.price).slice(0, 3);
        return `الأسعار كيبداو من ${cheap[0].price} درهم مثلاً:\n${cheap.map(c => `• ${c.name} — ${c.price} درهم`).join("\n")}\nقل ليا على شي صنف باش نعطيك الثمن بالضبط 😉`
      }
    },
    {
      id: "delivery",
      keys: ["توصيل", "يوصل", "توصل", "الوجه", "التوصيل", "غيراليفري", "اليفري", "حتى لدار", "الديليفري", "التسليم"],
      answer: () => `أه، كتوصّلو حتى لداركم 🛵
- وقت التوصيل بالتقريب ${BUSINESS.deliveryMin}-${BUSINESS.deliveryMax} دقيقة حسب المسافة
- البثمين: كل حسب السلعة
- الخلاص إما كاش عند التوصل ولا بكارت 💳
أمر من "السلة" وفبل الـ"إتمام الطلب" ✅`
    },
    {
      id: "order_status",
      keys: ["فين طلبي", "وين طلبي", "حالة الطلب", "طلبي", "واش طلبي", "لطلبي", "الحالة", "وصلني", "واش كيتصاوب", "كيصاوب", "باقي شحال", "واش وصل", "التوقيت ديال طلبي"],
      answer: () => {
        const orders = Store.getOrders().filter(o => o.sessionId === (Store.getSession().id || "")).slice(0, 3);
        if (orders.length === 0) return "ما لقيت حتى طلب عندي على هاد الجهاز 🤔 سير للمنيو واطلب، واسمحو لي نتبعو معاك"
        return `عندك ${orders.length} طلب آخرهم ديال ${orders[0].customer.name} (${orders[0].id}):\n` +
          orders.map(o => `• ${o.id}: ${ORDER_STATUS[o.status.toUpperCase()] ? ORDER_STATUS[o.status.toUpperCase()].label : o.status}`).join("\n") +
          `\nتبع الحركة في قسم "طلبي ديالي" تحت 👇`
      }
    },
    {
      id: "hours",
      keys: ["ساعات", "حتى قاش", "فين كاينين", "العنوان", "مفتوحين", "الوقت", "ساعة", "النهار", "الليل"],
      answer: () => `خدمتنا مفتوحة ${BUSINESS.openHour}:00 حتى ${BUSINESS.closeHour}:00 في ${BUSINESS.city} 📍
الهاتف: ${BUSINESS.phone}
إلا كان شي سؤال آخر، ترانا هنا 🤖`
    },
    {
      id: "payment",
      keys: ["الخلاص", "الدفع", "الكاش", "كارت", "بطاقة", "البنك", "cmi", "على الحساب", "التمن", "نخلص", "كيفاش نخلص"],
      answer: () => `كيخلصو الزبناء بهذي الطرق كاملة 💳:
- كاش عند التوصل 💵
- كارت بنكي 🏦
- تحويل CMI السريع
اختر اللي يريحك فوتير عاد الخلاص تمتي ✅`
    },
    {
      id: "sweet",
      keys: ["حلو", "حلويات", "دونات", "بسكويت", "كرواسون", "بريوات", "بريواتات", "حلا", "شي حاجة حلوة", "التحلويات"],
      answer: () => {
        const sweets = Store.getMenu().filter(m => m.category === "حلويات");
        return `عندنا ${sweets.length} حلويات مزيانين 🍩:\n${sweets.map(s => `• ${s.emoji} ${s.name} — ${s.price} درهم`).join("\n")}\nإيوا، شنو تعجبك؟`
      }
    },
    {
      id: "recommend",
      keys: ["شنو توصي", "واش توصي", "توصيني", "أفضل", "الافضل", "الاكثر", "مقترحات", "اللي كيروح", "غيربرلي", "شنو نقترح", "نصيح", "شنو بغيت ناكل", "اكتب ليا شي حاجة"],
      answer: () => {
        const recs = recommend(3, Store.getCart(), Store.getSession());
        if (recs.length === 0) return "القيت السلة مليحة، غير بقي تأكد الطلب! 😄"
        return `حسب ذوق واحصائيات الزبناء، جرب هادو 🤖:\n${recs.map(r => `• ${r.item.emoji} ${r.item.name} — ${r.item.price} درهم (${r.reason})`).join("\n")}\nإلا حبيتي نص هادو فالسلة، صيفطهم من فوق`
      }
    },
    {
      id: "whatsapp",
      keys: ["واتساب", "الوواتساب", "whatsapp", "wa", "بلوك ليا", "سيفط ليا"],
      answer: () => `واتساب ديالنا كامل جاهز 💬\nإضغط الزر الأخضر تحت فالزاوية (أو قسم "فين كاينين") وباشر الكلام مباشرة مع البشر.\nالرقم الدولي: +${BUSINESS.whatsapp}`
    },
    {
      id: "thanks",
      keys: ["شكرا", "الله يعطيك الصحة", "مشكور", "بشكرك", "tsm", "merci", "يعطيك الصحة", "nice", "بارك الله فيك", "الله يخليك", "تسلم", "يعطيك راسك"],
      answer: () => "الله يعافيك، مرحبا في أي وقت! 🤗 إلا كانت كتب ليك شي حاجة أخرى، احنا هنا."
    },
    {
      id: "drinks",
      keys: ["مشروبات", "أتاي", "نعناع", "عصير", "قهوة", "سودا", "شاي", "نسكافي", "شي مشروب", "بغيت نشرب", "برتقال", "المنعش"],
      answer: () => {
        const drinks = Store.getMenu().filter(m => m.category === "مشروبات");
        return `عندنا ${drinks.length} مشروبات منعشة 🍹:\n${drinks.map(d => `• ${d.emoji} ${d.name} — ${d.price} درهم`).join("\n")}\nالبرتقال طازج معصور فموقعو، إلا حبيتي شيء بارد فالسلة`
      }
    },
    {
      id: "salty",
      keys: ["مقليات", "شيبس", "بطاطا", "ايطواز", "بفك", "مكسرات", "فول", "شي حاجة مملحة", "الملح", "الاشيا"],
      answer: () => {
        const salty = Store.getMenu().filter(m => m.category === "مقليات" || m.category === "مالح ومقرمش");
        return `عندنا ${salty.length} مالح وحاد الذوق 🤤:\n${salty.map(s => `• ${s.emoji} ${s.name} — ${s.price} درهم`).join("\n")}\nالشيبس ديالنا مقرمش، والبطاطا سخونة ساهلة`
      }
    },
    {
      id: "howto",
      keys: ["كيفاش نطلب", "كيف نطلب", "كيفاش خاصني", "كيفاش باش نطلب", "بغيت نطلب", "بغيت أطلب", "بغيت نكومندي", "كيفاش نصيفط"],
      answer: () => `ساهلة بزاف، هاك كيفاش تطيلمبو 👇
1. فالعالي "المنيو" ولا "مقترحات ليك"
2. إضغط "اشري" على الصنف اللي عجبك
3. سير للـ"السلة" وعبر الـ"إتمام الطلب"
4. كمّل المعلوميات وثبّت
وباش نتبعو معاك دخل لقسم "طلبي ديالي" 🕒`
    }
  ];

  /* التعرف على طبق من كلام الزبون (أسماء دارجة) */
  const MENU_ALIASES = [
    ["عصير برتقال", "orange"], ["برتقال", "orange"],
    ["شيبس حار", "chips-hot"], ["شيبسي", "chips"], ["شيبس", "chips"],
    ["بطاطا مقلية", "fries"], ["بطاطا", "fries"], ["مقلية", "fries"], ["فريت", "fries"],
    ["دجاج", "croquette"], ["كروكيت", "croquette"],
    ["سمبوسة", "samosa"],
    ["جبن", "cheese"],
    ["بفك", "pretzel"],
    ["مكسرات", "mixnuts"], ["فول", "peanuts"], ["لوز", "almonds"],
    ["دونات", "donut"], ["دونة", "donut"],
    ["بسكويت", "cookie"], ["شوكولا", "cookie"], ["شكلاط", "cookie"],
    ["كرواسون", "croissant"],
    ["بريوات", "briouat"], ["بريقات", "briouat"],
    ["أتاي بالنعناع", "tea"], ["أتاي", "tea"], ["نعناع", "tea"],
    ["قهوة", "coffee"], ["كوفي", "coffee"],
    ["كوكاكولا", "soda"], ["كولا", "soda"], ["سودا", "soda"]
  ];

  function pickMenuItem(input) {
    const menu = Store.getMenu();
    if (/حار/.test(input) && /شيبس/.test(input)) {
      const hot = menu.find(m => m.id === "chips-hot");
      if (hot) return hot;
    }
    for (const [alias, id] of MENU_ALIASES) {
      if (input.includes(alias)) {
        const hit = menu.find(m => m.id === id);
        if (hit) return hit;
      }
    }
    return null;
  }

  function menuAnswer(item) {
    return `${item.emoji} ${item.name}: تمنو ${item.price} درهم (من ${item.category}، تحضير ~${item.prep} دقيقة).\nنحبّو نزيدوه ليك فالسلة، إلا بغيتي؟`;
  }

  const FALLBACK = () => `صافي، ما فهمتكش بالضبط 😅
جرب تسولني على:
- "المنيو"
- "شحال الثمن"
- "فين طلبي"
- "شنو توصي"
- "كيفاش نطلب"
ولا "الخلاص"
وإلا كتب ليك شي سؤال خاص، خليه هاد شي يجاوبوك البشر على الرقم ${BUSINESS.phone}
ولا راسل صاحب الموقع مباشرة: ${waHref(BUSINESS.name)}`

  const LATIN_KEYS = {
    owner: ["lmalik", "lmalek", "malek", "malik", "bghit nhdar", "bghit ntkalem", "bghit ntkallem", "bghit ndir tlb xass", "tlb xass", "chkwa", "mchkil", "3andek mchkil", "jomla", "bijomla", "bsness", "bizness"],
    greet: ["slm", "slmo", "slm 3likom", "salam 3likom", "salam", "salamo", "salamo 3likom", "3likom", "3lykom", "sbah", "sbah lkhir", "sbah lxir", "sbah el khir", "mssa", "mssa lkhir", "salut", "hello", "hi", "hey", "yo", "cava", "ca va", "hola", "bonjour"],
    menu: ["lmenio", "lmenu", "menu", "ach kayn", "ach kayn 3ndkom", "ach 3ndkom", "chkoun 3ndkom", "3ndkom", "wchno kayen", "ach hadi"],
    price: ["ch7al", "chhal", "thman", "thaman", "tman", "tamane", "b9adch", "b9ach", "bqach", "b9adsh", "9adach", "qdach", "qdash", "sek"],
    order_status: ["fin tlbi", "fin talbi", "wayn tlbi", "wain tlbi", "7ala dyali", "l7ala", "wach tlbi"],
    howto: ["kifach ntlob", "kifach nlob", "kifash ntlob", "kif ntlob", "kifach", "bghit ntlob", "bghit nalob", "bghit n9wmandi", "kifach nsift"],
    hours: ["mftou7in", "mftouhin", "mftohin", "fin kaynin", "fin kayen"],
    delivery: ["livraison", "livrason", "delivery", "delevery", "yesslou", "yesselu"],
    sweet: ["7lo", "7lwayat", "7alwa", "donut", "donuts", "croissant"],
    drinks: ["atay", "n3ana3", "chay", "3asir", "kahwa", "qhwa", "qahwa"],
    salty: ["chips", "chipsy", "batata", "fries", "snacks"],
    recommend: ["chno tsi2i", "chno tsi", "wchno tawsi", "tawsiyi", "nsi7li", "matqolibil"],
    payment: ["cash", "carte", "card", "virement", "pay"],
    thanks: ["shkran", "chokran", "thx", "shukran"]
  };

  function _normalize(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFKC")
      .replace(/أ|إ|آ/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .trim();
  }

  function chatAnswer(text) {
    try {
      const input = String(text || "").trim();
      if (input.length < 2) return "بغيتي تسولني على شنو؟ 😊"
      const norm = _normalize(input);
      const item = pickMenuItem(norm);
      if (item) return menuAnswer(item);
      for (const intent of INTENTS) {
        if (intent.keys.some(k => norm.includes(_normalize(k)))) {
          return intent.answer(input);
        }
      }
      for (const id of Object.keys(LATIN_KEYS)) {
        if (LATIN_KEYS[id].some(k => norm.includes(k))) {
          const t = INTENTS.find(i => i.id === id);
          if (t) return t.answer(input);
        }
      }
      return FALLBACK();
    } catch (err) {
      Store.log("error", "المساعد الإجابة فشلت", err.message);
      return "واخا، حصلت مشكلة فتقنية عندي 😅 جرب من جديد بعد شوية."
    }
  }

  /* ---------- 3) توجيه الطلبات (الأولوية) ---------- */
  /* معادلة الوليد: أسرع تحضيراً + أكبر عد + أعلى قيمة + الأقدم يحصل على دعم
   * لمنع التضور من الجوع في الطابور (starvation). */
  function computePriority(order) {
    try {
      const base = 100;
      const speedScore = order.totalPrep > 0 ? Math.max(0, 30 - order.totalPrep) : 30; // كلما أسرع كلما أكبر
      const qtyScore = Math.min(order.count, 10) * 4;
      const valueScore = Math.min(order.total, 300) / 10;
      const ageHours = Math.max(0, (Date.now() - new Date(order.createdAt).getTime()) / 3600000);
      const ageBoost = Math.min(ageHours, 2) * 5; // الطلبات العالقة تضخ تدريجياً
      const priority = Math.round(base + speedScore + qtyScore + valueScore + ageBoost);
      return Math.max(0, priority);
    } catch (err) {
      Store.log("warn", "حساب الأولوية فشل — سيعتمد الترتيب الزمني", err.message);
      return Math.max(0, 100 - order.count * 0);
    }
  }

  /* طابور المعالجة: أولوية تنازلية ثم الأقدم زمنياً */
  function sortQueue(orders) {
    const active = orders.filter(o => o.status !== ORDER_STATUS.DONE.key && o.status !== ORDER_STATUS.CANCEL.key);
    const rest = orders.filter(o => o.status === ORDER_STATUS.DONE.key || o.status === ORDER_STATUS.CANCEL.key);
    return active
      .map(o => (o.priority = o.priority || computePriority(o), o))
      .sort((a, b) => (b.priority - a.priority) || (new Date(a.createdAt) - new Date(b.createdAt)))
      .concat(rest);
  }

  /* تقدير زمن بقية الطلب للنفس (بالدقائق) */
  function estimateWait(order) {
    try {
      const prep = order.totalPrep || 0;
      const remain = (order.status === ORDER_STATUS.PREP.key || order.status === ORDER_STATUS.READY.key) ? prep : Math.round(prep * 0.6);
      return Math.max(BUSINESS.deliveryMin, remain + BUSINESS.deliveryMin);
    } catch (_) { return BUSINESS.deliveryMax; }
  }

  return { recommend, chatAnswer, computePriority, sortQueue, estimateWait };
})();