export class ProductRepo {
  constructor(db) {
    this.db = db;
  }
  all() {
    return this.db.prepare("SELECT * FROM products ORDER BY category, name").all();
  }
  get(id) {
    return this.db.prepare("SELECT * FROM products WHERE id = ?").get(id) || null;
  }
  add(p) {
    this.db
      .prepare(
        "INSERT INTO products (id, name, description, price, image, category, emoji, prep_min, available, options, addons) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
      )
      .run(
        String(p.id || p.name || ""),
        String(p.name || ""),
        String(p.description || ""),
        Number(p.price) || 0,
        String(p.image || ""),
        String(p.category || "عام"),
        String(p.emoji || "🍽️"),
        Math.max(0, Number(p.prepMin != null ? p.prepMin : p.prep_min || 0)),
        p.available === false || Number(p.available) === 0 ? 0 : 1,
        JSON.stringify(p.options || []),
        JSON.stringify(p.addons || [])
      );
    return this.get(String(p.id || p.name || ""));
  }
  update(id, patch) {
    const cur = this.get(id);
    if (!cur) return null;
    const merged = {
      ...cur,
      ...patch,
      price: patch.price != null ? Number(patch.price) : cur.price,
      available: patch.available != null ? Number(patch.available) : cur.available,
      options: patch.options != null ? patch.options : JSON.parse(cur.options || "[]"),
      addons: patch.addons != null ? patch.addons : JSON.parse(cur.addons || "[]"),
    };
    this.db
      .prepare(
        "UPDATE products SET name=?, description=?, price=?, image=?, category=?, emoji=?, prep_min=?, available=?, options=?, addons=? WHERE id=?"
      )
      .run(
        String(merged.name || ""),
        String(merged.description || ""),
        merged.price,
        String(merged.image || ""),
        String(merged.category || "عام"),
        String(merged.emoji || "🍽️"),
        Math.max(0, Number(merged.prep_min || 0)),
        merged.available,
        JSON.stringify(merged.options),
        JSON.stringify(merged.addons),
        id
      );
    return this.get(id);
  }
  remove(id) {
    return this.db.prepare("DELETE FROM products WHERE id = ?").run(id).changes > 0;
  }
  setAvailability(id, on) {
    return this.update(id, { available: on ? 1 : 0 });
  }
  /** بحث شامل: بمعرّف، باسم عربي، أو لاتيني/مختصر. لا يرجّع غير المتوفر */
  byIdOrAlias(q) {
    const text = String(q || "").trim();
    if (!text) return null;
    const row = this.db
      .prepare(
        "SELECT * FROM products WHERE available = 1 AND (id = ? OR name = ? OR lower(id) = lower(?) OR lower(name) = lower(?)) LIMIT 1"
      )
      .get(text, text, text, text);
    if (row) return row;
    // بحث بالتشابه البسيط على name أو id
    const like = "%" + text.toLowerCase() + "%";
    return (
      this.db
        .prepare(
          "SELECT * FROM products WHERE available = 1 AND (lower(id) LIKE ? OR lower(name) LIKE ?) LIMIT 1"
        )
        .get(like, like) || null
    );
  }
  /** بحث فرونت-تاكسيل موجود ولا يُستعمل هنا إلا للعرض */
  find(q) {
    const t = String(q || "").trim();
    if (!t) return [];
    const like = "%" + t.toLowerCase() + "%";
    return this.db
      .prepare(
        "SELECT * FROM products WHERE available = 1 AND (lower(id) LIKE ? OR lower(name) LIKE ? OR category LIKE ?) ORDER BY category, name"
      )
      .all(like, like, like);
  }
}

export class ZoneRepo {
  constructor(db) {
    this.db = db;
  }
  list() {
    return this.db.prepare("SELECT * FROM delivery_zones ORDER BY name").all();
  }
  add(z) {
    this.db
      .prepare("INSERT INTO delivery_zones (name, fee, eta_min, available) VALUES (?,?,?,?)")
      .run(String(z.name || ""), Number(z.fee) || 0, Math.max(1, Number(z.etaMin ?? z.eta_min ?? 30)), z.available === false ? 0 : 1);
    return this.db.prepare("SELECT * FROM delivery_zones ORDER BY id DESC LIMIT 1").get();
  }
  update(id, patch) {
    const cur = this.db.prepare("SELECT * FROM delivery_zones WHERE id = ?").get(id);
    if (!cur) return null;
    this.db
      .prepare("UPDATE delivery_zones SET name=?, fee=?, eta_min=?, available=? WHERE id=?")
      .run(
        String(patch.name ?? cur.name),
        Number(patch.fee ?? cur.fee),
        Math.max(1, Number(patch.etaMin ?? patch.eta_min ?? cur.eta_min)),
        patch.available != null ? Number(patch.available) : cur.available,
        id
      );
    return this.db.prepare("SELECT * FROM delivery_zones WHERE id = ?").get(id);
  }
  remove(id) {
    return this.db.prepare("DELETE FROM delivery_zones WHERE id = ?").run(id).changes > 0;
  }
  setAvailability(id, on) {
    return this.update(id, { available: on ? 1 : 0 });
  }
  findAvailable(name) {
    const t = String(name || "").trim();
    if (!t) return null;
    const like = "%" + t.toLowerCase() + "%";
    return (
      this.db
        .prepare(
          "SELECT * FROM delivery_zones WHERE available = 1 AND (lower(name) LIKE ? OR lower(name) LIKE ?) LIMIT 1"
        )
        .get(like, like) || null
    );
  }
}