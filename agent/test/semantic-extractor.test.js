const test = require('node:test');
const assert = require('node:assert/strict');

const { buildSource, validateProfile, extractSemantic, MAX_SOURCE_CHARS } = require('../src/semantic-extractor');

test('validateProfile enforces caps, enums, and drops unknown fields', () => {
    const profile = validateProfile({
        primary_genres: ['Epic Fantasy', 'Romantasy', 'Dark Fantasy', 'Horror'],
        top_tropes: ['Enemies to Lovers', 'found_family', 'Enemies-to-Lovers', 'chosen one', 'slow burn', 'heist', 'extra'],
        themes: ['Grief', 42, ''],
        target_audience: ['YA', 'adult', 'teen', 'seniors'],
        spice_level: 7,
        short_bio: Array(80).fill('word').join(' '),
        injected: 'ignore me'
    });

    assert.deepEqual(profile.primary_genres, ['epic fantasy', 'romantasy', 'dark fantasy']);
    assert.deepEqual(profile.top_tropes, ['enemies-to-lovers', 'found-family', 'chosen-one', 'slow-burn', 'heist']);
    assert.deepEqual(profile.themes, ['grief']);
    assert.deepEqual(profile.target_audience, ['young-adult', 'adult']);
    assert.equal(profile.spice_level, null);
    assert.equal(profile.short_bio.split(' ').length, 50);
    assert.equal('injected' in profile, false);
});

test('validateProfile accepts spice 0 and numeric strings, rejects fractions', () => {
    assert.equal(validateProfile({ spice_level: 0 }).spice_level, 0);
    assert.equal(validateProfile({ spice_level: '3' }).spice_level, 3);
    assert.equal(validateProfile({ spice_level: 2.5 }).spice_level, null);
});

test('validateProfile maps a single audience string and middle grade to all-ages', () => {
    assert.deepEqual(validateProfile({ target_audience: 'Middle Grade' }).target_audience, ['all-ages']);
});

test('validateProfile tolerates garbage input', () => {
    const profile = validateProfile('not an object');
    assert.deepEqual(profile.primary_genres, []);
    assert.equal(profile.short_bio, null);
});

test('buildSource includes Book JSON-LD, skips scripts, and is capped', () => {
    const html = `<html><head><title>Jane Doe Books</title>
        <script type="application/ld+json">{"@type":"Book","name":"The Thorn Crown","genre":"Romantasy"}</script>
        </head><body><script>var secret = 1;</script><p>${'word '.repeat(5000)}</p></body></html>`;
    const source = buildSource(html);
    assert.match(source, /Title: Jane Doe Books/);
    assert.match(source, /name: The Thorn Crown \| genre: Romantasy/);
    assert.doesNotMatch(source, /secret/);
    assert.ok(source.length <= MAX_SOURCE_CHARS);
});

test('extractSemantic returns null without an LLM key', async () => {
    const saved = { a: process.env.LLM_API_KEY, b: process.env.TOGETHER_API_KEY };
    delete process.env.LLM_API_KEY;
    delete process.env.TOGETHER_API_KEY;
    try {
        assert.equal(await extractSemantic('<html><body><p>Some author page text here.</p></body></html>'), null);
    } finally {
        if (saved.a !== undefined) process.env.LLM_API_KEY = saved.a;
        if (saved.b !== undefined) process.env.TOGETHER_API_KEY = saved.b;
    }
});
