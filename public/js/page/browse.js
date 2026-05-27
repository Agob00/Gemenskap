(function () {
  window.UI.renderHeader({ loggedIn: true });
  window.UI.renderBottomNav('community');

  const list = document.getElementById('communities-list');
  const searchInput = document.getElementById('filter-search');
  const cityInput = document.getElementById('filter-city');
  const interestInput = document.getElementById('filter-interest');
  const nearToggle = document.getElementById('filter-near');
  const availableToggle = document.getElementById('filter-available');
  const clearBtn = document.getElementById('filter-clear');
  const countEl = document.getElementById('filter-result-count');

  let me = null;
  let allCommunities = [];

  // ── Geografisk distans (samma tabell som server/ml.js) ─────
  const CITY_COORDS = {
    'stockholm':   [59.3293, 18.0686],
    'göteborg':    [57.7089, 11.9746],
    'malmö':       [55.6050, 13.0038],
    'uppsala':     [59.8586, 17.6389],
    'västerås':    [59.6099, 16.5448],
    'örebro':      [59.2753, 15.2134],
    'linköping':   [58.4108, 15.6214],
    'helsingborg': [56.0465, 12.6945],
    'norrköping':  [58.5877, 16.1924],
    'lund':        [55.7047, 13.1910],
    'umeå':        [63.8258, 20.2630],
    'jönköping':   [57.7826, 14.1618],
    'borås':       [57.7210, 12.9401],
    'sundsvall':   [62.3908, 17.3069],
    'gävle':       [60.6749, 17.1413],
    'karlstad':    [59.3793, 13.5036],
    'växjö':       [56.8777, 14.8091],
    'halmstad':    [56.6745, 12.8578],
    'kristianstad':[56.0294, 14.1567],
    'eskilstuna':  [59.3666, 16.5077],
    'kalmar':      [56.6634, 16.3567],
    'falun':       [60.6065, 15.6355],
    'trollhättan': [58.2837, 12.2886],
    'östersund':   [63.1766, 14.6361],
  };

  function distanceKm(cityA, cityB) {
    if (!cityA || !cityB) return Infinity;
    const a = CITY_COORDS[cityA.toLowerCase()];
    const b = CITY_COORDS[cityB.toLowerCase()];
    if (!a || !b) return Infinity;
    const [la1, lo1] = a;
    const [la2, lo2] = b;
    const R = 6371;
    const dLa = (la2 - la1) * Math.PI / 180;
    const dLo = (lo2 - lo1) * Math.PI / 180;
    const x = Math.sin(dLa / 2) ** 2
      + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180)
      * Math.sin(dLo / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  // ── Bygg ifyllbara dropdowns från befintlig data ─────────────────
  function populateDropdowns() {
    const cities = [...new Set(allCommunities.map((c) => c.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'sv'));
    const interests = [...new Set(allCommunities.flatMap((c) => c.interests || []))].sort((a, b) => a.localeCompare(b, 'sv'));

    // Behåll "Alla städer"-alternativet (första <option>)
    const cityFirst = cityInput.firstElementChild;
    cityInput.innerHTML = '';
    cityInput.appendChild(cityFirst);
    cities.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      cityInput.appendChild(opt);
    });

    const interestFirst = interestInput.firstElementChild;
    interestInput.innerHTML = '';
    interestInput.appendChild(interestFirst);
    interests.forEach((i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      interestInput.appendChild(opt);
    });
  }

  // ── Filtrera + rendera ────────────────────────────────────────────
  function applyFilters() {
    const q = (searchInput.value || '').trim().toLowerCase();
    const city = cityInput.value;
    const interest = interestInput.value;
    const nearOnly = nearToggle.checked;
    const availableOnly = availableToggle.checked;
    const myCity = me && me.city;
    const myIds = new Set((me.memberships || []).map((m) => m.id));

    const filtered = allCommunities.filter((c) => {
      if (q) {
        const hay = (c.name + ' ' + (c.description || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (city && c.city !== city) return false;
      if (interest && !(c.interests || []).includes(interest)) return false;
      if (availableOnly && c.memberCount >= c.maxMembers) return false;
      if (nearOnly) {
        if (!myCity) return false;
        if (distanceKm(myCity, c.city) > 80) return false;
      }
      return true;
    });

    renderList(filtered, myIds);
    countEl.textContent = window.I18n.t('browse.filter_count', { n: filtered.length, total: allCommunities.length });
  }

  function renderList(items, myIds) {
    if (items.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <span class="empty-state-icon">&#128269;</span>
        <p class="empty-state-text">${window.UI.escape(window.I18n.t('browse.filter_no_match'))}</p>
      </div>`;
      return;
    }
    list.innerHTML = items
      .map((c) => {
        const isMember = myIds.has(c.id);
        const isFull = c.memberCount >= c.maxMembers;
        const pills = (c.interests || [])
          .map((i) => `<span class="pill">${window.UI.escape(i)}</span>`)
          .join('');
        let actionBtn = '';
        if (isMember) {
          actionBtn = `<a href="/community.html?id=${c.id}" class="btn btn-secondary">${window.UI.escape(window.I18n.t('browse.go_to'))}</a>`;
        } else if (isFull) {
          actionBtn = `<button class="btn btn-quiet" disabled>${window.UI.escape(window.I18n.t('browse.full'))}</button>`;
        } else {
          actionBtn = `<button class="btn" data-join="${c.id}">${window.UI.escape(window.I18n.t('browse.join'))}</button>`;
        }
        return `
          <div class="card">
            <a href="/community.html?id=${c.id}" style="text-decoration:none;color:inherit;"><h3>${window.UI.escape(c.name)}</h3></a>
            <p class="muted">${window.UI.escape(c.city)} · ${window.I18n.t('onboarding.members', { n: c.memberCount, max: c.maxMembers })}</p>
            <p>${window.UI.escape(c.description || '')}</p>
            ${pills ? `<div class="pill-row" style="margin-bottom:12px;">${pills}</div>` : ''}
            ${isMember ? `<p style="color:var(--color-success);font-weight:600;">✓ ${window.UI.escape(window.I18n.t('browse.already_member'))}</p>` : ''}
            <div class="btn-row">${actionBtn}</div>
          </div>`;
      })
      .join('');

    list.querySelectorAll('[data-join]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await window.API.post(`/api/communities/${btn.getAttribute('data-join')}/join`);
          window.Auth.clearCache();
          load();
        } catch (e) {
          window.UI.showAlert('#alert', 'error', e.userMessage);
          btn.disabled = false;
        }
      });
    });
  }

  // ── Debounce för sökfältet — vi vill inte filtera på varje tangenttryck ──
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 150);
  });
  cityInput.addEventListener('change', applyFilters);
  interestInput.addEventListener('change', applyFilters);
  nearToggle.addEventListener('change', applyFilters);
  availableToggle.addEventListener('change', applyFilters);

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    cityInput.value = '';
    interestInput.value = '';
    nearToggle.checked = false;
    availableToggle.checked = false;
    applyFilters();
    searchInput.focus();
  });

  async function load() {
    me = await window.Auth.requireOnboardedUser();
    if (!me) return;

    try {
      const res = await window.API.get('/api/communities');
      allCommunities = res.communities || [];
      if (allCommunities.length === 0) {
        list.innerHTML = `<p class="muted">Inga communities finns ännu.</p>`;
        countEl.textContent = '';
        return;
      }
      populateDropdowns();
      window.I18n.applyTranslations(document.getElementById('filter-card'));
      applyFilters();
    } catch (e) {
      window.UI.showAlert('#alert', 'error', e.userMessage);
    }
  }

  load();
  document.addEventListener('langchange', load);
})();
