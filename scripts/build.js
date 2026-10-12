// Builds every version of the app into dist/: run `npm run build` (or `node scripts/build.js`).
//   dist/mandarin-flashcards.html  single offline file (double-click to open)
//   dist/site/                     GitHub Pages version (index.html, sw.js, manifest, icons); deployed by CI
//   dist/artifact.html             version for the claude.ai link (no <html>/<head>/<body> wrapper)
// The single file and the site are checked with scripts/verify.js; the build fails if a check fails.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const rel = (...p) => path.join(SRC, ...p);
const dataPath = (...p) => path.join(ROOT, 'data', ...p);
const read = (p) => fs.readFileSync(p, 'utf8');

const EXTRAS = ['你好', '你们', '他们']; // common words outside the HSK 1-2 list, filed under HSK 1

// Cloud sync is wired into the GitHub Pages build only: the single-file build opens over
// file:// and dist/artifact.html runs inside a cross-origin iframe, so neither can receive
// a magic-link redirect. The anon key is public by design -- RLS is the boundary, and the
// service_role key must never appear here. src/sync-config.json may be absent, in which
// case sync is simply disabled and every build still succeeds.
let SYNC_CONFIG = null;
const syncFile = rel('sync-config.json');
if (fs.existsSync(syncFile)) {
  SYNC_CONFIG = JSON.parse(read(syncFile));
  if (!SYNC_CONFIG.url || !SYNC_CONFIG.anonKey) throw new Error('src/sync-config.json needs both url and anonKey');
  if (/service_role|sb_secret/.test(JSON.stringify(SYNC_CONFIG))) throw new Error('src/sync-config.json must not contain a service_role key');
}

// ---------- data ----------
const list = (n) => JSON.parse(read(dataPath('lists', 'hsk' + n + '.json'))).map((e) => e.simplified);
const L1 = list(1), L2 = list(2), L3 = list(3);
const levelOf = (w) => (L1.includes(w) || EXTRAS.includes(w) ? 1 : L2.includes(w) ? 2 : L3.includes(w) ? 3 : 0);

// HSK 1-2: [hanzi, pinyin, en, hu, exZh, exEn, exHu, ...] with sentence pinyin in a separate map
const sentPy = require(dataPath('hsk12', 'sentence-pinyin.js'));
const fromV = (e) => {
  const ex = [];
  for (let k = 4; k < e.length; k += 3) {
    if (!sentPy[e[k]]) throw new Error('No pinyin for sentence: ' + e[k]);
    ex.push({ zh: e[k], py: sentPy[e[k]], en: e[k + 1], hu: e[k + 2] });
  }
  return { zh: e[0], py: e[1], en: e[2], hu: e[3], ex };
};
// HSK 3: [hanzi, pinyin, en, hu, exZh, exPy, exEn, exHu, ...]
const fromH3 = (e) => {
  const ex = [];
  for (let k = 4; k < e.length; k += 4) ex.push({ zh: e[k], py: e[k + 1], en: e[k + 2], hu: e[k + 3] });
  return { zh: e[0], py: e[1], en: e[2], hu: e[3], ex };
};

let cards = [1, 2, 3, 4, 5, 6].flatMap((i) => require(dataPath('hsk12', 'v' + i + '.js'))).map(fromV);
const h3 = {};
fs.readdirSync(dataPath('hsk3')).filter((f) => /\.json$/.test(f)).forEach((f) => {
  JSON.parse(read(dataPath('hsk3', f))).forEach((e) => {
    if (h3[e[0]]) throw new Error('HSK 3 word defined twice: ' + e[0]);
    h3[e[0]] = fromH3(e);
  });
});
L3.forEach((w) => {
  if (!h3[w]) throw new Error('HSK 3 word without a card: ' + w);
  cards.push(h3[w]);
});
cards = cards.map((c) => {
  const lv = levelOf(c.zh);
  if (!lv) throw new Error('Word is not in the HSK 1-3 lists: ' + c.zh);
  return Object.assign({ lv }, c);
});

