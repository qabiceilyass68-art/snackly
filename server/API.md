# خادم سنوكلي — مرجع واجهة برمجة التطبيقات (HTTP API)

> مرجع عملي لكل المسارات التي يعرضها خادم `server/` (Node >= 22.5، صفر اعتماديات).
> يُستعمل إلى جانب دليل الإعداد: `server/SETUP_WHATSAPP.md`.
> **هذا المستند يعتمد جملةً على التنفيذ الفعلي — أي تعديل على الترميز يستدعي تحديثه.**

- المنفذ الافتراضي: `8787` (`PORT`)
- الثبات على قاعدة بيانات SQLite في `data/snackly.db` (`DB_FILE`)
- التشغيل: `npm start` داخل `server/`؛ وزرع البيانات التجريبية: `npm run seed`؛ والاختبارات: `npm test`

المسارات:
1. `/webhook` — عام (مصافحة Meta + استقبال الرسائل)
2. `/api/*` — لوحة الإدارة (محمية بمصادقة)
3. ملفات ساكنة — `/` و`/admin.html`

---

## 1) المصادقة على `/api/*`

كل طلب إلى `/api/*` يبدأ بالفحص الآتي (`Authorization`):

| النوع | الترويسة | ملاحظة |
|---|---|---|
| Basic | `Authorization: Basic base64(user:pass)` | مقبولة دائماً (التحقق المباشر) |
| Bearer | `Authorization: Bearer <token>` | بعد إصدار الجلسة عبر `/api/session` |

الحساب الافتراضي في المبني الحالي: **`admin` / `secret1`**

> **ملاحظة نابعة من الترميز (لا تعديل في هذا المستند):**
> `createAdminRouter` يقرأ `config.adminUser`/`config.adminPass`، وهما غير معرّفين في `src/config.js`
> (التي تخزّن `ADMIN_USER`/`ADMIN_PASS` داخل `config.admin.user/.pass`)، لذلك يقع التحقق دائماً
> على القيم الاحتياطية `admin`/`secret1`. لتغييرهما عملياً يجب ربط هذين المفتاحين في `src/config.js`
> أو تمرير قيم مباشرة عند إنشاء الموجه في `index.js`.

الاستجابات الموحدة:
- `401` → `{ "ok": false, "error": "unauthorized" }`
- `404` → `{ "ok": false, "error": "not_found" }`
- `400` → `{ "ok": false, "error": "<سبب>" }`
- النجاح → `{ "ok": true, ... }` أو كائن البيانات مباشرة

---

## 2) المصافحة والاستقبال — `/webhook`

### `GET /webhook` — مصافحة التحقق (تطلبها Meta عند تسجيل الويب هوك)

| البارامتر (Query) | القيمة |
|---|---|
| `hub.mode` | `subscribe` |
| `hub.verify_token` | يجب تطابق `WHATSAPP_VERIFY_TOKEN` (الافتراضي `snackly-verify-2026`) |
| `hub.challenge` | سلسلة يُعيدها الخادم كما هي |

- تطابق → `200` بنص `hub.challenge`
- لا تطابق → `403` بنص `Invalid token`

### `POST /webhook` — أحداث الرسائل من Meta

- عند تشغيل `WHATSAPP_LIVE` مع `WHATSAPP_APP_SECRET`:
  يُتحقق من `X-Hub-Signature-256` كالتالي:
  `"sha256=" + sha256(appSecret + rawBody)` — أي تجزئة SHA-256 عادية لسلسلة (السر + الجسم الخام).
  فشل التطابق → `401` بنص `Invalid signature`.
- دون `WHATSAPP_LIVE`: يُقبل الجسم دون تحقق توقيع (وضع التطوير — لا إرسال شبكي حقيقي).
- النجاح → `200` فوراً مع `{ "received": true }`، ثم تُعالج الرسائل لاحقاً وتُحفظ.

