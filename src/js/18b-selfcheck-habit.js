  /* ---------- self-check: just 5 cards, trouble words, notes ---------- */
  // Each entry runs inside functionalTest (testing = true) on empty marks in the word deck, reading skill.
  // habitTests puts the marks, the deck, the day's activity, the notes and the strips back after every entry.
  var HABIT_TESTS = [];
  function habitTests(add) {
    stashSkill();
    var keep = { marks: JSON.stringify(state.marks), activity: JSON.stringify(state.activity), notes: JSON.stringify(state.notes), mem: JSON.stringify(state.deckMemory),
      practice: state.practice, deckType: state.deckType, deck: state.deck.slice(), pos: state.pos, mode: state.mode, level: state.level, topic: state.topic,
      revealed: state.revealed, shuffled: state.shuffled, troubleSeen: state.troubleSeen, wotdSeen: state.wotdSeen, ladderSeen: state.ladderSeen, filter: listFilter };
    var back = function () {
      OVERLAYS.forEach(function (id) { closeOverlay(els[id]); });
      closeWordPop(false);
      roundReturn = null;
      useDeckType(keep.deckType);
      state.practice = keep.practice;
      state.marks = JSON.parse(keep.marks);
      state.skill = skillOf(state.practice);
      loadSkill();
      state.activity = JSON.parse(keep.activity);
      state.notes = JSON.parse(keep.notes);
      state.deckMemory = JSON.parse(keep.mem);
      state.mode = keep.mode; state.level = keep.level; state.topic = keep.topic;
      state.deck = keep.deck.slice(); state.pos = keep.pos; state.revealed = keep.revealed; state.shuffled = keep.shuffled;
      state.troubleSeen = keep.troubleSeen; state.wotdSeen = keep.wotdSeen; state.ladderSeen = keep.ladderSeen;
      listFilter = keep.filter;
      undoStack = [];
      updateTopicBtn();
      syncPracticeSelect();
    };
    HABIT_TESTS.forEach(function (t) {
      try {
        useDeckType('words');
        state.practice = 'zh';
        resetMarks();
        state.skill = 'read';
        loadSkill();
        state.level = 'all'; state.topic = 'all';
        state.notes = {};
        delete state.activity[dayKey()];
        setMode('all');
        t.run(add);
      } catch (e) { add(t.title, false, 'The test stopped with an error: ' + e.message); }
      back();
    });
    renderWotd();
    render(false);
  }

  HABIT_TESTS.push({ title: 'Just 5 cards: a short round on a day without answers', run: function (add) {
    var today = dayKey(), due = [cards[10], cards[20]];
    due.forEach(function (c) { state.status[c.zh] = 'learning'; state.srs[c.zh] = { b: 1, d: today }; });
    state.pos = 3;
    render(false);
    var shown = !els.btnQuick.hidden && /2 minutes/.test(els.quickSub.textContent);
    // One answer today and the button goes.
    state.activity[today] = { k: 1, l: 0 };
    render(false);
    var goes = els.btnQuick.hidden;
    delete state.activity[today];
    render(false);
    els.btnQuick.click();
    var d = state.deck.slice();
    var five = d.length === QUICK_SIZE && inQuickRound() && els.btnQuick.hidden && state.pos === 0;
    var dueFirst = d.indexOf(10) !== -1 && d.indexOf(20) !== -1 && d.indexOf(10) < 2 && d.indexOf(20) < 2 &&
      d.slice(2).every(function (i) { return statusOf(cards[i]) === 'unmarked'; });
    for (var n = 0; n < QUICK_SIZE; n++) act('known');
    // The normal answer path ran: the due word moved up a box. Then the finish shows over the deck from before.
    var counted = state.srs[due[0].zh].b === 2 && state.srs[cards[d[2]].zh].b === 1;
    var finish = !els.quickView.hidden && !inQuickRound() && state.deck.length === buildDeck('all').length && state.pos === 3 &&
      els.quickTitle.textContent.length > 0 && /Five more, or stop here/.test(els.quickText.textContent);
    els.btnQuickMore.click();
    var more = els.quickView.hidden && inQuickRound() && state.deck.length === QUICK_SIZE &&
      state.deck.every(function (i) { return d.indexOf(i) === -1; });
    for (n = 0; n < QUICK_SIZE; n++) act('skip');
    var again = !els.quickView.hidden;
    els.btnQuickDone.click();
    var done = els.quickView.hidden && !inQuickRound() && state.pos === 3;
    // Choosing a study mode ends a round quietly.
    startQuickRound();
    setMode('due');
    var ends = !inQuickRound() && els.quickView.hidden;
    add('Just 5 cards: a short round on a day without answers', shown && goes && five && dueFirst && counted && finish && more && again && done && ends,
      'button shows with no answers today: ' + shown + ', goes after the first answer: ' + goes + ', round of ' + QUICK_SIZE + ': ' + five +
      ', due reviews first, then new cards: ' + dueFirst + ', answers move the schedule: ' + counted + ', finish over the deck from before: ' + finish +
      ', “Keep going” starts five other cards: ' + more + ', a second finish: ' + again + ', “Done for today” closes it: ' + done + ', a study mode ends the round: ' + ends);
  } });

  HABIT_TESTS.push({ title: 'Trouble words: missed three times and not known', run: function (add) {
    var w = cards[5], v = cards[6], k = cards[7], x = cards[8], today = dayKey();
    var miss = function (c, n, st) { state.misses[c.zh] = n; state.status[c.zh] = st; state.srs[c.zh] = { b: st === 'known' ? 4 : 0, d: st === 'known' ? addDays(14) : today }; };
    miss(w, TROUBLE_MISSES, 'learning'); miss(v, TROUBLE_MISSES - 1, 'learning'); miss(k, 5, 'known'); miss(x, 4, 'learning');
    var def = isTrouble(w) && !isTrouble(v) && !isTrouble(k) && isTrouble(x) && !isTrouble(cards[9]);
    var list = troubleList(), order = list.length === 2 && list[0] === 8 && list[1] === 5 && troubleCount() === 2;
    // Each skill has its own misses.
    useSkill('listen');
    var perSkill = troubleCount() === 0;
    useSkill('read');
    // The strip waits behind the word of the day, and takes the ladder's place.
    state.wotdSeen = ''; state.troubleSeen = ''; renderWotd();
    var waits = els.troubleStrip.hidden;
    state.wotdSeen = today; renderWotd();
    var strip = !els.troubleStrip.hidden && els.troubleText.textContent === '2 trouble words' && els.ladderStrip.hidden &&
      !els.btnSuggest.hidden && els.suggestSeal.textContent === '难' && /trouble/.test(els.suggestSeal.className);
    els.btnTroubleGo.click();
    var deck = state.mode === 'trouble' && state.deck.length === 2 && state.deck[0] === 8 && els.troubleStrip.hidden &&
      els.modeAll.tabIndex === 0 && els.modeAll.getAttribute('aria-checked') === 'false';
    // A miss comes back at the end; undo takes it out again.
    act('learning');
    var requeued = state.deck.length === 3 && state.deck[2] === 8 && state.misses[x.zh] === 5;
    undo();
    var undone = state.deck.length === 2 && state.misses[x.zh] === 4 && state.pos === 0;
    // The mode survives a save and a reload.
    var snapP = JSON.parse(JSON.stringify(progressSnapshot()));
    restore(snapP);
    var saved = snapP.mode === 'trouble' && state.mode === 'trouble' && state.deck.length === 2;
    // Known words leave the list.
    state.status[w.zh] = 'known';
    var leaves = troubleList().length === 1 && !isTrouble(w);
    state.status[w.zh] = 'learning';
    setMode('all');
    renderWotd();
    els.btnTroubleClose.click();
    var hides = state.troubleSeen === today && els.troubleStrip.hidden;
    // The word list: a Trouble chip, the misses, and the deck from there, whatever the level.
    listFilter = 'trouble';
    openList();
    var chip = els.listView.querySelector('.chip[data-filter="trouble"]');
    var rows = els.wordList.querySelectorAll('.word-row').length === 2 && chip.textContent === 'Trouble (2)' && chip.getAttribute('aria-pressed') === 'true' && !chip.hidden &&
      !els.btnListTrouble.hidden && /missed 4×/.test(els.wordList.textContent);
    state.level = LEVELS.filter(function (l) { return l !== String(x.lv) && l !== String(w.lv); })[0] || 'all';
    els.btnListTrouble.click();
    var fromList = els.listView.hidden && state.mode === 'trouble' && state.level === 'all' && state.deck.length === 2;
    // The progress view's stats line.
    var line = troubleLine(), stats = !!line && !!line.querySelector('[data-trouble]') && /^2 trouble words/.test(line.textContent);
    // Nothing left: the mode says so.
    state.status[w.zh] = 'known'; state.status[x.zh] = 'known';
    setMode('trouble');
    var empty = state.deck.length === 0 && !els.deckEnd.hidden && els.endTitle.textContent === 'No trouble words' && troubleLine() === null;
    add('Trouble words: missed three times and not known', def && order && perSkill && waits && strip && deck && requeued && undone && saved && leaves && hides && rows && fromList && stats && empty,
      TROUBLE_MISSES + ' misses and not Known: ' + def + ', most missed first: ' + order + ', counted per skill: ' + perSkill + ', strip waits for the word of the day: ' + waits +
      ', strip and chip: ' + strip + ', “Study” opens the trouble deck: ' + deck + ', a miss comes back at the end: ' + requeued + ', undo: ' + undone +
      ', mode saved and restored: ' + saved + ', a Known word leaves: ' + leaves + ', ✕ hides the strip for today: ' + hides + ', word list filter: ' + rows +
      ', deck from the list at any level: ' + fromList + ', stats line: ' + stats + ', empty deck: ' + empty);
  } });

  HABIT_TESTS.push({ title: 'My note: one per word, text only, saved and synced', run: function (add) {
    var w = cards[0], other = cards[1], html = '<b>bold</b> & <img src=x onerror=alert(1)> 记住';
    var showCardAt = function (i, revealed) { state.deck = buildDeck('all'); state.pos = i; state.revealed = revealed; render(false); };
    showCardAt(0, false);
    // No note yet: a way to add one, inside the answer, which is hidden until the reveal.
    var addBtn = els.cardNote.querySelector('[data-note]');
    var before = !els.cardNote.hidden && !!addBtn && /Add a note/.test(addBtn.textContent) && els.cardAnswer.contains(els.cardNote) &&
      getComputedStyle(els.cardAnswer).display === 'none';
    addBtn.click();
    var opens = !els.noteView.hidden && els.noteText.value === '' && els.noteZh.textContent === w.zh && els.btnNoteDelete.hidden;
    els.noteText.value = html;
    els.noteText.dispatchEvent(new Event('input'));
    var count = els.noteCount.textContent === Array.from(html).length + ' / ' + NOTE_MAX;
    els.btnNoteSave.click();
    var tx = els.cardNote.querySelector('.note-text');
    var savedNote = els.noteView.hidden && state.notes[w.zh] === html && !!tx && tx.textContent === html && tx.children.length === 0 &&
      !els.cardNote.querySelector('b, img');
    setRevealed(true);
    var after = getComputedStyle(els.cardAnswer).display !== 'none' && els.cardNote.offsetHeight > 0;
    // Cancel keeps it, Delete removes it.
    els.cardNote.querySelector('[data-note]').click();
    els.noteText.value = 'changed';
    els.btnNoteCancel.click();
    var cancel = els.noteView.hidden && state.notes[w.zh] === html;
    els.cardNote.querySelector('[data-note]').click();
    var hasDelete = !els.btnNoteDelete.hidden && els.noteText.value === html;
    els.btnNoteDelete.click();
    var deleted = !(w.zh in state.notes) && !els.cardNote.querySelector('.note-text');
    // Length cap, unknown words, sentences, wrong types.
    setNote(w.zh, new Array(500).join('好'));
    var capped = Array.from(state.notes[w.zh]).length === NOTE_MAX;
    var src = {};
    src[w.zh] = '  ok  '; src[other.zh] = 5; src[sentCards[0].zh] = 'a sentence'; src['不存在的词'] = 'x'; src.__proto__ = 'p';
    var read = readNotes(src), clean = Object.keys(read).length === 1 && read[w.zh] === 'ok' && !setNote('不存在的词', 'x') &&
      Object.keys(readNotes('text')).length === 0 && cleanNote('a\r\n\n\n\n\nb\u0007') === 'a\n\nb';
    // In the snapshot (format 8), the export and a restore; not device-only.
    setNote(w.zh, 'my own hook');
    var snap = JSON.parse(JSON.stringify(progressSnapshot())), exp = JSON.parse(exportText()).progress;
    var inSnap = snap.format === FORMAT && FORMAT >= 8 && snap.notes[w.zh] === 'my own hook' && exp.notes[w.zh] === 'my own hook' && DEVICE_ONLY.indexOf('notes') === -1;
    state.notes = {};
    restore(snap);
    var restored = state.notes[w.zh] === 'my own hook' && Object.keys(state.notes).length === 1;
    var old = JSON.parse(JSON.stringify(snap));
    delete old.notes; delete old.troubleSeen;
    restore(old);
    var older = Object.keys(state.notes).length === 0 && state.troubleSeen === '';
    restore(snap);
    // A trouble word without a note says why one may help.
    state.misses[other.zh] = TROUBLE_MISSES; state.status[other.zh] = 'learning';
    showCardAt(1, true);
    var why = !!els.cardNote.querySelector('.note-why') && /Missed 3 times/.test(els.cardNote.textContent);
    // Sentence cards carry no note.
    useDeckType('sentences');
    state.deck = buildDeck('all'); state.pos = 0; render(false);
    var noSent = els.cardNote.hidden;
    useDeckType('words');
    // The word popup shows the note and opens the dialog.
    showCardAt(0, true);
    var anchor = null, at = 0;
    for (; at < 40 && !anchor; at++) { showCardAt(at, true); anchor = els.cardExamples.querySelector('button.w'); }
    var pop = false, popEdit = false;
    if (anchor) {
      var pz = anchor.getAttribute('data-w');
      setNote(pz, 'popup note');
      openWordPop(anchor);
      pop = !els.wordPop.hidden && !els.wordPopNote.hidden && els.wordPopNote.textContent === '✎ popup note' && !els.btnWordPopNote.hidden;
      els.btnWordPopNote.click();
      popEdit = !els.noteView.hidden && els.wordPop.hidden && els.noteText.value === 'popup note' && els.noteZh.textContent === pz;
      els.btnNoteCancel.click();
    }
    add('My note: one per word, text only, saved and synced', before && opens && count && savedNote && after && cancel && hasDelete && deleted && capped && clean && inSnap && restored && older && why && noSent && pop && popEdit,
      'hidden until the reveal, with “Add a note”: ' + before + ', dialog opens: ' + opens + ', counter: ' + count + ', saved and shown as plain text: ' + savedNote +
      ', visible after the reveal: ' + after + ', Cancel keeps it: ' + cancel + ', Delete offered: ' + hasDelete + ', deleted: ' + deleted + ', capped at ' + NOTE_MAX + ': ' + capped +
      ', only words and text are read: ' + clean + ', in the snapshot and the export (format ' + FORMAT + '): ' + inSnap + ', restored: ' + restored +
      ', a save without notes restores empty: ' + older + ', trouble word prompt: ' + why + ', none on sentence cards: ' + noSent + ', word popup shows it: ' + pop + ', and edits it: ' + popEdit);
  } });
