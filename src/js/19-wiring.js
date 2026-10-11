  /* ---------- wiring ---------- */
  function wire() {
    on('btnKnown', 'click', function () { act('known'); });
    on('btnLearning', 'click', function () { act('learning'); });
    on('btnSkip', 'click', function () { act('skip'); });
    on('gradeRow', 'click', function (e) {
      var b = e.target.closest ? e.target.closest('.grade') : null;
      if (b) act('known', b.getAttribute('data-grade'));
    });
    on('btnSpeak', 'click', function (e) { e.stopPropagation(); speakCurrent(); });
    on('cardExamples', 'click', function (e) {
      var p = e.target.closest ? e.target.closest('.ex-practice') : null;
      if (p) { e.stopPropagation(); practiceSentencesOf(cards[currentIndex()]); return; }
      var b = e.target.closest ? e.target.closest('.ex-speak') : null;
      if (!b) return;
      e.stopPropagation();
      speakExample(Number(b.getAttribute('data-ex')), b);
    });
    on('btnShuffle', 'click', shuffleDeck);
    on('btnUndo', 'click', undo);
    on('btnReset', 'click', function () {
      closeOverlay(els.settingsView);
      askConfirm('Reset all progress?', 'This clears every “Known” and “Still learning” mark, the review schedule and the hardest-word counts in all three skills (reading, recall, listening) for words and sentences, and starts again from card 1. Your activity history and streak are kept. This cannot be undone.', 'Reset progress', function () {
        stopSpeech();
        resetMarks();
        state.deckMemory = {};
        setMode('all');
        toast('Progress reset.');
      });
    });
    on('confirmOk', 'click', function () {
      var cb = confirmCallback;
      confirmCallback = null;
      closeOverlay(els.confirmDialog);
      if (cb) cb();
    });
    on('confirmCancel', 'click', function () { confirmCallback = null; closeOverlay(els.confirmDialog); });
    on('confirmAlt', 'click', function () {
      var cb = confirmAltCallback;
      confirmCallback = null;
      confirmAltCallback = null;
      closeOverlay(els.confirmDialog);
      if (cb) cb();
    });
    on('modeAll', 'click', function () { setMode('all'); });
    on('modeLearning', 'click', function () { setMode('learning'); });
    on('modeUnmarked', 'click', function () { setMode('unmarked'); });
    on('btnEndRestart', 'click', function () { setMode(state.mode); });
    on('btnEndLearning', 'click', function () { setMode('learning'); });
    on('btnEndUnmarked', 'click', function () { setMode('unmarked'); });
    on('btnEndAll', 'click', function () { setMode('all'); });
    on('btnList', 'click', openList);
    on('revealHint', 'click', function (e) { e.stopPropagation(); toggleReveal(); });
    on('btnExport', 'click', function () { openTransfer('export'); });
    on('btnImport', 'click', function () { openTransfer('import'); });
    // Bound unconditionally so the self-check's CORE_BUTTONS assertion holds in all three
    // builds; the handlers no-op and the whole section is hidden when sync is disabled.
    on('btnSignIn', 'click', function () {
      if (!syncEnabled()) return;
      var email = str(els.syncEmail.value);
      if (email.indexOf('@') < 1 || email.indexOf('.') < 0) {
        setSyncStatus('Enter your email address first.', true);
        if (!testing) els.syncEmail.focus();
        return;
      }
      els.btnSignIn.disabled = true;
      setSyncStatus('Sending the sign-in link…');
      requestMagicLink(email).then(function () {
        setSyncStatus('Check ' + email + ' for the sign-in link. It expires in about an hour.');
        toast('Sign-in link sent to ' + email);
      }).catch(function (e) {
        // Sign-ups are closed on the server: only existing accounts can sign in.
        if (e && e.status === 422 && /signup/i.test(e.message || '')) {
          setSyncStatus('There is no account for ' + email + '. Sync is limited to existing accounts.', true);
          return;
        }
        onSyncError(e);
      }).then(function () { els.btnSignIn.disabled = false; });
    });
    on('syncEmail', 'keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); els.btnSignIn.click(); }
    });
    on('btnSignOut', 'click', function () { if (syncEnabled()) signOut(false); });
    on('btnSyncNow', 'click', syncNow);
    on('btnSyncTop', 'click', syncNow);
    on('btnCloseTransfer', 'click', function () { closeOverlay(els.transferView); });
    on('btnCopyProgress', 'click', function () {
      var text = els.transferText.value;
      var done = function (ok) {
        els.transferStatus.textContent = ok ? 'Copied. Paste it into “Import progress” on your other device.'
          : 'Copying is blocked here, so the code is selected. Copy it with your device’s copy command.';
        if (!ok && !testing) { els.transferText.focus(); els.transferText.select(); }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      else done(false);
    });
    on('btnDownloadProgress', 'click', function () {
      var name = 'mandarin-progress-' + dayKey() + '.json';
      try {
        var url = URL.createObjectURL(new Blob([els.transferText.value], { type: 'application/json' }));
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        els.transferStatus.textContent = 'Saved as ' + name + '. If no file appears, use Copy code instead.';
      } catch (err) {
        els.transferStatus.textContent = 'Saving a file is blocked here. Use Copy code instead.';
      }
    });
    on('importFile', 'change', function () {
      var f = els.importFile.files && els.importFile.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        els.transferText.value = String(reader.result || '');
        els.transferStatus.textContent = 'Loaded ' + f.name + '. Press Import to use it.';
      };
      reader.onerror = function () { els.transferStatus.textContent = 'This file could not be read. Try copying the code instead.'; };
      reader.readAsText(f);
      els.importFile.value = '';
    });
    on('btnApplyImport', 'click', startImport);
    on('btnSettings', 'click', function () { openOverlay(els.settingsView, els.btnCloseSettings); });
    on('btnHelp', 'click', function () { openOverlay(els.helpView, els.btnCloseHelp); els.helpView.querySelector('.help-body').scrollTop = 0; });
    on('btnCloseHelp', 'click', function () { closeOverlay(els.helpView); });
    on('btnShowTour', 'click', function () { closeOverlay(els.helpView); openTour(); });
    on('btnTourNext', 'click', function () {
      if (tourStep >= TOUR.length - 1) { closeTour(); return; }
      tourStep++;
      showTourStep();
    });
    on('btnTourBack', 'click', function () { if (tourStep > 0) { tourStep--; showTourStep(); } });
    on('btnTourSkip', 'click', closeTour);
    on('btnCloseSettings', 'click', function () { closeOverlay(els.settingsView); });
    on('btnProgress', 'click', function () { openProgress('progress'); });
    on('todayPill', 'click', function () { openProgress('today'); });
    on('btnTopic', 'click', openTopics);
    on('btnNews', 'click', openNews);
    ['En', 'Hu', 'De', 'Es', 'Ro'].forEach(function (K) {
      on('optLang' + K, 'change', function () {
        var box = els['optLang' + K], k = K.toLowerCase();
        state.langs[k] = box.checked;
        if (!MEANING_LANGS.some(function (l) { return LANG_AVAILABLE[l[0]] && state.langs[l[0]]; })) {
          state.langs[k] = true;
          box.checked = true;
          if (!testing) toast('Keep at least one translation on.');
          return;
        }
        render(false);
        save();
      });
    });
    on('footnote', 'click', function (e) { if (e.target.closest && e.target.closest('[data-news]')) openNews(); });
    on('btnNewsSee', 'click', openNews);
    on('btnNewsClose', 'click', markNewsSeen);
    on('btnCloseNews', 'click', function () { closeOverlay(els.newsView); });
    on('btnPet', 'click', openPet);
    on('btnClosePet', 'click', function () { closeOverlay(els.petView); });
    on('petBig', 'click', petTap);
    on('petRename', 'submit', function (e) {
      e.preventDefault();
      state.petName = els.petNameInput.value.trim().slice(0, 16);
      renderPet();
      save();
      if (!testing) toast('Your panda is now called ' + (state.petName || '宝宝') + '.');
    });
    on('btnWotdClose', 'click', dismissWotd);
    on('btnWotdStudy', 'click', function () { var zh = els.btnWotdStudy.getAttribute('data-study'); dismissWotd(); studyWord(zh); });
    on('btnCloseTopic', 'click', function () { closeOverlay(els.topicView); });
    on('topicGrid', 'click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-topic]') : null;
      if (b) setTopic(b.getAttribute('data-topic'));
    });
    on('pvBody', 'click', function (e) {
      var tb = e.target.closest ? e.target.closest('[data-pvtab]') : null;
      if (tb) { showPvTab(tb.getAttribute('data-pvtab')); els.pvBody.scrollTop = 0; return; }
      if (e.target.closest && e.target.closest('[data-pet]')) { closeOverlay(els.progressView); openPet(); return; }
      var t = e.target.closest ? e.target.closest('[data-topic]') : null;
      if (t) { closeOverlay(els.progressView); setTopic(t.getAttribute('data-topic')); return; }
      var w = e.target.closest ? e.target.closest('[data-study]') : null;
      if (w) { studyWord(w.getAttribute('data-study')); return; }
      var qz = e.target.closest ? e.target.closest('[data-quiz]') : null;
      if (qz) { closeOverlay(els.progressView); startQuiz(qz.getAttribute('data-quiz'), qz.getAttribute('data-lv') || state.level); }
    });
    on('btnCloseQuiz', 'click', function () { closeOverlay(els.quizView); });
    on('quizBody', 'click', function (e) {
      var c = e.target.closest ? e.target.closest('.qz-choices .choice') : null;
      if (c) { quizPick(Number(c.getAttribute('data-k'))); return; }
      if (e.target.closest && e.target.closest('.qz-play') && quiz) { speakParts([quiz.q.c.zh], null); return; }
      if (e.target.closest && e.target.closest('.qz-again') && quiz) { startQuiz(quiz.kind, quiz.lv); return; }
      var w = e.target.closest ? e.target.closest('[data-study]') : null;
      if (w) { closeOverlay(els.quizView); studyWord(w.getAttribute('data-study')); }
    });
    on('btnCloseProgress', 'click', function () { closeOverlay(els.progressView); });
    on('pvBody', 'click', function (e) {
      var b = e.target.closest ? e.target.closest('.pv-level') : null;
      if (!b) return;
      closeOverlay(els.progressView);
      setLevel(b.getAttribute('data-level'));
    });
    ['levelAll', 'level1', 'level2', 'level3'].forEach(function (id) {
      on(id, 'click', function () { setLevel(els[id].getAttribute('data-level')); });
    });
    on('lvChips', 'click', function (e) {
      var b = e.target.closest ? e.target.closest('.chip[data-lv]') : null;
      if (!b) return;
      listLevel = b.getAttribute('data-lv');
      renderList();
    });
    on('btnCloseList', 'click', function () { closeOverlay(els.listView); });
    on('searchInput', 'input', renderList);
    on('wordList', 'click', function (e) {
      var b = e.target.closest ? e.target.closest('.word-row') : null;
      if (b) studyCard(Number(b.getAttribute('data-index')));
    });
    els.listView.querySelector('.chips').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.chip[data-filter]') : null;
      if (!b) return;
      listFilter = b.getAttribute('data-filter');
      renderList();
    });
    on('btnSelfCheck', 'click', function () {
      closeOverlay(els.settingsView);
      openOverlay(els.diagView, els.btnCloseDiag);
      runSelfCheck();
    });
    on('btnRunCheck', 'click', runSelfCheck);
    on('btnCloseDiag', 'click', function () { closeOverlay(els.diagView); });
    OVERLAYS.forEach(function (id) {
      on(id, 'click', function (e) { if (e.target === els[id]) dismissOverlay(els[id]); });
    });
    on('optAutoReveal', 'change', function () {
      state.autoReveal = els.optAutoReveal.checked;
      if (currentIndex() !== null) setRevealed(state.autoReveal);
      save();
    });
    on('optVoice', 'change', function () {
      state.voice = els.optVoice.value;
      stopSpeech();
      pickVoice();
      save();
      if (zhVoice) toast('Voice: ' + voiceLabel(zhVoice) + (zhVoice.localService ? ' – works offline' : ' – online, needs internet'));
    });
    on('btnTestVoices', 'click', testVoices);
    on('optWarmup', 'change', function () { state.warmup = els.optWarmup.checked; save(); });
    on('modeDue', 'click', function () { setMode('due'); });
    on('modeHard', 'click', function () { setMode('hard'); });
    on('optPractice', 'change', function () {
      var v = els.optPractice.value, type = v.indexOf('s-') === 0 ? 'sentences' : 'words', prevPractice = state.practice;
      var p = type === 'sentences' ? v.slice(2) : v;
      state.practice = PRACTICE[p] ? p : 'zh';
      state.revealed = state.autoReveal && state.practice === 'zh';
      stopSpeech();
      var skillChanged = useSkill(skillOf(state.practice));
      // Similar words studies a smaller deck, so entering or leaving it rebuilds the deck.
      var pairsChanged = (prevPractice === 'pairs') !== (state.practice === 'pairs');
      if (type !== state.deckType) switchDeck(type, skillChanged);
      // A Due, Learning or Hardest deck was built from the previous skill's marks.
      else if ((skillChanged && state.mode !== 'all') || pairsChanged) setMode(state.mode);
      else { render(true); save(); }
      if (skillChanged && !testing) {
        toast(SKILLS[state.skill] + ' has its own progress: ' + counts().known + ' known, ' + dueCount(state.level) + ' due.', 4500);
      }
    });
    on('optTones', 'change', function () { state.toneColors = els.optTones.checked; render(false); save(); });
    on('optLabels', 'change', function () { state.labels = LABEL_MODES[els.optLabels.value] ? els.optLabels.value : 'both'; applyLabelMode(); save(); });
    on('optFadePinyin', 'change', function () { state.fadePinyin = els.optFadePinyin.checked; render(false); save(); });
    on('optChoicePinyin', 'change', function () { state.choicePinyin = els.optChoicePinyin.checked; render(false); save(); });
    on('optAutoplay', 'change', function () { state.autoplay = els.optAutoplay.checked; save(); });
    on('optVibrate', 'change', function () { state.vibrate = els.optVibrate.checked; buzz(15); save(); });
    on('choiceBox', 'click', function (e) {
      var b = e.target.closest ? e.target.closest('.choice') : null;
      if (!b) return;
      e.stopPropagation();
      pickChoice(Array.prototype.indexOf.call(els.choiceBox.children, b));
    });
    on('cardPrompt', 'submit', function (e) {
      e.preventDefault();
      checkTyped(e.target);
    });
    on('cardPrompt', 'click', function (e) {
      var t = e.target.closest ? e.target.closest('.build-tile') : null;
      if (t) { e.stopPropagation(); moveTile(Number(t.getAttribute('data-i')), t.getAttribute('data-where')); return; }
      var b = e.target.closest ? e.target.closest('.listen-btn') : null;
      if (!b) return;
      e.stopPropagation();
      var i = currentIndex();
      if (i !== null) speakParts([cards[i].zh], b);
    });
    on('btnSummaryClose', 'click', function () { closeOverlay(els.summaryView); });
    on('btnSummaryProgress', 'click', function () { closeOverlay(els.summaryView); openProgress(); });
    document.addEventListener('pointerdown', function () { userHasInteracted = true; }, true);
    document.addEventListener('keydown', function () { userHasInteracted = true; }, true);
    on('optRate', 'change', function () {
      var r = parseFloat(els.optRate.value);
      if (!isNaN(r)) state.rate = r;
      save();
    });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('pointerdown', function (e) {
      pointerFocus = e.target.closest ? e.target.closest('button, a, summary, [role="radio"]') : null;
    }, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Tab') pointerFocus = null; }, true);
    initSwipe();
    if (speechSupported && 'onvoiceschanged' in synth) {
      synth.addEventListener ? synth.addEventListener('voiceschanged', pickVoice) : (synth.onvoiceschanged = pickVoice);
    }
    window.addEventListener('pagehide', stopSpeech);
  }

  function init() {
    REQUIRED_IDS.forEach(function (id) {
      var node = $(id);
      if (!node) throw new Error('Missing page element #' + id);
      els[id] = node;
    });
    wordCards = loadCards();
    sentCards = buildSentences(wordCards);
    loadExtra();
    cards = wordCards;
    bindWordLookup();
    var v = validateCards();
    if (v.count !== EXPECTED_COUNT) reportError('Expected ' + EXPECTED_COUNT + ' vocabulary cards but found ' + v.count + '.');
    if (v.missing.length) reportError(v.missing.length + ' card(s) have missing fields, e.g. ' + v.missing[0] + '. Run the self-check for details.');
    if (v.dups.length) reportError('Duplicate Chinese headwords: ' + v.dups.join(', ') + '.');
    var saved = loadSaved();
    useDeckType(saved && saved.deckType === 'sentences' ? 'sentences' : 'words');
    restore(saved);
    migrateSrs();
    upgradeLabels();
    syncSettingsUI();
    applyLabelMode();
    wire();
    updateTopicBtn();
    renderCombo();
    if (applyFreezes()) save();
    renderWotd();
    // Someone opening the app for the first time has nothing to catch up on.
    if (!state.seenTour && latestNews()) state.newsSeen = latestNews().version;
    renderNewsStrip();
    renderWotd();
    renderPet();
    pickVoice();
    render(false);
    updateFootnote();
    if (!storageOK) toast('This browser is blocking local storage, so your progress will not be kept after the page is closed.', 7000);
    window.__appStarted = true;
    initSync();
    if (!state.seenTour) setTimeout(function () { if (!anyOverlayOpen()) openTour(); }, 350);
    else setTimeout(function () { if (!anyOverlayOpen()) maybeShowRecap(); }, 600);
    window.__mandarinApp = { runSelfCheck: runSelfCheck, state: state, sync: sync, cards: function () { return cards; }, words: function () { return wordCards; }, sentences: function () { return sentCards; } };
  }

  try {
    init();
  } catch (err) {
    reportError('The app could not start: ' + (err && err.message ? err.message : err));
    var hz = $('cardHanzi'), py = $('cardPinyin');
    if (hz) hz.textContent = '⚠';
    if (py) py.textContent = 'The app failed to start – see the error message above.';
  }
