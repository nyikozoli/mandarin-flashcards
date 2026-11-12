  /* ---------- typed answers: Type it and Dictation ---------- */
  // Two word styles answered by typing the pinyin with its tones, graded by the app: 'type' (recall: see the meaning)
  // and 'dictate' (listening: hear the word). The field is #typedInput in #typedForm, which stays in the card from one
  // card to the next, so the phone keyboard stays up through a run of cards. Enter (or Check) grades the answer and
  // reveals the card; Enter again (or Next) records it through act(): right is “I know it”, anything else “Still
  // learning”. Nothing is recorded before that, so “I was right” (a slip of the finger) simply records “I know it”.
  var TYPED_STYLES = { type: true, dictate: true };
  // The typed question on the current card ({ done, kind }); null when the card has none.
  var typedQ = null;
  // True from a press on Check / Next while the field has the focus, so the press gives the focus back to the field.
  var typedKeepFocus = false;

  // The card's pinyin as syllables: { text (as written), base (plain letters, ü kept), tone, han }. Letters outside a
  // syllable (the r of yìdiǎnr) join the syllable before them. han is the syllable's character when the two line up.
  function typedSyllables(py, zh) {
    var syls = [];
    pinyinTokens(py).forEach(function (t) {
      if (t.tone) { syls.push({ text: t.text, base: stripTone(t.text).toLowerCase(), tone: t.tone, han: '' }); return; }
      var extra = t.text.toLowerCase().replace(/[^a-zü]/g, '');
      if (extra && syls.length) { syls[syls.length - 1].text += extra; syls[syls.length - 1].base += extra; }
    });
    var han = Array.from(zh).filter(isHan);
    // An erhua 儿 has no syllable of its own (一会儿 yíhuìr).
    if (han.length !== syls.length) han = han.filter(function (ch, i) { return !(ch === '儿' && i > 0 && han[i - 1] !== '女' && han[i + 1] !== '子'); });
    if (han.length === syls.length) syls.forEach(function (s, i) { s.han = han[i]; });
    return syls;
  }
  // What was typed, as plain letters plus the tones claimed: a mark sits on its letter, a digit follows a letter.
  // Case, spaces, apostrophes, hyphens and dots are dropped; v and u: are ü; 0 and 5 both mean the neutral tone.
  function typedParse(input) {
    var s = String(input || '');
    if (s.normalize) s = s.normalize('NFC');
    s = s.toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü');
    var letters = '', claims = [];
    Array.from(s).forEach(function (ch) {
      var v = PLAIN_VOWEL[ch];
      if (v) { claims.push({ at: letters.length, tone: TONE_MARK[v].indexOf(ch) + 1 }); letters += v; }
      else if (/[0-5]/.test(ch)) claims.push({ at: letters.length - 1, tone: ch === '0' ? 5 : Number(ch) });
      else if (!/[\s'’‘`´\-–·.,]/.test(ch)) letters += ch;
    });
    return { letters: letters, claims: claims };
  }
  // The tones a 一 or 不 syllable may be typed in: the one the card writes (the changed tone) and the citation tone.
  function typedToneOk(s, tone) {
    return tone === s.tone || (s.han === '一' && tone === 1) || (s.han === '不' && tone === 4);
  }
  // Grades typed pinyin against one reading. kind: 'empty', 'right', 'tone' (right letters, a tone wrong or missing)
  // or 'wrong' (wrong letters). syls carries the reading's syllables with `got` (the tone typed; 0 when two tones were
  // given for one syllable) and `off`.
  function gradeReading(input, py, zh) {
    var p = typedParse(input), syls = typedSyllables(py, zh);
    if (!p.letters && !p.claims.length) return { kind: 'empty', syls: syls };
    if (!syls.length || p.letters !== syls.map(function (s) { return s.base; }).join('')) return { kind: 'wrong', syls: syls };
    var start = 0, off = 0;
    syls.forEach(function (s, i) {
      var end = start + s.base.length, got = null;
      p.claims.forEach(function (c) {
        // A digit typed before any letter counts against the first syllable.
        var at = Math.max(0, c.at);
        if (at < start || at >= end) return;
        got = got === null || got === c.tone ? c.tone : 0;
      });
      s.got = got === null ? 5 : got;
      s.off = !typedToneOk(s, s.got);
      if (s.off) off++;
      start = end;
    });
    return { kind: off ? 'tone' : 'right', syls: syls };
  }
  // A card's pinyin may list readings with a slash; the best match counts.
  function typedGrade(input, c) {
    var rank = { right: 3, tone: 2, wrong: 1, empty: 0 }, best = null;
    String(c.py).split('/').forEach(function (py) {
      var g = gradeReading(input, py.trim(), c.zh);
      if (!best || rank[g.kind] > rank[best.kind]) best = g;
    });
    return best;
  }
  // A reading written with tone numbers (ni3hao3; `five` writes the neutral tone as 5): used by the self-check.
  function numberedPinyin(py, zh, five) {
    return typedSyllables(py, zh).map(function (s) { return s.base + (s.tone === 5 ? (five ? '5' : '') : s.tone); }).join('');
  }

  var TONE_SAY = { 1: 'tone 1', 2: 'tone 2', 3: 'tone 3', 4: 'tone 4', 5: 'neutral' };
  // Called by applyPractice() for every card: a fresh question, or the form put away.
  function setupTyped(c, p) {
    typedQ = TYPED_STYLES[p] && !c.sentence ? { done: false, kind: '' } : null;
    els.typedForm.hidden = !typedQ;
    els.card.classList.toggle('typed-mode', !!typedQ);
    if (!typedQ) return;
    // The answer is typed first, so a card never starts revealed, whatever “Show the answer at once” says.
    state.revealed = false;
    els.typedInput.value = '';
    els.typedInput.className = 'type-input';
    els.typedInput.removeAttribute('aria-describedby');
    els.typedLabel.textContent = p === 'dictate' ? 'Type the pinyin of the word you hear, with tone numbers or tone marks'
      : 'Type the pinyin of this word, with tone numbers or tone marks';
    els.typedResult.hidden = true;
    els.typedResult.textContent = '';
    els.btnTypedRight.hidden = true;
    setLabel(els.btnTypedCheck, 'Check');
  }
  // Keeps the result and the field in sight. The on-screen keyboard shrinks only the visual viewport, and the answer
  // bar sticks to the bottom of the page, so the room ends at whichever comes first.
  function keepTypedInView() {
    if (testing || !typedQ) return;
    var vv = window.visualViewport, top = vv ? vv.offsetTop : 0, bottom = top + (vv ? vv.height : window.innerHeight);
    var bar = document.querySelector('.actions'), bt = bar ? bar.getBoundingClientRect().top : bottom;
    if (bt > top + 120 && bt < bottom) bottom = bt;
    var r = els.typedForm.getBoundingClientRect(), head = els.cardHanzi.getBoundingClientRect();
    // The characters above the result too, when there is room for both.
    var from = head.height && r.bottom - head.top + 16 <= bottom - top ? head.top : r.top;
    if (r.bottom + 12 > bottom) window.scrollBy(0, r.bottom + 12 - bottom);
    else if (from - 8 < top) window.scrollBy(0, Math.max(from - 8 - top, r.bottom + 12 - bottom));
  }
  // The result is complete in itself (word, pinyin, meaning), so it reads well in the little room a keyboard leaves.
  function showTypedResult(c, g) {
    var box = els.typedResult;
    box.textContent = '';
    box.className = 'typed-result ' + g.kind;
    box.appendChild(el('p', 'typed-verdict', g.kind === 'right' ? '✓ Right' : g.kind === 'tone' ? '≈ Right letters, wrong tone' : '✗ Not quite'));
    var line = el('p', 'typed-word'), zh = el('span', 'typed-zh', c.zh), py = el('span', 'typed-py'), notes = [];
    zh.setAttribute('lang', 'zh-CN');
    py.setAttribute('lang', 'zh-Latn-pinyin');
    g.syls.forEach(function (s, i) {
      if (i) py.appendChild(document.createTextNode(' '));
      py.appendChild(el('span', (state.toneColors ? 't' + s.tone : '') + (s.off ? ' syl-off' : ''), s.text));
      if (s.off) notes.push(s.text + ' is ' + TONE_SAY[s.tone] + (s.got === 5 ? ', you typed no tone' : s.got ? ', you typed ' + s.got : ', you typed two tones'));
    });
    line.appendChild(zh);
    line.appendChild(py);
    box.appendChild(line);
    var m = el('p', 'typed-mean', shortText(mainMeaning(c)));
    m.setAttribute('lang', mainLang(c));
    box.appendChild(m);
    if (notes.length) box.appendChild(el('p', 'typed-note typed-off', notes.join(' · ')));
    box.hidden = false;
  }
  // Enter or the button: grade the answer first, go on to the next card after that.
  function submitTyped() {
    var c = cardOnScreen();
    if (!typedQ || !c || busy) return;
    if (typedQ.done) { act(typedQ.kind === 'right' ? 'known' : 'learning'); return; }
    var typed = els.typedInput.value.trim(), g = typedGrade(typed, c);
    if (g.kind === 'empty') { announce('Type the pinyin first.'); return; }
    typedQ.done = true;
    typedQ.kind = g.kind;
    showTypedResult(c, g);
    els.typedInput.classList.add('graded', g.kind);
    els.typedInput.setAttribute('aria-describedby', 'typedResult');
    els.btnTypedRight.hidden = g.kind === 'right';
    setLabel(els.btnTypedCheck, 'Next');
    buzz(g.kind === 'right' ? 12 : [30, 60, 30]);
    setRevealed(true);
    var off = g.syls.filter(function (s) { return s.off; }).map(function (s) { return s.text + ' is ' + TONE_SAY[s.tone]; });
    announce((g.kind === 'right' ? 'Correct: ' : g.kind === 'tone' ? 'Right letters, wrong tone: ' + off.join(', ') + '. The word is ' : 'Not quite. The answer is ') +
      c.zh + ', ' + c.py + '. Press Enter to go on.');
    keepTypedInView();
  }
  // A slip of the finger: nothing was recorded yet, so this records the card as known.
  function typedOverride() {
    if (!typedQ || !typedQ.done || typedQ.kind === 'right' || busy) return;
    typedQ.kind = 'right';
    act('known');
  }
  // The field takes the focus on each new card once the user has started typing or tapping, so a run needs no mouse.
  function focusTyped() {
    if (!typedQ || testing) return;
    if (document.activeElement !== els.typedInput && userHasInteracted && !anyOverlayOpen()) {
      try { els.typedInput.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
    // Each card lays the field out anew, so a field in use is brought back into sight.
    if (document.activeElement === els.typedInput) setTimeout(keepTypedInView, 60);
  }
  function wireTyped() {
    on('typedForm', 'submit', function (e) {
      e.preventDefault();
      if (typedKeepFocus && document.activeElement !== els.typedInput) { try { els.typedInput.focus({ preventScroll: true }); } catch (err) { /* ignore */ } }
      typedKeepFocus = false;
      submitTyped();
    });
    // A tap on the button must not take the focus from the field: on a phone that would close the keyboard.
    on('btnTypedCheck', 'pointerdown', function () { typedKeepFocus = document.activeElement === els.typedInput; });
    els.btnTypedCheck.addEventListener('mousedown', function (e) { if (typedKeepFocus) e.preventDefault(); });
    on('btnTypedRight', 'click', function () { typedOverride(); });
    // Once graded, the typed text stays as it was; Enter still goes on.
    on('typedInput', 'beforeinput', function (e) {
      if (typedQ && typedQ.done && e.inputType !== 'insertLineBreak') e.preventDefault();
    });
    els.typedInput.addEventListener('focus', function () { setTimeout(keepTypedInView, 350); });
    els.typedInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); els.typedInput.blur(); }
    });
  }
