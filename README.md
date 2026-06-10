# ☕ Cafe Website Template

A complete, self-contained cafe/restaurant website with an admin panel. Everything runs locally — no external services, no build step, no cloud accounts.

## Features

**Public site**
- Hero with editable background image, headline, tagline and CTA
- About section with text and image
- Menu with categories, items, prices, images and visibility toggles
- Image gallery
- Customer testimonials with star ratings
- Contact section with address, phone, email and embedded Google Map
- Opening hours (each day individually)
- Social media links (Instagram, Facebook, TikTok, Twitter/X, YouTube)
- Mobile responsive, clean modern aesthetic

**Admin panel** (`/admin`)
- Username/password login (JWT-based)
- Inline editing for every section of the site
- Drag-and-drop-style image uploads (stored in `/uploads`)
- Menu manager: add/edit/delete categories and items, toggle visibility
- Color & font theme editor with live save
- Preview button to open the live site in a new tab
- Auto-save on most fields

## Tech stack

- **Frontend**: HTML + CSS + Vanilla JS (no framework, no build step)
- **Backend**: Node.js + Express
- **Database**: SQLite (`better-sqlite3`) — single file at `data/cafe.db`
- **Auth**: JWT
- **File uploads**: `multer` (images saved to `/uploads`)

## Setup

Requires **Node.js 18+**.

```bash
npm install
npm start
```

That's it. Open:
- Public site: <http://localhost:3000/>
- Admin: <http://localhost:3000/admin/>

Default login (set in `.env`):
- Username: `admin`
- Password: `admin123`

## Configuration

Edit `.env` to change:

```env
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
JWT_SECRET=change-this-to-a-long-random-string-in-production
```

⚠️ **Change `ADMIN_PASSWORD` and `JWT_SECRET` before deploying anywhere public.**

## File structure

```
cafe-website/
├── server.js              Express server + all API routes
├── db.js                  SQLite schema + default seed data
├── package.json
├── .env                   Admin credentials & JWT secret
├── data/
│   └── cafe.db            SQLite database (auto-created on first run)
├── uploads/               User-uploaded images (auto-created)
└── public/
    ├── index.html         Public website
    ├── css/style.css      Public styles (uses CSS variables for theming)
    ├── js/main.js         Public site logic (fetches /api/content)
    └── admin/
        ├── index.html     Admin login + dashboard
        ├── admin.css
        └── admin.js
```

## How it works

- On first launch, `db.js` creates `data/cafe.db` and seeds it with sample content (default cafe name, menu items, testimonials, theme).
- The public site (`/`) calls `GET /api/content` once on load and renders everything from the response.
- The admin panel (`/admin`) logs in via `POST /api/auth/login`, stores the JWT in `localStorage`, then uses it as `Authorization: Bearer <token>` for all `/api/admin/*` routes.
- Uploads go through `POST /api/admin/upload` (multipart). The server saves the file to `/uploads` and returns its URL, which is then saved into the relevant settings or menu item record.
- The theme editor writes to a `theme` setting; the public site reads it and assigns the values to CSS custom properties (`--primary`, `--accent`, etc.) at runtime.

## Getting a Google Maps embed URL

In the **Contact & Location** admin tab, paste the `src` URL from Google Maps:

1. Find your address on [maps.google.com](https://www.google.com/maps)
2. Click **Share → Embed a map → Copy HTML**
3. From the HTML, copy just the URL inside `src="..."`
4. Paste it into the "Google Maps Embed URL" field

## Resetting

Delete `data/cafe.db` (and the contents of `uploads/`) and restart — the database will be re-created with the default seed content.

## License

MIT — use freely for your own cafe, restaurant or any other project.
