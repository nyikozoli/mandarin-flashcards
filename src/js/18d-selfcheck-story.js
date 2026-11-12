  /* ---------- self-check: the story ---------- */
  // Runs inside functionalTest (testing = true), after habitTests. Every entry starts from a new reader's story
  // state on a day with no answers; storyTests puts the story, the day's activity, the goal and the deck back.
  var STORY_TESTS = [];
  function storyTests(add) {
    var today = dayKey();
    var keep = { story: JSON.stringify(state.story), activity: JSON.stringify(state.activity), goal: state.goal, mem: JSON.stringify(state.deckMemory),
      practice: state.practice, deckType: state.deckType, deck: state.deck.slice(), pos: state.pos, mode: state.mode, level: state.level, topic: state.topic,
      revealed: state.revealed, shuffled: state.shuffled, wotdSeen: state.wotdSeen, data: EXTRA.story };
    var back = function () {
      OVERLAYS.forEach(function (id) { closeOverlay(els[id]); });
      closeWordPop(false);
      closeSuggest();
      EXTRA.story = keep.data;
      storyLex = null;
      roundReturn = null;
      useDeckType(keep.deckType);
      state.practice = keep.practice;
      useSkill(skillOf(state.practice));
      state.story = JSON.parse(keep.story);
      state.activity = JSON.parse(keep.activity);
      state.goal = keep.goal;
      state.deckMemory = JSON.parse(keep.mem);
      state.mode = keep.mode; state.level = keep.level; state.topic = keep.topic;
      state.deck = keep.deck.slice(); state.pos = keep.pos; state.revealed = keep.revealed; state.shuffled = keep.shuffled;
      state.wotdSeen = keep.wotdSeen;
      undoStack = [];
      updateTopicBtn();
      syncPracticeSelect();
    };
    if (!storyEpisodes().length) {
      add('Story: hidden without story data', els.storyStrip.hidden && !openStory() && els.storyView.hidden && checkStoryUnlock() === null,
        'no story in this build: the strip stays hidden and nothing opens');
      return;
    }
    STORY_TESTS.forEach(function (t) {
      try {
        state.story = readStoryState(null);
        state.goal = 20;
        delete state.activity[today];
        state.wotdSeen = today;
        renderWotd();
        t.run(add, today);
      } catch (e) { add(t.title, false, 'The test stopped with an error: ' + e.message); }
      back();
    });
    renderWotd();
    render(false);
  }
  function storyTestDay(n) { var d = new Date(); d.setDate(d.getDate() + n); return dayKey(d); }

  STORY_TESTS.push({ title: 'Story: one episode a day, at the daily goal', run: function (add, today) {
    var total = storyEpisodes().length, yesterday = storyTestDay(-1);
    var start = storyAvailable() === 1 && storyHook().kind === 'new' && !state.story.days[1];
    state.activity[today] = { k: 12, l: 7 };
    var below = checkStoryUnlock() === null && state.story.unlocked === 1;
    state.activity[today] = { k: 13, l: 7 };
    var ep = checkStoryUnlock();
    var opens = !!ep && ep.id === 2 && state.story.unlocked === 2 && state.story.days[2] === today && storyFreshToday() === 2;
    state.activity[today] = { k: 60, l: 7 };
    var once = checkStoryUnlock() === null && checkStoryUnlock() === null && state.story.unlocked === 2;
    // The next day: nothing below the goal, the third episode at it.
    state.story.days[2] = yesterday;
    state.activity[today] = { k: 3, l: 0 };
    var nextDayBelow = checkStoryUnlock() === null && state.story.unlocked === 2;
    state.goal = 5;
    state.activity[today] = { k: 5, l: 0 };
    var ep3 = checkStoryUnlock();
    var nextDay = !!ep3 && ep3.id === 3 && state.story.days[3] === today && state.story.days[2] === yesterday;
    // The last episode is the end.
    state.story.unlocked = total;
    state.story.days = {};
    var end = checkStoryUnlock() === null && state.story.unlocked === total;
    add('Story: one episode a day, at the daily goal', start && below && opens && once && nextDayBelow && nextDay && end,
      total + ' episodes; episode 1 open from the start: ' + start + ', nothing below the goal: ' + below + ', the goal opens episode 2: ' + opens +
      ', not a second one the same day: ' + once + ', the next day nothing below the goal: ' + nextDayBelow + ', then episode 3: ' + nextDay + ', nothing after the last: ' + end);
  } });

  STORY_TESTS.push({ title: 'Story: the strip and the chip say what is waiting', run: function (add, today) {
    var pop = els.suggestPop;
    state.story.seen = '';
    renderLadderStrip();
    // A new reader: episode 1, first in the popover, and it keeps the trouble and ladder strips back.
    var fresh = !els.storyStrip.hidden && pop.firstElementChild === els.storyStrip && els.storyStrip.classList.contains('fresh') && /episode 1/.test(els.storyText.textContent) &&
      els.btnStoryGo.getAttribute('data-ep') === '1' && !els.btnStoryClose.hidden && els.ladderStrip.hidden && els.troubleStrip.hidden &&
      !els.btnSuggest.hidden && els.suggestSeal.textContent === '故' && /story/.test(els.suggestSeal.className) && /fresh/.test(els.suggestSeal.className);
    // Read: the next one waits behind today's goal, with the count.
    state.story.read[1] = today;
    state.activity[today] = { k: 4, l: 2 };
    renderLadderStrip();
    var waits = storyHook().kind === 'wait' && els.storyText.textContent === 'Episode 2 opens at today’s goal · 6/20' && pop.firstElementChild === els.storyStrip &&
      els.btnStoryGo.getAttribute('data-ep') === '' && !/fresh/.test(els.suggestSeal.className) && /Ep\. 2 🔒/.test(els.suggestText.textContent) && /6\/20/.test(els.suggestText.textContent);
    // ✕ puts it behind the other strips until tomorrow; it stays as the way in.
    els.btnStoryClose.click();
    var away = state.story.seen === today && !storyUrgent() && !els.storyStrip.hidden && pop.lastElementChild === els.storyStrip && els.btnStoryClose.hidden;
    var others = !EXTRA.ladder.length || !nextRung() || state.ladderSeen === today || (!els.ladderStrip.hidden && els.suggestSeal.className.indexOf('ladder') !== -1);
    // The goal opens episode 2: news again; once read, the next one is for tomorrow.
    state.story.seen = '';
    state.activity[today] = { k: 20, l: 0 };
    checkStoryUnlock();
    renderLadderStrip();
    var news = storyHook().kind === 'new' && els.storyText.textContent === 'Episode 2 is ready to read' && els.btnStoryGo.getAttribute('data-ep') === '2';
    els.btnStoryGo.click();
    var opened = !els.storyView.hidden && storyAt === 2 && state.story.read[2] === today;
    closeOverlay(els.storyView);
    var tomorrow = storyHook().kind === 'tomorrow' && !storyUrgent() && els.storyText.textContent === 'Episode 3 opens tomorrow, at your goal';
    add('Story: the strip and the chip say what is waiting', fresh && waits && away && others && news && opened && tomorrow,
      'episode 1 first, with the chip: ' + fresh + ', then “opens at today’s goal” with the count: ' + waits + ', ✕ moves it behind the others: ' + away +
      ', the ladder strip shows again: ' + others + ', the goal brings the new episode: ' + news + ', “Read” opens it: ' + opened + ', then the next one is for tomorrow: ' + tomorrow);
  } });

  STORY_TESTS.push({ title: 'Story: saved, exported and restored', run: function (add, today) {
    var total = storyEpisodes().length;
    state.story = { unlocked: 4, days: { 2: storyTestDay(-2), 3: storyTestDay(-1), 4: today }, read: { 1: storyTestDay(-2), 2: storyTestDay(-1) }, seen: today, py: false };
    var snap = JSON.parse(JSON.stringify(progressSnapshot())), exp = JSON.parse(exportText()).progress, want = JSON.stringify(state.story);
    var inSnap = snap.format === FORMAT && FORMAT === 8 && JSON.stringify(snap.story) === want && JSON.stringify(exp.story) === want && DEVICE_ONLY.indexOf('story') === -1;
    state.story = readStoryState(null);
    restore(snap);
    var restored = JSON.stringify(state.story) === want && storyAvailable() === 4;
    // A copy saved before the story existed.
    var old = JSON.parse(JSON.stringify(snap));
    delete old.story;
    restore(old);
    var older = state.story.unlocked === 1 && Object.keys(state.story.days).length === 0 && Object.keys(state.story.read).length === 0 && state.story.py === null && storyAvailable() === 1;
    // Anything else in the field is dropped.
    var odd = readStoryState({ unlocked: 'x', days: { 2: 'soon', 0: today, abc: today, 3: today }, read: 'yes', seen: 5, py: 'on' });
    var clean = odd.unlocked === 1 && Object.keys(odd.days).join() === '3' && Object.keys(odd.read).length === 0 && odd.seen === '' && odd.py === null &&
      readStoryState('text').unlocked === 1 && readStoryState({ unlocked: -4 }).unlocked === 1;
    // More episodes saved than this copy has: the count is kept, and only what exists can be opened.
    var more = JSON.parse(JSON.stringify(snap));
    more.story.unlocked = total + 7;
    more.story.read[total + 5] = today;
    restore(more);
    var beyond = state.story.unlocked === total + 7 && storyAvailable() === total && checkStoryUnlock() === null && !showEpisode(total + 1) &&
      progressSnapshot().story.unlocked === total + 7 && storyHook().kind === 'new';
    restore(snap);
    add('Story: saved, exported and restored', inSnap && restored && older && clean && beyond,
      'in the snapshot and the export (format ' + FORMAT + '), not device-only: ' + inSnap + ', restored: ' + restored + ', a save without the field starts at episode 1: ' + older +
      ', odd values are dropped: ' + clean + ', a count beyond this copy’s ' + total + ' episodes is kept and capped: ' + beyond);
  } });

  STORY_TESTS.push({ title: 'Story reader: episodes, words, translations', run: function (add, today) {
    var total = storyEpisodes().length, body = els.storyBody, q = function (s) { return body.querySelector(s); }, qa = function (s) { return body.querySelectorAll(s); };
    state.story.unlocked = Math.min(3, total);
    state.story.read[1] = today;
    state.deck = buildDeck('all'); state.pos = 2; render(false);
    var cardNode = els.cardHanzi.firstChild, xp = state.xp;
    var ok = openStory();
    var rows = qa('.sy-ep'), locked = qa('.sy-ep.locked');
    var list = ok && !els.storyView.hidden && anyOverlayOpen() && OVERLAYS.indexOf('storyView') !== -1 && rows.length === total && qa('button.sy-ep[data-ep]').length === state.story.unlocked &&
      locked.length === total - state.story.unlocked && !q('.sy-ep.locked .sy-ep-zh') && (!locked.length || (locked[0].tagName === 'DIV' && /goal/.test(locked[0].textContent)));
    // A locked episode cannot be opened: not by a tap, not by its number.
    if (locked.length) locked[0].click();
    var refused = storyAt === 0 && !showEpisode(state.story.unlocked + 1) && !showEpisode(0) && !showEpisode('x') && storyAt === 0 && !state.story.read[state.story.unlocked + 1];
    q('button.sy-ep[data-ep="2"]').click();
    var ep = storyEpisode(2), lines = qa('.sy-line');
    var shown = storyAt === 2 && state.story.read[2] === today && q('.sy-title').textContent === ep.title.zh && lines.length === ep.lines.length &&
      q('.sy-recap').textContent.indexOf(mean(ep.recap, baseLang())) !== -1 && q('.sy-title-tr').textContent === mean(ep.title, baseLang()) && !q('.sy-tr') &&
      qa('.sy-who').length === ep.lines.filter(function (l) { return l.who; }).length;
    // Words open the word pop-up; a headword can go to its card, a name shows as a name with its pinyin.
    var wb = q('.sy-zh button.w:not(.w-name)'), nb = null, pop = false, name = !EXTRA.story.names.length;
    if (wb) {
      wb.click();
      pop = !els.wordPop.hidden && els.wordPopZh.textContent === wb.getAttribute('data-w') && !els.btnWordPopStudy.hidden && !q('.sy-tr');
      closeWordPop(false);
    }
    for (var e = 1; e <= storyAvailable() && !nb; e++) { showEpisode(e); nb = q('.sy-zh button.w-name'); }
    if (nb) {
      var nw = storyWord(nb.getAttribute('data-w'));
      nb.click();
      name = !!nw && !els.wordPop.hidden && els.wordPopLv.textContent === 'Name' && els.wordPopPy.textContent === nw.py && els.btnWordPopStudy.hidden && els.btnWordPopNote.hidden;
      closeWordPop(false);
    }
    showEpisode(2);
    // The translation shows when the line is tapped (the 译 button, or the line itself) and hides again.
    var l0 = ep.lines[0];
    q('.sy-line[data-i="0"] [data-story="line"]').click();
    var tr = q('.sy-line[data-i="0"] .sy-tr');
    var reveal = !!tr && qa('.sy-tr').length === 1 && tr.querySelectorAll('.ex-line').length === langsOn().length && tr.textContent.indexOf(mean(l0, mainLang(l0))) !== -1 &&
      q('.sy-line[data-i="0"] [data-story="line"]').getAttribute('aria-expanded') === 'true';
    q('.sy-line[data-i="0"] .sy-main').click();
    var hides = !q('.sy-tr');
    q('.sy-line[data-i="1"] .sy-main').click();
    var byLine = !!q('.sy-line[data-i="1"] .sy-tr') && qa('.sy-tr').length === 1;
    q('[data-story="tr"]').click();
    var all = qa('.sy-tr').length === ep.lines.length && q('[data-story="tr"]').getAttribute('aria-pressed') === 'true';
    q('[data-story="tr"]').click();
    var none = !q('.sy-tr');
    // Pinyin follows the practice settings until the switch is used; the switch is saved.
    var pyBefore = storyPinyinOn(), n0 = qa('.sy-py').length;
    q('[data-story="py"]').click();
    var py = state.story.py === !pyBefore && (pyBefore ? n0 === ep.lines.length + 1 && qa('.sy-py').length === 0 : n0 === 0 && qa('.sy-py').length === ep.lines.length + 1);
    state.story.py = null;
    // A speaker button on every line and “Play all”: there with a Chinese voice, hidden without one.
    var can = storyCanSpeak(), sp = qa('.sy-speak');
    var speak = sp.length === ep.lines.length && !!q('.sy-play') && Array.prototype.every.call(sp, function (b) { return b.hidden === !can; }) && q('.sy-play').hidden === !can;
    // Previous and next; the newest episode ends with how the next one opens.
    var nav = true, tbc = true;
    if (state.story.unlocked >= 3) {
      q('.sy-nav [data-ep="3"]').click();
      nav = storyAt === 3 && !q('.sy-nav .sy-next') && !!q('.sy-nav [data-ep="2"]');
      tbc = total === 3 ? /The end/.test(q('.sy-end').textContent) : /To be continued/.test(q('.sy-tbc').textContent) && /Episode 4 opens/.test(q('.sy-how').textContent);
      q('.sy-nav [data-ep="2"]').click();
      nav = nav && storyAt === 2 && !q('.sy-tbc');
    }
    q('[data-story="list"]').click();
    var backToList = storyAt === 0 && qa('.sy-ep').length === total && !q('.sy-ep.fresh[data-ep="2"]');
    // The card behind was not drawn again, and the first readings were noted once.
    var still = els.cardHanzi.firstChild === cardNode && state.xp === xp;
    els.btnCloseStory.click();
    var closed = els.storyView.hidden && !anyOverlayOpen();
    add('Story reader: episodes, words, translations', list && refused && shown && pop && name && reveal && hides && byLine && all && none && py && speak && nav && tbc && backToList && still && closed,
      'list with locked episodes: ' + list + ', a locked episode is refused: ' + refused + ', title, recap and lines: ' + shown + ', a word opens with “Study”: ' + pop +
      ', a name shows as a name: ' + name + ', 译 shows the translation in the languages that are on: ' + reveal + ', a tap on the line hides it: ' + hides + ', and shows another: ' + byLine +
      ', all at once: ' + all + ', and none: ' + none + ', pinyin switch: ' + py + ', speaker buttons (Chinese voice here: ' + can + '): ' + speak + ', previous and next: ' + nav +
      ', “to be continued”: ' + tbc + ', back to the list: ' + backToList + ', the card behind is untouched: ' + still + ', closed: ' + closed);
  } });

  STORY_TESTS.push({ title: 'Story: a word goes to its card, also from the sentence deck', run: function (add, today) {
    switchDeck('sentences');
    openStory(1);
    var wb = els.storyBody.querySelector('.sy-zh button.w:not(.w-name)'), zh = wb ? wb.getAttribute('data-w') : '', err = '';
    if (wb) { wb.click(); els.btnWordPopStudy.click(); }
    var went = !!wb && els.storyView.hidden && els.wordPop.hidden && state.deckType === 'words' && state.deck.every(function (i) { return !!cards[i]; }) &&
      !!cards[state.deck[state.pos]] && cards[state.deck[state.pos]].zh === zh && els.cardHanzi.textContent === zh;
    try { progressSnapshot(); } catch (e) { err = e.message; }
    add('Story: a word goes to its card, also from the sentence deck', went && !err,
      '“Study” on ' + (zh || 'a word') + ' closes the story and shows its card in the word deck: ' + went + (err ? '; saving failed: ' + err : '; saving works'));
  } });

  STORY_TESTS.push({ title: 'Story: the goal’s dialogs offer the new episode', run: function (add, today) {
    state.story.read[1] = today;
    // “Just 5 cards” can end on the answer that reaches the goal: its finish opens the episode and offers it.
    state.activity[today] = { k: 3, l: 1 };
    showQuickDone();
    var plain = !els.quickView.hidden && els.btnQuickStory.hidden && !/story/.test(els.quickText.textContent) && state.story.unlocked === 1;
    closeOverlay(els.quickView);
    state.activity[today] = { k: 18, l: 2 };
    showQuickDone();
    var offer = !els.quickView.hidden && !els.btnQuickStory.hidden && /Episode 2 of the story is open/.test(els.quickText.textContent) && /Five more, or stop here/.test(els.quickText.textContent) &&
      state.story.unlocked === 2 && state.story.days[2] === today;
    els.btnQuickStory.click();
    var reads = els.quickView.hidden && !els.storyView.hidden && storyAt === 2 && state.story.read[2] === today;
    closeOverlay(els.storyView);
    showQuickDone();
    var gone = els.btnQuickStory.hidden && !/story/.test(els.quickText.textContent);
    closeOverlay(els.quickView);
    // The session summary has a line for it while it is unread.
    delete state.story.read[2];
    var line = storySummaryLine(), btn = line && line.querySelector('[data-story-open]');
    var summary = !!btn && btn.getAttribute('data-story-open') === '2' && /Episode 2/.test(line.textContent);
    els.summaryBody.textContent = '';
    if (line) els.summaryBody.appendChild(line);
    openOverlay(els.summaryView, els.btnSummaryClose);
    if (btn) btn.click();
    var fromSummary = els.summaryView.hidden && !els.storyView.hidden && storyAt === 2 && storySummaryLine() === null;
    add('Story: the goal’s dialogs offer the new episode', plain && offer && reads && gone && summary && fromSummary,
      'no offer below the goal: ' + plain + ', the “Just 5 cards” finish at the goal opens episode 2 and offers it: ' + offer + ', its button opens the episode: ' + reads +
      ', no offer once read: ' + gone + ', the session summary has the line: ' + summary + ', and its link opens the episode: ' + fromSummary);
  } });

  STORY_TESTS.push({ title: 'Story: nothing shows without story data', run: function (add, today) {
    state.story = { unlocked: 6, days: { 6: storyTestDay(-1) }, read: { 5: storyTestDay(-1) }, seen: '', py: true };
    var want = JSON.stringify(state.story);
    EXTRA.story = readStory(null);
    storyLex = null;
    state.activity[today] = { k: 30, l: 0 };
    renderLadderStrip();
    var hidden = els.storyStrip.hidden && storyHook() === null && !storyUrgent() && storyAvailable() === 0 && (els.btnSuggest.hidden || els.suggestSeal.textContent !== '故');
    var inert = checkStoryUnlock() === null && !openStory() && !openStory(1) && els.storyView.hidden && storySummaryLine() === null && storyWord('安娜') === null;
    showQuickDone();
    var quick = els.btnQuickStory.hidden && !/story/.test(els.quickText.textContent);
    closeOverlay(els.quickView);
    // The saved field passes through untouched, so a copy with the story finds it again.
    var snap = JSON.parse(JSON.stringify(progressSnapshot()));
    restore(snap);
    var kept = JSON.stringify(snap.story) === want && JSON.stringify(state.story) === want;
    var odd = readStory({ episodes: 'x' }).episodes.length === 0 && readStory({ episodes: [null, { lines: [] }, { lines: [{ zh: '你好。' }] }] }).episodes.length === 1;
    add('Story: nothing shows without story data', hidden && inert && quick && kept && odd,
      'strip and chip hidden: ' + hidden + ', nothing opens or unlocks: ' + inert + ', no offer in the finish: ' + quick + ', saved progress is kept: ' + kept + ', malformed data is ignored: ' + odd);
  } });
