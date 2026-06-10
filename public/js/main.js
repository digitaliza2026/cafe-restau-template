(async function () {
  // Safe helpers — never crash on missing elements or null values
  const $ = (id) => document.getElementById(id);
  const set = (id, val) => { const el = $(id); if (el) el.textContent = val ?? ''; };
  const setHTML = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  let data;
  try {
    const res = await fetch('/api/content');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  } catch (e) {
    console.error('Failed to load content:', e);
    // Show a user-friendly error rather than staying on "Loading…"
    set('heroHeadline', 'Welcome');
    set('heroSubheadline', 'We\'ll be right back.');
    return;
  }

  const { settings, menu, gallery, testimonials } = data;

  // ---------- Theme ----------
  const t = settings.theme || {};
  const root = document.documentElement;
  if (t.primary)    root.style.setProperty('--primary', t.primary);
  if (t.accent)     root.style.setProperty('--accent', t.accent);
  if (t.background) root.style.setProperty('--background', t.background);
  if (t.text)       root.style.setProperty('--text', t.text);
  if (t.font)       root.style.setProperty('--font', t.font);

  // ---------- Title / logo ----------
  const siteName = settings.site_name || 'Cafe';
  document.title = siteName;
  set('navLogo', siteName);
  set('footerName', siteName);
  set('year', new Date().getFullYear());

  // ---------- Hero ----------
  set('heroHeadline', settings.hero_headline || siteName);
  set('heroSubheadline', settings.hero_subheadline || '');
  const cta = $('heroCta');
  if (cta) {
    cta.textContent = settings.hero_cta_text || 'View Menu';
    cta.href = settings.hero_cta_link || '#menu';
  }
  const heroBg = $('heroBg');
  if (heroBg && settings.hero_image) {
    heroBg.style.backgroundImage = `url('${esc(settings.hero_image)}')`;
  }

  // ---------- About ----------
  set('aboutTitle', settings.about_title || 'About');
  set('aboutText', settings.about_text || '');
  const aboutImage = $('aboutImage');
  if (aboutImage && settings.about_image) {
    aboutImage.style.backgroundImage = `url('${esc(settings.about_image)}')`;
  }

  // ---------- Reservations (optional section) ----------
  const resTitle = $('reservationTitle');
  const resText  = $('reservationText');
  const resNote  = $('reservationNote');
  if (resTitle) resTitle.textContent = settings.reservation_title || 'Book a Table';
  if (resText)  resText.textContent  = settings.reservation_text  || '';
  if (resNote)  resNote.textContent  = settings.reservation_note  || '';

  // ---------- Menu ----------
  const visibleCats = (menu || []).filter(c => c.items && c.items.length > 0);
  const tabs = $('menuTabs');
  const list = $('menuList');
  if (list) {
    if (!visibleCats.length) {
      list.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--muted)">Menu coming soon.</p>`;
    } else {
      visibleCats.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.className = 'menu-tab' + (i === 0 ? ' active' : '');
        btn.textContent = c.name;
        btn.dataset.id = c.id;
        btn.addEventListener('click', () => {
          document.querySelectorAll('.menu-tab').forEach(t => t.classList.remove('active'));
          btn.classList.add('active');
          renderMenuItems(c);
        });
        if (tabs) tabs.appendChild(btn);
      });
      renderMenuItems(visibleCats[0]);
    }
  }
  function renderMenuItems(cat) {
    if (!list) return;
    list.innerHTML = cat.items.map(item => `
      <div class="menu-item">
        ${item.image ? `<div class="menu-item-img" style="background-image:url('${esc(item.image)}')"></div>` : ''}
        <div class="menu-item-info">
          <div class="menu-item-head">
            <span class="menu-item-name">${esc(item.name)}</span>
            <span class="menu-item-price">${esc(item.price)}</span>
          </div>
          ${item.description ? `<p class="menu-item-desc">${esc(item.description)}</p>` : ''}
        </div>
      </div>
    `).join('');
  }

  // ---------- Gallery ----------
  const gg = $('galleryGrid');
  if (gg) {
    gg.innerHTML = (!gallery || gallery.length === 0)
      ? `<p class="gallery-empty">No gallery images yet.</p>`
      : gallery.map(g =>
          `<div class="gallery-item" style="background-image:url('${esc(g.image)}')" title="${esc(g.caption || '')}"></div>`
        ).join('');
  }

  // ---------- Testimonials ----------
  const tg = $('testimonialsGrid');
  if (tg) {
    tg.innerHTML = (!testimonials || testimonials.length === 0)
      ? `<p style="text-align:center;grid-column:1/-1;color:var(--muted)">No reviews yet.</p>`
      : testimonials.map(t => `
          <div class="testimonial">
            <div class="testimonial-stars">${'★'.repeat(Math.max(0, Math.min(5, t.rating || 5)))}</div>
            <p class="testimonial-text">"${esc(t.text)}"</p>
            <p class="testimonial-name">— ${esc(t.name)}</p>
          </div>
        `).join('');
  }

  // ---------- Contact ----------
  set('contactAddress', settings.contact_address || '');
  set('contactPhone',   settings.contact_phone   || '');
  set('contactEmail',   settings.contact_email   || '');

  // Hours
  const hours = settings.hours || {};
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  setHTML('hoursList', days.map(d =>
    `<li><span class="hours-day">${d}</span><span>${esc(hours[d] || 'Closed')}</span></li>`
  ).join(''));

  // Socials
  const social = settings.social || {};
  const socialEntries = Object.entries(social).filter(([, url]) => url && url.trim());
  const icons = { instagram: 'IG', facebook: 'FB', tiktok: 'TT', twitter: 'X', youtube: 'YT' };
  setHTML('socials', socialEntries.map(([name, url]) =>
    `<a href="${esc(url)}" target="_blank" rel="noopener" title="${esc(name)}">${icons[name] || name[0].toUpperCase()}</a>`
  ).join(''));

  // Map
  const mapWrap = $('mapWrap');
  if (mapWrap) {
    const embed = settings.contact_map_embed;
    mapWrap.innerHTML = (embed && /^https?:\/\//i.test(embed))
      ? `<iframe src="${esc(embed)}" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>`
      : `<span>Map link not configured</span>`;
  }

  // ---------- Mobile nav ----------
  const toggle = $('navToggle');
  const navLinks = $('navLinks');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => navLinks.classList.toggle('open'));
    navLinks.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => navLinks.classList.remove('open'))
    );
  }
})();
