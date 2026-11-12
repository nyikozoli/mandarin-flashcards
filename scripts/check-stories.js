// Checks data/stories.json, the serialized story: `node scripts/check-stories.js [--segments] [file]`.
// Exits non-zero on any problem. Warnings (pinyin that differs from the headwords' own) are for a human to read.
//
//   const { check } = require('./check-stories.js');
//   check()            -> list of problem strings (empty when the file is fine)
//   inspect()          -> { problems, warnings, segments } with the segmentation of every sentence
//
// Rules:
// - Every sentence, title and speaker is split by longest match against all headwords, the story's `names`
//   and its `extra` words, the way segment() in src/js/10-tones-lookup.js does. A Chinese character that no
//   word covers is a problem, and so is a word above the episode's level (level 1: HSK 1; level 2: HSK 1-2
//   and the Travel pack; level 3: HSK 1-3 and the Travel pack).
// - Episode ids run 1..N, levels never go down, each episode has 6 to 8 lines, and every text exists in all
//   five languages (the recap is empty only in episode 1).
// - The pinyin of each sentence is compared with the pinyin of its words. Differences are warnings: tone
//   changes of 一 and 不, neutral tones (桌子上 zhuōzi shang) and polyphonic characters differ legitimately.
const fs = require('fs');
const path = require('path');
const { loadCards } = require('./cards.js');

const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'stories.json');
const LANGS = ['en', 'hu', 'de', 'es', 'ro'];
const TRAVEL = 4;
const MIN_LINES = 6, MAX_LINES = 8;
const HAN = /\p{Script=Han}/u;
const PUNCT = new Set(Array.from('，。？！：；、“”‘’…—（）《》·0123456789 '));
const TONED = 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
const PLAIN = 'aaaaeeeeiiiioooouuuuüüüü';

const isStr = (v) => typeof v === 'string';
const filled = (v) => isStr(v) && v.trim() !== '';
const allowed = (wordLv, epLv) => (wordLv === TRAVEL ? epLv >= 2 : wordLv <= epLv);
const lvName = (lv) => (lv === TRAVEL ? 'Travel' : 'HSK ' + lv);
// Pinyin reduced to its letters, lower case: spaces, hyphens, apostrophes and punctuation do not matter.
const letters = (py) => py.normalize('NFC').toLowerCase().replace(/[^\p{L}]/gu, '');
const toneless = (s) => Array.from(s).map((ch) => { const i = TONED.indexOf(ch); return i < 0 ? ch : PLAIN[i]; }).join('');

function buildLexicon(story, problems) {
  const map = new Map();
  let max = 1;
  loadCards().cards.forEach((c) => map.set(c.zh, { zh: c.zh, py: c.py, lv: c.lv }));
  const add = (list, kind) => (Array.isArray(list) ? list : []).forEach((e, i) => {
    const at = kind + '[' + i + ']';
    if (!e || !filled(e.zh) || !filled(e.py)) { problems.push(at + ': needs zh and py'); return; }
    LANGS.forEach((k) => { if (!filled(e[k])) problems.push(at + ' ' + e.zh + ': no ' + k); });
    if (!Array.from(e.zh).every((ch) => HAN.test(ch))) problems.push(at + ' ' + e.zh + ': zh must be Chinese characters only');
    if (map.has(e.zh)) { problems.push(at + ' ' + e.zh + ': is already a ' + (map.get(e.zh).kind || 'headword')); return; }
    map.set(e.zh, { zh: e.zh, py: e.py, lv: 0, kind });
  });
  add(story.names, 'names');
  add(story.extra, 'extra');
  map.forEach((w) => { max = Math.max(max, Array.from(w.zh).length); });
  return { map, max };
}

