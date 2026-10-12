  /* ---------- self-check ---------- */
  function runSelfCheck() {
    var results = [];
    var add = function (name, ok, detail, info) { results.push({ name: name, ok: ok, detail: detail || '', info: !!info }); };

    var v = validateCards();
    add('Exactly ' + EXPECTED_COUNT + ' cards exist', v.count === EXPECTED_COUNT, 'Found ' + v.count + ' cards.');
    add('Every card has Chinese, pinyin, English, Hungarian and complete example sentences with pinyin', v.missing.length === 0,
      v.missing.length ? v.missing.slice(0, 12).join('\n') + (v.missing.length > 12 ? '\n… and ' + (v.missing.length - 12) + ' more' : '') :
      'All cards have every field; ' + wordCards.reduce(function (a, c) { return a + c.ex.length; }, 0) + ' example sentences, each with pinyin, English and Hungarian.');
    var lvBad = [];
    var lvDetail = LEVELS.map(function (lv) {
      var got = wordCards.filter(function (c) { return String(c.lv) === lv; }).length;
      if (got !== EXPECTED_LEVELS[lv]) lvBad.push(lv);
      return 'HSK ' + lv + ': ' + got + (got !== EXPECTED_LEVELS[lv] ? ' (expected ' + EXPECTED_LEVELS[lv] + ')' : '');
    }).join(' · ');
    add('Every card has an HSK level and the level counts are right', lvBad.length === 0 && wordCards.every(function (c) { return c.lv >= 1 && c.lv <= 3; }), lvDetail);
    add('No duplicate Chinese headwords', v.dups.length === 0, v.dups.length ? 'Duplicates: ' + v.dups.join(', ') : 'All ' + v.count + ' headwords are unique.');
    var missingIds = REQUIRED_IDS.filter(function (id) { return !$(id); });
    add('All page elements used by the app exist', missingIds.length === 0, missingIds.length ? 'Missing: #' + missingIds.join(', #') : REQUIRED_IDS.length + ' elements found.');
    var unbound = CORE_BUTTONS.filter(function (id) { return !bound[id]; });
    add('Core controls have event handlers attached', unbound.length === 0, unbound.length ? 'Not attached: ' + unbound.join(', ') : CORE_BUTTONS.length + ' controls wired.');

    functionalTest(add);

    if (speechSupported) {
      var voices = [];
      try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
      pickVoice();
      add('Speech synthesis', true, 'Supported. ' + voices.length + ' voice(s) available; Chinese voice: ' +
        (zhVoice ? zhVoice.name + ' (' + zhVoice.lang + (zhVoice.localService ? ', offline' : ', online') + ')' : 'none found – the default voice will be asked to speak zh-CN') + '. Chinese voices: ' +
        voices.filter(function (v) { return /^(zh|cmn)/.test(langOf(v)); }).length + '.', true);
    } else {
      add('Speech synthesis', true, 'Not supported in this browser – the Read aloud button shows a message instead.', true);
    }
    add('Progress storage', storageOK, storageOK ? 'localStorage is available; progress is kept between visits.' : 'localStorage is blocked; progress will be lost when the page is closed.', !storageOK);

    // Sync runs against a simulated server and finishes after the other checks; the list
    // shows it as pending, then redraws. `done` resolves with the final results.
    var pending = { name: 'Cloud sync logic (simulated server)', ok: true, detail: 'Running…', info: true };
    results.push(pending);
    var first = renderDiagResults(results);
    var done = syncSelfTest().then(function (r) {
      results[results.indexOf(pending)] = r;
      return { failed: renderDiagResults(results), results: results };
    });
    return { failed: first, results: results, done: done };
  }
  function renderDiagResults(results) {
    els.diagResults.textContent = '';
    var failed = 0;
    results.forEach(function (r) {
      var cls = r.info ? 'info' : r.ok ? 'pass' : 'fail';
      if (!r.ok && !r.info) failed++;
      var li = el('li', 'diag-item ' + cls);
      li.appendChild(el('span', 'diag-icon', r.info ? 'ℹ' : r.ok ? '✓' : '✗'));
      var body = el('div');
      body.appendChild(el('span', 'diag-name', r.name));
      if (r.detail) body.appendChild(el('span', 'diag-detail', r.detail));
      li.appendChild(body);
      els.diagResults.appendChild(li);
    });
    var checks = results.filter(function (r) { return !r.info; }).length;
    els.diagSummary.className = 'diag-summary ' + (failed ? 'fail' : 'pass');
    els.diagSummary.textContent = failed ? '✗ ' + failed + ' of ' + checks + ' checks failed.' : '✓ All ' + checks + ' checks passed.';
    return failed;
  }

  // Runs the sync code against a fake server (window.fetch is swapped), so it needs no network
  // and runs in every build. Nothing reaches localStorage: `testing` blocks saveSyncState().
  function syncSelfTest() {
    var name = 'Cloud sync logic (simulated server)';
    var keep = { config: SYNC_CONFIG, fetch: window.fetch, testing: testing, timer: syncTimer,
      sync: JSON.parse(JSON.stringify(sync)), status: JSON.parse(JSON.stringify(state.status)), statusLine: els.syncStatus.textContent };
    var checks = {};
    var reply = {};
    var payload = btoa(JSON.stringify({ sub: 'self-check-user' })).replace(/=+$/, '');
    var jwt = 'h.' + payload + '.s';
    var session = function (fresh) {
      return { access_token: jwt, refresh_token: 'refresh', expires_at: Date.now() + (fresh ? 3600000 : -1000), email: 'check@example.invalid' };
    };
    SYNC_CONFIG = { url: 'https://sync.invalid', anonKey: 'anon', siteUrl: 'https://example.invalid/' };
    window.fetch = function (url, init) {
      var path = String(url).slice(SYNC_CONFIG.url.length);
      var key = Object.keys(reply).filter(function (k) { return path.indexOf(k) === 0; })[0];
      var r = key ? reply[key](init || {}) : { status: 404, body: { message: 'no route ' + path } };
      if (r === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve({ ok: r.status < 300, status: r.status, text: function () { return Promise.resolve(r.body == null ? '' : JSON.stringify(r.body)); } });
    };
    var logout = function () { return { status: 204, body: null }; };
    testing = true;
    return Promise.resolve()
      .then(function () {
        sync.session = session(false);
        reply = { '/auth/v1/token': function () { return 'offline'; } };
        return ensureSession().then(function () { checks['offline refresh keeps the sign-in'] = !!sync.session; });
      })
      .then(function () {
        sync.session = session(false);
        reply = { '/auth/v1/token': function () { return { status: 503, body: { message: 'unavailable' } }; } };
        return ensureSession().then(function () { checks['server error keeps the sign-in'] = !!sync.session; });
      })
      .then(function () {
        sync.session = session(false); sync.dirty = true; sync.lastSyncedAt = '2026-01-01T00:00:00.000000+00:00';
        reply = { '/auth/v1/token': function () { return { status: 400, body: { error_description: 'Invalid Refresh Token' } }; }, '/auth/v1/logout': logout };
        return ensureSession().then(function () {
          checks['rejected token signs out but keeps unsynced changes'] = !sync.session && sync.dirty === true && !!sync.lastSyncedAt;
        });
      })
      .then(function () {
        sync.session = session(true); sync.dirty = true; sync.conflict = false; sync.busy = false; sync.lastSyncedAt = null;
        reply = { '/rest/v1/rpc/upsert_progress': function (init) {
          var body = JSON.parse(init.body);
          checks['upload never sends a user id'] = body.user_id === undefined && body.p_data && !!body.p_data.status;
          return { status: 200, body: [{ applied: true, server_updated_at: '2026-02-02T10:00:00.000000+00:00' }] };
        } };
        return doPush().then(function () {
          checks['accepted upload records the server time'] = sync.lastSyncedAt === '2026-02-02T10:00:00.000000+00:00' && !sync.conflict;
        });
      })
      .then(function () {
        sync.dirty = true; sync.busy = false;
        reply = {
          '/rest/v1/rpc/upsert_progress': function () { return { status: 200, body: [{ applied: false, server_updated_at: '2026-03-03T10:00:00.000000+00:00' }] }; },
          '/rest/v1/progress': function () { return { status: 200, body: [{ version: 1, updated_at: '2026-03-03T10:00:00.000000+00:00', data: { status: {} } }] }; }
        };
        return doPush().then(function () {
          checks['refused upload offers both copies'] = sync.conflict === true && !els.confirmDialog.hidden && !els.confirmAlt.hidden &&
            /cloud copy/i.test(els.confirmOk.textContent + els.confirmAlt.textContent) && /this device/i.test(els.confirmOk.textContent + els.confirmAlt.textContent) &&
            els.confirmCompare.querySelectorAll('.cmp').length === 2 && els.confirmCompare.querySelectorAll('.cmp.newer').length === 1;
          els.confirmCancel.click();
        });
      })
      .then(function () {
        reply = { '/auth/v1/otp': function (init) {
          var b = JSON.parse(init.body);
          checks['sign-in link creates the account'] = b.create_user === true && b.email === 'check@example.invalid';
          return { status: 200, body: {} };
        } };
        return requestMagicLink('check@example.invalid');
      })
      .then(function () {
        sync.session = session(true); sync.dirty = true; sync.conflict = false; sync.busy = false;
        reply = { '/rest/v1/rpc/upsert_progress': function (init) {
          checks['upload on close uses keepalive'] = init.keepalive === true;
          return { status: 200, body: [{ applied: true, server_updated_at: '2026-04-04T10:00:00.000000+00:00' }] };
        } };
        return flushPush(true);
      })
      .catch(function (e) { checks['ran without errors'] = false; checks.error = e && e.message ? e.message : String(e); })
      .then(function () {
        clearTimeout(syncTimer);
        closeOverlay(els.confirmDialog);
        confirmCallback = null; confirmAltCallback = null;
        window.fetch = keep.fetch;
        SYNC_CONFIG = keep.config;
        Object.keys(sync).forEach(function (k) { sync[k] = keep.sync[k]; });
        sync.busy = false;
        state.status = keep.status;
        testing = keep.testing;
        syncTimer = null;
        if (sync.dirty && sync.session) schedulePush();
        renderSyncUI();
        els.syncStatus.textContent = keep.statusLine;
        var names = Object.keys(checks).filter(function (k) { return k !== 'error'; });
        var failedNames = names.filter(function (k) { return !checks[k]; });
        var expectedChecks = 8;
        var ok = !failedNames.length && names.length === expectedChecks;
        return { name: name, ok: ok, info: false,
          detail: (ok ? names.join(', ') : 'Failed: ' + (failedNames.join(', ') || 'only ' + names.length + ' of ' + expectedChecks + ' steps ran')) + (checks.error ? ' — ' + checks.error : '') };
      });
  }

  function functionalTest(add) {
    stashSkill();
    var marksSnap = JSON.parse(JSON.stringify(state.marks)), skillSnap = state.skill;
    var deckMemSnap = JSON.parse(JSON.stringify(state.deckMemory)), choicePySnap = state.choicePinyin;
    var snap = {
      status: JSON.parse(JSON.stringify(state.status)), mode: state.mode, deck: state.deck.slice(), pos: state.pos,
      shuffled: state.shuffled, revealed: state.revealed, autoReveal: state.autoReveal, level: state.level,
      srs: JSON.parse(JSON.stringify(state.srs)), misses: JSON.parse(JSON.stringify(state.misses)), practice: state.practice, toneColors: state.toneColors, fadePinyin: state.fadePinyin,
      deckType: state.deckType, newsSeen: state.newsSeen, petName: state.petName, seals: JSON.parse(JSON.stringify(state.seals)), questDays: state.questDays,
      blitzBest: JSON.parse(JSON.stringify(state.blitzBest)), exams: JSON.parse(JSON.stringify(state.exams)), quests: JSON.parse(JSON.stringify(state.quests)), freezes: state.freezes, frozen: state.frozen.slice(), wotdSeen: state.wotdSeen, rungs: JSON.parse(JSON.stringify(state.rungs)), ladderSeen: state.ladderSeen, topic: state.topic, xp: state.xp, bestCombo: state.bestCombo, learned: JSON.parse(JSON.stringify(state.learned)),
      activity: JSON.parse(JSON.stringify(state.activity)), milestones: state.milestones.slice(), seenTour: state.seenTour
    };
    var undoSnap = undoStack.slice();
    var diagWasOpen = !els.diagView.hidden;
    var tourWasOpen = !els.tourView.hidden;
    els.tourView.hidden = true;
    els.helpView.hidden = true;
    var searchSnap = els.searchInput.value;
    var filterSnap = listFilter;
    var key = function (k) { document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); };
    var cardAt = function (p) { return cards[state.deck[p]]; };
    // A right answer on a new card schedules it forward but keeps it Learning until its next review is a week away.
    var answeredRight = function (zh) { var r = state.srs[zh]; return state.status[zh] === 'known' || (state.status[zh] === 'learning' && !!r && r.b >= 1 && r.d > dayKey()); };
    // Puts a card one step before Known, so the next right answer makes it Known.
    var nearlyKnown = function (zh) { state.srs[zh] = { b: 2, d: dayKey() }; };
    stopSpeech();
    testing = true;
    els.diagView.hidden = true;
    syncOverlayState();
    useDeckType('words');
    try {
      if (cards.length < 6) throw new Error('Not enough cards to test the controls.');
      state.status = {};
      state.srs = {};
      state.misses = {};
      state.practice = 'zh';
      state.toneColors = true;
      state.fadePinyin = false;
      state.choicePinyin = true;
      state.skill = 'read';
      resetMarks();
      state.deckMemory = {};
      state.autoReveal = false;
      state.level = 'all';
      els.modeAll.click();
      var c0 = cardAt(0), c1 = cardAt(1), c2 = cardAt(2), c3 = cardAt(3), c4 = cardAt(4), c5 = cardAt(5);
      nearlyKnown(c0.zh); nearlyKnown(c2.zh);
      add('First card renders', !els.card.hidden && els.cardHanzi.textContent === c0.zh && els.cardPinyin.textContent === c0.py &&
        els.cardCounter.textContent === 'Card 1 / ' + cards.length, 'Showing ' + els.cardHanzi.textContent + ' (' + els.cardPinyin.textContent + '), counter “' + els.cardCounter.textContent + '”.');

      var hiddenBefore = getComputedStyle(els.cardAnswer).display === 'none';
      els.card.click();
      var shownAfter = getComputedStyle(els.cardAnswer).display !== 'none' && els.cardEn.textContent === c0.en;
      els.card.click();
      var hiddenAgain = getComputedStyle(els.cardAnswer).display === 'none' && els.cardHanzi.textContent === c0.zh;
      add('Tapping the card reveals and hides the meanings', hiddenBefore && shownAfter && hiddenAgain, 'Hidden → shown → hidden; Chinese and pinyin stay visible.');

      els.btnKnown.click();
      add('“I know it →” marks Known and advances', state.status[c0.zh] === 'known' && state.pos === 1 && els.cardHanzi.textContent === c1.zh && els.knownCount.textContent === '1');
      els.btnLearning.click();
      add('“← Still learning” marks Learning and advances', state.status[c1.zh] === 'learning' && state.pos === 2 && els.learningCount.textContent === '1');
      els.btnSkip.click();
      add('“Skip” advances without marking', !state.status[c2.zh] && state.pos === 3 && els.cardCounter.textContent === 'Card 4 / ' + cards.length);
      els.btnUndo.click();
      add('“Undo” goes back one step', state.pos === 2 && els.cardHanzi.textContent === c2.zh);

      key('ArrowRight');
      var kr = state.status[c2.zh] === 'known' && state.pos === 3;
      key('ArrowLeft');
      var kl = state.status[c3.zh] === 'learning' && state.pos === 4;
      key(' ');
      var ks = !state.status[c4.zh] && state.pos === 5;
      key('ArrowDown');
      var ku = state.revealed === true;
      key('ArrowDown');
      add('Keyboard shortcuts (→, ←, Space, ↓)', kr && kl && ks && ku && !state.revealed, '→ known: ' + kr + ', ← learning: ' + kl + ', Space skip: ' + ks + ', ↓ reveal: ' + ku);

      var n = counts();
      add('Progress counters and bar update', els.knownCount.textContent === String(n.known) && els.learningCount.textContent === String(n.learning) &&
        n.known === 2 && n.learning === 2 && els.progKnown.style.width !== '0%', 'Known ' + n.known + ', Learning ' + n.learning + ', bar ' + els.progKnown.style.width + '.');

      els.modeLearning.click();
      var learnOk = state.mode === 'learning' && state.deck.length === 2 && state.deck.every(function (i) { return state.status[cards[i].zh] === 'learning'; });
      els.modeUnmarked.click();
      var unOk = state.mode === 'unmarked' && state.deck.length === cards.length - 4 && state.deck.every(function (i) { return !state.status[cards[i].zh]; });
      els.modeAll.click();
      var allOk = state.mode === 'all' && state.deck.length === cards.length;
      add('Study modes filter correctly', learnOk && unOk && allOk, 'Learning only: ' + learnOk + ', unmarked only: ' + unOk + ', all cards: ' + allOk);

      els.btnShuffle.click();
      var sorted = state.deck.slice().sort(function (a, b) { return a - b; });
      var perm = sorted.length === cards.length && sorted.every(function (x, k) { return x === k; });
      add('Shuffle keeps every card once and restarts the deck', perm && state.pos === 0 && state.shuffled);

      var lvOk = true, lvInfo = [];
      ['level1', 'level2', 'level3'].forEach(function (id, k) {
        els[id].click();
        var want = cards.filter(function (c) { return c.lv === k + 1; }).length;
        var ok = state.level === String(k + 1) && state.deck.length === want && state.deck.every(function (i) { return cards[i].lv === k + 1; }) &&
          els.cardCounter.textContent === 'Card 1 / ' + want;
        lvOk = lvOk && ok;
        lvInfo.push('HSK ' + (k + 1) + ': ' + state.deck.length + ' cards');
      });
      els.levelAll.click();
      lvOk = lvOk && state.level === 'all' && state.deck.length === cards.length;
      add('HSK level selector filters the deck', lvOk, lvInfo.join(' · ') + ' · all levels: ' + state.deck.length);

      els.btnProgress.click();
      var cells = els.pvBody.querySelectorAll('.pv-cell').length;
      var lvRows = els.pvBody.querySelectorAll('.pv-level').length;
      var known2 = els.pvBody.querySelectorAll('.pv-cell.s-known').length;
      var pvOk = !els.progressView.hidden && cells === cards.length && lvRows === 3 && known2 === counts().known && !!els.pvBody.querySelector('svg');
      els.btnCloseProgress.click();
      var srsResult = (function () {
        state.status = {}; state.srs = {}; state.misses = {};
        els.modeAll.click();
        var a0 = cardAt(0), a1 = cardAt(1);
        els.btnKnown.click();
        els.btnLearning.click();
        var sched = state.srs[a0.zh] && state.srs[a0.zh].b === 1 && state.srs[a0.zh].d === addDays(1) &&
          state.srs[a1.zh] && state.srs[a1.zh].b === 0 && state.srs[a1.zh].d === dayKey() && state.misses[a1.zh] === 1;
        els.modeDue.click();
        var due = state.deck.length === 1 && cards[state.deck[0]] === a1 && els.countDueMode.textContent === '1';
        els.btnLearning.click();
        var requeue = state.deck.length === 2 && cards[state.deck[1]] === a1 && state.misses[a1.zh] === 2;
        els.btnUndo.click();
        var undone = state.deck.length === 1 && state.misses[a1.zh] === 1;
        els.modeHard.click();
        var hard = state.deck.length === 1 && cards[state.deck[0]] === a1;
        els.modeAll.click();
        return { ok: sched && due && requeue && undone && hard, d: 'schedule: ' + sched + ', due deck: ' + due + ', missed word re-queued: ' + requeue + ', undo: ' + undone + ', hardest deck: ' + hard };
      })();
      add('Spaced repetition: “Due” and “Hardest” decks', srsResult.ok, srsResult.d);

      var first = cardAt(0);
      var tonesOk = els.cardPinyin.querySelectorAll('.t1,.t2,.t3,.t4,.t5').length >= 1 && els.cardHanzi.querySelectorAll('.cell.t1,.cell.t2,.cell.t3,.cell.t4,.cell.t5').length === charLen(first.zh) &&
        els.cardHanzi.textContent === first.zh && els.cardPinyin.textContent === first.py;
      add('Tone colours on characters and pinyin', tonesOk, first.zh + ' ' + first.py + ': ' + els.cardHanzi.innerHTML.replace(/<[^>]+class="[^"]*?(t\d)"[^>]*>/g, '[$1]').replace(/<\/span>/g, ''));

      var head = els.cardHanzi.parentNode;
      state.practice = 'reverse'; render(false);
      var rev = getComputedStyle(head).display === 'none' && !els.cardPrompt.hidden && els.cardPrompt.textContent.indexOf(first.en) !== -1;
      els.card.click();
      var revShown = getComputedStyle(head).display !== 'none' && els.cardPrompt.hidden;
      els.card.click();
      state.practice = 'listen'; render(false);
      var listen = getComputedStyle(head).display === 'none' && !!els.cardPrompt.querySelector('.listen-btn');
      state.practice = 'choice'; render(false);
      var opts = els.choiceBox.querySelectorAll('.choice');
      var cur = cards[currentIndex()], posBefore = state.pos, right = -1;
      for (var oi = 0; oi < opts.length; oi++) if (opts[oi].getAttribute('data-ok') === '1') right = oi;
      if (right >= 0) opts[right].click();
      var choice = opts.length === 4 && right >= 0 && answeredRight(cur.zh) && state.pos === posBefore + 1;
      state.practice = 'hanzi'; render(false);
      var hidden = getComputedStyle(els.cardPinyin).visibility === 'hidden' && getComputedStyle(els.btnSpeak).visibility === 'hidden' &&
        getComputedStyle(head).display !== 'none';
      els.card.click();
      var hanziReveal = getComputedStyle(els.cardPinyin).visibility === 'visible' && getComputedStyle(els.btnSpeak).visibility === 'visible';
      els.card.click();
      var hanzi = hidden && hanziReveal;
      state.practice = 'zh'; render(false);
      state.toneColors = true; render(false);
      var keyOn = !els.legendTones.hidden && els.legendTones.querySelectorAll('.t1,.t2,.t3,.t4,.t5').length === 5;
      state.toneColors = false; render(false);
      var keyOff = els.legendTones.hidden;
      state.toneColors = true; render(false);
      add('Tone colour key next to the progress bar', keyOn && keyOff, 'shown with tone colours on: ' + keyOn + ', hidden when off: ' + keyOff);
      var gradeRes = (function () {
        var deckSnap = state.deck, posSnap = state.pos, w = wordCards[0];
        var only = function () { state.deck = [0]; state.pos = 0; state.revealed = true; render(false); };
        state.practice = 'zh';
        delete state.srs[w.zh];
        only();
        var shown = !els.gradeRow.hidden && els.gradeRow.querySelector('.easy small').textContent === fmtWait(SRS_DAYS[2]);
        els.gradeRow.querySelector('.easy').click();
        var easy = state.srs[w.zh] && state.srs[w.zh].b === 2 && state.status[w.zh] === 'learning';
        only();
        els.gradeRow.querySelector('.hard').click();
        var hard = state.srs[w.zh].b === 2 && state.srs[w.zh].d === addDays(SRS_DAYS[2]);
        only();
        key('ArrowRight');
        var good = state.srs[w.zh].b === 3;
        state.srs[w.zh] = { b: SRS_DAYS.length - 2, d: dayKey() };
        only();
        els.gradeRow.querySelector('.easy').click();
        var capped = state.srs[w.zh].b === SRS_DAYS.length - 1 && SRS_DAYS[SRS_DAYS.length - 1] === 120;
        state.practice = 'choice';
        only();
        var hiddenInQuiz = els.gradeRow.hidden;
        state.practice = 'zh';
        delete state.srs[w.zh]; delete state.status[w.zh];
        state.deck = deckSnap; state.pos = posSnap; state.revealed = false; render(false);
        return { ok: shown && easy && hard && good && capped && hiddenInQuiz,
          d: 'buttons show the next wait: ' + shown + ', Easy skips a box: ' + easy + ', Hard keeps it: ' + hard + ', Good (→) adds one: ' + good +
            ', longest wait 120 days: ' + capped + ', hidden in multiple choice: ' + hiddenInQuiz };
      })();
      add('Hard, Good and Easy set the next review', gradeRes.ok, gradeRes.d);

      var fcRes = (function () {
        var w = wordCards[0], v = wordCards[1];
        var sv = [state.srs[w.zh], state.srs[v.zh]];
        state.srs[w.zh] = { b: 1, d: addDays(-2) };
        state.srs[v.zh] = { b: 2, d: addDays(3) };
        var f = forecast(7);
        var today0 = f[0].n >= 1, day3 = f[3].n >= 1 && f[0].key === dayKey() && f.length === 7;
        openProgress();
        var drawn = els.pvBody.querySelectorAll('.pv-fc-day').length === 7;
        closeOverlay(els.progressView);
        if (sv[0]) state.srs[w.zh] = sv[0]; else delete state.srs[w.zh];
        if (sv[1]) state.srs[v.zh] = sv[1]; else delete state.srs[v.zh];
        return { ok: today0 && day3 && drawn, d: 'overdue counts today: ' + today0 + ', a review in 3 days lands on day 4: ' + day3 + ', 7 bars drawn: ' + drawn };
      })();
      add('Coming reviews forecast', fcRes.ok, fcRes.d);

      var clozeRes = (function () {
        var deckSnap = state.deck, posSnap = state.pos, w = wordCards[3];
        state.practice = 'cloze';
        state.deck = [3]; state.pos = 0; state.revealed = false; render(false);
        var prompt = els.cardPrompt.textContent;
        var hidden = els.card.classList.contains('hide-face') && !els.cardPrompt.hidden && !!els.cardPrompt.querySelector('.gap') && prompt.indexOf(w.zh) === -1;
        var chips = els.choiceBox.querySelectorAll('.choice'), right = els.choiceBox.querySelector('[data-ok="1"]');
        var fair = chips.length === 4 && !!right && right.textContent.indexOf(w.zh) !== -1 &&
          Array.prototype.every.call(chips, function (b) { return b === right || prompt.indexOf(b.querySelector('.choice-zh').textContent) === -1; });
        right.click();
        var graded = answeredRight(w.zh);
        useDeckType('sentences');
        var fallback = state.practice === 'choice';
        useDeckType('words');
        delete state.status[w.zh]; delete state.srs[w.zh];
        state.practice = 'zh';
        state.deck = deckSnap; state.pos = posSnap; render(false);
        return { ok: hidden && fair && graded && fallback,
          d: w.zh + ': sentence with a gap, word hidden: ' + hidden + ', four chips and only the right one fits: ' + fair +
            ', right answer marks Known: ' + graded + ', sentences fall back to multiple choice: ' + fallback };
      })();
      add('Fill the gap', clozeRes.ok, clozeRes.d);

      var buildRes = (function () {
        var deckSnap = state.deck, posSnap = state.pos;
        useDeckType('sentences');
        var si = -1;
        for (var i = 0; i < sentCards.length && si === -1; i++) {
          var bt = buildTarget(sentCards[i]);
          if (bt && bt.tiles.length >= 3 && new Set(bt.tiles.map(function (t) { return t.text; })).size === bt.tiles.length) si = i;
        }
        var sc = sentCards[si];
        state.practice = 'build';
        var place = function (orderOf) {
          state.deck = [si]; state.pos = 0; state.revealed = false; render(false);
          var n = buildQ.tiles.length;
          for (var k = 0; k < n; k++) {
            var want = orderOf(k, n);
            var b = Array.prototype.find.call(els.cardPrompt.querySelectorAll('.build-bank .build-tile'), function (x) { return buildQ.tiles[Number(x.getAttribute('data-i'))].orig === want; });
            if (b) b.click();
          }
        };
        place(function (k, n) { return n - 1 - k; });
        var wrongShown = state.revealed === true && !state.status[sc.zh];
        place(function (k) { return k; });
        var graded = answeredRight(sc.zh);
        state.deck = [si]; state.pos = 0; state.revealed = false; render(false);
        var first = els.cardPrompt.querySelector('.build-bank .build-tile');
        first.click();
        var placed = els.cardPrompt.querySelectorAll('.build-line .build-tile').length === 1;
        key('Backspace');
        var back = els.cardPrompt.querySelectorAll('.build-line .build-tile').length === 0;
        var hidden = els.card.classList.contains('hide-face');
        useDeckType('words');
        var fallback = state.practice === 'reverse';
        delete state.status[sc.zh]; delete state.srs[sc.zh];
        state.practice = 'zh';
        state.deck = deckSnap; state.pos = posSnap; render(false);
        return { ok: si !== -1 && wrongShown && graded && placed && back && hidden && fallback,
          d: sc.zh + ': a wrong order shows the sentence without marking it: ' + wrongShown + ', the right order marks Known: ' + graded +
            ', tap places a word: ' + placed + ', Backspace takes it back: ' + back + ', sentence hidden meanwhile: ' + hidden + ', words fall back to Meaning → Chinese: ' + fallback };
      })();
      add('Build the sentence', buildRes.ok, buildRes.d);

      var funRes = (function () {
        var rd0 = readability().n;
        var sc = sentCards[0];
        sentenceWords(sc.zh).forEach(function (w) { state.marks.read.status[w.zh] = 'known'; });
        stashSkill();
        var rd1 = readability(), cv = coverage();
        var reads = rd0 === 0 && rd1.n >= 1 && rd1.total === sentCards.length;
        var covers = !cv.has || (cv.words > 0 && cv.words <= cv.wordsMax && cv.chars >= cv.words && cv.charsMax <= 1);
        var nu = nextUsefulWord();
        var useful = !nu || (state.status[nu.zh] !== 'known' && wordCards.every(function (w) { return !w.rk || state.status[w.zh] === 'known' || w.rk >= nu.rk; }));
        sentenceWords(sc.zh).forEach(function (w) { delete state.marks.read.status[w.zh]; });
        var ranks = rankOf(0) === 0 && rankOf(299) === 0 && rankOf(300) === 1 && rankOf(25000) === RANKS.length - 1;
        var xp0 = state.xp;
        gainXp(7);
        var xp = state.xp === xp0 + 7;
        combo = 0;
        bumpCombo('known'); bumpCombo('known'); bumpCombo('known');
        var comboOn = !els.comboTag.hidden && els.comboTag.textContent === '连 ×3' && state.bestCombo >= 3;
        bumpCombo('learning');
        var comboOff = els.comboTag.hidden && combo === 0;
        var deckSnap = state.deck, posSnap = state.pos, w0 = wordCards[0];
        state.deck = [0]; state.pos = 0; render(false);
        var rankTag = !w0.rk || (!els.cardRank.hidden && els.cardRank.textContent.indexOf('#' + w0.rk) === 0);
        state.deck = deckSnap; state.pos = posSnap; render(false);
        openProgress();
        var drawn = !!els.pvBody.querySelector('.rp-num') && !!els.pvBody.querySelector('.st-rank');
        closeOverlay(els.progressView);
        return { ok: reads && covers && useful && ranks && xp && comboOn && comboOff && rankTag && drawn,
          d: 'readable sentences counted: ' + reads + ', coverage sane: ' + covers + ', most useful word picked: ' + useful + ', ranks: ' + ranks +
            ', XP adds: ' + xp + ', combo shows at 3: ' + comboOn + ', resets on a miss: ' + comboOff + ', rank badge: ' + rankTag + ', progress sections drawn: ' + drawn };
      })();
      add('Reading power, XP, ranks and combo', funRes.ok, funRes.d);

      var topicRes = (function () {
        if (!EXTRA.topics.length) return { ok: true, d: 'no topic data in this build' };
        var t = EXTRA.topics[2];
        els.btnTopic.click();
        var open = !els.topicView.hidden && els.topicGrid.querySelectorAll('.tp-tile').length === EXTRA.topics.length + 1;
        els.topicGrid.querySelector('[data-topic="' + t.id + '"]').click();
        var filtered = els.topicView.hidden && state.deck.length === wordsIn(t.id).length && state.deck.every(function (i) { return cards[i].tp === t.id; });
        var btn = els.topicBtnName.textContent === t.en;
        useDeckType('sentences'); setMode('all');
        var sent = state.deck.length > 0 && state.deck.every(function (i) { return inTopic(cards[i]); }) && state.deck.length < sentCards.length;
        useDeckType('words');
        setTopic('all');
        var back = state.deck.length === wordCards.length;
        return { ok: open && filtered && btn && sent && back,
          d: 'topic sheet lists ' + EXTRA.topics.length + ' topics: ' + open + ', picking ' + t.en + ' filters the deck: ' + filtered + ', button shows it: ' + btn +
            ', sentences follow the topic: ' + sent + ', “All topics” restores the deck: ' + back };
      })();
      add('Topics', topicRes.ok, topicRes.d);

      var dailyRes = (function () {
        var w1 = wordOfDay('2026-01-01'), w2 = wordOfDay('2026-01-01');
        var wotd = !!w1 && w1 === w2 && state.status[w1.zh] !== 'known';
        state.wotdSeen = ''; renderWotd();
        var shown = !els.wotd.hidden && els.wotdZh.textContent === wordOfDay().zh;
        els.btnWotdClose.click();
        var hides = els.wotd.hidden && state.wotdSeen === dayKey();
        state.quests = null;
        var qs = todaysQuests();
        var three = qs.list.length === 3 && qs.list[0].id === 'goal' && new Set(qs.list.map(function (q) { return q.id; })).size === 3;
        var fz = state.freezes;
        qs.list.forEach(function (q) { q.n = q.goal - 1; });
        var c0 = wordCards[0];
        var saveP = state.practice, saveSkill = state.skill, saveMode = state.mode, saveTopic = state.topic;
        state.mode = 'due'; state.topic = (EXTRA.topics[0] || {}).id || 'all';
        combo = 50;
        // One answer per skill, so a listening quest and a recall quest can both finish.
        state.skill = 'listen';
        questEvent('known', Object.assign({ sentence: true }, c0), null);
        state.skill = 'recall';
        questEvent('known', Object.assign({ sentence: true }, c0), null);
        state.mode = saveMode; state.skill = saveSkill; state.topic = saveTopic; combo = 0;
        var rewarded = qs.rewarded && qs.list.every(function (q) { return q.n >= q.goal; }) && state.freezes === Math.min(MAX_FREEZES, fz + 1);
        var actSnap = state.activity, frozenSnap = state.frozen;
        state.activity = {}; state.frozen = [];
        state.activity[addDays(-2)] = { k: 5, l: 0 };
        state.activity[addDays(-3)] = { k: 5, l: 0 };
        state.freezes = 1;
        var used = applyFreezes() === 1 && state.frozen.indexOf(addDays(-1)) !== -1 && streak() === 3 && state.freezes === 0;
        var noFreeze = applyFreezes() === 0;
        var mon = weekStart(new Date(addDays(0) + 'T12:00:00'));
        state.activity[mon] = { k: 8, l: 2 };
        var rc = weekRecap(mon);
        var recap = !!rc && rc.cards >= 10 && rc.accuracy <= 100 && weekRecap('2001-01-01') === null;
        state.activity = actSnap; state.frozen = frozenSnap;
        return { ok: wotd && shown && hides && three && rewarded && used && noFreeze && recap,
          d: 'word of the day is stable and unknown: ' + wotd + ', banner shows it: ' + shown + ', ✕ hides it for today: ' + hides +
            ', three quests with the daily goal: ' + three + ', finishing all gives a freeze: ' + rewarded + ', a freeze covers a missed day: ' + used +
            ', nothing to cover twice: ' + noFreeze + ', weekly recap counts the week: ' + recap };
      })();
      add('Word of the day, daily quests, streak freeze, weekly recap', dailyRes.ok, dailyRes.d);

      var ladderRes = (function () {
        if (!EXTRA.ladder.length) return { ok: true, d: 'no ladder data in this build' };
        var r0 = EXTRA.ladder[0], r1 = EXTRA.ladder[1], last = EXTRA.ladder[EXTRA.ladder.length - 1];
        stashSkill();
        var keepMarks = JSON.parse(JSON.stringify(state.marks)), keepSkill = state.skill;
        state.rungs = {};
        state.ladderSeen = '';
        state.marks.read = emptyMarks();
        state.marks.listen = emptyMarks();
        loadSkill();
        var first = nextRung() === r0;
        els.newsStrip.hidden = true;
        state.wotdSeen = dayKey();
        renderWotd();
        var strip = !els.ladderStrip.hidden && els.ladderZh.textContent === r0.zh && els.ladderLeft.textContent === r0.words.length + ' words to go';
        r0.words.forEach(function (w) { state.marks.read.status[w] = 'known'; });
        loadSkill();
        var readOnly = checkRungs().length === 0;
        els.btnLadderGo.click();
        var practise = state.skill === 'listen' && state.deckType === 'words' && state.deck.length === r0.words.length &&
          state.deck.every(function (i) { return r0.words.indexOf(cards[i].zh) !== -1; });
        var xp0 = state.xp;
        r0.words.forEach(function (w) { state.marks.listen.status[w] = 'known'; });
        loadSkill();
        var fresh = checkRungs();
        var reached = fresh.length === 1 && state.rungs[r0.id] === dayKey() && state.xp === xp0 + LADDER_XP && checkRungs().length === 0;
        renderLadderStrip();
        var moved = nextRung() === r1 && els.ladderZh.textContent === r1.zh && progressSnapshot().rungs[r0.id] === dayKey();
        openProgress('ladder');
        var tab = els.pvBody.querySelector('[data-pvtab="ladder"]');
        var drawn = !!tab && tab.getAttribute('aria-pressed') === 'true' && els.pvBody.querySelectorAll('.rung').length === EXTRA.ladder.length &&
          els.pvBody.querySelectorAll('.rung.on').length === 1 && els.pvBody.querySelectorAll('.rung.next').length === 1 && !!els.pvBody.querySelector('.rung.next [data-study]');
        var lastRead = rungProgress(last).miss.filter(function (m) { return !m.read; }).length;
        var go = els.pvBody.querySelector('[data-rung="' + last.id + '"]');
        if (go) go.click();
        var anyOrder = !!go && els.progressView.hidden && state.skill === 'read' && state.deck.length === lastRead;
        els.btnLadderClose.click();
        var hid = els.ladderStrip.hidden && state.ladderSeen === dayKey();
        // Later checks expect the marks they started with.
        state.marks = keepMarks;
        state.skill = keepSkill;
        loadSkill();
        return { ok: first && strip && readOnly && practise && reached && moved && drawn && anyOrder && hid,
          d: EXTRA.ladder.length + ' steps; first step is next: ' + first + ', strip shows it: ' + strip + ', reading alone does not reach it: ' + readOnly +
            ', Practise opens its words in listening: ' + practise + ', reached once with ' + LADDER_XP + ' XP: ' + reached + ', next step moves on and is saved: ' + moved +
            ', Ladder tab draws every step: ' + drawn + ', a later step can be practised: ' + anyOrder + ', ✕ hides the strip for today: ' + hid };
      })();
      add('Can-do ladder: next step strip, Practise, reaching a step, Ladder tab', ladderRes.ok, ladderRes.d);

      var gameRes = (function () {
        state.seals = {};
        state.marks.read.status[wordCards[0].zh] = 'known';
        stashSkill();
        var fresh = checkSeals();
        var first = !!state.seals.first && fresh.some(function (x) { return x.id === 'first'; }) && !state.seals.k100;
        var again = checkSeals().length === 0;
        delete state.marks.read.status[wordCards[0].zh];
        startQuiz('blitz', '1');
        var bopen = !els.quizView.hidden && els.quizBody.querySelectorAll('.qz-choices .choice').length === 4;
        for (var i = 0; i < 20; i++) els.quizBody.querySelector('.qz-choices [data-ok="1"]').click();
        var scored = quiz.right === 20;
        finishQuiz();
        var best = state.blitzBest['1'] === 20 && !!state.seals.blitz;
        startQuiz('exam', '1');
        var types = {};
        quiz.list.forEach(function (q) { types[q.type] = (types[q.type] || 0) + 1; });
        var mixed = quiz.list.length === EXAM_SIZE && types.meaning >= 8 && (types.gap || 0) >= 1;
        for (var j = 0; j < EXAM_SIZE; j++) {
          var b = els.quizBody.querySelector('.qz-choices [data-ok="' + (j < 3 ? '0' : '1') + '"]');
          if (b) b.click();
        }
        var passed = quiz.done && state.exams['1'] === 85 && !!state.seals.exam && !!els.quizBody.querySelector('.qz-result.pass');
        key('3');
        closeOverlay(els.quizView);
        openProgress();
        var drawn = els.pvBody.querySelectorAll('.seal-item').length === SEALS.length && els.pvBody.querySelectorAll('.ch-btn').length === 4;
        closeOverlay(els.progressView);
        return { ok: first && again && bopen && scored && best && mixed && passed && drawn,
          d: 'first seal awarded once: ' + (first && again) + ', blitz shows 4 choices: ' + bopen + ', 20 right scored: ' + scored + ', best and seal kept: ' + best +
            ', exam mixes ' + JSON.stringify(types) + ': ' + mixed + ', 17 of 20 passes at 85%: ' + passed + ', seals and challenges drawn: ' + drawn };
      })();
      add('Seals, blitz and level exams', gameRes.ok, gameRes.d);

      var hintRes = (function () {
        var keys = Object.keys(EXTRA.hints);
        if (!keys.length) return { ok: true, d: 'no hint data in this build' };
        var wi = -1;
        wordCards.forEach(function (w, i) { if (wi === -1 && hintsFor(w).length) wi = i; });
        var deckSnap = state.deck, posSnap = state.pos;
        state.deck = [wi]; state.pos = 0; state.revealed = true; render(false);
        var shown = !els.cardHints.hidden && els.cardHints.querySelectorAll('.hint-row').length === hintsFor(wordCards[wi]).length;
        var valid = keys.every(function (k) { var h = EXTRA.hints[k]; return charLen(k) === 1 && /^(picture|idea|parts)$/.test(h.kind) && h.parts && h.en && h.hu; });
        useDeckType('sentences'); state.deck = [0]; state.pos = 0; render(false);
        var none = els.cardHints.hidden;
        useDeckType('words');
        state.deck = deckSnap; state.pos = posSnap; state.revealed = false; render(false);
        return { ok: shown && valid && none, d: keys.length + ' hints, all well-formed: ' + valid + ', shown on ' + wordCards[wi].zh + ': ' + shown + ', not on sentence cards: ' + none };
      })();
      add('Character hints', hintRes.ok, hintRes.d);

      var petRes = (function () {
        var stages = petStage(0) === 0 && petStage(99) === 0 && petStage(100) === 1 && petStage(5000) === PET_STAGES.length - 1;
        var actSnap = state.activity;
        state.activity = {};
        var hungry = petMood(12) === 'hungry' || petMood(12) === 'missed';
        state.activity[dayKey()] = { k: 1, l: 0 };
        var eating = petMood(12) === 'eating';
        state.activity[dayKey()] = { k: state.goal, l: 0 };
        var full = petMood(12) === 'full';
        state.activity = actSnap;
        var mini = !!els.petMini.querySelector('svg.panda');
        var art = pandaSvg(4, 'full', true);
        var accessories = art.indexOf('#5aa469') !== -1 && art.indexOf('M34 26') !== -1 && pandaSvg(0, 'sleepy', true).indexOf('class="zz"') !== -1;
        els.btnPet.click();
        var open = !els.petView.hidden && !!els.petBig.querySelector('svg.panda') && els.petFedText.textContent.indexOf('/') !== -1;
        els.petNameInput.value = 'Momo';
        els.petRename.dispatchEvent(new Event('submit', { cancelable: true }));
        var named = state.petName === 'Momo' && els.petName.textContent === 'Momo';
        els.petBig.click();
        closeOverlay(els.petView);
        var bar = els.btnKnown.querySelector('.act-seal').textContent === '会' && els.btnLearning.querySelector('.act-seal').textContent === '学';
        return { ok: stages && hungry && eating && full && mini && accessories && open && named && bar,
          d: 'growth stages: ' + stages + ', moods hungry/eating/full: ' + (hungry && eating && full) + ', mini panda drawn: ' + mini +
            ', scarf/bamboo/cap and sleepy z: ' + accessories + ', sheet opens: ' + open + ', rename works: ' + named + ', seal buttons: ' + bar };
      })();
      add('Panda and answer bar', petRes.ok, petRes.d);

      var typeRes = (function () {
        var byZh = function (z) { return wordCards.filter(function (w) { return w.zh === z; })[0]; };
        var cases = [['学生', 'xue2sheng', true], ['学生', 'Xué sheng', true], ['学生', 'xue2 sheng5', true], ['学生', 'xue2sheng0', true],
          ['学生', 'xue1sheng', false], ['学生', 'xuesheng', false], ['学生', 'xue2shen', false], ['一定', 'yi1ding4', true], ['一定', 'yi2ding4', true],
          ['一定', 'yi3ding4', false], ['不客气', 'bu4 ke4 qi', true], ['不客气', 'bú kèqi', true], ['女儿', 'nv3er2', true], ["女儿", "nü3'ér", true], ['女儿', 'nv3er4', false]];
        var bad = cases.filter(function (x) { var w = byZh(x[0]); return !w || typedMatches(x[1], w) !== x[2]; });
        var deckSnap = state.deck, posSnap = state.pos, wi = wordCards.indexOf(byZh('学生'));
        state.practice = 'reverse';
        state.deck = [wi]; state.pos = 0; state.revealed = false; render(false);
        var form = els.cardPrompt.querySelector('.type-form');
        var input = form && form.querySelector('input');
        if (input) { input.value = 'xue1sheng'; form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }
        var wrongShown = !!els.cardPrompt.querySelector('.type-result.wrong') && !state.status['学生'];
        input.value = 'xue2sheng';
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        var graded = answeredRight('学生');
        delete state.status['学生']; delete state.srs['学生'];
        state.practice = 'zh';
        state.deck = deckSnap; state.pos = posSnap; render(false);
        return { ok: !bad.length && !!form && wrongShown && graded,
          d: (bad.length ? 'wrong verdicts: ' + bad.map(function (x) { return x[0] + ' ' + x[1]; }).join(', ') : cases.length + ' spellings judged right') +
            ', wrong answer shows the word without marking: ' + wrongShown + ', right answer marks Known: ' + graded };
      })();
      add('Typing the pinyin', typeRes.ok, typeRes.d);

      var simRes = (function () {
        var mai = getLexicon().map['买'], sell = getLexicon().map['卖'];
        var pair = !!mai && similarOf(mai).indexOf(sell) !== -1 && similarOf(getLexicon().map['他']).length >= 2;
        els.optPractice.value = 'pairs';
        els.optPractice.dispatchEvent(new Event('change'));
        var deckOk = state.deck.length > 50 && state.deck.length < wordCards.length && state.deck.every(function (i) { return similarOf(cards[i]).length > 0; });
        var mi = wordCards.indexOf(mai);
        state.pos = state.deck.indexOf(mi); state.revealed = false; render(false);
        var chips = els.choiceBox.querySelectorAll('.choice');
        var shown = els.card.classList.contains('hide-face') && els.cardPrompt.textContent.indexOf(shortText(mai.en)) !== -1 && chips.length >= 2 &&
          !els.choiceBox.querySelector('.choice-pyl') && Array.prototype.some.call(chips, function (b) { return b.textContent.indexOf('卖') !== -1; });
        els.choiceBox.querySelector('[data-ok="1"]').click();
        var graded = answeredRight('买');
        delete state.status['买']; delete state.srs['买'];
        useDeckType('sentences');
        var fallback = state.practice === 'choice';
        useDeckType('words');
        state.practice = 'pairs'; setMode('all');
        els.optPractice.value = 'zh';
        els.optPractice.dispatchEvent(new Event('change'));
        var back = state.deck.length === wordCards.length;
        return { ok: pair && deckOk && shown && graded && fallback && back,
          d: '买 / 卖 and 他 / 她 / 它 found: ' + pair + ', deck holds only words with a twin (' + state.deck.length + ' after leaving): ' + deckOk +
            ', meaning shown with character-only chips: ' + shown + ', right answer marks Known: ' + graded + ', sentences fall back: ' + fallback + ', full deck after leaving: ' + back };
      })();
      add('Similar words', simRes.ok, simRes.d);

      var newsRes = (function () {
        if (!EXTRA.news.length) return { ok: true, d: 'no changelog in this build' };
        var latest = latestNews();
        state.newsSeen = '';
        renderNewsStrip();
        var notice = !els.newsStrip.hidden && els.newsStripText.textContent.indexOf(latest.version) !== -1;
        els.btnNewsSee.click();
        var sheet = !els.newsView.hidden && els.newsBody.querySelectorAll('.news-release').length === EXTRA.news.length &&
          els.newsBody.querySelector('.news-release.latest .news-ver').textContent === latest.version;
        var seen = state.newsSeen === latest.version && els.newsStrip.hidden;
        closeOverlay(els.newsView);
        els.btnNews.click();
        var fromSettings = !els.newsView.hidden;
        closeOverlay(els.newsView);
        updateFootnote();
        var foot = els.footnote.querySelector('[data-news]');
        if (foot) foot.click();
        var fromFooter = !!foot && !els.newsView.hidden && foot.textContent.indexOf(latest.version) !== -1;
        closeOverlay(els.newsView);
        fromSettings = fromSettings && fromFooter;
        var wellFormed = EXTRA.news.every(function (r) { return r.version && r.title && r.groups.length && r.groups.every(function (g) { return g.items.length; }); });
        return { ok: notice && sheet && seen && fromSettings && wellFormed,
          d: 'notice for ' + latest.version + ': ' + notice + ', sheet lists ' + EXTRA.news.length + ' releases: ' + sheet + ', opening marks it seen: ' + seen +
            ', Settings and the footer open it: ' + fromSettings + ', entries well-formed: ' + wellFormed };
      })();
      add('What\'s new', newsRes.ok, newsRes.d);

      var labRes = (function () {
        var keep = state.labels, mz = els.modeDue.querySelector('.lbl .zl'), me = els.modeDue.querySelector('.lbl .el');
        var hidden = function (n) { return getComputedStyle(n).display === 'none' || getComputedStyle(n).position === 'absolute'; };
        state.labels = 'both'; applyLabelMode();
        var both = !!mz && mz.textContent === '复习' && !hidden(mz) && !hidden(me) && els.optPractice.options[0].textContent.indexOf('认字 · ') === 0;
        state.labels = 'zh'; applyLabelMode();
        var zhOnly = !hidden(mz) && hidden(me) && els.modeDue.textContent.indexOf('Due') !== -1 && els.optPractice.options[0].textContent === '认字';
        state.labels = 'en'; applyLabelMode();
        var en = hidden(mz) && !hidden(me) && els.optPractice.options[0].textContent === els.optPractice.options[0].getAttribute('data-en');
        var table = Object.keys(ZH_LABELS).every(function (k) { return /[\u4e00-\u9fff]/.test(ZH_LABELS[k][0]) && /[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/.test(ZH_LABELS[k][1]); });
        var marked = document.querySelectorAll('[data-lbl] .lbl').length >= 19;
        state.labels = keep; applyLabelMode();
        return { ok: both && zhOnly && en && table && marked,
          d: '中文 + English shows both: ' + both + ', 中文 only keeps the English for screen readers: ' + zhOnly + ', English hides the Chinese: ' + en +
            ', every label has Chinese and pinyin: ' + table + ', page labels upgraded: ' + marked };
      })();
      add('Chinese interface labels', labRes.ok, labRes.d);

      var tapRes = (function () {
        var small = ['btnShuffle', 'btnUndo', 'btnPet', 'todayPill', 'btnWotdClose'].filter(function (id) {
          var r = els[id].getBoundingClientRect();
          return r.width && (r.width < 44 || r.height < 44);
        });
        return { ok: !small.length, d: small.length ? 'under 44 px: ' + small.join(', ') : 'shuffle, undo, panda, today and the word-of-the-day close button are at least 44 px' };
      })();
      add('Tap targets of 44 px', tapRes.ok, tapRes.d);

      var tabRes = (function () {
        var vis = function (sel) { var n = els.pvBody.querySelector(sel); return !!n && !n.closest('[data-pane]').hidden; };
        openProgress('collection');
        var coll = vis('.seal-grid') && !vis('.q-list');
        els.pvBody.querySelector('[data-pvtab="today"]').click();
        var today = vis('.q-list') && vis('.pv-fc') && !vis('.seal-grid') && els.pvBody.querySelector('[data-pvtab="today"]').getAttribute('aria-pressed') === 'true';
        els.pvBody.querySelector('[data-pvtab="progress"]').click();
        var prog = vis('.rp-num') && vis('.pv-hero');
        closeOverlay(els.progressView);
        return { ok: coll && today && prog, d: 'Collection shows seals: ' + coll + ', Today shows quests and the forecast: ' + today + ', Progress shows reading power: ' + prog };
      })();
      add('Progress view tabs', tabRes.ok, tabRes.d);

      var newer = parseImport(JSON.stringify({ version: 1, format: FORMAT + 1, status: {} }));
      var current = parseImport(JSON.stringify({ version: 1, format: FORMAT, status: {} }));
      var tapRes2 = (function () {
        var deckSnap = state.deck.slice(), posSnap = state.pos;
        state.practice = 'zh'; state.deck = [0]; state.pos = 0; state.revealed = false; render(false);
        els.cardHanzi.click();
        var opens = state.revealed === true;
        els.cardEn.click();
        var stays = state.revealed === true;
        els.cardHanzi.click();
        var closes = state.revealed === false;
        state.deck = deckSnap; state.pos = posSnap; render(false);
        return { ok: opens && stays && closes, d: 'tap shows the answer: ' + opens + ', a tap on the meanings keeps it open: ' + stays + ', a tap on the characters hides it: ' + closes };
      })();
      add('Tapping the answer keeps it open', tapRes2.ok, tapRes2.d);

      var gradRes = (function () {
        var deckSnap = state.deck.slice(), posSnap = state.pos, a = cards[0], b = cards[1];
        state.practice = 'zh';
        var keep = [a, b].map(function (c) { return [state.status[c.zh], state.srs[c.zh]]; });
        delete state.status[a.zh]; delete state.srs[a.zh];
        state.deck = [0, 1]; state.pos = 0; state.revealed = false; render(false);
        key('ArrowRight');
        var fresh = state.status[a.zh] === 'learning' && state.srs[a.zh].b === 1;
        nearlyKnown(b.zh); delete state.status[b.zh];
        key('ArrowRight');
        var graduates = state.status[b.zh] === 'known' && SRS_DAYS[state.srs[b.zh].b] >= 7;
        [a, b].forEach(function (c, i) {
          if (keep[i][0]) state.status[c.zh] = keep[i][0]; else delete state.status[c.zh];
          if (keep[i][1]) state.srs[c.zh] = keep[i][1]; else delete state.srs[c.zh];
        });
        state.deck = deckSnap; state.pos = posSnap; render(false);
        return { ok: fresh && graduates, d: 'a new card answered right stays Learning (next review tomorrow): ' + fresh + ', a card whose next review is a week away becomes Known: ' + graduates };
      })();
      add('Cards become Known once their next review is a week away', gradRes.ok, gradRes.d);

      var marksRes = (function () {
        var deckSnap = state.deck.slice(), posSnap = state.pos, w = cards[0];
        var keepL = state.marks.listen.status[w.zh];
        stashSkill();
        state.marks.listen.status[w.zh] = 'learning';
        state.deck = [0]; state.pos = 0; render(false);
        var seals = els.cardSkills.querySelectorAll('.sm');
        var three = seals.length === 3 && seals[2].classList.contains('sm-learning') && els.cardSkills.querySelector('.sm.active') === seals[0] &&
          /Listening: Learning/.test(els.cardSkills.firstChild.getAttribute('aria-label'));
        openList();
        var inList = els.wordList.querySelectorAll('.skill-marks').length > 0;
        closeOverlay(els.listView);
        if (keepL) state.marks.listen.status[w.zh] = keepL; else delete state.marks.listen.status[w.zh];
        state.deck = deckSnap; state.pos = posSnap; render(false);
        var panda = !!els.btnPet.closest('.topbar');
        return { ok: three && inList && panda, d: 'card shows 读 说 听 with listening Learning and reading ringed: ' + three + ', word list shows them: ' + inList + ', panda in the top bar: ' + panda };
      })();
      add('Marks for all three skills; panda in the top bar', marksRes.ok, marksRes.d);

      var langRes = (function () {
        var keep = JSON.parse(JSON.stringify(state.langs)), deckSnap = state.deck.slice(), posSnap = state.pos;
        var extra = EXTRA_LANGS.filter(function (k) { return LANG_AVAILABLE[k]; });
        state.practice = 'zh'; state.deck = [0]; state.pos = 0; state.revealed = true;
        var c = cards[0];
        // English off, Hungarian on (and the first extra language, if this build has one)
        state.langs = { en: false, hu: true, de: false, es: false, ro: false };
        if (extra[0]) state.langs[extra[0]] = true;
        render(false);
        var enHidden = els.cardEn.parentNode.hidden && !els.cardHu.parentNode.hidden;
        var extraShown = !extra[0] || els.cardMeanMore.textContent.indexOf(mean(c, extra[0])) !== -1;
        var exLines = els.cardExamples.querySelector('.ex').querySelectorAll('.ex-line').length === (extra[0] ? 2 : 1);
        state.practice = 'choice'; render(false);
        var chipMain = els.choiceBox.querySelector('.choice-en').getAttribute('lang') === 'hu';
        state.practice = 'zh';
        // the last language cannot be switched off
        state.langs = { en: true, hu: false, de: false, es: false, ro: false };
        syncSettingsUI();
        els.optLangEn.checked = false;
        els.optLangEn.dispatchEvent(new Event('change'));
        var lastStays = state.langs.en === true && els.optLangEn.checked === true;
        var hiddenUnavailable = EXTRA_LANGS.every(function (k) { return els['optLang' + k.charAt(0).toUpperCase() + k.slice(1)].closest('label').hidden === !LANG_AVAILABLE[k]; });
        state.langs = keep; syncSettingsUI();
        state.deck = deckSnap; state.pos = posSnap; state.revealed = false; render(false);
        return { ok: enHidden && extraShown && exLines && chipMain && lastStays && hiddenUnavailable,
          d: 'English off hides it: ' + enHidden + ', extra language (' + (extra[0] || 'none in this build') + ') shown: ' + extraShown + ', examples follow: ' + exLines +
            ', choices use the first language on: ' + chipMain + ', the last one stays on: ' + lastStays + ', switches only for languages with data: ' + hiddenUnavailable };
      })();
      add('Meaning languages on and off', langRes.ok, langRes.d);

      var undoRes = (function () {
        var deckSnap = state.deck.slice(), posSnap = state.pos;
        state.practice = 'zh'; state.deck = [0, 1, 2]; state.pos = 0; render(false);
        var w = cards[0], had = state.status[w.zh];
        key('ArrowRight');
        var answered = state.pos === 1 && answeredRight(w.zh);
        key('z');
        var plain = state.pos === 0 && state.status[w.zh] === had;
        key('ArrowRight');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
        var ctrl = state.pos === 0 && state.status[w.zh] === had;
        var box = document.createElement('input');
        document.body.appendChild(box);
        key('ArrowRight');
        box.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true, cancelable: true }));
        var fieldKept = state.pos === 1;
        box.parentNode.removeChild(box);
        key('z');
        if (had) state.status[w.zh] = had; else delete state.status[w.zh];
        delete state.srs[w.zh];
        state.deck = deckSnap; state.pos = posSnap; render(false);
        return { ok: answered && plain && ctrl && fieldKept, d: 'Z undoes: ' + plain + ', Ctrl+Z undoes: ' + ctrl + ', typing z in a text field does not: ' + fieldKept };
      })();
      add('Undo shortcut', undoRes.ok, undoRes.d);

      var syncTopRes = (function () {
        var s0 = { session: sync.session, dirty: sync.dirty, busy: sync.busy };
        sync.session = null; renderSyncTop();
        var hiddenOut = els.btnSyncTop.hidden;
        sync.session = { access_token: 'x.e30.x', email: 'test@example.com' }; sync.dirty = true; sync.busy = false; renderSyncTop();
        var shown = !els.btnSyncTop.hidden && els.btnSyncTop.classList.contains('pending');
        sync.busy = true; renderSyncTop();
        var spins = els.btnSyncTop.classList.contains('busy') && !els.btnSyncTop.classList.contains('pending');
        sync.session = s0.session; sync.dirty = s0.dirty; sync.busy = s0.busy; renderSyncTop();
        var ok = hiddenOut && (syncEnabled() ? shown && spins : els.btnSyncTop.hidden);
        return { ok: ok, d: syncEnabled() ? 'hidden when signed out: ' + hiddenOut + ', shown with a dot for waiting changes: ' + shown + ', spins while syncing: ' + spins
          : 'sync is off in this build, so the top-bar button stays hidden: ' + els.btnSyncTop.hidden };
      })();
      add('Top-bar sync button', syncTopRes.ok, syncTopRes.d);

      var footRes = (function () {
        var sess = sync.session;
        sync.session = null; updateFootnote();
        var local = els.footnote.textContent.indexOf('synced to your account') === -1;
        sync.session = { access_token: 'x.e30.x', email: 'test@example.com' }; updateFootnote();
        var cloud = els.footnote.textContent.indexOf('synced to your account') !== -1;
        sync.session = sess; updateFootnote();
        return { ok: local && (syncEnabled() ? cloud : !cloud), d: 'signed out says this browser only: ' + local + ', signed in ' + (syncEnabled() ? 'mentions the account: ' + cloud : '(sync is off in this build) stays unchanged: ' + !cloud) };
      })();
      add('Footer says where progress is saved', footRes.ok, footRes.d);
      add('Progress from a newer app version is refused', !!newer.error && !current.error && progressSnapshot().format === FORMAT,
        'newer format refused: ' + !!newer.error + ', current format accepted: ' + !current.error + ', snapshots say format ' + FORMAT);
      var ver = document.querySelector('.app-version');
      add('Version shown in Settings', !!ver && /^Version \d{4}-\d\d-\d\d, build [0-9a-f]{10}$/.test(ver.textContent), ver ? ver.textContent : 'missing');

      add('Practice modes: meaning → Chinese, listening, multiple choice, characters only', rev && revShown && listen && choice && hanzi,
        'reverse hides the word: ' + rev + ', reveal shows it: ' + revShown + ', listening: ' + listen + ', multiple choice (4 options, right answer marks Known): ' + choice +
        ', characters only hides pinyin and audio until the reveal: ' + hanzi);

      var toneRes = (function () {
        var quiz = -1, skip = -1;
        wordCards.forEach(function (w, i) {
          if (quiz === -1 && toneQuizTarget(w)) quiz = i;
          if (skip === -1 && !toneQuizTarget(w)) skip = i;
        });
        if (quiz === -1 || skip === -1) return { ok: false, d: 'no word with a tone quiz (' + quiz + ') or without one (' + skip + ')' };
        var deckSnap = state.deck, posSnap = state.pos;
        var only = function (i) { state.deck = [i]; state.pos = 0; render(false); };
        state.practice = 'tone';
        only(quiz);
        var w = wordCards[quiz], t = toneQuizTarget(w);
        var chips = els.choiceBox.querySelectorAll('.choice');
        var right = -1;
        for (var ci = 0; ci < chips.length; ci++) if (chips[ci].getAttribute('data-ok') === '1') right = ci;
        var hiddenPy = getComputedStyle(els.cardPinyin).visibility === 'hidden' && getComputedStyle(head).display !== 'none' && !els.choiceBox.hidden;
        var marks = chips.length === 4 && right + 1 === t.tone && chips[right].textContent.indexOf(retone(t.text, right + 1)) !== -1;
        var plays = !!els.cardPrompt.querySelector('.listen-btn');
        if (right >= 0) chips[right].click();
        var graded = answeredRight(w.zh) && state.pos === 1;
        only(quiz);
        els.card.click();
        var reveals = getComputedStyle(els.cardPinyin).visibility === 'visible';
        els.card.click();
        only(skip);
        var skipped = els.choiceBox.hidden && els.choiceBox.children.length === 0 && getComputedStyle(els.cardPinyin).visibility === 'visible';
        state.deck = deckSnap; state.pos = posSnap;
        state.practice = 'zh'; render(false);
        return { ok: hiddenPy && marks && plays && graded && reveals && skipped,
          d: w.zh + ' ' + w.py + ': pinyin and tone colours hidden: ' + hiddenPy + ', four tone chips with tone ' + t.tone + ' marked right: ' + marks +
            ', play button: ' + plays + ', right answer marks Known: ' + graded + ', reveal shows the pinyin: ' + reveals +
            ' | ' + wordCards[skip].zh + ' ' + wordCards[skip].py + ' is shown as a normal card: ' + skipped };
      })();
      add('Tone quiz: hear the word, pick the tone of the first syllable', toneRes.ok, toneRes.d);

      var fadeRes = (function () {
        var deckSnap = state.deck, posSnap = state.pos, w = wordCards[0];
        var hides = function () { return els.card.classList.contains('hide-reading') && getComputedStyle(els.cardPinyin).visibility === 'hidden'; };
        state.deck = [0]; state.pos = 0; state.practice = 'zh'; state.revealed = false;
        state.fadePinyin = true;
        state.srs[w.zh] = { b: FADE_BOX, d: addDays(SRS_DAYS[FADE_BOX]) }; render(false);
        var mature = hides();
        state.srs[w.zh] = { b: FADE_BOX - 1, d: addDays(SRS_DAYS[FADE_BOX - 1]) }; render(false);
        var young = !hides();
        state.fadePinyin = false;
        state.srs[w.zh] = { b: FADE_BOX, d: addDays(SRS_DAYS[FADE_BOX]) }; render(false);
        var off = !hides();
        delete state.srs[w.zh];
        state.deck = deckSnap; state.pos = posSnap; render(false);
        return { ok: mature && young && off, d: 'well-known card hides its pinyin: ' + mature + ', newer card shows it: ' + young + ', setting off shows it: ' + off };
      })();
      add('Fading pinyin hides the reading of well-known cards (opt-in)', fadeRes.ok, fadeRes.d);

      var lookRes = (function () {
        var lossless = sentCards.every(function (sc) { return segment(sc.zh).map(function (g) { return g.text; }).join('') === sc.zh; });
        var wi = -1;
        for (var i = 0; i < wordCards.length && wi === -1; i++) {
          if (segment(wordCards[i].ex[0].zh).some(function (g) { return g.word && g.word.zh !== wordCards[i].zh; })) wi = i;
        }
        if (wi === -1) return { ok: false, d: 'no example sentence contains another known word' };
        var deckSnap = state.deck, posSnap = state.pos;
        state.deck = [wi]; state.pos = 0; state.revealed = true; render(false);
        var b = els.cardExamples.querySelector('.ex-zh button.w');
        var head = !!els.cardExamples.querySelector('.ex-zh .w-head');
        b.click();
        var target = getLexicon().map[b.getAttribute('data-w')];
        var opens = !els.wordPop.hidden && els.wordPopZh.textContent === target.zh && els.wordPopEn.textContent === target.en &&
          b.getAttribute('aria-expanded') === 'true';
        els.cardEn.click();
        var outside = els.wordPop.hidden && state.revealed === true;
        useDeckType('sentences');
        state.deck = [0]; state.pos = 0; state.revealed = false; render(false);
        var fb = els.cardHanzi.querySelector('button.w');
        var cellsKept = els.cardHanzi.querySelectorAll('.cell').length === Array.from(sentCards[0].zh).filter(isHan).length;
        if (fb) fb.click();
        var face = !!fb && !els.wordPop.hidden && state.revealed === false;
        key('Escape');
        var esc = els.wordPop.hidden;
        useDeckType('words');
        state.deck = deckSnap; state.pos = posSnap; render(false);
        return { ok: lossless && head && opens && outside && face && cellsKept && esc,
          d: 'segmentation keeps every sentence intact: ' + lossless + ', headword highlighted: ' + head + ', tapping ' + target.zh + ' shows it: ' + opens +
            ', a tap elsewhere closes it without flipping the card: ' + outside + ', sentence card words are tappable: ' + face +
            ', every character keeps its cell: ' + cellsKept + ', Esc closes it: ' + esc };
      })();
      add('Tap a word in a sentence to see its meaning', lookRes.ok, lookRes.d);

      var pick = function (v) { els.optPractice.value = v; els.optPractice.dispatchEvent(new Event('change')); };
      var skillRes = (function () {
        pick('zh');
        els.modeAll.click();
        var w = cards[currentIndex()], wi = cards.indexOf(w);
        nearlyKnown(w.zh);
        var goTo = function () { state.pos = state.deck.indexOf(wi); render(false); };
        els.btnKnown.click();
        var readKnown = statusOf(w) === 'known';
        pick('listen');
        var separate = state.skill === 'listen' && statusOf(w) === 'unmarked' && counts().known === 0;
        goTo();
        els.btnLearning.click();
        var listenMark = statusOf(w) === 'learning';
        pick('reverse');
        var recallEmpty = state.skill === 'recall' && statusOf(w) === 'unmarked';
        pick('zh');
        var back = state.skill === 'read' && statusOf(w) === 'known';
        var snapP = progressSnapshot();
        var saved = snapP.status[w.zh] === 'known' && snapP.skills.listen.status[w.zh] === 'learning' && !snapP.skills.recall.status[w.zh];
        restore(JSON.parse(JSON.stringify(snapP)));
        var round = state.skill === 'read' && state.marks.listen.status[w.zh] === 'learning' && statusOf(w) === 'known';
        render(false);
        return { ok: readKnown && separate && listenMark && recallEmpty && back && saved && round,
          d: w.zh + ' known in reading: ' + readKnown + ', unmarked in listening: ' + separate + ', listening keeps its own mark: ' + listenMark +
            ', recall untouched: ' + recallEmpty + ', reading unchanged after switching back: ' + back + ', saved per skill: ' + saved + ', restored per skill: ' + round };
      })();
      add('Reading, recall and listening keep separate progress', skillRes.ok, skillRes.d);

      var memRes = (function () {
        pick('zh');
        els.modeAll.click();
        state.pos = 3; render(false);
        pick('s-zh');
        var sentStart = state.deckType === 'sentences' && state.pos === 0;
        state.pos = 2; render(false);
        pick('zh');
        var wordsBack = state.deckType === 'words' && state.pos === 3 && state.deck.length === wordCards.length;
        var mem = progressSnapshot().deckMemory.sentences;
        pick('s-zh');
        var sentBack = state.deckType === 'sentences' && state.pos === 2;
        pick('zh');
        return { ok: sentStart && wordsBack && sentBack && !!mem && mem.pos === 2,
          d: 'sentences start fresh: ' + sentStart + ', words come back at card 4: ' + wordsBack + ', sentences come back at card 3: ' + sentBack +
            ', saved: ' + (!!mem && mem.pos === 2) };
      })();
      add('Words and sentences each keep their place', memRes.ok, memRes.d);

      var cpRes = (function () {
        var py = function () { return getComputedStyle(els.cardPinyin).visibility; };
        state.practice = 'choice'; state.revealed = false;
        state.choicePinyin = false; render(false);
        var hidden = py() === 'hidden' && !els.choiceBox.hidden;
        state.choicePinyin = true; render(false);
        var shown = py() === 'visible';
        state.practice = 'zh'; render(false);
        return { ok: hidden && shown, d: 'pinyin hidden when switched off: ' + hidden + ', shown by default: ' + shown };
      })();
      add('Multiple choice can hide the pinyin', cpRes.ok, cpRes.d);

      var wordCard = cards[currentIndex()];
      els.card.click();
      var practiceBtn = els.cardExamples.querySelector('.ex-practice');
      if (practiceBtn) practiceBtn.click();
      var mineSent = state.deckType === 'sentences' && state.deck.length === wordCard.ex.length &&
        state.deck.every(function (i) { return sentCards[i].ex.some(function (w) { return w.zh === wordCard.zh; }); });
      els.optPractice.value = 'zh';
      els.optPractice.dispatchEvent(new Event('change'));
      add('“Practice these sentences” opens that word’s sentences', !!practiceBtn && mineSent && state.deckType === 'words',
        wordCard.zh + ': ' + wordCard.ex.length + ' sentence(s), deck switched: ' + mineSent);

      els.btnHelp.click();
      var helpOk = !els.helpView.hidden && els.helpView.querySelectorAll('.help-sec').length >= 6;
      els.btnShowTour.click();
      var tourOpen = els.helpView.hidden && !els.tourView.hidden && els.tourTitle.textContent === TOUR[0].title;
      for (var ts = 1; ts < TOUR.length; ts++) els.btnTourNext.click();
      var lastStep = els.btnTourNext.textContent === 'Start learning' && els.tourTitle.textContent === TOUR[TOUR.length - 1].title;
      els.btnTourBack.click();
      var back = els.tourTitle.textContent === TOUR[TOUR.length - 2].title;
      els.btnTourSkip.click();
      var tourClosed = els.tourView.hidden && state.seenTour === true;
      add('Help sheet and quick tour', helpOk && tourOpen && lastStep && back && tourClosed,
        'help opens: ' + helpOk + ', tour opens from help: ' + tourOpen + ', steps through ' + TOUR.length + ' screens: ' + lastStep + ', back works: ' + back + ', skip closes: ' + tourClosed);

      var sentRes = (function () {
        state.status = {}; state.srs = {};
        els.optPractice.value = 's-zh';
        els.optPractice.dispatchEvent(new Event('change'));
        var switched = state.deckType === 'sentences' && cards === sentCards && state.deck.length === sentCards.length && els.card.classList.contains('sentence');
        var s0 = cards[currentIndex()];
        var shows = els.cardHanzi.textContent === s0.zh && els.cardPinyin.textContent === s0.py && els.cardExamples.textContent.indexOf(s0.ex[0].zh) !== -1;
        nearlyKnown(s0.zh);
        els.btnKnown.click();
        var marked = state.status[s0.zh] === 'known' && state.pos === 1 && els.knownCount.textContent === '1';
        els.optPractice.value = 'zh';
        els.optPractice.dispatchEvent(new Event('change'));
        var back = state.deckType === 'words' && cards === wordCards && !els.card.classList.contains('sentence');
        return { ok: switched && shows && marked && back, d: sentCards.length + ' sentence cards; switch: ' + switched + ', first sentence shown with its word: ' + shows + ', marking works: ' + marked + ', back to words: ' + back };
      })();
      add('Sentence mode', sentRes.ok, sentRes.d);

      var transferRes = (function () {
        state.status = {}; state.srs = {}; state.misses = {};
        els.modeAll.click();
        var a0 = cards[state.deck[0]], a1 = cards[state.deck[1]];
        nearlyKnown(a0.zh);
        els.btnKnown.click();
        els.btnLearning.click();
        els.btnExport.click();
        var code = els.transferText.value;
        var exported = !els.transferView.hidden && code.indexOf(APP_ID) !== -1 && code.indexOf('badVoices') === -1;
        els.btnCloseTransfer.click();
        state.status = {}; state.srs = {}; state.misses = {};
        els.btnImport.click();
        els.transferText.value = code;
        els.btnApplyImport.click();
        var asked = !els.confirmDialog.hidden;
        els.confirmOk.click();
        var imported = state.status[a0.zh] === 'known' && state.status[a1.zh] === 'learning' && !!state.srs[a0.zh] && state.misses[a1.zh] === 1 && els.transferView.hidden;
        els.btnImport.click();
        els.transferText.value = 'not a code';
        els.btnApplyImport.click();
        var rejected = els.confirmDialog.hidden && /not a progress code/i.test(els.transferStatus.textContent);
        els.btnCloseTransfer.click();
        return { ok: exported && asked && imported && rejected, d: 'export: ' + exported + ', asks before replacing: ' + asked + ', import restores marks and schedule: ' + imported + ', rejects a bad code: ' + rejected };
      })();
      add('Export and import progress', transferRes.ok, transferRes.d);

      var a11yRes = (function () {
        var roles = els.card.getAttribute('role') === 'group' && els.revealHint.tagName === 'BUTTON';
        els.revealHint.click();
        var open = els.revealHint.getAttribute('aria-expanded') === 'true' && state.revealed;
        els.revealHint.click();
        var shut = els.revealHint.getAttribute('aria-expanded') === 'false' && !state.revealed;
        pointerFocus = null;
        els.modeAll.focus();
        els.modeAll.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        var arrows = state.mode === 'due' && els.modeDue.tabIndex === 0 && els.modeAll.tabIndex === -1;
        els.modeDue.blur();
        els.modeAll.click();
        els.btnHelp.click();
        var locked = els.app.inert === true;
        els.btnCloseHelp.click();
        locked = locked && els.app.inert === false;
        var unnamed = Array.prototype.filter.call(document.querySelectorAll('button, select, input, textarea'), function (n) { return !accessibleName(n); })
          .map(function (n) { return n.id || n.className; });
        var pinyinLang = els.cardPinyin.getAttribute('lang') === 'zh-Latn-pinyin';
        return { ok: roles && open && shut && arrows && locked && !unnamed.length && pinyinLang,
          d: 'card is a group with a show/hide button: ' + roles + ', button reports open/closed: ' + (open && shut) + ', arrow keys move through the mode buttons: ' + arrows +
             ', page behind a panel is locked: ' + locked + ', controls without a name: ' + (unnamed.length ? unnamed.join(', ') : 'none') + ', pinyin marked as pinyin: ' + pinyinLang };
      })();
      add('Accessibility basics', a11yRes.ok, a11yRes.d);

      add('Progress overview renders', pvOk && els.progressView.hidden, 'Ring, ' + lvRows + ' level bars, 14-day chart and ' + cells + ' word squares (' + known2 + ' known).');

      els.btnList.click();
      var listOpen = !els.listView.hidden && els.wordList.querySelectorAll('.word-row').length === cards.length;
      els.searchInput.value = c5.py;
      els.searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      var c5Index = cards.indexOf(c5);
      var rowSelector = '.word-row[data-index="' + c5Index + '"]';
      var found = !!els.wordList.querySelector(rowSelector) && els.wordList.querySelectorAll('.word-row').length < cards.length;
      els.searchInput.value = 'ni hao';
      els.searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      var toneless = !!els.wordList.querySelector('.word-row') && els.wordList.textContent.indexOf('你好') !== -1;
      els.searchInput.value = c5.py;
      els.searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      var row = els.wordList.querySelector(rowSelector);
      if (row) row.click();
      var jumped = els.listView.hidden && currentIndex() === cards.indexOf(c5) && els.cardHanzi.textContent === c5.zh;
      add('Word list opens, search works, selecting a word studies it', listOpen && found && toneless && jumped,
        'List shows all ' + cards.length + ' words: ' + listOpen + '; search “' + c5.py + '” finds ' + c5.zh + ': ' + found +
        '; tone-free search “ni hao” finds 你好: ' + toneless + '; tapping it opens the card: ' + jumped);

      var captured = [];
      if (speechSupported) {
        var origSpeak = synth.speak;
        synth.speak = function (u) { captured.push({ text: u.text, lang: u.lang }); };
        var exBtn = null;
        var revealedBefore = state.revealed;
        try {
          els.btnSpeak.click();
          stopSpeech();
          exBtn = els.cardExamples.querySelector('.ex-speak[data-ex="0"]');
          if (exBtn) exBtn.click();
        } finally { stopSpeech(); synth.speak = origSpeak; }
        var exOk = !!exBtn && captured.length >= 2 && captured[1].text === c5.ex[0].zh && captured[1].lang === 'zh-CN' && state.revealed === revealedBefore;
        add('Sentence 🔊 buttons speak just that sentence', exOk, exBtn ? 'Sentence button sent “' + (captured[1] ? captured[1].text : '—') + '” and did not flip the card.' : 'No sentence button found.');
        add('“Read aloud” speaks the word in zh-CN', captured.length >= 1 && captured[0].text === c5.zh && captured[0].lang === 'zh-CN',
          captured.length ? 'First utterance: “' + captured[0].text + '” (' + captured[0].lang + '); example sentences follow after a pause.' : 'Nothing was sent to the speech engine.');
      } else {
        testing = false;
        els.btnSpeak.click();
        var msgShown = !els.toast.hidden && /not available/i.test(els.toast.textContent);
        testing = true;
        add('“Read aloud” shows a message when speech is unsupported', msgShown);
      }

      var knownBeforeReset = counts().known;
      els.btnReset.click();
      var dialogShown = !els.confirmDialog.hidden;
      els.confirmCancel.click();
      var cancelled = els.confirmDialog.hidden && counts().known === knownBeforeReset && knownBeforeReset > 0;
      els.btnReset.click();
      els.confirmOk.click();
      var c = counts();
      add('“Reset” asks for confirmation and clears progress', dialogShown && cancelled && c.known === 0 && c.learning === 0 && els.confirmDialog.hidden,
        'Dialog shown: ' + dialogShown + ', cancel keeps progress: ' + cancelled + ', confirm clears: ' + (c.known === 0 && c.learning === 0));
    } catch (err) {
      add('Interactive control test', false, 'The test stopped with an error: ' + (err && err.message ? err.message : err));
    } finally {
      OVERLAYS.forEach(function (id) { closeOverlay(els[id]); });
      confirmCallback = null;
      useDeckType(snap.deckType);
      state.seenTour = snap.seenTour;
      state.activity = snap.activity;
      state.milestones = snap.milestones;
      els.searchInput.value = searchSnap;
      listFilter = filterSnap;
      state.status = snap.status;
      state.mode = snap.mode;
      state.level = snap.level;
      state.srs = snap.srs;
      state.misses = snap.misses;
      state.practice = snap.practice;
      state.toneColors = snap.toneColors;
      state.fadePinyin = snap.fadePinyin;
      state.newsSeen = snap.newsSeen; closeOverlay(els.newsView); renderNewsStrip();
      state.petName = snap.petName; closeOverlay(els.petView); renderPet();
      state.seals = snap.seals; state.questDays = snap.questDays; state.blitzBest = snap.blitzBest; state.exams = snap.exams; stopQuiz(); quiz = null;
      state.quests = snap.quests; state.freezes = snap.freezes; state.frozen = snap.frozen; state.wotdSeen = snap.wotdSeen; state.rungs = snap.rungs; state.ladderSeen = snap.ladderSeen; renderWotd();
      state.topic = snap.topic; state.xp = snap.xp; state.bestCombo = snap.bestCombo; state.learned = snap.learned;
      combo = 0; renderCombo(); updateTopicBtn();
      state.marks = marksSnap;
      state.skill = skillSnap;
      loadSkill();
      state.deckMemory = deckMemSnap;
      state.choicePinyin = choicePySnap;
      closeWordPop(false);
      state.deck = snap.deck;
      state.pos = snap.pos;
      state.shuffled = snap.shuffled;
      state.autoReveal = snap.autoReveal;
      state.revealed = snap.revealed;
      undoStack = undoSnap;
      syncPracticeSelect();
      testing = false;
      render(false);
      save();
      els.tourView.hidden = !tourWasOpen;
      els.diagView.hidden = !diagWasOpen;
      syncOverlayState();
    }
  }

