/**
 * Kontextuella ledtrådar (inline-tips).
 *
 * Designprincip: istället för en modal-tutorial som visas vid första besöket
 * och vanligen ignoreras (forskningen är tydlig), visar vi små tips i
 * sammanhang — t.ex. när användaren ser sitt första event eller sitt första
 * inlägg. Tipset visas EN gång per tips-nyckel och försvinner efter att
 * användaren klickat "Förstått".
 *
 * Persistas i localStorage som `tip_seen_<key>`.
 *
 * Användning:
 *   window.Tips.show({
 *     key: 'first_event',         // unik nyckel
 *     anchor: domElement,         // element att rendera tipset i (eller före)
 *     message: 'Tryck OSA för…',  // texten
 *     placement: 'before' | 'inside' | 'after'  // default: 'before'
 *   });
 *
 *   window.Tips.has('first_event') // true om redan visat
 *   window.Tips.reset()            // glöm alla tips (för testning / replay)
 */
(function () {
  const PREFIX = 'tip_seen_';

  function has(key) {
    return localStorage.getItem(PREFIX + key) === '1';
  }

  function markSeen(key) {
    localStorage.setItem(PREFIX + key, '1');
  }

  function show(opts) {
    if (!opts || !opts.key || !opts.anchor || !opts.message) return;
    if (has(opts.key)) return;
    if (document.querySelector('[data-tip-key="' + opts.key + '"]')) return;

    const closeLabel = (window.I18n && typeof window.I18n.t === 'function')
      ? window.I18n.t('tips.close_label')
      : 'Stäng tips';
    const wrap = document.createElement('div');
    wrap.className = 'inline-tip';
    wrap.setAttribute('data-tip-key', opts.key);
    wrap.setAttribute('role', 'status');
    wrap.innerHTML = `
      <span class="inline-tip-icon" aria-hidden="true">&#128161;</span>
      <p class="inline-tip-text"></p>
      <button type="button" class="inline-tip-close" aria-label=""></button>
    `;
    wrap.querySelector('.inline-tip-text').textContent = opts.message;
    const closeBtn = wrap.querySelector('.inline-tip-close');
    closeBtn.setAttribute('aria-label', closeLabel);
    closeBtn.innerHTML = '&times;';

    const placement = opts.placement || 'before';
    if (placement === 'inside') {
      opts.anchor.insertAdjacentElement('afterbegin', wrap);
    } else if (placement === 'after') {
      opts.anchor.insertAdjacentElement('afterend', wrap);
    } else {
      opts.anchor.insertAdjacentElement('beforebegin', wrap);
    }

    wrap.querySelector('.inline-tip-close').addEventListener('click', () => {
      markSeen(opts.key);
      wrap.remove();
    });
  }

  function reset() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  }

  window.Tips = { show, has, markSeen, reset };
})();
