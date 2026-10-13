  /* ---------- extras: character frequency, topics, hints ---------- */
  var EXTRA = { chars: {}, topics: [], hints: {}, news: [], ladder: [], clozeExclude: [], choiceExclude: [] };
  function loadExtra() {
    var node = $('extra-data');
    try {
      var d = JSON.parse(node.textContent);
      EXTRA = { chars: d.chars || {}, topics: Array.isArray(d.topics) ? d.topics : [], hints: d.hints || {}, news: Array.isArray(d.news) ? d.news : [], ladder: Array.isArray(d.ladder) ? d.ladder : [], clozeExclude: Array.isArray(d.clozeExclude) ? d.clozeExclude : [], choiceExclude: Array.isArray(d.choiceExclude) ? d.choiceExclude : [] };
    } catch (e) { /* optional data: the app works without it */ }
  }
  function topicById(id) {
    for (var i = 0; i < EXTRA.topics.length; i++) if (EXTRA.topics[i].id === id) return EXTRA.topics[i];
    return null;
  }
  // A sentence belongs to the topics of the words it was written for.
  function inTopic(c) {
    if (state.topic === 'all') return true;
    if (!c.sentence) return c.tp === state.topic;
    var lex = getLexicon().map;
    return c.ex.some(function (w) { var x = lex[w.zh]; return !!x && x.tp === state.topic; });
  }

  function validateCards() {
    var missing = [], dups = [], seen = {};
    wordCards.forEach(function (c) {
      var miss = [];
      if (!c.zh) miss.push('Chinese');
      if (!c.py) miss.push('pinyin');
      if (!c.en) miss.push('English');
      if (!c.hu) miss.push('Hungarian');
      if (!c.ex.length) miss.push('example sentence');
      c.ex.forEach(function (e, k) {
        if (!e.zh) miss.push('example ' + (k + 1) + ' Chinese');
        if (!e.py) miss.push('example ' + (k + 1) + ' pinyin');
        if (!e.en) miss.push('example ' + (k + 1) + ' English');
        if (!e.hu) miss.push('example ' + (k + 1) + ' Hungarian');
      });
      if (miss.length) missing.push('#' + c.n + ' ' + (c.zh || '?') + ': missing ' + miss.join(', '));
      if (c.zh) {
        if (Object.prototype.hasOwnProperty.call(seen, c.zh)) dups.push(c.zh);
        seen[c.zh] = true;
      }
    });
    return { count: wordCards.length, missing: missing, dups: dups };
  }

  /* ---------- words or sentences ---------- */
  // Sentence cards are built from the words' example sentences; a sentence used by two words lists both.
  function buildSentences(words) {
    var map = {}, list = [];
    words.forEach(function (w) {
      w.ex.forEach(function (e) {
        var s = map[e.zh];
        if (!s) {
          s = map[e.zh] = { zh: e.zh, py: e.py, en: e.en, hu: e.hu, tr: e.tr || {}, ex: [], lv: w.lv, sentence: true };
          list.push(s);
        }
        s.lv = Math.min(s.lv, w.lv);
        s.ex.push({ zh: w.zh, py: w.py, en: w.en, hu: w.hu, tr: w.tr || {} });
      });
    });
    // Easiest first within each level: the highest HSK level among its words, then how many words are above the
    // sentence's level, then length. The sort is stable, so ties keep the word order.
    list.forEach(function (s) {
      var lvs = segment(s.zh).filter(function (sg) { return sg.word; }).map(function (sg) { return sg.word.lv; });
      s.top = Math.max.apply(null, [s.lv].concat(lvs));
      s.above = lvs.filter(function (l) { return l > s.lv; }).length;
    });
    list.sort(function (a, b) { return a.lv - b.lv || a.top - b.top || a.above - b.above || charLen(a.zh) - charLen(b.zh); });
    list.forEach(function (s, i) {
      s.n = i + 1;
      indexCard(s);
    });
    return list;
  }
  function isSent() { return state.deckType === 'sentences'; }
  var DECKS = {
    words: { noun: ['word', 'words'], listTitle: 'All words', mapTitle: 'Every word', number: '#', milestone: '',
      sayIt: 'What is this in Chinese?', listenQ: 'Listen. Which word is it?', play: '🔊 Play the word',
      toneQ: 'Listen. Which tone is the first syllable?', tonePlay: '🔊 Play the word again' },
    sentences: { noun: ['sentence', 'sentences'], listTitle: 'All sentences', mapTitle: 'Every sentence', number: 'sentence ', milestone: 'sentence-',
      sayIt: 'Say this in Chinese:', listenQ: 'Listen. What does it say?', play: '🔊 Play the sentence' }
  };
  function deck() { return DECKS[state.deckType]; }
  function noun(n) { return deck().noun[n === 1 ? 0 : 1]; }
  function useDeckType(t) {
    rehearseCard = null;
    roundReturn = null;
    state.deckType = t === 'sentences' ? 'sentences' : 'words';
    fixStyleForDeck();
    cards = isSent() ? sentCards : wordCards;
    document.body.classList.toggle('deck-sentences', isSent());
    if (els.card) els.card.classList.toggle('sentence', isSent());
  }
  // Styles that exist for one deck only, and the style of the same skill to use on the other deck.
  var DECK_ONLY = { tone: ['words', 'listen'], cloze: ['words', 'choice'], build: ['sentences', 'reverse'], pairs: ['words', 'choice'] };
  function fixStyleForDeck() {
    var o = DECK_ONLY[state.practice];
    if (!o || o[0] === state.deckType) return;
    var was = state.practice;
    state.practice = o[1];
    // Only a rehearse style's fallback crosses skills (to reading), so only then does the skill follow.
    if (isRehearseStyle(was)) useSkill(skillOf(state.practice));
  }
  // Opens a short sentence deck with just this word's example sentences, in the current practice
  // style (so “汉字 only” gives character-reading practice). Picking a study mode goes back to the full deck.
  function practiceSentencesOf(word) {
    if (!word || word.sentence) return;
    var mine = word.ex.map(function (e) { return e.zh; });
    var deckIdx = [];
    sentCards.forEach(function (s, i) { if (mine.indexOf(s.zh) !== -1) deckIdx.push(i); });
    if (!deckIdx.length) return;
    stopSpeech();
    rememberDeck();
    useDeckType('sentences');
    state.mode = 'all';
    state.deck = deckIdx;
    state.pos = 0;
    state.shuffled = false;
    state.revealed = state.autoReveal && state.practice === 'zh';
    undoStack = [];
    syncPracticeSelect();
    render(true);
    save();
    toast('Practicing the sentences for ' + word.zh + '. Choose a study mode to go back to the full deck.', 5000);
  }
  function syncPracticeSelect() { els.optPractice.value = (isSent() ? 's-' : '') + state.practice; syncPracticeButton(); }
  function syncSettingsUI() {
    els.optAutoReveal.checked = state.autoReveal;
    els.optTones.checked = state.toneColors;
    els.optAutoplay.checked = state.autoplay;
    els.optFadePinyin.checked = state.fadePinyin;
    ['En', 'Hu', 'De', 'Es', 'Ro'].forEach(function (K) {
      var k = K.toLowerCase(), role = langRole(k), share = els['optShare' + K], out = els['optShare' + K + 'Out'];
      els['optLang' + K].value = role;
      els['optLang' + K].closest('.lang-row').hidden = !LANG_AVAILABLE[k];
      share.hidden = out.hidden = role !== 'rehearse';
      share.value = String(shareOf(k));
      out.textContent = share.value + '%';
    });
    els.rehearseOpts.hidden = !langsRehearsed().length;
    els.optRehearseEvery.value = String(state.rehearse.every);
    els.optRehearseAfterGoal.checked = state.rehearse.afterGoal;
    els.optLabels.value = state.labels;
    els.optTheme.value = state.theme;
    els.optChoicePinyin.checked = state.choicePinyin;
    els.optVibrate.checked = state.vibrate;
    els.optWarmup.checked = state.warmup;
    syncPracticeSelect();
    var rateOpt = String(state.rate);
    els.optRate.value = ['0.6', '0.85', '1'].indexOf(rateOpt) !== -1 ? rateOpt : '0.85';
    state.rate = parseFloat(els.optRate.value);
    els.optReadMeaning.value = state.readMeaning;
    var mute = speechSupported ? langsRehearsed().filter(function (k) { return !canSpeak(k); }) : [];
    els.rehearseVoiceNote.hidden = !mute.length;
    els.rehearseVoiceNote.textContent = mute.length ? 'No ' + mute.map(langName).join(' or ') + ' voice on this device. iPhone: Settings → Accessibility → Spoken Content → Voices. Windows: Settings → Time & language → Speech.' : '';
  }
  // After a language's role changes: settings, the card and the save follow.
  function langsChanged() {
    var before = state.practice;
    rebuildSkills();
    syncSettingsUI();
    // Leaving a rehearse style (its language set back to Show) leaves its pool as the deck: rebuild it.
    if (state.practice !== before) setMode(state.mode);
    else { render(false); save(); }
  }
  function announce(msg) {
    if (testing || !els.srLive) return;
    els.srLive.textContent = '';
    setTimeout(function () { els.srLive.textContent = msg; }, 40);
  }

