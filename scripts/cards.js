// Loads the word cards from data/: used by scripts/build.js and scripts/judge.js.
// Each card is { lv, zh, py, en, hu, ex: [{ zh, py, en, hu }] }; throws if the data and the HSK lists disagree.
const fs = require('fs');
const path = require('path');

const dataPath = (...p) => path.join(__dirname, '..', 'data', ...p);
const read = (p) => fs.readFileSync(p, 'utf8');

const EXTRAS = ['你好', '你们', '他们']; // common words outside the HSK 1-2 list, filed under HSK 1

function loadCards() {
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
  return { cards, expected: { 1: L1.length + EXTRAS.length, 2: L2.length, 3: L3.length } };
}

module.exports = { loadCards };
