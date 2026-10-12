// Asks TypeSafe's Jev model whether a fill-the-gap question has more than one right answer.
// For every word and each of its example sentences that contain it, the candidates are the
// distractors the app can draw (same rule as clozeTarget() in src/js/11-practice.js). Jev picks
// the word that fits the gap, given the translation the app shows; a distractor with a real
// share of the probability is then checked on its own (does the sentence still work with it?).
//
//   node scripts/judge.js --limit 50          trial on 50 questions spread over all levels
//   node scripts/judge.js --level 1           every HSK 1 question
//   node scripts/judge.js --dry-run           count requests and print one, without calling the API
//   node scripts/judge.js --control           five questions with a known answer: does the check flag the right ones?
//
// Options: --threshold 0.15 (distractor share that gets a second look), --model jev-latest.
// The API key comes from TYPESAFE_API_KEY or .secrets/.typesafe-api-key (git-ignored). Answers
// are cached in .validation/judge-cache.json, so a rerun only pays for new questions. The report
// goes to .validation/judge-cloze.md and .json. This is a local tool; CI never runs it.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadCards } = require('./cards');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '.validation');
const CACHE = path.join(OUT, 'judge-cache.json');
const API = process.env.TYPESAFE_API_URL || 'https://api.typesafe.ai/v1/systemone';
const MAX_OPTIONS = 255;
const PARALLEL = 4;

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i === -1 ? def : args[i + 1]; };
const dryRun = args.includes('--dry-run');
const control = args.includes('--control');
const limit = Number(opt('limit', 0));
const level = Number(opt('level', 0));
const threshold = Number(opt('threshold', 0.15));
const model = opt('model', 'jev-latest');

// ---------- questions ----------
const charLen = (s) => Array.from(s).length;
const { cards } = loadCards();

// The same candidate rule as clozeTarget(): same length, not in the sentence, not containing the word
// or inside it; same level when that leaves at least three.
function candidates(c, ex) {
  const len = charLen(c.zh);
  const pool = cards.filter((w) => w !== c && charLen(w.zh) === len && !ex.zh.includes(w.zh) && !w.zh.includes(c.zh) && !c.zh.includes(w.zh));
  const same = pool.filter((w) => w.lv === c.lv);
  return same.length >= 3 ? same : pool;
}

let items = [];
cards.forEach((c) => {
  if (level && c.lv !== level) return;
  c.ex.filter((ex) => ex.zh.includes(c.zh)).forEach((ex) => {
    const pool = candidates(c, ex);
    if (pool.length) items.push({ c, ex, pool, blanked: ex.zh.replace(c.zh, '＿'.repeat(charLen(c.zh))) });
  });
});
// Questions with a known answer, to check the check (--control): `also` says whether `other` is right too.
const CONTROLS = [
  { zh: '我想喝咖啡。', en: 'I want to drink coffee.', word: '想', other: '要', also: true },
  { zh: '我和朋友一起去北京。', en: 'I am going to Beijing with my friend.', word: '和', other: '跟', also: true },
  { zh: '我会说汉语。', en: 'I can speak Chinese.', word: '会', other: '能', also: true },
  { zh: '我有两个哥哥。', en: 'I have two older brothers.', word: '两', other: '二', also: false },
  { zh: '我认识他，他是我的同学。', en: 'I know him; he is my classmate.', word: '认识', other: '知道', also: false },
];
const card = (zh) => { const c = cards.find((x) => x.zh === zh); if (!c) throw new Error('Control word not in the deck: ' + zh); return c; };
if (control) {
  items = CONTROLS.map((k) => {
    const c = card(k.word), other = card(k.other), ex = { zh: k.zh, en: k.en };
    const pool = candidates(c, ex);
    if (!pool.includes(other)) pool.push(other);
    return { c, ex, pool, other, also: k.also, blanked: ex.zh.replace(c.zh, '＿'.repeat(charLen(c.zh))) };
  });
}
// A limit takes an even spread, so a trial covers every level and not just the first words.
if (limit && limit < items.length) {
  const step = items.length / limit;
  items = Array.from({ length: limit }, (_, i) => items[Math.floor(i * step)]);
}

const meaning = (w) => (w.en.length > 100 ? w.en.slice(0, 97) + '…' : w.en);
const describe = (w) => w.py + ' — ' + meaning(w);

function choiceRequest(it, chunk) {
  const criteria = {};
  [it.c].concat(chunk).forEach((w) => { criteria[w.zh] = describe(w); });
  return {
    state: { sentence: it.blanked, translation: it.ex.en },
    model,
    questions: {
      fits: {
        type: 'choice',
        instructions: 'Which word fills the gap (＿) in `sentence` so that it is correct, natural Mandarin and means `translation`?',
        criteria,
      },
    },
  };
}

function noulRequest(it, w) {
  return {
    state: { sentence: it.ex.zh.replace(it.c.zh, w.zh), translation: it.ex.en },
    model,
    questions: {
      works: {
        type: 'noul',
        instructions: 'Is `sentence` correct, natural Mandarin that means the same as `translation`?',
        criteria: { true: 'A learner who wrote it would be right', false: 'Wrong word, ungrammatical or a different meaning' },
      },
    },
  };
}

// Pools larger than a Choice allows are split; the right word is in every chunk.
const chunks = (pool) => {
  const out = [];
  for (let i = 0; i < pool.length; i += MAX_OPTIONS - 1) out.push(pool.slice(i, i + MAX_OPTIONS - 1));
  return out;
};

