/**
 * Per-användar-localStorage med automatisk prefixering.
 *
 * Problem: standard localStorage delas mellan alla användare på samma
 * enhet. Om mormor och hennes barnbarn delar surfplatta kommer den ena
 * användarens "current_community_id", "tutorial_done"-flagga och "tip_seen_*"
 * att läcka in i den andras session.
 *
 * Lösning: vi sätter alla användarspecifika nycklar med prefixet
 * `u<userId>:`. Vid logout rensas hela prefixet.
 *
 * Globala inställningar som GÄLLER ENHETEN (språk, textstorlek) sparas
 * fortfarande utan prefix — de är OK att dela.
 */
(function () {
  let currentUserId = null;

  function setUserId(id) {
    currentUserId = id != null ? Number(id) : null;
  }

  function prefix() {
    return currentUserId != null ? `u${currentUserId}:` : 'anon:';
  }

  function get(key) {
    return localStorage.getItem(prefix() + key);
  }

  function set(key, value) {
    localStorage.setItem(prefix() + key, value);
  }

  function remove(key) {
    localStorage.removeItem(prefix() + key);
  }

  /**
   * Rensa allt för nuvarande användare. Anropas vid logout.
   * Behåller globala inställningar som `lang` och `font_size`.
   */
  function clearAll() {
    const p = prefix();
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(p)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  }

  /**
   * Migrera legacy-nycklar (utan prefix) till denna användares prefix.
   * Anropas en gång vid första `setUserId` om legacy-nyckel finns.
   * Säkerställer att en användare som varit inloggad förut inte får
   * tutorial:en på nytt bara för att vi byter format.
   */
  function migrateLegacy(legacyKey, newKey) {
    const v = localStorage.getItem(legacyKey);
    if (v != null && get(newKey || legacyKey) == null) {
      set(newKey || legacyKey, v);
    }
    // Lämna legacy-nyckeln kvar för att inte bryta andra (gamla) klient-sessioner.
  }

  window.UserStorage = { setUserId, get, set, remove, clearAll, migrateLegacy };
})();
