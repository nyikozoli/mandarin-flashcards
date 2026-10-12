// Asks TypeSafe's Jev model how well each meaning matches the Chinese: every word's gloss and every
// example sentence's translation, in English, Hungarian, German, Spanish and Romanian. Each pair is
// one Score question; pairs where Jev puts less than --threshold on "correct" go in the report.
//
//   node scripts/judge-translations.js --control      known good and bad translations: does the check tell them apart?
//   node scripts/judge-translations.js --limit 50     trial on 50 pairs spread over everything
//   node scripts/judge-translations.js --lang hu      one language (en, hu, de, es, ro)
//   node scripts/judge-translations.js --kind words   words or sentences only
//   node scripts/judge-translations.js --dry-run      what a run would send after the cached answers, and its cost
//
// Options: --threshold 0.5, --model jev-latest. Answers are cached in .validation/judge-translations-cache.json
// (see jev.js); the report goes to .validation/judge-translations.md and .json. Local only; CI never runs it.
const fs = require('fs');
const path = require('path');
const { loadCards } = require('./cards');
const { ROOT, OUT, apiKey, jevClient, runPool, costLine, round } = require('./jev');

const PARALLEL = 8;
const LANGS = { en: 'English', hu: 'Hungarian', de: 'German', es: 'Spanish', ro: 'Romanian' };

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i === -1 ? def : args[i + 1]; };
const dryRun = args.includes('--dry-run');
const control = args.includes('--control');
const limit = Number(opt('limit', 0));
const onlyLang = opt('lang', '');
const onlyKind = opt('kind', '');
const threshold = Number(opt('threshold', 0.5));
const model = opt('model', 'jev-latest');
if (onlyLang && !LANGS[onlyLang]) throw new Error('--lang must be one of ' + Object.keys(LANGS).join(', '));

const jev = jevClient('judge-translations-cache.json');

// ---------- pairs ----------
const { cards } = loadCards();
const i18n = {};
['de', 'es', 'ro'].forEach((code) => {
  const file = path.join(ROOT, 'data', 'i18n', code + '.json');
  if (fs.existsSync(file)) i18n[code] = JSON.parse(fs.readFileSync(file, 'utf8'));
});
const meaningOf = (code, obj, kind) => (code === 'en' || code === 'hu' ? obj[code] : i18n[code] && i18n[code][kind][obj.zh]);

let pairs = [];
const seen = new Set();
const add = (p) => {
  const k = p.kind + '|' + p.zh + '|' + p.lang + '|' + p.text;
  if (!p.text || seen.has(k)) return;
  seen.add(k);
  pairs.push(p);
};
Object.keys(LANGS).forEach((lang) => {
  if (onlyLang && lang !== onlyLang) return;
  if (onlyKind !== 'sentences') cards.forEach((c) => add({ kind: 'word', zh: c.zh, py: c.py, lang, text: meaningOf(lang, c, 'words'), en: c.en }));
  if (onlyKind !== 'words') cards.forEach((c) => c.ex.forEach((e) => add({ kind: 'sentence', zh: e.zh, py: e.py, lang, text: meaningOf(lang, e, 'sentences'), en: e.en })));
});

