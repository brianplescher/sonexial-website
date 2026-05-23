# Sonexial Website

Static marketing site for Sonexial, including the homepage, product pages, intake forms, blog pages, and the Amazon book ad profit calculator.

## Project Structure

```text
Sonexial-Website/
├── index.html
├── 404.html
├── calculator.html
├── ad-copy-suite.html
├── bisac-kit.html
├── cover-design-audit.html
├── metadata-kit.html
├── website-seo-audit.html
├── styles.css
├── script.js
├── netlify.toml
├── sitemap.xml
├── robots.txt
├── Intake/
├── Images/
├── assets/
├── blog/
├── scripts/
└── dist/
```

## Current Features

- Static HTML pages for the homepage, product offers, blog, intake forms, and 404 page.
- Shared global styling in `styles.css`.
- Shared browser behavior in `script.js`.
- Calculator-specific behavior in `scripts/calculator.js`.
- Netlify deployment configured through `netlify.toml`.
- Production build output generated into `dist/`.
- SEO support through canonical tags, structured data, `sitemap.xml`, and `robots.txt`.
- Accessibility basics including semantic sections, skip link, ARIA labels, FAQ accordion states, and keyboard-friendly controls.
- Google Analytics 4 tracking with CTA and outbound link events.

## Development

Install dependencies:

```bash
npm install
```

Start a local static server:

```bash
npm start
```

Build the production site:

```bash
npm run build
```

The production build writes to:

```text
dist/
```

## Build Pipeline

`npm run build` runs `scripts/build.js`, which:

1. Clears and recreates `dist/`.
2. Copies root HTML files, `sitemap.xml`, `robots.txt`, `_redirects`, and static asset folders.
3. Minifies `styles.css` to `dist/styles.min.css`.
4. Minifies `script.js` to `dist/script.min.js`.
5. Rewrites root HTML files in `dist/` to reference the minified CSS and JavaScript.
6. Minifies root HTML files in `dist/`.

Netlify is configured to run the build and publish `dist/`.

## Testing

Run the full test suite:

```bash
npm test
```

Individual checks:

```bash
npm run test:html
npm run test:css
npm run test:js
npm run test:a11y
npm run test:links
```

Lint configuration lives in:

- `eslint.config.js`
- `stylelint.config.js`

## Deployment

Netlify settings are defined in `netlify.toml`:

- Build command: `npm run build`
- Publish directory: `dist`
- Redirects for checklist downloads, Gumroad optimization route, and 404 handling.
- Security headers on all routes.
- Cache headers for HTML, CSS, JavaScript, images, and downloadable assets.

Deploy preview:

```bash
npm run deploy:preview
```

Production deploy:

```bash
npm run deploy
```

## SEO Files

- `sitemap.xml` lists the homepage, product pages, blog hub, blog articles, and calculator page.
- `robots.txt` allows crawlers and points to the sitemap.
- Product and blog pages use canonical URLs.
- The homepage includes Organization, Person, and FAQ structured data.

## Maintenance Notes

- Keep `sitemap.xml` updated when adding or removing public pages.
- Keep `scripts/build.js` updated when adding root-level pages that should be deployed.
- Use versioned or minified production assets through the build pipeline.
- Run `npm test` before production deployments.
