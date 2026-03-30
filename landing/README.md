# wisptools.io landing page

Static landing page for **wisptools.io** (main site). Deployed to Firebase Hosting site **wisptools-production**.

- **Site:** wisptools-production → wisptools.io
- **Content:** Single-page static HTML/CSS (index.html, 404.html, landing.css, logo.svg)
- **App:** WISP Management runs on a separate site → [management.wisptools.io](https://management.wisptools.io/login) (Firebase site **wisptools-management**)

Deploy from repo root: `firebase deploy --only hosting:landing`

**SEO:** `index.html` includes canonical URL, meta description/keywords, Open Graph, Twitter Card tags, and JSON-LD (`WebSite`, `Organization`, `SoftwareApplication`). For richer social previews, consider adding a PNG `og:image` (1200×630) and pointing `og:image` / `twitter:image` to it.
