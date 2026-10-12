  /* ---------- deck ---------- */
  function statusOf(c) { return state.status[c.zh] || 'unmarked'; }
  function buildDeck(mode) {
    if (mode === 'hard') return hardList();
    var idx = [], today = dayKey();
    cards.forEach(function (c, i) {
      if (!inLevel(c)) return;
      if (mode === 'due') { if (isDue(c, today)) idx.push(i); return; }
      var s = statusOf(c);
      if (mode === 'all' || s === mode) idx.push(i);
    });
    if (mode === 'due') {
      idx.sort(function (a, b) {
        var ra = state.srs[cards[a].zh], rb = state.srs[cards[b].zh];
        return ra.d < rb.d ? -1 : ra.d > rb.d ? 1 : ra.b - rb.b;
      });
    }
    var rk = rehearseCode(state.practice);
    if (mode === 'all' && rk) {
      var order = {};
      rehearsePool(rk).forEach(function (c, n) { order[c.zh] = n; });
      idx.sort(function (a, b) { return order[cards[a].zh] - order[cards[b].zh]; });
    }
    return idx;
  }
  function currentIndex() {
    return state.pos < state.deck.length ? state.deck[state.pos] : null;
  }
  function counts() { return countsFor(state.level); }
  function setMode(mode) {
    if (!MODE_NAMES[mode]) mode = 'all';
    stopSpeech();
    state.mode = mode;
    state.deck = buildDeck(mode);
    state.pos = 0;
    state.shuffled = false;
    state.revealed = state.autoReveal;
    undoStack = [];
    render(true);
    save();
    if (!state.deck.length) {
      toast({ learning: 'No cards are marked “Still learning” yet.', unmarked: 'No new cards left – great work!',
        due: 'Nothing is due for review right now. 🎉', hard: 'No hard words yet – words you mark “Still learning” collect here.',
        all: 'No cards here.' }[mode]);
    }
  }
  function shuffleDeck() {
    if (!state.deck.length) { toast('There are no cards to shuffle in this mode.'); return; }
    stopSpeech();
    var d = state.deck;
    for (var i = d.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = d[i]; d[i] = d[j]; d[j] = t;
    }
    state.pos = 0;
    state.shuffled = true;
    state.revealed = state.autoReveal;
    undoStack = [];
    render(true);
    save();
    toast('Deck shuffled – starting from the first card.');
  }

