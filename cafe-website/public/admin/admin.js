(function () {
  const $  = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const TOKEN_KEY = 'cafe_admin_token';
  let token = localStorage.getItem(TOKEN_KEY);
  let settings = {};

  // ---------- API helper ----------
  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opts.body && !(opts.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(path, { ...opts, headers });
    if (res.status === 401) {
      logout();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.status === 204 ? null : res.json();
  }

  function toast(msg, isError = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('error', !!isError);
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---------- Login / Logout ----------
  function showLogin() {
    $('#loginScreen').classList.remove('hidden');
    $('#dashboard').classList.add('hidden');
  }
  function showDashboard() {
    $('#loginScreen').classList.add('hidden');
    $('#dashboard').classList.remove('hidden');
    loadAll();
  }
  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    token = null;
    showLogin();
  }
  $('#logoutBtn').addEventListener('click', logout);

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#loginError').textContent = '';
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: $('#loginUser').value,
          password: $('#loginPass').value
        })
      });
      if (!r.ok) throw new Error('Invalid credentials');
      const { token: t } = await r.json();
      token = t;
      localStorage.setItem(TOKEN_KEY, t);
      showDashboard();
    } catch (err) {
      $('#loginError').textContent = err.message;
    }
  });

  // ---------- Tabs ----------
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.tab;
      $$('.panel').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== target));
    });
  });

  // ---------- Image uploader (delegated) ----------
  async function uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  }

  function renderImageUploader(el, currentUrl) {
    if (currentUrl) {
      el.classList.add('has-image');
      el.innerHTML = `
        <div class="preview">
          <img src="${esc(currentUrl)}" alt="" />
          <button type="button" class="remove-img">Remove</button>
        </div>
      `;
    } else {
      el.classList.remove('has-image');
      el.innerHTML = `<div class="upload-prompt">Click to upload image (max 8MB)</div>`;
    }
  }

  document.addEventListener('click', async (e) => {
    // Remove image
    if (e.target.classList.contains('remove-img')) {
      const uploader = e.target.closest('.image-uploader');
      const key = uploader.dataset.setting;
      if (key) {
        settings[key] = '';
        await api('/api/admin/settings', { method: 'PUT', body: { [key]: '' } });
        renderImageUploader(uploader, '');
        toast('Image removed');
      } else if (uploader.dataset.itemImage) {
        // Inline menu item image — handled in menu code
        const id = uploader.dataset.itemImage;
        await api(`/api/admin/items/${id}`, { method: 'PUT', body: { image: '' } });
        uploader.style.backgroundImage = '';
        uploader.textContent = '+ img';
        toast('Image removed');
      }
      e.stopPropagation();
      return;
    }
    // Click to upload (settings uploader)
    const uploader = e.target.closest('.image-uploader');
    if (uploader && !uploader.dataset.galleryUpload && !uploader.dataset.itemImage) {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = async () => {
        if (!input.files[0]) return;
        try {
          const { url } = await uploadFile(input.files[0]);
          const key = uploader.dataset.setting;
          await api('/api/admin/settings', { method: 'PUT', body: { [key]: url } });
          settings[key] = url;
          renderImageUploader(uploader, url);
          toast('Image uploaded');
        } catch (err) { toast(err.message, true); }
      };
      input.click();
    }
  });

  // ---------- Load all ----------
  async function loadAll() {
    try {
      settings = await api('/api/admin/settings');
      hydrateSettings();
      hydrateHours();
      hydrateSocial();
      hydrateTheme();
      await loadMenu();
      await loadGallery();
      await loadTestimonials();
    } catch (err) {
      console.error(err);
    }
  }

  function hydrateSettings() {
    $$('[data-setting]').forEach(el => {
      const key = el.dataset.setting;
      const val = settings[key];
      if (el.classList.contains('image-uploader')) {
        renderImageUploader(el, val || '');
      } else {
        el.value = val || '';
      }
    });
  }

  // Generic "Save settings" button
  $$('[data-save="settings"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const panel = btn.closest('.panel');
      const payload = {};
      $$('[data-setting]', panel).forEach(el => {
        if (!el.classList.contains('image-uploader')) {
          payload[el.dataset.setting] = el.value;
        }
      });
      // If this panel also contains hours, save those too
      const hoursRows = $$('.hours-row', panel);
      if (hoursRows.length) {
        const hours = {};
        hoursRows.forEach(r => hours[r.dataset.day] = $('input', r).value);
        payload.hours = hours;
      }
      try {
        await api('/api/admin/settings', { method: 'PUT', body: payload });
        Object.assign(settings, payload);
        toast('Saved');
      } catch (err) { toast(err.message, true); }
    });
  });

  // ---------- Hours ----------
  const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  function hydrateHours() {
    const wrap = $('#hoursEditor');
    const hours = settings.hours || {};
    wrap.innerHTML = DAYS.map(d => `
      <div class="hours-row" data-day="${d}">
        <label>${d}</label>
        <input type="text" value="${esc(hours[d] || '')}" placeholder="9:00 AM - 5:00 PM or Closed" />
      </div>
    `).join('');
  }

  // ---------- Social ----------
  function hydrateSocial() {
    const social = settings.social || {};
    $$('[data-social]').forEach(el => {
      el.value = social[el.dataset.social] || '';
    });
  }
  $$('[data-save="social"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const social = {};
      $$('[data-social]').forEach(el => social[el.dataset.social] = el.value.trim());
      try {
        await api('/api/admin/settings', { method: 'PUT', body: { social } });
        settings.social = social;
        toast('Social links saved');
      } catch (err) { toast(err.message, true); }
    });
  });

  // ---------- Theme ----------
  function hydrateTheme() {
    const theme = settings.theme || {};
    $$('[data-theme]').forEach(el => {
      const key = el.dataset.theme;
      if (theme[key]) el.value = theme[key];
    });
  }
  $$('[data-save="theme"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const theme = {};
      $$('[data-theme]').forEach(el => theme[el.dataset.theme] = el.value);
      try {
        await api('/api/admin/settings', { method: 'PUT', body: { theme } });
        settings.theme = theme;
        toast('Theme saved');
      } catch (err) { toast(err.message, true); }
    });
  });

  // ---------- Menu ----------
  let menuData = [];

  async function loadMenu() {
    menuData = await api('/api/admin/menu');
    renderMenu();
  }

  function renderMenu() {
    const wrap = $('#menuEditor');
    if (!menuData.length) {
      wrap.innerHTML = '<p class="hint">No categories yet. Add one above.</p>';
      return;
    }
    wrap.innerHTML = menuData.map(cat => `
      <div class="category-block" data-cat="${cat.id}">
        <div class="category-head">
          <input class="cat-name" type="text" value="${esc(cat.name)}" />
          <button class="small" data-rename="${cat.id}">Rename</button>
          <button class="danger" data-del-cat="${cat.id}">Delete</button>
        </div>
        ${cat.items.map(item => `
          <div class="item-row" data-item="${item.id}">
            <div class="image-uploader item-img" data-item-image="${item.id}"
                 style="${item.image ? `background-image:url('${esc(item.image)}')` : ''}">
              ${item.image ? '' : '+ img'}
            </div>
            <input type="text" data-field="name" value="${esc(item.name)}" placeholder="Name" />
            <input type="text" data-field="description" value="${esc(item.description)}" placeholder="Description" />
            <input type="text" data-field="price" value="${esc(item.price)}" placeholder="Price" />
            <label class="toggle">
              <input type="checkbox" data-field="visible" ${item.visible ? 'checked' : ''} />
              Visible
            </label>
            <button class="danger" data-del-item="${item.id}">×</button>
          </div>
        `).join('')}
        <div class="item-add-row">
          <button class="small" data-add-item="${cat.id}">+ Add Item</button>
        </div>
      </div>
    `).join('');
  }

  // Add category
  $('#addCatBtn').addEventListener('click', async () => {
    const name = $('#newCatName').value.trim();
    if (!name) return;
    try {
      await api('/api/admin/categories', { method: 'POST', body: { name, sort_order: menuData.length + 1 } });
      $('#newCatName').value = '';
      await loadMenu();
      toast('Category added');
    } catch (err) { toast(err.message, true); }
  });

  // Delegated menu events
  $('#menuEditor').addEventListener('click', async (e) => {
    const t = e.target;

    // Delete category
    if (t.dataset.delCat) {
      if (!confirm('Delete this category and all items in it?')) return;
      await api(`/api/admin/categories/${t.dataset.delCat}`, { method: 'DELETE' });
      await loadMenu();
      toast('Deleted');
      return;
    }
    // Rename category
    if (t.dataset.rename) {
      const block = t.closest('.category-block');
      const name = $('.cat-name', block).value.trim();
      if (!name) return;
      await api(`/api/admin/categories/${t.dataset.rename}`, { method: 'PUT', body: { name } });
      toast('Renamed');
      return;
    }
    // Add item
    if (t.dataset.addItem) {
      await api('/api/admin/items', { method: 'POST', body: {
        category_id: parseInt(t.dataset.addItem, 10),
        name: 'New Item',
        description: '',
        price: '',
        visible: 1
      }});
      await loadMenu();
      return;
    }
    // Delete item
    if (t.dataset.delItem) {
      if (!confirm('Delete this item?')) return;
      await api(`/api/admin/items/${t.dataset.delItem}`, { method: 'DELETE' });
      await loadMenu();
      toast('Deleted');
      return;
    }
    // Item image upload
    if (t.dataset.itemImage) {
      const id = t.dataset.itemImage;
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = async () => {
        if (!input.files[0]) return;
        try {
          const { url } = await uploadFile(input.files[0]);
          await api(`/api/admin/items/${id}`, { method: 'PUT', body: { image: url } });
          t.style.backgroundImage = `url('${url}')`;
          t.textContent = '';
          toast('Image set');
        } catch (err) { toast(err.message, true); }
      };
      input.click();
    }
  });

  // Inline item edits (auto-save on change/blur)
  $('#menuEditor').addEventListener('change', async (e) => {
    const row = e.target.closest('.item-row');
    if (!row) return;
    const field = e.target.dataset.field;
    if (!field) return;
    const id = row.dataset.item;
    const value = e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value;
    try {
      await api(`/api/admin/items/${id}`, { method: 'PUT', body: { [field]: value } });
      toast('Saved');
    } catch (err) { toast(err.message, true); }
  });

  // ---------- Gallery ----------
  async function loadGallery() {
    const items = await api('/api/admin/gallery');
    $('#galleryList').innerHTML = items.map(g => `
      <div class="gallery-admin-item" style="background-image:url('${esc(g.image)}')">
        <button data-del-gallery="${g.id}">×</button>
      </div>
    `).join('') || '<p class="hint">No images yet.</p>';
  }

  $('#galleryUpload').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
    input.onchange = async () => {
      try {
        for (const file of input.files) {
          const { url } = await uploadFile(file);
          await api('/api/admin/gallery', { method: 'POST', body: { image: url } });
        }
        await loadGallery();
        toast('Image(s) added');
      } catch (err) { toast(err.message, true); }
    };
    input.click();
  });

  $('#galleryList').addEventListener('click', async (e) => {
    if (e.target.dataset.delGallery) {
      if (!confirm('Remove this image?')) return;
      await api(`/api/admin/gallery/${e.target.dataset.delGallery}`, { method: 'DELETE' });
      await loadGallery();
      toast('Removed');
    }
  });

  // Show initial empty state for gallery uploader
  renderImageUploader($('#galleryUpload'), '');
  // override: gallery upload should always show "click to upload"
  $('#galleryUpload').innerHTML = '<div class="upload-prompt">Click to upload one or more images</div>';

  // ---------- Testimonials ----------
  async function loadTestimonials() {
    const items = await api('/api/admin/testimonials');
    $('#testimonialsList').innerHTML = items.map(t => `
      <div class="testimonial-card" data-t="${t.id}">
        <textarea data-tfield="text">${esc(t.text)}</textarea>
        <div class="t-meta">
          <input type="text" data-tfield="name" value="${esc(t.name)}" placeholder="Name" />
          <input type="number" data-tfield="rating" min="1" max="5" value="${t.rating}" />
        </div>
        <button class="danger" data-del-t="${t.id}">×</button>
      </div>
    `).join('') || '<p class="hint">No testimonials yet.</p>';
  }

  $('#addTestimonialBtn').addEventListener('click', async () => {
    const name = $('#tName').value.trim();
    const text = $('#tText').value.trim();
    const rating = parseInt($('#tRating').value, 10) || 5;
    if (!name || !text) { toast('Name and text required', true); return; }
    try {
      await api('/api/admin/testimonials', { method: 'POST', body: { name, text, rating } });
      $('#tName').value = ''; $('#tText').value = ''; $('#tRating').value = 5;
      await loadTestimonials();
      toast('Added');
    } catch (err) { toast(err.message, true); }
  });

  $('#testimonialsList').addEventListener('click', async (e) => {
    if (e.target.dataset.delT) {
      if (!confirm('Delete this testimonial?')) return;
      await api(`/api/admin/testimonials/${e.target.dataset.delT}`, { method: 'DELETE' });
      await loadTestimonials();
      toast('Deleted');
    }
  });

  $('#testimonialsList').addEventListener('change', async (e) => {
    const card = e.target.closest('.testimonial-card');
    if (!card) return;
    const field = e.target.dataset.tfield;
    if (!field) return;
    const id = card.dataset.t;
    const value = field === 'rating' ? parseInt(e.target.value, 10) : e.target.value;
    try {
      await api(`/api/admin/testimonials/${id}`, { method: 'PUT', body: { [field]: value } });
      toast('Saved');
    } catch (err) { toast(err.message, true); }
  });

  // ---------- Boot ----------
  if (token) {
    // Verify by trying a request; if invalid, login screen reappears via 401
    showDashboard();
  } else {
    showLogin();
  }
})();
