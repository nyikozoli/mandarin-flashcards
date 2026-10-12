// Asks TypeSafe's Jev model which of the 16 topics in data/topics.json each word belongs to, under the
// tagging rules (the most specific topic wins; function words go in Grammar), and lists the words where
// Jev clearly prefers another topic than the one they have. Review those by hand before changing data.
//
//   node scripts/judge-topics.js --control     words with a known right or wrong tag: does the check tell them apart?
//   node scripts/judge-topics.js --limit 50    trial on 50 words spread over all levels
//   node scripts/judge-topics.js --dry-run     what a run would send after the cached answers, and its cost
//
// Options: --threshold 0.25 (flag when the word's own topic gets less than this), --model jev-latest.
// Answers are cached in .validation/judge-topics-cache.json (see jev.js); the report goes to
// .validation/judge-topics.md and .json. Local only; CI never runs it.
const fs = require('fs');
const path = require('path');
const { loadCards } = require('./cards');
const { ROOT, OUT, apiKey, jevClient, runPool, costLine, round } = require('./jev');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i === -1 ? def : args[i + 1]; };
const dryRun = args.includes('--dry-run');
const control = args.includes('--control');
const limit = Number(opt('limit', 0));
const threshold = Number(opt('threshold', 0.25));
const model = opt('model', 'jev-latest');
const jev = jevClient('judge-topics-cache.json');

const { cards } = loadCards();
const TOPICS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'topics.json'), 'utf8'));
const name = (id) => TOPICS.topics.find((t) => t.id === id).en;

let items = cards.map((c) => ({ c, tag: TOPICS.words[c.zh] }));
// Known answers (--control): `wrong` says whether the given tag is wrong.
const CONTROLS = [
  { word: '苹果', tag: 'food', wrong: false },
  { word: '苹果', tag: 'time', wrong: true },
  { word: '星期', tag: 'time', wrong: false },
  { word: '医生', tag: 'nature', wrong: true },
  { word: '的', tag: 'grammar', wrong: false },
  { word: '的', tag: 'feelings', wrong: true },
  { word: '下雨', tag: 'nature', wrong: false },
  { word: '衣服', tag: 'body', wrong: true },
];
if (control) {
  items = CONTROLS.map((k) => {
    const c = cards.find((x) => x.zh === k.word);
    if (!c) throw new Error('Control word not in the deck: ' + k.word);
    return { c, tag: k.tag, wrong: k.wrong };
  });
}
if (limit && limit < items.length) {
  const step = items.length / limit;
  items = Array.from({ length: limit }, (_, i) => items[Math.floor(i * step)]);
}

// The tag is not in the request, so Jev's answer does not lean on it and one answer serves any tag.
function request(it) {
  const criteria = {};
  TOPICS.topics.forEach((t) => { criteria[t.id] = t.en; });
  return {
    state: { word: it.c.zh, pinyin: it.c.py, meaning: it.c.en },
    model,
    questions: {
      topic: {
        type: 'choice',
        instructions: 'A word list for learners of Mandarin files every word under one topic. Which topic fits `word` (`pinyin`, `meaning`)? ' +
          'Rules: the most specific topic wins (an apple is Food & drink, not Shopping); pronouns, particles, conjunctions, prepositions, ' +
          'question words and adverbs such as 很 or 也 go in Grammar & question words; Common verbs is only for verbs that fit no more specific topic.',
        criteria,
      },
    },
  };
}

async function judge(it) {
  const a = (await jev.ask(request(it))).topic;
  const own = a.probabilities[it.tag] || 0;
  const best = Object.entries(a.probabilities).sort((x, y) => y[1] - x[1])[0];
  return {
    word: it.c.zh, py: it.c.py, en: it.c.en, level: it.c.lv, tag: it.tag, own: round(own),
    best: best[0], bestP: round(best[1]), wrong: it.wrong,
    flagged: own < threshold && best[0] !== it.tag,
  };
}

function report(results) {
  const flagged = results.filter((r) => r.flagged).sort((a, b) => a.own - b.own);
  const cell = (t) => String(t).replace(/\|/g, '\\|');
  const row = (r) => '| ' + r.word + ' ' + r.py + ' | ' + cell(r.en) + ' | ' + name(r.tag) + ' (' + r.own + ') | ' + name(r.best) + ' (' + r.bestP + ') |';
  return [
    '# Topic check (' + new Date().toISOString().slice(0, 10) + ', ' + model + ')',
    '',
    results.length + ' words checked; flagged when the word\'s own topic gets less than ' + threshold + ': ' + flagged.length + '.',
    '',
    flagged.length ? ['| Word | Meaning | Tagged (p) | Jev prefers (p) |', '|---|---|---|---|'].concat(flagged.map(row)).join('\n') : 'None.',
    '',
  ].join('\n');
}

async function main() {
  console.log(items.length + ' words, ' + items.length + ' requests');
  if (dryRun) {
    const plan = { send: 0, cached: 0, chars: 0 };
    items.forEach((it) => {
      const body = request(it);
      if (jev.cached(body)) plan.cached++;
      else { plan.send++; plan.chars += JSON.stringify(body).length; }
    });
    console.log(costLine(plan));
    if (plan.send) console.log(JSON.stringify(request(items[0]), null, 2));
    return;
  }
  apiKey();
  const results = await runPool(items, judge, jev, 8);
  if (control) {
    let failed = 0;
    results.forEach((r) => {
      const right = r.flagged === r.wrong;
      if (!right) failed++;
      console.log((right ? 'ok   ' : 'FAIL ') + r.word + ' tagged ' + r.tag + ': p ' + r.own + ', Jev prefers ' + r.best + ' (' + r.bestP + ') → ' +
        (r.flagged ? 'flagged' : 'not flagged') + (r.wrong ? ' (tag is wrong)' : ' (tag is right)'));
    });
    console.log(results.length - failed + ' / ' + results.length + ' controls passed');
    if (failed) process.exitCode = 1;
  } else {
    fs.writeFileSync(path.join(OUT, 'judge-topics.json'), JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(OUT, 'judge-topics.md'), report(results));
    console.log('Report: .validation/judge-topics.md');
  }
  console.log(jev.summary());
}

main().catch((e) => { console.error(e.message); process.exit(1); });
