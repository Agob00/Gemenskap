(function () {
  let cachedUser = undefined;

  async function getCurrentUser() {
    if (cachedUser !== undefined) return cachedUser;
    try {
      const res = await window.API.get('/api/auth/me');
      cachedUser = res.user || null;
    } catch (e) {
      cachedUser = null;
    }
    // Sätt UserStorage-prefix så per-användar-keys inte läcker mellan
    // användare som delar samma enhet. Migrera legacy-nycklar en gång.
    if (window.UserStorage) {
      window.UserStorage.setUserId(cachedUser ? cachedUser.id : null);
      if (cachedUser) {
        window.UserStorage.migrateLegacy('tutorial_done');
        window.UserStorage.migrateLegacy('current_community_id');
      }
    }
    return cachedUser;
  }

  function clearCache() {
    cachedUser = undefined;
  }

  async function requireUser() {
    const u = await getCurrentUser();
    if (!u) {
      window.location.href = '/login.html';
      return null;
    }
    return u;
  }

  async function requireOnboardedUser() {
    const u = await requireUser();
    if (!u) return null;
    if (!u.display_name || !u.city) {
      window.location.href = '/onboarding.html';
      return null;
    }
    return u;
  }

  async function logout() {
    try { await window.API.post('/api/auth/logout'); }
    catch (e) { console.warn('[auth] logout request failed:', e); }
    clearCache();
    // Rensa per-användar-localStorage. tutorial_done är legacy från före
    // användarprefix — tas bort för bakåtkompatibilitet.
    localStorage.removeItem('tutorial_done');
    if (window.UserStorage) window.UserStorage.clearAll();
    window.location.href = '/';
  }

  window.Auth = { getCurrentUser, requireUser, requireOnboardedUser, logout, clearCache };
})();