// Known answers, to check the check (--control): `good` says whether the translation is right.
const CONTROLS = [
  { kind: 'sentence', zh: '我是学生。', lang: 'en', text: 'I am a teacher.', good: false },
  { kind: 'sentence', zh: '我每天骑自行车去上班。', lang: 'en', text: 'I ride my bike to work.', good: false },
  { kind: 'sentence', zh: '我看见一本书。', lang: 'hu', text: 'Látom egy könyvet.', good: false },
  { kind: 'sentence', zh: '我看见一本书。', lang: 'hu', text: 'Látok egy könyvet.', good: true },
  { kind: 'sentence', zh: '我有两个哥哥。', lang: 'hu', text: 'Két bátyámok van.', good: false },
  { kind: 'sentence', zh: '我有两个哥哥。', lang: 'hu', text: 'Két bátyám van.', good: true },
  { kind: 'sentence', zh: '我是学生。', lang: 'de', text: 'Ich bin Student.', good: true },
  { kind: 'sentence', zh: '今天很冷。', lang: 'de', text: 'Heute ist es sehr warm.', good: false },
  { kind: 'sentence', zh: '他每天给妈妈打电话。', lang: 'es', text: 'Él llama a su madre.', good: false },
  { kind: 'sentence', zh: '我是学生。', lang: 'ro', text: 'Sunt student.', good: true },
  { kind: 'word', zh: '想', lang: 'en', text: 'to forget', good: false },
  { kind: 'word', zh: '认识', lang: 'en', text: 'to know (a fact)', good: false },
  { kind: 'word', zh: '想', lang: 'hu', text: 'akar; szeretne; gondol; hiányzik', good: true },
  { kind: 'word', zh: '楼', lang: 'es', text: 'árbol', good: false },
  { kind: 'word', zh: '跟', lang: 'de', text: 'mit; und; folgen', good: true },
  { kind: 'sentence', zh: '今天很冷。', lang: 'ro', text: 'Astăzi este foarte cald.', good: false },
  { kind: 'sentence', zh: '我看见那本书。', lang: 'hu', text: 'Látok azt a könyvet.', good: false },
  { kind: 'sentence', zh: '我看见那本书。', lang: 'hu', text: 'Látom azt a könyvet.', good: true },
  // A known gap: "ugly" for 漂亮 passes in Romanian (it does not in Hungarian). Reported, not counted as a failure.
  { kind: 'word', zh: '漂亮', lang: 'ro', text: 'urât', good: false, gap: 'Romanian single-word glosses' },
];
if (control) {
  pairs = CONTROLS.map((k) => {
    const c = cards.find((x) => x.zh === k.zh);
    if (k.kind === 'word' && !c) throw new Error('Control word not in the deck: ' + k.zh);
    return Object.assign({ py: c ? c.py : '', en: '' }, k);
  });
}
// A limit takes an even spread, so a trial covers every language and both kinds.
if (limit && limit < pairs.length) {
  const step = pairs.length / limit;
  pairs = Array.from({ length: limit }, (_, i) => pairs[Math.floor(i * step)]);
}

// ---------- questions to Jev ----------
function request(p) {
  const L = LANGS[p.lang];
  if (p.kind === 'word') {
    return {
      state: { word: p.zh, pinyin: p.py, gloss: p.text },
      model,
      questions: {
        ok: {
          type: 'score',
          instructions: 'How well does `gloss`, a ' + L + ' dictionary gloss for learners, give the meaning of the Mandarin word `word` (`pinyin`)? ' +
            'Senses are separated by semicolons; notes in brackets explain usage. Leaving out rare senses is fine.',
          criteria: ['Wrong: the main meaning is wrong', 'Partly wrong: a listed sense or note is wrong or misleading', 'Correct'],
        },
      },
    };
  }
  const questions = {
    ok: {
      type: 'score',
      instructions: 'How well does `translation` (' + L + ') translate the Mandarin sentence `chinese`?',
      criteria: ['Wrong: it says something different', 'Partly wrong: a detail is missing, added or mistranslated',
        'Right meaning, but not natural or not grammatical ' + L, 'Accurate and natural ' + L],
    },
  };
  // The score alone misses wrong definite/indefinite verb forms; asked on its own, Jev catches them.
  if (p.lang === 'hu') {
    questions.grammar = {
      type: 'noul',
      instructions: 'Is `translation` grammatical Hungarian? Check especially that each verb uses the definite conjugation exactly when its object is definite (látom a könyvet, látok egy könyvet).',
    };
  }
  return { state: { chinese: p.zh, translation: p.text }, model, questions };
}

async function judge(p) {
  const answers = await jev.ask(request(p)), a = answers.ok;
  const levels = Object.keys(a.probabilities).sort((x, y) => x - y);
  const top = levels[levels.length - 1];
  // The most likely problem: the lower level with the largest share.
  const worst = levels.slice(0, -1).sort((x, y) => a.probabilities[y] - a.probabilities[x])[0];
  const r = {
    kind: p.kind, zh: p.zh, py: p.py, lang: p.lang, text: p.text, en: p.en, good: p.good, gap: p.gap,
    ok: round(a.probabilities[top]), problem: a.legend[worst], problemP: round(a.probabilities[worst]),
    grammar: answers.grammar ? round(answers.grammar.noul) : null,
  };
  r.flagged = r.ok < threshold || (r.grammar !== null && r.grammar < 0.5);
  if (r.grammar !== null && r.grammar < 0.5 && r.ok >= threshold) { r.problem = 'Hungarian grammar (verb forms?)'; r.problemP = round(1 - r.grammar); }
  r.rank = Math.min(r.ok, r.grammar === null ? 1 : r.grammar);
  return r;
}

