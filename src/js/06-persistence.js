  /* ---------- keyboard helpers ---------- */
  // Arrow keys move the selection inside a group of radio buttons (study mode, HSK level).
  function moveRadio(radio, dir) {
    var group = radio.closest('[role="radiogroup"]');
    if (!group) return;
    var radios = Array.prototype.slice.call(group.querySelectorAll('[role="radio"]'));
    var next = radios[(radios.indexOf(radio) + dir + radios.length) % radios.length];
    next.click();
    next.focus();
  }
  function accessibleName(n) {
    if (n.getAttribute('aria-label')) return n.getAttribute('aria-label');
    var lb = n.getAttribute('aria-labelledby');
    if (lb && $(lb)) return $(lb).textContent.trim();
    if (n.id) { var l = document.querySelector('label[for="' + n.id + '"]'); if (l && l.textContent.trim()) return l.textContent.trim(); }
    var wrap = n.closest('label');
    if (wrap && wrap.textContent.trim()) return wrap.textContent.trim();
    return (n.textContent || '').trim() || n.title || n.placeholder || '';
  }


  /* ---------- persistence ---------- */
  function loadSaved() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      storageOK = false;
      return null;
    }
  }
  // The reading skill stays at the top level (status, srs, misses), so older copies of the app still read it;
  // the other skills go under `skills`.
  // Recall, listening and every rehearse skill ever used (kept while a language is set back to Show).
  function skillsSnapshot() {
    var out = { recall: marksOf('recall'), listen: marksOf('listen') };
    Object.keys(state.marks).forEach(function (k) { if (k.indexOf('say:') === 0) out[k] = marksOf(k); });
    return out;
  }
  function progressSnapshot() {
    var read = marksOf('read');
    var other = state.deckType === 'sentences' ? 'words' : 'sentences', mem = {};
    if (state.deckMemory[other]) mem[other] = state.deckMemory[other];
    return {
      version: 1,
      format: FORMAT,
      status: read.status,
      mode: state.mode,
      deck: state.deck.map(function (i) { return cards[i].zh; }),
      pos: state.pos,
      shuffled: state.shuffled,
      autoReveal: state.autoReveal,
      rate: state.rate,
      voice: state.voice,
      badVoices: state.badVoices,
      voicesTested: state.voicesTested,
      level: state.level,
      activity: state.activity,
      goal: state.goal,
      warmup: state.warmup,
      srs: read.srs,
      misses: read.misses,
      skills: skillsSnapshot(),
      deckMemory: mem,
      topic: state.topic,
      xp: state.xp,
      bestCombo: state.bestCombo,
      learned: state.learned,
      wotdSeen: state.wotdSeen,
      quests: state.quests,
      freezes: state.freezes,
      frozen: state.frozen,
      recapWeek: state.recapWeek,
      seals: state.seals,
      rungs: state.rungs,
      ladderSeen: state.ladderSeen,
      rehearseSeen: state.rehearseSeen,
      readMeaning: state.readMeaning,
      petName: state.petName,
      labels: state.labels,
      theme: state.theme,
      langs: state.langs,
      rehearse: state.rehearse,
      newsSeen: state.newsSeen,
      questDays: state.questDays,
      blitzBest: state.blitzBest,
      exams: state.exams,
      milestones: state.milestones,
      practice: state.practice,
      order: state.order,
      toneColors: state.toneColors,
      fadePinyin: state.fadePinyin,
      choicePinyin: state.choicePinyin,
      autoplay: state.autoplay,
      vibrate: state.vibrate,
      seenTour: state.seenTour,
      deckType: state.deckType
    };
  }
  function save() {
    if (testing) return;
    var snap = null;
    try {
      snap = progressSnapshot();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
      storageOK = true;
    } catch (e) {
      storageOK = false;
      if (!storageWarned) {
        storageWarned = true;
        toast('This browser is blocking local storage, so your progress will not be kept after the page is closed.', 7000);
      }
    }
    updateFootnote();
    // Single hook for all callers: marks the snapshot dirty and debounces a push.
    // markLocalChange() no-ops when signed out or when sync is disabled for this build.
    markLocalChange(snap || undefined);
  }
  // Language roles from a save. Older saves stored true/false; anything else falls back to the default.
  function readLangs(src) {
    var out = { en: 'show', hu: 'show', de: 'off', es: 'off', ro: 'off' };
    if (src && typeof src === 'object') {
      MEANING_LANGS.forEach(function (l) {
        var v = src[l[0]];
        if (v === true) out[l[0]] = 'show';
        else if (v === false) out[l[0]] = 'off';
        else if (typeof v === 'string' && LANG_ROLES[v]) out[l[0]] = v;
      });
    }
    return out;
  }
  function readRehearse(src) {
    src = src && typeof src === 'object' ? src : {};
    var out = { share: {}, every: [0, 6, 8, 12].indexOf(src.every) !== -1 ? src.every : 8, afterGoal: src.afterGoal !== false };
    if (src.share && typeof src.share === 'object') {
      MEANING_LANGS.forEach(function (l) { if (typeof src.share[l[0]] === 'number') out.share[l[0]] = clampInt(src.share[l[0]], 0, 50); });
    }
    return out;
  }
  function restore(saved) {
    roundReturn = null;
    rehearseCard = null;
    var byZh = {};
    cards.forEach(function (c, i) { byZh[c.zh] = i; });
    var has = function (k) { return Object.prototype.hasOwnProperty.call(byZh, k); };
    var anyKey = {};
    wordCards.concat(sentCards).forEach(function (c) { anyKey[c.zh] = true; });
    var hasAny = function (k) { return Object.prototype.hasOwnProperty.call(anyKey, k); };
    if (saved && typeof saved.autoReveal === 'boolean') state.autoReveal = saved.autoReveal;
    if (saved && typeof saved.rate === 'number' && saved.rate >= 0.5 && saved.rate <= 1.5) state.rate = saved.rate;
    if (saved && typeof saved.voice === 'string') state.voice = saved.voice;
    if (saved && Array.isArray(saved.badVoices)) state.badVoices = saved.badVoices.filter(function (n) { return typeof n === 'string'; });
    if (saved && saved.voicesTested === true) state.voicesTested = true;
    if (saved && (saved.level === 'all' || LEVELS.indexOf(saved.level) !== -1)) state.level = saved.level;
    if (saved && GOALS.indexOf(saved.goal) !== -1) state.goal = saved.goal;
    if (saved && typeof saved.warmup === 'boolean') state.warmup = saved.warmup;
    state.readMeaning = saved && ['off', 'rehearse', 'always'].indexOf(saved.readMeaning) !== -1 ? saved.readMeaning : 'rehearse';
    ['toneColors', 'fadePinyin', 'choicePinyin', 'autoplay', 'vibrate', 'seenTour'].forEach(function (k) { if (saved && typeof saved[k] === 'boolean') state[k] = saved[k]; });
    state.langs = readLangs(saved && saved.langs);
    if (!MEANING_LANGS.some(function (l) { return langRole(l[0]) !== 'off'; })) state.langs.en = 'show';
    state.rehearse = readRehearse(saved && saved.rehearse);
    rebuildSkills();
    if (saved && PRACTICE[saved.practice]) state.practice = saved.practice;
    state.order = saved && ORDERS[saved.order] ? saved.order : 'hsk';
    // A rehearse style saved by a copy where that language was rehearsed: its deck was built from that language's marks.
    var rehearseGone = !!(saved && isRehearseStyle(saved.practice) && state.practice !== saved.practice);
    fixStyleForDeck();
    if (saved && Array.isArray(saved.milestones)) state.milestones = saved.milestones.filter(function (m) { return typeof m === 'string'; }).slice(-500);
    var readMarks = function (src) {
      var m = emptyMarks();
      if (!src || typeof src !== 'object') return m;
      if (src.status && typeof src.status === 'object') {
        Object.keys(src.status).forEach(function (k) { var v = src.status[k]; if (hasAny(k) && (v === 'known' || v === 'learning')) m.status[k] = v; });
      }
      if (src.srs && typeof src.srs === 'object') {
        Object.keys(src.srs).forEach(function (k) {
          var r = src.srs[k];
          if (hasAny(k) && r && typeof r.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.d)) m.srs[k] = { b: clampInt(r.b, 0, SRS_DAYS.length - 1), d: r.d };
        });
      }
      if (src.misses && typeof src.misses === 'object') {
        Object.keys(src.misses).forEach(function (k) { var n = parseInt(src.misses[k], 10); if (hasAny(k) && n > 0) m.misses[k] = n; });
      }
      return m;
    };
    var sk = saved && saved.skills && typeof saved.skills === 'object' ? saved.skills : {};
    state.marks = { read: readMarks(saved), recall: readMarks(sk.recall), listen: readMarks(sk.listen) };
    MEANING_LANGS.forEach(function (l) { var k = rehearseSkill(l[0]); if (sk[k]) state.marks[k] = readMarks(sk[k]); });
    state.skill = skillOf(state.practice);
    loadSkill();
    state.deckMemory = {};
    if (saved && saved.deckMemory && typeof saved.deckMemory === 'object') {
      ['words', 'sentences'].forEach(function (t) {
        var dm = saved.deckMemory[t];
        if (!dm || typeof dm !== 'object' || !MODE_NAMES[dm.mode] || !Array.isArray(dm.deck)) return;
        state.deckMemory[t] = { mode: dm.mode, deck: dm.deck.filter(function (z) { return typeof z === 'string' && hasAny(z); }), pos: clampInt(dm.pos, 0, 100000), shuffled: !!dm.shuffled };
      });
    }
    if (saved && saved.activity && typeof saved.activity === 'object') {
      Object.keys(saved.activity).forEach(function (k) {
        var a = saved.activity[k];
        if (/^\d{4}-\d{2}-\d{2}$/.test(k) && a && typeof a === 'object') state.activity[k] = { k: Math.max(0, parseInt(a.k, 10) || 0), l: Math.max(0, parseInt(a.l, 10) || 0), r: Math.max(0, parseInt(a.r, 10) || 0) };
      });
    }
    state.topic = saved && typeof saved.topic === 'string' && topicById(saved.topic) ? saved.topic : 'all';
    state.bestCombo = saved ? clampInt(saved.bestCombo, 0, 100000) : 0;
    state.learned = {};
    if (saved && saved.learned && typeof saved.learned === 'object') {
      Object.keys(saved.learned).forEach(function (k) {
        var d = saved.learned[k];
        if (hasAny(k) && typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) state.learned[k] = d;
      });
    }
    var isDay = function (d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d); };
    state.wotdSeen = saved && isDay(saved.wotdSeen) ? saved.wotdSeen : '';
    state.recapWeek = saved && isDay(saved.recapWeek) ? saved.recapWeek : '';
    state.freezes = saved ? clampInt(saved.freezes, 0, MAX_FREEZES) : 0;
    state.questDays = saved ? clampInt(saved.questDays, 0, 100000) : 0;
    state.petName = saved && typeof saved.petName === 'string' ? saved.petName.trim().slice(0, 16) : '';
    state.labels = saved && LABEL_MODES[saved.labels] ? saved.labels : 'both';
    state.theme = saved && THEMES[saved.theme] ? saved.theme : THEMES[state.theme] ? state.theme : 'ink';
    state.newsSeen = saved && typeof saved.newsSeen === 'string' ? saved.newsSeen.slice(0, 12) : '';
    var numMap = function (src, keys, max) {
      var out = {};
      if (src && typeof src === 'object') keys.forEach(function (k) { if (typeof src[k] === 'number') out[k] = clampInt(src[k], 0, max); });
      return out;
    };
    state.blitzBest = numMap(saved && saved.blitzBest, ['all'].concat(LEVELS), 1000);
    state.exams = numMap(saved && saved.exams, LEVELS, 100);
    state.seals = {};
    if (saved && saved.seals && typeof saved.seals === 'object') {
      Object.keys(saved.seals).forEach(function (k) { if (SEAL_BY_ID[k] && isDay(saved.seals[k])) state.seals[k] = saved.seals[k]; });
    }
    state.rungs = {};
    if (saved && saved.rungs && typeof saved.rungs === 'object') {
      Object.keys(saved.rungs).forEach(function (k) { if (/^[a-z0-9-]{1,40}$/.test(k) && isDay(saved.rungs[k])) state.rungs[k] = saved.rungs[k]; });
    }
    state.ladderSeen = saved && isDay(saved.ladderSeen) ? saved.ladderSeen : '';
    state.rehearseSeen = saved && isDay(saved.rehearseSeen) ? saved.rehearseSeen : '';
    state.frozen = saved && Array.isArray(saved.frozen) ? saved.frozen.filter(isDay).slice(-60) : [];
    state.quests = null;
    var q = saved && saved.quests;
    if (q && isDay(q.day) && Array.isArray(q.list)) {
      state.quests = { day: q.day, rewarded: !!q.rewarded, list: q.list.filter(function (x) { return x && QUESTS[x.id]; }).slice(0, 3).map(function (x) {
        return { id: x.id, goal: clampInt(x.goal, 1, 1000), n: clampInt(x.n, 0, 1000) };
      }) };
    }
    // Older progress has no XP: start from the answers already given.
    state.xp = saved && typeof saved.xp === 'number' && saved.xp >= 0 ? Math.floor(saved.xp)
      : Object.keys(state.activity).reduce(function (n, k) { return n + state.activity[k].k * 10 + state.activity[k].l * 3; }, 0);
    state.mode = saved && MODE_NAMES[saved.mode] ? saved.mode : 'all';
    var deck = [];
    if (saved && Array.isArray(saved.deck)) {
      var used = {};
      saved.deck.forEach(function (z) {
        if (typeof z === 'string' && has(z) && !used[z]) { used[z] = true; deck.push(byZh[z]); }
      });
    }
    var deckOk = !rehearseGone && deck.length > 0 && (state.mode !== 'all' || deck.length === buildDeck('all').length) && deck.every(function (i) { return inLevel(cards[i]); });
    if (deckOk) {
      state.deck = deck;
      state.pos = clampInt(saved.pos, 0, deck.length);
      state.shuffled = !!saved.shuffled;
    } else {
      state.deck = buildDeck(state.mode);
      state.pos = 0;
      state.shuffled = false;
    }
    state.revealed = state.autoReveal;
  }

