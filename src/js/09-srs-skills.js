  /* ---------- spaced repetition, hardest words ---------- */
  // Leitner boxes: a word answered “I know it” (Good) moves up a box and comes back after 1, 3, 7, 14, 30, 60, then 120 days.
  // Easy moves up two boxes; Hard keeps the box, so the word comes back after the same wait (a new word: again today).
  // “Still learning” sends it back to box 0, due again today.
  var SRS_DAYS = [0, 1, 3, 7, 14, 30, 60, 120];
  function addDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return dayKey(d); }
  function isDue(c, today) { var r = state.srs[c.zh]; return !!r && r.d <= (today || dayKey()); }
  function dueCount(lv) {
    var today = dayKey();
    return cards.filter(function (c) { return (lv === 'all' || String(c.lv) === lv) && inTopic(c) && isDue(c, today); }).length;
  }
  function hardList() {
    return cards.map(function (c, i) { return i; })
      .filter(function (i) { return inLevel(cards[i]) && (state.misses[cards[i].zh] || 0) > 0; })
      .sort(function (a, b) { return (state.misses[cards[b].zh] || 0) - (state.misses[cards[a].zh] || 0) || a - b; })
      .slice(0, 20);
  }
  function nextBox(c, grade) {
    var r = state.srs[c.zh], cur = r ? r.b : 0;
    if (grade === 'hard') return cur;
    return Math.min(SRS_DAYS.length - 1, cur + (grade === 'easy' ? 2 : 1));
  }
  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Cards of the active skill and deck due on each of the next n days; today also counts overdue cards.
  function forecast(n) {
    var days = [];
    for (var i = 0; i < n; i++) {
      var d = new Date();
      d.setDate(d.getDate() + i);
      days.push({ key: dayKey(d), label: i === 0 ? 'Today' : WEEKDAYS[d.getDay()], n: 0 });
    }
    cards.forEach(function (c) {
      var r = state.srs[c.zh];
      if (!r) return;
      if (r.d <= days[0].key) { days[0].n++; return; }
      for (var k = 1; k < n; k++) if (r.d === days[k].key) { days[k].n++; return; }
    });
    return days;
  }
  function fmtWait(days) { return days < 1 ? 'today' : days < 30 ? days + ' d' : Math.round(days / 30) + ' mo'; }
  // A right answer marks a card Known only once its next review is a week or more away (box 3 and up);
  // until then it stays Learning, so a word has to be remembered a few times before it counts as known.
  var KNOWN_AFTER_DAYS = 7;
  function markAfter(c, kind) {
    if (kind !== 'known') return kind;
    var r = state.srs[c.zh];
    return r && SRS_DAYS[r.b] >= KNOWN_AFTER_DAYS ? 'known' : 'learning';
  }
  function applySrs(c, kind, grade) {
    var r = state.srs[c.zh];
    if (kind === 'known') {
      var b = nextBox(c, grade);
      state.srs[c.zh] = { b: b, d: addDays(SRS_DAYS[b]) };
    } else if (kind === 'learning') {
      state.srs[c.zh] = { b: 0, d: dayKey() };
      state.misses[c.zh] = (state.misses[c.zh] || 0) + 1;
    }
  }
  // Older progress has marks but no schedule: spread known words over the next days so they do not all fall due at once.
  function migrateSrs() {
    var i = 0, m = marksOf('read');
    Object.keys(m.status).forEach(function (zh) {
      if (m.srs[zh]) return;
      if (m.status[zh] === 'known') m.srs[zh] = { b: 2, d: addDays(3 + (i++ % 5)) };
      else m.srs[zh] = { b: 0, d: dayKey() };
    });
  }

  /* ---------- skills: separate progress per kind of practice ---------- */
  // Reading (Chinese → meaning, 汉字 only, multiple choice), recall (meaning → Chinese) and listening (listening, which
  // tone) each keep their own marks, review schedule and miss counts. state.status / srs / misses always hold the
  // active skill's maps, so the rest of the app needs no skill logic; state.marks holds every skill, and stashSkill()
  // writes the active maps back before anything reads another skill.
  var SKILLS = { read: 'Reading', recall: 'Recall', listen: 'Listening' };
  // Snapshot format. 2 added `skills`. The server refuses uploads older than the stored format, and this copy refuses
  // to apply progress written by a newer one, so neither side drops what it does not understand.
  var FORMAT = 4;
  var SKILL_OF = { zh: 'read', hanzi: 'read', choice: 'read', cloze: 'read', pairs: 'read', reverse: 'recall', build: 'recall', listen: 'listen', tone: 'listen' };
  function skillOf(p) { return SKILL_OF[p] || 'read'; }
  function emptyMarks() { return { status: {}, srs: {}, misses: {} }; }
  function stashSkill() { state.marks[state.skill] = { status: state.status, srs: state.srs, misses: state.misses }; }
  function loadSkill() {
    var m = state.marks[state.skill] || (state.marks[state.skill] = emptyMarks());
    state.status = m.status;
    state.srs = m.srs;
    state.misses = m.misses;
  }
  function marksOf(k) { stashSkill(); return state.marks[k] || emptyMarks(); }
  function resetMarks() { state.marks = { read: emptyMarks(), recall: emptyMarks(), listen: emptyMarks() }; loadSkill(); }
  // Returns true when the skill changed. Undo entries belong to the skill they were made in, so they go.
  function useSkill(k) {
    if (!SKILLS[k]) k = 'read';
    if (k === state.skill) return false;
    stashSkill();
    state.skill = k;
    loadSkill();
    undoStack = [];
    return true;
  }
  // The card's mark in every skill, as three small seals: 读 reading, 说 recall, 听 listening. Green Known, amber
  // Learning, outlined New; the skill you are practising has a ring. maps (optional) saves lookups in long lists.
  var SKILL_ZH = { read: '读', recall: '说', listen: '听' };
  function skillMaps() { return { read: marksOf('read').status, recall: marksOf('recall').status, listen: marksOf('listen').status }; }
  function skillMarks(c, maps) {
    maps = maps || skillMaps();
    var w = el('span', 'skill-marks'), parts = [];
    ['read', 'recall', 'listen'].forEach(function (k) {
      var s = maps[k][c.zh] || 'unmarked';
      var m = el('span', 'sm sm-' + s + (k === state.skill ? ' active' : ''), SKILL_ZH[k]);
      m.setAttribute('lang', 'zh-CN');
      m.setAttribute('aria-hidden', 'true');
      w.appendChild(m);
      parts.push(SKILLS[k] + ': ' + STATUS_NAMES[s]);
    });
    w.setAttribute('role', 'img');
    w.setAttribute('aria-label', parts.join(', '));
    w.title = parts.join(' · ');
    return w;
  }
  function knownIn(k) {
    var st = marksOf(k).status, n = 0;
    cards.forEach(function (c) { if (st[c.zh] === 'known') n++; });
    return n;
  }

  /* ---------- deck memory: words and sentences keep their own place ---------- */
  function rememberDeck() {
    state.deckMemory[state.deckType] = { mode: state.mode, deck: state.deck.map(function (i) { return cards[i].zh; }), pos: state.pos, shuffled: state.shuffled };
  }
  // Puts back the remembered deck of the active deck type; false when there is none or it no longer fits the level.
  function recallDeck() {
    var m = state.deckMemory[state.deckType];
    if (!m || !MODE_NAMES[m.mode]) return false;
    var byZh = {};
    cards.forEach(function (c, i) { byZh[c.zh] = i; });
    var deck = m.deck.map(function (z) { return byZh[z]; }).filter(function (i) { return i !== undefined; });
    if (!deck.length || !deck.every(function (i) { return inLevel(cards[i]); })) return false;
    if (m.mode === 'all' && deck.length !== buildDeck('all').length) return false;
    stopSpeech();
    state.mode = m.mode;
    state.deck = deck;
    state.pos = clampInt(m.pos, 0, deck.length);
    state.shuffled = !!m.shuffled;
    state.revealed = state.autoReveal && state.practice === 'zh';
    undoStack = [];
    return true;
  }
  // A remembered Due or Learning deck was built from another skill's marks, so after a skill change only "All cards" is reused.
  function switchDeck(type, skillChanged) {
    rememberDeck();
    useDeckType(type);
    var m = state.deckMemory[state.deckType];
    if (m && (!skillChanged || m.mode === 'all') && recallDeck()) { render(true); save(); }
    else setMode(m && MODE_NAMES[m.mode] ? m.mode : state.mode);
  }

