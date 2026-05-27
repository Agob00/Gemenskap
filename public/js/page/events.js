(function () {
  window.UI.renderHeader({ loggedIn: true });
  window.UI.renderBottomNav('events');

  const list = document.getElementById('events-list');

  async function load() {
    const u = await window.Auth.requireOnboardedUser();
    if (!u) return;
    try {
      const res = await window.API.get('/api/events/upcoming');
      if (!res.events || res.events.length === 0) {
        list.innerHTML = `
          <div class="empty-state">
            <span class="empty-state-icon">&#128197;</span>
            <p class="empty-state-text">${window.UI.escape(window.I18n.t('home.no_events_hint'))}</p>
            <div class="empty-state-action">
              <a href="/community.html" class="btn btn-secondary">${window.UI.escape(window.I18n.t('home.go_community'))} &rarr;</a>
            </div>
          </div>`;
        return;
      }
      list.innerHTML = res.events
        .map(
          (e) => {
            const mapQuery = encodeURIComponent(e.address || e.location || '');
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
            const hasLocation = e.location || e.address;
            return `
          <div class="card">
            <h3>${window.UI.escape(e.title)}</h3>
            <p class="muted event-community-label">${window.UI.escape(e.community_name)}</p>
            <p class="event-time">${window.UI.escape(window.I18n.formatEventTime(e.starts_at))}</p>
            ${hasLocation ? `<div class="event-location-block">
              <span class="event-location-icon" aria-hidden="true">&#128205;</span>
              <div>
                ${e.location ? `<span class="event-place-name">${window.UI.escape(e.location)}</span>` : ''}
                ${e.address ? `<a href="${mapUrl}" target="_blank" rel="noopener" class="event-address-link">${window.UI.escape(e.address)}</a>` : ''}
              </div>
            </div>` : ''}
            <p>${window.UI.escape(e.description || '')}</p>
            <p class="muted">${window.UI.escape(window.I18n.t('events.going_count', { n: e.goingCount }))}</p>
            <div class="btn-row row-side-by-side">
              <button class="btn ${e.myRsvp === 'going' ? '' : 'btn-secondary'}" data-rsvp="going" data-event="${e.id}">${window.UI.escape(window.I18n.t('events.rsvp_going'))}</button>
              <button class="btn ${e.myRsvp === 'maybe' ? '' : 'btn-secondary'}" data-rsvp="maybe" data-event="${e.id}">${window.UI.escape(window.I18n.t('events.rsvp_maybe'))}</button>
              <button class="btn ${e.myRsvp === 'no' ? '' : 'btn-secondary'}" data-rsvp="no" data-event="${e.id}">${window.UI.escape(window.I18n.t('events.rsvp_no'))}</button>
            </div>
          </div>`;
          }
        )
        .join('');
      // Kontextuellt tips: visas en gång över första eventet i listan
      if (window.Tips) {
        const firstCard = list.querySelector('.card');
        if (firstCard) {
          window.Tips.show({
            key: 'first_event',
            anchor: firstCard,
            message: window.I18n.t('tips.first_event'),
            placement: 'before',
          });
        }
      }
      list.querySelectorAll('[data-rsvp]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await window.API.post(`/api/events/${btn.getAttribute('data-event')}/rsvp`, {
              status: btn.getAttribute('data-rsvp'),
            });
            load();
          } catch (e) {
            window.UI.showAlert('#alert', 'error', e.userMessage);
          }
        });
      });
    } catch (e) {
      window.UI.showAlert('#alert', 'error', e.userMessage);
    }
  }

  load();
  document.addEventListener('langchange', load);
})();