المعالجة اللاحقة (ما يفعله الخادم بالمحتوى):
- يستخرج الرسائل النصية فقط (`type === "text"`).
- يوحّد صيغة الرقم: بدون `+` يُضاف، والرقم المنزوع منه الصفر الأول يُعبَّأ بـ `+212`.
- يستبعد التكرار عبر `wa_msg_id` (مجموعة `<Set>` داخل الذاكرة).
- يحفظ الرسالة (`messages`) ويحدّث المحادثة (`conversations`).
- إن كان البوت معطّلاً عمومياً (`bot_global_enabled=0`) أو معطّلاً للمحادثة (`bot_enabled=0`):
  يرد بعبارة ثابتة تفيد أن المالك سيرد شخصياً.
- غير ذلك: يمرر النص إلى محرك الوكيل (`agent.handleText`) ويعيد الرد كتابياً.

بنية رسالة نصية واردة تستخرجها `extractMessages`:

```json
{
  "from": "+212650169277",
  "messageId": "wamid.…",
  "text": "بغيت تاكوس",
  "timestamp": "1",
  "phoneNumberId": "1122…",
  "displayPhoneNumber": "+212650169277"
}
```

---

## 3) واجهة لوحة التحكم — `/api/*`

| الطريقة | المسار | الوظيفة |
|---|---|---|
| POST | `/api/session` | إصدار/إنهاء رمز الجلسة |
| GET | `/api/stats` | عدّادات شاملة |
| GET/POST | `/api/products` | قائمة / إنشاء صنف |
| GET/PUT/DELETE | `/api/products/{id}` | قراءة / تعديل / حذف صنف |
| GET/POST | `/api/zones` | قائمة / إنشاء منطقة توصيل |
| PUT/DELETE | `/api/zones/{id}` | تعديل / حذف منطقة |
| GET | `/api/orders` | آخر 200 طلب |
| GET | `/api/orders/{id}` | تفاصيل طلب |
| PUT | `/api/orders/{id}` | تغيير الحالة أو تحديث بيانات الطلب |
| GET | `/api/conversations` | آخر 200 محادثة |
| GET | `/api/conversations/{wa_phone}` | محادثة + رسائلها + طلباتها |
| PUT | `/api/conversations/{wa_phone}` | تفعيل/تعطيل البوت للمحادثة |
| POST | `/api/conversations/{wa_phone}/send` | إرسال رسالة يدوية مسجَّلة |
| GET | `/api/settings` | قراءة كل الإعدادات |
| POST | `/api/settings` | تحديث الإعدادات المسموحة |

### `POST /api/session`
- جسم فارغ أو `{}` → يصدر رمزاً: `{ "ok": true, "token": "<24 بايت hex>" }`
- `{ "action": "logout" }` مع `Authorization: Bearer <token>` → يبطل الرمز: `{ "ok": true }`

### `GET /api/stats`
```json
{
  "orders": 0, "new_orders": 0, "active_orders": 0,
  "products": 0, "conversations": 0
}
```
`active_orders` = عدد طلبات `CONFIRMED` / `PREPARING` / `OUT_FOR_DELIVERY`.

### الأصناف — `products`
- `GET /api/products` → `{ "products": [ … ] }` مع فك `options`/`addons` كمصفوفات.
- `POST /api/products` بالجسم `{ "id", "name", "price", … }`:
  - يُشترط «id، name، price» → وإلا `400 "id/name/price required"`.
  - إن كان `id` موجوداً → `400 "product exists"`.
  - النجاح → `{ "ok": true, "product": { … } }`.
- `GET /api/products/{id}` → `{ "product": { … } }` أو `404`.
- `PUT /api/products/{id}` بجسم تعديل جزئي → `{ "ok": true, "product": { … } }` أو `404`.
- `DELETE /api/products/{id}` → `{ "ok": true }` (حذف معرّف غير موجود لا يُفشِل).

