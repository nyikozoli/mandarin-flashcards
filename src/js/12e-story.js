  /* ---------- the story: one episode a day ---------- */
  // data/stories.json is a story in episodes, written with the app's words (EXTRA.story, empty without the file:
  // then the strip stays hidden and nothing here shows). Episode 1 is open from the start; every day the daily
  // goal is reached opens the next one, at most one a day, in order, and an open episode stays open.
  // state.story is { unlocked, days: { id: day it opened }, read: { id: day first read }, seen, py }: `seen` is the day
  // ✕ put the strip away, `py` the reader's pinyin switch (null: follow the practice settings). It is part of the
  // snapshot, so it is exported and synced. The reader (#storyView) is drawn by renderStory(); it never redraws the
  // card behind it.
  var STORY_XP = 20;
  // One text of the story file (a line, a title, a recap, a name) in the shape of a card: en, hu and tr.
  function storyText(o) {
    o = o && typeof o === 'object' ? o : {};
    var out = { zh: str(o.zh), py: str(o.py), en: str(o.en), hu: str(o.hu), tr: trOf(o) };
    if (str(o.who)) out.who = str(o.who);
    return out;
  }
  function readStory(d) {
    var out = { names: [], extra: [], episodes: [] };
    if (!d || typeof d !== 'object' || !Array.isArray(d.episodes)) return out;
    ['names', 'extra'].forEach(function (kind) {
      (Array.isArray(d[kind]) ? d[kind] : []).forEach(function (n) {
        var w = storyText(n);
        if (!w.zh || !w.py) return;
        w.lv = 0; w.kind = kind; w.ex = [];
        out[kind].push(w);
      });
    });
    d.episodes.forEach(function (e) {
      var lines = e && Array.isArray(e.lines) ? e.lines.map(storyText).filter(function (l) { return l.zh; }) : [];
      if (lines.length) out.episodes.push({ id: out.episodes.length + 1, level: parseInt(e.level, 10) || 0, title: storyText(e.title), recap: storyText(e.recap), lines: lines });
    });
    return out;
  }
  // The saved field. The count is kept as saved even when this copy has fewer episodes (or no story at all), so
  // nothing is lost on the way through an older or smaller build; storyAvailable() is what can be opened here.
  function readStoryState(src) {
    var out = { unlocked: 1, days: {}, read: {}, seen: '', py: null };
    if (!src || typeof src !== 'object') return out;
    var isDay = function (d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d); };
    out.unlocked = clampInt(src.unlocked, 1, 9999);
    ['days', 'read'].forEach(function (f) {
      var m = src[f];
      if (m && typeof m === 'object') Object.keys(m).forEach(function (k) { if (/^[1-9]\d{0,3}$/.test(k) && isDay(m[k])) out[f][k] = m[k]; });
    });
    if (isDay(src.seen)) out.seen = src.seen;
    if (typeof src.py === 'boolean') out.py = src.py;
    return out;
  }
  function storyEpisodes() { return EXTRA.story.episodes; }
  function storyEpisode(id) { return storyEpisodes()[id - 1] || null; }
  // How many episodes can be opened here: 0 without story data.
  function storyAvailable() { return Math.min(state.story.unlocked, storyEpisodes().length); }
  function storyUnlockedToday() {
    var t = dayKey(), d = state.story.days;
    return Object.keys(d).some(function (k) { return d[k] === t; });
  }
  // Opens the next episode when today's goal is reached and none was opened today. Returns the episode, or null.
  function checkStoryUnlock() {
    var total = storyEpisodes().length;
    if (!total || state.story.unlocked >= total) return null;
    if (dayAnswers(dayKey()) < state.goal || storyUnlockedToday()) return null;
    state.story.unlocked++;
    state.story.days[state.story.unlocked] = dayKey();
    return storyEpisode(state.story.unlocked);
  }
  // The newest episode when it opened today and has not been read: what the goal's dialogs offer.
  function storyFreshToday() {
    var n = storyAvailable();
    return n > 0 && !state.story.read[n] && state.story.days[n] === dayKey() ? n : 0;
  }
  // Where the story stands: 'new' (the newest open episode is unread), 'wait' (the next one opens at today's goal),
  // 'tomorrow' (one opened today already) or 'done' (all open). `urgent` puts the strip first, until ✕.
  function storyHook() {
    var total = storyEpisodes().length;
    if (!total) return null;
    var avail = storyAvailable(), next = avail < total ? avail + 1 : 0;
    var kind = !state.story.read[avail] ? 'new' : !next ? 'done' : storyUnlockedToday() ? 'tomorrow' : 'wait';
    return { kind: kind, avail: avail, next: next, total: total, urgent: (kind === 'new' || kind === 'wait') && state.story.seen !== dayKey() };
  }
  function storyUrgent() { var h = storyHook(); return !!h && h.urgent; }
  // How the next episode opens, for the locked row and the end of the newest episode.
  function storyLockNote() {
    var n = dayAnswers(dayKey());
    return storyUnlockedToday() ? 'opens tomorrow, when you reach your daily goal'
      : n >= state.goal ? 'opens with your next answer' : 'opens when you reach today’s goal (' + n + '/' + state.goal + ')';
  }
  function storyLine(h) {
    if (h.kind === 'new') return h.avail === 1 ? 'The story starts here: episode 1' : 'Episode ' + h.avail + ' is ready to read';
    if (h.kind === 'done') return 'All ' + h.total + ' episodes are open';
    if (h.kind === 'tomorrow') return 'Episode ' + h.next + ' opens tomorrow, at your goal';
    var n = dayAnswers(dayKey());
    return n >= state.goal ? 'Episode ' + h.next + ' opens with your next answer' : 'Episode ' + h.next + ' opens at today’s goal · ' + n + '/' + state.goal;
  }
  // The strip in #suggestPop: first while it has news (a new episode, or one waiting behind today's goal), last
  // otherwise, where it is the way back to the episodes already open. ✕ only moves it to the back until tomorrow.
  function renderStoryStrip() {
    var h = storyHook(), pop = els.suggestPop;
    els.storyStrip.hidden = !h;
    if (!h) return;
    if (h.urgent) { if (pop.firstElementChild !== els.storyStrip) pop.insertBefore(els.storyStrip, pop.firstChild); }
    else if (pop.lastElementChild !== els.storyStrip) pop.appendChild(els.storyStrip);
    els.storyStrip.classList.toggle('fresh', h.kind === 'new');
    els.storyText.textContent = storyLine(h);
    var go = h.kind === 'new' ? 'Read' : 'Open';
    if (els.btnStoryGo.getAttribute('data-go') !== go) { setLabel(els.btnStoryGo, go); els.btnStoryGo.setAttribute('data-go', go); }
    els.btnStoryGo.setAttribute('data-ep', h.kind === 'new' ? String(h.avail) : '');
    els.btnStoryClose.hidden = !h.urgent;
  }
  // The Today row's chip when it stands for the story (renderSuggest).
  function renderStoryChip() {
    var h = storyHook(), fresh = h.urgent && h.kind === 'new';
    els.suggestSeal.classList.toggle('fresh', fresh);
    els.suggestCap.textContent = !h.urgent ? 'Story' : fresh ? 'New episode' : 'At today’s goal';
    els.suggestText.textContent = '';
    if (!h.urgent) els.suggestText.textContent = h.avail + (h.avail === 1 ? ' episode' : ' episodes');
    else {
      // “Ep. 7” on the narrowest phones, where the row has no room for the word.
      els.suggestText.appendChild(el('span', 'sg-long', 'Episode '));
      els.suggestText.appendChild(el('span', 'sg-short', 'Ep. '));
      els.suggestText.appendChild(document.createTextNode(fresh ? String(h.avail) : h.next + ' 🔒'));
    }
    if (h.urgent && !fresh) els.suggestText.appendChild(el('span', 'sg-more', ' · ' + dayAnswers(dayKey()) + '/' + state.goal));
    if (fresh) els.suggestText.appendChild(el('span', 'sg-en', ' · ' + mean(storyEpisode(h.avail).title, baseLang())));
    els.btnSuggest.setAttribute('aria-label', 'Story: ' + storyLine(h) + '. Show');
  }
  // A toast with one button; any later toast replaces it.
  function toastAction(msg, label, fn, ms) {
    if (testing) return;
    toast(msg, ms);
    var b = el('button', 'toast-btn', label);
    b.type = 'button';
    b.addEventListener('click', function () { els.toast.hidden = true; fn(); });
    els.toast.appendChild(b);
  }
  // The moment an episode opens (afterAnswer). One thing at a time: when the session summary or the “Just 5 cards”
  // finish is on screen, that dialog offers the episode; otherwise the goal's toast does, with a Read button.
  function announceEpisode(ep) {
    save();
    renderLadderStrip();
    if (testing || !els.summaryView.hidden || !els.quickView.hidden) return;
    toastAction('🎯 Daily goal reached. 📖 Episode ' + ep.id + ' of the story is open.', 'Read', function () { openStory(ep.id); }, 9000);
  }
  // The session summary's line (showSummary).
  function storySummaryLine() {
    var n = storyFreshToday();
    if (!n) return null;
    var p = el('p', 'sum-line sy-sum', '📖 Episode ' + n + ' of the story is open. ');
    var b = el('button', 'linkish', 'Read it');
    b.type = 'button';
    b.setAttribute('data-story-open', String(n));
    p.appendChild(b);
    return p;
  }

  /* ---------- the story reader ---------- */
  // The story's dictionary: the word list plus the story's own names (and allow-listed extra words), so a name is
  // one tappable piece with its pinyin instead of unknown text. Headwords win over names.
  var storyLex = null;
  function storyLexicon() {
    if (storyLex) return storyLex;
    var base = getLexicon(), map = {}, max = base.max;
    Object.keys(base.map).forEach(function (k) { map[k] = base.map[k]; });
    EXTRA.story.names.concat(EXTRA.story.extra).forEach(function (w) {
      if (map[w.zh]) return;
      map[w.zh] = w;
      max = Math.max(max, charLen(w.zh));
    });
    storyLex = { map: map, max: max };
    return storyLex;
  }
  // A name or extra word of the story (not a headword), for the word pop-up.
  function storyWord(zh) { var w = storyLexicon().map[zh]; return w && w.kind ? w : null; }
  // Chinese text with every word a button. Punctuation stays with its word (.sy-nb), so no line starts with a comma
  // or ends with an opening quote: buttons would otherwise let the line break there.
  var STORY_CLOSE = /^[，。？！：；、”’…—）》]+/, STORY_OPEN = /[“‘（《]+$/;
  function storyZh(node, zh) {
    var segs = segment(zh, storyLexicon());
    segs.forEach(function (sg, k) {
      var prev = segs[k - 1], next = segs[k + 1];
      if (!sg.word) {
        var t = sg.text;
        if (prev && prev.word) t = t.replace(STORY_CLOSE, '');
        if (next && next.word) t = t.replace(STORY_OPEN, '');
        if (t) node.appendChild(document.createTextNode(t));
        return;
      }
      var b = wordButton(sg.word);
      if (sg.word.kind) b.classList.add('w-name');
      b.textContent = sg.text;
      var pre = prev && !prev.word ? (prev.text.match(STORY_OPEN) || [''])[0] : '', post = next && !next.word ? (next.text.match(STORY_CLOSE) || [''])[0] : '';
      if (!pre && !post) { node.appendChild(b); return; }
      var nb = el('span', 'sy-nb');
      if (pre) nb.appendChild(document.createTextNode(pre));
      nb.appendChild(b);
      if (post) nb.appendChild(document.createTextNode(post));
      node.appendChild(nb);
    });
  }
  var storyAt = 0;        // the episode on screen; 0 is the list
  var storyOpenTr = {};   // lines whose translation shows
  var storyGain = false;  // this opening was the first reading
  function storyPinyinOn() { return state.story.py === null ? !(state.practice === 'hanzi' || state.fadePinyin) : state.story.py; }
  // Read aloud needs a Chinese voice; without one the buttons hide.
  function storyCanSpeak() {
    if (!speechSupported) return false;
    pickVoice();
    return !!zhVoice;
  }
  function syncStorySpeech() {
    if (!els.storyBody || els.storyView.hidden) return;
    var can = storyCanSpeak();
    Array.prototype.forEach.call(els.storyBody.querySelectorAll('.sy-speak, .sy-play'), function (b) { b.hidden = !can; });
  }
  var STORY_LEVELS = { '1': 'HSK 1 words', '2': 'HSK 1–2 and Travel words', '3': 'HSK 1–3 and Travel words' };
  function openStory(id) {
    if (!storyEpisodes().length) return false;
    closeSuggest();
    storyAt = 0;
    if (!id || !showEpisode(id)) renderStory();
    openOverlay(els.storyView, els.btnCloseStory);
    return true;
  }
  // Shows an open episode; a locked or unknown one is refused. The first reading is noted and earns STORY_XP.
  function showEpisode(id) {
    id = parseInt(id, 10);
    if (!(id >= 1 && id <= storyAvailable())) return false;
    stopSpeech();
    closeWordPop(false);
    storyAt = id;
    storyOpenTr = {};
    storyGain = !state.story.read[id];
    if (storyGain) {
      state.story.read[id] = dayKey();
      if (!testing) gainXp(STORY_XP);
      renderLadderStrip();
      save();
    }
    renderStory();
    els.storyBody.scrollTop = 0;
    return true;
  }
  function renderStory() {
    var ep = storyEpisode(storyAt);
    els.storyBody.textContent = '';
    if (ep && ep.id <= storyAvailable()) renderEpisode(ep); else { storyAt = 0; renderStoryList(); }
  }
  function renderStoryList() {
    var b = els.storyBody, h = storyHook();
    if (!h) return;
    b.appendChild(el('p', 'sy-intro', 'A story in ' + h.total + ' short episodes, written with the words of this app. Each day you reach your daily goal opens the next one.'));
    var ol = el('ol', 'sy-list'), lv = 0;
    storyEpisodes().forEach(function (ep) {
      if (ep.level !== lv && STORY_LEVELS[ep.level]) { lv = ep.level; ol.appendChild(el('li', 'sy-lv', STORY_LEVELS[lv])); }
      var open = ep.id <= h.avail, fresh = open && !state.story.read[ep.id];
      var li = el('li'), row = el(open ? 'button' : 'div', 'sy-ep' + (open ? '' : ' locked') + (fresh ? ' fresh' : ''));
      row.appendChild(el('span', 'sy-num', String(ep.id)));
      var txt = el('span', 'sy-ep-txt');
      if (open) {
        row.type = 'button';
        row.setAttribute('data-ep', String(ep.id));
        var zh = el('span', 'sy-ep-zh', ep.title.zh);
        zh.setAttribute('lang', 'zh-CN');
        txt.appendChild(zh);
        txt.appendChild(el('span', 'sy-ep-tr', mean(ep.title, baseLang())));
      } else {
        // A locked title stays hidden; only the next one says how it opens.
        txt.appendChild(el('span', 'sy-ep-tr', 'Episode ' + ep.id));
        if (ep.id === h.next) txt.appendChild(el('span', 'sy-ep-how', 'It ' + storyLockNote() + '.'));
      }
      row.appendChild(txt);
      var mark = el('span', 'sy-ep-state', open ? (fresh ? 'new' : '✓') : '🔒');
      mark.setAttribute('aria-label', open ? (fresh ? 'not read yet' : 'read') : 'locked');
      row.appendChild(mark);
      li.appendChild(row);
      ol.appendChild(li);
    });
    b.appendChild(ol);
  }
  function storyTool(act, label, pressed) {
    var t = el('button', 'btn small sy-tool');
    t.type = 'button';
    t.setAttribute('data-story', act);
    t.appendChild(zhLabel(label, true));
    if (pressed !== undefined) t.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    return t;
  }
  function storyAllOpen(ep) { return ep.lines.every(function (l, i) { return storyOpenTr[i]; }); }
  function renderEpisode(ep) {
    var b = els.storyBody, total = storyEpisodes().length, pyOn = storyPinyinOn();
    var bar = el('div', 'sy-bar');
    var back = storyTool('list', 'Episodes');
    back.insertBefore(document.createTextNode('‹ '), back.firstChild);
    bar.appendChild(back);
    var play = storyTool('play', 'Play all');
    play.classList.add('sy-play');
    play.insertBefore(document.createTextNode('▶ '), play.firstChild);
    play.hidden = !storyCanSpeak();
    bar.appendChild(play);
    b.appendChild(bar);
    b.appendChild(el('p', 'sy-kicker', 'Episode ' + ep.id + ' of ' + total + (STORY_LEVELS[ep.level] ? ' · ' + STORY_LEVELS[ep.level] : '')));
    var h = el('h3', 'sy-title');
    h.setAttribute('lang', 'zh-CN');
    storyZh(h, ep.title.zh);
    b.appendChild(h);
    if (pyOn && ep.title.py) { var tp = el('p', 'sy-py'); tp.setAttribute('lang', 'zh-Latn-pinyin'); renderPinyin(tp, ep.title.py); b.appendChild(tp); }
    b.appendChild(el('p', 'sy-title-tr', mean(ep.title, baseLang())));
    var recap = mean(ep.recap, baseLang());
    if (recap) {
      var rc = el('p', 'sy-recap');
      var cap = el('span', 'sy-recap-cap');
      cap.appendChild(zhLabel('Previously', true));
      rc.appendChild(cap);
      rc.appendChild(el('span', null, recap));
      b.appendChild(rc);
    }
    // What the lines show: pinyin under each one, and every translation at once.
    var opts = el('div', 'sy-opts');
    opts.appendChild(storyTool('py', 'Pinyin', pyOn));
    opts.appendChild(storyTool('tr', 'Translations', storyAllOpen(ep)));
    b.appendChild(opts);
    var ol = el('ol', 'sy-lines');
    ep.lines.forEach(function (ln, i) { ol.appendChild(storyLineNode(ep, i)); });
    b.appendChild(ol);
    var end = el('div', 'sy-end');
    if (storyGain) end.appendChild(el('p', 'sy-xp', '✓ First reading: +' + STORY_XP + ' XP'));
    if (ep.id === total) end.appendChild(el('p', 'sy-tbc', '完 · The end'));
    else if (ep.id === storyAvailable()) {
      var tbc = el('p', 'sy-tbc');
      tbc.appendChild(zhLabel('To be continued', true));
      end.appendChild(tbc);
      end.appendChild(el('p', 'sy-how', 'Episode ' + (ep.id + 1) + ' ' + storyLockNote() + '.'));
    }
    var nav = el('div', 'sy-nav');
    if (ep.id > 1) { var pv = storyTool('', 'Previous'); pv.removeAttribute('data-story'); pv.setAttribute('data-ep', String(ep.id - 1)); pv.insertBefore(document.createTextNode('‹ '), pv.firstChild); nav.appendChild(pv); }
    if (ep.id < storyAvailable()) { var nx = storyTool('', 'Next episode'); nx.removeAttribute('data-story'); nx.classList.add('primary', 'sy-next'); nx.setAttribute('data-ep', String(ep.id + 1)); nx.appendChild(document.createTextNode(' ›')); nav.appendChild(nx); }
    if (nav.firstChild) end.appendChild(nav);
    b.appendChild(end);
  }
  // One line: who speaks, the Chinese with tappable words, the pinyin, and the translation once the line is opened.
  function storyLineNode(ep, i) {
    var ln = ep.lines[i], open = !!storyOpenTr[i];
    var li = el('li', 'sy-line' + (open ? ' open' : ''));
    li.setAttribute('data-i', String(i));
    var main = el('div', 'sy-main');
    if (ln.who) { var who = el('p', 'sy-who'); who.setAttribute('lang', 'zh-CN'); storyZh(who, ln.who); main.appendChild(who); }
    var zh = el('p', 'sy-zh');
    zh.setAttribute('lang', 'zh-CN');
    storyZh(zh, ln.zh);
    main.appendChild(zh);
    if (storyPinyinOn() && ln.py) { var py = el('p', 'sy-py'); py.setAttribute('lang', 'zh-Latn-pinyin'); renderPinyin(py, ln.py); main.appendChild(py); }
    li.appendChild(main);
    var acts = el('div', 'sy-acts');
    var sp = el('button', 'sy-btn sy-speak ex-speak', '🔊');
    sp.type = 'button';
    sp.setAttribute('data-story', 'speak');
    sp.setAttribute('aria-label', 'Read this sentence aloud');
    sp.hidden = !storyCanSpeak();
    acts.appendChild(sp);
    var tr = el('button', 'sy-btn sy-tr-btn', '译');
    tr.type = 'button';
    tr.setAttribute('data-story', 'line');
    tr.setAttribute('aria-expanded', open ? 'true' : 'false');
    tr.setAttribute('aria-label', open ? 'Hide the translation' : 'Show the translation');
    acts.appendChild(tr);
    li.appendChild(acts);
    if (open) { var box = el('div', 'sy-tr'); meaningLines(box, ln, 'ex-line'); li.appendChild(box); }
    return li;
  }
  function toggleStoryLine(i, refocus) {
    var ep = storyEpisode(storyAt), old = els.storyBody.querySelector('.sy-line[data-i="' + i + '"]');
    if (!ep || !ep.lines[i] || !old) return;
    if (storyOpenTr[i]) delete storyOpenTr[i]; else storyOpenTr[i] = true;
    var li = storyLineNode(ep, i);
    old.parentNode.replaceChild(li, old);
    var all = els.storyBody.querySelector('[data-story="tr"]');
    if (all) all.setAttribute('aria-pressed', storyAllOpen(ep) ? 'true' : 'false');
    if (refocus) storyFocus(li.querySelector('[data-story="line"]'));
  }
  function storyFocus(node) {
    if (!node || testing) return;
    try { node.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function storyClick(e) {
    var t = e.target.closest ? e.target.closest('[data-story], [data-ep]') : null;
    var ep = storyEpisode(storyAt);
    if (t && els.storyBody.contains(t)) {
      if (t.hasAttribute('data-ep')) {
        if (showEpisode(t.getAttribute('data-ep'))) storyFocus(els.storyBody.querySelector('[data-story="list"]'));
        return;
      }
      var a = t.getAttribute('data-story'), line = t.closest('.sy-line'), i = line ? Number(line.getAttribute('data-i')) : -1;
      if (a === 'list') { stopSpeech(); storyAt = 0; renderStory(); els.storyBody.scrollTop = 0; storyFocus(els.btnCloseStory); return; }
      if (!ep) return;
      if (a === 'play') speakParts(ep.lines.map(function (l) { return l.zh; }), t);
      else if (a === 'speak' && ep.lines[i]) speakParts([ep.lines[i].zh], t);
      else if (a === 'line') toggleStoryLine(i, true);
      else if (a === 'py' || a === 'tr') {
        stopSpeech();
        if (a === 'py') { state.story.py = !storyPinyinOn(); save(); }
        else { var all = storyAllOpen(ep); storyOpenTr = {}; if (!all) ep.lines.forEach(function (l, k) { storyOpenTr[k] = true; }); }
        renderStory();
        storyFocus(els.storyBody.querySelector('[data-story="' + a + '"]'));
      }
      return;
    }
    // A tap on the line itself (not on a word or a speaker button) shows or hides its translation.
    if (e.target.closest && !e.target.closest('button, a')) {
      var ln = e.target.closest('.sy-line');
      var sel = window.getSelection ? String(window.getSelection()) : '';
      if (ln && !sel) toggleStoryLine(Number(ln.getAttribute('data-i')), false);
    }
  }
  function wireStory() {
    on('btnStoryGo', 'click', function () { openStory(Number(els.btnStoryGo.getAttribute('data-ep')) || 0); });
    on('btnStoryClose', 'click', function () { state.story.seen = dayKey(); renderLadderStrip(); save(); });
    on('btnCloseStory', 'click', function () { closeOverlay(els.storyView); });
    on('storyBody', 'click', storyClick);
    on('btnQuickStory', 'click', function () { var n = storyAvailable(); closeOverlay(els.quickView); openStory(n); });
    on('summaryBody', 'click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-story-open]') : null;
      if (b) { closeOverlay(els.summaryView); openStory(Number(b.getAttribute('data-story-open'))); }
    });
  }
