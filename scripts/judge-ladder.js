// Asks TypeSafe's Jev model whether each can-do step in data/ladder.json is backed by its words and
// sentences: would a learner who knows them be able to do what the step says? Steps where Jev puts less
// than --threshold on "well" go in the report, with the missing piece it most likely means.
//
//   node scripts/judge-ladder.js --control     steps with the right and with another step's content
//   node scripts/judge-ladder.js --dry-run     what a run would send after the cached answers, and its cost
//
// Options: --threshold 0.5, --model jev-latest. Answers are cached in .validation/judge-ladder-cache.json
// (see jev.js); the report goes to .validation/judge-ladder.md and .json. Local only; CI never runs it.
const fs = require('fs');
const path = require('path');
const { loadCards } = require('./cards');
const { ROOT, OUT, apiKey, jevClient, runPool, costLine, round } = require('./jev');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i === -1 ? def : args[i + 1]; };
const dryRun = args.includes('--dry-run');
const control = args.includes('--control');
const threshold = Number(opt('threshold', 0.5));
const model = opt('model', 'jev-latest');
const jev = jevClient('judge-ladder-cache.json');

const { cards } = loadCards();
const lex = Object.fromEntries(cards.map((c) => [c.zh, c]));
const sentEn = {};
cards.forEach((c) => c.ex.forEach((e) => { sentEn[e.zh] = e.en; }));
const RUNGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ladder.json'), 'utf8')).rungs;
// The Travel pack's steps join the ladder in the build, so they are checked too.
const travelFile = path.join(ROOT, 'data', 'travel.json');
if (fs.existsSync(travelFile)) RUNGS.push(...(JSON.parse(fs.readFileSync(travelFile, 'utf8')).ladder || []));

let items = RUNGS.map((r) => ({ id: r.id, goal: r.en, words: r.words, sentences: r.sentences || [] }));
// Known answers (--control): a step with its own content (good) and with another step's content (bad).
if (control) {
  const byId = Object.fromEntries(items.map((it) => [it.id, it]));
  const swap = (goalId, contentId) => Object.assign({}, byId[contentId], { id: goalId + ' with ' + contentId, goal: byId[goalId].goal, good: false });
  items = [
    Object.assign({}, byId.greetings, { good: true }),
    Object.assign({}, byId.directions, { good: true }),
    swap('greetings', 'directions'),
    swap('directions', 'past-story'),
    swap('past-story', 'greetings'),
  ];
}

function request(it) {
  return {
    state: {
      goal: it.goal,
      words: it.words.map((w) => w + ' (' + (lex[w] ? lex[w].en.split(';')[0] : '?') + ')'),
      sentences: it.sentences.map((s) => s + ' (' + (sentEn[s] || '?') + ')'),
    },
    model,
    questions: {
      fit: {
        type: 'score',
        instructions: 'A can-do step for learners of Mandarin: `goal`. A learner reaches it by knowing `words`, and `sentences` show them in use. ' +
          'How well would a learner who knows these words be able to do `goal` in simple Mandarin?',
        criteria: ['Not at all: the words are about something else', 'Partly: a key word or phrase for this goal is missing', 'Well: the words cover what this goal needs'],
      },
    },
  };
}

async function judge(it) {
  const a = (await jev.ask(request(it))).fit;
  const levels = Object.keys(a.probabilities).sort((x, y) => x - y);
  const ok = a.probabilities[levels[levels.length - 1]];
  const worst = levels.slice(0, -1).sort((x, y) => a.probabilities[y] - a.probabilities[x])[0];
  return { id: it.id, goal: it.goal, words: it.words, good: it.good, ok: round(ok), problem: a.legend[worst].split(':')[0], flagged: ok < threshold };
}

async function main() {
  console.log(items.length + ' steps, ' + items.length + ' requests');
  if (dryRun) {
    const plan = { send: 0, cached: 0, chars: 0 };
    items.forEach((it) => {
      const body = request(it);
      if (jev.cached(body)) plan.cached++;
      else { plan.send++; plan.chars += JSON.stringify(body).length; }
    });
    console.log(costLine(plan));
    if (plan.send) console.log(JSON.stringify(request(items[0]), null, 2).slice(0, 1500));
    return;
  }
  apiKey();
  const results = await runPool(items, judge, jev, 8);
  if (control) {
    let failed = 0;
    results.forEach((r) => {
      const right = r.flagged === !r.good;
      if (!right) failed++;
      console.log((right ? 'ok   ' : 'FAIL ') + r.id + ': p(well) ' + r.ok + ', ' + (r.flagged ? 'flagged (' + r.problem + ')' : 'not flagged') + (r.good ? ' (good)' : ' (bad)'));
    });
    console.log(results.length - failed + ' / ' + results.length + ' controls passed');
    if (failed) process.exitCode = 1;
  } else {
    const flagged = results.filter((r) => r.flagged).sort((a, b) => a.ok - b.ok);
    fs.writeFileSync(path.join(OUT, 'judge-ladder.json'), JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(OUT, 'judge-ladder.md'), [
      '# Ladder check (' + new Date().toISOString().slice(0, 10) + ', ' + model + ')', '',
      results.length + ' steps checked; flagged when p(well) < ' + threshold + ': ' + flagged.length + '.', '',
      flagged.length ? ['| Step | Goal | p(well) | Most likely problem | Words |', '|---|---|---|---|---|']
        .concat(flagged.map((r) => '| ' + r.id + ' | ' + r.goal + ' | ' + r.ok + ' | ' + r.problem + ' | ' + r.words.join(' ') + ' |')).join('\n') : 'None.', '',
    ].join('\n'));
    console.log('Report: .validation/judge-ladder.md');
  }
  console.log(jev.summary());
}

main().catch((e) => { console.error(e.message); process.exit(1); });
