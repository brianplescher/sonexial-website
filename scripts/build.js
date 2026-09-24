#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const assetDirs = ['Images', 'assets', 'Audio', 'Intake', 'blog', 'tools'];
const rootFiles = fs.readdirSync(root).filter(file => {
    const ext = path.extname(file);
    return file === '_redirects' || ['.html', '.txt', '.xml'].includes(ext);
});
const scriptFiles = ['calculator.js'];

function removeDir(target) {
    fs.rmSync(target, { recursive: true, force: true });
}

function copyPath(from, to) {
    if (!fs.existsSync(from)) return;
    fs.cpSync(from, to, { recursive: true });
}

function contentHash(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').slice(0, 10);
}

// Hashed filenames let Netlify serve CSS/JS with a one-year immutable cache without
// stranding visitors on a stale build.
function rewriteHtml(filePath, assets) {
    let html = fs.readFileSync(filePath, 'utf8');
    html = html.replace(/href="(?:\.\.\/|\/)?styles\.css"/g, `href="/${assets.css}"`);
    html = html.replace(/src="(?:\.\.\/|\/)?script\.js"/g, `src="/${assets.js}"`);
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
const assets = {
    css: `static/styles.${contentHash(path.join(root, 'styles.css'))}.css`,
    js: `static/script.${contentHash(path.join(root, 'script.js'))}.js`
};

copyPath(path.join(root, 'styles.css'), path.join(dist, assets.css));
copyPath(path.join(root, 'script.js'), path.join(dist, assets.js));

const htmlFiles = getAllHtmlFiles(dist);
for (const htmlPath of htmlFiles) {
    rewriteHtml(htmlPath, assets);
}

console.log(`Built ${dist} (${assets.css}, ${assets.js})`);
