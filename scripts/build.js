#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const assetDirs = ['Images', 'assets', 'Audio', 'Intake', 'constellations', 'tools', 'diagnostic'];
const rootFiles = fs.readdirSync(root).filter(file => {
    const ext = path.extname(file);
    return file === '_redirects' || ['.html', '.txt', '.xml'].includes(ext);
});
const scriptFiles = ['calculator.js'];

const HEADER_LOGO_LOCKUP_CSS = `
/* Fine micro-dot grid in #site-header so the prominent tagline is razor sharp */
body {
  background-image: radial-gradient(circle, rgba(0, 240, 255, 0.025) 0.75px, transparent 0.75px);
  background-size: 24px 24px;
}

#site-header {
  background: rgba(5, 7, 10, 0.97) !important;
}

/* Option 1: Smaller, subtler waveform mark on left + larger, clearer SONEXIAL tagline */
.home-logo {
  display: block;
  height: 70px;
  width: auto;
  margin: -7px 0;
  mix-blend-mode: screen;
}

.home-logo-link {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  text-decoration: none;
}

.home-logo-link::before {
  content: "";
  display: block;
  width: 44px;
  height: 44px;
  background-image: url("/Images/logo_mark_2026.png");
  background-repeat: no-repeat;
  background-size: 104px 104px;
  background-position: -9px -29px;
  mix-blend-mode: screen;
  margin-right: 4px;
  opacity: 0.9;
  flex-shrink: 0;
}

/* 3D Scroll-Morphing Signal & Constellation Stage */
#sonexial-scroll-progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 2px;
  width: 0;
  background: var(--accent);
  box-shadow: 0 0 10px var(--accent);
  z-index: 1200;
  pointer-events: none;
}

#sonexial-stage {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, rgba(7, 10, 18, 0.45) 0%, rgba(0, 0, 0, 0.88) 100%);
}

#sonexial-stage canvas {
  display: block;
  width: 100%;
  height: 100%;
}

main, section, footer {
  position: relative;
  z-index: 1;
}

.hero .cafe-bg {
  opacity: 0.18;
}

.hero .cafe-content.hero-centered {
  background: radial-gradient(ellipse at center, rgba(5, 7, 11, 0.76) 0%, rgba(5, 7, 11, 0) 75%);
  border-radius: 16px;
}

.problem, .outcomes, .geo-proof, .products, .process, .testimonials, .methodology, .faq, .contact {
  background-color: rgba(8, 10, 14, 0.78);
}
`;

function removeDir(target) {
    fs.rmSync(target, { recursive: true, force: true });
}

function copyPath(from, to) {
    if (!fs.existsSync(from)) return;
    fs.cpSync(from, to, { recursive: true });
}

function contentHashBuffer(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
}

// Hashed filenames let Netlify serve CSS/JS with a one-year immutable cache without
// stranding visitors on a stale build.
function rewriteHtml(filePath, assets) {
    let html = fs.readFileSync(filePath, 'utf8');
    html = html.replace(/href="(?:\.\.\/|\/)?styles\.css"/g, `href="/${assets.css}"`);
    html = html.replace(/src="(?:\.\.\/|\/)?script\.js"/g, `src="/${assets.js}"`);
    html = html.replace(
        '"sameAs": ["https://brianplescher.com", "https://www.linkedin.com/in/brianplescher"]',
        '"sameAs": ["https://brianplescher.com", "https://www.linkedin.com/in/brianplescher", "https://www.facebook.com/profile.php?id=100064212331497"]'
    );
    fs.writeFileSync(filePath, html);
}

function getAllHtmlFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            results = results.concat(getAllHtmlFiles(fullPath));
        } else if (file.endsWith('.html')) {
            results.push(fullPath);
        }
    }
    return results;
}

removeDir(dist);
fs.mkdirSync(dist, { recursive: true });

for (const file of rootFiles) {
    copyPath(path.join(root, file), path.join(dist, file));
}

for (const dir of assetDirs) {
    copyPath(path.join(root, dir), path.join(dist, dir));
}

fs.mkdirSync(path.join(dist, 'scripts'), { recursive: true });
for (const file of scriptFiles) {
    copyPath(path.join(root, 'scripts', file), path.join(dist, 'scripts', file));
}

// Hashed bundles live under /static/ so Netlify can cache that one prefix immutably.
fs.mkdirSync(path.join(dist, 'static'), { recursive: true });
const rawCss = fs.readFileSync(path.join(root, 'styles.css'), 'utf8') + '\n' + HEADER_LOGO_LOCKUP_CSS;
const rawJs = fs.readFileSync(path.join(root, 'script.js'));

const assets = {
    css: `static/styles.${contentHashBuffer(Buffer.from(rawCss, 'utf8'))}.css`,
    js: `static/script.${contentHashBuffer(rawJs)}.js`
};

fs.writeFileSync(path.join(dist, assets.css), rawCss, 'utf8');
fs.writeFileSync(path.join(dist, assets.js), rawJs);

const htmlFiles = getAllHtmlFiles(dist);
for (const htmlPath of htmlFiles) {
    rewriteHtml(htmlPath, assets);
}

console.log(`Built ${dist} (${assets.css}, ${assets.js})`);