// ---------- report ----------
function report(results) {
  const flagged = results.filter((r) => r.flagged).sort((a, b) => a.rank - b.rank);
  const cell = (t) => String(t || '').replace(/\|/g, '\\|');
  const row = (r) => '| ' + r.zh + (r.kind === 'word' ? ' ' + r.py : '') + ' | ' + r.lang + ' | ' + cell(r.text) +
    (r.lang !== 'en' && r.en ? '<br><small>en: ' + cell(r.en) + '</small>' : '') + ' | ' + r.ok + (r.grammar !== null ? '<br>grammar ' + r.grammar : '') + ' | ' + cell(r.problem) + ' (' + r.problemP + ') |';
  const table = (rs) => rs.length ? ['| Chinese | Lang | Meaning | p(correct) | Most likely problem |', '|---|---|---|---|---|'].concat(rs.map(row)).join('\n') : 'None.';
  const count = Object.keys(LANGS).map((l) => l + ' ' + flagged.filter((r) => r.lang === l).length).join(', ');
  return [
    '# Translation check (' + new Date().toISOString().slice(0, 10) + ', ' + model + ')',
    '',
    results.length + ' pairs checked; flagged when p(correct) < ' + threshold + ' (or, for Hungarian sentences, the grammar check < 0.5): ' +
      flagged.length + ' (' + count + ').',
    '',
    'Known limits (from the controls): Jev misses some wrong Romanian single-word glosses, and near the threshold it also flags good translations. Review by hand before changing data.',
    '',
    '## Words (' + flagged.filter((r) => r.kind === 'word').length + ')',
    '',
    table(flagged.filter((r) => r.kind === 'word')),
    '',
    '## Sentences (' + flagged.filter((r) => r.kind === 'sentence').length + ')',
    '',
    table(flagged.filter((r) => r.kind === 'sentence')),
    '',
  ].join('\n');
}

async function runControls() {
  const results = await runPool(pairs, judge, jev, PARALLEL);
  let failed = 0, gaps = 0;
  results.forEach((r) => {
    const right = r.flagged === !r.good;
    if (!right && r.gap) gaps++;
    else if (!right) failed++;
    console.log((right ? 'ok   ' : r.gap ? 'GAP  ' : 'FAIL ') + r.lang + ' ' + r.zh + ' → ' + r.text + ': p(correct) ' + r.ok +
      (r.grammar !== null ? ', grammar ' + r.grammar : '') +
      (r.flagged ? ', flagged: ' + r.problem + ' (' + r.problemP + ')' : ', not flagged') + (r.good ? ' (good)' : ' (bad)') +
      (!right && r.gap ? ' — known gap: ' + r.gap : ''));
  });
  console.log(results.length - failed - gaps + ' / ' + results.length + ' controls passed' + (gaps ? ', ' + gaps + ' known gap' : ''));
  if (failed) process.exitCode = 1;
}

async function main() {
  console.log(pairs.length + ' pairs (' + pairs.filter((p) => p.kind === 'word').length + ' word glosses, ' +
    pairs.filter((p) => p.kind === 'sentence').length + ' sentence translations)');
  if (dryRun) {
    const plan = { send: 0, cached: 0, chars: 0 };
    pairs.forEach((p) => {
      const body = request(p);
      if (jev.cached(body)) plan.cached++;
      else { plan.send++; plan.chars += JSON.stringify(body).length; }
    });
    console.log(costLine(plan));
    if (plan.send) console.log(JSON.stringify(request(pairs[0]), null, 2));
    return;
  }
  apiKey();
  if (control) await runControls();
  else {
    const results = await runPool(pairs, judge, jev, PARALLEL);
    fs.writeFileSync(path.join(OUT, 'judge-translations.json'), JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(OUT, 'judge-translations.md'), report(results));
    console.log('Report: .validation/judge-translations.md');
  }
  console.log(jev.summary());
}

main().catch((e) => { console.error(e.message); process.exit(1); });
