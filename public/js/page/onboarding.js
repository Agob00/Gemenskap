(function () {
  window.UI.renderHeader({ loggedIn: true });

  // Predefined interests come from window.Interests (loaded via /js/interests.js)
  const INTERESTS = window.Interests.all();

  // Known Swedish cities with coordinates for reverse-geocoding fallback
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
    { name: 'Borås',       lat: 57.7210, lon: 12.9401 },
    { name: 'Sundsvall',   lat: 62.3908, lon: 17.3069 },
    { name: 'Gävle',       lat: 60.6749, lon: 17.1413 },
    { name: 'Karlstad',    lat: 59.3793, lon: 13.5036 },
    { name: 'Växjö',       lat: 56.8777, lon: 14.8091 },
    { name: 'Halmstad',    lat: 56.6745, lon: 12.8578 },
    { name: 'Kristianstad',lat: 56.0294, lon: 14.1567 },
    { name: 'Eskilstuna',  lat: 59.3666, lon: 16.5077 },
    { name: 'Luleå',       lat: 65.5848, lon: 22.1547 },
    { name: 'Trollhättan', lat: 58.2837, lon: 12.2886 },
    { name: 'Östersund',   lat: 63.1766, lon: 14.6361 },
    { name: 'Kalmar',      lat: 56.6634, lon: 16.3567 },
    { name: 'Falun',       lat: 60.6065, lon: 15.6355 },
    { name: 'Skellefteå',  lat: 64.7507, lon: 20.9528 },
    { name: 'Karlskrona',  lat: 56.1612, lon: 15.5869 },
    { name: 'Visby',       lat: 57.6348, lon: 18.2948 },
    { name: 'Nyköping',    lat: 58.7530, lon: 17.0086 },
    { name: 'Uddevalla',   lat: 58.3493, lon: 11.9383 },
  ];

  const profileStep = document.getElementById('profile-step');
  const assigningStep = document.getElementById('assigning-step');
  const noMatchStep = document.getElementById('no-match-step');
  const nameInput = document.getElementById('name');
  const cityInput = document.getElementById('city');
  const interestsContainer = document.getElementById('interests');
  const saveBtn = document.getElementById('save-profile-btn');
  const backToInterestsBtn = document.getElementById('back-to-interests-btn');
  const locateBtn = document.getElementById('locate-btn');
  const locationStatus = document.getElementById('location-status');

  const selected = new Set();

  // ── Render predefined interest chips (grouped by category) ───────
  function renderInterests() {
    window.Interests.render(interestsContainer, selected);
  }

  // ── Geolocation ───────────────────────────────────────────────────
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
    return { city: best ? best.name : null, distance: bestDist };
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
    } catch (_) {
      // Nominatim failed, fall back to local calculation
    }
    const { city } = findNearestCity(lat, lon);
    return city;
  }

  locateBtn.addEventListener('click', async () => {
    if (!navigator.geolocation) {
      showLocationStatus('error', window.I18n.t('onboarding.location_failed'));
      return;
    }

    locateBtn.disabled = true;
    locateBtn.classList.add('locating');
    const btnTextEl = locateBtn.querySelector('[data-i18n]');
    if (btnTextEl) btnTextEl.textContent = window.I18n.t('onboarding.detecting_location');

    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 300000,
        });
      });

      const { latitude, longitude } = pos.coords;
      const cityName = await reverseGeocode(latitude, longitude);

      if (cityName) {
        cityInput.value = cityName;
        showLocationStatus('success', window.I18n.t('onboarding.location_found', { city: cityName }));
      } else {
        showLocationStatus('error', window.I18n.t('onboarding.location_failed'));
      }
    } catch (err) {
      if (err.code === 1) {
        showLocationStatus('error', window.I18n.t('onboarding.location_denied'));
      } else {
        showLocationStatus('error', window.I18n.t('onboarding.location_failed'));
      }
    } finally {
      locateBtn.disabled = false;
      locateBtn.classList.remove('locating');
      if (btnTextEl) btnTextEl.textContent = window.I18n.t('onboarding.detect_location');
    }
  });

  function showLocationStatus(type, message) {
    locationStatus.hidden = false;
    locationStatus.textContent = message;
    locationStatus.style.color = type === 'success' ? 'var(--color-success)' : 'var(--color-error)';
    locationStatus.style.fontWeight = '600';
    setTimeout(() => { locationStatus.hidden = true; }, 6000);
  }

  // ── Save profile + auto-assign ─────────────────────────────────────
  async function saveProfile() {
    window.UI.clearAlert('#alert');
    const display_name = nameInput.value.trim();
    const city = cityInput.value.trim();

    // Filtrera till bara fördefinierade intressen — egna kan inte skrivas in
    const allInterests = [...selected].filter((i) => INTERESTS.includes(i));

    if (!display_name || !city || allInterests.length === 0) {
      window.UI.showAlert(
        '#alert',
        'error',
        window.I18n.getLang() === 'sv'
          ? 'Fyll i namn, stad och välj minst ett intresse så hittar vi en grupp åt dig.'
          : 'Please fill in name, city and pick at least one interest so we can find a group for you.'
      );
      return;
    }
    saveBtn.disabled = true;
    try {
      await window.API.put('/api/users/me', {
        display_name,
        city,
        interests: allInterests,
        language: window.I18n.getLang(),
      });
      window.Auth.clearCache();

      // Visa "hittar en grupp" + kör auto-assign
      profileStep.hidden = true;
      assigningStep.hidden = false;
      await autoAssign();
    } catch (e) {
      window.UI.showAlert('#alert', 'error', e.userMessage);
      saveBtn.disabled = false;
    }
  }

  // ── Auto-assign-anrop ──────────────────────────────────────────────
  async function autoAssign() {
    try {
      const res = await window.API.post('/api/communities/auto-assign');
      if (res.community && res.community.id) {
        if (window.UserStorage) window.UserStorage.remove('tutorial_done');
        window.location.href = `/community.html?id=${res.community.id}`;
        return;
      }
      // Ingen passande grupp — visa fallback
      assigningStep.hidden = true;
      noMatchStep.hidden = false;
      if (res.message_sv || res.message_en) {
        const lang = window.I18n.getLang();
        const msg = lang === 'en' ? (res.message_en || res.message_sv) : (res.message_sv || res.message_en);
        window.UI.showAlert('#alert', 'info', msg);
      }
    } catch (e) {
      assigningStep.hidden = true;
      profileStep.hidden = false;
      saveBtn.disabled = false;
      window.UI.showAlert('#alert', 'error', e.userMessage);
    }
  }

  function backToInterests() {
    noMatchStep.hidden = true;
    profileStep.hidden = false;
    saveBtn.disabled = false;
    window.UI.clearAlert('#alert');
  }

  saveBtn.addEventListener('click', saveProfile);
  if (backToInterestsBtn) backToInterestsBtn.addEventListener('click', backToInterests);

  // ── Init ──────────────────────────────────────────────────────────
  (async () => {
    const u = await window.Auth.requireUser();
    if (!u) return;
    if (u.display_name) nameInput.value = u.display_name;
    if (u.city) cityInput.value = u.city;
    if (u.interests) {
      for (const i of u.interests) {
        if (INTERESTS.includes(i)) selected.add(i);
        // Eventuella legacy "custom" intressen ignoreras tyst
      }
    }
    renderInterests();
    // Om användaren redan har en grupp — gå direkt dit
    if (u.memberships && u.memberships.length > 0 && u.display_name && u.city) {
      window.location.href = `/community.html?id=${u.memberships[0].id}`;
    }
  })();
})();
