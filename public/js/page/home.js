(function () {
  window.UI.renderHeader({ loggedIn: true });
  window.UI.renderBottomNav('home');

  const welcomeBanner = document.getElementById('welcome-banner');
  const nextEventCard = document.getElementById('next-event-card');
  const recentPosts = document.getElementById('recent-posts');

  async function load() {
    const u = await window.Auth.requireOnboardedUser();
    if (!u) return;

    welcomeBanner.innerHTML = `
      <div class="welcome-banner">
        <span class="welcome-banner-icon" aria-hidden="true">&#128075;</span>
        <div>
          <h1>${window.UI.escape(window.I18n.t('home.welcome', { name: u.display_name }))}</h1>
          <p>${window.UI.escape(u.memberships && u.memberships.length > 0 ? u.memberships[0].name : window.I18n.t('home.no_community'))}</p>
        </div>
      </div>`;

    if (!u.memberships || u.memberships.length === 0) {
      // Lärande empty state — säger vad användaren kan göra härnäst
      nextEventCard.innerHTML = `
        <div class="card card-warm">
          <div class="empty-state" style="padding:24px 0;">
            <span class="empty-state-icon">&#128101;</span>
            <p class="empty-state-text">${window.UI.escape(window.I18n.t('home.no_community'))}</p>
            <div class="empty-state-action">
              <a href="/browse.html" class="btn">${window.UI.escape(window.I18n.t('home.browse_communities'))} &rarr;</a>
            </div>
          </div>
        </div>`;
      recentPosts.innerHTML = '';
      return;
    }

    const community = u.memberships[0];
    window.UserStorage.set('current_community_id', String(community.id));

    try {
      const ev = await window.API.get('/api/events/upcoming');
      if (ev.events && ev.events.length > 0) {
        const e = ev.events[0];
        nextEventCard.innerHTML = `
          <div class="card card-accent">
            <div class="section-header" style="margin-bottom:12px;">
              <span class="section-icon" aria-hidden="true">&#128197;</span>
              <h2 style="margin:0;">${window.UI.escape(window.I18n.t('home.next_event'))}</h2>
            </div>
            <h3>${window.UI.escape(e.title)}</h3>
            <p class="event-time">${window.UI.escape(window.I18n.formatEventTime(e.starts_at))}</p>
            ${(e.location || e.address) ? `<div class="event-location-block">
              <span class="event-location-icon" aria-hidden="true">&#128205;</span>
              <div>
                ${e.location ? `<span class="event-place-name">${window.UI.escape(e.location)}</span>` : ''}
                ${e.address ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.address || e.location || '')}" target="_blank" rel="noopener" class="event-address-link">${window.UI.escape(e.address)}</a>` : ''}
              </div>
            </div>` : ''}
            <p class="muted">${window.UI.escape(e.community_name)}</p>
            <p>${window.UI.escape(e.description || '')}</p>
            <p class="muted">${window.UI.escape(window.I18n.t('events.going_count', { n: e.goingCount }))}</p>
            <div class="btn-row row-side-by-side">
              <button class="btn ${e.myRsvp === 'going' ? '' : 'btn-secondary'}" data-rsvp="going" data-event="${e.id}">${window.UI.escape(window.I18n.t('events.rsvp_going'))}</button>
              <button class="btn ${e.myRsvp === 'maybe' ? '' : 'btn-secondary'}" data-rsvp="maybe" data-event="${e.id}">${window.UI.escape(window.I18n.t('events.rsvp_maybe'))}</button>
              <button class="btn ${e.myRsvp === 'no' ? '' : 'btn-secondary'}" data-rsvp="no" data-event="${e.id}">${window.UI.escape(window.I18n.t('events.rsvp_no'))}</button>
            </div>
          </div>`;
        nextEventCard.querySelectorAll('[data-rsvp]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            try {
              await window.API.post(`/api/events/${btn.getAttribute('data-event')}/rsvp`, {
                status: btn.getAttribute('data-rsvp'),
              });
              load();
            } catch (err) {
              console.error('[home] rsvp failed:', err);
            }
          });
        });
        // Kontextuell ledtråd: visas en gång när användaren ser sitt första event
        if (window.Tips) {
          const card = nextEventCard.querySelector('.card');
          if (card) {
            window.Tips.show({
              key: 'first_event',
              anchor: card,
              message: window.I18n.t('tips.first_event'),
              placement: 'before',
            });
          }
        }
      } else {
        nextEventCard.innerHTML = `
          <div class="card card-accent">
            <div class="section-header" style="margin-bottom:12px;">
              <span class="section-icon" aria-hidden="true">&#128197;</span>
              <h2 style="margin:0;">${window.UI.escape(window.I18n.t('home.next_event'))}</h2>
            </div>
            <p class="muted">${window.UI.escape(window.I18n.t('home.no_events'))}</p>
            <div class="btn-row">
              <a href="/community.html" class="btn btn-secondary">${window.UI.escape(window.I18n.t('home.go_community'))}</a>
            </div>
          </div>`;
      }
    } catch (e) {
      console.error('[home] failed to load upcoming events:', e);
    }

    try {
      const p = await window.API.get(`/api/communities/${community.id}/posts`);
      const posts = (p.posts || []).slice(0, 3);
      if (posts.length === 0) {
        recentPosts.innerHTML = `
          <div class="empty-state">
            <span class="empty-state-icon">&#128221;</span>
            <p class="empty-state-text">${window.UI.escape(window.I18n.t('home.no_posts'))}</p>
          </div>`;
      } else {
        recentPosts.innerHTML = posts
          .map(
            (post) => `
            <div class="card card-plain">
              <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px;">
                ${window.UI.avatar(post.author_name)}
                <div>
                  <strong style="font-size:var(--font-sm);">${window.UI.escape(post.author_name)}</strong>
                  <span class="muted" style="display:block;font-size:15px;">${window.UI.escape(window.I18n.relativeTime(post.created_at))}</span>
                </div>
              </div>
              <p style="font-size:var(--font-sm);line-height:1.6;">${window.UI.escape(post.body)}</p>
            </div>`
          )
          .join('');
      }
    } catch (e) {
      console.error('[home] failed to load posts:', e);
    }

    // Tutorial visas inte längre automatiskt vid första besöket — forskning visar
    // att modal-overlays vid första-gången-användning vanligen ignoreras och inte
    // minns. Istället används kontextuella ledtrådar (tips.js) och självförklarande
    // empty states. Användare kan starta om rundturen via knappen i profilen.
  }

  load();
  document.addEventListener('langchange', load);
})();
