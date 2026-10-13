  /* ---------- levels, activity and the progress view ---------- */
  var LEVELS = Object.keys(EXPECTED_LEVELS).sort();
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
    if (isRehearseAnswer()) a.r = (a.r || 0) + 1;
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
      cov.appendChild(document.createTextNode(' of its characters. All ' + wordCards.length + ' words would give ' + fmtPct(cv.wordsMax) + ' and ' + fmtPct(cv.charsMax) + '.'));
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
  /* ---------- review calendar ---------- */
  // A month at a time: days before today are shaded by how much you studied (goal met, studied, a streak freeze);
  // today and later days show how many reviews fall due in all skills, words and sentences (today also counts
  // overdue ones), so you can plan a day off. Picking a day (tap, or arrow keys) shows its numbers below.
  var calMonth = null, calPick = null;
  function dueByDay() {
    var today = dayKey(), out = {};
    Object.keys(SKILLS).forEach(function (k) {
      var srs = marksOf(k).srs;
      Object.keys(srs).forEach(function (zh) {
        var d = srs[zh].d < today ? today : srs[zh].d, o = out[d] || (out[d] = { n: 0 });
        o.n++;
        o[k] = (o[k] || 0) + 1;
      });
    });
    return out;
  }
  function calDate(key) { return new Date(key + 'T12:00:00'); }
  function calDayText(key, due) {
    var today = dayKey(), a = state.activity[key], n = dayAnswers(key), parts = [];
    if (key <= today) {
      parts.push(n ? n + ' answered (' + a.k + ' known, ' + a.l + ' learning)' + (n >= state.goal ? ', goal met' : '')
        : state.frozen.indexOf(key) !== -1 ? 'a streak freeze kept your streak' : key === today ? 'nothing answered yet' : 'no study');
    }
    if (key >= today) {
      var d = due[key];
      parts.push(d ? d.n + ' review' + (d.n === 1 ? '' : 's') + ' due (' + Object.keys(SKILLS).filter(function (k) { return d[k]; })
        .map(function (k) { return SKILLS[k].toLowerCase() + ' ' + d[k]; }).join(', ') + ')' : 'no reviews due');
    }
    var name = key === today ? 'Today' : calDate(key).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return name + ': ' + parts.join('; ') + '.';
  }
  function calendarSection() {
    var sec = section('Calendar', 'Past days show what you studied, later days the reviews that fall due, in all skills. Today includes anything overdue.');
    var box = el('div', 'cal-box');
    sec.appendChild(box);
    var draw = function (focus) {
      var today = dayKey(), due = dueByDay();
      var first = Object.keys(state.activity).concat(state.frozen).sort()[0] || today;
      var last = Object.keys(due).sort().pop() || today, cap = addDays(365);
      var minM = (first < today ? first : today).slice(0, 7), maxM = (last > cap ? cap : last > today ? last : today).slice(0, 7);
      if (!calMonth || calMonth < minM || calMonth > maxM) calMonth = today.slice(0, 7);
      if (!calPick || calPick.slice(0, 7) !== calMonth) calPick = calMonth === today.slice(0, 7) ? today : calMonth + '-01';
      box.textContent = '';
      var start = calDate(calMonth + '-01');
      var head = el('div', 'cal-head');
      var move = function (dir, label, ok) {
        var b = el('button', 'icon-btn small cal-move', dir < 0 ? '‹' : '›');
        b.type = 'button';
        b.setAttribute('data-calmove', String(dir));
        b.setAttribute('aria-label', label);
        b.disabled = !ok;
        return b;
      };
      head.appendChild(move(-1, 'Previous month', calMonth > minM));
      head.appendChild(el('span', 'cal-month', start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })));
      head.appendChild(move(1, 'Next month', calMonth < maxM));
      box.appendChild(head);
      var tbl = el('table', 'cal');
      var hr = el('tr');
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (w) { var th = el('th', null, w.slice(0, 2)); th.setAttribute('abbr', w); th.scope = 'col'; hr.appendChild(th); });
      var thead = el('thead');
      thead.appendChild(hr);
      tbl.appendChild(thead);
      var body = el('tbody'), row = el('tr'), studied = 0, answered = 0, coming = 0;
      for (var i = 0; i < (start.getDay() + 6) % 7; i++) row.appendChild(el('td'));
      for (var d = new Date(start); dayKey(d).slice(0, 7) === calMonth; d.setDate(d.getDate() + 1)) {
        var key = dayKey(d), n = dayAnswers(key), dn = key >= today && due[key] ? due[key].n : 0;
        if (key <= today && n) { studied++; answered += n; }
        coming += dn;
        var b = el('button', 'cal-day' + (key > today ? ' future' : n >= state.goal ? ' goal' : n ? ' some' : state.frozen.indexOf(key) !== -1 ? ' frozen' : '') + (key === today ? ' today' : ''));
        b.type = 'button';
        b.setAttribute('data-day', key);
        b.setAttribute('aria-pressed', key === calPick ? 'true' : 'false');
        b.setAttribute('aria-label', calDayText(key, due));
        b.tabIndex = key === calPick ? 0 : -1;
        if (key === today) b.setAttribute('aria-current', 'date');
        b.appendChild(el('span', 'cal-n', String(d.getDate())));
        if (dn) b.appendChild(el('span', 'cal-due', String(dn)));
        var td = el('td');
        td.appendChild(b);
        row.appendChild(td);
        if (row.children.length === 7) { body.appendChild(row); row = el('tr'); }
      }
      if (row.children.length) { while (row.children.length < 7) row.appendChild(el('td')); body.appendChild(row); }
      tbl.appendChild(body);
      box.appendChild(tbl);
      var info = el('p', 'cal-info', calDayText(calPick, due));
      info.setAttribute('role', 'status');
      box.appendChild(info);
      var sum = [];
      if (calMonth <= today.slice(0, 7)) sum.push(studied + ' study day' + (studied === 1 ? '' : 's') + ', ' + answered.toLocaleString('en-US') + ' answers');
      if (calMonth >= today.slice(0, 7)) sum.push(coming.toLocaleString('en-US') + ' review' + (coming === 1 ? '' : 's') + ' due' + (calMonth === today.slice(0, 7) ? ' from today' : ''));
      box.appendChild(el('p', 'cal-sum', 'This month: ' + sum.join('; ') + '.'));
      var lg = el('div', 'pv-legend cal-legend');
      [['goal', 'Goal met'], ['some', 'Studied'], ['frozen', 'Streak freeze'], ['due', 'Reviews due']].forEach(function (p) {
        var item = el('span', 'pv-key');
        item.appendChild(el('span', 'cal-swatch ' + p[0], p[0] === 'due' ? '3' : ''));
        item.appendChild(el('span', null, p[1]));
        lg.appendChild(item);
      });
      box.appendChild(lg);
      if (focus) {
        var f = focus === 'day' ? null : box.querySelector('[data-calmove="' + focus + '"]');
        (f && !f.disabled ? f : box.querySelector('[data-day][tabindex="0"]')).focus();
      }
    };
    box.addEventListener('click', function (e) {
      var m = e.target.closest ? e.target.closest('[data-calmove]') : null;
      if (m) {
        var s = calDate(calMonth + '-01');
        s.setMonth(s.getMonth() + Number(m.getAttribute('data-calmove')));
        calMonth = dayKey(s).slice(0, 7);
        calPick = null;
        draw(m.getAttribute('data-calmove'));
        return;
      }
      var b = e.target.closest ? e.target.closest('[data-day]') : null;
      if (!b) return;
      calPick = b.getAttribute('data-day');
      draw('day');
    });
    // Arrow keys move the picked day (a week up or down), into the next or previous month when needed.
    box.addEventListener('keydown', function (e) {
      var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (!step || !e.target.closest('[data-day]')) return;
      e.preventDefault();
      var d = calDate(calPick);
      d.setDate(d.getDate() + step);
      var key = dayKey(d), was = calMonth, wasPick = calPick;
      calMonth = key.slice(0, 7);
      calPick = key;
      draw('day');
      // Past the first or last month draw() resets the month; stay on the edge instead.
      if (calMonth !== key.slice(0, 7)) { calMonth = was; calPick = wasPick; draw('day'); }
    });
    draw();
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
    // Tabs: what to do today, how far you are, the review calendar, the can-do ladder (when there is ladder data) and what you have collected.
    var panes = { today: el('div', 'pv-pane'), progress: el('div', 'pv-pane'), calendar: el('div', 'pv-pane'), ladder: el('div', 'pv-pane'), collection: el('div', 'pv-pane') };
    var tabs = el('div', 'pv-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Progress sections');
    [['today', 'Today'], ['progress', 'Progress'], ['calendar', 'Calendar'], ['ladder', 'Ladder'], ['collection', 'Collection']].forEach(function (t) {
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
    var rhLine = langsRehearsed().map(function (k) {
      var pool = rehearsePool(k), st = marksOf(rehearseSkill(k)), kn = 0, le = 0, today = dayKey(), due = 0;
      pool.forEach(function (c) {
        if (st.status[c.zh] === 'known') kn++; else if (st.status[c.zh] === 'learning') le++;
        if (st.srs[c.zh] && st.srs[c.zh].d <= today) due++;
      });
      return ' ' + langName(k) + ': ' + kn + ' known, ' + le + ' learning, ' + (pool.length - kn - le) + ' new, ' + due + ' due.';
    }).join('');
    panes.progress.appendChild(el('p', 'pv-skills', 'Known ' + noun(2) + ' per skill: reading ' + knownIn('read') + ', recall ' + knownIn('recall') +
      ', listening ' + knownIn('listen') + '. The practice style you pick decides which one you are training.' + rhLine));
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
      row.setAttribute('aria-label', lvName(lv) + ': ' + n.known + ' of ' + n.total + ' known, ' + n.learning + ' learning. Study this level.');
      row.appendChild(el('span', 'pv-lv-name', lvName(lv)));
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
      mapSec.appendChild(el('h4', 'pv-maphead', lvName(lv) + ' · ' + n.known + ' / ' + n.total + ' known'));
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
      info.textContent = c.zh + ' · ' + c.py + ' · ' + c.en + ' · ' + STATUS_NAMES[statusOf(c)] + ' · ' + lvName(c.lv);
      var prev = mapSec.querySelector('.pv-cell.picked');
      if (prev) prev.classList.remove('picked');
      cell.classList.add('picked');
      // A small label right above the square, so the word shows where you point (the line below keeps the details).
      tip.textContent = c.zh + ' ' + c.py;
      tip.style.left = (cell.offsetLeft + cell.offsetWidth / 2) + 'px';
      tip.style.top = cell.offsetTop + 'px';
      tip.hidden = false;
    };
    var tip = el('span', 'pv-tip');
    tip.setAttribute('aria-hidden', 'true');
    tip.hidden = true;
    mapSec.appendChild(tip);
    mapSec.addEventListener('mouseleave', function () { tip.hidden = true; });
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
    panes.calendar.appendChild(calendarSection());
    body.appendChild(panes.calendar);
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

