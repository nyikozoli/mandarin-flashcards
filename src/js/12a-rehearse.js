  /* ---------- rehearse: known languages practised with Chinese ---------- */
  // A rehearsed language is a skill ('say:ro', see rebuildSkills) with a practice style 'rh-ro': the card shows the Chinese
  // word and asks for it in that language. Only words already started in Chinese are rehearsed.
  // The rehearse card shown in place inside a word deck ({ zh, code }); null otherwise (see maybeInterject).
  var rehearseCard = null;
  function isRehearseStyle(p) { return typeof p === 'string' && p.indexOf('rh-') === 0; }
  function rehearseCode(p) { return isRehearseStyle(p) ? p.slice(3) : ''; }
  // The style the card on screen is answered in: the interjected rehearse card's, or the chosen one.
  function practiceNow() { return rehearseCard ? 'rh-' + rehearseCard.code : state.practice; }
  function wordByZh(zh) {
    for (var i = 0; i < wordCards.length; i++) if (wordCards[i].zh === zh) return wordCards[i];
    return null;
  }
  function rehearseStarted(c) {
    return !!(marksOf('read').status[c.zh] || marksOf('recall').status[c.zh] || marksOf('listen').status[c.zh]);
  }
  // Words started in Chinese with a meaning in k: due in k first, then Learning in k, then the most missed,
  // then new ones by frequency rank, then the rest.
  function rehearsePool(k) {
    var m = marksOf(rehearseSkill(k)), today = dayKey();
    var group = function (c) {
      var r = m.srs[c.zh];
      if (r && r.d <= today) return 0;
      if (m.status[c.zh] === 'learning') return 1;
      if (m.misses[c.zh]) return 2;
      return m.status[c.zh] ? 4 : 3;
    };
    return wordCards.filter(function (c) { return mean(c, k) && rehearseStarted(c); }).sort(function (a, b) {
      var ga = group(a), gb = group(b);
      if (ga !== gb) return ga - gb;
      if (ga === 0) return m.srs[a.zh].d < m.srs[b.zh].d ? -1 : m.srs[a.zh].d > m.srs[b.zh].d ? 1 : a.n - b.n;
      if (ga === 2) return (m.misses[b.zh] || 0) - (m.misses[a.zh] || 0) || a.n - b.n;
      if (ga === 3) return (a.rk || 1e6) - (b.rk || 1e6) || a.n - b.n;
      return a.n - b.n;
    });
  }

  /* ---------- rehearse cards in the word deck ---------- */
  var sinceRehearse = 0;
  var rehearsedThisSession = [];
  // True while a rehearse answer is recorded (for the rehearse quest and the day's rehearse count).
  var answeringRehearse = false;
  function isRehearseAnswer() { return answeringRehearse || isRehearseStyle(state.practice); }
  // Runs fn with skill k active and switches back, without clearing undo (useSkill would).
  function withSkill(k, fn) {
    var back = state.skill;
    if (k === back) return fn();
    stashSkill(); state.skill = k; loadSkill();
    try { return fn(); } finally { stashSkill(); state.skill = back; loadSkill(); }
  }
  // A rehearsed language, weighted by its share (at least 1, so a 0% language still gets cards).
  function pickRehearseLang() {
    var ls = langsRehearsed();
    if (!ls.length) return '';
    var w = ls.map(function (k) { return Math.max(1, state.rehearse.share[k] || 0); });
    var x = Math.random() * w.reduce(function (a, b) { return a + b; }, 0);
    for (var i = 0; i < ls.length; i++) { x -= w[i]; if (x < 0) return ls[i]; }
    return ls[ls.length - 1];
  }
  // Called after every answer in the deck: after `every` answers in the word deck, the next card shown is a rehearse card.
  function maybeInterject(kind) {
    if (kind === 'skip' || rehearseCard) return;
    sinceRehearse++;
    if (!state.rehearse.every || sinceRehearse < state.rehearse.every) return;
    if (state.deckType !== 'words' || isRehearseStyle(state.practice) || currentIndex() === null) return;
    var code = pickRehearseLang();
    if (!code) return;
    var pick = rehearsePool(code).filter(function (c) { return rehearsedThisSession.indexOf(code + ':' + c.zh) === -1; })[0];
    if (!pick) return;
    sinceRehearse = 0;
    rehearsedThisSession.push(code + ':' + pick.zh);
    rehearseCard = { zh: pick.zh, code: code };
    state.revealed = false;
  }
  // Answers the rehearse card on screen: only its language's marks move, and the deck stays where it was.
  function actRehearse(kind, grade) {
    var r = rehearseCard, c = wordByZh(r.zh), entry = null;
    rehearseCard = null;
    if (!c) { render(true); return false; }
    withSkill(rehearseSkill(r.code), function () {
      entry = { rehearse: r.code, pos: state.pos, zh: c.zh, prev: state.status[c.zh] || null, srs: state.srs[c.zh] || null,
        miss: state.misses[c.zh] || 0, day: dayKey(), kind: kind, requeued: false };
      if (kind === 'known' || kind === 'learning') {
        applySrs(c, kind, grade);
        state.status[c.zh] = markAfter(c, kind);
      }
    });
    undoStack.push(entry);
    if (kind === 'known' || kind === 'learning') {
      if (testing) entry.kind = 'skip';
      else { answeringRehearse = true; try { recordAnswer(kind, c, entry.prev); } finally { answeringRehearse = false; } }
    }
    stopSpeech();
    state.revealed = state.autoReveal;
    resetCardPosition();
    render(true);
    save();
    afterAnswer(kind);
    return true;
  }
  // Undoes a rehearse answer: its marks go back and the card is shown again.
  function undoRehearse(h) {
    withSkill(rehearseSkill(h.rehearse), function () {
      if (h.prev) state.status[h.zh] = h.prev; else delete state.status[h.zh];
      if (h.srs) state.srs[h.zh] = h.srs; else delete state.srs[h.zh];
      if (h.miss) state.misses[h.zh] = h.miss; else delete state.misses[h.zh];
    });
    var a = state.activity[h.day];
    if (a && (h.kind === 'known' || h.kind === 'learning')) { if (h.kind === 'known') a.k = Math.max(0, a.k - 1); else a.l = Math.max(0, a.l - 1); }
    rehearseCard = { zh: h.zh, code: h.rehearse };
    state.revealed = false;
    stopSpeech();
    render(true);
    save();
  }

  /* ---------- a short rehearse round after the daily goal ---------- */
  var ROUND_SIZE = 5;
  // Where to go back to when the round's last card is answered ({ practice, deckType }); null outside a round.
  var roundReturn = null;
  function roundLang() {
    return langsRehearsed().filter(function (k) { return rehearsePool(k).length >= ROUND_SIZE; })[0] || '';
  }
  function renderRehearseStrip() {
    var k = state.rehearse.afterGoal && state.rehearseSeen !== dayKey() && dayAnswers(dayKey()) >= state.goal ? roundLang() : '';
    els.rehearseStrip.hidden = !k;
    els.rehearseStrip.setAttribute('data-lang', k);
    els.rehearseText.textContent = k ? 'Goal done. ' + ROUND_SIZE + ' ' + langName(k) + ' cards?' : '';
  }
  function startRehearseRound(k) {
    var pool = rehearsePool(k).slice(0, ROUND_SIZE);
    if (pool.length < ROUND_SIZE) return;
    state.rehearseSeen = dayKey();
    OVERLAYS.forEach(function (o) { closeOverlay(els[o]); });
    closeSuggest();
    stopSpeech();
    rememberDeck();
    roundReturn = { practice: state.practice, deckType: state.deckType };
    useDeckType('words');
    state.practice = 'rh-' + k;
    useSkill(rehearseSkill(k));
    state.mode = 'all';
    state.deck = pool.map(function (c) { return wordCards.indexOf(c); });
    state.pos = 0;
    state.shuffled = false;
    state.revealed = false;
    undoStack = [];
    syncPracticeSelect();
    renderLadderStrip();
    render(true);
    save();
  }
  // Called when the round's deck ends: back to the style and deck from before it.
  function endRehearseRound() {
    var r = roundReturn;
    if (!r) return false;
    roundReturn = null;
    useDeckType(r.deckType);
    state.practice = PRACTICE[r.practice] ? r.practice : 'zh';
    fixStyleForDeck();
    useSkill(skillOf(state.practice));
    syncPracticeSelect();
    if (recallDeck()) { render(true); save(); } else setMode('all');
    if (!testing) toast('Round done. Back to your deck.', 3000);
    return true;
  }
