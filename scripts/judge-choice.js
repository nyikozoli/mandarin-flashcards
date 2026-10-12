// Asks TypeSafe's Jev model whether a multiple-choice question has more than one right answer.
// For every word, the candidates are the meanings the app can offer as wrong options (the same level,
// minus the words optionClash() in src/js/11-practice.js already rules out). Jev picks the meaning the
// word has; a wrong option with a real share is then checked on its own ("can the word mean this?").
// A confirmed pair goes in data/choice-exclude.json, which keeps the two apart in both directions
// (word → meaning and meaning → word).
//
//   node scripts/judge-choice.js --control     known answers: does the check flag the right ones?
//   node scripts/judge-choice.js --limit 50    trial on 50 words spread over all levels
//   node scripts/judge-choice.js --dry-run     what a run would send after the cached answers, and its cost
//
// Options: --threshold 0.15, --model jev-latest. Answers are cached in .validation/judge-choice-cache.json
// (see jev.js); the report goes to .validation/judge-choice.md and .json. Local only; CI never runs it.
const fs = require('fs');
const path = require('path');
const { loadCards } = require('./cards');
const { ROOT, OUT, apiKey, jevClient, runPool, costLine, round } = require('./jev');

const MAX_OPTIONS = 255;
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i === -1 ? def : args[i + 1]; };
const dryRun = args.includes('--dry-run');
const control = args.includes('--control');
const limit = Number(opt('limit', 0));
const threshold = Number(opt('threshold', 0.15));
const model = opt('model', 'jev-latest');
const jev = jevClient('judge-choice-cache.json');

// ---------- the app's rules, mirrored ----------
const { cards } = loadCards();
const shortText = (s) => {
  const t = String(s).split(';')[0].replace(/\s*\([^)]*\)/g, '').trim() || String(s);
  return t.length > 60 ? t.slice(0, 57) + '…' : t;
};
const senses = (c) => c.en.split(/[;,]/)
  .map((s) => s.replace(/\([^)]*\)/g, '').replace(/[()]/g, '').trim().toLowerCase().replace(/^to /, '').replace(/^(a|an|the) /, '').trim())
  .filter((s) => s.length > 1);
const excludeFile = path.join(ROOT, 'data', 'choice-exclude.json');
const EXCLUDE = fs.existsSync(excludeFile) ? JSON.parse(fs.readFileSync(excludeFile, 'utf8')).pairs : [];
const clash = (c, x) => senses(c).some((s) => senses(x).includes(s)) ||
  EXCLUDE.some((p) => (p[0] === c.zh && p[1] === x.zh) || (p[0] === x.zh && p[1] === c.zh));
const key = (c) => shortText(c.en).toLowerCase();
function pool(c) {
  const same = cards.filter((x) => x !== c && x.lv === c.lv && key(x) !== key(c) && !clash(c, x));
  return same.length >= 3 ? same : cards.filter((x) => x !== c && !clash(c, x));
}

let items = cards.map((c) => ({ c, pool: pool(c) }));
// Known answers (--control): an extra option `other` that the word can (also: true) or cannot mean.
const CONTROLS = [
  { word: '看', other: 'to watch', also: true },
  { word: '便宜', other: 'inexpensive', also: true },
  { word: '漂亮', other: 'beautiful', also: true },
  { word: '买', other: 'to sell', also: false },
  { word: '贵', other: 'cheap', also: false },
  { word: '吃', other: 'to drink', also: false },
];
if (control) {
  items = CONTROLS.map((k) => {
    const c = cards.find((x) => x.zh === k.word);
    if (!c) throw new Error('Control word not in the deck: ' + k.word);
    const fake = { zh: '(' + k.other + ')', py: '', en: k.other, lv: c.lv };
    return { c, pool: pool(c).concat([fake]), other: fake, also: k.also };
  });
}
if (limit && limit < items.length) {
  const step = items.length / limit;
  items = Array.from({ length: limit }, (_, i) => items[Math.floor(i * step)]);
}

// ---------- questions to Jev ----------
const chunks = (list) => {
  const out = [];
  for (let i = 0; i < list.length; i += MAX_OPTIONS - 1) out.push(list.slice(i, i + MAX_OPTIONS - 1));
  return out;
};
// Options are the wrong options' meanings as shown (words with the same shown meaning share one) and NONE.
// The word's own meaning is left out: next to it, a second right meaning gets too small a share to notice.
const NONE = 'none of these';
function choiceRequest(it, chunk) {
  const criteria = {};
  chunk.forEach((w) => { criteria[shortText(w.en)] = null; });
  criteria[NONE] = 'The word cannot mean any of the other options';
  return {
    state: { word: it.c.zh, pinyin: it.c.py },
    model,
    questions: {
      means: {
        type: 'choice',
        instructions: 'A learner sees the Mandarin word `word` (`pinyin`) and picks an English meaning. Which option is a correct meaning of the word, if any?',
        criteria,
      },
    },
  };
}
function noulRequest(it, meaning) {
  return {
    state: { word: it.c.zh, pinyin: it.c.py, meaning },
    model,
    questions: {
      can: {
        type: 'noul',
        instructions: 'Can the Mandarin word `word` (`pinyin`) mean `meaning`, so that a learner who picked `meaning` for it would be right?',
        criteria: { true: 'One of the word\'s common meanings', false: 'A different word\'s meaning' },
      },
    },
  };
}

