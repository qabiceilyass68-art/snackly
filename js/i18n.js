"use strict";
/* ============================================================
 * i18n.js — محرك الترجمة متعدد اللغات (عربية فصحى/فرنسية/إنجليزية/إسبانية)
 * الافتراضي: العربية. المفتاح الحالي في localStorage: snackly_lang
 * ============================================================ */

const LANG_CODES = ["ar", "fr", "en", "es"];

const DICT = {
  ar: {
    nav_menu: "المنيو", nav_recs: "مقترحات", nav_track: "طلبك",
    cart_label: "السلة",
    skip: "انتقل إلى المنيو",
    tab_customer: "🛍️ صفحة الزبون", tab_admin: "🛠️ لوحة الإدارة",
    hero_eyebrow: "⭐ جديد في حيّك منذ 2020",
    hero_title1: "وجبات خفيفة", hero_title2: "مع سنوكلي",
    hero_sub: "اطلب ببضع نقرات، ونُوصلك الأطباق ساخنةً أمامك. توصيل سريع وأولوية تُحسب تلقائياً.",
    hero_cta1: "شاهد المنيو 🍟", hero_cta2: "تحدث مع المساعد 💬",
    stat_items: "صنف", stat_orders: "طلب", stat_avail: "متاح", stat_service: "الخدمة",
    rec_e: "✦ مقترحات بالذكاء", rec_t: "مقترحات لك 🤖",
    rec_h1: "مبنية على الشعبية وذوقك", rec_h0: "بانتظار طلبات لنفهم ذوقك",
    menu_e: "✦ لائحة كاملة", menu_t: "المنيو الكامل", menu_all: "الكل",
    search_ph: "ابحث عن صنف... 🔍", menu_empty: "لم نعثر على صنف بهذا الاسم 🥺",
    hot: "حار 🌶️",
    prep_note: "⏱ تحضير حوالي", prep_min: "دقيقة",
    add_more: "أضف +", add: "اشترِ",
    rec_reason_top: "الأكثر طلباً", rec_reason_you: "لأنك تحبه",
    rec_reason_loved: "أحبه الزبناء ⭐", rec_reason_pair: "يناسب سلتك 🤝", rec_reason_smart: "خيار ذكي لك ✨", rec_reason_new: "اقتراح جديد لك 🆕", rec_reason_menu: "من المنيو الشائع 🔥",
    track_e: "✦ حالة الطلب لحظياً", track_t: "تتبع طلبك 🕒",
    track_empty: "لم تصدر حتى طلب بعد. تصفّح المنيو ولنبدأ 💪",
    loc_e: "✦ نصل إليك في كل مكان", loc_t: "مكاننا وخدمة التوصيل 📍",
    contact_t: "تواصل مع سنوكلي",
    label_address: "العنوان", label_hours: "ساعات الخدمة", label_phone: "الهاتف", label_wa: "واتساب",
    hours_ph: "كل يوم من", hours_sep: "إلى",
    wa_cta: "أرسل عبر واتساب 💬", map_cta: "افتح الخريطة 🔗",
    wa_msg_first: "السلام عليكم، أود الطلب من",
    footer1: "© 2026 سنوكلي Snackly — صُنع بحب", footer2: "في",
    ticker: ["منذ 2020", "أكثر من 400 عميل سعيد", "تقييم إيجابي", "صنع منزلي", "توصيل مباشر في نطاق محدود", "طلبك يُصنع خصيصاً لك", "إختر ما تشتهي", "سناك سريع بأعلى جودة", "برغر وسندويشات وبيتزا طازجة", "طلبيتك تصل ساخنة", "أجواء شبابية وأسعار في المتناول", "التوصيل سريع والوجبة سخونة", "قائمة بيتزا وبرغر وساندويتش بطعم ذهبي", "سنوكلي عنوان الطعم", "قهوة وشاي على الأصول في كل وقت", "منيو يجدَّد منذ 2020"],
    rating_e: "✦ آراء الزبناء", rating_t: "تقييم المحل ⭐",
    rating_stat: "4.9/5 — مبني على أكثر من 400 تقييم إيجابي",
    video_e: "✦ فيديو تعريفي", video_t: "اكتشف سنوكلي 🎬",
    video_hint: "مساحة الفيديو الترويجي للمحل",
    socials_t: "تابعنا على المنصات 📲",
    reserve_e: "✦ احجز طاولتك", reserve_t: "طلب طاولة 🪑",
    reserve_name: "الاسم", reserve_name_ph: "اسمك الكامل",
    reserve_date: "التاريخ", reserve_time: "الوقت", reserve_guests: "عدد الأشخاص",
    reserve_guests_1: "شخص", reserve_guests_2: "شخصان", reserve_guests_n: "أشخاص",
    reserve_btn: "أرسل طلب الحجز 📅",
    reserve_ok: "تم إرسال طلب الحجز بنجاح ✅ سنؤكد لك عبر الهاتف",
    reserve_err: "يرجى ملء جميع الحقول المطلوبة",
    drawer_t: "سلة الطلب 🛒", drawer_total: "المجموع", drawer_checkout: "إتمام الطلب ✅",
    cart_empty: "السلة فارغة — لا تأكيد بعد.",
    currency: "درهم", line: "سطر",
    checkout_t: "إتمام الطلب 📝", ck_name: "الاسم الكامل *", ck_name_ph: "مثال: يوسف العلوي",
    ck_phone: "رقم الهاتف *", ck_phone_ph: "06XXXXXXXX",
    ck_addr: "العنوان *", ck_addr_ph: "الحي، الشارع، رقم المنزل",
    pay_m: "طريقة الدفع", pay_cash: "💵 عند الاستلام", pay_card: "💳 بطاقة بنكية", pay_cmi: "🏦 تحويل CMI",
    total_full: "المجموع الكلي", submit: "أكّد الطلب 🚀",
    compl_t: "لديك ملاحظة أو شكوى؟",
    compl_btn: "قدم شكوى", compl_def: "مرحبًا، لديّ شكوى:", compl_ok: "نفتح لك محادثة واتساب لتكتب شكواك هناك",
    header_reserve: "طلب طاولة",
    lang_title: "تغيير اللغة", ar: "العربية", fr: "Français", en: "English", es: "Español",
    call_owner: "اتصل بالمحل",
    m: {
      fries: ["بطاطا مقلية", "شرائح بطاطس ذهبية مقرمشة"], cheese: ["أصابع الجبن", "جبن مطاطي مقرمش"],
      samosa: ["سمبوسة جبن", "رقيقة مقرمشة محشوة بالجبن"], croquette: ["كروكيت دجاج", "أقراص دجاج مقرمشة مع صلصة"],
      chips: ["شرائح بطاطس مملحة", "الرقائق الكلاسيكية"], chips_hot: ["شرائح بطاطس حارة", "بنكهة حارة على الطريقة المغربية"],
      pretzel: ["بريتزل مالح", "أعواد مملحة مقرمشة"], mixnuts: ["مكسرات مشكلة", "لوز وكاجو وفستق محمّص"],
      peanuts: ["فول سوداني محمّص", "محمّص بالملح البحري"], almonds: ["لوز مملح", "لوز محمّص مملّح ناعم"],
      donut: ["دونات سكرية", "طرية ومغطاة بالسكر"], cookie: ["بسكويت شوكولاتة", "غني بالشوكولاتة"],
      croissant: ["كرواسون لوز", "باللوز والزبدة الطرية"], briouat: ["بريوات باللوز", "حلويات مغربية أصيلة باللوز والقرفة"],
      tea: ["شاي بالنعناع", "شاي مغربي ساخن ومنعش"], orange: ["عصير برتقال", "طازج ومعصور فوراً"],
      soda: ["مشروب غازي بارد", "بارد ومنعش"], coffee: ["قهوة تركية", "مركّزة محضّرة على الرمل"]
    },
    c: { "مقليات": "مقليات", "مالح ومقرمش": "مالح ومقرمش", "حلويات": "حلويات", "مشروبات": "مشروبات" }
  },

  fr: {
    nav_menu: "Menu", nav_recs: "Suggestions", nav_track: "Ma commande",
    cart_label: "Panier",
    skip: "Aller au menu",
    tab_customer: "🛍️ Espace client", tab_admin: "🛠️ Administration",
    hero_eyebrow: "⭐ Nouveau dans votre quartier depuis 2020",
    hero_title1: "Snacks", hero_title2: "avec Snackly",
    hero_sub: "Commandez en quelques clics, nous livrons vos plats chauds. Livraison rapide et priorité calculée automatiquement.",
    hero_cta1: "Voir le menu 🍟", hero_cta2: "Parler à l'assistant 💬",
    stat_items: "articles", stat_orders: "commandes", stat_avail: "ouvert", stat_service: "service",
    rec_e: "✦ Suggestions par IA", rec_t: "Suggestions pour vous 🤖",
    rec_h1: "Basées sur la popularité et vos goûts", rec_h0: "En attente de commandes pour comprendre vos goûts",
    menu_e: "✦ Carte complète", menu_t: "Menu complet", menu_all: "Tout",
    search_ph: "Rechercher un article... 🔍", menu_empty: "Aucun article trouvé avec ce nom 🥺",
    hot: "Épicé 🌶️",
    prep_note: "⏱ Prép. ~", prep_min: "min",
    add_more: "Ajouter +", add: "Acheter",
    rec_reason_top: "Plus demandé", rec_reason_you: "Parce que vous l'aimez",
    rec_reason_loved: "Adoré par les clients ⭐", rec_reason_pair: "Parfait avec votre panier 🤝", rec_reason_smart: "Un choix malin ✨", rec_reason_new: "Nouveau pour vous 🆕", rec_reason_menu: "Populaire au menu 🔥",
    track_e: "✦ Suivi en direct", track_t: "Suivi de commande 🕒",
    track_empty: "Aucune commande pour l'instant. Parcourrez le menu 💪",
    loc_e: "✦ On vous livre partout", loc_t: "Notre adresse et la livraison 📍",
    contact_t: "Contacter Snackly",
    label_address: "Adresse", label_hours: "Horaires", label_phone: "Téléphone", label_wa: "WhatsApp",
    hours_ph: "Tous les jours de", hours_sep: "à",
    wa_cta: "Écrire sur WhatsApp 💬", map_cta: "Ouvrir la carte 🔗",
    wa_msg_first: "Bonjour, je voudrais commander de",
    footer1: "© 2026 Snackly — fait avec amour", footer2: "à",
    ticker: ["Depuis 2020", "Plus de 400 clients satisfaits", "Avis positifs", "Fait maison", "Livraison directe zone limitée", "Commande faite sur mesure pour vous", "Choisissez ce qui vous plaît", "Snacks rapides, qualité maximale", "Burgers, sandwichs et pizza frais", "Votre commande arrive bien chaude", "Ambiance jeune, prix abordables", "Livraison rapide, plat bien chaud", "Pizzas, burgers et sandwichs au goût d'or", "Snackly, la vraie saveur", "Café et thé à l'ancienne", "Un menu renouvelé depuis 2020"],
    rating_e: "✦ Avis clients", rating_t: "Note du restaurant ⭐",
    rating_stat: "4.9/5 — basé sur plus de 400 avis positifs",
    video_e: "✦ Vidéo", video_t: "Découvrez Snackly 🎬",
    video_hint: "Emplacement réservé à la vidéo promotionnelle",
    socials_t: "Suivez-nous 📲",
    reserve_e: "✦ Réservez votre table", reserve_t: "Réservation de table 🪑",
    reserve_name: "Nom", reserve_name_ph: "Votre nom complet",
    reserve_date: "Date", reserve_time: "Heure", reserve_guests: "Nombre de personnes",
    reserve_guests_1: "personne", reserve_guests_2: "personnes", reserve_guests_n: "personnes",
    reserve_btn: "Envoyer la réservation 📅",
    reserve_ok: "Réservation envoyée ✅ Nous vous confirmerons par téléphone",
    reserve_err: "Veuillez remplir tous les champs requis",
    drawer_t: "Panier 🛒", drawer_total: "Total", drawer_checkout: "Commander ✅",
    cart_empty: "Panier vide — aucune commande pour l'instant.",
    currency: "MAD", line: "ligne",
    checkout_t: "Finaliser la commande 📝", ck_name: "Nom complet *", ck_name_ph: "Ex: Youssef Alaoui",
    ck_phone: "Téléphone *", ck_phone_ph: "06XXXXXXXX",
    ck_addr: "Adresse *", ck_addr_ph: "Quartier, rue, n°",
    pay_m: "Mode de paiement", pay_cash: "💵 À la livraison", pay_card: "💳 Carte bancaire", pay_cmi: "🏦 Virement CMI",
    total_full: "Total", submit: "Confirmer 🚀",
    compl_t: "Une remarque ou réclamation ?",
    compl_btn: "Soumettre une réclamation", compl_def: "Bonjour, j'ai une réclamation:", compl_ok: "Ouverture de WhatsApp pour écrire votre réclamation",
    header_reserve: "Réserver une table",
    lang_title: "Changer la langue", ar: "العربية", fr: "Français", en: "English", es: "Español",
    call_owner: "Appeler le restaurant",
    m: {
      fries: ["Frites", "Frites dorées et croustillantes"], cheese: ["Bâtonnets de fromage", "Fromage filant et croustillant"],
      samosa: ["Samoussa fromage", "Feuilleté croustillant au fromage"], croquette: ["Croquettes poulet", "Croquetas de poulet avec sauce"],
      chips: ["Chips salées", "Chips classiques"], chips_hot: ["Chips épicées", "Goût épicé à la marocaine"],
      pretzel: ["Pretzel salé", "Bâtonnets salés croustillants"], mixnuts: ["Mélange de noix", "Amandes, noix de cajou et pistaches"],
      peanuts: ["Cacahuètes grillées", "Grillées au sel marin"], almonds: ["Amandes salées", "Amandes grillées et salées"],
      donut: ["Donut sucré", "Moelleux et sucré"], cookie: ["Cookie chocolat", "Riche en chocolat"],
      croissant: ["Croissant amande", "Aux amandes et beurre doux"], briouat: ["Briouat amandes", "Pâtisserie marocaine à la cannelle"],
      tea: ["Thé à la menthe", "Thé marocain chaud et frais"], orange: ["Jus d'orange", "Frais et pressé sur place"],
      soda: ["Soda frais", "Froid et rafraîchissant"], coffee: ["Café turc", "Concentré préparé sur sable"]
    },
    c: { "مقليات": "Fritures", "مالح ومقرمش": "Salé & croquant", "حلويات": "Douceurs", "مشروبات": "Boissons" }
  },

  en: {
    nav_menu: "Menu", nav_recs: "Suggestions", nav_track: "My order",
    cart_label: "Cart",
    skip: "Skip to menu",
    tab_customer: "🛍️ Customer page", tab_admin: "🛠️ Dashboard",
    hero_eyebrow: "⭐ New in your neighborhood since 2020",
    hero_title1: "Snacks", hero_title2: "with Snackly",
    hero_sub: "Order in a few clicks and we deliver it hot to your door. Fast delivery and automatic priority.",
    hero_cta1: "View menu 🍟", hero_cta2: "Talk to the assistant 💬",
    stat_items: "items", stat_orders: "orders", stat_avail: "open", stat_service: "service",
    rec_e: "✦ AI suggestions", rec_t: "Suggested for you 🤖",
    rec_h1: "Based on popularity and your taste", rec_h0: "Waiting for orders to learn your taste",
    menu_e: "✦ Full listing", menu_t: "Full menu", menu_all: "All",
    search_ph: "Search an item... 🔍", menu_empty: "No item found with that name 🥺",
    hot: "Hot 🌶️",
    prep_note: "⏱ Prep ~", prep_min: "min",
    add_more: "Add +", add: "Buy",
    rec_reason_top: "Most ordered", rec_reason_you: "Because you love it",
    rec_reason_loved: "Loved by customers ⭐", rec_reason_pair: "Pairs with your cart 🤝", rec_reason_smart: "Smart choice ✨", rec_reason_new: "New for you 🆕", rec_reason_menu: "Popular pick 🔥",
    track_e: "✦ Live status", track_t: "Track your order 🕒",
    track_empty: "No order yet. Browse the menu and let's start 💪",
    loc_e: "✦ We deliver everywhere", loc_t: "Our location & delivery 📍",
    contact_t: "Contact Snackly",
    label_address: "Address", label_hours: "Hours", label_phone: "Phone", label_wa: "WhatsApp",
    hours_ph: "Every day from", hours_sep: "to",
    wa_cta: "Message on WhatsApp 💬", map_cta: "Open the map 🔗",
    wa_msg_first: "Hello, I would like to order from",
    footer1: "© 2026 Snackly — made with love", footer2: "in",
    ticker: ["Since 2020", "400+ happy customers", "Positive reviews", "Homemade", "Direct delivery, limited zone", "Order made just for you", "Choose what you crave", "Quick snacks, top quality", "Fresh burgers, sandwiches & pizza", "Your order arrives hot", "Young vibes, friendly prices", "Fast delivery, piping-hot meals", "Pizza, burgers & sandwiches, golden taste", "Snackly, the real taste", "Proper coffee & tea all day", "A menu refreshed since 2020"],
    rating_e: "✦ Customer reviews", rating_t: "Store rating ⭐",
    rating_stat: "4.9/5 — based on 400+ positive reviews",
    video_e: "✦ Promo video", video_t: "Discover Snackly 🎬",
    video_hint: "Spot reserved for the promotional video",
    socials_t: "Follow us 📲",
    reserve_e: "✦ Book your table", reserve_t: "Table reservation 🪑",
    reserve_name: "Name", reserve_name_ph: "Your full name",
    reserve_date: "Date", reserve_time: "Time", reserve_guests: "Number of guests",
    reserve_guests_1: "person", reserve_guests_2: "people", reserve_guests_n: "people",
    reserve_btn: "Send reservation 📅",
    reserve_ok: "Reservation sent ✅ We'll confirm by phone",
    reserve_err: "Please fill in all required fields",
    drawer_t: "Cart 🛒", drawer_total: "Total", drawer_checkout: "Checkout ✅",
    cart_empty: "Cart is empty — nothing to confirm.",
    currency: "MAD", line: "line",
    checkout_t: "Checkout 📝", ck_name: "Full name *", ck_name_ph: "e.g. Youssef Alaoui",
    ck_phone: "Phone *", ck_phone_ph: "06XXXXXXXX",
    ck_addr: "Address *", ck_addr_ph: "Neighborhood, street, number",
    pay_m: "Payment method", pay_cash: "💵 On delivery", pay_card: "💳 Bank card", pay_cmi: "🏦 CMI transfer",
    total_full: "Total", submit: "Confirm 🚀",
    compl_t: "A remark or complaint?",
    compl_btn: "Submit complaint", compl_def: "Hello, I have a complaint:", compl_ok: "Opening WhatsApp so you can write your complaint",
    header_reserve: "Reserve a table",
    lang_title: "Change language", ar: "العربية", fr: "Français", en: "English", es: "Español",
    call_owner: "Call the store",
    m: {
      fries: ["French fries", "Golden crispy fries"], cheese: ["Cheese sticks", "Stretchy crispy cheese"],
      samosa: ["Cheese samosa", "Crispy sheet stuffed with cheese"], croquette: ["Chicken croquettes", "Crispy chicken discs with sauce"],
      chips: ["Salted chips", "Classic crisps"], chips_hot: ["Spicy chips", "Spicy Moroccan style"],
      pretzel: ["Salty pretzel", "Crispy salty sticks"], mixnuts: ["Mixed nuts", "Roasted almonds, cashews, pistachios"],
      peanuts: ["Roasted peanuts", "Roasted with sea salt"], almonds: ["Salted almonds", "Toasted and lightly salted"],
      donut: ["Sugar donut", "Soft and sugary"], cookie: ["Chocolate cookie", "Rich in chocolate"],
      croissant: ["Almond croissant", "With almonds and soft butter"], briouat: ["Almond briouat", "Authentic Moroccan pastry"],
      tea: ["Mint tea", "Hot Moroccan mint tea"], orange: ["Orange juice", "Fresh, squeezed on the spot"],
      soda: ["Cold soda", "Cold and refreshing"], coffee: ["Turkish coffee", "Strong, prepared on sand"]
    },
    c: { "مقليات": "Fried", "مالح ومقرمش": "Salty & crunchy", "حلويات": "Sweets", "مشروبات": "Drinks" }
  },

  es: {
    nav_menu: "Menú", nav_recs: "Sugerencias", nav_track: "Mi pedido",
    cart_label: "Carrito",
    skip: "Ir al menú",
    tab_customer: "🛍️ Página del cliente", tab_admin: "🛠️ Administración",
    hero_eyebrow: "⭐ Nuevo en tu barrio desde 2020",
    hero_title1: "Snacks", hero_title2: "con Snackly",
    hero_sub: "Pide en unos clics y te lo llevamos caliente. Entrega rápida y prioridad calculada automáticamente.",
    hero_cta1: "Ver el menú 🍟", hero_cta2: "Hablar con el asistente 💬",
    stat_items: "artículos", stat_orders: "pedidos", stat_avail: "abierto", stat_service: "servicio",
    rec_e: "✦ Sugerencias por IA", rec_t: "Sugerencias para ti 🤖",
    rec_h1: "Según popularidad y tus gustos", rec_h0: "Esperando pedidos para conocer tus gustos",
    menu_e: "✦ Lista completa", menu_t: "Menú completo", menu_all: "Todo",
    search_ph: "Buscar un artículo... 🔍", menu_empty: "No se encontró ningún artículo 🥺",
    hot: "Picante 🌶️",
    prep_note: "⏱ Prep. ~", prep_min: "min",
    add_more: "Añadir +", add: "Comprar",
    rec_reason_top: "Más pedido", rec_reason_you: "Porque te encanta",
    rec_reason_loved: "Favorito de los clientes ⭐", rec_reason_pair: "Combina con tu carrito 🤝", rec_reason_smart: "Elección inteligente ✨", rec_reason_new: "Nuevo para ti 🆕", rec_reason_menu: "Popular del menú 🔥",
    track_e: "✦ Estado en vivo", track_t: "Seguir tu pedido 🕒",
    track_empty: "Aún no hay pedidos. Explora el menú 💪",
    loc_e: "✦ Entregamos en todas partes", loc_t: "Nuestra ubicación 📍",
    contact_t: "Contactar Snackly",
    label_address: "Dirección", label_hours: "Horario", label_phone: "Teléfono", label_wa: "WhatsApp",
    hours_ph: "Todos los días de", hours_sep: "a",
    wa_cta: "Escribir por WhatsApp 💬", map_cta: "Abrir el mapa 🔗",
    wa_msg_first: "Hola, me gustaría pedir de",
    footer1: "© 2026 Snackly — hecho con amor", footer2: "en",
    ticker: ["Desde 2020", "Más de 400 clientes felices", "Reseñas positivas", "Hecho en casa", "Entrega directa zona limitada", "Pedido hecho para ti", "Elige lo que te apetezca", "Snacks rápidos de calidad", "Burgers, bocadillos y pizza frescos", "Tu pedido llega bien caliente", "Ambiente joven, precios amigables", "Entrega rápida, plato bien caliente", "Pizzas, burguers y bocadillos con sabor de oro", "Snackly, el sabor de verdad", "Café y té clásicos todo el día", "Un menú renovado desde 2020"],
    rating_e: "✦ Reseñas de clientes", rating_t: "Valoración del local ⭐",
    rating_stat: "4.9/5 — basado en más de 400 reseñas positivas",
    video_e: "✦ Vídeo", video_t: "Descubre Snackly 🎬",
    video_hint: "Espacio reservado para el vídeo promocional",
    socials_t: "Síguenos 📲",
    reserve_e: "✦ Reserva tu mesa", reserve_t: "Reserva de mesa 🪑",
    reserve_name: "Nombre", reserve_name_ph: "Tu nombre completo",
    reserve_date: "Fecha", reserve_time: "Hora", reserve_guests: "Número de personas",
    reserve_guests_1: "persona", reserve_guests_2: "personas", reserve_guests_n: "personas",
    reserve_btn: "Enviar reserva 📅",
    reserve_ok: "Reserva enviada ✅ Te confirmaremos por teléfono",
    reserve_err: "Por favor completa todos los campos",
    drawer_t: "Carrito 🛒", drawer_total: "Total", drawer_checkout: "Pagar ✅",
    cart_empty: "El carrito está vacío.",
    currency: "MAD", line: "línea",
    checkout_t: "Finalizar pedido 📝", ck_name: "Nombre completo *", ck_name_ph: "Ej: Youssef Alaoui",
    ck_phone: "Teléfono *", ck_phone_ph: "06XXXXXXXX",
    ck_addr: "Dirección *", ck_addr_ph: "Barrio, calle, número",
    pay_m: "Método de pago", pay_cash: "💵 Contra reembolso", pay_card: "💳 Tarjeta bancaria", pay_cmi: "🏦 Transferencia CMI",
    total_full: "Total", submit: "Confirmar 🚀",
    compl_t: "¿Una observación o queja?",
    compl_btn: "Enviar queja", compl_def: "Hola, tengo una queja:", compl_ok: "Abrimos WhatsApp para que escribas tu queja",
    header_reserve: "Reservar mesa",
    lang_title: "Cambiar idioma", ar: "العربية", fr: "Français", en: "English", es: "Español",
    call_owner: "Llamar al local",
    m: {
      fries: ["Patatas fritas", "Crujientes y doradas"], cheese: ["Palitos de queso", "Queso fundido y crujiente"],
      samosa: ["Samosa de queso", "Crujiente rellena de queso"], croquette: ["Croquetas de pollo", "Rellenas de pollo con salsa"],
      chips: ["Patatas chips saladas", "Clásicas"], chips_hot: ["Chips picantes", "Sabor picante estilo marroquí"],
      pretzel: ["Pretzel salado", "Palitos salados crujientes"], mixnuts: ["Frutos secos", "Almendras, anacardos y pistachos"],
      peanuts: ["Cacahuetes tostados", "Tostados con sal marina"], almonds: ["Almendras saladas", "Tostadas y saladas"],
      donut: ["Donut de azúcar", "Suave y dulce"], cookie: ["Galleta de chocolate", "Rica en chocolate"],
      croissant: ["Croissant de almendra", "Con almendra y mantequilla"], briouat: ["Briouat de almendra", "Dulce marroquí auténtico"],
      tea: ["Té de menta", "Té marroquí caliente"], orange: ["Zumo de naranja", "Fresco exprimido"],
      soda: ["Refresco frío", "Frío y refrescante"], coffee: ["Café turco", "Concentrado al fuego"]
    },
    c: { "مقليات": "Fritos", "مالح ومقرمش": "Salado y crujiente", "حلويات": "Dulces", "مشروبات": "Bebidas" }
  }
};

