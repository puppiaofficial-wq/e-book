# eBook Studio

**버전 2.1.0** — 내려받기 전 확인용. 관리자 화면 왼쪽 아래와 실행 창 맨 윗줄에
같은 번호가 보이면 최신 버전이 돌고 있는 것입니다.

A self-hosted digital-catalog platform: drop in a PDF, get a fast web viewer you
can send to buyers, embed on your site, and measure.

It replaces the classic Flash-era e-catalog stack (Windows desktop converter +
PHP/ASP/JSP solution folder + FTP uploads + separate PC and mobile skins) with a
single Node.js service and one modern, responsive viewer.

```
PDF  ──►  server-side conversion (MuPDF + sharp)  ──►  WebP page set + text + contents
                                                          │
                              ┌───────────────────────────┼───────────────────────────┐
                              ▼                           ▼                           ▼
                     /b/<slug>  viewer          /embed/<slug>  iframe          /s/<token>  buyer link
```

## What it does

**Conversion** — server-side, no desktop tool, no Windows.
* PDF pages rendered once and encoded to three WebP sizes (view / zoom / thumbnail).
* Double-page spreads are detected and split into single pages automatically.
* Table of contents imported from the PDF bookmarks.
* Hyperlinks inside the PDF become clickable hotspots.
* Text layer extracted for full-text search.
* Page images (JPG/PNG) can be imported instead of a PDF.

**Viewer** — one responsive viewer for every device, all labels in English.
* Realistic 3D page turn on desktop, drag-to-turn with your finger, slide on phones.
* Two-page spread on wide screens, single page on phones, decided automatically.
* Contents panel, full-text search with in-page highlighting, thumbnail grid.
* Click anywhere on a page to magnify that spot, drag to move around it, click
  again to come back. Magnification is capped at what the artwork can fill, so
  small print stays crisp rather than smearing; where the pages are vector art
  the server re-renders the region in view for detail beyond the stored image.
* Clickable link areas, deep links (`#p=12`), keyboard shortcuts, fullscreen.
* Share sheet with copy link, email, WhatsApp, LinkedIn and a QR code.
* Dark or light theme, your accent colour and logo.

**Sharing with buyers** — the core use case.
* Per-buyer share links (`/s/<token>`) with an optional access code, an expiry
  date, a maximum number of opens, and per-link PDF download control.
* Each link is tracked separately, and can be revoked without affecting others.
* Share links keep working while a catalog is still unpublished, so buyers can
  preview before launch.

**Publishing on the web**.
* Direct viewer URL with a stable, editable slug.
* Copy-paste `<iframe>` snippet, previewed live in the admin console.
* Public library page grouping catalogs into collections.
* Open Graph tags and a cover image, so pasted links render a preview card.
* Visibility per catalog: public, unlisted, or password protected, plus
  start/end dates for seasonal catalogs.

**Insights** — first-party, cookie-free.
* Opens, unique readers, pages read, downloads, most-read pages, share-link
  performance, referrers and device split.

## Requirements

* Node.js 20.11 or newer
* About 3-6 MB of disk per 60-page catalog

No database, no PHP, no ImageMagick, no Ghostscript. MuPDF runs as WebAssembly.

## Install

The fastest route on a desktop is the one-click launcher: drop your PDFs into
`catalogs/`, then run `start.bat` (Windows) or `start.command` (macOS). It
installs dependencies on first run, imports anything new in `catalogs/`, starts
the server and opens the admin console. A Korean step-by-step walkthrough lives
in [`docs/QUICKSTART-ko.md`](docs/QUICKSTART-ko.md).

Manually:

```bash
npm install
cp .env.example .env          # set PUBLIC_BASE_URL at least
npm run autoimport            # optional: import every PDF in ./catalogs
npm start
```

Open `http://localhost:8080/admin` and create the admin account on first run.
Setting `ADMIN_EMAIL` and `ADMIN_PASSWORD` creates it automatically instead,
which is what you want in a container.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port, default `8080` |
| `PUBLIC_BASE_URL` | Public origin used to build share links, embeds and QR codes |
| `EBOOK_DATA_DIR` | Where catalogs and analytics live, default `./data` |
| `SESSION_SECRET` | Optional fixed secret; otherwise generated into `data/.secret` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Optional first-run admin bootstrap |

