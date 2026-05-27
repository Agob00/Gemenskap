(function () {
  window.UI.renderHeader({ loggedIn: true });
  window.UI.renderBottomNav('messages');

  const threadsView = document.getElementById('threads-view');
  const threadsListEl = document.getElementById('threads-list');
  const startNewBtn = document.getElementById('start-new-btn');
  const pickMemberView = document.getElementById('pick-member-view');
  const pickMemberList = document.getElementById('pick-member-list');
  const pickBackBtn = document.getElementById('pick-back-btn');
  const pickMemberSearch = document.getElementById('pick-member-search');
  const pickMemberCount = document.getElementById('pick-member-count');

  // Cache av hela medlemslistan så vi kan filtrera utan ett nytt API-anrop.
  let pickMemberAll = [];
  const threadView = document.getElementById('thread-view');
  const backBtn = document.getElementById('back-btn');
  const partnerName = document.getElementById('partner-name');
  const threadMessages = document.getElementById('thread-messages');
  const msgBody = document.getElementById('msg-body');
  const sendBtn = document.getElementById('send-btn');
  const blockBtn = document.getElementById('block-btn');
  const reportBtn = document.getElementById('report-btn');

  let me = null;
  let activePartner = null;
  let activePartnerName = '';
  // Lista av meddelanden i nuvarande tråd — vi pushar nya direkt istället
  // för att hämta om hela listan.
  let currentMessages = [];
  let eventSource = null;
  let reconnectTimer = null;

  // ── PII-detektor: varnar om användaren delar känsliga uppgifter ──
  // Mönster för svenska telefonnummer, IBAN, BankID-koder, personnummer
  const PII_PATTERNS = [
    /\b(?:\+?46|0)[\s-]?7[\d\s-]{8,}\b/,           // Svenskt mobilnummer
    /\b\d{6}[-]?\d{4}\b/,                           // Personnummer (YYMMDD-XXXX)
    /\bSE\d{2}[\s\d]{20,}\b/i,                      // IBAN (Sverige)
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,   // Kreditkort 16 siffror
    /\b\d{3}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/,   // Långa nummer-sekvenser
  ];

  function containsPII(text) {
    if (!text) return false;
    return PII_PATTERNS.some((re) => re.test(text));
  }

  // ── SSE — en enda anslutning för hela sidan, oavsett aktiv tråd ──
  function connectStream() {
    if (eventSource) return;
    try {
      eventSource = new EventSource('/api/messages/stream');
    } catch (e) {
      return;
    }

    eventSource.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (_) { return; }
      handleIncomingMessage(msg);
    });

    eventSource.addEventListener('ready', () => {
      // anslutning levande
    });

    eventSource.onerror = () => {
      // EventSource försöker reconnecta automatiskt, men om den hamnar i
      // CLOSED-state stänger vi och försöker igen efter 3 sek.
      if (eventSource && eventSource.readyState === EventSource.CLOSED) {
        eventSource = null;
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connectStream();
          }, 3000);
        }
      }
    };
  }

  function disconnectStream() {
    if (eventSource) { eventSource.close(); eventSource = null; }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  }

  function handleIncomingMessage(msg) {
    if (!me) return;
    const inThread =
      activePartner &&
      ((msg.sender_id === me.id && msg.recipient_id === activePartner) ||
       (msg.sender_id === activePartner && msg.recipient_id === me.id));

    if (inThread) {
      currentMessages.push(msg);
      appendMessageRow(msg);
      // Om vi tagit emot ett nytt meddelande FRÅN partnern och vi är aktiva,
      // markera som läst direkt (en POST istället för polling).
      if (msg.sender_id === activePartner) {
        markRead(activePartner);
      }
    } else {
      // Meddelandet hör inte till nuvarande vy — uppdatera trådlistan
      // bara om den är synlig.
      if (!threadsView.hidden) loadThreads();
    }
  }

  function appendMessageRow(m) {
    const mine = m.sender_id === me.id;
    const row = document.createElement('div');
    row.className = 'message-row' + (mine ? ' mine' : '');
    row.innerHTML = `
      <div class="message-bubble"></div>
      <span class="message-meta"></span>`;
    row.querySelector('.message-bubble').textContent = m.body;
    row.querySelector('.message-meta').textContent = window.I18n.relativeTime(m.created_at);
    threadMessages.appendChild(row);
    threadMessages.scrollTop = threadMessages.scrollHeight;
  }

  // Read-receipts: backend gör bara UPDATE om det FINNS olästa, så att kalla
  // GET här när ett nytt SSE-meddelande kommer in är billigt. Ingen
  // skriv-amplifiering — bara en SELECT i 99 % av fallen.
  async function markRead(partnerId) {
    try {
      await window.API.get(`/api/messages/with/${partnerId}`);
    } catch (_) { /* tyst fail */ }
  }

  async function loadThreads() {
    threadView.hidden = true;
    pickMemberView.hidden = true;
    threadsView.hidden = false;
    activePartner = null;

    try {
      const res = await window.API.get('/api/messages/threads');
      if (!res.threads || res.threads.length === 0) {
        threadsListEl.innerHTML = `
          <div class="empty-state">
            <span class="empty-state-icon">&#128172;</span>
            <p class="empty-state-text">${window.UI.escape(window.I18n.t('messages.no_threads'))}</p>
          </div>`;
        return;
      }
      threadsListEl.innerHTML = `<div class="list-stack">${res.threads
        .map(
          (t) => `
          <a class="member-row" href="?with=${t.partner.id}">
            ${window.UI.avatar(t.partner.display_name)}
            <div style="flex:1;">
              <strong>${window.UI.escape(t.partner.display_name || '')}</strong>
              ${t.last ? `<span class="muted" style="display:block;font-size:16px;">${window.UI.escape(t.last.body.slice(0,80))}</span>` : ''}
            </div>
            ${t.unread > 0 ? `<span class="unread-badge">${t.unread}</span>` : ''}
          </a>`
        )
        .join('')}</div>`;
    } catch (e) {
      window.UI.showAlert('#alert', 'error', e.userMessage);
    }
  }

  // ── Starta ny konversation: visa medlemmar från användarens grupper ──
  // Hämtar medlemmar för varje community som användaren tillhör,
  // dedupliciterar (samma person kan vara i två grupper), filtrerar bort
  // användaren själv. Tryck på en rad → öppna tråd med den personen.
  async function loadPickMember() {
    threadView.hidden = true;
    threadsView.hidden = true;
    pickMemberView.hidden = false;
    activePartner = null;
    pickMemberList.innerHTML = `<p class="muted">…</p>`;
    if (pickMemberCount) pickMemberCount.textContent = '';
    if (pickMemberSearch) pickMemberSearch.value = '';

    if (!me || !me.memberships || me.memberships.length === 0) {
      pickMemberAll = [];
      renderPickMemberList('');
      return;
    }

    try {
      // Hämta medlemmar för alla användarens grupper parallellt
      const results = await Promise.all(
        me.memberships.map((m) =>
          window.API.get(`/api/communities/${m.id}/members`)
            .then((r) => ({ community: m, members: r.members || [] }))
            .catch(() => ({ community: m, members: [] }))
        )
      );

      // Bygg en map över unika medlemmar → vilka grupper de delar med mig
      const byId = new Map();
      for (const { community, members } of results) {
        for (const mem of members) {
          if (mem.id === me.id) continue;
          if (!byId.has(mem.id)) {
            byId.set(mem.id, { user: mem, communities: [] });
          }
          byId.get(mem.id).communities.push(community.name);
        }
      }

      pickMemberAll = [...byId.values()].sort((a, b) =>
        (a.user.display_name || '').localeCompare(b.user.display_name || '', 'sv')
      );

      renderPickMemberList('');
      if (pickMemberSearch) pickMemberSearch.focus();
    } catch (e) {
      window.UI.showAlert('#alert', 'error', e.userMessage);
    }
  }

  // Normalisera för sök: case + diakritiska tecken bort. Gör att "Asa"
  // matchar "Åsa" och tvärtom — viktigt för seniorer som inte alltid
  // hittar å/ä/ö snabbt på tangentbordet.
  function normalizeForSearch(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
  }

  function renderPickMemberList(query) {
    if (pickMemberAll.length === 0) {
      pickMemberList.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">&#128101;</span>
          <p class="empty-state-text">${window.UI.escape(window.I18n.t('messages.no_members_to_message'))}</p>
        </div>`;
      if (pickMemberCount) pickMemberCount.textContent = '';
      return;
    }

    const q = normalizeForSearch(query).trim();
    const filtered = q
      ? pickMemberAll.filter(({ user, communities }) => {
          const haystack = normalizeForSearch(
            (user.display_name || '') + ' ' + communities.join(' ')
          );
          return haystack.includes(q);
        })
      : pickMemberAll;

    if (pickMemberCount) {
      const totalText = window.I18n.t('messages.search_count', {
        n: filtered.length,
        total: pickMemberAll.length,
      });
      pickMemberCount.textContent = totalText;
    }

    if (filtered.length === 0) {
      pickMemberList.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">&#128269;</span>
          <p class="empty-state-text">${window.UI.escape(window.I18n.t('messages.search_no_match'))}</p>
        </div>`;
      return;
    }

    pickMemberList.innerHTML = filtered
      .map(({ user, communities }) => `
        <a class="member-row" href="?with=${user.id}">
          ${window.UI.avatar(user.display_name)}
          <div style="flex:1;">
            <strong>${window.UI.escape(user.display_name || '')}</strong>
            <span class="muted" style="display:block;font-size:16px;">${window.UI.escape(communities.join(' · '))}</span>
          </div>
        </a>`)
      .join('');
  }

  async function openThread(partnerId) {
    threadsView.hidden = true;
    pickMemberView.hidden = true;
    threadView.hidden = false;
    activePartner = partnerId;

    // Hämta meddelanden EN gång — sedan väntar vi på SSE för uppdateringar.
    try {
      const res = await window.API.get(`/api/messages/with/${partnerId}`);
      activePartnerName = (res.partner && res.partner.display_name) || '';
      partnerName.textContent = activePartnerName;
      currentMessages = res.messages || [];
      threadMessages.innerHTML = '';
      currentMessages.forEach(appendMessageRow);
      threadMessages.scrollTop = threadMessages.scrollHeight;
    } catch (e) {
      window.UI.showAlert('#alert', 'error', e.userMessage);
      return;
    }

    msgBody.focus();

    // Kontextuellt tips: visas en gång ovanför första meddelandetråden
    if (window.Tips) {
      const inputCard = msgBody.closest('.card');
      if (inputCard) {
        window.Tips.show({
          key: 'first_message_thread',
          anchor: inputCard,
          message: window.I18n.t('tips.first_message_thread'),
          placement: 'before',
        });
      }
    }
  }

  // Ctrl+Enter (eller Cmd+Enter på Mac) skickar meddelandet — vanlig
  // muskelminne-genväg som många pensionärer lärt sig från epost.
  msgBody.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      sendBtn.click();
    }
  });

  sendBtn.addEventListener('click', async () => {
    if (!activePartner) return;
    if (sendBtn.disabled) return;
    const body = msgBody.value;
    // PII-varning: be om bekräftelse om meddelandet innehåller telefon/IBAN/personnummer
    if (containsPII(body)) {
      const ok = await window.UI.confirmDialog({
        message: window.I18n.t('messages.pii_warning'),
        destructive: true,
      });
      if (!ok) return;
    }
    sendBtn.disabled = true;
    try {
      await window.API.post(`/api/messages/with/${activePartner}`, { body });
      msgBody.value = '';
      // Inget refreshMessages() — vårt eget meddelande kommer tillbaka via SSE
      // (servern echo:ar till sender också för flerflik-synk). Detta är
      // billigare än en extra GET.
    } catch (e) {
      window.UI.showAlert('#alert', 'error', e.userMessage);
    } finally {
      sendBtn.disabled = false;
    }
  });

  // ── Blockera ────────────────────────────────────────────────
  if (blockBtn) {
    blockBtn.addEventListener('click', async () => {
      if (!activePartner) return;
      const ok = await window.UI.confirmDialog({
        message: window.I18n.t('messages.block_confirm', { name: activePartnerName || '' }),
        destructive: true,
      });
      if (!ok) return;
      try {
        await window.API.post(`/api/moderation/blocks/${activePartner}`);
        history.replaceState({}, '', '/messages.html');
        loadThreads();
        // Visa bekräftelsen i trådlistans alert-container efter omladdning
        window.UI.showAlert('#alert', 'success', window.I18n.t('messages.block_done'));
      } catch (e) {
        window.UI.showAlert('#alert', 'error', e.userMessage);
      }
    });
  }

  // ── Rapportera ──────────────────────────────────────────────
  if (reportBtn) {
    reportBtn.addEventListener('click', async () => {
      if (!activePartner) return;
      const reason = prompt(window.I18n.t('report.help') + '\n\n' + window.I18n.t('report.reason_placeholder'));
      if (reason === null) return; // avbruten
      try {
        await window.API.post('/api/moderation/reports', {
          target_type: 'user',
          target_id: activePartner,
          reason: reason || '',
        });
        window.UI.showAlert('#alert', 'success', window.I18n.t('report.submitted'));
      } catch (e) {
        window.UI.showAlert('#alert', 'error', e.userMessage);
      }
    });
  }

  backBtn.addEventListener('click', () => {
    history.replaceState({}, '', '/messages.html');
    loadThreads();
  });

  if (startNewBtn) {
    startNewBtn.addEventListener('click', () => {
      loadPickMember();
    });
  }
  if (pickBackBtn) {
    pickBackBtn.addEventListener('click', () => {
      loadThreads();
    });
  }
  if (pickMemberSearch) {
    pickMemberSearch.addEventListener('input', () => {
      renderPickMemberList(pickMemberSearch.value);
    });
  }

  // Stäng SSE när fliken stängs eller pausas länge — sparar batteri.
  window.addEventListener('beforeunload', disconnectStream);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Behåll anslutningen — modern webbläsare hanterar background tabs
      // smart, och ett push-meddelande från en kompis ska levereras ändå.
    }
  });

  (async () => {
    me = await window.Auth.requireOnboardedUser();
    if (!me) return;
    connectStream();
    const params = new URLSearchParams(location.search);
    const w = Number(params.get('with'));
    if (w) openThread(w);
    else loadThreads();
  })();
})();
