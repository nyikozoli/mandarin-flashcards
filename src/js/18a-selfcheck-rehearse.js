  /* ---------- self-check: rehearse known languages ---------- */
  // Each entry runs inside functionalTest (testing = true). rehearseTests puts the languages, the rehearse
  // settings, the practice style and the deck back after every entry.
  var REHEARSE_TESTS = [];
  function resetRehearseTestState(keep) {
    state.langs = JSON.parse(JSON.stringify(keep.langs));
    state.rehearse = JSON.parse(JSON.stringify(keep.rehearse));
    rebuildSkills();
    rehearseCard = null;
    syncSettingsUI();
  }
  function rehearseTests(add) {
    var keep = { langs: JSON.parse(JSON.stringify(state.langs)), rehearse: JSON.parse(JSON.stringify(state.rehearse)),
      practice: state.practice, deckType: state.deckType, deck: state.deck.slice(), pos: state.pos, revealed: state.revealed };
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