Lost the password: `npm run reset-admin -- you@example.com newpassword`.

## Daily workflow

1. **Upload** — drag a PDF onto the admin dashboard. Conversion progress streams live.
2. **Check** — the contents come from the PDF bookmarks; adjust them under *Contents*.
3. **Design** — theme, accent colour, logo, cover-alone, page numbering offset.
4. **Publish** — set visibility and, if needed, the availability window.
5. **Send** — create one share link per buyer under *Share with buyers*.
6. **Embed** — copy the iframe snippet under *Embed on your site*.
7. **Measure** — *Insights* shows opens, unique readers and the most-read pages.

Publish without a server: the *Embed on your site* tab builds the catalog into
a single `.zip` of HTML, CSS, JS and images that works on any static host, with
contents, search, links and thumbnails intact - drop it straight onto Cloudflare
Pages. `npm run export` does the same from the command line, where `--zoom`
re-renders the zoom tier at a chosen width for catalogs whose PDF holds more
detail than the stored images do.

Walkthroughs: [`docs/CLOUDFLARE-ko.md`](docs/CLOUDFLARE-ko.md) (recommended),
[`docs/CAFE24-ko.md`](docs/CAFE24-ko.md), and
[`docs/HOSTING-ko.md`](docs/HOSTING-ko.md) for the trade-offs against running
the server.

Bulk or scripted imports:

```bash
npm run import -- ./catalogs/2026fw.pdf --title "2026 F/W" --collection "2026" --publish
```

## Deployment

Run it behind a reverse proxy that terminates TLS and forwards
`X-Forwarded-Proto` and `X-Forwarded-Host` (the app trusts these to build
absolute URLs). Everything the app owns lives in `EBOOK_DATA_DIR`, so backups
are a copy of that directory.

```
# nginx
location / {
  proxy_pass http://127.0.0.1:8080;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-Host $host;
  client_max_body_size 512m;
}
```

HTTPS matters for buyer links: the reader access cookie is issued with
`SameSite=None` only over HTTPS, which is what lets a protected catalog work
inside an embedded iframe.

## Layout

```
server/
  index.js      HTTP app and route wiring
  convert.js    PDF -> WebP page set, text, contents, links
  store.js      JSON-file library (books, collections, shares, settings)
  access.js     visibility, share-link and password rules
  auth.js       admin sessions and reader grants
  analytics.js  append-only event log and aggregation
  jobs.js       conversion queue with server-sent-event progress
  pages.js      server-rendered viewer, gate and library pages
  routes/       public.js (readers) and admin.js (console API)
public/
  viewer/       the reader: viewer.js + viewer.css, no dependencies
  admin/        the console: admin.js + admin.css, no build step
scripts/        import.js, reset-admin.js
data/           catalogs, page images, analytics (git-ignored)
```

## Data model

`data/library.json` holds catalogs, collections, share links and settings.
Each catalog owns `data/books/<id>/` with `source.pdf`, `pages/`, `zoom/`,
`thumbs/`, `text.json` and `meta.json`. Deleting a catalog deletes its folder.

## Notes

* Page images are served with a one-year immutable cache and a version query
  string, so a re-import busts the cache without a purge.
* Search runs on the server against the extracted text and returns line boxes,
  which is what lets the viewer highlight the hit on the page.
* Zoom is one fixed step, sized so that one image pixel covers at most one CSS
  pixel: the page is never stretched past the resolution the file actually
  holds. At the step the magnified page is laid out at its real pixel size
  rather than transformed, so the browser draws the large image instead of
  stretching a composited layer taken at reading size.
* Extra zoom detail is rendered on demand from the PDF for pages that are
  vector art and so have more to give than the stored image holds. Requests are
  quantised to a grid and cached for a week. Flattened artwork is already at its
  ceiling, so it is served from the stored image and never upscaled.
* Analytics store a daily-rotating hash of IP and user agent, never the raw
  values, and set no tracking cookie.
