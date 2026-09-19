const { PNG } = require('pngjs');
const { createHash } = require('node:crypto');
const MAX_BODY = 220000;
function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid entry');
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.id)) throw new Error('Invalid reference');
  const entry = { id: body.id.toLowerCase() };
  for (const [key, max] of Object.entries({ name: 120, relationship: 160, email: 254, message: 10000 })) {
    if (typeof body[key] !== 'string' || body[key].length > max) throw new Error('Invalid field');
    entry[key] = body[key].trim();
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(entry[key])) throw new Error('Invalid text');
    if (key !== 'message' && /[\r\n]/.test(entry[key])) throw new Error('Invalid field');
  }
  if (!entry.name || !entry.message || body.consent !== true || body.website) throw new Error('Invalid entry');
  if (entry.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email)) throw new Error('Invalid email');
  entry.signature = null;
  if (body.signature !== null && body.signature !== undefined) {
    if (typeof body.signature !== 'string' || body.signature.length > 180000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(body.signature)) throw new Error('Invalid signature');
    const raw = Buffer.from(body.signature.split(',')[1], 'base64');
    if (raw.length < 33 || raw.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || raw.readUInt32BE(16) !== 1000 || raw.readUInt32BE(20) !== 360) throw new Error('Invalid signature dimensions');
    // Decode and re-encode, validating CRCs and stripping extra PNG metadata.
    const decoded = PNG.sync.read(raw, { checkCRC: true });
    entry.signature = PNG.sync.write(decoded);
  }
  entry.digest = createHash('sha256').update(JSON.stringify([entry.name, entry.relationship, entry.email, entry.message])).update(entry.signature || '').digest('hex');
  return entry;
}
function filesFor(entry, timestamp = new Date().toISOString()) {
  const text = `Condolence Register\nReference: ${entry.id}\nReceived: ${timestamp}\nName: ${entry.name}\nRelationship: ${entry.relationship || '(not supplied)'}\nEmail: ${entry.email || '(not supplied)'}\nConsent: agreed to private storage and email delivery\nSignature: ${entry.signature ? 'signature.png' : '(not supplied)'}\n\nMessage:\n${entry.message}\n`;
  return { 'message.txt': Buffer.from(text), 'receipt.json': Buffer.from(JSON.stringify({ digest: entry.digest })), ...(entry.signature ? { 'signature.png': entry.signature } : {}) };
}
async function archive(entry, env = process.env, fetcher = fetch) {
  const repo = env.CONDOLENCE_GITHUB_REPO;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !env.CONDOLENCE_GITHUB_TOKEN) throw new Error('Storage unavailable');
  const base = `https://api.github.com/repos/${repo}`;
  async function api(path, method = 'GET', body) {
    const response = await fetcher(base + path, { method, headers: { Authorization: `Bearer ${env.CONDOLENCE_GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000) });
    if (!response.ok) { const error = new Error('Storage unavailable'); error.status = response.status; throw error; }
    return response.json();
  }
  const info = await api('');
  if (info.private !== true) throw new Error('Storage must be private');
  const branch = encodeURIComponent(info.default_branch);
  const folder = `submissions/${entry.id}`;
  const files = filesFor(entry);
  // A single tree/commit publishes the message and image together.
  for (let attempt = 0; attempt < 4; attempt++) {
    const head = await api(`/git/ref/heads/${branch}`);
    const previous = await api(`/git/commits/${head.object.sha}`);
    try {
      const receipt = await api(`/contents/${folder}/receipt.json?ref=${head.object.sha}`);
      const existing = JSON.parse(Buffer.from(receipt.content, 'base64').toString('utf8'));
      if (existing.digest !== entry.digest) throw new Error('Reference already used');
      return;
    } catch (error) { if (error.status !== 404) throw error; }
    const tree = [];
    for (const [name, content] of Object.entries(files)) {
      const blob = await api('/git/blobs', 'POST', { content: content.toString('base64'), encoding: 'base64' });
      tree.push({ path: `${folder}/${name}`, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const nextTree = await api('/git/trees', 'POST', { base_tree: previous.tree.sha, tree });
    const commit = await api('/git/commits', 'POST', { message: `Add condolence ${entry.id}`, tree: nextTree.sha, parents: [head.object.sha] });
    try { await api(`/git/refs/heads/${branch}`, 'PATCH', { sha: commit.sha, force: false }); return; }
    catch (error) { if (![409, 422].includes(error.status) || attempt === 3) throw error; }
  }
}
module.exports = { validate, filesFor, archive, MAX_BODY };
