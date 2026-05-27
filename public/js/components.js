(function () {
  function escape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function initials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function renderHeader({ showLangSwitch = true, loggedIn = false } = {}) {
    const t = window.I18n.t;
    const langButtons = showLangSwitch
      ? `<div class="lang-switch" role="group" aria-label="Language">
           <button type="button" data-lang="sv" aria-pressed="${window.I18n.getLang() === 'sv'}">SV</button>
           <button type="button" data-lang="en" aria-pressed="${window.I18n.getLang() === 'en'}">EN</button>
         </div>`
      : '';
    const currentFontSize = window.FontSize ? window.FontSize.get() : 'medium';
    const fontButtons = window.FontSize
      ? `<div class="font-size-switch" role="group" aria-label="${escape(t('common.text_size') || 'Text size')}">
           <button type="button" data-size="small"  aria-pressed="${currentFontSize === 'small'}"  aria-label="${escape(t('common.text_smaller') || 'Smaller')}" title="${escape(t('common.text_smaller') || 'Smaller')}">A</button>
           <button type="button" data-size="medium" aria-pressed="${currentFontSize === 'medium'}" aria-label="${escape(t('common.text_normal') || 'Normal')}" title="${escape(t('common.text_normal') || 'Normal')}">A</button>
           <button type="button" data-size="large"  aria-pressed="${currentFontSize === 'large'}"  aria-label="${escape(t('common.text_larger') || 'Larger')}" title="${escape(t('common.text_larger') || 'Larger')}">A</button>
           <button type="button" data-size="xlarge" aria-pressed="${currentFontSize === 'xlarge'}" aria-label="${escape(t('common.text_largest') || 'Largest')}" title="${escape(t('common.text_largest') || 'Largest')}">A</button>
         </div>`
      : '';
    const profileLink = loggedIn
      ? `<a href="/profile.html" class="header-profile-link">&#128100; ${escape(t('common.profile'))}</a>`
      : '';
    const html = `
      <header class="app-header">
        <div class="app-header-inner">
          <a class="brand" href="${loggedIn ? '/home.html' : '/'}">&#127793; ${escape(t('app.brand'))}</a>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            ${profileLink}
            ${fontButtons}
            ${langButtons}
          </div>
        </div>
      </header>
    `;
    document.body.insertAdjacentHTML('afterbegin', html);
    document.querySelectorAll('.lang-switch button').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.I18n.setLang(btn.getAttribute('data-lang'));
        document.querySelectorAll('.lang-switch button').forEach((b) =>
          b.setAttribute('aria-pressed', b.getAttribute('data-lang') === window.I18n.getLang())
        );
      });
    });
    document.querySelectorAll('.font-size-switch button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const size = btn.getAttribute('data-size');
        if (window.FontSize) window.FontSize.set(size);
        document.querySelectorAll('.font-size-switch button').forEach((b) =>
          b.setAttribute('aria-pressed', b.getAttribute('data-size') === size)
        );
      });
    });
  }

  function renderBottomNav(active) {
    const t = window.I18n.t;
    const items = [
      { key: 'home',      href: '/home.html',      label: 'nav.home',      icon: '&#127968;' },
      { key: 'community', href: '/community.html',  label: 'nav.community', icon: '&#128101;' },
      { key: 'messages',  href: '/messages.html',   label: 'nav.messages',  icon: '&#128172;' },
    ];
    const html = `
      <nav class="app-nav" aria-label="Main">
        ${items
          .map(
            (it) => `
          <a href="${it.href}" ${active === it.key ? 'aria-current="page"' : ''}>
            <span class="nav-icon" aria-hidden="true">${it.icon}</span>
            <span class="nav-label">${escape(t(it.label))}</span>
            ${active === it.key ? `<span class="nav-here">${escape(t('nav.you_are_here'))}</span>` : ''}
          </a>`
          )
          .join('')}
      </nav>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function showAlert(container, type, text) {
    const icons = { error: '!', success: '✓', info: 'i' };
    // role="alert" implicerar aria-live="assertive" (avbryter pågående
    // skärmläsare). role="status" implicerar aria-live="polite" (väntar
    // tills läsaren är ledig). Vi ger båda explicit för att äldre
    // skärmläsare ska få samma beteende.
    const isError = type === 'error';
    const role = isError ? 'alert' : 'status';
    const live = isError ? 'assertive' : 'polite';
    const html = `<div class="alert alert-${type}" role="${role}" aria-live="${live}"><span class="alert-icon" aria-hidden="true">${icons[type] || 'i'}</span><div>${escape(text)}</div></div>`;
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) return;
    container.innerHTML = html;
  }

  function clearAlert(container) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (container) container.innerHTML = '';
  }

  function avatar(name, size, avatarUrl) {
    const cls = size === 'lg' ? 'avatar avatar-lg' : 'avatar';
    // Skärmläsare läser bilden — ge den ett vettigt alt-namn istället
    // för tomt. Fallback till "Profilbild" för anonyma fall.
    const altText = (name && String(name).trim()) || 'Profilbild';
    if (avatarUrl) {
      const imgSize = size === 'lg' ? '90' : '52';
      return `<img class="${cls}" src="${escape(avatarUrl)}" alt="${escape(altText)}" style="object-fit:cover;width:${imgSize}px;height:${imgSize}px;border-radius:50%;">`;
    }
    // Initialerna är dekorativa när texten redan står bredvid; men i
    // fall där den inte gör det vill vi att skärmläsare läser namnet.
    // Lösning: ge wrappen role="img" + aria-label.
    return `<span class="${cls}" role="img" aria-label="${escape(altText)}">${escape(initials(name))}</span>`;
  }

  // Tillgänglig confirm-dialog som ersättning för native confirm().
  // - role="alertdialog" + aria-labelledby/aria-describedby = skärmläsare
  //   annonserar texten korrekt
  // - Fokus flyttas till "Avbryt" som default (mindre risk för
  //   oavsiktlig destruktiv handling)
  // - Tab-fälla: fokus stannar inom dialogen
  // - Escape stänger som "avbryt"
  // - Backdrop-klick stänger som "avbryt"
  // Returnerar en Promise<boolean>: true = ok, false = avbryt.
  function confirmDialog(opts) {
    const message = (opts && opts.message) || '';
    const t = (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t : null;
    const okText = (opts && opts.okText)
      || (t && t('common.confirm_ok'))
      || 'OK';
    const cancelText = (opts && opts.cancelText)
      || (t && t('common.confirm_cancel'))
      || 'Avbryt';
    const destructive = !!(opts && opts.destructive);

    return new Promise((resolve) => {
      const previouslyFocused = document.activeElement;
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `
        <div class="modal-dialog" role="alertdialog" aria-modal="true"
             aria-labelledby="modal-title" aria-describedby="modal-body">
          <h2 id="modal-title" class="sr-only"></h2>
          <p id="modal-body" class="modal-body"></p>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-action="cancel"></button>
            <button type="button" class="btn ${destructive ? 'btn-danger' : ''}" data-action="ok"></button>
          </div>
        </div>`;
      const dialog = backdrop.querySelector('.modal-dialog');
      backdrop.querySelector('#modal-title').textContent = okText;
      backdrop.querySelector('#modal-body').textContent = message;
      const okBtn = backdrop.querySelector('[data-action="ok"]');
      const cancelBtn = backdrop.querySelector('[data-action="cancel"]');
      okBtn.textContent = okText;
      cancelBtn.textContent = cancelText;

      function close(result) {
        document.removeEventListener('keydown', onKey, true);
        backdrop.remove();
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
          previouslyFocused.focus();
        }
        resolve(result);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(false); return; }
        if (e.key === 'Tab') {
          const focusables = [cancelBtn, okBtn];
          const i = focusables.indexOf(document.activeElement);
          if (e.shiftKey) {
            if (i <= 0) { e.preventDefault(); focusables[focusables.length - 1].focus(); }
          } else if (i === focusables.length - 1) {
            e.preventDefault(); focusables[0].focus();
          }
        }
      }
      okBtn.addEventListener('click', () => close(true));
      cancelBtn.addEventListener('click', () => close(false));
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
      document.addEventListener('keydown', onKey, true);

      document.body.appendChild(backdrop);
      // Defaultfokus = "Avbryt" så Enter/Mellanslag direkt inte triggar
      // den destruktiva åtgärden.
      cancelBtn.focus();
    });
  }

  function showDevBanner(text) {
    let banner = document.getElementById('dev-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'dev-banner';
      banner.className = 'dev-banner';
      const header = document.querySelector('.app-header');
      if (header) header.insertAdjacentElement('afterend', banner);
      else document.body.insertAdjacentElement('afterbegin', banner);
    }
    banner.textContent = text;
  }

  function clearDevBanner() {
    const banner = document.getElementById('dev-banner');
    if (banner) banner.remove();
  }

  window.UI = {
    escape,
    initials,
    avatar,
    renderHeader,
    renderBottomNav,
    showAlert,
    clearAlert,
    confirmDialog,
    showDevBanner,
    clearDevBanner,
  };
})();
