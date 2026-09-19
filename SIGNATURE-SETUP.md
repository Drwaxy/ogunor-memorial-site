# Condolence signatures — review and setup

## Local review (no credentials needed)

Run `npm ci`, then `npm run dev`. Open http://127.0.0.1:8001/condolences.html.
The banner identifies the local preview. Submit with or without a signature.
Messages and PNGs are written to `.local-condolences/<reference>/` on this computer.
This folder is ignored by Git, excluded from Vercel, and never served by the preview server.
The preview sends no emails and does not write to GitHub. It binds to this computer only.
Use `npm test` for storage/validation tests and `npx playwright test` for browser checks.

## Production setup after review

The archive repository is `Drwaxy/ogunor-condolence-register`, created private with a README.
Keep it private. The API checks visibility and refuses to save into a public repository.
Create a fine-grained GitHub token restricted to this repository with Contents: read/write
and the mandatory Metadata: read permission. Do not use a broad personal token.
Put the token in Vercel's server environment, never in client code or a committed file.

Set these Vercel environment variables before deploying:

- `CONDOLENCE_GITHUB_REPO=Drwaxy/ogunor-condolence-register`
- `CONDOLENCE_GITHUB_TOKEN`: repository-scoped token
- `CONDOLENCE_ALLOWED_ORIGINS=https://ogunormemorial.com,https://www.ogunormemorial.com,https://ogunor-memorial-site.vercel.app`
- `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile widget keys,
  configured for those production hostnames. This protects the public archive endpoint
  from automated submissions without changing the Formspree plan.

The API refuses submissions until all required settings exist. It validates the
Turnstile token, action and hostname. Configure a Vercel firewall rate limit on
POST /api/condolences before launch; the code's per-instance throttle is only a
best-effort fallback and is not a distributed rate limiter.

## Saving and retrieving

Each submission uses `submissions/<random-reference>/` in the private repository:
`message.txt`, optional `signature.png`, and `receipt.json` for retry detection.
The text includes the server timestamp, name, relationship, optional email, message,
consent and reference. The PNG is decoded, validated and re-encoded on the server.
Text and image are published in one Git commit; concurrent updates retry without force-pushing.
A repeated reference with the same contents returns success without adding another entry.

After archiving succeeds, the browser sends text fields and the reference to the existing
Formspree endpoint. Images are not sent to Formspree, so its free plan is retained.
If email fails, the visitor is told the entry is already saved and may retry email.
A network timeout can leave email delivery uncertain; retries may duplicate email.
Formspree's existing submission quota and spam rules still apply.

Open the private repository on GitHub, browse submissions, and open/download each pair.
No public archive-reading API exists. Git history retains deleted files: removing a
submission from the current branch alone does not erase it from repository history.
Only grant repository access to people who should see messages, emails and signatures.

## Review boundary

Implementation is on `feature/condolence-signatures`. Do not merge or deploy until
local review is approved. Live credentials, production submission and actual iPhone
Safari drawing still need verification before launch. Automated browser tests use
local-only data and mocked external failures; they send no real condolences or emails.
