#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const assetDirs = ['Images', 'assets', 'Audio', 'Intake'];
const rootFiles = [
    '404.html',
    '_redirects',
    'about.html',
    'ad-copy-suite.html',
    'bisac-kit.html',
    'calculator.html',
    'cover-design-audit.html',
    'index.html',
    'metadata-kit.html',
    'robots.txt',
    'sitemap.xml',
    'website-seo-audit.html'
];
const scriptFiles = ['calculator.js'];

function removeDir(target) {
    fs.rmSync(target, { recursive: true, force: true });
}

function copyPath(from, to) {
    if (!fs.existsSync(from)) return;
    fs.cpSync(from, to, { recursive: true });
}

function rewriteHtml(filePath) {
    let html = fs.readFileSync(filePath, 'utf8');
    html = html.replace(/href="\/?styles\.css"/g, 'href="/styles.min.css"');
    html = html.replace(/src="\/?script\.js"/g, 'src="/script.min.js"');
    fs.writeFileSync(filePath, html);
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

copyPath(path.join(root, 'styles.css'), path.join(dist, 'styles.min.css'));
copyPath(path.join(root, 'script.js'), path.join(dist, 'script.min.js'));
copyPath(path.join(root, 'styles.css'), path.join(dist, 'styles.css'));
copyPath(path.join(root, 'script.js'), path.join(dist, 'script.js'));

const htmlFiles = fs.readdirSync(dist).filter(file => file.endsWith('.html'));
for (const file of htmlFiles) {
    const htmlPath = path.join(dist, file);
    rewriteHtml(htmlPath);
}

console.log(`Built ${dist}`);
