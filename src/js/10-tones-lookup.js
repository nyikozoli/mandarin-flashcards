  /* ---------- tone colours ---------- */
  var TONE_OF = {};
  'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙ'.split('').forEach(function (ch, i) { TONE_OF[ch] = (i % 4) + 1; });
  var PY_V = 'aeiouüvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
  var PY_SYL = new RegExp('(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?[' + PY_V + ']+(?:ng(?![' + PY_V + '])|n(?![' + PY_V + '])|r(?![' + PY_V + ']))?', 'gi');
  function toneOf(syl) {
    for (var i = 0; i < syl.length; i++) { var t = TONE_OF[syl.charAt(i)]; if (t) return t; }
    return 5;
  }
  function pinyinTokens(py) {
    var out = [], last = 0, m;
    PY_SYL.lastIndex = 0;
    while ((m = PY_SYL.exec(py))) {
      if (m.index > last) out.push({ text: py.slice(last, m.index) });
      out.push({ text: m[0], tone: toneOf(m[0]) });
      last = m.index + m[0].length;
    }
    if (last < py.length) out.push({ text: py.slice(last) });
    return out;
  }
  function isHan(ch) { return /[㐀-鿿]/.test(ch); }
  function renderPinyin(node, py) {
    node.textContent = '';
    if (!state.toneColors) { node.textContent = py; return; }
    pinyinTokens(py).forEach(function (t) {
      if (t.tone) node.appendChild(el('span', 't' + t.tone, t.text));
      else node.appendChild(document.createTextNode(t.text));
    });
  }
  // Colours each character with the tone of its syllable; 儿 used as erhua shares the previous syllable.
  // Each character sits in its own 米字格 cell and takes the tone colour of its syllable; 儿 as erhua shares the previous one.
  function renderHanzi(node, zh, py, tappable) {
    node.textContent = '';
    var tones = pinyinTokens(py).filter(function (t) { return t.tone; }).map(function (t) { return t.tone; });
    var chars = Array.from(zh), parts = [], ti = 0, prev = 0;
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      if (!isHan(ch)) { parts.push([ch, 0]); continue; }
      var erhua = ch === '儿' && i > 0 && isHan(chars[i - 1]) && chars[i - 1] !== '女' && chars[i + 1] !== '子';
      var t = erhua ? prev : tones[ti++];
      prev = t;
      parts.push([ch, t]);
    }
    var useTones = state.toneColors && ti === tones.length && !parts.some(function (p) { return isHan(p[0]) && !p[1]; });
    var put = function (into, p) {
      if (!isHan(p[0])) { into.appendChild(document.createTextNode(p[0])); return; }
      into.appendChild(el('span', 'cell' + (useTones ? ' t' + p[1] : ''), p[0]));
    };
    if (!tappable) { parts.forEach(function (p) { put(node, p); }); return; }
    var at = 0;
    segment(zh).forEach(function (sg) {
      var into = sg.word ? wordButton(sg.word) : node;
      for (var k = 0; k < sg.len; k++) put(into, parts[at + k]);
      at += sg.len;
      if (sg.word) node.appendChild(into);
    });
  }
  // The four marks each vowel can take; PLAIN_VOWEL reverses it, so a tone can be moved or taken off.
  var TONE_MARK = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' };
  var PLAIN_VOWEL = {};
  Object.keys(TONE_MARK).forEach(function (v) { TONE_MARK[v].split('').forEach(function (m) { PLAIN_VOWEL[m] = v; }); });
  function stripTone(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) out += PLAIN_VOWEL[s.charAt(i)] || s.charAt(i);
    return out;
  }
  // Rewrites a syllable in another tone. The mark goes on a, e or o when there is one, on the u of iu and the i of ui,
  // and otherwise on the last vowel.
  function retone(syl, tone) {
    if (tone === 5) return stripTone(syl);
    var base = stripTone(syl), lower = base.toLowerCase(), at = -1, i;
    for (i = 0; i < lower.length && at === -1; i++) if ('aeo'.indexOf(lower.charAt(i)) !== -1) at = i;
    if (at === -1) {
      if (lower.indexOf('iu') !== -1) at = lower.indexOf('iu') + 1;
      else if (lower.indexOf('ui') !== -1) at = lower.indexOf('ui') + 1;
      else for (i = lower.length - 1; i >= 0; i--) if ('aeiouü'.indexOf(lower.charAt(i)) !== -1) { at = i; break; }
    }
    var ch = base.charAt(at), marks = TONE_MARK[ch] || TONE_MARK[ch.toLowerCase()];
    if (!marks) return base;
    var mark = marks.charAt(tone - 1);
    return base.slice(0, at) + (ch === ch.toUpperCase() ? mark.toUpperCase() : mark) + base.slice(at + 1);
  }
  // The syllable a tone quiz can ask about, or null. A neutral first syllable has no tone to hear, and speech turns the
  // first of a 3-3 pair into tone 2, so the written citation tone would not be what is said.
  function toneQuizTarget(c) {
    if (isSent() || c.sentence) return null;
    var syls = pinyinTokens(c.py).filter(function (t) { return t.tone; });
    if (!syls.length || syls[0].tone === 5) return null;
    if (syls.length > 1 && syls[0].tone === 3 && syls[1].tone === 3) return null;
    return syls[0];
  }

  /* ---------- word lookup in sentences ---------- */
  // The app's own word list is the dictionary: longest match first, so 学生 wins over 学. Characters that are not part
  // of any HSK 1–3 word stay plain text.
  var lexicon = null;
  function getLexicon() {
    if (lexicon) return lexicon;
    lexicon = { map: {}, max: 1 };
    wordCards.forEach(function (w) { lexicon.map[w.zh] = w; lexicon.max = Math.max(lexicon.max, charLen(w.zh)); });
    return lexicon;
  }
  // Splits a sentence into runs of { text, word, len }; word is the card for a known word, null for anything else.
  function segment(zh) {
    var lex = getLexicon(), chars = Array.from(zh), out = [], i = 0;
    while (i < chars.length) {
      var hit = null, len = 0;
      if (isHan(chars[i])) {
        for (var L = Math.min(lex.max, chars.length - i); L > 0 && !hit; L--) {
          var cand = chars.slice(i, i + L).join('');
          if (lex.map[cand]) { hit = lex.map[cand]; len = L; }
        }
      }
      if (hit) { out.push({ text: hit.zh, word: hit, len: len }); i += len; continue; }
      var last = out[out.length - 1];
      if (last && !last.word) { last.text += chars[i]; last.len++; } else out.push({ text: chars[i], word: null, len: 1 });
      i++;
    }
    return out;
  }
  function wordButton(w) {
    var b = el('button', 'w');
    b.type = 'button';
    b.setAttribute('data-w', w.zh);
    b.setAttribute('aria-haspopup', 'dialog');
    b.setAttribute('aria-expanded', 'false');
    return b;
  }
  // An example sentence with tappable words. The card's own word is highlighted rather than tappable.
  function renderSentence(node, zh, headword) {
    node.textContent = '';
    segment(zh).forEach(function (sg) {
      if (!sg.word) { node.appendChild(document.createTextNode(sg.text)); return; }
      if (sg.word.zh === headword) { node.appendChild(el('b', 'w-head', sg.text)); return; }
      var b = wordButton(sg.word);
      b.textContent = sg.text;
      node.appendChild(b);
    });
  }
  var popAnchor = null, popWord = null;
  function openWordPop(anchor) {
    var w = getLexicon().map[anchor.getAttribute('data-w')];
    if (!w) return;
    closeWordPop(false);
    popAnchor = anchor;
    popWord = w;
    renderHanzi(els.wordPopZh, w.zh, w.py);
    renderPinyin(els.wordPopPy, w.py);
    els.wordPopLv.textContent = 'HSK ' + w.lv;
    els.wordPopEn.textContent = w.en;
    els.wordPopHu.textContent = w.hu;
    var on = langsOn();
    els.wordPopEn.parentNode.hidden = on.indexOf('en') === -1;
    els.wordPopHu.parentNode.hidden = on.indexOf('hu') === -1;
    els.wordPopMore.textContent = '';
    meaningLines(els.wordPopMore, { en: '', hu: '', tr: w.tr }, 'ex-line');
    Array.prototype.forEach.call(els.wordPopMore.querySelectorAll('[lang="en"], [lang="hu"]'), function (n) { n.parentNode.removeChild(n); });
    els.wordPop.hidden = false;
    anchor.setAttribute('aria-expanded', 'true');
    placeWordPop(anchor);
    if (!testing && focusedByKeyboard(anchor)) { try { els.btnWordPopClose.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  function closeWordPop(refocus) {
    if (els.wordPop.hidden) return;
    els.wordPop.hidden = true;
    var a = popAnchor;
    popAnchor = popWord = null;
    if (!a) return;
    a.setAttribute('aria-expanded', 'false');
    if (refocus && !testing && document.contains(a)) { try { a.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  // Below the word when it fits, above it otherwise, always inside the viewport.
  function placeWordPop(anchor) {
    var pop = els.wordPop, m = 12, r = anchor.getBoundingClientRect();
    pop.style.left = '0px';
    pop.style.top = '0px';
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight;
    var top = r.bottom + 8;
    if (top + h > vh - m && r.top - 8 - h >= m) top = r.top - 8 - h;
    pop.style.left = Math.max(m, Math.min(vw - w - m, r.left + r.width / 2 - w / 2)) + 'px';
    pop.style.top = Math.max(m, Math.min(vh - h - m, top)) + 'px';
  }
  function bindWordLookup() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button.w') : null;
      if (!b) return;
      if (b === popAnchor) closeWordPop(false); else openWordPop(b);
    });
    // A tap outside closes the word. On the card it only closes it, so the card does not also flip.
    document.addEventListener('click', function (e) {
      if (els.wordPop.hidden || els.wordPop.contains(e.target)) return;
      if (e.target.closest && e.target.closest('button.w')) return;
      closeWordPop(false);
      if (els.card.contains(e.target)) { e.stopPropagation(); e.preventDefault(); }
    }, true);
    window.addEventListener('resize', function () { closeWordPop(false); });
    window.addEventListener('scroll', function () { closeWordPop(false); }, true);
    on('btnWordPopClose', 'click', function () { closeWordPop(true); });
    on('btnWordPopSpeak', 'click', function () { if (popWord) speakParts([popWord.zh], els.btnWordPopSpeak); });
  }

  /* ---------- typed answers ---------- */
  // Does the typed pinyin match the card? Accepts tone numbers (xue2sheng, 5 or 0 or nothing for neutral) or tone marks
  // (xuésheng), any spacing, apostrophes and capitals, v or u: for ü, the tone digit after an erhua r, and the
  // citation tone of 一 and 不 as well as the changed one that the card shows.
  function typedMatches(input, c) {
    var raw = String(input || '').toLowerCase().replace(/u:/g, 'v').replace(/ü/g, 'v').replace(/[\s'’\-·.,]/g, '');
    if (!raw) return false;
    var plain = '', marks = [];
    Array.from(raw).forEach(function (ch) {
      var v = PLAIN_VOWEL[ch];
      if (v) { plain += v === 'ü' ? 'v' : v; marks.push(TONE_MARK[v].indexOf(ch) + 1); }
      else { plain += ch; marks.push(0); }
    });
    var toks = pinyinTokens(c.py).filter(function (t) { return t.tone; });
    var han = Array.from(c.zh).filter(isHan), pos = 0;
    for (var i = 0; i < toks.length; i++) {
      var base = stripTone(toks[i].text).toLowerCase().replace(/ü/g, 'v'), tone = 0, k;
      var digitR = /r$/.test(base) && base.length > 2 && plain.substr(pos, base.length - 1) === base.slice(0, -1) &&
        /[0-5]/.test(plain.charAt(pos + base.length - 1)) && plain.charAt(pos + base.length) === 'r';
      if (digitR) {
        var d0 = Number(plain.charAt(pos + base.length - 1));
        for (k = pos; k < pos + base.length - 1; k++) if (marks[k]) tone = marks[k];
        if (!tone) tone = d0 === 0 ? 5 : d0;
        pos += base.length + 1;
      } else {
        if (plain.substr(pos, base.length) !== base) return false;
        for (k = pos; k < pos + base.length; k++) if (marks[k]) tone = marks[k];
        pos += base.length;
        if (/[0-5]/.test(plain.charAt(pos))) { var d = Number(plain.charAt(pos)); if (!tone) tone = d === 0 ? 5 : d; pos++; }
      }
      if (!tone) tone = 5;
      var want = toks[i].tone, ch = han.length === toks.length ? han[i] : '';
      if (!(tone === want || (ch === '一' && [1, 2, 4].indexOf(tone) !== -1) || (ch === '不' && [2, 4].indexOf(tone) !== -1))) return false;
    }
    return pos === plain.length;
  }
  function checkTyped(form) {
    var i = currentIndex(), input = form.querySelector('input'), res = els.cardPrompt.querySelector('.type-result');
    if (i === null || !input || !input.value.trim() || input.disabled) return;
    var c = cards[i], ok = typedMatches(input.value, c);
    res.textContent = '';
    res.className = 'type-result ' + (ok ? 'right' : 'wrong');
    res.appendChild(document.createTextNode(ok ? '✓ Right: ' : 'Not quite. It is '));
    var zh = el('b', null, c.zh);
    zh.setAttribute('lang', 'zh-CN');
    res.appendChild(zh);
    res.appendChild(document.createTextNode(' ' + c.py + (ok ? '' : '. Try again, or mark it yourself.')));
    buzz(ok ? 12 : [30, 60, 30]);
    if (!ok) { input.select(); return; }
    input.disabled = true;
    if (testing) { act('known'); return; }
    var pos = state.pos;
    setTimeout(function () { if (state.pos === pos && !busy) act('known'); }, 800);
  }