async function judge(it) {
  const probs = {};
  for (const chunk of chunks(it.pool)) Object.assign(probs, (await jev.ask(choiceRequest(it, chunk))).means.probabilities);
  const own = shortText(it.c.en);
  const byMeaning = new Map();
  it.pool.forEach((w) => { const m = shortText(w.en); if (m !== own) byMeaning.set(m, (byMeaning.get(m) || []).concat([w])); });
  const suspects = [...byMeaning.entries()].map(([m, ws]) => ({ m, ws, p: probs[m] || 0 })).filter((s) => s.p >= threshold).sort((a, b) => b.p - a.p);
  for (const s of suspects) s.can = (await jev.ask(noulRequest(it, s.m))).can.noul;
  return {
    word: it.c.zh, py: it.c.py, level: it.c.lv, en: it.c.en, none: round(probs[NONE] || 0), options: it.pool.length,
    suspects: suspects.map((s) => ({ meaning: s.m, words: s.ws.map((w) => w.zh), p: round(s.p), can: round(s.can) })),
    top: Object.entries(probs).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, q]) => m + ' ' + round(q)).join(', '),
  };
}

// ---------- report ----------
function report(results) {
  const bad = results.filter((r) => r.suspects.some((s) => s.can >= 0.5));
  const cell = (t) => String(t).replace(/\|/g, '\\|');
  const row = (r) => '| ' + r.word + ' ' + r.py + ' | HSK ' + r.level + ' | ' + cell(r.en) + ' | ' + r.none + ' | ' +
    r.suspects.filter((s) => s.can >= 0.5).map((s) => s.words.join('/') + ' "' + cell(s.meaning) + '" p ' + s.p + ', can ' + s.can).join('<br>') + ' |';
  return [
    '# Multiple-choice check (' + new Date().toISOString().slice(0, 10) + ', ' + model + ')',
    '',
    results.length + ' words checked; threshold ' + threshold + '. Pairs to review: ' + bad.length + '.',
    'A confirmed pair goes in data/choice-exclude.json as [word, other word].',
    '',
    bad.length ? ['| Word | Level | Its meaning | p(none) | Wrong options it can also mean |', '|---|---|---|---|---|'].concat(bad.map(row)).join('\n') : 'None.',
    '',
  ].join('\n');
}

async function runControls() {
  let failed = 0;
  for (const it of items) {
    const r = await judge(it);
    const s = r.suspects.find((x) => x.meaning === it.other.en);
    const flagged = !!s && s.can >= 0.5;
    if (flagged !== it.also) failed++;
    console.log((flagged === it.also ? 'ok   ' : 'FAIL ') + it.c.zh + ' → "' + it.other.en + '": p ' + (s ? s.p : '<' + threshold) +
      (s ? ', can ' + s.can : '') + ' → ' + (flagged ? 'flagged' : 'not flagged') + (it.also ? ' (should be flagged)' : ' (should not)') + '  [top: ' + r.top + ']');
  }
  jev.save();
  console.log(items.length - failed + ' / ' + items.length + ' controls passed');
  if (failed) process.exitCode = 1;
}

async function main() {
  const requests = items.reduce((n, it) => n + chunks(it.pool).length, 0);
  console.log(items.length + ' words, ' + requests + ' choice requests (plus a check per suspicious option)');
  if (dryRun) {
    const plan = { send: 0, cached: 0, chars: 0 };
    items.forEach((it) => chunks(it.pool).forEach((chunk) => {
      const body = choiceRequest(it, chunk);
      if (jev.cached(body)) plan.cached++;
      else { plan.send++; plan.chars += JSON.stringify(body).length; }
    }));
    console.log(costLine(plan) + '; second checks come on top');
    if (plan.send) console.log(JSON.stringify(choiceRequest(items[0], chunks(items[0].pool)[0]), null, 2).slice(0, 1200));
    return;
  }
  apiKey();
  if (control) return runControls();
  const results = await runPool(items, judge, jev);
  fs.writeFileSync(path.join(OUT, 'judge-choice.json'), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUT, 'judge-choice.md'), report(results));
  console.log(jev.summary());
  console.log('Report: .validation/judge-choice.md');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
