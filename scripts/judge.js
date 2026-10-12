// Asks TypeSafe's Jev model whether a fill-the-gap question has more than one right answer.
// For every word and each of its example sentences that contain it, the candidates are the
// distractors the app can draw (same rule as clozePool() in src/js/11-practice.js). Jev picks
// the word that fits the gap, given the translation the app shows; a distractor with a real
// share of the probability is then checked on its own (does the sentence still work with it?).
//
//   node scripts/judge.js --limit 50          trial on 50 questions spread over all levels
//   node scripts/judge.js --level 1           every HSK 1 question
//   node scripts/judge.js --dry-run           what a run would send after the cached answers, and its cost; no API call
//   node scripts/judge.js --control           five questions with a known answer: does the check flag the right ones?
//
// Options: --threshold 0.15 (distractor share that gets a second look), --model jev-latest.
// Answers are cached in .validation/judge-cache.json (see jev.js), so a rerun only pays for new
// questions. The report goes to .validation/judge-cloze.md and .json. Local only; CI never runs it.
const fs = require('fs');
const path = require('path');
const { loadCards } = require('./cards');
const { ROOT, OUT, apiKey, jevClient, runPool, costLine, round } = require('./jev');

const MAX_OPTIONS = 255;
const jev = jevClient('judge-cache.json');
const ask = jev.ask;

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

// Words already known to fit a gap; the app never offers them (data/cloze-exclude.json).
const excludeFile = path.join(ROOT, 'data', 'cloze-exclude.json');
const EXCLUDE = fs.existsSync(excludeFile) ? JSON.parse(fs.readFileSync(excludeFile, 'utf8')).exclude : [];
const excluded = (c, ex) => (EXCLUDE.find((k) => k.word === c.zh && k.sentence === ex.zh) || { not: [] }).not;

// The same candidate rule as clozePool() in the app: same length, not in the sentence, not containing the word
// or inside it, not excluded; same level when that leaves at least three.
function candidates(c, ex) {
  const len = charLen(c.zh), not = excluded(c, ex);
  const pool = cards.filter((w) => w !== c && charLen(w.zh) === len && !ex.zh.includes(w.zh) && !w.zh.includes(c.zh) && !c.zh.includes(w.zh) && !not.includes(w.zh));
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

// ---------- questions to Jev ----------
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
    'A distractor makes a correct sentence with the same meaning: add it to data/cloze-exclude.json, or change the sentence.',
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
  jev.save();
  console.log(items.length - failed + ' / ' + items.length + ' controls passed');
  if (failed) process.exitCode = 1;
}

// What a run would send after the saved answers: every Choice not in the cache, plus the second checks that cached
// answers already call for. Questions not yet asked can add a few more second checks once they are answered.
function estimate() {
  const plan = { send: 0, cached: 0, chars: 0, open: 0 };
  const count = (body) => {
    if (jev.cached(body)) plan.cached++;
    else { plan.send++; plan.chars += JSON.stringify(body).length; }
  };
  items.forEach((it) => {
    const probs = {};
    let known = true;
    chunks(it.pool).forEach((chunk) => {
      const body = choiceRequest(it, chunk), a = jev.cached(body);
      count(body);
      if (a) Object.assign(probs, a.fits.probabilities);
      else known = false;
    });
    if (known) it.pool.filter((w) => (probs[w.zh] || 0) >= threshold).forEach((w) => count(noulRequest(it, w)));
    else plan.open++;
  });
  return plan;
}

async function main() {
  const requests = items.reduce((n, it) => n + chunks(it.pool).length, 0);
  console.log(items.length + ' questions, ' + requests + ' choice requests (plus a check per suspicious distractor)');
  if (dryRun) {
    const plan = estimate();
    console.log(costLine(plan) + (plan.open ? '; the ' + plan.open + ' new questions may add a few second checks' : ''));
    if (plan.send) console.log(JSON.stringify(choiceRequest(items[0], chunks(items[0].pool)[0]), null, 2).slice(0, 1500));
    return;
  }
  apiKey();
  if (control) return runControls();
  const results = await runPool(items, judge, jev);
  fs.writeFileSync(path.join(OUT, 'judge-cloze.json'), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUT, 'judge-cloze.md'), report(results));
  console.log(jev.summary());
  console.log('Report: .validation/judge-cloze.md');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
