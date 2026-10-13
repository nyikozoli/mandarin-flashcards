  /* ---------- answering ---------- */
  function act(kind, grade) {
    if (busy) return false;
    if (rehearseCard) return actRehearse(kind, grade);
    var i = currentIndex();
    if (i === null) return false;
    var c = cards[i];
    var entry = { pos: state.pos, zh: c.zh, prev: state.status[c.zh] || null, srs: state.srs[c.zh] || null,
      miss: state.misses[c.zh] || 0, day: dayKey(), kind: kind, requeued: false, r: isRehearseStyle(state.practice) };
    undoStack.push(entry);
    if (undoStack.length > 200) undoStack.shift();
    if (kind === 'known' || kind === 'learning') {
      applySrs(c, kind, grade);
      state.status[c.zh] = markAfter(c, kind);
      if (!testing) recordAnswer(kind, c, entry.prev); else entry.kind = 'skip';
    }
    // In the review deck a missed word comes back at the end of the session.
    if (kind === 'learning' && state.mode === 'due' && state.deck.indexOf(i, state.pos + 1) === -1) { state.deck.push(i); entry.requeued = true; }
    if (kind !== 'skip') buzz(kind === 'known' ? 12 : 25);
    stopSpeech();
    var finish = function () {
      state.pos += 1;
      state.revealed = state.autoReveal;
      maybeInterject(kind);
      render(true);
      save();
      afterAnswer(kind);
    };
    if (testing || reduceMotion) {
      resetCardPosition();
      finish();
      return true;
    }
    busy = true;
    var card = els.card;
    card.classList.remove('enter', 'dragging');
    card.style.transform = '';
    card.classList.add(kind === 'known' ? 'fly-right' : kind === 'learning' ? 'fly-left' : 'fly-up');
    // A timer (not transitionend) drives the next step, so the app never depends on the animation running.
    setTimeout(function () {
      card.classList.add('no-anim');
      card.classList.remove('fly-right', 'fly-left', 'fly-up');
      resetCardPosition();
      void card.offsetWidth;
      card.classList.remove('no-anim');
      busy = false;
      finish();
    }, 230);
    return true;
  }
  function undo() {
    if (busy) return;
    var h = undoStack.pop();
    if (!h) { toast('Nothing to undo.'); return; }
    if (h.rehearse) { undoRehearse(h); return; }
    rehearseCard = null;
    if (h.prev) state.status[h.zh] = h.prev;
    else delete state.status[h.zh];
    if (h.srs) state.srs[h.zh] = h.srs; else delete state.srs[h.zh];
    if (h.miss) state.misses[h.zh] = h.miss; else delete state.misses[h.zh];
    if (h.requeued) state.deck.pop();
    var a = state.activity[h.day];
    if (a && (h.kind === 'known' || h.kind === 'learning')) { if (h.kind === 'known') a.k = Math.max(0, a.k - 1); else a.l = Math.max(0, a.l - 1); if (h.r) a.r = Math.max(0, (a.r || 0) - 1); }
    state.pos = Math.min(h.pos, state.deck.length);
    state.revealed = state.autoReveal;
    stopSpeech();
    render(true);
    save();
  }
  // Styles where you judge yourself; the quiz styles grade the answer for you.
  function selfGraded() { var p = practiceNow(); return (['zh', 'reverse', 'listen', 'hanzi'].indexOf(p) !== -1 || isRehearseStyle(p)) && !toneQ; }
  function updateGrades() {
    var c = cardOnScreen();
    els.gradeRow.hidden = !state.revealed || !c || !selfGraded();
    if (els.gradeRow.hidden) return;
    Array.prototype.forEach.call(els.gradeRow.querySelectorAll('.grade'), function (b) {
      var wait = fmtWait(SRS_DAYS[withSkill(skillNow(), function () { return nextBox(c, b.getAttribute('data-grade')); })]);
      b.querySelector('small').textContent = wait;
      var gname = { hard: 'Hard', good: 'Good', easy: 'Easy' }[b.getAttribute('data-grade')];
      b.setAttribute('aria-label', gname + ': next review in ' + (wait === 'today' ? 'today' : wait.replace(' d', ' days').replace(' mo', ' months')));
    });
  }
  function setRevealed(v) {
    var was = state.revealed;
    state.revealed = !!v;
    els.card.classList.toggle('revealed', state.revealed);
    updateGrades();
    els.revealHint.setAttribute('aria-expanded', state.revealed ? 'true' : 'false');
    els.revealHint.setAttribute('aria-label', state.revealed ? 'Hide the answer' : 'Show the answer');
    var p = practiceNow();
    els.cardPrompt.hidden = state.revealed || !(p === 'reverse' || p === 'listen' || toneQ || clozeQ || buildQ || similarQ || isRehearseStyle(p));
    els.revealHint.textContent = state.revealed
      ? 'Tap the characters to hide the meaning · swipe → know · ← learning'
      : p === 'tone'
        ? (toneQ ? 'Listen, then pick the tone of the first syllable (keys 1–4)' : 'Tap the card to show the meaning')
        : p === 'tonepair' ? (toneQ ? 'Listen, then pick both tones (keys 1–4)' : 'Tap the card to show the meaning')
        : p === 'pairs' ? (similarQ ? 'Read the meaning (and hear it), then pick the right word (keys 1–4)' : 'Tap the card to show the meaning')
        : p === 'build' ? (buildQ ? 'Tap the words in order; tap a placed word to take it back (Backspace)' : 'Tap the card to show the meaning')
        : p === 'cloze' ? (clozeQ ? 'Pick the word that fills the gap (keys 1–4)' : 'Tap the card to show the meaning')
        : p === 'zh' && readingHidden ? 'You know this one well: read it, then tap the card to check the pinyin'
        : isRehearseStyle(p) ? 'Say it in ' + langName(rehearseCode(p)) + ', then tap the card to check'
        : { zh: 'Tap the card to show the meaning', reverse: isSent() ? 'Say the Chinese sentence, then tap the card to check' : 'Say it, or type the pinyin (T), then tap the card to check',
            listen: 'Listen, then tap the card to see the word', choice: 'Pick the meaning (keys 1–4), or tap the card to reveal',
            hanzi: 'Read the characters aloud, then tap the card to check the pinyin and meaning' }[p];
    // With "Read each new card aloud" on, revealing reads the Chinese and then its meaning, when the setting allows.
    if (state.revealed && !was && state.autoplay && !testing && userHasInteracted) {
      var ci = currentIndex(), rc = rehearseCard ? wordByZh(rehearseCard.zh) : ci === null ? null : cards[ci];
      var extra = rc ? meaningSpeech(rc) : [];
      if (extra.length) speakParts([rc.zh].concat(extra), null);
    }
  }
  function toggleReveal() {
    if (currentIndex() === null) return;
    setRevealed(!state.revealed);
  }

  /* ---------- rendering ---------- */
  function render(animate) {
    els.legendTones.hidden = !state.toneColors;
    updateStats();
    els.btnUndo.disabled = undoStack.length === 0;
    var i = currentIndex();
    if (rehearseCard && (state.deckType !== 'words' || langRole(rehearseCard.code) !== 'rehearse' || !wordByZh(rehearseCard.zh))) rehearseCard = null;
    if (rehearseCard) showCard(wordByZh(rehearseCard.zh), animate);
    else if (i === null) showEnd();
    else showCard(cards[i], animate);
  }

  // Memory hints for the word's characters, on the back of word cards.
  function renderHints(c) {
    var list = c.sentence ? [] : hintsFor(c);
    els.cardHints.hidden = !list.length;
    els.cardHints.textContent = '';
    list.forEach(function (h) {
      var row = el('div', 'hint-row');
      var ch = el('span', 'hint-ch', h.ch);
      ch.setAttribute('lang', 'zh-CN');
      row.appendChild(ch);
      var tx = el('div', 'hint-text');
      tx.appendChild(el('p', 'hint-parts', h.parts));
      tx.appendChild(el('p', 'hint-en', h.en));
      var hu = el('p', 'hint-hu', h.hu);
      hu.setAttribute('lang', 'hu');
      tx.appendChild(hu);
      row.appendChild(tx);
      els.cardHints.appendChild(row);
    });
  }
  function showCard(c, animate) {
    els.deckEnd.hidden = true;
    els.card.hidden = false;
    els.cardNumber.textContent = lvName(c.lv) + ' · ' + deck().number + c.n;
    els.cardBrand.hidden = !c.br;
    els.cardRank.hidden = !c.rk;
    if (c.rk) {
      els.cardRank.textContent = '#' + c.rk + ' most used';
      els.cardRank.title = 'The ' + c.rk + ordinal(c.rk) + ' most frequent word in written and spoken Chinese (wordfreq)';
    }
    closeWordPop(false);
    renderHanzi(els.cardHanzi, c.zh, c.py, !!c.sentence, c.sentence ? c.lv : 0);
    els.cardHanzi.setAttribute('data-len', String(Math.min(6, charLen(c.zh))));
    renderPinyin(els.cardPinyin, c.py);
    els.cardEn.textContent = c.en;
    els.cardHu.textContent = c.hu;
    var on = langsOn(), main = mainLang(c), lead = main !== baseLang() ? main : '';
    els.cardMeanMain.textContent = '';
    if (lead) {
      var mm = el('div', 'meaning main-mean');
      mm.appendChild(el('span', 'tag ' + lead, lead.toUpperCase()));
      var mt = el('p', null, mean(c, lead));
      mt.setAttribute('lang', lead);
      mm.appendChild(mt);
      els.cardMeanMain.appendChild(mm);
    }
    els.cardEn.parentNode.hidden = on.indexOf('en') === -1 || lead === 'en';
    els.cardHu.parentNode.hidden = on.indexOf('hu') === -1 || lead === 'hu';
    els.cardMeanMore.textContent = '';
    on.forEach(function (k) {
      if (k === 'en' || k === 'hu' || k === lead) return;
      var m = el('div', 'meaning');
      m.appendChild(el('span', 'tag ' + k, k.toUpperCase()));
      var t = el('p', null, mean(c, k));
      t.setAttribute('lang', k);
      m.appendChild(t);
      els.cardMeanMore.appendChild(m);
    });
    setSpeaker(els.cardEn, 'en', c.en);
    setSpeaker(els.cardHu, 'hu', c.hu);
    Array.prototype.forEach.call(els.cardMeanMore.querySelectorAll('.meaning'), function (m) {
      var p = m.querySelector('p');
      m.appendChild(speakBtn(p.getAttribute('lang'), p.textContent));
    });
    if (lead) els.cardMeanMain.firstChild.appendChild(speakBtn(lead, mean(c, lead)));
    renderHints(c);
    els.cardExamples.textContent = '';
    c.ex.forEach(function (e, k) {
      var box = el('div', 'ex');
      var sb = el('button', 'ex-speak', '🔊');
      sb.type = 'button';
      sb.setAttribute('data-ex', String(k));
      sb.setAttribute('aria-label', 'Read this sentence aloud');
      sb.title = 'Read this sentence aloud';
      var zh = el('p', 'ex-zh');
      zh.setAttribute('lang', 'zh-CN');
      if (c.sentence) zh.textContent = e.zh; else renderSentence(zh, e.zh, c.zh, c.lv);
      var py = el('p', 'ex-py');
      py.setAttribute('lang', 'zh-Latn-pinyin');
      renderPinyin(py, e.py);
      box.appendChild(sb); box.appendChild(zh); box.appendChild(py);
      meaningLines(box, e, 'ex-line');
      els.cardExamples.appendChild(box);
    });
    if (c.sentence) els.cardExamples.insertBefore(el('p', 'ex-caption', c.ex.length > 1 ? 'From the words' : 'From the word'), els.cardExamples.firstChild);
    else {
      var ps = el('button', 'btn small ex-practice', c.ex.length > 1 ? 'Practice these ' + c.ex.length + ' sentences' : 'Practice this sentence');
      ps.type = 'button';
      els.cardExamples.appendChild(ps);
    }
    var s = withSkill(skillNow(), function () { return statusOf(c); });
    els.cardStatus.textContent = s === 'unmarked' ? 'New' : STATUS_NAMES[s];
    els.cardStatus.className = 'status-tag' + (s === 'unmarked' ? '' : ' ' + s);
    els.cardSkills.textContent = '';
    els.cardSkills.appendChild(skillMarks(c));
    applyPractice(c);
    // In these styles the word or its reading is the answer, so a screen reader must not hear it either.
    var reading = readingHidden ? '' : ', ' + c.py;
    els.card.setAttribute('aria-label', 'Flashcard ' + (state.pos + 1) + (faceHidden ? '' : ': ' + c.zh + reading));
    setRevealed(state.revealed);
    // "Card" is dropped visually on the narrowest phones; the text (and the screen reader) keep it.
    els.cardCounter.textContent = '';
    els.cardCounter.appendChild(el('span', 'counter-word', 'Card '));
    els.cardCounter.appendChild(document.createTextNode((state.pos + 1) + ' / ' + state.deck.length));
    setActionsEnabled(true);
    if (animate && !reduceMotion && !testing) {
      els.card.classList.remove('enter');
      void els.card.offsetWidth;
      els.card.classList.add('enter');
    }
    if (animate && !testing) {
      announce('Card ' + (state.pos + 1) + ' of ' + state.deck.length + '. ' + (practiceNow() === 'reverse' ? 'Meaning: ' + c.en + '.' :
        practiceNow() === 'listen' ? 'Listen to the ' + noun(1) + '.' :
        toneQ ? 'Listen to ' + c.zh + ', then pick ' + (toneQ.pair ? 'both tones.' : 'the tone of the first syllable.') :
        buildQ ? 'Put the words in order: ' + c.en :
        similarQ ? 'Which word means: ' + shortText(mainMeaning(c)) + '?' :
        clozeQ ? 'Which word fills the gap? ' + clozeQ.blanked.replace(/＿+/g, ' blank ') + ' ' + clozeQ.ex.en :
        c.zh + (readingHidden ? '.' : ', ' + c.py + '.')));
    }
    // The tone quizzes always speak: hearing the word is the question.
    if (animate && !testing && ((state.autoplay && !readingHidden && !faceHidden) || practiceNow() === 'listen' || practiceNow() === 'tone' || !!toneQ) && userHasInteracted) {
      var pos = state.pos;
      setTimeout(function () { if (state.pos === pos && currentIndex() !== null) speakParts([c.zh], null); }, 280);
    }
  }
  var userHasInteracted = false;

  function showEnd() {
    if (roundReturn && endRehearseRound()) return;
    var n = counts();
    var total = state.deck.length;
    els.card.hidden = true;
    els.deckEnd.hidden = false;
    setActionsEnabled(false);
    if (!cards.length) {
      els.endEmoji.textContent = '⚠';
      els.endTitle.textContent = 'No cards loaded';
      els.endText.textContent = 'The vocabulary list is empty, so there is nothing to study. See the error message above.';
      els.cardCounter.textContent = 'Card 0 / 0';
    } else if (!total) {
      els.endEmoji.textContent = state.mode === 'unmarked' ? '🎉' : '📭';
      els.endTitle.textContent = state.mode === 'learning' ? 'No learning cards' : 'No new cards';
      els.endText.textContent = state.mode === 'learning'
        ? 'You have not marked any card as “Still learning” yet. Study all cards and swipe left on words you want to practise.'
        : 'Every word is already marked as Known or Learning.';
      els.cardCounter.textContent = 'Card 0 / 0';
    } else {
      els.endEmoji.textContent = '🎉';
      els.endTitle.textContent = 'Deck complete';
      els.endText.textContent = 'You went through all ' + total + ' cards (' + MODE_NAMES[state.mode] + '). Known: ' + n.known +
        ' · Learning: ' + n.learning + ' · New: ' + n.unmarked + '.';
      els.cardCounter.textContent = 'Done · ' + total + ' / ' + total;
    }
    els.btnEndRestart.hidden = !total;
    els.btnEndLearning.textContent = 'Study learning cards (' + n.learning + ')';
    els.btnEndLearning.disabled = n.learning === 0;
    els.btnEndUnmarked.textContent = 'Study new cards (' + n.unmarked + ')';
    els.btnEndUnmarked.disabled = n.unmarked === 0;
    els.btnEndAll.textContent = 'All cards (' + cards.length + ')';
    els.btnEndAll.disabled = !cards.length;
    stopSpeech();
  }

  function setActionsEnabled(v) {
    els.btnKnown.disabled = !v;
    els.btnLearning.disabled = !v;
    els.btnSkip.disabled = !v;
  }

  function updateStats() {
    var n = counts();
    els.knownCount.textContent = String(n.known);
    els.learningCount.textContent = String(n.learning);
    els.unmarkedCount.textContent = String(n.unmarked);
    els.countAll.textContent = String(n.total);
    els.countLearningMode.textContent = String(n.learning);
    els.countUnmarkedMode.textContent = String(n.unmarked);
    var pk = n.total ? (n.known / n.total) * 100 : 0;
    var pl = n.total ? (n.learning / n.total) * 100 : 0;
    els.progKnown.style.width = pk + '%';
    els.progLearning.style.width = pl + '%';
    els.progressBar.setAttribute('aria-valuemax', String(n.total));
    els.progressBar.setAttribute('aria-valuenow', String(n.known));
    els.progressBar.setAttribute('aria-valuetext', n.known + ' of ' + n.total + ' known, ' + n.learning + ' learning');
    els.progressLabel.textContent = n.known + ' of ' + n.total + ' known (' + Math.round(pk) + '%) · ' + n.learning + ' still learning';
    els.countDueMode.textContent = String(dueCount(state.level));
    els.countHardMode.textContent = String(hardList().length);
    ['modeAll', 'modeDue', 'modeLearning', 'modeUnmarked', 'modeHard'].forEach(function (id) {
      var b = els[id];
      var on = b.getAttribute('data-mode') === state.mode;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    ['levelAll'].concat(LEVELS.map(function (l) { return 'level' + l; })).forEach(function (id) {
      var b = els[id];
      var on = b.getAttribute('data-level') === state.level;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    els.countLvAll.textContent = String(cards.length);
    LEVELS.forEach(function (lv) { var n = countsFor(lv); els['countLv' + lv].textContent = n.known + '/' + n.total; });
    updateToday();
    syncPracticeButton();
    renderLadderStrip();
  }

  function updateFootnote() {
    var v = validateCards();
    var ok = v.count === EXPECTED_COUNT && !v.missing.length && !v.dups.length;
    els.footnote.textContent = '';
    els.footnote.appendChild(el('span', ok ? 'ok' : 'bad', ok ? '✓ ' + v.count + ' cards loaded' : '⚠ ' + v.count + ' cards loaded (expected ' + EXPECTED_COUNT + ')'));
    // Signed in to cloud sync (the website only), progress also lives in the account.
    var synced = syncEnabled() && !!sync.session;
    els.footnote.appendChild(document.createTextNode(' · works offline · ' + (!storageOK ? 'progress cannot be saved (storage blocked)'
      : synced ? 'progress is saved in this browser and synced to your account' : 'progress is saved in this browser')));
    // A permanent way back to the release notes, after the one-time notice is gone.
    var n = latestNews();
    if (n) {
      var links = el('span', 'foot-links', ' · ');
      var b = el('button', 'linkish foot-news', 'What’s new in ' + n.version);
      b.type = 'button';
      b.setAttribute('data-news', '1');
      links.appendChild(b);
      els.footnote.appendChild(links);
    }
  }

  /* ---------- swipe ---------- */
  var drag = null;
  var suppressClick = false;
  function resetCardPosition() {
    els.card.style.transform = '';
    els.card.style.setProperty('--know-o', '0');
    els.card.style.setProperty('--learn-o', '0');
  }
  function initSwipe() {
    var card = els.card;
    on('card', 'pointerdown', function (e) {
      if (busy || (e.button !== undefined && e.button !== 0)) return;
      if (e.target.closest && e.target.closest('button, input, form')) return;
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId, dx: 0, active: false };
    });
    card.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.active) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          drag.active = true;
          card.classList.add('dragging');
          try { card.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
        } else if (Math.abs(dy) > 12) {
          drag = null;
          return;
        } else {
          return;
        }
      }
      drag.dx = dx;
      card.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 22) + 'deg)';
      card.style.setProperty('--know-o', String(Math.max(0, Math.min(1, dx / 110))));
      card.style.setProperty('--learn-o', String(Math.max(0, Math.min(1, -dx / 110))));
    });
    var end = function (e, cancelled) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag;
      drag = null;
      if (!d.active) return;
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 350);
      card.classList.remove('dragging');
      var threshold = Math.min(110, card.offsetWidth * 0.25);
      if (!cancelled && d.dx > threshold) act('known');
      else if (!cancelled && d.dx < -threshold) act('learning');
      else resetCardPosition();
    };
    card.addEventListener('pointerup', function (e) { end(e, false); });
    card.addEventListener('pointercancel', function (e) { end(e, true); });
    on('card', 'click', function (e) {
      if (suppressClick) { suppressClick = false; return; }
      if (e.target.closest && e.target.closest('button, input, form')) return;
      // Once the answer shows, taps inside it (meanings, hints, examples) leave it open; the card's top half hides it.
      if (state.revealed && els.cardAnswer.contains(e.target)) return;
      var sel = window.getSelection && window.getSelection();
      if (sel && String(sel).length > 0 && els.cardAnswer.contains(sel.anchorNode)) return;
      toggleReveal();
    });
  }