// Optional extras, each added to the cards or the extra-data block when its file exists:
//   data/freq.json    frequency rank (rk) and share per million words (fq) from wordfreq, CC BY-SA 4.0
//   data/topics.json  one topic per word (tp) and the topic list
//   data/hints.json   memory hints for single characters
const optJson = (p) => (fs.existsSync(p) ? JSON.parse(read(p)) : null);
const FREQ = optJson(dataPath('freq.json'));
const TOPICS = optJson(dataPath('topics.json'));
const HINTS = optJson(dataPath('hints.json'));
//   data/changelog.json  release notes for the in-app "What's new" sheet, newest first
const CHANGELOG = optJson(dataPath('changelog.json'));
if (CHANGELOG) {
  (CHANGELOG.releases || []).forEach((r) => {
    if (!r.version || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !r.title || !Array.isArray(r.groups) || !r.groups.length) throw new Error('Malformed changelog release ' + JSON.stringify(r).slice(0, 80));
    r.groups.forEach((g) => { if (!Array.isArray(g.items) || !g.items.length) throw new Error('Empty changelog group in ' + r.version); });
  });
}
//   data/ladder.json  can-do steps: { rungs: [{ id, zh, py, en, hu, words: [headword], sentences: [example sentence] }] }
const LADDER = optJson(dataPath('ladder.json'));
if (LADDER) {
  const heads = new Set(cards.map((c) => c.zh));
  const exs = new Set([].concat(...cards.map((c) => c.ex.map((e) => e.zh))));
  const ids = new Set();
  (LADDER.rungs || []).forEach((r) => {
    if (!r.id || ids.has(r.id) || !r.zh || !r.py || !r.en || !r.hu) throw new Error('Malformed ladder rung ' + JSON.stringify(r).slice(0, 80));
    ids.add(r.id);
    if (!Array.isArray(r.words) || !r.words.length) throw new Error('Ladder rung ' + r.id + ' has no words');
    r.words.forEach((w) => { if (!heads.has(w)) throw new Error('Ladder rung ' + r.id + ': ' + w + ' is not a headword'); });
    (r.sentences || []).forEach((x) => { if (!exs.has(x)) throw new Error('Ladder rung ' + r.id + ': not an example sentence: ' + x); });
  });
}
//   data/i18n/<code>.json  extra meaning languages: { code, name, words: { headword: meaning }, sentences: { sentence: translation } }
const I18N = fs.existsSync(dataPath('i18n')) ? fs.readdirSync(dataPath('i18n')).filter((f) => /^[a-z]{2}\.json$/.test(f)).sort()
  .map((f) => JSON.parse(read(dataPath('i18n', f)))) : [];
cards = cards.map((c) => {
  const o = Object.assign({}, c);
  if (I18N.length) {
    o.tr = {};
    o.ex = c.ex.map((e) => Object.assign({}, e, { tr: {} }));
    I18N.forEach((L) => {
      if (!L.words[c.zh]) throw new Error('No ' + L.code + ' meaning for ' + c.zh);
      o.tr[L.code] = L.words[c.zh];
      o.ex.forEach((e) => {
        if (!L.sentences[e.zh]) throw new Error('No ' + L.code + ' translation for ' + e.zh);
        e.tr[L.code] = L.sentences[e.zh];
      });
    });
  }
  const f = FREQ && FREQ.words[c.zh];
  if (f && f[0]) o.rk = f[0];
  if (f && f[1]) o.fq = f[1];
  if (TOPICS) {
    const t = TOPICS.words[c.zh];
    if (!t || !TOPICS.topics.some((x) => x.id === t)) throw new Error('No valid topic for ' + c.zh);
    o.tp = t;
  }
  return o;
});

const expected = { 1: L1.length + EXTRAS.length, 2: L2.length, 3: L3.length };
const total = expected[1] + expected[2] + expected[3];
const safeJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const json = safeJson(cards);
const extraJson = safeJson({ chars: FREQ ? FREQ.chars : {}, topics: TOPICS ? TOPICS.topics : [], hints: HINTS ? HINTS.hints : {}, news: CHANGELOG ? CHANGELOG.releases : [], ladder: LADDER ? LADDER.rungs : [] });

// ---------- html ----------
// The app's source: src/index.html is the page. Its /*__STYLES__*/ and /*__SCRIPTS__*/ lines are replaced by the
// files in src/styles/ and src/js/, joined in file-name order (the numeric prefixes keep the CSS cascade and the
// script order). The scripts form the body of one function, so they share one scope.
const joinDir = (dir, ext) => fs.readdirSync(rel(dir)).filter((f) => f.endsWith(ext)).sort()
  .map((f) => read(rel(dir, f)).replace(/\r\n/g, '\n')).join('');
const page = read(rel('index.html')).replace(/\r\n/g, '\n');
['/*__STYLES__*/\n', '/*__SCRIPTS__*/\n'].forEach((m) => {
  if (page.split(m).length !== 2) throw new Error('Expected one ' + m.trim() + ' line in src/index.html');
});
const template = page.replace('/*__STYLES__*/\n', () => joinDir('styles', '.css')).replace('/*__SCRIPTS__*/\n', () => joinDir('js', '.js'));
const buildId = crypto.createHash('sha1').update(template).update(json).update(extraJson).digest('hex').slice(0, 10);
// Shown in Settings, so you can tell which version a device runs. The build id is a content hash
// and also names the service worker cache, so it changes exactly when the app does.
const buildDate = new Date().toISOString().slice(0, 10);