// Longest match from the left, as the app does it. Pieces without `word` are punctuation or uncovered text.
function segment(zh, lex) {
  const chars = Array.from(zh), out = [];
  let i = 0;
  while (i < chars.length) {
    let hit = null, len = 0;
    if (HAN.test(chars[i])) {
      for (let L = Math.min(lex.max, chars.length - i); L > 0 && !hit; L--) {
        const w = lex.map.get(chars.slice(i, i + L).join(''));
        if (w) { hit = w; len = L; }
      }
    }
    if (hit) { out.push({ text: hit.zh, word: hit }); i += len; continue; }
    const last = out[out.length - 1];
    if (last && !last.word && HAN.test(chars[i]) === last.han) last.text += chars[i];
    else out.push({ text: chars[i], word: null, han: HAN.test(chars[i]) });
    i++;
  }
  return out;
}

const showSegments = (segs) => segs.map((s) => (!s.word ? s.text : s.text + (s.word.kind ? '*' : s.word.lv > 1 ? '^' + s.word.lv : ''))).join(' ');

// Compares the written pinyin with the words' own pinyin, word by word. Returns warnings.
function comparePinyin(segs, py) {
  const got = letters(py), warnings = [];
  let p = 0;
  for (const s of segs) {
    if (!s.word) continue;
    const want = letters(s.word.py), have = got.substr(p, want.length);
    if (have !== want) {
      if (toneless(have) !== toneless(want)) {
        warnings.push({ kind: 'other', text: s.text + ': expected "' + s.word.py + '", the pinyin continues with "' + got.substr(p, want.length + 6) + '"' });
        return warnings;
      }
      const kind = /[一不]/.test(s.text) ? 'sandhi' : have === toneless(have) ? 'neutral' : 'tone';
      warnings.push({ kind, text: s.text + ': ' + s.word.py + ' → ' + have });
    }
    p += want.length;
  }
  if (p !== got.length) warnings.push({ kind: 'other', text: 'pinyin has extra text at the end: "' + got.substr(p) + '"' });
  return warnings;
}

