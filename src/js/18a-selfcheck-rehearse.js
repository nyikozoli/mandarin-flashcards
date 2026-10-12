  /* ---------- self-check: rehearse known languages ---------- */
  // Each entry runs inside functionalTest (testing = true). rehearseTests puts the languages, the rehearse
  // settings, the practice style and the deck back after every entry.
  var REHEARSE_TESTS = [];
  function resetRehearseTestState(keep) {
    state.langs = JSON.parse(JSON.stringify(keep.langs));
    state.rehearse = JSON.parse(JSON.stringify(keep.rehearse));
    rebuildSkills();
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
