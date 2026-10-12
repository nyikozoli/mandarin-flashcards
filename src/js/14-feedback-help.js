  /* ---------- feedback: vibration, confetti, milestones, session summary ---------- */
  function buzz(pattern) {
    if (!state.vibrate || testing || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  }
  function confetti() {
    if (reduceMotion || testing) return;
    var cv = document.createElement('canvas');
    cv.className = 'confetti';
    cv.setAttribute('aria-hidden', 'true');
    var w = cv.width = window.innerWidth, h = cv.height = window.innerHeight;
    document.body.appendChild(cv);
    var ctx = cv.getContext('2d');
    var colors = ['#4fd1a1', '#f0b03f', '#e04a2f', '#6cb4ff', '#f1ece2'];
    var bits = [];
    for (var i = 0; i < 140; i++) {
      bits.push({ x: w / 2 + (Math.random() - 0.5) * w * 0.3, y: h * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 4,
        s: 4 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length] });
    }
    var t0 = performance.now();
    var frame = function (t) {
      var age = t - t0;
      ctx.clearRect(0, 0, w, h);
      bits.forEach(function (b) {
        b.vy += 0.35; b.x += b.vx; b.y += b.vy; b.r += b.vr; b.vx *= 0.99;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r);
        ctx.globalAlpha = Math.max(0, 1 - age / 1800);
        ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 2, b.s, b.s * 0.6);
        ctx.restore();
      });
      if (age < 1800) requestAnimationFrame(frame); else cv.remove();
    };
    requestAnimationFrame(frame);
  }
  function celebrate(id, msg) {
    if (testing || state.milestones.indexOf(id) !== -1) return false;
    state.milestones.push(id);
    toast(msg, 5000);
    confetti();
    buzz([20, 40, 20]);
    return true;
  }
  var KNOWN_STEPS = [10, 25, 50, 100, 150, 200, 300, 400, 500, 598];
  var STREAK_STEPS = [3, 7, 14, 30, 60, 100, 365];
  function checkMilestones() {
    var today = dayAnswers(dayKey());
    if (today >= state.goal) celebrate('goal-' + dayKey(), '🎯 Daily goal reached: ' + state.goal + ' cards today!');
    var st = streak();
    STREAK_STEPS.forEach(function (n) { if (st >= n) celebrate('streak-' + n + '-' + addDays(1 - st), '🔥 ' + n + '-day streak! Keep it going.'); });
    var known = countsFor('all').known;
    // Reading keeps the original milestone ids; the other skills get their own.
    var sk = state.skill === 'read' ? '' : state.skill + '-', by = sk ? ' (' + SKILLS[state.skill].toLowerCase() + ')' : '';
    KNOWN_STEPS.forEach(function (n) { if (known >= n) celebrate(deck().milestone + sk + 'known-' + n, '🏆 ' + n + ' ' + noun(n) + ' known' + by + '!'); });
    LEVELS.forEach(function (lv) {
      var c = countsFor(lv);
      if (c.total && c.known === c.total) celebrate(deck().milestone + sk + 'level-' + lv, '🎓 HSK ' + lv + ' complete' + by + ': you know all ' + c.total + ' ' + noun(c.total) + '!');
    });
  }
  var session = { n: 0, k: 0, l: 0, xp: 0, t0: Date.now() };
  function afterAnswer(kind) {
    if (testing || kind === 'skip') return;
    checkSeals();
    checkRungs();
    session.n++;
    if (kind === 'known') session.k++; else session.l++;
    checkMilestones();
    if (session.n >= 20 && currentIndex() !== null) showSummary();
  }
  function showSummary() {
    var b = els.summaryBody;
    b.textContent = '';
    var mins = Math.max(1, Math.round((Date.now() - session.t0) / 60000));
    var today = dayAnswers(dayKey());
    b.appendChild(el('p', 'sum-big', session.n + ' cards in ' + mins + ' min'));
    var row = el('div', 'sum-tiles');
    [['Knew', session.k, 's-known'], ['To review', session.l, 's-learning'], ['Accuracy', Math.round(session.k / session.n * 100) + '%', ''],
     ['Due now', dueCount(state.level), '']].forEach(function (t) {
      var tile = el('div', 'pv-tile');
      var lab = el('span', 'pv-tile-label');
      if (t[2]) lab.appendChild(el('span', 'pv-swatch ' + t[2]));
      lab.appendChild(document.createTextNode(' ' + t[0]));
      tile.appendChild(lab);
      tile.appendChild(el('span', 'pv-tile-num', String(t[1])));
      row.appendChild(tile);
    });
    b.appendChild(row);
    var rd = readability(), rk = RANKS[rankOf(state.xp)];
    b.appendChild(el('p', 'sum-line', '+' + session.xp + ' XP · ' + rk[1] + ' ' + rk[2] + ' · you can read ' + rd.n + ' of ' + rd.total + ' sentences'));
    b.appendChild(el('p', 'sum-line', today >= state.goal ? '🎯 Daily goal done (' + today + '/' + state.goal + ') · 🔥 ' + streak() + '-day streak'
      : '🎯 ' + today + ' / ' + state.goal + ' today – ' + (state.goal - today) + ' more to reach your goal · 🔥 ' + streak() + '-day streak'));
    session = { n: 0, k: 0, l: 0, xp: 0, t0: Date.now() };
    openOverlay(els.summaryView, els.btnSummaryClose);
  }

  /* ---------- help and first-visit tour ---------- */
  var TOUR = [
    { art: 'seal', title: 'Welcome to Mandarin HSK', text: '598 words from HSK 1 to 3, with pinyin, English, Hungarian and example sentences. Here is how to use it in four quick steps.' },
    { art: 'swipe', title: 'Know it? Swipe right', text: 'Swipe right or press “I know it” when you know a word. Swipe left or press “Still learning” when you don’t. Tap the card to see the meaning and examples.' },
    { art: 'speak', title: 'Listen to every word', text: 'Read aloud speaks the word and its example sentences. Colours show the tones: 1st red, 2nd orange, 3rd green, 4th blue.' },
    { art: 'due', title: 'Review at the right time', text: '“Due” brings back the words you know after 1, 3, 7, 14, 30, 60 and 120 days, and the ones you missed the same day. The practice style button above the modes switches to Listening, Multiple choice, Which tone? and the 777 example sentences.' },
    { art: 'goal', title: 'Keep a streak', text: 'Answer your daily goal of cards to grow your streak. The chart button shows your progress per level. The ? button brings back this help any time.' }
  ];
  var tourStep = 0;
  function tourArt(kind) {
    var a = els.tourArt;
    a.textContent = '';
    if (kind === 'seal') { var s = el('span', 'tour-seal', '学'); s.setAttribute('lang', 'zh-CN'); a.appendChild(s); }
    else if (kind === 'swipe') {
      var l = el('span', 'tour-chip learn', '← 学');
      var cell = el('span', 'tour-cell', '我');
      cell.setAttribute('lang', 'zh-CN');
      var k = el('span', 'tour-chip know', '会 →');
      a.appendChild(l); a.appendChild(cell); a.appendChild(k);
    } else if (kind === 'speak') {
      ['mā', 'má', 'mǎ', 'mà'].forEach(function (t, i) { a.appendChild(el('span', 'tour-tone t' + (i + 1), t)); });
    } else if (kind === 'due') {
      [1, 3, 7, 14, 30].forEach(function (d) { a.appendChild(el('span', 'tour-day', d + 'd')); });
    } else if (kind === 'goal') {
      a.appendChild(el('span', 'tour-goal', '🔥 ' + Math.max(1, streak())));
    }
  }
  function showTourStep() {
    var st = TOUR[tourStep];
    tourArt(st.art);
    els.tourTitle.textContent = st.title;
    els.tourText.textContent = st.text;
    els.tourDots.textContent = '';
    TOUR.forEach(function (x, i) { els.tourDots.appendChild(el('span', i === tourStep ? 'on' : '')); });
    els.btnTourBack.hidden = tourStep === 0;
    els.btnTourSkip.hidden = tourStep === TOUR.length - 1;
    els.btnTourNext.textContent = tourStep === TOUR.length - 1 ? 'Start learning' : 'Next';
  }
  function openTour() {
    tourStep = 0;
    showTourStep();
    openOverlay(els.tourView, els.btnTourNext);
  }
  function closeTour() {
    state.seenTour = true;
    save();
    closeOverlay(els.tourView);
  }