### مناطق التوصيل — `zones`
- `GET /api/zones` → `{ "zones": [ … ] }`
- `POST /api/zones` بجسم `{ "name", "fee"?, "eta_min"? }`: يُشترط الاسم وإلا `400 "name required"`.
  النجاح → `{ "ok": true, "zone": { … } }`.
- `PUT /api/zones/{id}` (معرّف رقمي) → `{ "ok": true, "zone": { … } }`
- `DELETE /api/zones/{id}` → `{ "ok": true }`

### الطلبات — `orders`
- `GET /api/orders` → `{ "orders": [ … ] }` (آخر 200، الأحدث أولاً، `items` مفكوكة).
- `GET /api/orders/{id}` → `{ "order": { … } }` أو `404`.
- `PUT /api/orders/{id}`:
  - بجسم `{ "status": "…" }` ضمن الحالات الصالحة (أدناه) → الانتقال عبر جدول الحالات؛
    انتقال غير مسموح → `400 "invalid_status"` مع بقاء الطلب بحالته.
  - بجسم آخر (تعديل بيانات العميل/العنوان/الملاحظات…) → حفظ الطلب بموضع `save()`
    وإعادة قراءته: `{ "ok": true, "order": { … } }`.

حالات الطلب (`ORDER_STATUS`) وأسماء التسميات:
| الحالة | المعنى | الانتقالات المسموح منها |
|---|---|---|
| `NEW` | جديد | → `CONFIRMED` (ولا يقفز إلى التحضير/التوصيل/التسليم مباشرة) |
| `PENDING_CONFIRMATION` | بانتظار التأكيد | مسار الوكيل الداخلي |
| `CONFIRMED` | مؤكد | → `PREPARING`، `CANCELLED` |
| `PREPARING` | في التحضير | → `OUT_FOR_DELIVERY`، `CANCELLED` |
| `OUT_FOR_DELIVERY` | في الطريق | → `DELIVERED` |
| `DELIVERED` | تم التسليم | نهائية |
| `CANCELLED` | ملغي | نهائية |

### المحادثات — `conversations`
- `GET /api/conversations` → `{ "conversations": [ … ] }` (بالتعريف الفردي عبر `wa_phone`).
- `GET /api/conversations/{wa_phone}` → `{ "conversation": {..}, "messages": [..], "orders": [..] }` أو `404`.
- `PUT /api/conversations/{wa_phone}` بجسم `{ "bot_enabled": 0|1 }` → `{ "ok": true, "conversation": {..} }`.
- `POST /api/conversations/{wa_phone}/send` بجسم `{ "text" }`:
  - نص فارغ → `400 "text required"`؛ محادثة غير موجودة → `404`.
  - النجاح → يسجّل الرسالة (`direction:"out"`, `status:"manual"`) ويعيد `{ "ok": true }`
    (رسالة يدوية مسجّلة فقط — لا إرسال عبر Meta في هذا المسار).

### الإعدادات — `settings`
- `GET /api/settings` → خريطة كل المفاتيح والقيم (كلها سلاسل نصية).
- `POST /api/settings` بجسم خريطة — لا تُقبل إلا المفاتيح التالية:
  `bot_global_enabled`، `default_delivery_fee`، `order_prefix`، `admin_user`، `admin_pass`
  → `{ "ok": true }`. المفاتيح الأخرى يُتجاهل.

القيم الافتراضية عند التهيئة (`seedSettings`): `bot_global_enabled="1"`،
`default_delivery_fee="0"`، `order_prefix="SNK-"`.

---

## 4) نماذج البيانات (كما تُرجعها الواجهة)

### صنف `product`
| الحقل | النوع | ملاحظة |
|---|---|---|
| `id` | string | المفتاح (اختصار لاتيني أو اسم) |
| `name` | string | الاسم الظاهر |
| `description` | string | وصف قصير |
| `price` | number | بالدرهم |
| `image` | string | رابط/مسار |
| `category` | string | الافتراضي `عام` |
| `emoji` | string | رمز عرض |
| `prep_min` | number | دقائق التحضير |
| `available` | 0/1 | توفّر الصنف |
| `options` / `addons` | array | تُرجع مفكوكة عبر API |