const Lang = {
  get() {
    const v = localStorage.getItem("snackly_lang");
    return LANG_CODES.indexOf(v) > -1 ? v : "ar";
  },
  set(code) {
    if (LANG_CODES.indexOf(code) === -1) code = "ar";
    localStorage.setItem("snackly_lang", code);
    this.apply();
    document.dispatchEvent(new CustomEvent("snackly:lang"));
  },
  t(key) {
    const d = DICT[this.get()];
    return (d && d[key]) || DICT.ar[key] || key;
  },
  dish(id, field) {
    const d = DICT[this.get()];
    const row = d && d.m && d.m[id];
    const rowAr = DICT.ar.m[id];
    if (field === "desc") return (row && row[1]) || (rowAr && rowAr[1]) || "";
    return (row && row[0]) || (rowAr && rowAr[0]) || id;
  },
  cat(key) {
    const d = DICT[this.get()];
    return (d && d.c && d.c[key]) || DICT.ar.c[key] || key;
  },
  ticker() {
    return this.t("ticker");
  },
  apply() {
    const code = this.get();
    document.documentElement.setAttribute("lang", code);
    document.documentElement.setAttribute("dir", code === "ar" ? "rtl" : "ltr");
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const k = el.getAttribute("data-i18n");
      el.textContent = this.t(k);
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => {
      const k = el.getAttribute("data-i18n-ph");
      el.setAttribute("placeholder", this.t(k));
    });
    const lb = document.getElementById("lang-current");
    if (lb) lb.textContent = code.toUpperCase();
    const btns = document.querySelectorAll("[data-lang]");
    btns.forEach(b => b.classList.toggle("is-active", b.getAttribute("data-lang") === code));
  }
};