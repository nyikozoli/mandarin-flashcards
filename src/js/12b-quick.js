  /* ---------- the two-minute session: just 5 cards ---------- */
  // On a day with no answers yet, #btnQuick (under the Today row) starts a round of QUICK_SIZE cards: due reviews
  // first, then new cards, then Learning ones, in the current deck, level, topic and practice style. It is a round
  // like the rehearse round (roundReturn, with quick: true): the deck is remembered, any change of mode, deck or
  // skill ends it, and at its end showEnd() calls endQuickRound(). Answers go through act(), so they count as usual.
  var QUICK_SIZE = 5;
  function inQuickRound() { return !!(roundReturn && roundReturn.quick); }
  function quickPool() {
    var seen = {}, out = [];
    ['due', 'unmarked', 'learning', 'all'].forEach(function (m) {
      if (out.length >= QUICK_SIZE) return;
      buildDeck(m).forEach(function (i) { if (!seen[i] && out.length < QUICK_SIZE) { seen[i] = true; out.push(i); } });
    });
    return out;
  }
  // The button shows until the day's first answer, and not during the round itself.
  function renderQuick() {
    var show = cards.length > 0 && dayAnswers(dayKey()) === 0 && !inQuickRound();
    els.btnQuick.hidden = !show;
    if (!show) return;
    // With no answer today, streak() is the run that ended yesterday: the one a first answer keeps.
    var s = streak();
    els.quickSub.textContent = 'About 2 minutes' + (s > 0 ? ' · keeps your 🔥 ' + s + '-day streak' : ' · starts a streak');
  }
  function startQuickRound() {
    if (roundReturn && !roundReturn.quick) endRehearseRound();
    var pool = quickPool();
    if (!pool.length) { toast('No cards here. Choose another level or topic.'); return false; }
    OVERLAYS.forEach(function (o) { closeOverlay(els[o]); });
    closeSuggest();
    stopSpeech();
    rememberDeck();
    rehearseCard = null;
    state.mode = 'all';
    state.deck = pool;
    state.pos = 0;
    state.shuffled = false;
    state.revealed = state.autoReveal && state.practice === 'zh';
    undoStack = [];
    // Set last: changing deck, mode or skill ends a round (see setMode, useDeckType, useSkill).
    roundReturn = { quick: true };
    render(true);
    save();
    if (!testing) { try { els.revealHint.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    return true;
  }
  // Called when the round's deck ends: back to the deck from before it, then the finish.
  function endQuickRound() {
    if (!inQuickRound()) return false;
    roundReturn = null;
    if (recallDeck()) { render(true); save(); } else setMode('all');
    showQuickDone();
    return true;
  }
  // A short finish: the streak, today's count, and a free choice between five more and stopping.
  function showQuickDone() {
    var n = dayAnswers(dayKey()), s = streak();
    // A round of skips answered nothing: no finish to show.
    if (!n && !testing) { toast('Round done. Back to your deck.', 3000); return; }
    els.quickTitle.textContent = s > 1 ? '🔥 ' + s + '-day streak kept' : '🔥 Today counts';
    els.quickText.textContent = n + (n === 1 ? ' card' : ' cards') + ' answered today' + (n >= state.goal ? ', daily goal reached' : '') +
      '. Five more, or stop here: both are fine.';
    openOverlay(els.quickView, els.btnQuickMore);
  }
  function wireQuick() {
    on('btnQuick', 'click', startQuickRound);
    on('btnQuickMore', 'click', function () { closeOverlay(els.quickView); startQuickRound(); });
    on('btnQuickDone', 'click', function () {
      closeOverlay(els.quickView);
      if (!testing) toast('See you tomorrow. 明天见!', 3000);
    });
  }