function inspect(file) {
  const problems = [], warnings = [], segments = [];
  let story;
  try {
    const raw = fs.readFileSync(file || DEFAULT_FILE, 'utf8');
    if (raw.includes('\r')) problems.push('file has CR line endings; use LF');
    story = JSON.parse(raw);
  } catch (e) {
    return { problems: ['cannot read stories: ' + e.message], warnings, segments };
  }
  const lex = buildLexicon(story, problems);
  const episodes = Array.isArray(story.episodes) ? story.episodes : [];
  if (!episodes.length) problems.push('no episodes');

  // One Chinese text with its pinyin: coverage, level, and the pinyin comparison.
  const checkZh = (at, zh, py, level) => {
    if (!filled(zh)) { problems.push(at + ': no zh'); return; }
    const segs = segment(zh, lex);
    segments.push({ at, zh, text: showSegments(segs) });
    segs.forEach((s) => {
      if (s.word) {
        if (!s.word.kind && !allowed(s.word.lv, level)) problems.push(at + ': ' + s.text + ' is ' + lvName(s.word.lv) + ', above level ' + level + ' — ' + zh);
      } else if (s.han) problems.push(at + ': no headword covers "' + s.text + '" — ' + zh);
      else Array.from(s.text).forEach((ch) => { if (!PUNCT.has(ch)) problems.push(at + ': unexpected character "' + ch + '" — ' + zh); });
    });
    if (py === undefined) return;
    if (!filled(py)) { problems.push(at + ': no py'); return; }
    if (HAN.test(py)) problems.push(at + ': Chinese characters in py');
    const first = Array.from(py.replace(/^[^\p{L}]+/u, ''))[0];
    if (first && first !== first.toUpperCase()) warnings.push({ at, kind: 'other', text: 'pinyin does not start with a capital: ' + py });
    comparePinyin(segs, py).forEach((w) => warnings.push(Object.assign({ at, zh, py }, w)));
  };
  const checkLangs = (at, obj, mayBeEmpty) => LANGS.forEach((k) => {
    const v = obj && obj[k];
    if (mayBeEmpty) { if (!isStr(v)) problems.push(at + ': ' + k + ' must be a string'); else if (v !== '') problems.push(at + ': ' + k + ' should be empty in episode 1'); return; }
    if (!filled(v)) { problems.push(at + ': no ' + k); return; }
    if (HAN.test(v)) problems.push(at + ': Chinese characters in ' + k);
    if (v !== v.trim() || /\s{2}/.test(v)) problems.push(at + ': stray spaces in ' + k);
    if (k === 'ro' && /[şţŞŢ]/.test(v)) problems.push(at + ': ro uses a cedilla (ş, ţ); write ș, ț');
    if (k === 'es' && ((v.match(/\?/g) || []).length !== (v.match(/¿/g) || []).length || (v.match(/!/g) || []).length !== (v.match(/¡/g) || []).length)) {
      problems.push(at + ': es needs matching ¿…? and ¡…!');
    }
  });

  let prevLevel = 1;
  episodes.forEach((ep, i) => {
    const E = 'episode ' + (i + 1);
    if (!ep || ep.id !== i + 1) problems.push(E + ': id should be ' + (i + 1) + ', is ' + (ep && ep.id));
    if (!ep) return;
    const level = ep.level;
    if (![1, 2, 3].includes(level)) { problems.push(E + ': level must be 1, 2 or 3'); return; }
    if (level < prevLevel) problems.push(E + ': level ' + level + ' is below the episode before it');
    prevLevel = level;
    checkZh(E + ' title', ep.title && ep.title.zh, (ep.title && ep.title.py) || '', level);
    checkLangs(E + ' title', ep.title, false);
    checkLangs(E + ' recap', ep.recap, i === 0);
    const lines = Array.isArray(ep.lines) ? ep.lines : [];
    if (lines.length < MIN_LINES || lines.length > MAX_LINES) problems.push(E + ': ' + lines.length + ' lines, should be ' + MIN_LINES + ' to ' + MAX_LINES);
    const seen = new Set();
    lines.forEach((ln, j) => {
      const at = (i + 1) + '.' + (j + 1);
      if (!ln) { problems.push(at + ': empty line'); return; }
      checkZh(at, ln.zh, ln.py || '', level);
      checkLangs(at, ln, false);
      if (filled(ln.zh) && !/[。？！…”]$/.test(ln.zh)) problems.push(at + ': zh does not end a sentence — ' + ln.zh);
      if (seen.has(ln.zh)) problems.push(at + ': the same sentence twice in one episode');
      seen.add(ln.zh);
      if (ln.who !== undefined) {
        if (!filled(ln.who)) problems.push(at + ': who is empty');
        else checkZh(at + ' who', ln.who, undefined, level);
      }
    });
  });
  return { problems, warnings, segments };
}

const check = (file) => inspect(file).problems;

module.exports = { check, inspect, segment, comparePinyin, buildLexicon };

if (require.main === module) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const res = inspect(file);
  if (args.includes('--segments')) res.segments.forEach((s) => console.log(s.at + '\t' + s.text));
  ['sandhi', 'neutral', 'tone', 'other'].forEach((kind) => {
    const list = res.warnings.filter((w) => w.kind === kind);
    if (!list.length) return;
    console.log('\nwarnings, ' + { sandhi: 'tone change of 一 / 不', neutral: 'neutral tone', tone: 'another tone (polyphonic?)', other: 'other' }[kind] + ' (' + list.length + '):');
    list.forEach((w) => console.log('  ' + w.at + '  ' + w.text + (w.py ? '   | ' + w.py : '')));
  });
  if (res.problems.length) {
    console.log('\nproblems:');
    res.problems.forEach((p) => console.log('  ' + p));
  }
  console.log('\ncheck-stories: ' + res.problems.length + ' problems, ' + res.warnings.length + ' warnings');
  process.exit(res.problems.length ? 1 : 0);
}
