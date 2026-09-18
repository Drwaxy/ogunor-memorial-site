# In Loving Memory — Late Pa. Hyacinth Nwafor Ogunor

A memorial website built from the Ogunor family brand kit. Plain HTML/CSS/JS — no build step, no framework, so it's easy to edit and free to host.

## Pages

| Page | File |
|---|---|
| Home | `index.html` |
| Life Story | `biography.html` |
| Photo Gallery | `gallery.html` |
| Tributes | `tributes.html` |
| Video Gallery | `videos.html` |
| Funeral Schedule | `schedule.html` |
| Live Stream | `livestream.html` |
| Condolence Register | `condolences.html` |

Shared header/footer live in `partials/nav.html` and `partials/footer.html` — edit once, it updates on every page. Shared styling is in `css/style.css` (all brand colors/fonts are CSS variables at the top of the file).

## Photos — done

All 14 photos from `Dad_s Pictures/` have been rotated (4 vintage scans were sideways), optimized, and placed into `assets/photos/`:

- `hero.jpg`, `portrait.jpg`, `biography.jpg` — the three studio portraits used on Home and Life Story
- `gallery-1.jpg` through `gallery-11.jpg` — the full Photo Gallery, roughly chronological (his wedding day → middle age → family weddings with his sons → recent playful portrait)

To add more photos later: drop a new file into `assets/photos/`, then copy a `<figure class="gallery-item">` block in `gallery.html` and point it at the new filename.

## Tributes — done

All 34 tributes from `Tributes.txt` were transcribed into `js/tributes-data.js` (one object per tribute: author, relationship, title, paragraphs) and rendered on `tributes.html` with filter tabs (Sons / Daughters / Daughters-in-Law / Grandchildren / Extended Family & Friends) and an expandable "Read full tribute" toggle on each card.

**To add a new tribute later:** open `js/tributes-data.js` and copy one `{ category, relation, author, title, paragraphs }` block — no other file needs to change.

## 2. Connect the Condolence Register form

The form currently points at a placeholder and will show an error if submitted as-is. To make it actually deliver messages to an email inbox:

1. Go to [formspree.io](https://formspree.io) and create a free account.
2. Create a new form, copy the endpoint it gives you (looks like `https://formspree.io/f/xxxxabcd`).
3. In `condolences.html`, find `action="https://formspree.io/f/YOUR_FORM_ID"` and replace `YOUR_FORM_ID` with your real ID.

Free tier handles 50 submissions/month, which should cover this use case. If you expect more, use Formspree's Gold tier or switch to a Google Form embed instead — ask and I'll wire that up.

## 3. Add real videos / the live stream link

- **Video Gallery** (`videos.html`): once you have a YouTube link, replace a `.video-placeholder` block with `<iframe src="https://www.youtube.com/embed/VIDEO_ID" allowfullscreen loading="lazy"></iframe>` (there's a comment in the file showing exactly where).
- **Live Stream** (`livestream.html`): same pattern — on the day of the service, swap the placeholder for the YouTube/Facebook Live embed. The countdown timer target date is set via `data-target` on the `#countdown` div in that file.

## Preview locally

From this folder:

```
npx serve .
```

Then open the URL it prints (usually `http://localhost:3000`).

## Background memorial music

Place the final audio file at the project root as `memorial-music.mp3`. The shared music controller in `js/main.js` uses `/memorial-music.mp3`, starts at 25% volume, loops continuously, and remembers the visitor's choice and playback position for the current browser session.

Preview through a local web server rather than opening the HTML files with `file://`, because the root-relative audio URL is resolved by the web server.

## Deploying to Vercel (free)

1. Install the Vercel CLI once: `npm install -g vercel`
2. From this folder, run: `vercel`
3. Follow the prompts (link/create a Vercel account, accept defaults — it's a static site, no build command needed).
4. Vercel gives you a live URL immediately, e.g. `ogunor-memorial-site.vercel.app`.
5. For every future update: edit the files, then run `vercel --prod` again to push the change live.

**No-CLI alternative:** push this folder to a GitHub repo, then on [vercel.com](https://vercel.com) choose "Add New Project" → import the repo → deploy. Every push to `main` auto-deploys.

### Adding a custom domain later

If you later buy `hyacinthogunor.com` (or similar) from any registrar (Namecheap, GoDaddy, etc. — roughly $12–15/year):

1. In the Vercel project dashboard, go to Settings → Domains → add the domain.
2. Vercel shows you 1–2 DNS records to add at your registrar (usually an `A` record and a `CNAME`).
3. Add them in your registrar's DNS settings; HTTPS is issued automatically within a few minutes.

## Notes

- All colors/fonts match the brand kit exactly (deep wine `#641A18`, gold `#C8A24A`, cream `#FBF8F1`, etc. — see `:root` in `css/style.css`).
- The site is fully responsive (tested at mobile/tablet/desktop widths) and keyboard/screen-reader accessible (focus states, alt text, ARIA labels, semantic headings).
- No visitor data is stored anywhere except whatever Formspree/Google Forms captures for the guestbook — there is no database or backend to maintain.
