  /* ---------- levels, activity and the progress view ---------- */
  var LEVELS = ['1', '2', '3'];
  var GOALS = [10, 20, 30, 50, 100];
  function inLevel(c) { return (state.level === 'all' || String(c.lv) === state.level) && inTopic(c) && inPractice(c); }
  function countsFor(lv) {
    var k = 0, l = 0, t = 0;
    cards.forEach(function (c) {
      if (lv !== 'all' && String(c.lv) !== lv) return;
      if (!inTopic(c)) return;
      t++;
      var s = state.status[c.zh];
      if (s === 'known') k++;
      else if (s === 'learning') l++;
    });
    return { known: k, learning: l, unmarked: t - k - l, total: t };
  }
  function setLevel(lv) {
    if (lv !== 'all' && LEVELS.indexOf(lv) === -1) lv = 'all';
    state.level = lv;
    setMode(state.mode);
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function dayAnswers(k) { var a = state.activity[k]; return a ? (a.k || 0) + (a.l || 0) : 0; }
  function recordAnswer(kind, c, prev) {
    if (testing || (kind !== 'known' && kind !== 'learning')) return;
    if (c && state.status[c.zh] === 'known' && state.skill === 'read' && !state.learned[c.zh]) state.learned[c.zh] = dayKey();
    bumpCombo(kind);
    var earned = kind === 'known' ? 10 + Math.min(5, Math.floor(combo / 5)) : 3;
    gainXp(earned);
    floatXp(earned, kind);
    renderPet('munch');
    if (c) questEvent(kind, c, prev);
    var key = dayKey();
    var a = state.activity[key] || (state.activity[key] = { k: 0, l: 0 });
    var before = a.k + a.l;
    if (kind === 'known') a.k++; else a.l++;
    var keys = Object.keys(state.activity).sort();
    while (keys.length > 400) delete state.activity[keys.shift()];
  }
  // Consecutive days with at least one answer. Today still counts as open until midnight.
  function streak() {
    var d = new Date(), n = 0;
    if (!dayAnswers(dayKey(d))) d.setDate(d.getDate() - 1);
    while (dayActive(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function updateToday() {
    if (els.petMini) renderPet();
    var today = dayAnswers(dayKey()), s = streak();
    els.todayPill.textContent = '';
    els.todayPill.appendChild(el('b', null, today + '/' + state.goal));
    els.todayPill.appendChild(el('span', null, 'today'));
    els.todayPill.appendChild(el('span', 'streak', '🔥 ' + s));
    els.todayPill.classList.toggle('done', today >= state.goal);
    els.todayPill.setAttribute('aria-label', today + ' of ' + state.goal + ' cards answered today, ' + s + '-day streak. Open progress.');
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function section(title, sub) {
    var s = el('section', 'pv-section');
    var h = el('h3');
    h.appendChild(zhLabel(title, true));
    s.appendChild(h);
    if (sub) s.appendChild(el('p', 'pv-sub', sub));
    return s;
  }
  function legend() {
    var lg = el('div', 'pv-legend');
    [['known', 'Known'], ['learning', 'Learning'], ['unmarked', 'New']].forEach(function (p) {
      var item = el('span', 'pv-key');
      item.appendChild(el('span', 'pv-swatch s-' + p[0]));
      item.appendChild(el('span', null, p[1]));
      lg.appendChild(item);
    });
    return lg;
  }
  function ring(n) {
    var size = 132, r = 54, sw = 14, C = 2 * Math.PI * r;
    var svg = svgEl('svg', { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size, role: 'img',
      'aria-label': n.known + ' of ' + n.total + ' words known, ' + n.learning + ' learning' });
    var g = svgEl('g', { transform: 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')' });
    g.appendChild(svgEl('circle', { cx: size / 2, cy: size / 2, r: r, fill: 'none', 'class': 'ring-track', 'stroke-width': sw }));
    var offset = 0;
    [['known', n.known], ['learning', n.learning]].forEach(function (p) {
      if (!p[1] || !n.total) return;
      var len = C * p[1] / n.total;
      var shown = Math.max(len - (len > 4 ? 2 : 0), 0.5);
      var arc = svgEl('circle', { cx: size / 2, cy: size / 2, r: r, fill: 'none', 'class': 'ring-' + p[0], 'stroke-width': sw,
        'stroke-dasharray': shown + ' ' + (C - shown), 'stroke-dashoffset': String(-offset) });
      var t = svgEl('title', {});
      t.textContent = (p[0] === 'known' ? 'Known: ' : 'Learning: ') + p[1] + ' (' + pct(p[1], n.total) + '%)';
      arc.appendChild(t);
      g.appendChild(arc);
      offset += len;
    });
    svg.appendChild(g);
    var big = svgEl('text', { x: size / 2, y: size / 2 + 2, 'text-anchor': 'middle', 'class': 'ring-num' });
    big.textContent = pct(n.known, n.total) + '%';
    var small = svgEl('text', { x: size / 2, y: size / 2 + 22, 'text-anchor': 'middle', 'class': 'ring-label' });
    small.textContent = 'known';
    svg.appendChild(big);
    svg.appendChild(small);
    var wrap = el('div', 'pv-ring');
    wrap.appendChild(svg);
    return wrap;
  }
  function stackBar(n) {
    var bar = el('span', 'pv-bar');
    [['known', n.known, 'Known'], ['learning', n.learning, 'Learning'], ['unmarked', n.unmarked, 'New']].forEach(function (p) {
      if (!p[1]) return;
      var seg = el('span', 'pv-seg s-' + p[0]);
      seg.style.flexGrow = String(p[1]);
      seg.title = p[2] + ': ' + p[1] + ' (' + pct(p[1], n.total) + '%)';
      bar.appendChild(seg);
    });
    return bar;
  }

  function readingSection() {
    var sec = section('What you can read', 'Based on the words you know in reading practice.');
    var rd = readability(), cv = coverage();
    var big = el('div', 'rp-big');
    big.appendChild(el('span', 'rp-num', String(rd.n)));
    big.appendChild(el('span', 'rp-of', 'of ' + rd.total + ' example sentences you can read in full'));
    sec.appendChild(big);
    var bar = el('span', 'pv-goalbar rp-bar');
    var fill = el('span', 'pv-goalfill done');
    fill.style.width = pct(rd.n, rd.total) + '%';
    bar.appendChild(fill);
    sec.appendChild(bar);
    if (cv.has) {
      var cov = el('p', 'rp-line');
      cov.appendChild(el('b', null, fmtPct(cv.words)));
      cov.appendChild(document.createTextNode(' of the words in everyday Chinese text are words you know, and '));
      cov.appendChild(el('b', null, fmtPct(cv.chars)));
      cov.appendChild(document.createTextNode(' of its characters. All 598 words would give ' + fmtPct(cv.wordsMax) + ' and ' + fmtPct(cv.charsMax) + '.'));
      sec.appendChild(cov);
    }
    if (rd.next) {
      var nx = el('div', 'rp-next');
      var zh = el('p', 'rp-next-zh', rd.next.s.zh);
      zh.setAttribute('lang', 'zh-CN');
      nx.appendChild(el('p', 'rp-next-q', 'Closest sentence to unlock: learn ' + rd.next.miss.length + ' more word' + (rd.next.miss.length === 1 ? '' : 's')));
      nx.appendChild(zh);
      nx.appendChild(el('p', 'rp-next-en', rd.next.s.en));
      var btns = el('div', 'rp-words');
      rd.next.miss.forEach(function (w) {
        var b = el('button', 'btn small rp-word', 'Study ' + w.zh);
        b.type = 'button';
        b.setAttribute('data-study', w.zh);
        btns.appendChild(b);
      });
      nx.appendChild(btns);
      sec.appendChild(nx);
    }
    var nu = nextUsefulWord();
    if (nu) {
      var line = el('p', 'rp-line');
      line.appendChild(document.createTextNode('Most useful word you do not know yet: '));
      var b = el('button', 'linkish', nu.zh + ' ' + nu.py);
      b.type = 'button';
      b.setAttribute('data-study', nu.zh);
      line.appendChild(b);
      line.appendChild(document.createTextNode(' (' + shortText(mainMeaning(nu)) + ', the ' + nu.rk + ordinal(nu.rk) + ' most used word).'));
      sec.appendChild(line);
    }
    return sec;
  }
  function statsSection() {
    var sec = section('Your stats');
    var r = rankOf(state.xp), nextR = RANKS[r + 1];
    var rankRow = el('div', 'st-rank');
    var seal = el('span', 'st-seal', RANKS[r][1]);
    seal.setAttribute('lang', 'zh-CN');
    rankRow.appendChild(seal);
    var rt = el('div', 'st-rank-text');
    rt.appendChild(el('b', null, RANKS[r][2] + ' · ' + state.xp.toLocaleString('en-US') + ' XP'));
    var xbar = el('span', 'pv-goalbar');
    var xfill = el('span', 'pv-goalfill');
    xfill.style.width = (nextR ? pct(state.xp - RANKS[r][0], nextR[0] - RANKS[r][0]) : 100) + '%';
    xbar.appendChild(xfill);
    rt.appendChild(xbar);
    rt.appendChild(el('span', 'pv-tile-sub', nextR ? (nextR[0] - state.xp).toLocaleString('en-US') + ' XP to ' + nextR[1] + ' ' + nextR[2] : 'Top rank reached'));
    rankRow.appendChild(rt);
    sec.appendChild(rankRow);
    var keys = Object.keys(state.activity), k = 0, l = 0, days = 0, k7 = 0, l7 = 0, from7 = addDays(-6);
    keys.forEach(function (d) {
      var a = state.activity[d];
      k += a.k; l += a.l;
      if (a.k + a.l > 0) days++;
      if (d >= from7) { k7 += a.k; l7 += a.l; }
    });
    var hardest = null;
    Object.keys(state.misses).forEach(function (z) { if (!hardest || state.misses[z] > state.misses[hardest]) hardest = z; });
    var tiles = el('div', 'pv-tiles st-tiles');
    [['Answers', (k + l).toLocaleString('en-US'), 'all time'], ['Accuracy', k + l ? Math.round(k / (k + l) * 100) + '%' : '–', 'last 7 days: ' + (k7 + l7 ? Math.round(k7 / (k7 + l7) * 100) + '%' : '–')],
     ['Study days', days, 'longest streak ' + longestStreak()], ['Best combo', state.bestCombo, 'right in a row'],
     ['This week', learnedSince(7), 'new words known'], ['Per study day', days ? Math.round((k + l) / days) : 0, 'cards on average']].forEach(function (t) {
      var tile = el('div', 'pv-tile');
      tile.appendChild(el('span', 'pv-tile-label', t[0]));
      tile.appendChild(el('span', 'pv-tile-num', String(t[1])));
      tile.appendChild(el('span', 'pv-tile-sub', t[2]));
      tiles.appendChild(tile);
    });
    sec.appendChild(tiles);
    if (hardest) {
      var h = el('p', 'rp-line');
      h.appendChild(document.createTextNode('Toughest card so far: '));
      var hb = el('button', 'linkish', hardest);
      hb.type = 'button';
      hb.setAttribute('lang', 'zh-CN');
      if (getLexicon().map[hardest]) hb.setAttribute('data-study', hardest); else hb.disabled = true;
      h.appendChild(hb);
      h.appendChild(document.createTextNode(', missed ' + state.misses[hardest] + ' time' + (state.misses[hardest] === 1 ? '' : 's') + '.'));
      sec.appendChild(h);
    }
    return sec;
  }
  function topicSection() {
    var sec = section('By topic', 'Words known per topic. Tap one to study it.');
    var grid = el('div', 'tp-grid compact');
    EXTRA.topics.forEach(function (t) { grid.appendChild(topicTile(t, 'tp-tile')); });
    sec.appendChild(grid);
    return sec;
  }
  function renderProgress() {
    var body = els.pvBody;
    body.textContent = '';
    var all = countsFor('all');
    var today = dayAnswers(dayKey());
    var st = streak();

    var hero = el('div', 'pv-hero');
    hero.appendChild(ring(all));
    var tiles = el('div', 'pv-tiles');
    [['Known', all.known, 'of ' + all.total + ' ' + noun(all.total)], ['Learning', all.learning, 'to practise'],
     ['New', all.unmarked, 'not marked yet'], ['Due', dueCount('all'), 'to review today'], ['Streak', st, st === 1 ? 'day 🔥' : 'days 🔥'],
     ['Today', today, 'of ' + state.goal + ' goal']].forEach(function (t) {
      var tile = el('div', 'pv-tile');
      tile.appendChild(el('span', 'pv-tile-label', t[0]));
      tile.appendChild(el('span', 'pv-tile-num', String(t[1])));
      tile.appendChild(el('span', 'pv-tile-sub', t[2]));
      tiles.appendChild(tile);
    });
    hero.appendChild(tiles);
    setLabel(els.progressTitle, 'Your progress', true);
    els.progressTitle.appendChild(document.createTextNode(': ' + SKILLS[state.skill].toLowerCase()));
    // Tabs: what to do today, how far you are, the can-do ladder (when there is ladder data) and what you have collected.
    var panes = { today: el('div', 'pv-pane'), progress: el('div', 'pv-pane'), ladder: el('div', 'pv-pane'), collection: el('div', 'pv-pane') };
    var tabs = el('div', 'pv-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Progress sections');
    [['today', 'Today'], ['progress', 'Progress'], ['ladder', 'Ladder'], ['collection', 'Collection']].forEach(function (t) {
      if (t[0] === 'ladder' && !EXTRA.ladder.length) return;
      var b = el('button', 'pv-tab');
      b.appendChild(zhLabel(t[1]));
      b.type = 'button';
      b.setAttribute('data-pvtab', t[0]);
      tabs.appendChild(b);
      panes[t[0]].setAttribute('data-pane', t[0]);
    });
    body.appendChild(tabs);
    panes.today.appendChild(questSection());
    panes.progress.appendChild(hero);
    panes.progress.appendChild(legend());
    panes.progress.appendChild(el('p', 'pv-skills', 'Known ' + noun(2) + ' per skill: reading ' + knownIn('read') + ', recall ' + knownIn('recall') +
      ', listening ' + knownIn('listen') + '. The practice style you pick decides which one you are training.'));
    panes.progress.appendChild(readingSection());
    panes.collection.appendChild(statsSection());
    var visit = el('button', 'btn small pv-visit', '🐼 Visit ' + (state.petName || '宝宝'));
    visit.type = 'button';
    visit.setAttribute('data-pet', '1');
    panes.collection.appendChild(visit);
    panes.collection.appendChild(challengeSection());
    panes.collection.appendChild(sealSection());

    // Daily goal
    var goal = section('Daily goal');
    var gRow = el('div', 'pv-goal');
    var gBar = el('span', 'pv-goalbar');
    var gFill = el('span', 'pv-goalfill' + (today >= state.goal ? ' done' : ''));
    gFill.style.width = Math.min(100, pct(today, state.goal)) + '%';
    gBar.appendChild(gFill);
    gRow.appendChild(gBar);
    gRow.appendChild(el('span', 'pv-goaltext', today >= state.goal ? '✓ ' + today + ' / ' + state.goal + ' – goal reached!' : today + ' / ' + state.goal + ' cards today'));
    var gLabel = el('label', 'pv-goalpick', 'Goal ');
    var gSel = document.createElement('select');
    gSel.id = 'optGoal';
    GOALS.forEach(function (g) { var o = el('option', null, g + ' cards / day'); o.value = String(g); gSel.appendChild(o); });
    gSel.value = String(state.goal);
    gSel.addEventListener('change', function () { state.goal = parseInt(gSel.value, 10) || 20; save(); updateToday(); renderProgress(); });
    gLabel.appendChild(gSel);
    gRow.appendChild(gLabel);
    goal.appendChild(gRow);
    panes.today.appendChild(goal);

    // Coming reviews for the current skill and deck, so a heavy day is visible in advance.
    var fc = forecast(7), fcMax = Math.max.apply(null, fc.map(function (f) { return f.n; }).concat([1]));
    var fcSec = section('Coming reviews', SKILLS[state.skill] + ', next 7 days. Today includes anything overdue.');
    var fcList = el('ol', 'pv-fc');
    fc.forEach(function (f) {
      var li = el('li', 'pv-fc-day' + (f.n ? '' : ' none'));
      li.appendChild(el('span', 'pv-fc-num', String(f.n)));
      var bar = el('span', 'pv-fc-bar');
      bar.style.height = Math.max(f.n ? 6 : 2, Math.round(64 * f.n / fcMax)) + 'px';
      bar.setAttribute('aria-hidden', 'true');
      li.appendChild(bar);
      li.appendChild(el('span', 'pv-fc-label', f.label));
      li.setAttribute('aria-label', f.label + ': ' + f.n + ' ' + noun(f.n));
      fcList.appendChild(li);
    });
    fcSec.appendChild(fcList);
    panes.today.appendChild(fcSec);

    // By level
    var lvSec = section('By HSK level', 'Tap a level to study it.');
    LEVELS.forEach(function (lv) {
      var n = countsFor(lv);
      var row = el('button', 'pv-level' + (state.level === lv ? ' current' : ''));
      row.type = 'button';
      row.setAttribute('data-level', lv);
      row.setAttribute('aria-label', 'HSK ' + lv + ': ' + n.known + ' of ' + n.total + ' known, ' + n.learning + ' learning. Study this level.');
      row.appendChild(el('span', 'pv-lv-name', 'HSK ' + lv));
      row.appendChild(stackBar(n));
      row.appendChild(el('span', 'pv-lv-pct', pct(n.known, n.total) + '%'));
      row.appendChild(el('span', 'pv-lv-text', n.known + ' known · ' + n.learning + ' learning · ' + n.unmarked + ' new · ' + n.total + ' ' + noun(n.total)));
      lvSec.appendChild(row);
    });
    panes.progress.appendChild(lvSec);
    if (EXTRA.topics.length) panes.progress.appendChild(topicSection());

    // Activity, last 14 days
    var days = [];
    for (var i = 13; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var key = dayKey(d), a = state.activity[key] || { k: 0, l: 0 };
      days.push({ d: d, key: key, k: a.k || 0, l: a.l || 0 });
    }
    var total14 = days.reduce(function (s, x) { return s + x.k + x.l; }, 0);
    var actSec = section('Last 14 days', total14 ? total14 + ' cards answered · dashed line = daily goal' : 'No answers yet – your daily bars will appear here.');
    var max = Math.max(state.goal, days.reduce(function (m, x) { return Math.max(m, x.k + x.l); }, 0));
    var chart = el('div', 'pv-chart');
    var plot = el('div', 'pv-plot');
    var goalLine = el('span', 'pv-goalline');
    goalLine.style.bottom = (state.goal / max * 100) + '%';
    goalLine.title = 'Daily goal: ' + state.goal;
    plot.appendChild(goalLine);
    var WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    days.forEach(function (x, idx) {
      var col = el('div', 'pv-col' + (idx === days.length - 1 ? ' today' : ''));
      col.title = x.d.toDateString() + ': ' + (x.k + x.l) + ' answered (' + x.k + ' known, ' + x.l + ' learning)';
      var stack = el('div', 'pv-stack');
      if (x.l) { var sl = el('span', 'pv-seg s-learning'); sl.style.height = (x.l / max * 100) + '%'; stack.appendChild(sl); }
      if (x.k) { var sk = el('span', 'pv-seg s-known'); sk.style.height = (x.k / max * 100) + '%'; stack.appendChild(sk); }
      col.appendChild(stack);
      plot.appendChild(col);
    });
    chart.appendChild(plot);
    var axis = el('div', 'pv-axis');
    days.forEach(function (x, idx) {
      axis.appendChild(el('span', null, idx === days.length - 1 ? 'Today' : (idx % 2 === 1 ? WEEK[x.d.getDay()] : String(x.d.getDate()))));
    });
    chart.appendChild(axis);
    actSec.appendChild(chart);
    var det = document.createElement('details');
    det.className = 'pv-table';
    det.appendChild(el('summary', null, 'Show as table'));
    var tbl = document.createElement('table');
    var hr = document.createElement('tr');
    ['Day', 'Known', 'Learning', 'Total'].forEach(function (h) { hr.appendChild(el('th', null, h)); });
    tbl.appendChild(hr);
    days.slice().reverse().forEach(function (x) {
      var tr = document.createElement('tr');
      [x.d.toDateString(), x.k, x.l, x.k + x.l].forEach(function (v) { tr.appendChild(el('td', null, String(v))); });
      tbl.appendChild(tr);
    });
    det.appendChild(tbl);
    actSec.appendChild(det);
    panes.today.appendChild(actSec);

    // Word map
    var mapSec = section(deck().mapTitle, 'Each square is one ' + noun(1) + '. Hover or tap to see it, tap again to study it.');
    var info = el('p', 'pv-info', 'Pick a square to see the word.');
    LEVELS.forEach(function (lv) {
      var n = countsFor(lv);
      mapSec.appendChild(el('h4', 'pv-maphead', 'HSK ' + lv + ' · ' + n.known + ' / ' + n.total + ' known'));
      var grid = el('div', 'pv-grid');
      cards.forEach(function (c, i) {
        if (String(c.lv) !== lv) return;
        var s = statusOf(c);
        var cell = el('button', 'pv-cell s-' + s);
        cell.type = 'button';
        cell.tabIndex = -1;
        cell.setAttribute('data-index', String(i));
        cell.setAttribute('aria-label', c.zh + ' ' + c.py + ', ' + STATUS_NAMES[s]);
        grid.appendChild(cell);
      });
      mapSec.appendChild(grid);
    });
    mapSec.appendChild(info);
    var showInfo = function (cell) {
      var c = cards[Number(cell.getAttribute('data-index'))];
      info.textContent = c.zh + ' · ' + c.py + ' · ' + c.en + ' · ' + STATUS_NAMES[statusOf(c)] + ' · HSK ' + c.lv;
      var prev = mapSec.querySelector('.pv-cell.picked');
      if (prev) prev.classList.remove('picked');
      cell.classList.add('picked');
    };
    var lastPointer = 'mouse';
    mapSec.addEventListener('pointerdown', function (e) { lastPointer = e.pointerType || 'mouse'; });
    mapSec.addEventListener('mouseover', function (e) {
      if (lastPointer === 'touch') return;
      var cell = e.target.closest ? e.target.closest('.pv-cell') : null;
      if (cell) showInfo(cell);
    });
    mapSec.addEventListener('click', function (e) {
      var cell = e.target.closest ? e.target.closest('.pv-cell') : null;
      if (!cell) return;
      // On touch the first tap shows the word, the second tap studies it.
      if (!cell.classList.contains('picked')) { showInfo(cell); return; }
      closeOverlay(els.progressView);
      studyCard(Number(cell.getAttribute('data-index')));
    });
    panes.progress.appendChild(mapSec);
    body.appendChild(panes.today);
    body.appendChild(panes.progress);
    if (EXTRA.ladder.length) { panes.ladder.appendChild(ladderSection()); body.appendChild(panes.ladder); }
    body.appendChild(panes.collection);
    showPvTab(pvTab === 'ladder' && !EXTRA.ladder.length ? 'today' : pvTab);
  }
  var pvTab = 'today';
  function showPvTab(t) {
    pvTab = t;
    Array.prototype.forEach.call(els.pvBody.querySelectorAll('[data-pane]'), function (p) { p.hidden = p.getAttribute('data-pane') !== t; });
    Array.prototype.forEach.call(els.pvBody.querySelectorAll('[data-pvtab]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-pvtab') === t ? 'true' : 'false'); });
  }
  function openProgress(tab) {
    if (typeof tab === 'string') pvTab = tab;
    renderProgress();
    openOverlay(els.progressView, els.btnCloseProgress);
  }