### منطقة `zone`
`id` (رقمي)، `name`، `fee`، `eta_min`، `available` (0/1).

### طلب `order`
`id` (مثل `SNK-1001`)، `wa_phone`، `customer_name`، `customer_phone`، `city`، `area`،
`address`، `delivery_type` (الافتراضي `pickup`)، `zone_id`، `notes`، `items`
(مصفوفة `{id, name, qty, price}`)، `items_total`، `delivery_fee`، `total`، `status`،
`ai_summary`، `created_at`، `confirmed_at`، `updated_at`.

### محادثة `conversation`
`wa_phone`، `wa_name`، `bot_enabled` (0/1)، `state` (JSON نصي)، `draft` (JSON نصي)،
`last_activity`، `created_at`.

### رسالة `message`
`id`، `wa_phone`، `direction` (`in`/`out`)، `text`، `status`
(`received`/`delivered`/`manual`)، `wa_msg_id`، `created_at`.

---

## 5) متغيرات البيئة (`server/.env` — مستثنى من النشر)

| المتغير | الافتراضي | الوظيفة |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | — | رمز الوصول للنشر الحقيقي |
| `WHATSAPP_PHONE_NUMBER_ID` | — | معرّف رقم الواتساب |
| `WHATSAPP_VERIFY_TOKEN` | `snackly-verify-2026` | رمز مصافحة الويب هوك |
| `WHATSAPP_APP_SECRET` | — | سرّ التطبيق (تحقق التوقيع) |
| `WHATSAPP_LIVE` | فارغ | `1`/`true` → إرسال فعلي عبر Graph API؛ فارغ → تسجيل محلي فقط |
| `PORT` | `8787` | منفذ الاستماع |
| `ADMIN_USER` / `ADMIN_PASS` | `admin`/`snackly2026` | انظر الملاحظة في قسم المصادقة (لا تُقرأ حالياً في موجه `/api`) |
| `DB_FILE` | `data/snackly.db` | مسار قاعدة البيانات |
| `GRAPH_API_VERSION` | `v19.0` | إصدار واجهة Graph |

وضع `WHATSAPP_LIVE` فارغاً: `sendText` يعيد `{ ok, sent:false, id:"fake-…" }` ويطبع الرد في
سجل الخادم دون أي اتصال شبكي — مفيد للاختبار المحلي قبل النشر.

---

## 6) ملفات ساكنة

| المسار | الملف |
|---|---|
| `/` | `public/index.html` |
| `/admin.html` | `public/admin.html` (لوحة التحكم) |

طوابع المحتوى المدعومة: `.html`، `.js`، `.css`، `.json`، `.png`، `.svg`.
أي مسار آخر → `404`. الحماية من اجتياز المسار (`path traversal`) عبر رفض أي مسار
يغادر مجلد `public/` (`403`).

---

## 7) ملاحظات تنفيذ حقيقية (لا تعديل في هذا المرجع)

1. **توقيع الويب هوك:** التحقق `sha256(appSecret + rawBody)` (تجزئة عادية)، لا يعني بالضرورة
   `HMAC-SHA256` القياسي — إن واجهت رفض توقيع في النشر الحقيقي، راجع هذا الاقتران في `src/whatsapp.js`.
2. **اعتماديات لوحة الإدارة:** القيم الافتراضية `admin`/`secret1` مدمجة في التحقق؛ `.env` لا يؤثر
   حالياً (انظر قسم المصادقة).
3. **إرسال الرسائل اليدوية:** مسار `…/send` يسجّل الرسالة فقط ولا يمرر عبر Meta؛ الإرسال الحقيقي
   الوحيد يكون من داخل معالجة الويب هوك عبر `sendText`.