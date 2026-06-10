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

  // ---------- Business type ----------
  const isRestaurant = settings.business_type === 'restaurant';

  // Swap floating hero icons
  const heroIconSets = {
    restaurant: ['🍽️', '🥂', '🍷', '🥗'],
    cafe:       ['☕',  '☕',  '♨',  '🌿'],
  };
  const heroIcons = heroIconSets[settings.business_type] || heroIconSets.cafe;
  document.querySelectorAll('.hero-float').forEach((el, i) => {
    el.textContent = heroIcons[i] || '';
  });

  // Reservations section
  if (isRestaurant) {
    $('reservations').style.display = '';
    $('navReservation').style.display = '';
    $('reservationTitle').textContent = settings.reservation_title || 'Book a Table';
    $('reservationText').textContent  = settings.reservation_text  || '';
    $('reservationNote').textContent  = settings.reservation_note  || '';
    const phone = settings.contact_phone;
    const email = settings.contact_email;
    const actions = $('reservationsActions');
    let html = '';
    if (phone) html += `<a href="tel:${esc(phone)}" class="btn btn-primary">📞 ${esc(phone)}</a>`;
    if (email) html += `<a href="mailto:${esc(email)}" class="btn btn-outline">✉ ${esc(email)}</a>`;
    if (!phone && !email) html = `<a href="#contact" class="btn btn-primary">Contact Us</a>`;
    actions.innerHTML = html;
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

  // ---------- Animations ----------

  // Button ripple effect
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      const el = document.createElement('span');
      el.className = 'btn-ripple';
      const rect = this.getBoundingClientRect();
      el.style.left = (e.clientX - rect.left) + 'px';
      el.style.top  = (e.clientY - rect.top)  + 'px';
      this.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    });
  });

  // Scroll reveal via IntersectionObserver
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('visible');
      revealObs.unobserve(el);
      el.addEventListener('transitionend', () => {
        el.classList.remove('reveal', 'from-left', 'from-right',
          'stagger-1', 'stagger-2', 'stagger-3', 'stagger-4', 'stagger-5', 'stagger-6');
      }, { once: true });
    });
  }, { threshold: 0.1 });

  function revealEl(el, dir) {
    if (!el) return;
    el.classList.add('reveal');
    if (dir) el.classList.add(dir);
    revealObs.observe(el);
  }

  function revealList(els) {
    els.forEach((el, i) => {
      el.classList.add('reveal', `stagger-${Math.min((i % 6) + 1, 6)}`);
      revealObs.observe(el);
    });
  }

  // Section titles (with accent underline)
  document.querySelectorAll('.section-title').forEach(t => revealEl(t));

  // About columns
  revealEl(document.querySelector('.about-grid > div:first-child'), 'from-left');
  revealEl(document.querySelector('#aboutImage'), 'from-right');

  // Menu items — also re-apply after tab switches
  function applyMenuReveal() {
    revealList(Array.from(document.querySelectorAll('.menu-item')));
  }
  applyMenuReveal();
  document.querySelectorAll('.menu-tab').forEach(tab => {
    tab.addEventListener('click', () => requestAnimationFrame(applyMenuReveal));
  });

  // Gallery & testimonials
  revealList(Array.from(document.querySelectorAll('.gallery-item')));
  revealList(Array.from(document.querySelectorAll('.testimonial')));

  // Contact columns
  const contactCols = Array.from(document.querySelectorAll('.contact-grid > *'));
  if (contactCols[0]) revealEl(contactCols[0], 'from-left');
  if (contactCols[1]) revealEl(contactCols[1], 'from-right');

  // Hero parallax
  const heroBgEl = $('heroBg');
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y < window.innerHeight) {
      heroBgEl.style.transform = `translateY(${y * 0.3}px)`;
    }
  }, { passive: true });
})();
