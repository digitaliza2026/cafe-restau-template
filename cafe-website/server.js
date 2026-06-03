require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { db, getAllSettings, setSettings } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------- Static ----------
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------- File uploads ----------
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

// ---------- Auth ----------
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ user: username }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

// ---------- Public content endpoint ----------
app.get('/api/content', (_, res) => {
  const settings = getAllSettings();
  const categories = db.prepare('SELECT * FROM menu_categories ORDER BY sort_order, id').all();
  const items = db.prepare('SELECT * FROM menu_items ORDER BY sort_order, id').all();
  const menu = categories.map(c => ({
    ...c,
    items: items.filter(i => i.category_id === c.id && i.visible === 1)
  }));
  const gallery = db.prepare('SELECT * FROM gallery ORDER BY sort_order, id').all();
  const testimonials = db.prepare('SELECT * FROM testimonials ORDER BY sort_order, id').all();
  res.json({ settings, menu, gallery, testimonials });
});

// ---------- Admin: settings ----------
app.get('/api/admin/settings', authRequired, (_, res) => {
  res.json(getAllSettings());
});

app.put('/api/admin/settings', authRequired, (req, res) => {
  setSettings(req.body || {});
  res.json({ ok: true });
});

// ---------- Admin: upload ----------
app.post('/api/admin/upload', authRequired, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ---------- Admin: menu categories ----------
app.get('/api/admin/menu', authRequired, (_, res) => {
  const cats = db.prepare('SELECT * FROM menu_categories ORDER BY sort_order, id').all();
  const items = db.prepare('SELECT * FROM menu_items ORDER BY sort_order, id').all();
  res.json(cats.map(c => ({ ...c, items: items.filter(i => i.category_id === c.id) })));
});

app.post('/api/admin/categories', authRequired, (req, res) => {
  const { name, sort_order = 0 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  const info = db.prepare('INSERT INTO menu_categories (name, sort_order) VALUES (?, ?)').run(name, sort_order);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/admin/categories/:id', authRequired, (req, res) => {
  const { name, sort_order } = req.body || {};
  db.prepare('UPDATE menu_categories SET name = COALESCE(?, name), sort_order = COALESCE(?, sort_order) WHERE id = ?')
    .run(name, sort_order, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/categories/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM menu_categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Admin: menu items ----------
app.post('/api/admin/items', authRequired, (req, res) => {
  const { category_id, name, description = '', price = '', image = '', visible = 1, sort_order = 0 } = req.body || {};
  if (!category_id || !name) return res.status(400).json({ error: 'category_id and name required' });
  const info = db.prepare(`
    INSERT INTO menu_items (category_id, name, description, price, image, visible, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(category_id, name, description, price, image, visible ? 1 : 0, sort_order);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/admin/items/:id', authRequired, (req, res) => {
  const fields = ['category_id', 'name', 'description', 'price', 'image', 'visible', 'sort_order'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(f === 'visible' ? (req.body[f] ? 1 : 0) : req.body[f]);
    }
  }
  if (!updates.length) return res.json({ ok: true });
  values.push(req.params.id);
  db.prepare(`UPDATE menu_items SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

app.delete('/api/admin/items/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Admin: gallery ----------
app.get('/api/admin/gallery', authRequired, (_, res) => {
  res.json(db.prepare('SELECT * FROM gallery ORDER BY sort_order, id').all());
});

app.post('/api/admin/gallery', authRequired, (req, res) => {
  const { image, caption = '', sort_order = 0 } = req.body || {};
  if (!image) return res.status(400).json({ error: 'image required' });
  const info = db.prepare('INSERT INTO gallery (image, caption, sort_order) VALUES (?, ?, ?)').run(image, caption, sort_order);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/admin/gallery/:id', authRequired, (req, res) => {
  const { caption, sort_order } = req.body || {};
  db.prepare('UPDATE gallery SET caption = COALESCE(?, caption), sort_order = COALESCE(?, sort_order) WHERE id = ?')
    .run(caption, sort_order, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/gallery/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM gallery WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Admin: testimonials ----------
app.get('/api/admin/testimonials', authRequired, (_, res) => {
  res.json(db.prepare('SELECT * FROM testimonials ORDER BY sort_order, id').all());
});

app.post('/api/admin/testimonials', authRequired, (req, res) => {
  const { name, text, rating = 5, sort_order = 0 } = req.body || {};
  if (!name || !text) return res.status(400).json({ error: 'name and text required' });
  const info = db.prepare('INSERT INTO testimonials (name, text, rating, sort_order) VALUES (?, ?, ?, ?)')
    .run(name, text, rating, sort_order);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/admin/testimonials/:id', authRequired, (req, res) => {
  const { name, text, rating, sort_order } = req.body || {};
  db.prepare(`
    UPDATE testimonials
       SET name       = COALESCE(?, name),
           text       = COALESCE(?, text),
           rating     = COALESCE(?, rating),
           sort_order = COALESCE(?, sort_order)
     WHERE id = ?
  `).run(name, text, rating, sort_order, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/testimonials/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM testimonials WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Error handling for uploads ----------
app.use((err, _, res, __) => {
  if (err) return res.status(400).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n  \u2615  Cafe site running:`);
  console.log(`     Public:  http://localhost:${PORT}/`);
  console.log(`     Admin:   http://localhost:${PORT}/admin/`);
  console.log(`     Login:   ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}\n`);
});
