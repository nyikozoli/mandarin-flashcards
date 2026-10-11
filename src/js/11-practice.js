  /* ---------- practice modes ---------- */
  var PRACTICE = { zh: 'Chinese → meaning', reverse: 'Meaning → Chinese', listen: 'Listening', choice: 'Multiple choice', hanzi: 'Characters only', tone: 'Which tone?', cloze: 'Fill the gap', build: 'Build the sentence', pairs: 'Similar words' };
  // Styles answered by picking one of the chips in #choiceBox (keys 1–4).
  var CHOICE_STYLES = { choice: true, tone: true, cloze: true, pairs: true };
  var choiceDone = false;
  // The syllable the tone quiz is asking about on the current card; null when the card has no quiz.
  var toneQ = null;
  // The fill-the-gap question on the current card ({ ex, blanked, options }); null when the card has none.
  var clozeQ = null;
  // The sentence-building puzzle on the current card ({ tiles, order, target, done }); null when the card has none.
  var buildQ = null;
  // The similar-words question on the current card ({ opts }); null when the card has none.
  var similarQ = null;
  // True while the card's Chinese face is hidden because it is the answer.
  var faceHidden = false;
  var TONE_CONTOUR = { 1: 'Level', 2: 'Rising', 3: 'Dipping', 4: 'Falling' };
  // True while the current card hides its reading (pinyin, tone colours, audio) until the reveal.
  var readingHidden = false;
  // Fading pinyin: a card whose next review is a week or more away (SRS box 3+) is read from the characters alone.
  var FADE_BOX = 3;
  function wellKnown(c) { var r = state.srs[c.zh]; return !!r && r.b >= FADE_BOX; }
  function shortText(s) {
    var t = String(s).split(';')[0].replace(/\s*\([^)]*\)/g, '').trim() || String(s);
    return t.length > 60 ? t.slice(0, 57) + '…' : t;
  }
  function buildChoices(c) {
    var key = shortText(c.en).toLowerCase();
    var pool = cards.filter(function (x) { return x !== c && x.lv === c.lv && shortText(x.en).toLowerCase() !== key; });
    if (pool.length < 3) pool = cards.filter(function (x) { return x !== c; });
    var opts = [c];
    while (opts.length < 4 && pool.length) opts.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    for (var i = opts.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = opts[i]; opts[i] = opts[j]; opts[j] = t; }
    els.choiceBox.textContent = '';
    opts.forEach(function (o, k) {
      var b = el('button', 'choice');
      b.type = 'button';
      b.setAttribute('data-ok', o === c ? '1' : '0');
      b.appendChild(el('span', 'choice-num', String(k + 1)));
      var tx = el('span', 'choice-text');
      tx.appendChild(el('span', 'choice-en', shortText(o.en)));
      var hu = el('span', 'choice-hu', shortText(o.hu));
      hu.setAttribute('lang', 'hu');
      tx.appendChild(hu);
      b.appendChild(tx);
      els.choiceBox.appendChild(b);
    });
    choiceDone = false;
  }
  function shuffled(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // One of the word's example sentences with the word blanked out, and four words of the same length to choose from.
  // Distractors never occur in the sentence and never contain the word (or sit inside it), so only one choice fits.
  function clozeTarget(c) {
    if (c.sentence) return null;
    var exs = c.ex.filter(function (e) { return e.zh.indexOf(c.zh) !== -1; });
    if (!exs.length) return null;
    var ex = exs[(c.n + state.pos) % exs.length], len = charLen(c.zh);
    var pool = wordCards.filter(function (w) {
      return w !== c && charLen(w.zh) === len && ex.zh.indexOf(w.zh) === -1 && w.zh.indexOf(c.zh) === -1 && c.zh.indexOf(w.zh) === -1;
    });
    var same = pool.filter(function (w) { return w.lv === c.lv; });
    if (same.length >= 3) pool = same;
    var opts = [c];
    while (opts.length < 4 && pool.length) opts.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return { ex: ex, blanked: ex.zh.replace(c.zh, new Array(len + 1).join('＿')), options: shuffled(opts) };
  }
  var PUNCT = /[，。！？、：；“”‘’「」（）《》…—\s,.!?:;"'()]/;
  // The sentence cut into word tiles (known words, and runs of other characters such as names); punctuation is left out
  // and not part of the answer. Null when there is nothing to put in order.
  function buildTarget(c) {
    if (!c.sentence) return null;
    var tiles = [];
    segment(c.zh).forEach(function (sg) {
      if (sg.word) { tiles.push(sg.text); return; }
      var run = '';
      Array.from(sg.text).forEach(function (ch) {
        if (PUNCT.test(ch)) { if (run) tiles.push(run); run = ''; } else run += ch;
      });
      if (run) tiles.push(run);
    });
    if (tiles.length < 2) return null;
    var target = tiles.join('');
    var items = tiles.map(function (t, i) { return { text: t, orig: i }; });
    var mixed = shuffled(items);
    for (var tries = 0; tries < 8 && mixed.map(function (t) { return t.text; }).join('') === target; tries++) mixed = shuffled(items);
    return { tiles: mixed, order: [], target: target, done: false };
  }
  function drawBuild() {
    var line = els.cardPrompt.querySelector('.build-line'), bank = els.cardPrompt.querySelector('.build-bank');
    if (!line || !buildQ) return;
    line.textContent = '';
    bank.textContent = '';
    var tile = function (i, where) {
      var b = el('button', 'build-tile', buildQ.tiles[i].text);
      b.type = 'button';
      b.setAttribute('lang', 'zh-CN');
      b.setAttribute('data-i', String(i));
      b.setAttribute('data-where', where);
      b.disabled = buildQ.done;
      return b;
    };
    buildQ.order.forEach(function (i) { line.appendChild(tile(i, 'line')); });
    if (!buildQ.order.length) line.appendChild(el('span', 'build-empty', 'Tap the words below in order'));
    buildQ.tiles.forEach(function (t, i) { if (buildQ.order.indexOf(i) === -1) bank.appendChild(tile(i, 'bank')); });
  }
  // A tap moves a tile between the bank and the sentence line; placing the last one checks the answer.
  function moveTile(i, where) {
    if (!buildQ || buildQ.done || currentIndex() === null) return;
    if (where === 'line') buildQ.order.splice(buildQ.order.indexOf(i), 1);
    else if (buildQ.order.indexOf(i) === -1) buildQ.order.push(i);
    drawBuild();
    if (buildQ.order.length < buildQ.tiles.length) return;
    buildQ.done = true;
    var ok = buildQ.order.map(function (k) { return buildQ.tiles[k].text; }).join('') === buildQ.target;
    var line = els.cardPrompt.querySelector('.build-line');
    line.classList.add(ok ? 'right' : 'wrong');
    drawBuild();
    buzz(ok ? 12 : [30, 60, 30]);
    var c = cards[currentIndex()];
    announce(ok ? 'Correct: ' + c.zh : 'Not quite. The sentence is ' + c.zh + '. Mark it yourself.');
    // A different word order can still be good Chinese, so a mismatch shows the sentence and leaves the mark to you.
    if (!ok) { setRevealed(true); return; }
    if (testing) { act('known'); return; }
    var pos = state.pos;
    setTimeout(function () { if (state.pos === pos && !busy) act('known'); }, 900);
  }
  // Words that are easy to mix up with this one: the same syllables in other tones (买 mǎi / 卖 mài, 他 / 她 / 它),
  // and a few characters that differ by a stroke. Look-alikes come first; at most three.
  var LOOK_ALIKE = [['买', '卖'], ['大', '太'], ['白', '百'], ['在', '再'], ['找', '我'], ['小', '少'], ['米', '来'], ['看', '着']];
  var similarMap = null;
  function similarOf(c) {
    if (c.sentence) return [];
    if (!similarMap) {
      similarMap = {};
      var bySound = {}, lex = getLexicon().map;
      wordCards.forEach(function (w) {
        var k = stripTone(w.py).toLowerCase().replace(/[\s'’·-]/g, '');
        (bySound[k] = bySound[k] || []).push(w);
      });
      wordCards.forEach(function (w) {
        var out = [];
        LOOK_ALIKE.forEach(function (pair) {
          if (pair.indexOf(w.zh) === -1) return;
          pair.forEach(function (z) { if (z !== w.zh && lex[z] && out.indexOf(lex[z]) === -1) out.push(lex[z]); });
        });
        bySound[stripTone(w.py).toLowerCase().replace(/[\s'’·-]/g, '')].forEach(function (x) { if (x !== w && out.indexOf(x) === -1) out.push(x); });
        similarMap[w.zh] = out.slice(0, 3);
      });
    }
    return similarMap[c.zh] || [];
  }
  // In the similar-words style the deck holds only words that have a look-alike or a sound-alike.
  function inPractice(c) { return state.practice !== 'pairs' || !!c.sentence || similarOf(c).length > 0; }
  // Chips that show words (characters and pinyin) rather than meanings.
  function buildWordChoices(right, opts, noPinyin) {
    els.choiceBox.textContent = '';
    opts.forEach(function (o, k) {
      var b = el('button', 'choice');
      b.type = 'button';
      b.setAttribute('data-ok', o === right ? '1' : '0');
      b.appendChild(el('span', 'choice-num', String(k + 1)));
      var tx = el('span', 'choice-text');
      var zh = el('span', 'choice-zh', o.zh);
      zh.setAttribute('lang', 'zh-CN');
      var py = el('span', 'choice-pyl', o.py);
      py.setAttribute('lang', 'zh-Latn-pinyin');
      tx.appendChild(zh);
      if (!noPinyin) tx.appendChild(py);
      b.appendChild(tx);
      els.choiceBox.appendChild(b);
    });
    choiceDone = false;
  }
  // Four chips for one syllable: the same syllable written in tones 1 to 4, so the keys 1–4 pick a tone.
  function buildToneChoices(t) {
    els.choiceBox.textContent = '';
    [1, 2, 3, 4].forEach(function (n) {
      var b = el('button', 'choice tone');
      b.type = 'button';
      b.setAttribute('data-ok', n === t.tone ? '1' : '0');
      b.appendChild(el('span', 'choice-num', String(n)));
      var tx = el('span', 'choice-text');
      var py = el('span', 'choice-py' + (state.toneColors ? ' t' + n : ''), retone(t.text, n));
      py.setAttribute('lang', 'zh-Latn-pinyin');
      tx.appendChild(py);
      tx.appendChild(el('span', 'choice-contour', TONE_CONTOUR[n]));
      b.appendChild(tx);
      els.choiceBox.appendChild(b);
    });
    choiceDone = false;
  }
  function pickChoice(k) {
    if (choiceDone || !CHOICE_STYLES[state.practice] || currentIndex() === null) return;
    var btns = els.choiceBox.querySelectorAll('.choice');
    var b = btns[k];
    if (!b) return;
    choiceDone = true;
    var ok = b.getAttribute('data-ok') === '1';
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].getAttribute('data-ok') === '1') btns[i].classList.add('right');
      btns[i].disabled = true;
    }
    if (!ok) b.classList.add('wrong');
    buzz(ok ? 12 : [30, 60, 30]);
    if (!ok) setRevealed(true);
    var right = cards[currentIndex()];
    announce(ok ? 'Correct.' : state.practice === 'tone'
      ? 'Not quite. ' + right.zh + ' starts with ' + toneQ.text + ', tone ' + toneQ.tone + '.'
      : state.practice === 'cloze' || state.practice === 'pairs' ? 'Not quite. The answer is ' + right.zh + ', ' + right.py + '.'
      : 'Not quite. The answer is: ' + shortText(right.en) + '.');
    if (testing) { act(ok ? 'known' : 'learning'); return; }
    var pos = state.pos;
    setTimeout(function () { if (state.pos === pos && !busy) act(ok ? 'known' : 'learning'); }, ok ? 650 : 1800);
  }
  function applyPractice(c) {
    var p = state.practice;
    toneQ = p === 'tone' ? toneQuizTarget(c) : null;
    clozeQ = p === 'cloze' ? clozeTarget(c) : null;
    buildQ = p === 'build' ? buildTarget(c) : null;
    similarQ = p === 'pairs' && similarOf(c).length ? { opts: shuffled([c].concat(similarOf(c))) } : null;
    faceHidden = p === 'reverse' || p === 'listen' || !!clozeQ || !!buildQ || !!similarQ;
    els.card.classList.toggle('hide-face', faceHidden);
    // Characters only, the tone quiz and faded pinyin: the reading is the answer, so pinyin, tone colours and audio wait for the reveal.
    readingHidden = p === 'hanzi' || !!toneQ || (p === 'zh' && state.fadePinyin && wellKnown(c)) || (p === 'choice' && !state.choicePinyin);
    els.card.classList.toggle('hide-reading', readingHidden);
    els.card.classList.toggle('tone-mode', !!toneQ);
    els.cardPrompt.textContent = '';
    els.choiceBox.classList.toggle('tone-grid', !!toneQ);
    if (p === 'reverse') {
      var en = el('p', 'prompt-en', c.en);
      var hu = el('p', 'prompt-hu', c.hu);
      hu.setAttribute('lang', 'hu');
      els.cardPrompt.appendChild(el('p', 'prompt-q', deck().sayIt));
      els.cardPrompt.appendChild(en);
      els.cardPrompt.appendChild(hu);
      if (!c.sentence) {
        var tf = el('form', 'type-form');
        var ti = el('input', 'type-input');
        ti.type = 'text';
        ['autocomplete', 'autocapitalize', 'autocorrect'].forEach(function (a) { ti.setAttribute(a, 'off'); });
        ti.setAttribute('spellcheck', 'false');
        ti.setAttribute('enterkeyhint', 'done');
        ti.setAttribute('aria-label', 'Type the pinyin, with tone numbers or tone marks');
        ti.placeholder = 'Type the pinyin, e.g. xue2sheng';
        var tb = el('button', 'btn small', 'Check');
        tb.type = 'submit';
        tf.appendChild(ti);
        tf.appendChild(tb);
        els.cardPrompt.appendChild(tf);
        var tr = el('p', 'type-result');
        tr.setAttribute('role', 'status');
        els.cardPrompt.appendChild(tr);
      }
    } else if (p === 'listen' || toneQ) {
      var lb = el('button', 'listen-btn', toneQ ? deck().tonePlay : deck().play);
      lb.type = 'button';
      lb.id = 'btnListen';
      els.cardPrompt.appendChild(el('p', 'prompt-q', toneQ ? deck().toneQ : deck().listenQ));
      els.cardPrompt.appendChild(lb);
    } else if (clozeQ) {
      els.cardPrompt.appendChild(el('p', 'prompt-q', 'Which word fills the gap?'));
      var gap = el('p', 'prompt-zh'), at = clozeQ.ex.zh.indexOf(c.zh);
      gap.setAttribute('lang', 'zh-CN');
      gap.appendChild(document.createTextNode(clozeQ.ex.zh.slice(0, at)));
      var hole = el('span', 'gap');
      hole.style.width = (charLen(c.zh) * 1.1) + 'em';
      hole.setAttribute('aria-label', 'blank');
      gap.appendChild(hole);
      gap.appendChild(document.createTextNode(clozeQ.ex.zh.slice(at + c.zh.length)));
      els.cardPrompt.appendChild(gap);
      els.cardPrompt.appendChild(el('p', 'prompt-sub', clozeQ.ex.en));
      var gapHu = el('p', 'prompt-sub', clozeQ.ex.hu);
      gapHu.setAttribute('lang', 'hu');
      els.cardPrompt.appendChild(gapHu);
    } else if (similarQ) {
      els.cardPrompt.appendChild(el('p', 'prompt-q', 'Which one means this?'));
      els.cardPrompt.appendChild(el('p', 'prompt-en', shortText(c.en)));
      var sHu = el('p', 'prompt-hu', shortText(c.hu));
      sHu.setAttribute('lang', 'hu');
      els.cardPrompt.appendChild(sHu);
      var sb = el('button', 'listen-btn similar-play', '🔊 Hear it');
      sb.type = 'button';
      els.cardPrompt.appendChild(sb);
    } else if (buildQ) {
      els.cardPrompt.appendChild(el('p', 'prompt-q', 'Put the words in order:'));
      els.cardPrompt.appendChild(el('p', 'prompt-sub', c.en));
      var bHu = el('p', 'prompt-sub', c.hu);
      bHu.setAttribute('lang', 'hu');
      els.cardPrompt.appendChild(bHu);
      var bLine = el('div', 'build-line');
      bLine.setAttribute('aria-label', 'Your sentence');
      els.cardPrompt.appendChild(bLine);
      var bBank = el('div', 'build-bank');
      bBank.setAttribute('aria-label', 'Words to place');
      els.cardPrompt.appendChild(bBank);
      drawBuild();
    }
    els.choiceBox.hidden = !(p === 'choice' || toneQ || clozeQ || similarQ);
    if (p === 'choice') buildChoices(c);
    else if (toneQ) buildToneChoices(toneQ);
    else if (clozeQ) buildWordChoices(c, clozeQ.options);
    else if (similarQ) buildWordChoices(c, similarQ.opts, true);
    else els.choiceBox.textContent = '';
  }

