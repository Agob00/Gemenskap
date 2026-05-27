(function () {
  async function request(method, path, body) {
    let res;
    try {
      res = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'same-origin',
      });
    } catch (e) {
      const err = new Error('network');
      err.code = 'network';
      err.userMessage = window.I18n ? window.I18n.t('errors.network') : 'Network error';
      throw err;
    }
    let data = null;
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = null; }
    }
    if (!res.ok) {
      const lang = window.I18n ? window.I18n.getLang() : 'sv';
      const err = new Error('api');
      err.code = (data && data.error) || 'http_' + res.status;
      err.status = res.status;
      err.userMessage =
        (data && (lang === 'en' ? data.message_en : data.message_sv)) ||
        (window.I18n ? window.I18n.t('errors.generic') : 'Something went wrong');
      err.data = data;
      throw err;
    }
    return data || {};
  }

  window.API = {
    get: (p) => request('GET', p),
    post: (p, b) => request('POST', p, b || {}),
    put: (p, b) => request('PUT', p, b || {}),
    del: (p) => request('DELETE', p),
  };
})();