function render(siteHead, syncConfig) {
  const parts = template.split('__VOCAB_JSON__');
  if (parts.length !== 2) throw new Error('Expected one __VOCAB_JSON__ placeholder, found ' + (parts.length - 1));
  let html = parts[0] + json + parts[1];
  html = html.replace('__EXTRA_JSON__', function () { return extraJson; });
  // Function replacement, so a `$` anywhere in the injected config cannot be read as a
  // String.replace pattern ($&, $1, …).
  html = html.replace('__EXPECTED_TOTAL__', String(total))
    .replace('__EXPECTED_LEVELS__', JSON.stringify(expected))
    .replace('__SYNC_CONFIG__', function () { return syncConfig ? JSON.stringify(syncConfig) : 'null'; })
    .replace('<!--__SITE_HEAD__-->', siteHead)
    .replace('__BUILD_DATE__', buildDate)
    .replace('__BUILD_ID__', buildId);
  if (/__EXPECTED_|__SITE_HEAD__|__VOCAB_JSON__|__SYNC_CONFIG__|__BUILD_|__EXTRA_JSON__/.test(html)) throw new Error('Unreplaced placeholder in template');
  return html;
}

function verify(file) {
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'verify.js'), file], { stdio: 'pipe' });
  } catch (e) {
    process.stdout.write(String(e.stdout || ''));
    throw new Error('Verification failed for ' + file);
  }
}

// 1. single offline file
fs.mkdirSync(DIST, { recursive: true });
const single = path.join(DIST, 'mandarin-flashcards.html');
fs.writeFileSync(single, render('', null), 'utf8');
verify(single);

// 2. artifact version: the claude.ai viewer adds its own document wrapper
let art = render('', null);
const head = art.indexOf('<title>');
if (!/^<!DOCTYPE html>\s*<html lang="en">\s*<head>\s*<meta charset="UTF-8">/.test(art.slice(0, head))) throw new Error('Unexpected document head');
art = art.slice(head).replace(/<\/head>\s*<body>\s*/, '').replace(/<\/body>\s*<\/html>\s*$/, '');
if (/<\/?(html|head|body)\b|<!DOCTYPE/i.test(art.replace(/<script[\s\S]*?<\/script>/g, ''))) throw new Error('Document wrapper tags remain in artifact');
fs.writeFileSync(path.join(DIST, 'artifact.html'), art, 'utf8');

// 3. GitHub Pages site with offline support
const siteDir = path.join(DIST, 'site');
fs.mkdirSync(siteDir, { recursive: true });
{
  const siteHead = [
    '<link rel="manifest" href="manifest.webmanifest">',
    '<link rel="apple-touch-icon" href="icon-180.png">',
    '<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '<meta name="apple-mobile-web-app-title" content="Mandarin HSK">',
    '<script>if (\'serviceWorker\' in navigator && (location.protocol === \'https:\' || location.hostname === \'localhost\' || location.hostname === \'127.0.0.1\')) { window.addEventListener(\'load\', function () { navigator.serviceWorker.register(\'sw.js\').catch(function () {}); }); }</script>'
  ].join('\n');
  fs.writeFileSync(path.join(siteDir, 'index.html'), render(siteHead, SYNC_CONFIG), 'utf8');
  verify(path.join(siteDir, 'index.html'));
  fs.writeFileSync(path.join(siteDir, 'sw.js'), read(rel('pwa/sw.js')).replace('__BUILD_ID__', buildId), 'utf8');
  ['manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'].forEach((f) => fs.copyFileSync(rel('pwa', f), path.join(siteDir, f)));
}

// content snapshot for tools/validate.py
fs.mkdirSync(path.join(ROOT, '.validation'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.validation', 'content.json'), JSON.stringify(cards.map((c, i) => Object.assign({ n: i + 1 }, c))), 'utf8');

const sentences = new Set(cards.flatMap((c) => c.ex.map((e) => e.zh))).size;
console.log('Built ' + cards.length + ' words (HSK 1: ' + expected[1] + ', HSK 2: ' + expected[2] + ', HSK 3: ' + expected[3] + '), ' +
  sentences + ' unique example sentences, build ' + buildId + '.');
console.log('  dist/mandarin-flashcards.html\n  dist/artifact.html\n  dist/site/ (index.html, sw.js, manifest, icons)');
console.log('  cloud sync: ' + (SYNC_CONFIG ? SYNC_CONFIG.url + ' (site build only)' : 'disabled — src/sync-config.json is missing'));
