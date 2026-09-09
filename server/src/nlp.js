export function normalize(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[۔،؛؟؟?!.,؟:؛]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(s) {
  return normalize(s).split(/\s+/).filter(Boolean);
}

const NUMBER_WORDS_AR = {
  واحده: 1, واحد: 1, وحد: 1, وحده: 1,
  جوج: 2, زوج: 2, ثنين: 2, اثنان: 2, جوجين: 2, زوجين: 2, اتنين: 2, اثنين: 2,
  تلاته: 3, تلات: 3, ثلاثه: 3, تلاتة: 3, ثلاثة: 3, ثالثه: 3, ثالثة: 3,
  اربعه: 4, اربعه: 4, أربعه: 4, اربعة: 4, أربعة: 4, اربع: 4, اربعه: 4,
  خمسه: 5, خمسة: 5, خمس: 5,
  سته: 6, ستة: 6, ست: 6,
  سبعه: 7, سبعة: 7, سبع: 7,
  تمانيه: 8, تمانية: 8, ثمانيه: 8, ثمانية: 8, تمنية: 8, تمن: 8,
  تسعه: 9, تسعة: 9, تسع: 9, تسعود: 9,
  عشره: 10, عشرة: 10, عشر: 10,
};
const NUMBER_WORDS_FR = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
  six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
};
const QTY_WORDS = {
  baghit: null, bghit: null, zid: null, zidli: null, zayd: null,
  nti: null, ntiwc: null, nchri: null,
  حيد: null, شيل: null, nehhi: null, حيدلي: null,
};
export const VERBS_REMOVE = /(حيد|شيل|نحي|احذف|حيدلي|شيللي|نحيه|ديرله)/;
export const VERBS_ADD = /(زيد|زيدلي|ضيف|بغيت|باغي|عطيني|هات|اعطيني|نشري|نعطي)/;

const GROUP_WORDS = /(وجبه|وجبات|وجب|قطع|قطعه|قطعه)/;

export function extractQuantity(text) {
  const n = normalize(text);
  let m = n.match(/\b(\d+)\b/);
  if (m) return Math.max(1, Number(m[1]));
  // أولوية: الرقم قبل المنتج مباشرة "2 tacos"
  for (const [w, v] of Object.entries({ ...NUMBER_WORDS_AR, ...NUMBER_WORDS_FR })) {
    const re = new RegExp("(^|\\s)" + w + "($|\\s)");
    if (re.test(n)) return v;
  }
  // جمع عربي: "تاكوسات/برغرين" أو كلمة وصفية "تلاتة" أُسقطت منه "ة"
  m = n.match(/(تلاته|تلات|ثلاثه|ثلاث)/);
  if (m) return 3;
  return 1;
}

function markQuantity(norm, chunks) {
  return chunks;
}

export function extractProductMentions(text, products, opts = {}) {
  const n = normalize(text);
  const found = [];
  for (const p of products || []) {
    const aliases = [
      String(p.id || ""),
      ...(Array.isArray(p.aliases) ? p.aliases : []),
      String(p.name || ""),
    ]
      .map(normalize)
      .filter(Boolean);
    for (const alias of aliases) {
      const re = new RegExp("(^|[^a-z0-9ا-ي])" + alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^a-z0-9ا-ي])");
      if (re.test(" " + n + " ")) {
        found.push({ id: p.id, name: p.name, match: alias });
        break;
      }
    }
  }
  const uniq = [];
  for (const f of found) if (!uniq.some((u) => u.id === f.id)) uniq.push(f);
  if (opts.withQty) {
    const chunks = splitByMentions(n, uniq);
    return uniq.map((f, i) => {
      const qty = extractQuantity(chunks[i] || "");
      return { ...f, qty };
    });
  }
  return uniq;
}

function splitByMentions(n, hits) {
  const indexRanges = hits.map((h) => {
    const idx = n.indexOf(h.match);
    return { ...h, idx };
  });
  const parts = [];
  let cursor = 0;
  const sorted = [...indexRanges].sort((a, b) => a.idx - b.idx);
  for (const h of sorted) {
    parts.push(n.slice(cursor, h.idx));
    cursor = h.idx + h.match.length;
  }
  parts.push(n.slice(cursor));
  return parts;
}

