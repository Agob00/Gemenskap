/**
 * Categorized interests — shared between onboarding and profile.
 *
 * Designed for elderly users: simple, visual groups with emoji icons.
 * Categories are always visible (no accordions) so nothing is hidden behind taps.
 *
 * The flat list (window.Interests.all()) is exposed for code that needs
 * to know "is this a predefined interest?".
 */
(function () {
  const CATEGORIES = [
    {
      key: 'outdoor',
      icon: '\u{1F333}', // 🌳
      labelKey: 'interests.cat_outdoor',
      interests: ['Promenader', 'Trädgård', 'Resor', 'Vandring', 'Cykling', 'Fågelskådning'],
    },
    {
      key: 'sport',
      icon: '\u{265F}\u{FE0F}', // ♟️
      labelKey: 'interests.cat_sport',
      interests: ['Schack', 'Bridge', 'Kortspel', 'Korsord', 'Boule', 'Golf', 'Pingis'],
    },
    {
      key: 'create',
      icon: '\u{1F3A8}', // 🎨
      labelKey: 'interests.cat_create',
      interests: ['Hantverk', 'Stickning', 'Måleri', 'Konst', 'Foto', 'Musik', 'Sång', 'Dans'],
    },
    {
      key: 'culture',
      icon: '\u{1F4DA}', // 📚
      labelKey: 'interests.cat_culture',
      interests: ['Bokläsning', 'Filmklubb', 'Teater', 'Museum', 'Historia'],
    },
    {
      key: 'food',
      icon: '☕', // ☕
      labelKey: 'interests.cat_food',
      interests: ['Matlagning', 'Bakning', 'Fika', 'Vinprovning'],
    },
    {
      key: 'health',
      icon: '\u{1F9D8}', // 🧘
      labelKey: 'interests.cat_health',
      interests: ['Yoga', 'Pilates', 'Meditation', 'Simning'],
    },
  ];

  // Flat list of all predefined interests
  function all() {
    const result = [];
    for (const cat of CATEGORIES) result.push(...cat.interests);
    return result;
  }

  // Find which category an interest belongs to (or null if custom)
  function categoryOf(interest) {
    for (const cat of CATEGORIES) {
      if (cat.interests.includes(interest)) return cat.key;
    }
    return null;
  }

  /**
   * Render a categorized chip selector into a container element.
   *
   * @param {HTMLElement} container — target element (will be replaced)
   * @param {Set<string>} selected — set of currently-selected interest names
   * @param {Function} onChange — callback({interest, selected, set}) on toggle
   */
  function render(container, selected, onChange) {
    const escape = window.UI.escape;
    const t = window.I18n.t;
    container.innerHTML = CATEGORIES.map((cat) => `
      <div class="interest-category" data-cat="${cat.key}">
        <div class="interest-category-header">
          <span class="interest-category-icon" aria-hidden="true">${cat.icon}</span>
          <h3 class="interest-category-title">${escape(t(cat.labelKey))}</h3>
        </div>
        <div class="chip-grid">
          ${cat.interests.map((i) => `
            <button type="button" class="chip" data-interest="${escape(i)}" aria-pressed="${selected.has(i)}">${escape(i)}</button>
          `).join('')}
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const v = chip.getAttribute('data-interest');
        if (selected.has(v)) selected.delete(v); else selected.add(v);
        chip.setAttribute('aria-pressed', selected.has(v));
        if (typeof onChange === 'function') onChange({ interest: v, selected: selected.has(v), set: selected });
      });
    });
  }

  window.Interests = { CATEGORIES, all, categoryOf, render };
})();
