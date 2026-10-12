  /* ---------- self-check: rehearse known languages ---------- */
  // Each entry runs inside functionalTest (testing = true). rehearseTests puts the languages, the rehearse
  // settings, the practice style and the deck back after every entry.
  var REHEARSE_TESTS = [];
  function resetRehearseTestState(keep) {
    // Every skill's marks go back too, so later checks see the deck as it was.
    state.marks = JSON.parse(JSON.stringify(keep.marks));
    loadSkill();
    state.langs = JSON.parse(JSON.stringify(keep.langs));
    state.rehearse = JSON.parse(JSON.stringify(keep.rehearse));
    rebuildSkills();
    rehearseCard = null;
    roundReturn = null;
    syncSettingsUI();
  }
  function rehearseTests(add) {
    stashSkill();
    var keep = { marks: JSON.parse(JSON.stringify(state.marks)), langs: JSON.parse(JSON.stringify(state.langs)), rehearse: JSON.parse(JSON.stringify(state.rehearse)),
      practice: state.practice, deckType: state.deckType, deck: state.deck.slice(), pos: state.pos, revealed: state.revealed };
    add('Self-check runs with the default languages', langsRehearsed().length === 0 && state.rehearse.every === 0,
      'rehearsed while the checks ran: ' + (langsRehearsed().join(', ') || 'none') + ', rehearse cards every: ' + state.rehearse.every);
    REHEARSE_TESTS.forEach(function (t) {
      try { t.run(add); } catch (e) { add(t.title, false, 'The test stopped with an error: ' + e.message); }
      resetRehearseTestState(keep);
    });
    useDeckType(keep.deckType);
    state.practice = keep.practice;
    useSkill(skillOf(state.practice));
    state.deck = keep.deck; state.pos = keep.pos; state.revealed = keep.revealed;
    syncPracticeSelect();
    render(false);
  }

  REHEARSE_TESTS.push({ title: 'Translation roles: off, show, rehearse', run: function (add) {
    var a = readLangs({ en: true, hu: false, de: 'rehearse', es: 'bogus' });
    var conv = a.en === 'show' && a.hu === 'off' && a.de === 'rehearse' && a.es === 'off' && a.ro === 'off';
    var b = readLangs(null);
    var dflt = b.en === 'show' && b.hu === 'show' && b.de === 'off' && b.ro === 'off';
    var r = readRehearse({ every: 7, share: { ro: 80, de: -3 }, afterGoal: false });
    var rs = r.every === 8 && r.share.ro === 50 && r.share.de === 0 && r.afterGoal === false && readRehearse(null).every === 8;
    // 'off' is a truthy string: the ladder must still fall back to Hungarian names when English is off.
    state.langs = { en: 'off', hu: 'show', de: 'off', es: 'off', ro: 'off' };
    var rung = { en: 'Greet', hu: 'Köszönés' };
    var truthy = rungName(rung) === 'Köszönés';
    // The last language on cannot be switched off.
    state.langs = { en: 'show', hu: 'off', de: 'off', es: 'off', ro: 'off' };
    syncSettingsUI();
    els.optLangEn.value = 'off';
    els.optLangEn.dispatchEvent(new Event('change'));
    var lastStays = state.langs.en === 'show' && els.optLangEn.value === 'show';
    // Rehearse shows the share slider (default 30%) and the rehearse options.
    els.optLangHu.value = 'rehearse';
    els.optLangHu.dispatchEvent(new Event('change'));
    var slider = state.langs.hu === 'rehearse' && !els.optShareHu.hidden && state.rehearse.share.hu === 30 && !els.rehearseOpts.hidden && els.optShareEn.hidden;
    add('Translation roles: off, show, rehearse', conv && dflt && rs && truthy && lastStays && slider,
      'old on/off saves convert: ' + conv + ', defaults: ' + dflt + ', rehearse settings clamp: ' + rs + ', Off counts as off: ' + truthy +
      ', the last one stays on: ' + lastStays + ', Rehearse shows its share slider: ' + slider);
  } });

  REHEARSE_TESTS.push({ title: 'Rehearsed language as its own skill', run: function (add) {
    if (!LANG_AVAILABLE.ro) { add('Rehearsed language as its own skill', true, 'No Romanian data in this build.'); return; }
    state.langs.ro = 'rehearse';
    rebuildSkills();
    var c = wordCards.filter(function (w) { return mean(w, 'ro'); })[0];
    var exists = SKILLS['say:ro'] === 'Romanian' && SKILL_OF['rh-ro'] === 'say:ro' && !!PRACTICE['rh-ro'] && SKILL_ZH['say:ro'] === 'RO' &&
      !!els.optPractice.querySelector('option[value="rh-ro"]');
    var recallBefore = marksOf('recall').status[c.zh] || null;
    useSkill('say:ro');
    state.status[c.zh] = 'learning';
    useSkill('recall');
    var separate = (marksOf('recall').status[c.zh] || null) === recallBefore && marksOf('say:ro').status[c.zh] === 'learning';
    var snap = progressSnapshot();
    var saved = snap.format === 6 && !!snap.skills['say:ro'] && snap.skills['say:ro'].status[c.zh] === 'learning';
    var seal = Array.prototype.some.call(skillMarks(c).querySelectorAll('.sm'), function (s) { return s.textContent === 'RO'; });
    // Back to Show: the skill, the menu entry and a saved rh-ro practice go; the marks stay.
    state.practice = 'rh-ro';
    useSkill('say:ro');
    state.langs.ro = 'show';
    rebuildSkills();
    var gone = !SKILLS['say:ro'] && !els.optPractice.querySelector('option[value="rh-ro"]') && state.practice === 'zh' && state.skill === 'read' &&
      marksOf('say:ro').status[c.zh] === 'learning';
    delete state.marks['say:ro'];
    add('Rehearsed language as its own skill', exists && separate && saved && seal && gone,
      'Romanian skill, style and menu entry: ' + exists + ', its marks are separate from recall: ' + separate + ', saved under skills (format 6): ' + saved +
      ', RO seal on the card: ' + seal + ', set back to Show drops the skill but keeps its marks: ' + gone);
  } });

  // Marks the first n words with a meaning in k as Learning in reading, so they are in k's rehearse pool.
  function seedRehearsePool(k, n) {
    var picked = wordCards.filter(function (w) { return mean(w, k); }).slice(0, n);
    var read = marksOf('read');
    picked.forEach(function (w) { if (!read.status[w.zh]) read.status[w.zh] = 'learning'; });
    if (state.skill === 'read') loadSkill();
    return picked;
  }
  REHEARSE_TESTS.push({ title: 'Rehearse tile: Chinese → Romanian card', run: function (add) {
    if (!LANG_AVAILABLE.ro) { add('Rehearse tile: Chinese → Romanian card', true, 'No Romanian data in this build.'); return; }
    state.langs.ro = 'rehearse';
    rebuildSkills();
    var picked = seedRehearsePool('ro', 3);
    var started = function (w) { return !!(marksOf('read').status[w.zh] || marksOf('recall').status[w.zh] || marksOf('listen').status[w.zh]); };
    var pool = rehearsePool('ro');
    var onlyStarted = pool.length > 0 && pool.every(function (w) { return started(w) && mean(w, 'ro') && !w.sentence; });
    // A word due in Romanian comes first.
    var ro = state.marks['say:ro'] || (state.marks['say:ro'] = emptyMarks()), due = picked[2];
    ro.srs[due.zh] = { b: 1, d: dayKey() };
    var dueFirst = rehearsePool('ro')[0] === due;
    useDeckType('words');
    state.mode = 'all';
    pickPracticeStyle('rh-ro');
    var tile = state.practice === 'rh-ro' && state.skill === 'say:ro' && state.deck.length === rehearsePool('ro').length &&
      cards[state.deck[0]] === due;
    var prompt = els.cardPrompt.textContent.indexOf('In Romanian?') !== -1 && !els.cardPrompt.hidden;
    setRevealed(true);
    var back = !els.cardRehearse.hidden && els.cardRehearse.textContent.indexOf(mean(due, 'ro')) !== -1 && !els.gradeRow.hidden;
    var readBefore = marksOf('read').status[due.zh] || null;
    act('learning');
    var moved = marksOf('say:ro').status[due.zh] === 'learning' && (marksOf('read').status[due.zh] || null) === readBefore;
    delete state.marks['say:ro'];
    add('Rehearse tile: Chinese → Romanian card', onlyStarted && dueFirst && tile && prompt && back && moved,
      'pool holds only started words with Romanian: ' + onlyStarted + ', Romanian-due first: ' + dueFirst + ', tile opens the pool as a Romanian deck: ' + tile +
      ', asks "In Romanian?": ' + prompt + ', back shows the Romanian, self-graded: ' + back + ', the answer moves only the Romanian mark: ' + moved);
  } });

  REHEARSE_TESTS.push({ title: 'Main meaning takes turns', run: function (add) {
    if (!LANG_AVAILABLE.ro) { add('Main meaning takes turns', true, 'No Romanian data in this build.'); return; }
    state.langs = { en: 'show', hu: 'show', de: 'off', es: 'off', ro: 'rehearse' };
    state.rehearse.share = { ro: 30 };
    rebuildSkills();
    var withRo = wordCards.filter(function (w) { return mean(w, 'ro'); });
    var stable = withRo.every(function (w) { return mainLang(w) === mainLang(w); });
    var n = withRo.filter(function (w) { return mainLang(w) === 'ro'; }).length, share = n / withRo.length;
    var weighted = share > 0.18 && share < 0.42;
    state.rehearse.share = { ro: 0 };
    var none = withRo.every(function (w) { return mainLang(w) === 'en'; });
    // Two languages at 50% each: English still keeps at least 30%.
    if (LANG_AVAILABLE.de) state.langs.de = 'rehearse';
    state.rehearse.share = { ro: 50, de: 50 };
    rebuildSkills();
    var base = withRo.filter(function (w) { return mainLang(w) === 'en'; }).length / withRo.length;
    var floor = base > 0.2;
    var missing = mainLang({ zh: 'x', en: 'a', hu: 'b', tr: {} }) === 'en';
    // A card whose main meaning is Romanian: the recall prompt leads with it, the challenge question does not.
    state.langs.de = 'off';
    state.rehearse.share = { ro: 50 };
    rebuildSkills();
    var c = withRo.filter(function (w) { return mainLang(w) === 'ro'; })[0];
    state.practice = 'reverse'; useSkill('recall'); useDeckType('words');
    state.deck = [wordCards.indexOf(c)]; state.pos = 0; state.revealed = false; render(false);
    var lead = els.cardPrompt.querySelector('.prompt-en');
    var prompt = !!lead && lead.getAttribute('lang') === 'ro' && lead.textContent.indexOf(mean(c, 'ro')) !== -1;
    startQuiz('blitz', 'all');
    quiz.q = makeQuestion('word', c, quiz.pool);
    drawQuestion();
    var q = els.quizBody.querySelector('.qz-en');
    var quizBase = !!q && q.textContent === shortText(baseMeaning(c));
    stopQuiz(); quiz = null; closeOverlay(els.quizView);
    add('Main meaning takes turns', stable && weighted && none && floor && missing && prompt && quizBase,
      'same language all day: ' + stable + ', about 30% Romanian (' + Math.round(share * 100) + '%): ' + weighted + ', 0% means never: ' + none +
      ', the base keeps 30% (' + Math.round(base * 100) + '%): ' + floor + ', a missing meaning falls back: ' + missing +
      ', the recall prompt leads with Romanian: ' + prompt + ', challenges use the base language: ' + quizBase);
  } });

  REHEARSE_TESTS.push({ title: 'Rehearse cards come up in the word deck', run: function (add) {
    if (!LANG_AVAILABLE.ro) { add('Rehearse cards come up in the word deck', true, 'No Romanian data in this build.'); return; }
    state.langs.ro = 'rehearse';
    state.rehearse.every = 6;
    rebuildSkills();
    seedRehearsePool('ro', 3);
    useDeckType('words');
    state.practice = 'zh'; useSkill('read');
    state.deck = [0, 1, 2, 3, 4]; state.pos = 0; state.revealed = true;
    rehearseCard = null; rehearsedThisSession = []; undoStack = [];
    sinceRehearse = 5;
    act('known');
    var shown = !!rehearseCard && state.pos === 1 && els.card.classList.contains('rh-mode') && state.skill === 'read';
    var c = rehearseCard ? wordByZh(rehearseCard.zh) : null;
    // Undo while it is on screen: the previous Chinese card comes back, the rehearse card goes.
    undo();
    var undoBefore = !rehearseCard && state.pos === 0;
    sinceRehearse = 5;
    act('known');
    c = rehearseCard ? wordByZh(rehearseCard.zh) : c;
    var before = marksOf('say:ro').status[c.zh] || null, readBefore = marksOf('read').status[c.zh] || null;
    act('learning');
    var marked = marksOf('say:ro').status[c.zh] === 'learning' && (marksOf('read').status[c.zh] || null) === readBefore && state.pos === 1 && !rehearseCard;
    undo();
    var undone = (marksOf('say:ro').status[c.zh] || null) === before && !!rehearseCard && rehearseCard.zh === c.zh;
    // Never on the sentence deck.
    rehearseCard = null;
    useDeckType('sentences');
    state.deck = [0, 1, 2]; state.pos = 0; sinceRehearse = 5;
    act('known');
    var noSentences = !rehearseCard;
    useDeckType('words');
    delete state.marks['say:ro'];
    add('Rehearse cards come up in the word deck', shown && undoBefore && marked && undone && noSentences,
      'after the 6th answer a Romanian card appears in place: ' + shown + ', undo on it brings back the Chinese card: ' + undoBefore +
      ', answering it moves only the Romanian mark: ' + marked + ', undo brings it back: ' + undone + ', none on the sentence deck: ' + noSentences);
  } });

  REHEARSE_TESTS.push({ title: 'Rehearse round after the goal, and its quest', run: function (add) {
    if (!LANG_AVAILABLE.ro) { add('Rehearse round after the goal, and its quest', true, 'No Romanian data in this build.'); return; }
    state.langs.ro = 'rehearse';
    state.rehearse.afterGoal = true;
    rebuildSkills();
    seedRehearsePool('ro', ROUND_SIZE + 1);
    useDeckType('words'); state.practice = 'zh'; useSkill('read');
    state.deck = [0, 1, 2]; state.pos = 0;
    var day = dayKey(), keepSeen = state.rehearseSeen;
    state.activity[day] = { k: state.goal, l: 0 };
    state.rehearseSeen = '';
    renderRehearseStrip();
    var strip = !els.rehearseStrip.hidden && els.rehearseText.textContent.indexOf('Romanian') !== -1;
    els.btnRehearseGo.click();
    var round = state.practice === 'rh-ro' && state.skill === 'say:ro' && state.deck.length === ROUND_SIZE && state.rehearseSeen === day;
    for (var i = 0; i < ROUND_SIZE; i++) act('known');
    var back = state.practice === 'zh' && state.skill === 'read' && !roundReturn;
    renderRehearseStrip();
    var once = els.rehearseStrip.hidden;
    // The quest counts rehearse answers.
    state.quests = { day: day, rewarded: true, list: [{ id: 'rehearse', goal: 5, n: 0 }] };
    state.practice = 'rh-ro';
    questEvent('known', wordCards[0], null);
    state.practice = 'zh';
    var quest = state.quests.list[0].n === 1 && QUESTS.rehearse.label(state.quests.list[0]).indexOf('Romanian') !== -1;
    state.rehearseSeen = keepSeen;
    delete state.marks['say:ro'];
    add('Rehearse round after the goal, and its quest', strip && round && back && once && quest,
      'goal reached offers 5 Romanian cards: ' + strip + ', the round opens them as a Romanian deck: ' + round + ', after the last card it goes back: ' + back +
      ', offered once a day: ' + once + ', the rehearse quest counts: ' + quest);
  } });

  REHEARSE_TESTS.push({ title: 'Read-aloud in every language', run: function (add) {
    var c = wordCards.filter(function (w) { return mean(w, 'ro'); })[0] || wordCards[0];
    var b = speakBtn('ro', 'casă');
    var btn = b.classList.contains('mean-speak') && b.getAttribute('data-lang') === 'ro' && b.hidden === !canSpeak('ro');
    var keepRead = state.readMeaning;
    state.readMeaning = 'off';
    var off = meaningSpeech(c).length === 0;
    state.readMeaning = 'always';
    var always = meaningSpeech(c).length === (canSpeak(mainLang(c)) ? 1 : 0);
    state.readMeaning = keepRead;
    var tagged = true;
    if (speechSupported) {
      lastUtterance = null;
      speakParts([{ text: 'casă', lang: 'ro' }], null);
      tagged = !!lastUtterance && lastUtterance.lang === 'ro-RO';
      stopSpeech();
    }
    add('Read-aloud in every language', btn && off && always && tagged,
      'speaker hidden without a voice: ' + btn + ', "Off" reads no meaning: ' + off + ', "Always" reads the main one: ' + always +
      ', a Romanian part is spoken as ro-RO: ' + (speechSupported ? tagged : 'no speech in this browser'));
  } });

  REHEARSE_TESTS.push({ title: 'Rehearse progress and sync counts', run: function (add) {
    if (!LANG_AVAILABLE.ro) { add('Rehearse progress and sync counts', true, 'No Romanian data in this build.'); return; }
    state.langs.ro = 'rehearse';
    rebuildSkills();
    var picked = seedRehearsePool('ro', 2);
    (state.marks['say:ro'] || (state.marks['say:ro'] = emptyMarks())).status[picked[0].zh] = 'known';
    openProgress('progress');
    var line = els.pvBody.querySelector('.pv-skills');
    var shown = !!line && line.textContent.indexOf('Romanian') !== -1;
    closeOverlay(els.progressView);
    var note = rehearseNote(progressSnapshot().skills).indexOf('1 Romanian known') !== -1;
    var day = '2001-01-01';
    state.activity[day] = { k: 1, l: 0, r: 3 };
    var recap = weekRecap(day).rehearse === 3;
    delete state.activity[day];
    delete state.marks['say:ro'];
    add('Rehearse progress and sync counts', shown && note && recap,
      'progress lists Romanian next to the skills: ' + shown + ', the sync conflict cards count Romanian: ' + note + ', the weekly recap counts rehearse answers: ' + recap);
  } });

  REHEARSE_TESTS.push({ title: 'Controls act on the rehearse card on screen', run: function (add) {
    if (!LANG_AVAILABLE.ro) { add('Controls act on the rehearse card on screen', true, 'No Romanian data in this build.'); return; }
    state.langs.ro = 'rehearse';
    state.rehearse.every = 6;
    rebuildSkills();
    seedRehearsePool('ro', 3);
    useDeckType('words');
    state.practice = 'zh'; useSkill('read');
    state.deck = [0, 1, 2, 3, 4]; state.pos = 0;
    rehearseCard = null; rehearsedThisSession = []; sinceRehearse = 5;
    act('known');
    var c = rehearseCard ? wordByZh(rehearseCard.zh) : null;
    if (!c) { add('Controls act on the rehearse card on screen', false, 'no rehearse card came up'); return; }
    var onScreen = cardOnScreen() === c;
    var ro = state.marks['say:ro'] || (state.marks['say:ro'] = emptyMarks());
    ro.status[c.zh] = 'learning';
    ro.srs[c.zh] = { b: 3, d: addDays(7) };
    marksOf('read').status[c.zh] = 'known';
    marksOf('read').srs[c.zh] = { b: 0, d: dayKey() };
    loadSkill();
    state.revealed = true;
    render(false);
    var tag = els.cardStatus.textContent === 'Learning';
    var ring = !!els.cardSkills.querySelector('.sm.sm-code.active') && !els.cardSkills.querySelector('.sm:not(.sm-code).active');
    var goodBtn = els.gradeRow.querySelector('[data-grade="good"] small');
    var grades = !!goodBtn && goodBtn.textContent === fmtWait(SRS_DAYS[4]);
    var spoke = true;
    if (speechSupported) {
      lastUtterance = null;
      speakCurrent();
      spoke = !!lastUtterance && lastUtterance.text === c.zh;
      stopSpeech();
    }
    var exBtn = els.cardExamples.querySelector('.ex-practice');
    if (exBtn) exBtn.click();
    var sentences = !exBtn || (state.deckType === 'sentences' && state.deck.length > 0 &&
      state.deck.every(function (i) { return c.ex.some(function (e) { return e.zh === cards[i].zh; }); }));
    useDeckType('words');
    delete state.marks['say:ro'];
    add('Controls act on the rehearse card on screen', onScreen && tag && ring && grades && spoke && sentences,
      'the card on screen is the Romanian one: ' + onScreen + ', its tag shows the Romanian mark: ' + tag + ', the RO seal has the ring: ' + ring +
      ', grade waits follow the Romanian schedule: ' + grades + ', Read aloud reads it: ' + (speechSupported ? spoke : 'no speech') +
      ', "Practice these sentences" opens its sentences: ' + sentences);
  } });

  REHEARSE_TESTS.push({ title: 'Leaving the rehearse style keeps the skill in step', run: function (add) {
    if (!LANG_AVAILABLE.ro) { add('Leaving the rehearse style keeps the skill in step', true, 'No Romanian data in this build.'); return; }
    state.langs.ro = 'rehearse';
    rebuildSkills();
    seedRehearsePool('ro', 3);
    useDeckType('words');
    state.mode = 'all';
    pickPracticeStyle('rh-ro');
    var c = cards[state.deck[0]];
    practiceSentencesOf(c);
    var sent = state.deckType === 'sentences' && state.skill === skillOf(state.practice) && state.skill !== 'say:ro';
    useDeckType('words');
    state.mode = 'all';
    pickPracticeStyle('rh-ro');
    var unstarted = wordCards.filter(function (w) { return mean(w, 'ro') && !rehearseStarted(w); })[0];
    studyWord(unstarted.zh);
    var study = state.skill === skillOf(state.practice) && !isRehearseStyle(state.practice);
    // Romanian back to Show while on its tile: the style falls back and the deck is a whole deck again.
    pickPracticeStyle('rh-ro');
    els.optLangRo.value = 'show';
    els.optLangRo.dispatchEvent(new Event('change'));
    var whole = state.practice === 'zh' && state.skill === 'read' && state.deck.length === buildDeck(state.mode).length;
    add('Leaving the rehearse style keeps the skill in step', sent && study && whole,
      '"Practice these sentences" from the tile practises reading: ' + sent + ', "Study it" for a word outside the tile leaves the Romanian skill: ' + study +
      ', Romanian back to Show rebuilds a whole deck: ' + whole);
  } });

  REHEARSE_TESTS.push({ title: 'Rounds and rehearse cards end cleanly', run: function (add) {
    if (!LANG_AVAILABLE.ro) { add('Rounds and rehearse cards end cleanly', true, 'No Romanian data in this build.'); return; }
    state.langs.ro = 'rehearse';
    state.rehearse.every = 6;
    rebuildSkills();
    seedRehearsePool('ro', ROUND_SIZE + 1);
    useDeckType('words'); state.practice = 'zh'; useSkill('read');
    var keepSeen = state.rehearseSeen;
    startRehearseRound('ro');
    var inRound = !!roundReturn;
    pickPracticeStyle('zh');
    var cleared = inRound && !roundReturn;
    state.rehearseSeen = keepSeen;
    // With "Always show the meaning" on, the rehearse card still opens on its question.
    var keepAuto = state.autoReveal;
    state.autoReveal = true;
    useDeckType('words'); state.practice = 'zh'; useSkill('read');
    state.deck = [0, 1, 2, 3, 4]; state.pos = 0;
    rehearseCard = null; rehearsedThisSession = []; sinceRehearse = 5;
    act('known');
    var asks = !!rehearseCard && !state.revealed;
    state.autoReveal = keepAuto;
    rehearseCard = null;
    // Voices that arrive late (voiceschanged) update the speaker buttons.
    var b = speakBtn('en', 'house');
    b.hidden = !b.hidden;
    document.body.appendChild(b);
    refreshSpeakButtons();
    var voices = b.hidden === !canSpeak('en');
    b.parentNode.removeChild(b);
    delete state.marks['say:ro'];
    add('Rounds and rehearse cards end cleanly', cleared && asks && voices,
      'changing style ends a round: ' + cleared + ', a rehearse card opens on its question with auto-reveal on: ' + asks +
      ', speaker buttons follow late voices: ' + voices);
  } });

  REHEARSE_TESTS.push({ title: 'Rehearse quest follows the language roles', run: function (add) {
    if (!LANG_AVAILABLE.ro || !LANG_AVAILABLE.de) { add('Rehearse quest follows the language roles', true, 'No Romanian or German data in this build.'); return; }
    state.langs.ro = 'rehearse';
    rebuildSkills();
    var day = dayKey();
    state.quests = { day: day, rewarded: false, list: [{ id: 'goal', goal: 20, n: 0 }, { id: 'rehearse', goal: 5, n: 2 }, { id: 'combo', goal: 10, n: 0 }] };
    var one = QUESTS.rehearse.label(state.quests.list[1]) === 'Answer 5 Romanian cards';
    state.langs.de = 'rehearse';
    rebuildSkills();
    var two = QUESTS.rehearse.label(state.quests.list[1]) === 'Answer 5 cards in a rehearsed language';
    state.langs.ro = 'show'; state.langs.de = 'show';
    rebuildSkills();
    var ids = todaysQuests().list.map(function (q) { return q.id; });
    var replaced = ids.length === 3 && ids.indexOf('rehearse') === -1 && ids.indexOf('goal') === 0 && ids.indexOf('combo') !== -1;
    add('Rehearse quest follows the language roles', one && two && replaced,
      'one language named: ' + one + ', several called "a rehearsed language": ' + two + ', switched off, the quest is replaced: ' + replaced + ' (' + ids.join(', ') + ')');
  } });

  REHEARSE_TESTS.push({ title: 'Speech messages name the right language', run: function (add) {
    var roOnly = !needsChineseVoice([{ text: 'casă', lang: 'ro' }]);
    var zh = needsChineseVoice(['家', { text: 'casă', lang: 'ro' }]) === !zhVoice;
    var msg = speechErrorText('ro', 'synthesis-failed');
    var named = msg.indexOf('Romanian voice') !== -1 && msg.indexOf('Chinese') === -1 && speechErrorText('', '').indexOf('Chinese voice') !== -1;
    add('Speech messages name the right language', roOnly && zh && named,
      'Romanian alone never asks for a Chinese voice: ' + roOnly + ', Chinese parts still do: ' + zh + ', the error names the language: ' + named);
  } });

  REHEARSE_TESTS.push({ title: 'Undo takes back the rehearse count', run: function (add) {
    var day = dayKey(), c = wordCards[0];
    var keepA = state.activity[day] ? JSON.parse(JSON.stringify(state.activity[day])) : null;
    state.activity[day] = { k: 5, l: 1, r: 3 };
    undoStack.push({ rehearse: 'ro', pos: state.pos, zh: c.zh, prev: null, srs: null, miss: 0, day: day, kind: 'known', requeued: false });
    undo();
    var interjected = state.activity[day].k === 4 && state.activity[day].r === 2;
    rehearseCard = null;
    undoStack.push({ pos: state.pos, zh: c.zh, prev: state.status[c.zh] || null, srs: state.srs[c.zh] || null, miss: state.misses[c.zh] || 0, day: day, kind: 'learning', requeued: false, r: true });
    undo();
    var tile = state.activity[day].l === 0 && state.activity[day].r === 1;
    if (keepA) state.activity[day] = keepA; else delete state.activity[day];
    add('Undo takes back the rehearse count', interjected && tile,
      'undo of a mixed-in rehearse card: ' + interjected + ', undo of a rehearse-tile answer: ' + tile);
  } });

  REHEARSE_TESTS.push({ title: 'No rehearse seal on sentences', run: function (add) {
    if (!LANG_AVAILABLE.ro) { add('No rehearse seal on sentences', true, 'No Romanian data in this build.'); return; }
    state.langs.ro = 'rehearse';
    rebuildSkills();
    var onWord = !!skillMarks(wordCards[0]).querySelector('.sm-code');
    var onSentence = !!skillMarks(sentCards[0]).querySelector('.sm-code');
    add('No rehearse seal on sentences', onWord && !onSentence, 'RO seal on words: ' + onWord + ', on sentences: ' + onSentence);
  } });

  REHEARSE_TESTS.push({ title: 'Word pop-up speakers on every meaning', run: function (add) {
    var a = el('button', 'w', wordCards[0].zh);
    a.setAttribute('data-w', wordCards[0].zh);
    els.cardExamples.appendChild(a);
    openWordPop(a);
    var en = !!els.wordPopEn.parentNode.querySelector('.mean-speak[data-lang="en"]');
    var hu = !!els.wordPopHu.parentNode.querySelector('.mean-speak[data-lang="hu"]');
    openWordPop(a);
    var once = els.wordPopEn.parentNode.querySelectorAll('.mean-speak').length === 1;
    closeWordPop(false);
    a.parentNode.removeChild(a);
    add('Word pop-up speakers on every meaning', en && hu && once, 'English: ' + en + ', Hungarian: ' + hu + ', one each after reopening: ' + once);
  } });

  REHEARSE_TESTS.push({ title: 'A saved rehearse deck that no longer fits is rebuilt', run: function (add) {
    var snap = progressSnapshot();
    var mod = JSON.parse(JSON.stringify(snap));
    mod.practice = 'rh-ro';
    mod.mode = 'due';
    mod.langs.ro = 'show';
    mod.deck = [wordCards[0].zh];
    restore(mod);
    var rebuilt = state.practice === 'zh' && state.skill === 'read' && state.deck.join() === buildDeck('due').join();
    restore(JSON.parse(JSON.stringify(snap)));
    render(false);
    add('A saved rehearse deck that no longer fits is rebuilt', rebuilt, 'a Due deck saved in Romanian comes back as the reading Due deck: ' + rebuilt);
  } });

  REHEARSE_TESTS.push({ title: 'Share slider and rotation agree', run: function (add) {
    if (!LANG_AVAILABLE.ro) { add('Share slider and rotation agree', true, 'No Romanian data in this build.'); return; }
    state.langs.ro = 'rehearse';
    state.rehearse.share = {};
    rebuildSkills();
    syncSettingsUI();
    var withRo = wordCards.filter(function (w) { return mean(w, 'ro'); });
    var n = withRo.filter(function (w) { return mainLang(w) === 'ro'; }).length / withRo.length;
    var agree = els.optShareRo.value === '30' && shareOf('ro') === 30 && n > 0.18 && n < 0.42;
    add('Share slider and rotation agree', agree, 'missing share: slider ' + els.optShareRo.value + '%, rotation ' + Math.round(n * 100) + '%');
  } });
