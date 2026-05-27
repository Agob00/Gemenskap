(function () {
  window.UI.renderHeader({ loggedIn: true });
  window.UI.renderBottomNav('community');

  const nameEl = document.getElementById('community-name');
  const metaEl = document.getElementById('community-meta');
  const switcherEl = document.getElementById('community-switcher');
  const switcherChipsEl = document.getElementById('community-switcher-chips');
  const tabBtns = document.querySelectorAll('[role="tab"]');
  const sections = {
    posts: document.getElementById('tab-posts'),
    members: document.getElementById('tab-members'),
    events: document.getElementById('tab-events'),
  };
  const postsEl = document.getElementById('posts');
  const membersEl = document.getElementById('members');
  const evListEl = document.getElementById('community-events');
  const postBtn = document.getElementById('post-btn');
  const postBody = document.getElementById('post-body');
  const evTitle = document.getElementById('ev-title');
  const evDate = document.getElementById('ev-date');
  const evLocation = document.getElementById('ev-location');
  const evAddress = document.getElementById('ev-address');
  const evDesc = document.getElementById('ev-desc');
  const evCreateBtn = document.getElementById('ev-create-btn');
  const leaveBtn = document.getElementById('leave-btn');
  const leaveSection = document.getElementById('leave-section');
  const writeCard = document.getElementById('write-card');
  const createEventCard = document.getElementById('create-event-card');
  const joinBanner = document.getElementById('join-banner');
  const justSwitchedBanner = document.getElementById('just-switched-banner');
  const cityMismatchBanner = document.getElementById('city-mismatch-banner');
  const interestsMismatchBanner = document.getElementById('interests-mismatch-banner');

  // Under denna Jaccard-tröskel visas mismatch-bannern. Mjukare än
  // assignBestCommunity's hård-tröskel (0.05) — vi vill flagga tidigt,
  // innan matchen blivit helt urusel.
  const INTERESTS_MISMATCH_THRESHOLD = 0.15;

  let community = null;
  let currentUserCity = null;

  function activateTab(name) {
    tabBtns.forEach((b) => b.setAttribute('aria-selected', b.getAttribute('data-tab') === name));
    Object.entries(sections).forEach(([k, el]) => { el.hidden = k !== name; });
    if (name === 'members') loadMembers();
    if (name === 'events') loadEvents();
    if (name === 'posts') loadPosts();
  }
  tabBtns.forEach((b) => b.addEventListener('click', () => activateTab(b.getAttribute('data-tab'))));

  function showMemberUI(isMember) {
    if (writeCard) writeCard.hidden = !isMember;
    if (createEventCard) createEventCard.hidden = !isMember;
    if (leaveSection) leaveSection.hidden = !isMember;
    if (joinBanner) {
      joinBanner.hidden = isMember;
      if (!isMember && community) {
        const full = community.memberCount >= community.maxMembers;
        const isCreator = !!community.isCreator;
        if (full && !isCreator) {
          joinBanner.innerHTML = `<div class="alert alert-info"><span class="alert-icon">i</span><div>${window.UI.escape(window.I18n.t('community.full_warning'))}</div></div>`;
        } else {
          // Creators: tydlig påminnelse om att de skapade gruppen
          const heading = isCreator
            ? window.I18n.t('community.creator_rejoin')
            : window.I18n.t('browse.join') + '?';
          const buttonLabel = isCreator
            ? window.I18n.t('community.rejoin_button')
            : window.I18n.t('onboarding.join_button');
          joinBanner.innerHTML = `<div class="card${isCreator ? ' card-warm' : ''}" style="text-align:center;border-color:var(--color-primary);">
              ${isCreator ? `<p class="muted" style="font-size:var(--font-sm);margin:0 0 8px;">&#10024; ${window.UI.escape(window.I18n.t('community.you_created_this'))}</p>` : ''}
              <p style="font-size:22px;font-weight:600;">${window.UI.escape(heading)}</p>
              <div class="btn-row"><button class="btn" id="join-inline-btn">${window.UI.escape(buttonLabel)}</button></div>
            </div>`;
          const jBtn = document.getElementById('join-inline-btn');
          if (jBtn) jBtn.addEventListener('click', joinThisCommunity);
        }
      }
    }
  }

  async function joinThisCommunity() {
    if (!community) return;
    try {
      await window.API.post(`/api/communities/${community.id}/join`);
      window.Auth.clearCache();
      community.isMember = true;
      community.memberCount += 1;
      metaEl.textContent = `${community.city} · ${window.I18n.t('community.member_count', { n: community.memberCount, max: community.maxMembers })}`;
      showMemberUI(true);
      window.UserStorage.set('current_community_id', String(community.id));
      // Uppdatera switcher med ny medlemslista (nu har vi en till)
      const u = await window.Auth.getCurrentUser();
      renderSwitcher((u && u.memberships) || [], community.id);
    } catch (e) {
      window.UI.showAlert('#alert', 'error', e.userMessage);
    }
  }

  // ── Switcher: visa alla användarens communities som chips ─────────
  function renderSwitcher(memberships, activeId) {
    if (!switcherEl || !switcherChipsEl) return;
    if (!memberships || memberships.length <= 1) {
      switcherEl.hidden = true;
      return;
    }
    switcherEl.hidden = false;
    switcherChipsEl.innerHTML = memberships
      .map((m) => {
        const isActive = m.id === activeId;
        return `<a class="community-switcher-chip${isActive ? ' active' : ''}"
                   href="/community.html?id=${m.id}"
                   ${isActive ? 'aria-current="page"' : ''}>
                  ${window.UI.escape(m.name)}
                </a>`;
      })
      .join('');
  }

  // ── Visa "du har bytt grupp"-banner om vi just kom hit via leave + reassign ─
  function showSwitchedBannerIfPresent(communityName) {
    if (!justSwitchedBanner) return;
    const params = new URLSearchParams(location.search);
    if (params.get('switched') !== '1') return;
    const fromName = params.get('from') || '';
    const lang = window.I18n.getLang();
    const key = fromName ? 'community.switched_from' : 'community.switched_no_from';
    const msg = window.I18n.t(key, { from: fromName, to: communityName });
    justSwitchedBanner.innerHTML = `<span class="banner-icon" aria-hidden="true">&#10003;</span><div>${window.UI.escape(msg)}</div>`;
    justSwitchedBanner.hidden = false;
    // Rensa query-paramen så bannern inte dyker upp igen vid reload
    const cleanUrl = location.pathname + '?id=' + (community ? community.id : params.get('id') || '');
    history.replaceState({}, '', cleanUrl);
    // Auto-fade efter 8s
    setTimeout(() => { justSwitchedBanner.hidden = true; }, 8000);
  }

  // ── Visa varning om användarens intressen inte längre matchar gruppen ──
  // Triggas efter att användaren ändrat intressen i profilen — backend
  // räknar Jaccard mot gruppen och inkluderar det i /api/communities/:id-svaret.
  function showInterestsMismatchIfNeeded() {
    if (!interestsMismatchBanner || !community || !community.isMember) return;
    if (typeof community.interestMatch !== 'number') { interestsMismatchBanner.hidden = true; return; }
    if (community.interestMatch >= INTERESTS_MISMATCH_THRESHOLD) {
      interestsMismatchBanner.hidden = true;
      return;
    }
    const msg = window.I18n.t('community.interests_mismatch');
    const btnLabel = window.I18n.t('community.interests_mismatch_button');
    interestsMismatchBanner.innerHTML =
      `<span class="banner-icon" aria-hidden="true">&#9888;</span>
       <div>
         <div>${window.UI.escape(msg)}</div>
         <div class="banner-action"><button type="button" class="btn" id="interests-mismatch-btn">${window.UI.escape(btnLabel)}</button></div>
       </div>`;
    interestsMismatchBanner.hidden = false;
    const btn = document.getElementById('interests-mismatch-btn');
    if (btn) btn.addEventListener('click', () => { leaveBtn.click(); });
  }

  // ── Visa varning om gruppen ligger i en annan stad än användarens ──
  function showCityMismatchIfNeeded() {
    if (!cityMismatchBanner || !community || !community.isMember) return;
    if (!currentUserCity || !community.city) { cityMismatchBanner.hidden = true; return; }
    const sameCity = currentUserCity.toLowerCase() === community.city.toLowerCase();
    if (sameCity) { cityMismatchBanner.hidden = true; return; }
    const msg = window.I18n.t('community.city_mismatch', {
      groupCity: community.city,
      userCity: currentUserCity,
    });
    cityMismatchBanner.innerHTML = `<span class="banner-icon" aria-hidden="true">&#9888;</span><div>${window.UI.escape(msg)}</div>`;
    cityMismatchBanner.hidden = false;
  }

  async function loadCommunity() {
    const u = await window.Auth.requireOnboardedUser();
    if (!u) return;
    currentUserCity = u.city || null;
    let id = Number(new URLSearchParams(location.search).get('id'));
    if (!id) id = Number(window.UserStorage.get('current_community_id'));
    if (!id && u.memberships && u.memberships.length > 0) id = u.memberships[0].id;
    // Rendera switchern alltid när vi har minst 2 communities
    renderSwitcher(u.memberships || [], id);
    if (!id) {
      nameEl.textContent = '';
      metaEl.textContent = window.I18n.t('home.no_community');
      // Säkerställ att alla skriv-/skapa-element är dolda när inget community finns
      if (writeCard) writeCard.hidden = true;
      if (createEventCard) createEventCard.hidden = true;
      if (leaveSection) leaveSection.hidden = true;
      // Visa empty-state med call-to-action
      postsEl.innerHTML = `<div class="empty-state">
        <span class="empty-state-icon">&#128101;</span>
        <p class="empty-state-text">${window.UI.escape(window.I18n.t('home.no_community'))}</p>
        <div class="empty-state-action">
          <a href="/browse.html" class="btn">${window.UI.escape(window.I18n.t('home.browse_communities'))} &rarr;</a>
        </div>
      </div>`;
      return;
    }
    try {
      const res = await window.API.get(`/api/communities/${id}`);
      community = res.community;
      nameEl.textContent = community.name;
      const creatorBadge = community.isCreator
        ? ` <span class="creator-badge" title="${window.UI.escape(window.I18n.t('community.you_created_this'))}">&#10024; ${window.UI.escape(window.I18n.t('community.creator_label'))}</span>`
        : '';
      metaEl.innerHTML = `${window.UI.escape(community.city)} · ${window.UI.escape(window.I18n.t('community.member_count', { n: community.memberCount, max: community.maxMembers }))}${creatorBadge}`;
      if (community.isMember) window.UserStorage.set('current_community_id', String(community.id));
      showMemberUI(community.isMember);
      showSwitchedBannerIfPresent(community.name);
      showCityMismatchIfNeeded();
      showInterestsMismatchIfNeeded();
      loadPosts();
      // Kontextuellt tips första gången användaren ser ett community
      if (window.Tips && community.isMember) {
        const tabRow = document.querySelector('.tab-row');
        if (tabRow) {
          window.Tips.show({
            key: 'first_community',
            anchor: tabRow,
            message: window.I18n.t('tips.first_community'),
            placement: 'before',
          });
        }
      }
    } catch (e) {
      window.UI.showAlert('#alert', 'error', e.userMessage);
    }
  }

  async function loadPosts() {
    if (!community) return;
    try {
      const res = await window.API.get(`/api/communities/${community.id}/posts`);
      if (!res.posts || res.posts.length === 0) {
        // Lärande empty state — vägleder användaren till write-card ovanför
        postsEl.innerHTML = `<div class="empty-state"><span class="empty-state-icon">&#128221;</span><p class="empty-state-text">${window.UI.escape(window.I18n.t('home.no_posts_hint'))}</p></div>`;
        return;
      }
      postsEl.innerHTML = res.posts
        .map(
          (p) => `
          <div class="card">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
              ${window.UI.avatar(p.author_name)}
              <div style="flex:1;">
                <a href="/profile.html?id=${p.author_id}"><strong>${window.UI.escape(p.author_name)}</strong></a>
                <span class="muted" style="display:block;font-size:14px;">${window.UI.escape(window.I18n.relativeTime(p.created_at))}</span>
              </div>
              <button type="button" class="btn-icon-quiet report-post-btn" data-post-id="${p.id}" aria-label="${window.UI.escape(window.I18n.t('report.post_button'))}" title="${window.UI.escape(window.I18n.t('report.post_button'))}">&#9888;</button>
            </div>
            <p>${window.UI.escape(p.body)}</p>
          </div>`
        )
        .join('');
      // Rapportera inlägg-knappar
      postsEl.querySelectorAll('.report-post-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const postId = Number(btn.getAttribute('data-post-id'));
          const reason = prompt(window.I18n.t('report.help') + '\n\n' + window.I18n.t('report.reason_placeholder'));
          if (reason === null) return;
          try {
            await window.API.post('/api/moderation/reports', {
              target_type: 'post',
              target_id: postId,
              reason: reason || '',
            });
            window.UI.showAlert('#alert', 'success', window.I18n.t('report.submitted'));
          } catch (e) {
            window.UI.showAlert('#alert', 'error', e.userMessage);
          }
        });
      });
    } catch (e) {
      console.error('[community] loadPosts failed:', e);
    }
  }

  async function loadMembers() {
    if (!community) return;
    try {
      const res = await window.API.get(`/api/communities/${community.id}/members`);
      membersEl.innerHTML = (res.members || [])
        .map(
          (m) => `
          <a class="member-row" href="/profile.html?id=${m.id}">
            ${window.UI.avatar(m.display_name)}
            <div>
              <span class="member-name">${window.UI.escape(m.display_name || '')}</span>
              <span class="member-city">${window.UI.escape(m.city || '')}</span>
            </div>
          </a>`
        )
        .join('');
    } catch (e) {
      window.UI.showAlert('#alert', 'error', e.userMessage);
    }
  }

  async function loadEvents() {
    if (!community) return;
    try {
      const res = await window.API.get(`/api/events/community/${community.id}`);
      if (!res.events || res.events.length === 0) {
        evListEl.innerHTML = `<div class="empty-state"><span class="empty-state-icon">&#128197;</span><p class="empty-state-text">${window.UI.escape(window.I18n.t('home.no_events'))}</p></div>`;
        return;
      }
      evListEl.innerHTML = res.events
        .map(
          (e) => {
            const mapQuery = encodeURIComponent(e.address || e.location || '');
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
            const hasLocation = e.location || e.address;
            return `
          <div class="card">
            <h3>${window.UI.escape(e.title)}</h3>
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
            ${community.isMember ? `<div class="btn-row row-side-by-side">
              <button class="btn ${e.myRsvp === 'going' ? '' : 'btn-secondary'}" data-rsvp="going" data-event="${e.id}">${window.UI.escape(window.I18n.t('events.rsvp_going'))}</button>
              <button class="btn ${e.myRsvp === 'maybe' ? '' : 'btn-secondary'}" data-rsvp="maybe" data-event="${e.id}">${window.UI.escape(window.I18n.t('events.rsvp_maybe'))}</button>
              <button class="btn ${e.myRsvp === 'no' ? '' : 'btn-secondary'}" data-rsvp="no" data-event="${e.id}">${window.UI.escape(window.I18n.t('events.rsvp_no'))}</button>
            </div>` : ''}
          </div>`;
          }
        )
        .join('');
      evListEl.querySelectorAll('[data-rsvp]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await window.API.post(`/api/events/${btn.getAttribute('data-event')}/rsvp`, {
              status: btn.getAttribute('data-rsvp'),
            });
            loadEvents();
          } catch (e) {
            window.UI.showAlert('#alert', 'error', e.userMessage);
          }
        });
      });
    } catch (e) {
      console.error('[community] loadEvents failed:', e);
    }
  }

  // Ctrl+Enter (eller Cmd+Enter) skickar inlägget. Hjälpmedel-vänligt
  // muskelminne — fungerar även om knappen ligger utanför viewporten.
  if (postBody) {
    postBody.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        postBtn.click();
      }
    });
  }

  postBtn.addEventListener('click', async () => {
    window.UI.clearAlert('#alert');
    if (!community) return;
    if (postBtn.disabled) return;
    postBtn.disabled = true;
    try {
      await window.API.post(`/api/communities/${community.id}/posts`, { body: postBody.value });
      postBody.value = '';
      loadPosts();
    } catch (e) {
      window.UI.showAlert('#alert', 'error', e.userMessage);
    } finally {
      postBtn.disabled = false;
    }
  });

  evCreateBtn.addEventListener('click', async () => {
    window.UI.clearAlert('#alert');
    if (!community) return;
    if (evCreateBtn.disabled) return;
    evCreateBtn.disabled = true;
    try {
      await window.API.post(`/api/events/community/${community.id}`, {
        title: evTitle.value,
        starts_at: evDate.value,
        location: evLocation.value,
        address: evAddress.value,
        description: evDesc.value,
      });
      evTitle.value = ''; evDate.value = ''; evLocation.value = ''; evAddress.value = ''; evDesc.value = '';
      loadEvents();
    } catch (e) {
      window.UI.showAlert('#alert', 'error', e.userMessage);
    } finally {
      evCreateBtn.disabled = false;
    }
  });

  leaveBtn.addEventListener('click', async () => {
    if (!community) return;
    // Bekräfta att användaren verkligen vill byta — kraftigare varning om
    // hen är sista medlemmen (gruppen försvinner då permanent).
    const isLastMember = community.memberCount <= 1;
    const confirmMsg = isLastMember
      ? window.I18n.t('community.leave_destroy_warning', { name: community.name })
      : window.I18n.t('community.switch_confirm', { from: community.name });
    const ok = await window.UI.confirmDialog({
      message: confirmMsg,
      destructive: isLastMember,
    });
    if (!ok) return;
    try {
      // Backend lämnar gruppen, registrerar avvisning, och tilldelar
      // automatiskt nästa bästa grupp (om någon finns).
      const oldName = community.name;
      const res = await window.API.post(`/api/communities/${community.id}/leave`);
      window.Auth.clearCache();
      if (res.nextCommunity && res.nextCommunity.id) {
        // Direkt-omdirigering till den nya gruppen, med flagga så nya
        // sidan kan visa "du har bytt grupp"-banner.
        window.UserStorage.set('current_community_id', String(res.nextCommunity.id));
        const fromParam = encodeURIComponent(oldName || '');
        window.location.href = `/community.html?id=${res.nextCommunity.id}&switched=1&from=${fromParam}`;
        return;
      }
      // Ingen ny grupp hittades — gå tillbaka till profilen
      window.UserStorage.remove('current_community_id');
      const msg = res.message_sv || (window.I18n.getLang() === 'en'
        ? 'No new group could be assigned right now. Update your interests in your profile.'
        : 'Ingen ny grupp kunde tilldelas just nu. Uppdatera dina intressen på profilen.');
      alert(msg);
      window.location.href = '/profile.html';
    } catch (e) {
      window.UI.showAlert('#alert', 'error', e.userMessage);
    }
  });

  loadCommunity();
})();
