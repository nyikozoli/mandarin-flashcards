  /* ---------- self-check: typed answers (Type it, Dictation) ---------- */
  // These join HABIT_TESTS, so each runs on empty marks in the word deck and habitTests() puts everything back.
  function typedTestWord(z) { return wordCards.filter(function (w) { return w.zh === z; })[0]; }
  function typedTestStyle(v) { els.optPractice.value = v; els.optPractice.dispatchEvent(new Event('change')); }
  function typedTestShow(z) { state.mode = 'all'; state.deck = [wordCards.indexOf(typedTestWord(z))]; state.pos = 0; state.revealed = false; undoStack = []; render(false); }
  function typedTestSubmit(text) {
    if (text !== undefined) els.typedInput.value = text;
    els.typedForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  HABIT_TESTS.push({ title: 'Typed answers: the pinyin parser', run: function (add) {
    // [word, typed, expected kind]
    var cases = [
      ['你好', 'ni3hao3', 'right'], ['你好', 'nǐhǎo', 'right'], ['你好', 'Nǐ Hǎo', 'right'], ['你好', ' NI3 hao3 ', 'right'], ['你好', "ni3-hao3", 'right'],
      ['你好', 'ni3hǎo', 'right'], ['你好', 'ni3hao2', 'tone'], ['你好', 'nihao', 'tone'], ['你好', 'níhǎo', 'tone'], ['你好', 'ni3hao32', 'tone'],
      ['你好', 'ni3hao', 'tone'], ['你好', 'ni3ha3', 'wrong'], ['你好', 'ni3hao3a', 'wrong'], ['你好', 'li3hao3', 'wrong'], ['你好', '你好', 'wrong'],
      ['你好', '', 'empty'], ['你好', '   ', 'empty'], ['你好', '33', 'wrong'],
      ['朋友', 'peng2you', 'right'], ['朋友', 'peng2you5', 'right'], ['朋友', 'peng2you0', 'right'], ['朋友', 'péngyou', 'right'], ['朋友', 'peng2you3', 'tone'],
      ['学生', 'xue2sheng', 'right'], ['学生', 'xue1sheng', 'tone'], ['学生', 'xue2shen', 'wrong'],
      ['女儿', 'nv3er2', 'right'], ['女儿', 'nu:3er2', 'right'], ['女儿', 'nü3er2', 'right'], ['女儿', "nǚ'ér", 'right'], ['女儿', 'NV3ER2', 'right'],
      ['女儿', 'nu3er2', 'wrong'], ['女儿', 'nv3er4', 'tone'], ['绿', 'lv4', 'right'], ['绿', 'lǜ', 'right'], ['绿', 'lu:4', 'right'], ['绿', 'lu4', 'wrong'],
      ['旅游', 'lv3you2', 'right'], ['旅游', 'lǚyóu', 'right'],
      // 一 and 不: the tone the card writes, or the citation tone.
      ['一定', 'yi2ding4', 'right'], ['一定', 'yi1ding4', 'right'], ['一定', 'yídìng', 'right'], ['一定', 'yi4ding4', 'tone'], ['一定', 'yi3ding4', 'tone'],
      ['一起', 'yi4qi3', 'right'], ['一起', 'yi1qi3', 'right'], ['一起', 'yi2qi3', 'tone'], ['一', 'yi1', 'right'], ['一', 'yi', 'tone'],
      ['第一', 'di4yi1', 'right'], ['第一', 'dì-yī', 'right'],
      ['不客气', 'bu2ke4qi', 'right'], ['不客气', 'bu4 ke4 qi', 'right'], ['不客气', 'bú kèqi', 'right'], ['不客气', 'bu1ke4qi', 'tone'],
      ['对不起', 'dui4buqi3', 'right'], ['对不起', 'dui4bu4qi3', 'right'], ['对不起', 'dui4bu2qi3', 'tone'], ['不', 'bu4', 'right'], ['不', 'bu2', 'tone'],
      // Erhua: the digit before or after the r.
      ['一会儿', 'yi2hui4r', 'right'], ['一会儿', 'yi2huir4', 'right'], ['一会儿', 'yi1hui4r', 'right'], ['一会儿', 'yíhuìr', 'right'], ['一会儿', 'yi2hui4', 'wrong'],
      ['儿子', 'er2zi', 'right'], ['儿子', 'er2zi5', 'right'], ['可爱', "ke3'ai4", 'right'], ['可爱', 'kěài', 'right'],
      ['中国', 'zhong1guo2', 'right'], ['中国', 'Zhōngguó', 'right'], ['中国', 'zhong1guo', 'tone']
    ];
    var bad = cases.filter(function (x) { var w = typedTestWord(x[0]); return !w || typedGrade(x[1], w).kind !== x[2]; })
      .map(function (x) { var w = typedTestWord(x[0]); return x[0] + ' “' + x[1] + '” → ' + (w ? typedGrade(x[1], w).kind : 'no such word') + ', expected ' + x[2]; });
    // Which syllable was off is part of the grade.
    var g = typedGrade('ni3hao2', typedTestWord('你好'));
    var marks = g.syls.length === 2 && !g.syls[0].off && g.syls[1].off && g.syls[1].got === 2 && g.syls[1].tone === 3;
    // A second reading after a slash counts too.
    var alt = typedGrade('shui2', { zh: '谁', py: 'shéi / shuí' }).kind === 'right' && typedGrade('shei2', { zh: '谁', py: 'shéi / shuí' }).kind === 'right' &&
      typedGrade('shui3', { zh: '谁', py: 'shéi / shuí' }).kind === 'tone';
    // Every word in the deck: its own pinyin, typed back with marks and with numbers, is right; without tones it is a
    // tone miss (or right, when every syllable is neutral); with another letter it is wrong.
    var own = [], lined = [];
    wordCards.forEach(function (c) {
      var plain = numberedPinyin(c.py, c.zh, false).replace(/[1-4]/g, ''), syls = typedSyllables(c.py, c.zh);
      var allNeutral = syls.every(function (s) { return s.tone === 5; });
      var ok = typedGrade(c.py, c).kind === 'right' && typedGrade(c.py.toUpperCase(), c).kind === 'right' &&
        typedGrade(numberedPinyin(c.py, c.zh, false), c).kind === 'right' && typedGrade(numberedPinyin(c.py, c.zh, true), c).kind === 'right' &&
        typedGrade(numberedPinyin(c.py, c.zh, true).replace(/ü/g, 'v'), c).kind === 'right' &&
        typedGrade(plain, c).kind === (allNeutral ? 'right' : 'tone') && typedGrade(plain + 'x', c).kind === 'wrong' && typedMatches(c.py, c);
      if (!ok) own.push(c.zh + ' ' + c.py);
      // Each syllable lines up with a character, so 一 and 不 are found.
      if (syls.some(function (s) { return !s.han; })) lined.push(c.zh + ' ' + c.py);
    });
    add('Typed answers: tone numbers, tone marks, ü, neutral tones, 一 and 不', !bad.length && marks && alt && !own.length && !lined.length,
      cases.length + ' typed answers graded as expected: ' + (!bad.length ? 'yes' : 'no (' + bad.slice(0, 4).join('; ') + ')') +
      ', the syllable with the wrong tone is marked: ' + marks + ', a second reading counts: ' + alt +
      ', all ' + wordCards.length + ' words accept their own pinyin in marks and in numbers: ' + (!own.length ? 'yes' : 'no (' + own.slice(0, 5).join(', ') + ')') +
      ', every syllable lines up with a character: ' + (!lined.length ? 'yes' : 'no (' + lined.slice(0, 5).join(', ') + ')'));
  } });

  HABIT_TESTS.push({ title: 'Type it: see the meaning, type the pinyin', run: function (add) {
    typedTestStyle('type');
    var w = typedTestWord('你好'), v = typedTestWord('朋友');
    var style = state.practice === 'type' && state.skill === 'recall' && !isSent() && els.optPractice.value === 'type' &&
      els.practiceSeal.textContent === SKILL_ZH.recall && els.practiceAsk.textContent === PRACTICE_ASK.type && PRACTICE_ZH.type === '打拼音';
    typedTestShow('你好');
    var inp = els.typedInput;
    // The card hides the word and its pinyin, shows the meaning and the field.
    var face = faceHidden && readingHidden && els.card.classList.contains('hide-face') && !els.typedForm.hidden && !els.cardPrompt.hidden &&
      els.cardPrompt.textContent.indexOf(mainMeaning(w)) !== -1 && els.card.getAttribute('aria-label').indexOf('你好') === -1 &&
      els.gradeRow.hidden && els.choiceBox.hidden && els.typedResult.hidden && els.btnTypedRight.hidden;
    var field = inp.getAttribute('autocapitalize') === 'off' && inp.getAttribute('autocorrect') === 'off' && inp.getAttribute('autocomplete') === 'off' &&
      inp.getAttribute('spellcheck') === 'false' && inp.getAttribute('inputmode') === 'text' && inp.getAttribute('lang') === 'zh-Latn-pinyin' &&
      parseFloat(window.getComputedStyle(inp).fontSize) >= 16 && !!els.typedLabel.textContent && els.typedLabel.getAttribute('for') === 'typedInput';
    // Nothing typed: nothing happens.
    typedTestSubmit('  ');
    var empty = !typedQ.done && !state.revealed && state.pos === 0;
    // Keys typed in the field are text, not shortcuts.
    var keysOff = ['1', ' ', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 's', 'z', 'h'].every(function (k) {
      var ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
      inp.dispatchEvent(ev);
      return !ev.defaultPrevented && state.pos === 0 && !state.revealed && !state.status[w.zh];
    });
    // Right: the result shows, the card reveals, and the second Enter records “I know it”.
    typedTestSubmit('ni3hao3');
    var shown = typedQ.done && typedQ.kind === 'right' && state.revealed && els.card.classList.contains('revealed') && !els.typedResult.hidden &&
      /Right/.test(els.typedResult.textContent) && els.btnTypedRight.hidden && !state.status[w.zh] && state.pos === 0 && /Next/.test(els.btnTypedCheck.textContent) &&
      /I know it/.test(els.revealHint.textContent);
    // Once graded, the text cannot be changed.
    var frozen = !inp.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: 'x', bubbles: true, cancelable: true })) &&
      inp.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertLineBreak', bubbles: true, cancelable: true }));
    typedTestSubmit();
    var right = state.pos === 1 && state.status[w.zh] === 'learning' && state.srs[w.zh].b === 1 && !state.misses[w.zh];
    undo();
    var undone = state.pos === 0 && !state.status[w.zh] && !state.srs[w.zh] && !typedQ.done && inp.value === '' && els.typedResult.hidden && !state.revealed;
    // Wrong letters: “Still learning”, with a miss.
    typedTestSubmit('ni3men');
    var wrongShown = typedQ.kind === 'wrong' && state.revealed && /Not quite/.test(els.typedResult.textContent) && els.typedResult.textContent.indexOf('你好') !== -1 && inp.value === 'ni3men' &&
      !els.btnTypedRight.hidden && /Still learning/.test(els.revealHint.textContent);
    typedTestSubmit();
    var wrong = state.pos === 1 && state.status[w.zh] === 'learning' && state.srs[w.zh].b === 0 && state.misses[w.zh] === 1;
    undo();
    // Right letters, wrong tone: wrong, with the syllable marked.
    typedTestSubmit('ni3hao2');
    var offs = els.typedResult.querySelectorAll('.typed-py .syl-off');
    var toneShown = typedQ.kind === 'tone' && els.typedResult.classList.contains('tone') && offs.length === 1 && offs[0].textContent === 'hǎo' &&
      offs[0].classList.contains('t3') && !!els.typedResult.querySelector('.typed-py .t3:not(.syl-off)') && /wrong tone/.test(els.typedResult.textContent) &&
      /hǎo is tone 3, you typed 2/.test(els.typedResult.textContent) && !els.btnTypedRight.hidden;
    typedTestSubmit();
    var tone = state.pos === 1 && state.srs[w.zh].b === 0 && state.misses[w.zh] === 1;
    undo();
    // “I was right” after a slip records “I know it” instead; undo takes it back like any answer.
    typedTestSubmit('ni3hao');
    els.btnTypedRight.click();
    var over = state.pos === 1 && state.srs[w.zh].b === 1 && !state.misses[w.zh];
    undo();
    var overUndone = state.pos === 0 && !state.srs[w.zh];
    // The answer bar still works on a graded card, and T jumps to the field.
    typedTestSubmit('ni3hao2');
    act('known');
    var bar = state.pos === 1 && state.srs[w.zh].b === 1;
    undo();
    // A neutral tone needs no digit; tone colours off leaves the marks.
    typedTestShow('朋友');
    typedTestSubmit('peng2you');
    var neutral = typedQ.kind === 'right';
    typedTestSubmit();
    var colours = state.toneColors;
    state.toneColors = false;
    typedTestShow('你好');
    typedTestSubmit('ni2hao3');
    var plainMarks = els.typedResult.querySelectorAll('.syl-off').length === 1 && !els.typedResult.querySelector('.t3');
    state.toneColors = colours;
    // “Show the answer at once” does not give the answer away.
    var auto = state.autoReveal;
    state.autoReveal = true;
    typedTestShow('你好');
    state.revealed = true; render(false);
    var noAuto = !state.revealed && !els.card.classList.contains('revealed');
    state.autoReveal = auto;
    // The sentence deck has no typing: it falls back to Meaning → sentence, same skill.
    useDeckType('sentences');
    state.deck = buildDeck('all'); state.pos = 0; render(false);
    var sent = state.practice === 'reverse' && state.skill === 'recall' && els.typedForm.hidden && !typedQ;
    useDeckType('words');
    add('Type it: the typed pinyin is graded', style && face && field && empty && keysOff && shown && frozen && right && undone && wrongShown && wrong && toneShown && tone && over && overUndone && bar && neutral && plainMarks && noAuto && sent,
      'a recall style in the menu, button and sheet: ' + style + ', word and pinyin hidden, meaning and field shown: ' + face + ', field set up for a phone and labelled: ' + field +
      ', an empty answer does nothing: ' + empty + ', keys in the field are not shortcuts: ' + keysOff + ', right answer shows and reveals: ' + shown + ', graded text is frozen: ' + frozen +
      ', second Enter records “I know it”: ' + right + ', undo: ' + undone + ', wrong letters shown: ' + wrongShown + ', recorded as “Still learning” with a miss: ' + wrong +
      ', wrong tone marks the syllable: ' + toneShown + ', and counts as a miss: ' + tone + ', “I was right” records known: ' + over + ', and undoes: ' + overUndone +
      ', the answer bar still answers: ' + bar + ', neutral tone needs no digit: ' + neutral + ', marks without tone colours: ' + plainMarks +
      ', never starts revealed: ' + noAuto + ', sentences fall back to Meaning → sentence: ' + sent);
  } });

  HABIT_TESTS.push({ title: 'Dictation: hear the word, type the pinyin', run: function (add) {
    typedTestStyle('dictate');
    var w = typedTestWord('学生'), today = dayKey();
    var style = state.practice === 'dictate' && state.skill === 'listen' && els.practiceSeal.textContent === SKILL_ZH.listen &&
      els.practiceAsk.textContent === PRACTICE_ASK.dictate && PRACTICE_ZH.dictate === '听写';
    typedTestShow('学生');
    var lb = els.cardPrompt.querySelector('.listen-btn');
    // Everything is hidden; the play button is the question.
    var face = faceHidden && !readingHidden && !!lb && !els.typedForm.hidden && els.cardPrompt.textContent.indexOf(w.en) === -1 &&
      els.cardPrompt.textContent.indexOf('学生') === -1 && els.card.getAttribute('aria-label').indexOf('学生') === -1 && els.choiceBox.hidden;
    var said = [], keepSpeak = speakParts;
    speakParts = function (parts) { said.push(parts[0]); };
    var plays = false;
    try { lb.click(); plays = said.length === 1 && said[0] === '学生' && !state.revealed; } finally { speakParts = keepSpeak; }
    typedTestSubmit('xué sheng');
    var shown = typedQ.kind === 'right' && state.revealed && els.cardPrompt.hidden;
    typedTestSubmit();
    var right = state.pos === 1 && marksOf('listen').srs[w.zh].b === 1 && !marksOf('recall').srs[w.zh] && !marksOf('read').srs[w.zh];
    undo();
    typedTestSubmit('xue2shen1');
    typedTestSubmit();
    var wrong = state.pos === 1 && state.srs[w.zh].b === 0 && state.misses[w.zh] === 1;
    undo();
    typedTestSubmit('xue2sheng1');
    var toneShown = typedQ.kind === 'tone' && els.typedResult.querySelectorAll('.syl-off').length === 1;
    typedTestSubmit();
    var tone = state.pos === 1 && state.misses[w.zh] === 1;
    undo();
    // In the sheet both tiles sit under their skill.
    openPracticeSheet();
    var tileOf = function (v) { return els.practiceGrid.querySelector('[data-style="' + v + '"]'); };
    var secOf = function (v) { var t = tileOf(v); return t ? t.closest('.pk-skill').querySelector('.pk-head').textContent : ''; };
    var tiles = /Recall/.test(secOf('type')) && /Listening/.test(secOf('dictate')) && tileOf('dictate').getAttribute('aria-pressed') === 'true' &&
      tileOf('type').textContent.indexOf(PRACTICE_ASK.type) !== -1;
    closeOverlay(els.practiceView);
    // Just 5 cards: typed all the way through, the answers count and the finish shows.
    state.pos = 0; state.deck = buildDeck('all');
    var due = cards[12];
    state.status[due.zh] = 'learning'; state.srs[due.zh] = { b: 1, d: today };
    render(false);
    startQuickRound();
    var d = state.deck.slice(), inRound = inQuickRound() && d.length === QUICK_SIZE && d[0] === 12 && !els.typedForm.hidden && !!typedQ;
    d.forEach(function (i, n) {
      typedTestSubmit(n === 1 ? 'x' : numberedPinyin(cards[i].py.split('/')[0], cards[i].zh, n % 2 === 0));
      typedTestSubmit();
    });
    var quick = !inQuickRound() && !els.quickView.hidden && state.srs[due.zh].b === 2 && state.srs[cards[d[1]].zh].b === 0 && state.misses[cards[d[1]].zh] === 1 &&
      state.srs[cards[d[2]].zh].b === 1;
    closeOverlay(els.quickView);
    // The trouble deck and Due: a typed miss brings the word back at the end.
    var t = cards[30];
    state.misses[t.zh] = TROUBLE_MISSES; state.status[t.zh] = 'learning'; state.srs[t.zh] = { b: 0, d: today };
    setMode('trouble');
    var tAt = state.deck.indexOf(30), n0 = state.deck.length;
    state.pos = tAt; render(false);
    typedTestSubmit('zzz');
    typedTestSubmit();
    var trouble = state.mode === 'trouble' && tAt !== -1 && state.deck.length === n0 + 1 && state.deck[n0] === 30 && state.misses[t.zh] === TROUBLE_MISSES + 1;
    setMode('due');
    var dAt = state.deck.indexOf(30), n1 = state.deck.length;
    state.pos = dAt; render(false);
    typedTestSubmit(numberedPinyin(t.py, t.zh, false));
    typedTestSubmit();
    var dueOk = dAt !== -1 && state.deck.length === n1 && state.srs[t.zh].b === 1;
    // A rehearse card shown in between has no field, and the next word card has it again.
    setMode('all');
    rehearseCard = { zh: w.zh, code: 'hu' };
    var keepLang = state.langs.hu;
    state.langs.hu = 'rehearse';
    render(false);
    var rh = !!rehearseCard && els.typedForm.hidden && !typedQ && practiceNow() === 'rh-hu';
    rehearseCard = null;
    state.langs.hu = keepLang;
    render(false);
    var backAgain = !els.typedForm.hidden && !!typedQ;
    // The sentence deck falls back to listening.
    useDeckType('sentences');
    var sent = state.practice === 'listen' && state.skill === 'listen';
    useDeckType('words');
    add('Dictation: the word is heard and its pinyin typed', style && face && plays && shown && right && wrong && toneShown && tone && tiles && inRound && quick && trouble && dueOk && rh && backAgain && sent,
      'a listening style: ' + style + ', everything hidden behind a play button: ' + face + ', the button speaks the word: ' + plays + ', right answer reveals: ' + shown +
      ', recorded in listening only: ' + right + ', wrong letters are a miss: ' + wrong + ', a wrong tone is marked: ' + toneShown + ', and is a miss: ' + tone +
      ', tiles under Recall and Listening: ' + tiles + ', a “Just 5 cards” round is typed: ' + inRound + ', its answers count and it ends: ' + quick +
      ', trouble deck brings a typed miss back: ' + trouble + ', Due moves a right answer up: ' + dueOk + ', a rehearse card has no field: ' + rh +
      ', the next word card has it again: ' + backAgain + ', sentences fall back to listening: ' + sent);
  } });