const MENU_WORDS = /(منيو|منو|menu|قائمه|قائمة|الأصناف|لائحه|l liste)/;
const PRICE_WORDS = /(شحال|بشحال|بقداش|الثمن|الثمن ديال|سعر|تمن|ثمن|combien|c est combien|how much|prix|price)/;
const AVAIL_WORDS = /(واش عندكم|واش كاين|واش عندك|واش كاينين|كاين|عندكم|هل عندك|vous avez|you have|الوفري|متوفر|موجود|يبيع|الجيدين)/;
const CANCEL_WORDS = /(الغي|ألغي|لغى|الغاء|إلغاء|نلغي|banlguie|cancel|annule|delete|ما بغيتوش|ما نبغيش|bahil|شحال|صافي)/;
const HUMAN_WORDS = /(المسؤول|موظف|موظف حقيقي|بشري|بشر|إنسان|انسان|personne|personne reelle|human|agent|بغيت نهدر مع|بغيت نهضر مع|مع المسؤول|مع موظف|تواصل مع موظف|وحطيت|عطيني شي واحد)/;
const GREET_WORDS = /(سلام|السلام|صباح|مساء|أهلا|اهلا|مرحبا|bonjour|salut|hello|hi|سلاام)/;
const MENU_HELP = /(شنو عندكم|شنو فيه|شنو فالمنيو|اكيد|help|مساعدة|d aide)/;

const CONFIRM_TOKENS = new Set([
  "اكد", "أكد", "صافي", "نعم", "yes", "oui", "ok", "اوكي", "تمام",
  "دوزو", "daccio", "اكديه", "أكديه", "هيا", "confirm",
]);
const CONFIRM_PHRASES = ["اكد الطلب", "صافي اكد", "نعم اكد", "ملي زين", "مليح"];

export const INTENTS = ["order", "availability", "menu", "price", "confirm", "cancel", "human", "greet", "fallback"];

function hasConfirm(n) {
  return CONFIRM_PHRASES.some(p => n.includes(p)) || n.split(/\s+/).some(t => CONFIRM_TOKENS.has(t));
}

export function detectIntent(text) {
  const n = normalize(text);
  if (!n) return { intent: "greet" };
  if (VERBS_REMOVE.test(n) && /\w/.test(n.replace(VERBS_REMOVE, ""))) {
    // "حيد coca" => order (مع حذف)
    if (/(حيد|شيل|نحي)/.test(n)) return { intent: "order", action: "remove" };
  }
  if (HUMAN_WORDS.test(n)) return { intent: "human" };
  if (hasConfirm(n) && !MENU_WORDS.test(n) && n.split(/\s+/).length <= 4 && !(/(نلغي|الغي|إلغاء|cancel)/.test(n))) return { intent: "confirm" };
  if (CANCEL_WORDS.test(n) || /(بغيت نلغي|الغي الطلب)/.test(n)) {
    if (/(نلغي|الغي|إلغاء|الغاء|cancel|annule|ما بغيتوش|ما نبغيش)/.test(n)) return { intent: "cancel" };
  }
  if (PRICE_WORDS.test(n)) return { intent: "price" };
  if (AVAIL_WORDS.test(n)) return { intent: "availability" };
  if (MENU_WORDS.test(n)) return { intent: "menu" };
  if (/(بغيت|باغي|nchri|نشري|bghit|baghit|je veux|i want|j aimerais|عايز|أريد|اريد|زيد|ضيف|زيدلي|عطيني|هات|اعطيني)/.test(n)) return { intent: "order" };
  if (hasConfirm(n) && n.split(/\s+/).length <= 4 && !(/(نلغي|الغي|إلغاء|cancel)/.test(n))) return { intent: "confirm" };
  if (GREET_WORDS.test(n)) return { intent: "greet" };
  // اسم صنف معروف من الكتالوج (من اللاتينية/الدارجة) دون أمر صريح = طلب
  if (/(تاكوس|تاكو|tacos|taco|burger|برغر|berrg|panini|بانيني|pizza|بيتزا|بيتسا|sandwich|سندويش|frite|poulet|كولا|coca|كرسبي|نوغا|eclair)/i.test(n)) return { intent: "order" };
  return { intent: "fallback" };
}