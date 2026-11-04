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
/* Option 1: 2026 Noise-to-Signal Waveform Mark paired with full-res SONEXIAL wordmark */
.home-logo {
  display: block;
  height: 56px;
  width: auto;
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
  width: 58px;
  height: 56px;
  background-image: url("/Images/logo_mark_2026.png");
  background-repeat: no-repeat;
  background-size: 136px 136px;
  background-position: -12px -38px;
  mix-blend-mode: screen;
  margin-right: 4px;
  flex-shrink: 0;
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
