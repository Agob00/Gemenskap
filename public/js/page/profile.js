(function () {
  window.UI.renderHeader({ loggedIn: true });

  const params = new URLSearchParams(location.search);
  const viewId = Number(params.get('id'));
  const content = document.getElementById('profile-content');

  // Known Swedish cities with coordinates for geolocation
  const CITIES_GEO = [
    { name: 'Stockholm',   lat: 59.3293, lon: 18.0686 },
    { name: 'Göteborg',    lat: 57.7089, lon: 11.9746 },
    { name: 'Malmö',       lat: 55.6050, lon: 13.0038 },
    { name: 'Uppsala',     lat: 59.8586, lon: 17.6389 },
    { name: 'Västerås',    lat: 59.6099, lon: 16.5448 },
    { name: 'Örebro',      lat: 59.2753, lon: 15.2134 },
    { name: 'Linköping',   lat: 58.4108, lon: 15.6214 },
    { name: 'Helsingborg', lat: 56.0465, lon: 12.6945 },
    { name: 'Norrköping',  lat: 58.5877, lon: 16.1924 },
    { name: 'Lund',        lat: 55.7047, lon: 13.1910 },
    { name: 'Umeå',        lat: 63.8258, lon: 20.2630 },
    { name: 'Jönköping',   lat: 57.7826, lon: 14.1618 },
    { name: 'Karlstad',    lat: 59.3793, lon: 13.5036 },
    { name: 'Växjö',       lat: 56.8777, lon: 14.8091 },
    { name: 'Halmstad',    lat: 56.6745, lon: 12.8578 },
    { name: 'Kalmar',      lat: 56.6634, lon: 16.3567 },
    { name: 'Sundsvall',   lat: 62.3908, lon: 17.3069 },
    { name: 'Gävle',       lat: 60.6749, lon: 17.1413 },
  ];

  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function findNearestCity(lat, lon) {
    let best = null;
    let bestDist = Infinity;
    for (const c of CITIES_GEO) {
      const d = haversineDistance(lat, lon, c.lat, c.lon);
      if (d < bestDist) { bestDist = d; best = c; }
    }
    return best ? best.name : null;
  }

  async function reverseGeocode(lat, lon) {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1&accept-language=sv`,
        { headers: { 'User-Agent': 'Gemenskap/1.0' } }
      );
      if (resp.ok) {
        const data = await resp.json();
        const addr = data.address || {};
        const cityName = addr.city || addr.town || addr.municipality || addr.county;
        if (cityName) return cityName;
      }
    } catch (e) {
      console.warn('[profile] reverse geocode unavailable, falling back to nearest city:', e);
    }
    return findNearestCity(lat, lon);
  }

  function resizeImage(file, maxSize, callback) {
    const reader = new FileReader();
    reader.onload = function (ev) {
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function renderOwn(u) {
    window.UI.renderBottomNav(null);
    const hasAvatar = !!u.avatarUrl;

    const INTERESTS = window.Interests.all();

    // Endast fördefinierade intressen tillåts. Eventuella legacy "custom"-
    // intressen visas inte längre (de filtreras tyst — server tar bort
    // dem nästa gång profilen sparas).
    const selected = new Set();
    for (const i of (u.interests || [])) {
      if (INTERESTS.includes(i)) selected.add(i);
    }

    content.innerHTML = `
      <div class="section-header" style="margin-bottom:8px;">
        <span class="section-icon" aria-hidden="true">&#128100;</span>
        <h1 style="margin:0;" data-i18n="profile.title">${window.UI.escape(window.I18n.t('profile.title'))}</h1>
      </div>

      <div class="profile-header">
        <div id="avatar-display" style="cursor:pointer;" title="${window.UI.escape(window.I18n.t(hasAvatar ? 'profile.change_photo' : 'profile.upload_photo'))}">
          ${window.UI.avatar(u.display_name, 'lg', u.avatarUrl)}
          <input type="file" id="avatar-input" accept="image/*" style="display:none;">
        </div>
        <div class="profile-info">
          <h1>${window.UI.escape(u.display_name || '')}</h1>
          <p>${window.UI.escape(u.city || '')}</p>
        </div>
      </div>

      <div class="btn-row" style="margin-bottom:20px;">
        <button class="btn btn-secondary" id="photo-btn">
          &#128247; ${window.UI.escape(window.I18n.t(hasAvatar ? 'profile.change_photo' : 'profile.upload_photo'))}
        </button>
        ${hasAvatar ? `<button class="btn btn-quiet" id="remove-photo-btn">
          &#128465; ${window.UI.escape(window.I18n.t('profile.remove_photo'))}
        </button>` : ''}
      </div>

      <div class="card">
        <div class="field">
          <label for="name" data-i18n="onboarding.name_label"></label>
          <input id="name" type="text" maxlength="60" value="${window.UI.escape(u.display_name || '')}" />
        </div>
        <div class="field">
          <label for="city" data-i18n="onboarding.city_label"></label>
          <div class="city-row">
            <input id="city" type="text" maxlength="60" value="${window.UI.escape(u.city || '')}" />
            <button type="button" class="btn btn-secondary city-locate-btn" id="locate-btn">
              <span class="locate-icon" aria-hidden="true">&#9737;</span>
              <span data-i18n="onboarding.detect_location"></span>
            </button>
          </div>
          <div id="location-status" class="field-help" hidden></div>
        </div>
        <div class="field">
          <label for="bio" data-i18n="profile.bio_label"></label>
          <span class="field-help" data-i18n="profile.bio_help"></span>
          <textarea id="bio" maxlength="1000">${window.UI.escape(u.bio || '')}</textarea>
        </div>
        <div class="field">
          <label data-i18n="onboarding.interests_label"></label>
          <div id="interests"></div>
        </div>
        <div class="btn-row">
          <button class="btn" id="save-btn" data-i18n="profile.save"></button>
        </div>
      </div>

      <div class="card">
        <div class="section-header" style="margin-bottom:12px;">
          <span class="section-icon" aria-hidden="true">&#128101;</span>
          <h2 style="margin:0;" data-i18n="profile.communities_title"></h2>
        </div>
        <div id="my-communities"></div>
      </div>

      <div class="card" id="created-communities-card" hidden>
        <div class="section-header" style="margin-bottom:12px;">
          <span class="section-icon" aria-hidden="true">&#10024;</span>
          <h2 style="margin:0;" data-i18n="profile.created_title"></h2>
        </div>
        <p class="muted" data-i18n="profile.created_help" style="font-size:var(--font-sm);margin:0 0 12px;"></p>
        <div id="created-communities"></div>
      </div>

      <div class="card card-plain">
        <div class="section-header" style="margin-bottom:12px;">
          <span class="section-icon" aria-hidden="true">&#9881;</span>
          <h2 style="margin:0;" data-i18n="profile.settings_title">${window.UI.escape(window.I18n.t('profile.settings_title'))}</h2>
        </div>
        <div class="btn-row">
          <button class="btn btn-secondary" id="replay-btn">&#127891; <span data-i18n="profile.replay_tutorial"></span></button>
          <button class="btn btn-quiet" id="logout-btn">&#128682; <span data-i18n="common.logout"></span></button>
        </div>
      </div>

      <div class="card card-plain">
        <div class="section-header" style="margin-bottom:12px;">
          <span class="section-icon" aria-hidden="true">&#128737;</span>
          <h2 style="margin:0;" data-i18n="profile.blocked_title"></h2>
        </div>
        <div id="blocked-list"></div>
      </div>

      <div class="card card-plain">
        <div class="section-header" style="margin-bottom:12px;">
          <span class="section-icon" aria-hidden="true">&#128274;</span>
          <h2 style="margin:0;" data-i18n="profile.privacy_title"></h2>
        </div>
        <p class="muted" data-i18n="profile.export_help"></p>
        <div class="btn-row">
          <button class="btn btn-secondary" id="export-btn">&#128190; <span data-i18n="profile.export_data"></span></button>
        </div>
      </div>

      <hr class="divider">
      <div class="card" style="border-left-color:var(--color-error);">
        <h2 data-i18n="profile.delete_account" style="color:var(--color-error);"></h2>
        <p class="muted" data-i18n="profile.delete_confirm"></p>
        <div class="btn-row">
          <button class="btn" id="delete-btn" style="background:var(--color-error);" data-i18n="profile.delete_confirm_button"></button>
        </div>
      </div>
    `;
    window.I18n.applyTranslations(content);

    // ── Avatar upload ──────────────────────────────────────────────
    // Refs som hela tiden refererar de NU levande elementen — viktigt
    // eftersom avatar-input ersätts vid varje uppladdning (innerHTML-byte).
    const photoBtn = document.getElementById('photo-btn');
    const avatarDisplay = document.getElementById('avatar-display');
    function currentAvatarInput() { return document.getElementById('avatar-input'); }

    photoBtn.addEventListener('click', () => {
      const inp = currentAvatarInput();
      if (inp) inp.click();
    });
    avatarDisplay.addEventListener('click', () => {
      const inp = currentAvatarInput();
      if (inp) inp.click();
    });

    // ── Ta bort foto ───────────────────────────────────────────────
    async function removePhoto(btn) {
      const ok = await window.UI.confirmDialog({
        message: window.I18n.t('profile.remove_photo_confirm'),
        destructive: true,
      });
      if (!ok) return;
      btn.disabled = true;
      try {
        await window.API.del('/api/users/me/avatar');
        const nameInput = document.getElementById('name');
        const currentName = (nameInput && nameInput.value) || u.display_name || '';
        avatarDisplay.innerHTML = `${window.UI.avatar(currentName, 'lg', null)}<input type="file" id="avatar-input" accept="image/*" style="display:none;">`;
        const fresh = currentAvatarInput();
        if (fresh) fresh.addEventListener('change', handleAvatarChange);
        photoBtn.innerHTML = '&#128247; ' + window.UI.escape(window.I18n.t('profile.upload_photo'));
        btn.remove();
        window.Auth.clearCache();
        window.UI.showAlert('#alert', 'success', window.I18n.t('profile.photo_removed'));
      } catch (e) {
        // Om endpointen inte finns har servern inte laddat in den nya
        // koden — vanligast under utveckling när `npm start` glömts att
        // startas om. Ge ett mer användbart meddelande i det fallet.
        let msg = e.userMessage;
        if (e.status === 404 || e.code === 'not_found') {
          msg = window.I18n.getLang() === 'en'
            ? 'The remove-photo feature is not active on the server yet. Please restart the server (Ctrl+C then `npm start`).'
            : 'Borttagningsfunktionen är inte aktiv på servern än. Starta om servern (Ctrl+C och sedan `npm start`).';
        }
        window.UI.showAlert('#alert', 'error', msg);
        btn.disabled = false;
      }
    }

    // Lägger till "Ta bort foto"-knappen om den inte finns (används efter
    // ny uppladdning när knappen inte fanns från start).
    function ensureRemovePhotoBtn() {
      if (document.getElementById('remove-photo-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'btn btn-quiet';
      btn.id = 'remove-photo-btn';
      btn.type = 'button';
      btn.innerHTML = '&#128465; ' + window.UI.escape(window.I18n.t('profile.remove_photo'));
      btn.addEventListener('click', () => removePhoto(btn));
      photoBtn.parentNode.appendChild(btn);
    }

    // Namngiven handler så vi enkelt kan binda om efter ny innerHTML.
    async function handleAvatarChange() {
      const inp = currentAvatarInput();
      if (!inp) return;
      const file = inp.files[0];
      if (!file) return;
      photoBtn.disabled = true;
      photoBtn.textContent = window.I18n.t('common.loading');
      resizeImage(file, 400, async (dataUrl) => {
        try {
          const res = await window.API.post('/api/users/me/avatar', { image: dataUrl });
          avatarDisplay.innerHTML = `<img class="avatar avatar-lg" src="${window.UI.escape(res.avatarUrl)}" alt="" style="object-fit:cover;width:80px;height:80px;border-radius:50%;"><input type="file" id="avatar-input" accept="image/*" style="display:none;">`;
          // Bind om handlern på den nya input-noden — gamla noden är borta.
          const fresh = currentAvatarInput();
          if (fresh) fresh.addEventListener('change', handleAvatarChange);
          photoBtn.textContent = window.I18n.t('profile.change_photo');
          // Säkerställ att "Ta bort foto"-knappen finns nu när det finns en bild.
          ensureRemovePhotoBtn();
          window.UI.showAlert('#alert', 'success', window.I18n.t('profile.photo_saved'));
          window.Auth.clearCache();
        } catch (e) {
          window.UI.showAlert('#alert', 'error', e.userMessage);
        }
        photoBtn.disabled = false;
      });
    }

    const initialAvatarInput = currentAvatarInput();
    if (initialAvatarInput) initialAvatarInput.addEventListener('change', handleAvatarChange);

    // Knappen kan ha renderats statiskt (om användaren hade en avatar
    // vid sidladdning). Bind handlern.
    const initialRemoveBtn = document.getElementById('remove-photo-btn');
    if (initialRemoveBtn) {
      initialRemoveBtn.addEventListener('click', () => removePhoto(initialRemoveBtn));
    }

    // ── Interest chips (grouped by category) ──────────────────────
    const interestsContainer = document.getElementById('interests');
    function renderChips() {
      window.Interests.render(interestsContainer, selected);
    }
    renderChips();

    // ── Geolocation ────────────────────────────────────────────────
    const locateBtn = document.getElementById('locate-btn');
    const locationStatus = document.getElementById('location-status');
    const cityInput = document.getElementById('city');

    locateBtn.addEventListener('click', async () => {
      if (!navigator.geolocation) {
        showLocStatus('error', window.I18n.t('onboarding.location_failed'));
        return;
      }
      locateBtn.disabled = true;
      locateBtn.classList.add('locating');
      const btnTextEl = locateBtn.querySelector('[data-i18n]');
      if (btnTextEl) btnTextEl.textContent = window.I18n.t('onboarding.detecting_location');

      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false, timeout: 15000, maximumAge: 300000,
          });
        });
        const cityName = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        if (cityName) {
          cityInput.value = cityName;
          showLocStatus('success', window.I18n.t('onboarding.location_found', { city: cityName }));
        } else {
          showLocStatus('error', window.I18n.t('onboarding.location_failed'));
        }
      } catch (err) {
        showLocStatus('error', window.I18n.t(err.code === 1 ? 'onboarding.location_denied' : 'onboarding.location_failed'));
      } finally {
        locateBtn.disabled = false;
        locateBtn.classList.remove('locating');
        if (btnTextEl) btnTextEl.textContent = window.I18n.t('onboarding.detect_location');
      }
    });

    function showLocStatus(type, message) {
      locationStatus.hidden = false;
      locationStatus.textContent = message;
      locationStatus.style.color = type === 'success' ? 'var(--color-success)' : 'var(--color-error)';
      locationStatus.style.fontWeight = '600';
      setTimeout(() => { locationStatus.hidden = true; }, 6000);
    }

    // ── Communities list ───────────────────────────────────────────
    const myCommunities = document.getElementById('my-communities');
    if (u.memberships && u.memberships.length > 0) {
      myCommunities.innerHTML = `<div class="list-stack">${u.memberships
        .map(
          (m) => `<a class="member-row" href="/community.html?id=${m.id}">
            <strong>${window.UI.escape(m.name)}</strong>
            <span class="muted" style="margin-left:auto;">${window.UI.escape(m.city || '')}</span>
          </a>`
        )
        .join('')}</div>`;
    } else {
      myCommunities.innerHTML = `<p class="muted">${window.UI.escape(window.I18n.t('home.no_community'))}</p>`;
    }

    // ── Skapade grupper (separat från medlemskap — bevaras alltid) ──
    const createdCard = document.getElementById('created-communities-card');
    const createdList = document.getElementById('created-communities');
    const created = u.createdCommunities || [];
    const memberIds = new Set((u.memberships || []).map((m) => m.id));
    if (created.length > 0) {
      createdCard.hidden = false;
      createdList.innerHTML = `<div class="list-stack">${created
        .map((c) => {
          const isMember = memberIds.has(c.id);
          const badge = isMember
            ? `<span class="pill" style="background:var(--color-bg-warm);color:var(--color-success);">&#10003; ${window.UI.escape(window.I18n.t('profile.created_member'))}</span>`
            : `<span class="pill" style="background:var(--color-bg-warm);color:var(--color-secondary);">${window.UI.escape(window.I18n.t('profile.created_left'))}</span>`;
          return `<a class="member-row" href="/community.html?id=${c.id}">
            <div style="flex:1;">
              <strong>${window.UI.escape(c.name)}</strong>
              <span class="muted" style="display:block;font-size:14px;">${window.UI.escape(c.city || '')}</span>
            </div>
            ${badge}
          </a>`;
        })
        .join('')}</div>`;
    }

    // ── Save profile ──────────────────────────────────────────────
    document.getElementById('save-btn').addEventListener('click', async () => {
      window.UI.clearAlert('#alert');
      const allInterests = [...selected];
      try {
        await window.API.put('/api/users/me', {
          display_name: document.getElementById('name').value,
          city: document.getElementById('city').value,
          bio: document.getElementById('bio').value,
          interests: allInterests,
          language: window.I18n.getLang(),
        });
        window.Auth.clearCache();
        window.UI.showAlert(
          '#alert',
          'success',
          window.I18n.getLang() === 'sv' ? 'Sparat!' : 'Saved!'
        );
      } catch (e) {
        window.UI.showAlert('#alert', 'error', e.userMessage);
      }
    });

    // Tutorial replay — nollställer också alla kontextuella tips så de visas igen
    document.getElementById('replay-btn').addEventListener('click', () => {
      window.Tutorial.reset();
      if (window.Tips) window.Tips.reset();
      window.Tutorial.show();
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => window.Auth.logout());

    // ── GDPR-export (artikel 20 — dataportabilitet) ────────────────
    document.getElementById('export-btn').addEventListener('click', () => {
      // Triggar nedladdning via direktlänk (cookien skickas automatiskt)
      window.UI.showAlert('#alert', 'info', window.I18n.t('profile.export_started'));
      window.location.href = '/api/users/me/export';
    });

    // ── Blockerade användare ───────────────────────────────────────
    async function loadBlocked() {
      const blockedList = document.getElementById('blocked-list');
      try {
        const res = await window.API.get('/api/moderation/blocks');
        if (!res.blocked || res.blocked.length === 0) {
          blockedList.innerHTML = `<p class="muted" data-i18n="profile.blocked_empty">${window.UI.escape(window.I18n.t('profile.blocked_empty'))}</p>`;
          return;
        }
        blockedList.innerHTML = res.blocked
          .map(
            (b) => `<div class="member-row" style="justify-content:space-between;">
              <div>
                <strong>${window.UI.escape(b.display_name || '')}</strong>
                <span class="muted" style="display:block;font-size:14px;">${window.UI.escape(b.city || '')}</span>
              </div>
              <button type="button" class="btn btn-quiet unblock-btn" data-user-id="${b.id}" style="width:auto;padding:8px 16px;font-size:var(--font-sm);">${window.UI.escape(window.I18n.t('profile.unblock'))}</button>
            </div>`
          )
          .join('');
        blockedList.querySelectorAll('.unblock-btn').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const id = Number(btn.getAttribute('data-user-id'));
            try {
              await window.API.del(`/api/moderation/blocks/${id}`);
              loadBlocked();
            } catch (e) {
              window.UI.showAlert('#alert', 'error', e.userMessage);
            }
          });
        });
      } catch (e) {
        // Tyst fail — ej kritiskt
      }
    }
    loadBlocked();

    // Delete account (GDPR)
    document.getElementById('delete-btn').addEventListener('click', async () => {
      const msg = window.I18n.t('profile.delete_confirm');
      const ok = await window.UI.confirmDialog({ message: msg, destructive: true });
      if (!ok) return;
      try {
        await window.API.del('/api/users/me');
        window.Auth.clearCache();
        localStorage.clear();
        window.location.href = '/';
      } catch (e) {
        window.UI.showAlert('#alert', 'error', e.userMessage);
      }
    });
  }

  async function renderOther(id) {
    window.UI.renderBottomNav(null);
    try {
      const res = await window.API.get(`/api/users/${id}`);
      const u = res.user;
      const interestsHtml = (u.interests || [])
        .map((i) => `<span class="pill">${window.UI.escape(i)}</span>`)
        .join('');
      content.innerHTML = `
        <div class="profile-header">
          ${window.UI.avatar(u.display_name, 'lg', u.avatarUrl)}
          <div class="profile-info">
            <h1>${window.UI.escape(u.display_name || '')}</h1>
            <p>${window.UI.escape(u.city || '')}</p>
          </div>
        </div>
        ${u.bio ? `<div class="card"><p>${window.UI.escape(u.bio)}</p></div>` : ''}
        ${interestsHtml ? `<div class="card"><div class="section-header" style="margin-bottom:12px;"><span class="section-icon" aria-hidden="true">&#127775;</span><h2 style="margin:0;" data-i18n="onboarding.interests_label"></h2></div><div class="pill-row">${interestsHtml}</div></div>` : ''}
        <div class="btn-row">
          <a class="btn" href="/messages.html?with=${u.id}">&#128172; ${window.UI.escape(window.I18n.t('messages.send'))}</a>
        </div>`;
      window.I18n.applyTranslations(content);
    } catch (e) {
      window.UI.showAlert('#alert', 'error', e.userMessage);
    }
  }

  (async () => {
    const me = await window.Auth.requireOnboardedUser();
    if (!me) return;
    if (viewId && viewId !== me.id) renderOther(viewId);
    else renderOwn(me);
  })();
})();
