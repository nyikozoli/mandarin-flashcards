  /* ---------- reading power ---------- */
  function ordinal(n) { var t = n % 100; return t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'; }
  var segCache = {};
  function sentenceWords(zh) {
    if (!segCache[zh]) {
      var seen = [];
      segment(zh).forEach(function (g) { if (g.word && seen.indexOf(g.word) === -1) seen.push(g.word); });
      segCache[zh] = seen;
    }
    return segCache[zh];
  }
  // Sentences whose HSK words you all know (reading skill); names and other non-HSK words do not count against you.
  // `next` is the sentence that needs the fewest more words.
  function readability() {
    var st = marksOf('read').status, n = 0, best = null;
    sentCards.forEach(function (sc) {
      var miss = sentenceWords(sc.zh).filter(function (w) { return st[w.zh] !== 'known'; });
      if (!miss.length) { n++; return; }
      if (!best || miss.length < best.miss.length || (miss.length === best.miss.length && sc.zh.length < best.s.zh.length)) best = { s: sc, miss: miss };
    });
    return { n: n, total: sentCards.length, next: best };
  }
  // Share of running Chinese text made up of your known words, and of their characters (wordfreq frequencies).
  function coverage() {
    var st = marksOf('read').status, w = 0, wAll = 0, mine = {}, all = {}, c = 0, cAll = 0;
    wordCards.forEach(function (x) {
      wAll += x.fq;
      Array.from(x.zh).forEach(function (ch) { all[ch] = true; });
      if (st[x.zh] !== 'known') return;
      w += x.fq;
      Array.from(x.zh).forEach(function (ch) { mine[ch] = true; });
    });
    Object.keys(all).forEach(function (ch) { cAll += EXTRA.chars[ch] || 0; if (mine[ch]) c += EXTRA.chars[ch] || 0; });
    return { words: w / 1e6, wordsMax: wAll / 1e6, chars: c / 1e6, charsMax: cAll / 1e6, has: wAll > 0 };
  }
  // The most frequent word you do not know yet (reading skill).
  function nextUsefulWord() {
    var st = marksOf('read').status, best = null;
    wordCards.forEach(function (w) { if (w.rk && st[w.zh] !== 'known' && (!best || w.rk < best.rk)) best = w; });
    return best;
  }
  function fmtPct(x) { return (x >= 0.1 ? Math.round(x * 100) : Math.round(x * 1000) / 10) + '%'; }

  /* ---------- XP, ranks and combo ---------- */
  var RANKS = [[0, '新手', 'Newcomer'], [300, '学生', 'Student'], [1000, '好学生', 'Good student'], [2500, '学者', 'Scholar'],
    [5000, '老师', 'Teacher'], [10000, '专家', 'Expert'], [20000, '大师', 'Master']];
  function rankOf(xp) { var r = 0; RANKS.forEach(function (x, i) { if (xp >= x[0]) r = i; }); return r; }
  function gainXp(n) {
    var before = rankOf(state.xp);
    state.xp += n;
    session.xp += n;
    var after = rankOf(state.xp);
    if (after > before) celebrate('rank-' + after, '🎖 New rank: ' + RANKS[after][1] + ' · ' + RANKS[after][2] + '!');
  }
  var combo = 0;
  var COMBO_CHEERS = { 10: '连 10! Ten in a row.', 25: '连 25! You are on fire.', 50: '连 50! Unstoppable.', 100: '连 100! Legendary run.' };
  function bumpCombo(kind) {
    combo = kind === 'known' ? combo + 1 : 0;
    if (combo > state.bestCombo) state.bestCombo = combo;
    if (COMBO_CHEERS[combo] && !testing) { toast(COMBO_CHEERS[combo], 2500); buzz([15, 30, 15]); }
    renderCombo();
  }
  function renderCombo() {
    if (combo >= 3 && !reduceMotion) { els.comboTag.classList.remove('pop'); void els.comboTag.offsetWidth; els.comboTag.classList.add('pop'); }
    els.comboTag.hidden = combo < 3;
    els.comboTag.textContent = '连 ×' + combo;
    els.comboTag.title = combo + ' right in a row';
  }
  function longestStreak() {
    var days = Object.keys(state.activity).filter(function (k) { return dayAnswers(k) > 0; }).concat(state.frozen).sort(), best = 0, run = 0, prev = null;
    days.forEach(function (k) {
      var d = new Date(k + 'T12:00:00');
      run = prev && Math.round((d - prev) / 864e5) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    });
    return best;
  }
  function learnedSince(days) {
    var from = addDays(-days + 1), n = 0;
    wordCards.forEach(function (w) { var d = state.learned[w.zh]; if (d && d >= from) n++; });
    return n;
  }

  /* ---------- daily: word of the day, quests, streak freezes, weekly recap ---------- */
  function hashDay(k) { var h = 0; for (var i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0; return h; }
  // One of the 30 most frequent words you do not know yet (reading), the same all day.
  function wordOfDay(k) {
    var st = marksOf('read').status;
    var pool = wordCards.filter(function (w) { return st[w.zh] !== 'known'; });
    if (!pool.length) pool = wordCards.slice();
    pool.sort(function (a, b) { return (a.rk || 1e9) - (b.rk || 1e9) || a.n - b.n; });
    pool = pool.slice(0, 30);
    return pool[hashDay(k || dayKey()) % pool.length];
  }
  function renderWotd() {
    var w = wordOfDay();
    // One strip at a time: after an update, the what's-new notice goes first.
    els.wotd.hidden = !w || state.wotdSeen === dayKey() || !els.newsStrip.hidden;
    renderLadderStrip();
    if (els.wotd.hidden) return;
    els.wotdZh.textContent = w.zh;
    renderPinyin(els.wotdPy, w.py);
    els.wotdEn.textContent = shortText(mainMeaning(w));
    els.wotd.title = 'Word of the day: ' + w.zh + ' ' + w.py + ', ' + langsOn().map(function (k) { return shortText(mean(w, k)); }).join(' · ');

    els.btnWotdStudy.setAttribute('data-study', w.zh);
  }
  function dismissWotd() { state.wotdSeen = dayKey(); renderWotd(); save(); }
  // Memory hints for the characters of a word, in order (empty when there is no hint data).
  function hintsFor(c) {
    var out = [];
    Array.from(c.zh).forEach(function (ch) {
      var h = EXTRA.hints[ch];
      if (h && !out.some(function (x) { return x.ch === ch; })) out.push({ ch: ch, kind: h.kind, parts: h.parts, en: h.en, hu: h.hu });
    });
    return out;
  }

  // Three quests a day: always the daily goal, plus two drawn from the rest by the date.
  var MAX_FREEZES = 2;
  var QUESTS = {
    goal: { label: function (q) { return 'Answer ' + q.goal + ' cards'; } },
    fresh: { label: function (q) { return 'Learn ' + q.goal + ' new cards'; } },
    due: { label: function (q) { return 'Review ' + q.goal + ' due cards'; } },
    listen: { label: function (q) { return q.goal + ' answers in listening practice'; } },
    recall: { label: function (q) { return q.goal + ' answers in recall practice'; } },
    sentence: { label: function (q) { return q.goal + ' sentence cards'; } },
    combo: { label: function (q) { return 'Reach a ' + q.goal + ' combo'; } },
    topic: { label: function (q) { return q.goal + ' answers inside one topic'; } }
  };
  function makeQuests(k) {
    var h = hashDay(k), pool = ['fresh', 'listen', 'recall', 'sentence', 'combo'];
    if (EXTRA.topics.length) pool.push('topic');
    var due = Math.min(15, dueCount('all'));
    var picks = [];
    if (due >= 3) picks.push('due');
    while (picks.length < 2) {
      var id = pool[h % pool.length];
      h = Math.floor(h / pool.length) + 7;
      if (picks.indexOf(id) === -1) picks.push(id);
    }
    var goals = { goal: state.goal, fresh: 5, due: due, listen: 10, recall: 10, sentence: 10, combo: 10, topic: 10 };
    return { day: k, rewarded: false, list: ['goal'].concat(picks).map(function (id) { return { id: id, goal: goals[id], n: 0 }; }) };
  }
  function todaysQuests() {
    var k = dayKey();
    if (!state.quests || state.quests.day !== k) state.quests = makeQuests(k);
    return state.quests;
  }
  // Called for every graded answer. prev is the card's mark before the answer.
  function questEvent(kind, c, prev) {
    var qs = todaysQuests(), done = [];
    qs.list.forEach(function (q) {
      if (q.n >= q.goal) return;
      var p = state.practice;
      var hit = q.id === 'goal' ? true
        : q.id === 'fresh' ? kind === 'known' && !prev
        : q.id === 'due' ? state.mode === 'due'
        : q.id === 'listen' ? state.skill === 'listen'
        : q.id === 'recall' ? state.skill === 'recall'
        : q.id === 'sentence' ? !!c.sentence
        : q.id === 'topic' ? state.topic !== 'all'
        : false;
      if (q.id === 'combo') q.n = Math.max(q.n, combo);
      else if (hit) q.n++;
      if (q.n >= q.goal) { q.n = q.goal; done.push(q); }
    });
    done.forEach(function (q) {
      gainXp(30);
      if (!testing) toast('✓ Quest done: ' + QUESTS[q.id].label(q) + ' (+30 XP)', 3500);
    });
    if (!qs.rewarded && qs.list.every(function (q) { return q.n >= q.goal; })) {
      qs.rewarded = true;
      state.questDays++;
      var got = state.freezes < MAX_FREEZES;
      if (got) state.freezes++;
      gainXp(50);
      celebrate('quests-' + qs.day, '🏅 All three quests done! +50 XP' + (got ? ' and a 🧊 streak freeze.' : '. Freezes are full (2).'));
    }
  }
  function dayActive(k) { return dayAnswers(k) > 0 || state.frozen.indexOf(k) !== -1; }
  // A missed day right before today is covered by a saved freeze, so the streak survives (up to 2 days).
  function applyFreezes() {
    var d = new Date(), gap = [];
    d.setDate(d.getDate() - 1);
    while (gap.length <= MAX_FREEZES && !dayActive(dayKey(d))) { gap.push(dayKey(d)); d.setDate(d.getDate() - 1); }
    if (!gap.length || gap.length > state.freezes || !dayActive(dayKey(d))) return 0;
    gap.forEach(function (k) { state.frozen.push(k); });
    state.frozen = state.frozen.slice(-60);
    state.freezes -= gap.length;
    if (!testing) toast('🧊 A streak freeze saved your ' + streak() + '-day streak.', 6000);
    return gap.length;
  }
  function weekStart(d) {
    d = new Date(d || new Date());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return dayKey(d);
  }
  // Last week's numbers, or null when there was nothing that week.
  function weekRecap(start) {
    var d = new Date(start + 'T12:00:00'), k = 0, l = 0, days = 0, best = null;
    for (var i = 0; i < 7; i++) {
      var key = dayKey(d), a = state.activity[key];
      if (a && a.k + a.l > 0) {
        k += a.k; l += a.l; days++;
        if (!best || a.k + a.l > best.n) best = { day: WEEKDAYS[d.getDay()], n: a.k + a.l };
      }
      d.setDate(d.getDate() + 1);
    }
    if (!days) return null;
    var end = dayKey(d), learned = 0;
    wordCards.forEach(function (w) { var x = state.learned[w.zh]; if (x && x >= start && x < end) learned++; });
    return { cards: k + l, accuracy: Math.round(k / (k + l) * 100), days: days, best: best, learned: learned };
  }
  function maybeShowRecap() {
    var thisWeek = weekStart();
    if (state.recapWeek === thisWeek) return;
    var d = new Date(thisWeek + 'T12:00:00');
    d.setDate(d.getDate() - 7);
    var r = weekRecap(dayKey(d));
    state.recapWeek = thisWeek;
    save();
    if (!r || anyOverlayOpen()) return;
    var b = els.summaryBody;
    b.textContent = '';
    b.appendChild(el('p', 'sum-big', 'Last week: ' + r.cards + ' cards on ' + r.days + ' day' + (r.days === 1 ? '' : 's')));
    var row = el('div', 'sum-tiles');
    [['New words', r.learned], ['Accuracy', r.accuracy + '%'], ['Best day', r.best.day + ' · ' + r.best.n], ['Streak', streak()]].forEach(function (t) {
      var tile = el('div', 'pv-tile');
      tile.appendChild(el('span', 'pv-tile-label', t[0]));
      tile.appendChild(el('span', 'pv-tile-num', String(t[1])));
      row.appendChild(tile);
    });
    b.appendChild(row);
    b.appendChild(el('p', 'sum-line', r.days >= 5 ? 'A strong week. Keep the rhythm going.' : 'A new week: three quests are waiting today.'));
    openOverlay(els.summaryView, els.btnSummaryClose);
  }
  function questSection() {
    var qs = todaysQuests();
    var sec = section('Today\u2019s quests', 'Finish all three for +50 XP and a 🧊 streak freeze (you can save ' + MAX_FREEZES + '). Saved now: ' + state.freezes + '.');
    var list = el('ul', 'q-list');
    qs.list.forEach(function (q) {
      var li = el('li', 'q-item' + (q.n >= q.goal ? ' done' : ''));
      var ring = el('span', 'q-ring', q.n >= q.goal ? '✓' : '');
      ring.style.setProperty('--p', pct(q.n, q.goal) + '%');
      ring.setAttribute('aria-hidden', 'true');
      li.appendChild(ring);
      var tx = el('span', 'q-text');
      tx.appendChild(el('span', 'q-label', QUESTS[q.id].label(q)));
      var bar = el('span', 'tp-bar');
      var fill = el('span', 'tp-fill');
      fill.style.width = pct(q.n, q.goal) + '%';
      bar.appendChild(fill);
      tx.appendChild(bar);
      li.appendChild(tx);
      li.appendChild(el('span', 'q-count', q.n + '/' + q.goal));
      list.appendChild(li);
    });
    sec.appendChild(list);
    return sec;
  }

  /* ---------- seals (印章): achievements ---------- */
  function knownWords(skill) {
    var st = marksOf(skill || 'read').status, n = 0;
    wordCards.forEach(function (w) { if (st[w.zh] === 'known') n++; });
    return n;
  }
  function levelDone(lv) {
    var st = marksOf('read').status, list = wordCards.filter(function (w) { return String(w.lv) === lv; });
    return list.length > 0 && list.every(function (w) { return st[w.zh] === 'known'; });
  }
  function anyTopicDone() {
    var st = marksOf('read').status;
    return EXTRA.topics.some(function (t) { var l = wordsIn(t.id); return l.length && l.every(function (w) { return st[w.zh] === 'known'; }); });
  }
  var SEALS = [
    { id: 'first', zh: '初', en: 'First word', how: 'Know your first word' },
    { id: 'k50', zh: '五十', en: 'Fifty', how: 'Know 50 words' },
    { id: 'k100', zh: '百', en: 'One hundred', how: 'Know 100 words' },
    { id: 'k300', zh: '三百', en: 'Three hundred', how: 'Know 300 words' },
    { id: 'kall', zh: '全', en: 'Every word', how: 'Know all 598 words' },
    { id: 'hsk1', zh: '一级', en: 'HSK 1', how: 'Know every HSK 1 word' },
    { id: 'hsk2', zh: '二级', en: 'HSK 2', how: 'Know every HSK 2 word' },
    { id: 'hsk3', zh: '三级', en: 'HSK 3', how: 'Know every HSK 3 word' },
    { id: 'topic', zh: '题', en: 'Topic master', how: 'Know every word of one topic' },
    { id: 'read50', zh: '读', en: 'Reader', how: 'Be able to read 50 example sentences' },
    { id: 'read300', zh: '书', en: 'Bookworm', how: 'Be able to read 300 example sentences' },
    { id: 'ear', zh: '耳', en: 'Good ear', how: 'Know 100 words in listening practice' },
    { id: 'mouth', zh: '口', en: 'Fluent', how: 'Know 100 words in meaning → Chinese' },
    { id: 's7', zh: '周', en: 'One week', how: 'Keep a 7-day streak' },
    { id: 's30', zh: '月', en: 'One month', how: 'Keep a 30-day streak' },
    { id: 'combo', zh: '连', en: 'On a roll', how: 'Get 25 right in a row' },
    { id: 'quests', zh: '勤', en: 'Diligent', how: 'Finish all daily quests on 7 days' },
    { id: 'blitz', zh: '快', en: 'Lightning', how: 'Score 20 in a 60-second blitz' },
    { id: 'exam', zh: '考', en: 'Exam passed', how: 'Pass an HSK level exam' },
    { id: 'scholar', zh: '学者', en: 'Scholar', how: 'Reach the Scholar rank' }
  ];
  var SEAL_BY_ID = {};
  SEALS.forEach(function (x) { SEAL_BY_ID[x.id] = x; });
  function sealEarned(id) {
    var bestBlitz = Math.max.apply(null, [0].concat(Object.keys(state.blitzBest).map(function (k) { return state.blitzBest[k]; })));
    switch (id) {
      case 'first': return knownWords() >= 1;
      case 'k50': return knownWords() >= 50;
      case 'k100': return knownWords() >= 100;
      case 'k300': return knownWords() >= 300;
      case 'kall': return knownWords() >= wordCards.length;
      case 'hsk1': return levelDone('1');
      case 'hsk2': return levelDone('2');
      case 'hsk3': return levelDone('3');
      case 'topic': return anyTopicDone();
      case 'read50': return readability().n >= 50;
      case 'read300': return readability().n >= 300;
      case 'ear': return knownWords('listen') >= 100;
      case 'mouth': return knownWords('recall') >= 100;
      case 's7': return longestStreak() >= 7;
      case 's30': return longestStreak() >= 30;
      case 'combo': return state.bestCombo >= 25;
      case 'quests': return state.questDays >= 7;
      case 'blitz': return bestBlitz >= 20;
      case 'exam': return Object.keys(state.exams).some(function (k) { return state.exams[k] >= EXAM_PASS; });
      case 'scholar': return rankOf(state.xp) >= 3;
    }
    return false;
  }
  // Awards every seal whose condition now holds; returns the new ones.
  function checkSeals() {
    var fresh = [];
    SEALS.forEach(function (x) {
      if (state.seals[x.id] || !sealEarned(x.id)) return;
      state.seals[x.id] = dayKey();
      fresh.push(x);
    });
    fresh.forEach(function (x) {
      state.xp += 50;
      if (!testing) { stampSeal(x); buzz([20, 40, 20]); }
    });
    return fresh;
  }
  // A seal pressed onto the screen for a moment.
  function stampSeal(x) {
    var n = el('div', 'seal-stamp');
    n.setAttribute('role', 'status');
    var mark = el('span', 'seal-stamp-mark', x.zh);
    mark.setAttribute('lang', 'zh-CN');
    n.appendChild(mark);
    n.appendChild(el('span', 'seal-stamp-text', x.text || 'New seal: ' + x.en + ' (+50 XP)'));
    document.body.appendChild(n);
    confetti();
    setTimeout(function () { n.classList.add('out'); }, 2600);
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 3200);
  }
  function shortDate(k) { var p = k.split('-'); return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1]; }
  function sealSection() {
    var got = SEALS.filter(function (x) { return state.seals[x.id]; }).length;
    var sec = section('Seals', got + ' of ' + SEALS.length + ' collected. Each one is worth 50 XP.');
    var grid = el('ul', 'seal-grid');
    SEALS.forEach(function (x) {
      var on = !!state.seals[x.id];
      var li = el('li', 'seal-item' + (on ? ' on' : ''));
      var mark = el('span', 'seal-mark', x.zh);
      mark.setAttribute('lang', 'zh-CN');
      mark.setAttribute('aria-hidden', 'true');
      li.appendChild(mark);
      li.appendChild(el('span', 'seal-name', x.en));
      li.appendChild(el('span', 'seal-how', on ? 'Earned ' + shortDate(state.seals[x.id]) : x.how));
      li.setAttribute('aria-label', x.en + (on ? ', earned on ' + state.seals[x.id] : ', not yet earned: ' + x.how));
      grid.appendChild(li);
    });
    sec.appendChild(grid);
    return sec;
  }

  /* ---------- challenges: 60-second blitz and level exams ---------- */
  var EXAM_PASS = 80, EXAM_SIZE = 20, BLITZ_SECONDS = 60;
  var quiz = null;
  function quizPool(lv) { return wordCards.filter(function (w) { return lv === 'all' || String(w.lv) === lv; }); }
  // n wrong options for c of question type `type`: distinct by `key`, and none that is also right (optionClash()).
  function pickOthers(c, pool, n, key, type) {
    var k = key(c), out = [], cand = shuffled(pool);
    for (var i = 0; i < cand.length && out.length < n; i++) {
      var x = cand[i];
      if (x !== c && key(x) !== k && !optionClash(c, x, type) && !out.some(function (o) { return key(o) === key(x); })) out.push(x);
    }
    return out;
  }
  // One question: meaning (word → meaning), word (meaning → word), listen (sound → word) or gap (sentence → word).
  function makeQuestion(type, c, pool) {
    if (type === 'gap') {
      var g = clozeTarget(c);
      if (!g) type = 'meaning';
      else return { type: type, c: c, ex: g.ex, opts: g.options };
    }
    var key = type === 'meaning' ? function (x) { return shortText(mainMeaning(x)).toLowerCase(); } : function (x) { return x.zh; };
    return { type: type, c: c, opts: shuffled([c].concat(pickOthers(c, pool, 3, key, type))) };
  }
  function startQuiz(kind, lv) {
    var pool = quizPool(lv);
    if (pool.length < 8) return;
    quiz = { kind: kind, lv: lv, pool: pool, i: 0, right: 0, wrong: [], q: null, done: false, end: Date.now() + BLITZ_SECONDS * 1000, timer: null };
    if (kind === 'exam') {
      var picks = shuffled(pool).slice(0, EXAM_SIZE);
      var types = ['meaning', 'meaning', 'meaning', 'meaning', 'meaning', 'meaning', 'meaning', 'meaning', 'word', 'word', 'word', 'word',
        speechSupported ? 'listen' : 'meaning', speechSupported ? 'listen' : 'meaning', speechSupported ? 'listen' : 'word', speechSupported ? 'listen' : 'word',
        'gap', 'gap', 'gap', 'gap'];
      types = shuffled(types);
      quiz.list = picks.map(function (c, k) { return makeQuestion(types[k], c, pool); });
    } else if (!testing) {
      quiz.timer = setInterval(function () { if (Date.now() >= quiz.end) finishQuiz(); else drawQuizTop(); }, 250);
    }
    els.quizTitle.textContent = kind === 'exam' ? 'HSK ' + lv + ' exam' : '60-second blitz' + (lv === 'all' ? '' : ' · HSK ' + lv);
    nextQuestion();
    if (els.quizView.hidden) openOverlay(els.quizView, els.btnCloseQuiz);
  }
  function stopQuiz() {
    if (quiz && quiz.timer) clearInterval(quiz.timer);
    if (quiz) quiz.timer = null;
  }
  function nextQuestion() {
    if (quiz.kind === 'exam') {
      if (quiz.i >= quiz.list.length) { finishQuiz(); return; }
      quiz.q = quiz.list[quiz.i];
    } else {
      quiz.q = makeQuestion('meaning', quiz.pool[Math.floor(Math.random() * quiz.pool.length)], quiz.pool);
    }
    quiz.answered = false;
    drawQuestion();
  }
  function drawQuizTop() {
    var top = els.quizBody.querySelector('.qz-top');
    if (!top || !quiz) return;
    var left = Math.max(0, Math.ceil((quiz.end - Date.now()) / 1000));
    top.textContent = '';
    top.appendChild(el('span', 'qz-count', quiz.kind === 'exam' ? 'Question ' + (quiz.i + 1) + ' / ' + quiz.list.length : '⏱ ' + left + ' s'));
    top.appendChild(el('span', 'qz-score', quiz.right + ' right'));
    if (quiz.kind !== 'exam') {
      var bar = el('span', 'qz-time');
      var fill = el('span', 'qz-time-fill');
      fill.style.width = (left / BLITZ_SECONDS * 100) + '%';
      bar.appendChild(fill);
      top.appendChild(bar);
    }
  }
  function drawQuestion() {
    var q = quiz.q, b = els.quizBody;
    b.textContent = '';
    b.appendChild(el('div', 'qz-top'));
    drawQuizTop();
    var box = el('div', 'qz-q');
    if (q.type === 'meaning') {
      var zh = el('p', 'qz-zh', q.c.zh);
      zh.setAttribute('lang', 'zh-CN');
      box.appendChild(zh);
      var py = el('p', 'qz-py');
      renderPinyin(py, q.c.py);
      box.appendChild(py);
    } else if (q.type === 'word') {
      box.appendChild(el('p', 'qz-ask', 'Which word means'));
      box.appendChild(el('p', 'qz-en', shortText(mainMeaning(q.c))));
    } else if (q.type === 'listen') {
      box.appendChild(el('p', 'qz-ask', 'Which word do you hear?'));
      var lb = el('button', 'listen-btn qz-play', '🔊 Play');
      lb.type = 'button';
      box.appendChild(lb);
    } else {
      box.appendChild(el('p', 'qz-ask', 'Which word fills the gap?'));
      var at = q.ex.zh.indexOf(q.c.zh), gap = el('p', 'prompt-zh');
      gap.setAttribute('lang', 'zh-CN');
      gap.appendChild(document.createTextNode(q.ex.zh.slice(0, at)));
      var hole = el('span', 'gap');
      hole.style.width = (charLen(q.c.zh) * 1.1) + 'em';
      gap.appendChild(hole);
      gap.appendChild(document.createTextNode(q.ex.zh.slice(at + q.c.zh.length)));
      box.appendChild(gap);
      box.appendChild(el('p', 'prompt-sub', q.ex.en));
    }
    b.appendChild(box);
    var list = el('div', 'choices qz-choices');
    q.opts.forEach(function (o, k) {
      var btn = el('button', 'choice');
      btn.type = 'button';
      btn.setAttribute('data-ok', o === q.c ? '1' : '0');
      btn.setAttribute('data-k', String(k));
      btn.appendChild(el('span', 'choice-num', String(k + 1)));
      var tx = el('span', 'choice-text');
      if (q.type === 'meaning') {
        tx.appendChild(el('span', 'choice-en', shortText(mainMeaning(o))));
      } else {
        var oz = el('span', 'choice-zh', o.zh);
        oz.setAttribute('lang', 'zh-CN');
        tx.appendChild(oz);
        if (q.type !== 'listen') tx.appendChild(el('span', 'choice-pyl', o.py));
      }
      btn.appendChild(tx);
      list.appendChild(btn);
    });
    b.appendChild(list);
    if (q.type === 'listen' && !testing) setTimeout(function () { if (quiz && quiz.q === q) speakParts([q.c.zh], null); }, 250);
  }
  function quizPick(k) {
    if (!quiz || quiz.done || quiz.answered) return;
    var btns = els.quizBody.querySelectorAll('.qz-choices .choice'), b = btns[k];
    if (!b) return;
    quiz.answered = true;
    var ok = b.getAttribute('data-ok') === '1';
    Array.prototype.forEach.call(btns, function (x) { if (x.getAttribute('data-ok') === '1') x.classList.add('right'); x.disabled = true; });
    if (!ok) b.classList.add('wrong');
    if (ok) { quiz.right++; gainXp(quiz.kind === 'exam' ? 5 : 2); } else quiz.wrong.push(quiz.q.c);
    buzz(ok ? 10 : [25, 40, 25]);
    var go = function () { if (!quiz || quiz.done) return; quiz.i++; nextQuestion(); };
    if (testing) go(); else setTimeout(go, ok ? 350 : 1100);
  }
  function finishQuiz() {
    if (!quiz || quiz.done) return;
    stopQuiz();
    quiz.done = true;
    var b = els.quizBody, msg, pass = false;
    b.textContent = '';
    if (quiz.kind === 'exam') {
      var score = Math.round(quiz.right / quiz.list.length * 100);
      pass = score >= EXAM_PASS;
      var prev = state.exams[quiz.lv] || 0;
      state.exams[quiz.lv] = Math.max(prev, score);
      if (pass) gainXp(100);
      b.appendChild(el('p', 'qz-result' + (pass ? ' pass' : ''), score + '%'));
      msg = pass ? 'Passed! HSK ' + quiz.lv + ' exam: ' + quiz.right + ' of ' + quiz.list.length + ' right (+100 XP).'
        : quiz.right + ' of ' + quiz.list.length + ' right. You need ' + EXAM_PASS + '% to pass; review the words below and try again.';
    } else {
      var best = state.blitzBest[quiz.lv] || 0, record = quiz.right > best;
      if (record) state.blitzBest[quiz.lv] = quiz.right;
      b.appendChild(el('p', 'qz-result' + (record ? ' pass' : ''), String(quiz.right)));
      msg = record ? 'New personal best (was ' + best + ')!' : 'Personal best: ' + best + '.';
    }
    b.appendChild(el('p', 'qz-msg', msg));
    if (quiz.wrong.length) {
      b.appendChild(el('p', 'qz-ask', 'Missed:'));
      var w = el('div', 'rp-words');
      quiz.wrong.slice(0, 12).forEach(function (c) {
        var x = el('button', 'btn small rp-word', c.zh + ' ' + shortText(mainMeaning(c)));
        x.type = 'button';
        x.setAttribute('data-study', c.zh);
        w.appendChild(x);
      });
      b.appendChild(w);
    }
    var again = el('button', 'btn primary qz-again', 'Play again');
    again.type = 'button';
    b.appendChild(again);
    checkSeals();
    save();
    if (pass && !testing) confetti();
  }
  function challengeSection() {
    var sec = section('Challenges', 'Quick games that do not change your review schedule. They earn XP and seals.');
    var row = el('div', 'ch-row');
    var lv = state.level;
    var blitz = el('button', 'ch-btn', '');
    blitz.type = 'button';
    blitz.setAttribute('data-quiz', 'blitz');
    blitz.appendChild(el('span', 'ch-zh', '快'));
    blitz.appendChild(el('span', 'ch-name', '60-second blitz'));
    blitz.appendChild(el('span', 'ch-sub', (lv === 'all' ? 'All levels' : 'HSK ' + lv) + ' · best ' + (state.blitzBest[lv] || 0)));
    row.appendChild(blitz);
    LEVELS.forEach(function (l) {
      var ex = el('button', 'ch-btn' + ((state.exams[l] || 0) >= EXAM_PASS ? ' passed' : ''), '');
      ex.type = 'button';
      ex.setAttribute('data-quiz', 'exam');
      ex.setAttribute('data-lv', l);
      ex.appendChild(el('span', 'ch-zh', '考'));
      ex.appendChild(el('span', 'ch-name', 'HSK ' + l + ' exam'));
      ex.appendChild(el('span', 'ch-sub', state.exams[l] != null ? 'best ' + state.exams[l] + '%' + (state.exams[l] >= EXAM_PASS ? ' · passed' : '') : EXAM_SIZE + ' questions, pass at ' + EXAM_PASS + '%'));
      row.appendChild(ex);
    });
    sec.appendChild(row);
    return sec;
  }

  /* ---------- what's new ---------- */
  function latestNews() { return EXTRA.news[0] || null; }
  function fmtLongDate(k) { var p = k.split('-'); return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0]; }
  // A one-line notice after an update; first-time visitors start with it marked as seen.
  function renderNewsStrip() {
    var n = latestNews();
    els.newsStrip.hidden = !n || state.newsSeen === n.version;
    if (els.newsStrip.hidden) return;
    els.newsStripText.textContent = '';
    els.newsStripText.appendChild(el('b', null, 'What\u2019s new in ' + n.version + ': '));
    els.newsStripText.appendChild(document.createTextNode(n.title));
  }
  function markNewsSeen() {
    var n = latestNews();
    if (!n || state.newsSeen === n.version) return;
    state.newsSeen = n.version;
    renderNewsStrip();
    renderWotd();
    save();
  }
  function renderNews() {
    var body = els.newsBody;
    body.textContent = '';
    EXTRA.news.forEach(function (r, i) {
      var sec = el('section', 'news-release' + (i === 0 ? ' latest' : ''));
      var h = el('h3', 'news-head');
      h.appendChild(el('span', 'news-ver', r.version));
      h.appendChild(el('span', 'news-title', r.title));
      sec.appendChild(h);
      sec.appendChild(el('p', 'news-date', fmtLongDate(r.date)));
      r.groups.forEach(function (g) {
        if (g.name) sec.appendChild(el('h4', 'news-group', g.name));
        var ul = el('ul', 'news-list');
        g.items.forEach(function (t) { ul.appendChild(el('li', null, t)); });
        sec.appendChild(ul);
      });
      body.appendChild(sec);
    });
  }
  function openNews() {
    renderNews();
    closeOverlay(els.settingsView);
    openOverlay(els.newsView, els.btnCloseNews);
    markNewsSeen();
  }

  /* ---------- can-do ladder ---------- */
  // Real-life steps (greet people, order food...), each a small set of words. A step is reached when all its words are
  // Known in both reading and listening, in any order; reaching one stamps it and gives LADDER_XP.
  var LADDER_XP = 40;
  function ladderMaps() { return { read: marksOf('read').status, listen: marksOf('listen').status }; }
  // Which words of a step are still missing, and in which skill.
  function rungProgress(r, maps) {
    maps = maps || ladderMaps();
    var miss = [];
    r.words.forEach(function (zh) {
      var rd = maps.read[zh] === 'known', ls = maps.listen[zh] === 'known';
      if (!rd || !ls) miss.push({ zh: zh, read: rd, listen: ls });
    });
    return { miss: miss, done: r.words.length - miss.length, total: r.words.length };
  }
  function rungById(id) {
    for (var i = 0; i < EXTRA.ladder.length; i++) if (EXTRA.ladder[i].id === id) return EXTRA.ladder[i];
    return null;
  }
  // The step's can-do line in English, or in Hungarian when only Hungarian is switched on.
  function rungName(r) { return !state.langs.en && state.langs.hu ? r.hu : r.en; }
  function rungsReached() { return EXTRA.ladder.filter(function (r) { return state.rungs[r.id]; }).length; }
  // The first step, in ladder order, that is not reached yet.
  function nextRung() {
    for (var i = 0; i < EXTRA.ladder.length; i++) if (!state.rungs[EXTRA.ladder[i].id]) return EXTRA.ladder[i];
    return null;
  }
  // Marks every step whose words are now all known; returns the new ones. Several at once (say, after an import)
  // share one stamp.
  function checkRungs() {
    var maps = ladderMaps(), fresh = [];
    EXTRA.ladder.forEach(function (r) {
      if (state.rungs[r.id] || rungProgress(r, maps).miss.length) return;
      state.rungs[r.id] = dayKey();
      state.xp += LADDER_XP;
      fresh.push(r);
    });
    if (fresh.length && !testing) {
      stampSeal({ zh: '梯', text: fresh.length === 1 ? 'You can now: ' + rungName(fresh[0]) + ' (+' + LADDER_XP + ' XP)'
        : fresh.length + ' ladder steps reached (+' + fresh.length * LADDER_XP + ' XP)' });
      buzz([20, 40, 20]);
    }
    if (fresh.length) renderLadderStrip();
    return fresh;
  }
  // The main-screen strip: the next step and how many words it still needs. It waits while the what's-new notice or
  // the word of the day is showing, and ✕ hides it until tomorrow.
  function renderLadderStrip() {
    renderRail();
    var r = nextRung();
    els.ladderStrip.hidden = !r || state.ladderSeen === dayKey() || !els.newsStrip.hidden || !els.wotd.hidden;
    if (els.ladderStrip.hidden) return;
    var p = rungProgress(r);
    els.ladderZh.textContent = r.zh;
    els.ladderEn.textContent = rungName(r);
    // On narrow screens “9 words to go” shortens to “9 to go”.
    els.ladderLeft.textContent = String(p.miss.length);
    els.ladderLeft.appendChild(el('span', 'ladder-w', ' word' + (p.miss.length === 1 ? '' : 's')));
    els.ladderLeft.appendChild(document.createTextNode(' to go'));
    els.btnLadderOpen.setAttribute('aria-label', 'Next ladder step: ' + r.en + ', ' + p.miss.length + ' of ' + p.total + ' words to go. Open the ladder');
    els.btnLadderGo.setAttribute('data-rung', r.id);
  }
  function dismissLadder() { state.ladderSeen = dayKey(); renderLadderStrip(); save(); }
  // Studies a step's missing words as a deck of their own: reading first, then listening. Picking a study mode goes
  // back to the full deck.
  function practiseRung(id) {
    var r = rungById(id);
    if (!r) return;
    var miss = rungProgress(r).miss;
    if (!miss.length) return;
    var skill = miss.some(function (m) { return !m.read; }) ? 'read' : 'listen';
    var want = miss.filter(function (m) { return !m[skill]; }).map(function (m) { return m.zh; });
    OVERLAYS.forEach(function (o) { closeOverlay(els[o]); });
    stopSpeech();
    rememberDeck();
    useDeckType('words');
    if (skillOf(state.practice) !== skill) state.practice = skill === 'read' ? 'zh' : 'listen';
    useSkill(skill);
    var deckIdx = [];
    wordCards.forEach(function (c, i) { if (want.indexOf(c.zh) !== -1) deckIdx.push(i); });
    state.mode = 'all';
    state.deck = deckIdx;
    state.pos = 0;
    state.shuffled = false;
    state.revealed = state.autoReveal && state.practice === 'zh';
    undoStack = [];
    syncPracticeSelect();
    render(true);
    save();
    if (!testing) toast('Practising ' + deckIdx.length + ' word' + (deckIdx.length === 1 ? '' : 's') + ' for ' + r.zh + ' in ' + SKILLS[skill].toLowerCase() + '. Choose a study mode to go back to the full deck.', 5000);
  }
  function ladderSection() {
    var reached = rungsReached(), next = nextRung(), maps = ladderMaps();
    var sec = section('Ladder', 'Things you can do in Chinese. A step is reached when you know all its words in reading and listening (读 and 听); take them in any order. ' +
      reached + ' of ' + EXTRA.ladder.length + ' reached, ' + LADDER_XP + ' XP each.');
    var ol = el('ol', 'ladder');
    EXTRA.ladder.forEach(function (r, i) {
      var p = rungProgress(r, maps), on = !!state.rungs[r.id], isNext = r === next;
      var li = el('li', 'rung' + (on ? ' on' : isNext ? ' next' : ''));
      var head = el('div', 'rung-head');
      var mark = el('span', 'rung-seal', on ? '梯' : String(i + 1));
      mark.setAttribute('aria-hidden', 'true');
      if (on) mark.setAttribute('lang', 'zh-CN');
      head.appendChild(mark);
      var txt = el('div', 'rung-text');
      var zh = el('span', 'rung-zh', r.zh);
      zh.setAttribute('lang', 'zh-CN');
      txt.appendChild(zh);
      var py = el('span', 'rung-py', r.py);
      py.setAttribute('lang', 'zh-Latn-pinyin');
      txt.appendChild(py);
      txt.appendChild(el('span', 'rung-en', rungName(r)));
      head.appendChild(txt);
      head.appendChild(el('span', 'rung-count', on ? shortDate(state.rungs[r.id]) : p.done + '/' + p.total));
      li.appendChild(head);
      if (isNext) {
        var bar = el('span', 'pv-goalbar');
        var fill = el('span', 'pv-goalfill');
        fill.style.width = pct(p.done, p.total) + '%';
        bar.appendChild(fill);
        li.appendChild(bar);
        (r.sentences || []).slice(0, 2).forEach(function (s) {
          var line = el('p', 'rung-ex', s);
          line.setAttribute('lang', 'zh-CN');
          li.appendChild(line);
        });
        var words = el('div', 'rp-words');
        p.miss.forEach(function (m) {
          var b = el('button', 'btn small rung-word', '');
          b.type = 'button';
          b.setAttribute('data-study', m.zh);
          var w = el('span', null, m.zh);
          w.setAttribute('lang', 'zh-CN');
          b.appendChild(w);
          var need = el('span', 'rung-need', (m.read ? '' : '读') + (m.listen ? '' : '听'));
          need.setAttribute('lang', 'zh-CN');
          b.appendChild(need);
          b.setAttribute('aria-label', 'Study ' + m.zh + ', still to learn in ' + [m.read ? '' : 'reading', m.listen ? '' : 'listening'].filter(Boolean).join(' and '));
          words.appendChild(b);
        });
        li.appendChild(words);
      }
      if (!on) {
        var go = el('button', 'btn small rung-go' + (isNext ? ' primary' : ''), 'Practise');
        go.type = 'button';
        go.setAttribute('data-rung', r.id);
        go.setAttribute('aria-label', 'Practise the words for ' + r.en);
        (isNext ? li : head).appendChild(go);
      }
      ol.appendChild(li);
    });
    sec.appendChild(ol);
    return sec;
  }

  /* ---------- progress rail (wide screens) ---------- */
  // A narrow ladder beside the page: the XP rank on top, then the can-do steps climbing upward, step 1 at the bottom.
  // Reached steps are green, the next one fills as its words become known. CSS shows it only from 1200px.
  function renderRail() {
    els.progressRail.hidden = !EXTRA.ladder.length;
    if (els.progressRail.hidden) return;
    var r = rankOf(state.xp), next = RANKS[r + 1];
    els.railRankName.textContent = RANKS[r][1];
    els.railXp.style.width = (next ? pct(state.xp - RANKS[r][0], next[0] - RANKS[r][0]) : 100) + '%';
    els.railRank.setAttribute('aria-label', 'Rank: ' + RANKS[r][2] + ', ' + state.xp + ' XP' + (next ? ', ' + (next[0] - state.xp) + ' XP to ' + next[2] : '') + '. Open your stats');
    els.railRank.title = RANKS[r][1] + ' ' + RANKS[r][2] + ' · ' + state.xp.toLocaleString('en-US') + ' XP' + (next ? ' · ' + (next[0] - state.xp).toLocaleString('en-US') + ' to ' + next[1] : '');
    var maps = ladderMaps(), nr = nextRung(), box = els.railRungs;
    box.textContent = '';
    EXTRA.ladder.forEach(function (rg, i) {
      var p = rungProgress(rg, maps), on = !!state.rungs[rg.id];
      var bar = el('span', 'rail-rung' + (on ? ' on' : rg === nr ? ' next' : ''));
      if (rg === nr) { var f = el('span', 'rail-rung-fill'); f.style.width = pct(p.done, p.total) + '%'; bar.appendChild(f); }
      bar.title = (i + 1) + '. ' + rg.zh + ' · ' + rungName(rg) + ' · ' + (on ? 'reached' : p.done + '/' + p.total + ' words');
      box.appendChild(bar);
    });
    var reached = rungsReached();
    els.railCount.textContent = reached + '/' + EXTRA.ladder.length;
    els.railNext.textContent = nr ? nr.zh : '';
    els.railLadder.setAttribute('aria-label', 'Ladder: ' + reached + ' of ' + EXTRA.ladder.length + ' steps reached' + (nr ? ', next: ' + nr.en : '') + '. Open the ladder');
  }