// ---------- API ----------
let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch (e) { /* first run */ }
const keyOf = (body) => crypto.createHash('sha256').update(API + JSON.stringify(body)).digest('hex');
const usage = { requests: 0, cached: 0, input_tokens: 0 };

function apiKey() {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY.trim();
  const file = path.join(ROOT, '.secrets', '.typesafe-api-key');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  throw new Error('No API key: create one at https://console.typesafe.ai and save it in .secrets/.typesafe-api-key');
}

async function ask(body) {
  const k = keyOf(body);
  if (cache[k]) { usage.cached++; return cache[k]; }
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      usage.requests++;
      usage.input_tokens += (data.usage && data.usage.input_tokens) || 0;
      cache[k] = data.answers;
      return data.answers;
    }
    const retry = res.status === 429 || res.status === 529 || res.status >= 500;
    if (!retry || attempt >= 5) throw new Error('TypeSafe API ' + res.status + ': ' + (await res.text()).slice(0, 300));
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
}

async function judge(it) {
  const probs = {};
  for (const chunk of chunks(it.pool)) {
    const a = (await ask(choiceRequest(it, chunk))).fits;
    Object.assign(probs, a.probabilities);
  }
  const answer = probs[it.c.zh] || 0;
  const suspects = it.pool
    .map((w) => ({ w, p: probs[w.zh] || 0 }))
    .filter((s) => s.p >= threshold)
    .sort((a, b) => b.p - a.p);
  for (const s of suspects) s.works = (await ask(noulRequest(it, s.w))).works.noul;
  return {
    word: it.c.zh, level: it.c.lv, sentence: it.ex.zh, blanked: it.blanked, translation: it.ex.en,
    answer: round(answer), candidates: it.pool.length,
    suspects: suspects.map((s) => ({ word: s.w.zh, en: meaning(s.w), p: round(s.p), works: round(s.works) })),
  };
}
const round = (x) => Math.round(x * 1000) / 1000;

// Runs the questions a few at a time.
async function runAll() {
  const results = new Array(items.length);
  let next = 0, done = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await judge(items[i]);
      if (++done % 25 === 0) console.log('  ' + done + ' / ' + items.length);
    }
  };
  try {
    await Promise.all(Array.from({ length: PARALLEL }, worker));
  } finally {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify(cache));
  }
  return results;
}

// ---------- report ----------
// "Also right": the sentence still works with the distractor. "Weak": Jev is unsure of the right word.
function report(results) {
  const bad = results.filter((r) => r.suspects.some((s) => s.works >= 0.5));
  const weak = results.filter((r) => !bad.includes(r) && (r.answer < 0.5 || r.suspects.length));
  const cell = (t) => String(t).replace(/\|/g, '\\|');
  const row = (r) => '| ' + r.word + ' | HSK ' + r.level + ' | ' + r.blanked + '<br>' + cell(r.translation) + ' | ' + r.answer + ' | ' +
    (r.suspects.map((s) => s.word + ' (' + cell(s.en) + ') p ' + s.p + ', works ' + s.works).join('<br>') || '—') + ' |';
  const table = (rs) => rs.length ? ['| Word | Level | Gap | p(right) | Distractors that fit |', '|---|---|---|---|---|'].concat(rs.map(row)).join('\n') : 'None.';
  return [
    '# Fill-the-gap check (' + new Date().toISOString().slice(0, 10) + ', ' + model + ')',
    '',
    results.length + ' questions checked; threshold ' + threshold + '.',
    '',
    '## Also right (' + bad.length + ')',
    'A distractor makes a correct sentence with the same meaning: exclude it for this sentence, or change the sentence.',
    '',
    table(bad),
    '',
    '## Weak (' + weak.length + ')',
    'Jev was unsure, but no distractor passed the second check. Worth a glance.',
    '',
    table(weak),
    '',
  ].join('\n');
}

// Passes when the other word is flagged as also right exactly when it is.
async function runControls() {
  let failed = 0;
  for (const it of items) {
    const r = await judge(it);
    const s = r.suspects.find((x) => x.word === it.other.zh);
    const works = s ? s.works : round((await ask(noulRequest(it, it.other))).works.noul);
    const flagged = !!s && s.works >= 0.5;
    if (flagged !== it.also) failed++;
    console.log((flagged === it.also ? 'ok   ' : 'FAIL ') + r.blanked + '  ' + it.c.zh + ' p ' + r.answer + ' | ' + it.other.zh +
      ' p ' + (s ? s.p : '<' + threshold) + ', works ' + works + ' → ' + (flagged ? 'flagged' : 'not flagged') + (it.also ? ' (should be flagged)' : ' (should not)'));
  }
  fs.writeFileSync(CACHE, JSON.stringify(cache));
  console.log(items.length - failed + ' / ' + items.length + ' controls passed');
  if (failed) process.exitCode = 1;
}

async function main() {
  const requests = items.reduce((n, it) => n + chunks(it.pool).length, 0);
  console.log(items.length + ' questions, ' + requests + ' choice requests (plus a check per suspicious distractor)');
  if (dryRun) {
    console.log(JSON.stringify(choiceRequest(items[0], chunks(items[0].pool)[0]), null, 2).slice(0, 1500));
    return;
  }
  apiKey();
  if (control) return runControls();
  const results = await runAll();
  fs.writeFileSync(path.join(OUT, 'judge-cloze.json'), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUT, 'judge-cloze.md'), report(results));
  console.log('API requests ' + usage.requests + ' (cached ' + usage.cached + '), input tokens ' + usage.input_tokens);
  console.log('Report: .validation/judge-cloze.md');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
