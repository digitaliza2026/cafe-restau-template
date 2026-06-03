const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'cafe.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ------- Schema -------
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS menu_categories (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    price       TEXT DEFAULT '',
    image       TEXT DEFAULT '',
    visible     INTEGER DEFAULT 1,
    sort_order  INTEGER DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS gallery (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    image TEXT NOT NULL,
    caption TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS testimonials (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    name   TEXT NOT NULL,
    text   TEXT NOT NULL,
    rating INTEGER DEFAULT 5,
    sort_order INTEGER DEFAULT 0
  );
`);

// ------- Settings helpers -------
const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSetting = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) {
    try { out[r.key] = JSON.parse(r.value); }
    catch { out[r.key] = r.value; }
  }
  return out;
}

function setSettings(obj) {
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) {
      const val = typeof v === 'string' ? v : JSON.stringify(v);
      setSetting.run(k, val);
    }
  });
  tx(Object.entries(obj));
}

function getSettingValue(key, fallback = null) {
  const row = getSetting.get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

// ------- Seed defaults (only if empty) -------
const settingsCount = db.prepare('SELECT COUNT(*) AS n FROM settings').get().n;
if (settingsCount === 0) {
  setSettings({
    site_name: 'Brew & Bean',
    site_tagline: 'Artisan Coffee · Fresh Pastries',
    hero_headline: 'Your Favorite Coffee, Every Morning',
    hero_subheadline: 'Hand-crafted drinks and pastries served in the heart of the city.',
    hero_cta_text: 'View Our Menu',
    hero_cta_link: '#menu',
    hero_image: '',
    about_title: 'Our Story',
    about_text: 'Founded in 2015, Brew & Bean is a family-owned cafe dedicated to serving the finest single-origin coffees and freshly baked goods. Every cup is brewed with care, and every pastry is baked in-house each morning.',
    about_image: '',
    contact_address: '123 Coffee Street, Downtown',
    contact_phone: '+1 (555) 123-4567',
    contact_email: 'hello@brewandbean.example',
    contact_map_embed: '',
    hours: {
      monday: '7:00 AM - 7:00 PM',
      tuesday: '7:00 AM - 7:00 PM',
      wednesday: '7:00 AM - 7:00 PM',
      thursday: '7:00 AM - 7:00 PM',
      friday: '7:00 AM - 9:00 PM',
      saturday: '8:00 AM - 9:00 PM',
      sunday: '8:00 AM - 5:00 PM'
    },
    social: {
      instagram: '',
      facebook: '',
      tiktok: '',
      twitter: ''
    },
    theme: {
      primary: '#8B5E3C',
      accent: '#D4A574',
      background: '#FAF7F2',
      text: '#2B1D14',
      font: "'Georgia', serif"
    }
  });

  const insertCat = db.prepare('INSERT INTO menu_categories (name, sort_order) VALUES (?, ?)');
  const insertItem = db.prepare(`
    INSERT INTO menu_items (category_id, name, description, price, visible, sort_order)
    VALUES (?, ?, ?, ?, 1, ?)
  `);

  const coffeeId = insertCat.run('Coffee', 1).lastInsertRowid;
  const pastriesId = insertCat.run('Pastries', 2).lastInsertRowid;
  const drinksId = insertCat.run('Cold Drinks', 3).lastInsertRowid;

  insertItem.run(coffeeId, 'Espresso', 'Rich, full-bodied single shot', '$3.50', 1);
  insertItem.run(coffeeId, 'Cappuccino', 'Espresso with steamed milk and foam', '$4.75', 2);
  insertItem.run(coffeeId, 'Flat White', 'Smooth espresso with silky microfoam', '$4.95', 3);
  insertItem.run(coffeeId, 'Pour Over', 'Hand-poured single origin, ask about today\u2019s bean', '$5.50', 4);

  insertItem.run(pastriesId, 'Butter Croissant', 'Flaky, golden, baked fresh daily', '$3.75', 1);
  insertItem.run(pastriesId, 'Almond Tart', 'Sweet almond cream in a buttery crust', '$5.25', 2);
  insertItem.run(pastriesId, 'Blueberry Muffin', 'Loaded with fresh wild blueberries', '$3.95', 3);

  insertItem.run(drinksId, 'Iced Latte', 'Espresso over ice with cold milk', '$5.25', 1);
  insertItem.run(drinksId, 'Cold Brew', 'Slow-steeped for 18 hours', '$4.95', 2);

  db.prepare('INSERT INTO testimonials (name, text, rating, sort_order) VALUES (?, ?, ?, ?)')
    .run('Sarah M.', 'Best flat white in town. I come here every morning before work!', 5, 1);
  db.prepare('INSERT INTO testimonials (name, text, rating, sort_order) VALUES (?, ?, ?, ?)')
    .run('David K.', 'The almond tart is unreal. Cozy vibe, friendly baristas.', 5, 2);
  db.prepare('INSERT INTO testimonials (name, text, rating, sort_order) VALUES (?, ?, ?, ?)')
    .run('Priya R.', 'My favorite spot to work remotely. Great wifi and even better coffee.', 5, 3);
}

module.exports = {
  db,
  getAllSettings,
  setSettings,
  getSettingValue
};
