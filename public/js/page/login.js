(function () {
  window.UI.renderHeader({ loggedIn: false });

  const phoneSection = document.getElementById('phone-section');
  const codeSection = document.getElementById('code-section');
  const phoneInput = document.getElementById('phone');
  const codeInput = document.getElementById('code');
  const sendBtn = document.getElementById('send-code-btn');
  const verifyBtn = document.getElementById('verify-btn');
  const resendBtn = document.getElementById('resend-btn');
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');

  let currentPhone = '';
  let resendTimer = null;
  let resendSecondsLeft = 0;

  function setStep(n) {
    step1.classList.toggle('active', n === 1);
    step1.classList.toggle('done', n > 1);
    step2.classList.toggle('active', n === 2);
  }

  function startResendCountdown() {
    resendSecondsLeft = 30;
    resendBtn.disabled = true;
    if (resendTimer) clearInterval(resendTimer);
    function tick() {
      if (resendSecondsLeft > 0) {
        resendBtn.textContent = window.I18n.t('login.resend_in', { s: resendSecondsLeft });
        resendSecondsLeft -= 1;
      } else {
        resendBtn.textContent = window.I18n.t('login.resend');
        resendBtn.disabled = false;
        clearInterval(resendTimer);
        resendTimer = null;
      }
    }
    tick();
    resendTimer = setInterval(tick, 1000);
  }

  async function sendCode() {
    window.UI.clearAlert('#alert');
    const phone = phoneInput.value.trim();
    if (!phone) {
      window.UI.showAlert('#alert', 'error', window.I18n.t('errors.generic'));
      return;
    }
    sendBtn.disabled = true;
    try {
      const res = await window.API.post('/api/auth/request-code', { phone });
      currentPhone = phone;
      phoneSection.hidden = true;
      codeSection.hidden = false;
      setStep(2);
      if (res.dev_code) {
        window.UI.showDevBanner(window.I18n.t('login.dev_code') + res.dev_code);
      }
      startResendCountdown();
      codeInput.focus();
    } catch (e) {
      window.UI.showAlert('#alert', 'error', e.userMessage);
    } finally {
      sendBtn.disabled = false;
    }
  }

  async function verifyCode() {
    window.UI.clearAlert('#alert');
    const code = codeInput.value.trim();
    if (!code) {
      window.UI.showAlert('#alert', 'error', window.I18n.t('errors.generic'));
      return;
    }
    verifyBtn.disabled = true;
    try {
      const res = await window.API.post('/api/auth/verify', { phone: currentPhone, code });
      window.Auth.clearCache();
      window.UI.clearDevBanner();
      window.location.href = res.needsOnboarding ? '/onboarding.html' : '/home.html';
    } catch (e) {
      window.UI.showAlert('#alert', 'error', e.userMessage);
      verifyBtn.disabled = false;
    }
  }

  async function resend() {
    if (!currentPhone) return;
    try {
      const res = await window.API.post('/api/auth/request-code', { phone: currentPhone });
      if (res.dev_code) {
        window.UI.showDevBanner(window.I18n.t('login.dev_code') + res.dev_code);
      }
      startResendCountdown();
    } catch (e) {
      window.UI.showAlert('#alert', 'error', e.userMessage);
    }
  }

  sendBtn.addEventListener('click', sendCode);
  verifyBtn.addEventListener('click', verifyCode);
  resendBtn.addEventListener('click', resend);
  phoneInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendCode(); });
  codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') verifyCode(); });

  document.addEventListener('langchange', () => {
    if (resendBtn.disabled) resendBtn.textContent = window.I18n.t('login.resend_in', { s: resendSecondsLeft + 1 });
    else resendBtn.textContent = window.I18n.t('login.resend');
  });

  (async () => {
    const u = await window.Auth.getCurrentUser();
    if (u && u.display_name && u.city) window.location.href = '/home.html';
    else if (u) window.location.href = '/onboarding.html';
  })();
})();
