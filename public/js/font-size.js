/**
 * User-controlled text size — A-/A/A+/A++.
 *
 * Sätter en klass på <html> som styr CSS-variablerna --font-base m.fl.
 * Persistas i localStorage. Initieras tidigt så det inte blinkar.
 *
 * Designat för äldre med t.ex. makuladegeneration som behöver 28px-text.
 * Webbläsarens zoom är osynlig — denna är synlig i sidhuvudet.
 */
(function () {
  const KEY = 'font_size';
  const SIZES = ['small', 'medium', 'large', 'xlarge'];
  const DEFAULT = 'medium';

  function get() {
    const v = localStorage.getItem(KEY);
    return SIZES.includes(v) ? v : DEFAULT;
  }

  function apply(size) {
    const html = document.documentElement;
    SIZES.forEach((s) => html.classList.remove('font-size-' + s));
    if (size && size !== DEFAULT) {
      html.classList.add('font-size-' + size);
    }
  }

  function set(size) {
    if (!SIZES.includes(size)) return;
    localStorage.setItem(KEY, size);
    apply(size);
    // Underrätta lyssnare (t.ex. uppdatera knappars aria-pressed)
    document.dispatchEvent(new CustomEvent('fontsizechange', { detail: { size } }));
  }

  // Tillämpa direkt vid skript-laddning så inga blinkningar uppstår.
  apply(get());

  window.FontSize = { get, set, apply, SIZES };
})();
