const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '.local-condolences');
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('memorialMusicPreference', 'silent'));
  await page.route('https://formspree.io/**', route => { throw new Error('Unexpected real email attempt'); });
});
async function fill(page) {
  await page.locator('#name').fill('Local Review Visitor');
  await page.locator('#message').fill('A test memory for local review only.');
  await page.locator('#consent').check();
}
async function draw(page) {
  const box = await page.locator('#signaturePad').boundingBox();
  await page.mouse.move(box.x + 30, box.y + 30); await page.mouse.down();
  await page.mouse.move(box.x + 130, box.y + 70, { steps: 12 }); await page.mouse.up();
}
test('draw, clear, preserve after resize, and save text plus PNG without email', async ({ page }) => {
  await page.goto('/condolences.html'); await fill(page);
  await page.locator('#signaturePad').scrollIntoViewIfNeeded(); await draw(page);
  await expect(page.locator('#signatureStatus')).toHaveText('Signature added');
  await page.locator('#clearSignature').click(); await expect(page.locator('#signatureStatus')).toHaveText('Sign here');
  await draw(page);
  const before = await page.locator('#signaturePad').evaluate(c => c.toDataURL());
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('#signaturePad').evaluate(c => c.toDataURL())).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const request = page.waitForRequest(r => r.url().endsWith('/api/condolences') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Sign the Register', exact: true }).click();
  const id = (await request).postDataJSON().id;
  await expect(page.locator('#formStatus')).toContainText('Preview saved');
  expect(await fs.readFile(path.join(root, id, 'message.txt'), 'utf8')).toContain('Local Review Visitor');
  expect((await fs.readFile(path.join(root, id, 'signature.png'))).subarray(1, 4).toString()).toBe('PNG');
});
test('signature is optional and archive directories are not served', async ({ page, request }) => {
  await page.goto('/condolences.html'); await fill(page);
  const sent = page.waitForRequest(r => r.url().endsWith('/api/condolences') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Sign the Register', exact: true }).click();
  const id = (await sent).postDataJSON().id;
  await expect(page.locator('#formStatus')).toContainText('Preview saved');
  await expect(fs.access(path.join(root, id, 'signature.png'))).rejects.toThrow();
  expect((await request.get(`/.local-condolences/${id}/message.txt`)).status()).toBe(404);
  expect((await request.get('/.git/config')).status()).toBe(404);
});
test('failed archive preserves message and signature and retry uses same reference', async ({ page }) => {
  let first;
  await page.route('**/api/condolences', async route => {
    if (route.request().method() === 'GET') return route.continue();
    if (!first) { first = route.request().postDataJSON().id; return route.fulfill({ status: 503, json: { error: 'Unavailable' } }); }
    expect(route.request().postDataJSON().id).toBe(first); return route.continue();
  });
  await page.goto('/condolences.html'); await fill(page); await page.locator('#signaturePad').scrollIntoViewIfNeeded(); await draw(page);
  await page.getByRole('button', { name: 'Sign the Register', exact: true }).click();
  await expect(page.locator('#formStatus')).toContainText('could not save');
  await expect(page.locator('#message')).not.toHaveValue('');
  await expect(page.locator('#signatureStatus')).toHaveText('Signature added');
  await page.getByRole('button', { name: 'Sign the Register', exact: true }).click();
  await expect(page.locator('#formStatus')).toContainText('Preview saved');
});
test('email failure retries only email after archive succeeds', async ({ page }) => {
  let archives = 0, emails = 0;
  await page.route('**/api/condolences', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { preview: false, siteKey: 'test' } });
    archives++; return route.fulfill({ json: { saved: true } });
  });
  await page.route('https://challenges.cloudflare.com/**', route => route.fulfill({ contentType: 'application/javascript', body: 'window.turnstile={render:()=>1,getResponse:()=>"test",reset:()=>{}}' }));
  await page.route('https://formspree.io/**', route => { emails++; return route.fulfill({ status: emails === 1 ? 500 : 200, json: {} }); });
  await page.goto('/condolences.html'); await fill(page);
  await page.getByRole('button', { name: 'Sign the Register', exact: true }).click();
  await expect(page.locator('#formStatus')).toContainText('entry is saved');
  await page.getByRole('button', { name: 'Sign the Register', exact: true }).click();
  await expect(page.locator('#formStatus')).toContainText('have been received');
  expect(archives).toBe(1); expect(emails).toBe(2);
});
