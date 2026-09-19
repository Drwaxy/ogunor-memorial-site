const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PNG } = require('pngjs');
const { validate, archive, filesFor } = require('../lib/condolence-store.cjs');
const handler = require('../api/condolences.js');
const input = () => ({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Test Visitor', relationship: '', email: '', message: 'A cherished memory.', consent: true, signature: null, website: '' });
function png() { return 'data:image/png;base64,' + PNG.sync.write(new PNG({ width: 1000, height: 360 })).toString('base64'); }
test('valid messages with and without signature produce retrievable files', () => {
  const plain = filesFor(validate(input())); assert.ok(plain['message.txt']); assert.equal(plain['signature.png'], undefined);
  const signed = filesFor(validate({ ...input(), signature: png() }));
  assert.equal(PNG.sync.read(signed['signature.png']).width, 1000);
  assert.match(signed['message.txt'].toString(), /A cherished memory/);
});
test('rejects invalid input, path injection, missing consent and oversized or malformed signatures', () => {
  for (const change of [{ id: '../bad' }, { name: '' }, { name: 'x\nEmail: forged' }, { consent: false }, { message: 'a'.repeat(10001) }, { website: 'spam' }, { email: 'invalid' }, { signature: 'data:image/png;base64,aGVsbG8=' }, { signature: 'x'.repeat(180001) }]) assert.throws(() => validate({ ...input(), ...change }));
  const wrongSize = 'data:image/png;base64,' + PNG.sync.write(new PNG({ width: 2, height: 2 })).toString('base64');
  assert.throws(() => validate({ ...input(), signature: wrongSize }));
});
function fakeGit({ privateRepo = true, conflict = false, receipt } = {}) {
  const calls = []; let patches = 0;
  const fetcher = async (url, options) => {
    const route = new URL(url).pathname.replace('/repos/owner/archive', '');
    const body = options.body && JSON.parse(options.body); calls.push({ route, body });
    let value = {}, status = 200;
    if (!route) value = { private: privateRepo, default_branch: 'main' };
    else if (route.startsWith('/git/ref/')) value = { object: { sha: 'head' + patches } };
    else if (route.startsWith('/git/commits/') && options.method === 'GET') value = { tree: { sha: 'base-tree' } };
    else if (route.startsWith('/contents/')) { if (receipt) value = { content: Buffer.from(JSON.stringify(receipt)).toString('base64') }; else status = 404; }
    else if (route === '/git/blobs') value = { sha: 'blob-' + calls.length };
    else if (route === '/git/trees') value = { sha: 'new-tree' };
    else if (route === '/git/commits') value = { sha: 'new-commit' };
    else if (route.startsWith('/git/refs/')) { patches++; if (conflict && patches === 1) status = 422; }
    return { ok: status < 400, status, json: async () => value };
  };
  return { fetcher, calls };
}
const env = { CONDOLENCE_GITHUB_TOKEN: 'test-token', CONDOLENCE_GITHUB_REPO: 'owner/archive' };
test('publishes text and PNG in one commit and retries a concurrent update without force', async () => {
  const fake = fakeGit({ conflict: true }); await archive(validate({ ...input(), signature: png() }), env, fake.fetcher);
  const trees = fake.calls.filter(c => c.route === '/git/trees'); assert.equal(trees.length, 2);
  assert.deepEqual(trees[0].body.tree.map(t => t.path.split('/').pop()), ['message.txt', 'receipt.json', 'signature.png']);
  assert.ok(fake.calls.filter(c => c.route.startsWith('/git/refs/')).every(c => c.body.force === false));
});
test('refuses public storage and treats retries as idempotent', async () => {
  const publicRepo = fakeGit({ privateRepo: false }); await assert.rejects(archive(validate(input()), env, publicRepo.fetcher)); assert.equal(publicRepo.calls.length, 1);
  const entry = validate(input()); const repeat = fakeGit({ receipt: { digest: entry.digest } }); await archive(entry, env, repeat.fetcher);
  assert.ok(!repeat.calls.some(c => c.route === '/git/blobs'));
  await assert.rejects(archive(validate({ ...input(), message: 'Changed' }), env, repeat.fetcher));
});
test('API fails closed without configuration', async () => {
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(value) { this.value = value; } };
  await handler({ method: 'POST', headers: {} }, res); assert.equal(res.code, 503);
});
test('API rejects foreign origins and invalid bot tokens before storage writes', async () => {
  const settings = { ...env, CONDOLENCE_ALLOWED_ORIGINS: 'https://memorial.example', TURNSTILE_SECRET_KEY: 'test-secret', TURNSTILE_SITE_KEY: 'test-site' };
  const saved = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  const originalFetch = global.fetch;
  Object.assign(process.env, settings);
  const response = () => ({ setHeader() {}, status(code) { this.code = code; return this; }, json(value) { this.value = value; } });
  try {
    let calls = 0;
    global.fetch = async () => { calls++; return { ok: true, json: async () => ({ success: false }) }; };
    const foreign = response();
    await handler({ method: 'POST', headers: { origin: 'https://other.example' } }, foreign);
    assert.equal(foreign.code, 403); assert.equal(calls, 0);
    const bot = response();
    await handler({ method: 'POST', headers: { origin: 'https://memorial.example', 'content-type': 'application/json' }, body: { ...input(), token: 'invalid' } }, bot);
    assert.equal(bot.code, 403); assert.equal(calls, 1);
    assert.ok(!JSON.stringify(bot.value).includes('test-secret'));
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
test('storage accepts surrounding whitespace in environment settings', async () => {
  const fake = fakeGit();
  await archive(validate(input()), { CONDOLENCE_GITHUB_REPO: ' owner/archive\r\n', CONDOLENCE_GITHUB_TOKEN: ' test-token\n' }, async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return fake.fetcher(url, options);
  });
  assert.ok(fake.calls.some(c => c.route === '/git/commits'));
});
test('GitHub write failures retain a safe operation and HTTP status for diagnosis', async () => {
  const fake = fakeGit();
  await assert.rejects(archive(validate(input()), env, async (url, options) => {
    if (url.endsWith('/git/blobs')) return { ok: false, status: 403 };
    return fake.fetcher(url, options);
  }), error => error.code === 'github_blobs' && error.status === 403 && !error.message.includes('test-token'));
});
