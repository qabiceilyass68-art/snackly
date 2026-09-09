"use strict";
/* ============================================================
 * data.js — بذرة المنيو (جرد أصناف وجبات خفيفة مغربية)
 * كل صنف: id, name (داريجة), desc, price (درهم), category, emoji, prep (دقائق)
 * ============================================================ */
const MENU_SEED = [
  { id: "fries",      name: "بطاطا مقلية",        desc: "فريت دهبي مقرمش بملحة خفيفة",        price: 20, category: "مقليات",   emoji: "🍟", prep: 8,  hot: false, img: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=640&q=70&auto=format&fit=crop" },
  { id: "cheese",     name: "أصابع الجبن",        desc: "جبن مسحوب مصبّن ومقرمش",            price: 25, category: "مقليات",   emoji: "🧀", prep: 10, hot: false, img: "https://images.unsplash.com/photo-1528825871115-3581a5387919?w=640&q=70&auto=format&fit=crop" },
  { id: "samosa",     name: "سمبوسة جبن",         desc: "ورقة مقرمشة محشية بالجبن",          price: 15, category: "مقليات",   emoji: "🥟", prep: 7,  hot: false, img: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=640&q=70&auto=format&fit=crop" },
  { id: "croquette",  name: "كروكيت دجاج",        desc: "دوائر دجاج مقرمشة مع صلصة",         price: 30, category: "مقليات",   emoji: "🍗", prep: 12, hot: false, img: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=640&q=70&auto=format&fit=crop" },
  { id: "chips",      name: "شيبس مملح",          desc: "رقائق البطاطا الكلاسيكية",          price: 10, category: "مالح ومقرمش", emoji: "🥔", prep: 1, hot: false, img: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Potato-Chips.jpg/960px-Potato-Chips.jpg" },
  { id: "chips-hot",  name: "شيبس حار",           desc: "بنكهة حارة على الطريقة المغربية",   price: 12, category: "مالح ومقرمش", emoji: "🌶️", prep: 1,  hot: true, img: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=640&q=70&auto=format&fit=crop" },
  { id: "pretzel",    name: "بفك مالح",           desc: "أصابع ملحية مقرمشة",                price: 10, category: "مالح ومقرمش", emoji: "🥨", prep: 1,  hot: false, img: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a6/Pretzels%F0%9F%8E%80%F0%9F%A5%A8.jpg/960px-Pretzels%F0%9F%8E%80%F0%9F%A5%A8.jpg" },
  { id: "mixnuts",    name: "مكسرات مشكلة",       desc: "لوز، كاجو، فستق محمصين",            price: 35, category: "مالح ومقرمش", emoji: "🥜", prep: 1,  hot: false, img: "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=640&q=70&auto=format&fit=crop" },
  { id: "peanuts",    name: "فول سوداني محمص",    desc: "محمص بالملح البحري",               price: 12, category: "مالح ومقرمش", emoji: "🥜", prep: 1,  hot: false, img: "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=640&q=70&auto=format&fit=crop" },
  { id: "almonds",    name: "لوز مملح",           desc: "لوز محمّص ومملّح ناعم",             price: 30, category: "مالح ومقرمش", emoji: "🌰", prep: 1,  hot: false, img: "https://images.unsplash.com/photo-1531058020387-3be344556be6?w=640&q=70&auto=format&fit=crop" },
  { id: "donut",      name: "دونات سكري",         desc: "دونة طرية مسكّرة",                  price: 12, category: "حلويات",   emoji: "🍩", prep: 3,  hot: false, img: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=640&q=70&auto=format&fit=crop" },
  { id: "cookie",     name: "بسكويت شوكولا",      desc: "بسكويت غني بالشوكولا",             price: 15, category: "حلويات",   emoji: "🍪", prep: 2,  hot: false, img: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=640&q=70&auto=format&fit=crop" },
  { id: "croissant",  name: "كرواسون لوز",        desc: "باللوز والزبدة الطرية",             price: 18, category: "حلويات",   emoji: "🥐", prep: 3,  hot: false, img: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=640&q=70&auto=format&fit=crop" },
  { id: "briouat",    name: "بريواتات باللوز",    desc: "حلويات مغربية أصيلة باللوز والقرفة", price: 25, category: "حلويات",   emoji: "🥮", prep: 5,  hot: false, img: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=640&q=70&auto=format&fit=crop" },
  { id: "tea",        name: "أتاي بالنعناع",      desc: "أتاي مغربي بالمنعش السخون",         price: 15, category: "مشروبات",  emoji: "🍵", prep: 4,  hot: false, img: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=640&q=70&auto=format&fit=crop" },
  { id: "orange",     name: "عصير برتقال",        desc: "طازج معصور فوراً",                  price: 20, category: "مشروبات",  emoji: "🍊", prep: 3,  hot: false, img: "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=640&q=70&auto=format&fit=crop" },
  { id: "soda",       name: "سودا مبردة",         desc: "مشروب غازي بارد",                   price: 10, category: "مشروبات",  emoji: "🥤", prep: 1,  hot: false, img: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=640&q=70&auto=format&fit=crop" },
  { id: "coffee",     name: "قهوة تركية",         desc: "قهوة مركزة محضّرة على الرمل",       price: 12, category: "مشروبات",  emoji: "☕", prep: 4,  hot: false, img: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=640&q=70&auto=format&fit=crop" }
];

const CATEGORIES = [
  { key: "مقليات",     emoji: "🍳" },
  { key: "مالح ومقرمش", emoji: "🥨" },
  { key: "حلويات",     emoji: "🍩" },
  { key: "مشروبات",    emoji: "🥤" }
];

/* ثوابت الشركة (قابلة للتعديل من هنا فقط) */
const BUSINESS = {
  name: "سنوكلي Snackly",
  phone: "212650169277",
  whatsapp: "212650169277",
  address: "شارع محمد الخامس، زنقة أكدال، الرباط",
  location: { lat: 34.0209, lng: -6.8416 },
  city: "الرباط",
  deliveryMin: 15,
  deliveryMax: 40,
  openHour: 9,
  closeHour: 23,
  currency: "درهم",
  adminPin: "2025 2026"
};

/* بوابة الدخول للوحة الإدارة: يتحقق من الرمز الصحيح فقط */
function checkAdminPin(input) {
  return String(input == null ? "" : input).trim() === String(BUSINESS.adminPin);
}

/* رابط واتساب بالرقم الدولي مع رسالة اختيارية (text مفوّرة) */
function waHref(text) {
  const msg = encodeURIComponent((text && String(text).trim()) || BUSINESS.name);
  return "https://wa.me/" + BUSINESS.whatsapp + (msg ? "?text=" + msg : "");
}

/* رابط تضمين خريطة OpenStreetMap (بدون مفتاح) من إحداثيات الشركة */
function mapEmbedUrl() {
  try {
    const loc = BUSINESS.location;
    if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return "";
    const d = 0.03;
    const bbox = [loc.lng - d, loc.lat - d, loc.lng + d, loc.lat + d].map(v => v.toFixed(5)).join("%2C");
    return "https://www.openstreetmap.org/export/embed.html?bbox=" + bbox +
      "&layer=mapnik&marker=" + loc.lat.toFixed(5) + "%2C" + loc.lng.toFixed(5);
  } catch (err) {
    Store.log("warn", "رابط الخريطة فشل", err.message);
    return "";
  }
}

/* معرّف حالة الطلب: مفاتيح داخلية + تسميات بالداريجة */
const ORDER_STATUS = {
  NEW:    { key: "new",    label: "جديد",          emoji: "🆕", seq: 0 },
  PREP:   { key: "prep",   label: "قيد التحضير",   emoji: "👨‍🍳", seq: 1 },
  READY:  { key: "ready",  label: "جاهز للتوصيل",  emoji: "🛵", seq: 2 },
  DONE:   { key: "done",   label: "سلّم",          emoji: "✅", seq: 3 },
  CANCEL: { key: "cancel", label: "أُلغي",         emoji: "❌", seq: -1 }
};
const STATUS_FLOW = [
  { from: ORDER_STATUS.NEW,    to: [ORDER_STATUS.PREP, ORDER_STATUS.CANCEL] },
  { from: ORDER_STATUS.PREP,   to: [ORDER_STATUS.READY, ORDER_STATUS.CANCEL] },
  { from: ORDER_STATUS.READY,  to: [ORDER_STATUS.DONE, ORDER_STATUS.CANCEL] },
  { from: ORDER_STATUS.DONE,   to: [] },
  { from: ORDER_STATUS.CANCEL, to: [] }
];

/* آراء الزبناء (نصوص حرفية تُعرض كما هي بكل اللغات — قابلة للتعديل من هنا) */
const REVIEWS = [
  { name: "يوسف",  date: "2026-08", stars: 5, text: "جودة ممتازة وتوصيل سريع، وصل الطلب ساخناً أمامي مباشرة.", avatar: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=160&q=70&auto=format&fit=crop" },
  { name: "سلمى",  date: "2026-07", stars: 5, text: "الصنع منزلي فعلاً والطعم رائع، أصبح هذا المكان المفضل لدي.", avatar: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=160&q=70&auto=format&fit=crop" },
  { name: "أمين",  date: "2026-06", stars: 4, text: "تعامل محترم، وطلب خُصِّص وقُصَّص على ذوقي بالضبط.", avatar: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=160&q=70&auto=format&fit=crop" },
  { name: "نور",   date: "2026-05", stars: 5, text: "منذ تجربتي الأولى والمحل لا يخيب ظنّي أبداً.", avatar: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=160&q=70&auto=format&fit=crop" }
];

/* صور احترافية لمواقع إضافية على طول الموقع (قابلة للتعديل من هنا فقط) */
const GALLERY = {
  promo: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=1280&q=70&auto=format&fit=crop",
  storefront: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1280&q=70&auto=format&fit=crop"
};

/* منصات التواصل الاجتماعي (روابط قابلة للتعديل من هنا) */
const SOCIALS = [
  { id: "instagram", label: "Instagram", emoji: "📸", href: "https://www.instagram.com/" },
  { id: "facebook",  label: "Facebook",  emoji: "👍", href: "https://www.facebook.com/" },
  { id: "tiktok",    label: "TikTok",    emoji: "🎵", href: "https://www.tiktok.com/" },
  { id: "whatsapp",  label: "WhatsApp",  emoji: "💬", href: "" }
];