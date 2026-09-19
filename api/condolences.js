const { validate, archive, checkStorage, MAX_BODY } = require('../lib/condolence-store.cjs');
// Best-effort per-instance throttling; configure Vercel firewall rate limits before launch.
const buckets = new Map();
let storageCheck;
let storageCheckedAt = 0;
function logFailure(error, stage) {
  console.error('condolence_service_failure', JSON.stringify({ stage, code: error.code || (error.name === 'TimeoutError' ? 'timeout' : 'unexpected'), status: error.status || null }));
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const reply = (code, data) => res.status(code).json(data);
  const env = process.env;
  const origins = (env.CONDOLENCE_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const configured = env.CONDOLENCE_GITHUB_TOKEN && env.CONDOLENCE_GITHUB_REPO && env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY && origins.length;
  if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return reply(405, { error: 'Method not allowed' }); }
  if (!configured) return reply(503, { error: 'Register unavailable' });
  if (req.method === 'GET') {
    // Check actual access, not just whether environment variable names exist.
    if (!storageCheck || Date.now() - storageCheckedAt > 60000) {
      storageCheckedAt = Date.now();
      storageCheck = checkStorage().then(() => true).catch(error => { logFailure(error, 'storage_readiness'); return false; });
    }
    const storageReady = await storageCheck;
    return reply(200, { preview: false, siteKey: env.TURNSTILE_SITE_KEY.trim(), storageReady });
  }
  if (!origins.includes(req.headers.origin)) return reply(403, { error: 'Not allowed' });
  if (!(req.headers['content-type'] || '').startsWith('application/json')) return reply(415, { error: 'JSON required' });
  const ip = String(req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown');
  const now = Date.now();
  for (const [key, bucket] of buckets) if (now > bucket.until) buckets.delete(key);
  const bucket = buckets.get(ip) || { count: 0, until: now + 600000 };
  if (buckets.size >= 10000 && !buckets.has(ip)) return reply(429, { error: 'Please try later' });
  buckets.set(ip, bucket);
  if (++bucket.count > 10) { res.setHeader('Retry-After', '600'); return reply(429, { error: 'Please try later' }); }
  let body, entry;
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!raw || Buffer.byteLength(raw) > MAX_BODY) return reply(413, { error: 'Entry too large' });
    body = JSON.parse(raw); entry = validate(body);
    if (typeof body.token !== 'string' || body.token.length > 2048) throw new Error();
  } catch { return reply(400, { error: 'Please check your entry' }); }
  let stage = 'verification';
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY.trim(), response: body.token }), signal: AbortSignal.timeout(10000) });
    const result = await response.json();
    const hostnames = origins.map(origin => new URL(origin).hostname);
    if (!response.ok || !result.success || result.action !== 'condolence' || !hostnames.includes(result.hostname)) return reply(403, { error: 'Please verify again' });
    stage = 'archive';
    await archive(entry);
    return reply(200, { saved: true, reference: entry.id });
  } catch (error) { logFailure(error, stage); return reply(503, { error: 'Unable to save. Please retry.' }); }
};
