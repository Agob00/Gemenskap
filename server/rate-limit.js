/**
 * Enkel in-memory rate-limit för Express-routes.
 *
 * Designval: in-memory Map istället för DB-tabell. Räcker för en
 * single-process-server och är tillräckligt snabb även vid hög trafik
 * eftersom alla operationer är O(window-size) ≤ O(max).
 *
 * Använd via factory-funktionen `rateLimit({ key, max, windowMs, message })`
 * som returnerar en Express-middleware. `key` är en funktion som tar `req`
 * och returnerar en sträng — t.ex. `(req) => 'msg:' + req.userId`.
 *
 * För finkornig rate-limit (t.ex. avsändare→mottagare): inkludera båda
 * IDs i nyckeln: `(req) => 'msg:' + req.userId + ':' + req.params.userId`.
 */

const buckets = new Map(); // key -> [timestamp, timestamp, ...]
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // varje 5 min

function sweep(now) {
  // Rensa nycklar vars senaste timestamp är äldre än 1 timme — då har
  // de garanterat ingen aktiv window.
  const cutoff = now - 60 * 60 * 1000;
  for (const [k, arr] of buckets) {
    if (arr.length === 0 || arr[arr.length - 1] < cutoff) {
      buckets.delete(k);
    }
  }
  lastSweep = now;
}

/**
 * Kontrollera om nyckeln har plats kvar i sin window.
 * Returnerar { ok: true, remaining } eller { ok: false, retryAfterMs }.
 */
function check(key, max, windowMs) {
  const now = Date.now();
  if (now - lastSweep > SWEEP_INTERVAL_MS) sweep(now);

  let arr = buckets.get(key);
  if (!arr) {
    arr = [];
    buckets.set(key, arr);
  }
  // Ta bort timestamps utanför fönstret
  const cutoff = now - windowMs;
  while (arr.length && arr[0] < cutoff) arr.shift();

  if (arr.length >= max) {
    const retryAfterMs = arr[0] + windowMs - now;
    return { ok: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }
  arr.push(now);
  return { ok: true, remaining: max - arr.length };
}

/**
 * Express-middleware factory.
 *
 * @param {Object} opts
 * @param {(req: Request) => string} opts.key  unik identifierare per "vem"
 * @param {number} opts.max     max requests per fönster
 * @param {number} opts.windowMs fönsterlängd i ms
 * @param {string} opts.messageSv  svenskt felmeddelande
 * @param {string} opts.messageEn  engelskt felmeddelande
 * @param {string} [opts.errorCode='rate_limited']
 */
function rateLimit({ key, max, windowMs, messageSv, messageEn, errorCode }) {
  return (req, res, next) => {
    let k;
    try { k = key(req); } catch (e) { return next(); }
    if (!k) return next();
    const result = check(k, max, windowMs);
    if (result.ok) return next();
    const retrySec = Math.ceil(result.retryAfterMs / 1000);
    res.set('Retry-After', String(retrySec));
    return res.status(429).json({
      error: errorCode || 'rate_limited',
      message_sv: messageSv,
      message_en: messageEn,
      retry_after_sec: retrySec,
    });
  };
}

module.exports = { rateLimit, check };
