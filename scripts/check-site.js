#!/usr/bin/env node
// Offline production integrity checks; no third-party services or network required.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { URL } = require('node:url');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
function read(relative) { return fs.readFileSync(path.join(dist, relative), 'utf8'); }
function exists(relative) { return fs.existsSync(path.join(dist, relative)); }

assert.ok(exists('index.html'), 'Built homepage is missing');
assert.ok(exists('robots.txt'), 'robots.txt is not deployed');
assert.ok(exists('sitemap.xml'), 'sitemap.xml is not deployed');
assert.ok(exists('_redirects'), 'Netlify redirects are not deployed');
assert.ok(exists('constellations/index.html'), 'Constellations page is not in the production build');
assert.ok(exists('Images/Sonexial_Constellations_Optimized.webp'), 'Constellations artwork was not copied into the production build');
assert.ok(!exists('blog/index.html'), 'Retired Content Vault was copied to the production build');
const constellations = read('constellations/index.html');
assert.match(constellations, /<h1 id="constellations-title">When Knowledge Becomes Accessible, What Becomes Possible\?<\/h1>/);
assert.match(constellations, /<p class="constellations-subtitle">Introducing Sonexial Constellations<\/p>/);
assert.match(constellations, /<p>This project began with a concern about books\.<\/p>/);
assert.doesNotMatch(constellations, /###/);
assert.match(constellations, /<link rel="canonical" href="https:\/\/sonexial\.com\/constellations\/"/);

const robots = read('robots.txt');
assert.match(robots, /Sitemap:\s*https:\/\/sonexial\.com\/sitemap\.xml/i);
assert.match(robots, /User-agent:\s*\*/i);

const sitemap = read('sitemap.xml');
const locs = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), m => m[1]);
assert.ok(locs.length >= 1, 'No sitemap URLs');
for (const loc of locs) {
  const url = new URL(loc);
  assert.equal(url.origin, 'https://sonexial.com', `Off-site sitemap entry: ${loc}`);
  const pathname = decodeURIComponent(url.pathname);
  assert.ok(!pathname.includes('..'), `Unsafe path in sitemap: ${loc}`);
  const candidates = pathname === '/' ? ['index.html'] : [
    pathname.replace(/^\//, '') + '.html',
    pathname.replace(/^\//, '').replace(/\/$/, '') + '/index.html',
    pathname.replace(/^\//, '')
  ];
  assert.ok(candidates.some(exists), `No built file for sitemap URL ${loc}`);
}
const home = read('index.html');
const css = home.match(/href="\/(static\/styles\.[a-f0-9]+\.css)"/);
const js = home.match(/src="\/(static\/script\.[a-f0-9]+\.js)"/);
assert.ok(css && exists(css[1]), 'Hashed CSS missing or not referenced');
assert.ok(js && exists(js[1]), 'Hashed JavaScript missing or not referenced');

const redirects = read('_redirects');
for (const oldRoute of ['/metadata-kit', '/bisac-kit', '/ad-copy-suite']) {
  assert.ok(redirects.split(/\r?\n/).some(line => line.startsWith(oldRoute + ' ') && / 301!?\s*$/.test(line)), `Retired route missing redirect: ${oldRoute}`);
}
console.log(`Site integrity passed: ${locs.length} sitemap URLs and production assets verified.`);
