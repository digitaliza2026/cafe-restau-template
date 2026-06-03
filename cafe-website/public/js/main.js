(async function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  let data;
  try {
    const res = await fetch('/api/content');
    data = await res.json();
  } catch (e) {
    console.error('Failed to load content', e);
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
  $('navLogo').textContent = siteName;
  $('footerName').textContent = siteName;
  $('year').textContent = new Date().getFullYear();

  // ---------- Hero ----------
  $('heroHeadline').textContent = settings.hero_headline || siteName;
  $('heroSubheadline').textContent = settings.hero_subheadline || '';
  const cta = $('heroCta');
  cta.textContent = settings.hero_cta_text || 'View Menu';
  cta.href = settings.hero_cta_link || '#menu';
  if (settings.hero_image) {
    $('heroBg').style.backgroundImage = `url('${settings.hero_image}')`;
  }

  // ---------- About ----------
  $('aboutTitle').textContent = settings.about_title || 'About';
  $('aboutText').textContent = settings.about_text || '';
  if (settings.about_image) {
    $('aboutImage').style.backgroundImage = `url('${settings.about_image}')`;
  }

  // ---------- Menu ----------
  const visibleCats = (menu || []).filter(c => c.items && c.items.length > 0);
  const tabs = $('menuTabs');
  const list = $('menuList');
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
      tabs.appendChild(btn);
    });
    renderMenuItems(visibleCats[0]);
  }
  function renderMenuItems(cat) {
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
  if (!gallery || gallery.length === 0) {
    gg.innerHTML = `<p class="gallery-empty">No gallery images yet.</p>`;
  } else {
    gg.innerHTML = gallery.map(g =>
      `<div class="gallery-item" style="background-image:url('${esc(g.image)}')" title="${esc(g.caption || '')}"></div>`
    ).join('');
  }

  // ---------- Testimonials ----------
  const tg = $('testimonialsGrid');
  if (!testimonials || testimonials.length === 0) {
    tg.innerHTML = `<p style="text-align:center;grid-column:1/-1;color:var(--muted)">No reviews yet.</p>`;
  } else {
    tg.innerHTML = testimonials.map(t => `
      <div class="testimonial">
        <div class="testimonial-stars">${'★'.repeat(Math.max(0, Math.min(5, t.rating || 5)))}</div>
        <p class="testimonial-text">"${esc(t.text)}"</p>
        <p class="testimonial-name">— ${esc(t.name)}</p>
      </div>
    `).join('');
  }

  // ---------- Contact ----------
  $('contactAddress').textContent = settings.contact_address || '';
  $('contactPhone').textContent = settings.contact_phone || '';
  $('contactEmail').textContent = settings.contact_email || '';

  // Hours
  const hours = settings.hours || {};
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  $('hoursList').innerHTML = days.map(d =>
    `<li><span class="hours-day">${d}</span><span>${esc(hours[d] || 'Closed')}</span></li>`
  ).join('');

  // Socials
  const social = settings.social || {};
  const socialEntries = Object.entries(social).filter(([_, url]) => url && url.trim());
  const icons = { instagram: 'IG', facebook: 'FB', tiktok: 'TT', twitter: 'X', youtube: 'YT' };
  $('socials').innerHTML = socialEntries.map(([name, url]) =>
    `<a href="${esc(url)}" target="_blank" rel="noopener" title="${esc(name)}">${icons[name] || name[0].toUpperCase()}</a>`
  ).join('');

  // Map
  const mapWrap = $('mapWrap');
  const embed = settings.contact_map_embed;
  if (embed && /^https?:\/\//i.test(embed)) {
    mapWrap.innerHTML = `<iframe src="${esc(embed)}" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>`;
  } else {
    mapWrap.innerHTML = `<span>Map link not configured</span>`;
  }

  // ---------- Mobile nav ----------
  const toggle = $('navToggle');
  const links = $('navLinks');
  toggle.addEventListener('click', () => links.classList.toggle('open'));
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
})();
