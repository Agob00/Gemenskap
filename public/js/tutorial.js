(function () {
  const STEPS = [
    { titleKey: 'tutorial.step1.title', bodyKey: 'tutorial.step1.body', icon: '&#127968;' },
    { titleKey: 'tutorial.step2.title', bodyKey: 'tutorial.step2.body', icon: '&#128101;' },
    { titleKey: 'tutorial.step3.title', bodyKey: 'tutorial.step3.body', icon: '&#128172;' },
    { titleKey: 'tutorial.step4.title', bodyKey: 'tutorial.step4.body', icon: '&#128197;' },
  ];

  function show(opts) {
    if (document.getElementById('tutorial-overlay')) return;
    let idx = 0;
    const t = window.I18n.t;
    const overlay = document.createElement('div');
    overlay.id = 'tutorial-overlay';
    overlay.className = 'tutorial-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="tutorial-card">
        <span class="tutorial-icon" id="tut-icon" aria-hidden="true"></span>
        <h2 id="tut-title"></h2>
        <p id="tut-body" style="font-size:var(--font-sm);line-height:1.6;"></p>
        <div class="tutorial-progress" id="tut-progress"></div>
        <button id="tut-next" class="btn"></button>
        <button id="tut-skip" class="btn-text-link"></button>
      </div>
    `;
    document.body.appendChild(overlay);

    const titleEl = overlay.querySelector('#tut-title');
    const bodyEl = overlay.querySelector('#tut-body');
    const iconEl = overlay.querySelector('#tut-icon');
    const progressEl = overlay.querySelector('#tut-progress');
    const nextBtn = overlay.querySelector('#tut-next');
    const skipBtn = overlay.querySelector('#tut-skip');

    function close() {
      overlay.remove();
      if (window.UserStorage) window.UserStorage.set('tutorial_done', '1');
      else localStorage.setItem('tutorial_done', '1');
      if (opts && typeof opts.onClose === 'function') opts.onClose();
    }

    function render() {
      const s = STEPS[idx];
      titleEl.textContent = t(s.titleKey);
      bodyEl.textContent = t(s.bodyKey);
      iconEl.innerHTML = s.icon;
      progressEl.innerHTML = STEPS.map((_, i) => `<span class="${i === idx ? 'active' : ''}"></span>`).join('');
      nextBtn.textContent = idx === STEPS.length - 1 ? t('tutorial.done') : t('tutorial.next');
      skipBtn.textContent = t('tutorial.skip');
      skipBtn.hidden = idx === STEPS.length - 1;
    }

    nextBtn.addEventListener('click', () => {
      if (idx < STEPS.length - 1) {
        idx += 1;
        render();
      } else {
        close();
      }
    });

    skipBtn.addEventListener('click', close);

    render();
    nextBtn.focus();
  }

  function maybeShowOnFirstVisit() {
    const done = (window.UserStorage ? window.UserStorage.get('tutorial_done') : localStorage.getItem('tutorial_done'));
    if (done !== '1') show();
  }

  function reset() {
    if (window.UserStorage) window.UserStorage.remove('tutorial_done');
    localStorage.removeItem('tutorial_done');
  }

  window.Tutorial = { show, maybeShowOnFirstVisit, reset };
})();
