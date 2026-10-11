  /* ---------- overlays ---------- */
  var OVERLAYS = ['newsView', 'petView', 'quizView', 'topicView', 'listView', 'progressView', 'settingsView', 'helpView', 'transferView', 'summaryView', 'tourView', 'diagView', 'confirmDialog'];
  var overlayStack = [];
  function anyOverlayOpen() {
    return OVERLAYS.some(function (id) { return !els[id].hidden; });
  }
  // While any panel is open the page behind it is locked for pointer, keyboard and screen readers.
  function syncOverlayState() {
    var open = anyOverlayOpen();
    document.body.classList.toggle('modal-open', open);
    els.app.inert = open;
  }
  function openOverlay(node, focusEl) {
    closeWordPop(false);
    if (!anyOverlayOpen()) lastFocus = document.activeElement;
    stopSpeech();
    node.hidden = false;
    overlayStack = overlayStack.filter(function (n) { return n !== node; }).concat(node);
    syncOverlayState();
    if (focusEl && !testing) { try { focusEl.focus({ preventScroll: true }); } catch (e) { focusEl.focus(); } }
  }
  function closeOverlay(node) {
    if (node.hidden) return;
    if (node === els.quizView) stopQuiz();
    node.hidden = true;
    overlayStack = overlayStack.filter(function (n) { return n !== node; });
    syncOverlayState();
    if (!anyOverlayOpen() && lastFocus && lastFocus.focus && !testing && document.contains(lastFocus)) {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
  }
  // Closing a panel by Esc or a backdrop click; the confirm dialog drops its pending action, the tour is marked as seen.
  function dismissOverlay(node) {
    if (node === els.confirmDialog) confirmCallback = null;
    if (node === els.tourView) closeTour(); else closeOverlay(node);
  }
  function topOverlay() {
    var open = overlayStack.filter(function (n) { return !n.hidden; });
    if (open.length) return open[open.length - 1];
    var ids = OVERLAYS.filter(function (id) { return !els[id].hidden; });
    return ids.length ? els[ids[ids.length - 1]] : null;
  }
  // altLabel/altCb add a second action, for choices like “keep this copy or that one”.
  function askConfirm(title, text, okLabel, cb, altLabel, altCb) {
    els.confirmTitle.textContent = title;
    els.confirmText.textContent = text;
    els.confirmOk.textContent = okLabel;
    confirmCallback = cb;
    confirmAltCallback = altLabel ? altCb : null;
    els.confirmAlt.hidden = !altLabel;
    els.confirmAlt.textContent = altLabel || 'Other choice';
    openOverlay(els.confirmDialog, els.confirmCancel);
  }

  /* ---------- list view ---------- */
  function openList() {
    setLabel(els.listTitle, deck().listTitle, true);
    openOverlay(els.listView, els.searchInput);
    renderList();
    var cur = els.wordList.querySelector('.word-row.current');
    if (cur && cur.scrollIntoView && !testing) cur.scrollIntoView({ block: 'center' });
  }
  function renderList() {
    var raw = els.searchInput.value.trim();
    var q = fold(raw);
    var qc = compact(q);
    var qv = qc.replace(/v/g, 'u');
    var cur = currentIndex();
    var frag = document.createDocumentFragment();
    var shown = 0;
    cards.forEach(function (c, i) {
      var s = statusOf(c);
      if (listFilter !== 'all' && s !== listFilter) return;
      if (listLevel !== 'all' && String(c.lv) !== listLevel) return;
      if (q && c.search.indexOf(q) === -1 && (!qc || c.searchCompact.indexOf(qc) === -1) && (!qv || c.searchCompact.indexOf(qv) === -1)) return;
      shown++;
      var li = el('li');
      var b = el('button', 'word-row' + (i === cur ? ' current' : ''));
      b.type = 'button';
      b.setAttribute('data-index', String(i));
      b.setAttribute('aria-label', 'Study card ' + c.n + ': ' + c.zh + ', ' + c.py + ', ' + c.en + '. Status: ' + STATUS_NAMES[s]);
      b.appendChild(el('span', 'wr-num', String(c.n)));
      var zh = el('span', 'wr-zh', c.zh);
      zh.setAttribute('lang', 'zh-CN');
      b.appendChild(zh);
      var txt = el('span', 'wr-text');
      var wpy = el('span', 'wr-py');
      wpy.setAttribute('lang', 'zh-Latn-pinyin');
      renderPinyin(wpy, c.py);
      txt.appendChild(wpy);
      txt.appendChild(el('span', 'wr-mean', c.en + ' · ' + c.hu));
      b.appendChild(txt);
      var badges = el('span', 'wr-badges');
      badges.appendChild(el('span', 'badge lv', 'HSK ' + c.lv));
      badges.appendChild(el('span', 'badge' + (s === 'unmarked' ? '' : ' ' + s), STATUS_NAMES[s]));
      b.appendChild(badges);
      li.appendChild(b);
      frag.appendChild(li);
    });
    els.wordList.textContent = '';
    if (!shown) {
      els.wordList.appendChild(el('li', 'empty-row', 'No words match your search.'));
    } else {
      els.wordList.appendChild(frag);
    }
    var label = shown + ' of ' + cards.length + ' words';
    if (listFilter !== 'all') label += ' · ' + STATUS_NAMES[listFilter];
    if (listLevel !== 'all') label += ' · HSK ' + listLevel;
    var lvc = els.lvChips.querySelectorAll('.chip');
    for (var q = 0; q < lvc.length; q++) lvc[q].setAttribute('aria-pressed', lvc[q].getAttribute('data-lv') === listLevel ? 'true' : 'false');
    if (raw) label += ' · matching “' + raw + '”';
    els.listSummary.textContent = label + ' · tap a word to study it';
    var chips = els.listView.querySelectorAll('.chip[data-filter]');
    var n = counts();
    for (var k = 0; k < chips.length; k++) {
      var f = chips[k].getAttribute('data-filter');
      chips[k].setAttribute('aria-pressed', f === listFilter ? 'true' : 'false');
      chips[k].textContent = (f === 'all' ? 'All' : STATUS_NAMES[f]) + ' (' + (f === 'all' ? n.total : n[f]) + ')';
    }
  }
  // Opens a word from anywhere (progress view, word of the day), switching to the words deck if needed.
  function studyWord(zh) {
    var i = -1;
    wordCards.forEach(function (w, k) { if (w.zh === zh) i = k; });
    if (i === -1) return;
    OVERLAYS.forEach(function (id) { if (id !== 'listView') closeOverlay(els[id]); });
    if (isSent()) { rememberDeck(); useDeckType('words'); syncPracticeSelect(); }
    studyCard(i);
  }
  function wordsIn(topic) { return wordCards.filter(function (w) { return topic === 'all' || w.tp === topic; }); }
  function topicKnown(topic) {
    var n = 0;
    wordsIn(topic).forEach(function (w) { if (state.status[w.zh] === 'known') n++; });
    return n;
  }
  function updateTopicBtn() {
    var t = topicById(state.topic);
    els.btnTopic.hidden = !EXTRA.topics.length;
    els.topicBtnZh.textContent = t ? t.zh : '全';
    els.topicBtnName.textContent = t ? t.en : 'All topics';
    els.btnTopic.title = t ? t.en : 'All topics';
    els.btnTopic.classList.toggle('active', !!t);
    els.btnTopic.setAttribute('aria-label', 'Topic: ' + (t ? t.en : 'all topics') + '. Choose a topic');
  }
  function setTopic(id) {
    state.topic = topicById(id) ? id : 'all';
    closeOverlay(els.topicView);
    updateTopicBtn();
    setMode(state.mode);
    var t = topicById(state.topic);
    if (t && !testing) toast('Studying ' + t.en + ': ' + wordsIn(t.id).length + ' words. Choose “All topics” to go back.', 4000);
  }
  function topicTile(t, cls) {
    var id = t ? t.id : 'all', list = wordsIn(id), known = topicKnown(id);
    var b = el('button', cls);
    b.type = 'button';
    b.setAttribute('data-topic', id);
    b.setAttribute('aria-pressed', state.topic === id ? 'true' : 'false');
    var seal = el('span', 'tp-seal' + (list.length && known === list.length ? ' done' : ''), t ? t.zh : '全');
    seal.setAttribute('lang', 'zh-CN');
    seal.setAttribute('aria-hidden', 'true');
    b.appendChild(seal);
    var tx = el('span', 'tp-text');
    tx.appendChild(el('span', 'tp-name', t ? t.en : 'All topics'));
    var hu = el('span', 'tp-hu', t ? t.hu : 'Minden téma');
    hu.setAttribute('lang', 'hu');
    tx.appendChild(hu);
    var bar = el('span', 'tp-bar');
    var fill = el('span', 'tp-fill');
    fill.style.width = pct(known, list.length) + '%';
    bar.appendChild(fill);
    tx.appendChild(bar);
    tx.appendChild(el('span', 'tp-count', known + ' / ' + list.length + ' known' + (list.length && known === list.length ? ' · complete' : '')));
    b.appendChild(tx);
    return b;
  }
  function renderTopics() {
    els.topicGrid.textContent = '';
    els.topicGrid.appendChild(topicTile(null, 'tp-tile'));
    EXTRA.topics.forEach(function (t) { els.topicGrid.appendChild(topicTile(t, 'tp-tile')); });
  }
  function openTopics() {
    renderTopics();
    openOverlay(els.topicView, els.btnCloseTopic);
  }

  function studyCard(i) {
    var p = state.deck.indexOf(i);
    if (p === -1) {
      if (!inLevel(cards[i])) {
        state.level = 'all'; state.topic = 'all'; updateTopicBtn();
        if (!inPractice(cards[i])) { state.practice = 'choice'; syncPracticeSelect(); }
      }
      state.mode = 'all';
      state.deck = buildDeck('all');
      state.shuffled = false;
      p = state.deck.indexOf(i);
      toast('Switched to “All cards” to show this word.');
      undoStack = [];
    }
    stopSpeech();
    state.pos = p;
    state.revealed = state.autoReveal;
    undoStack = [];
    closeOverlay(els.listView);
    render(true);
    save();
    if (!testing) { try { els.revealHint.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  /* ---------- keyboard ---------- */
  function onKeyDown(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    var tag = t && t.tagName;
    if (!els.wordPop.hidden && (e.key === 'Escape' || e.key === 'Esc')) {
      e.preventDefault();
      closeWordPop(true);
      return;
    }
    if (anyOverlayOpen()) {
      if (topOverlay() === els.quizView && /^[1-4]$/.test(e.key)) { e.preventDefault(); quizPick(Number(e.key) - 1); return; }
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        var top = topOverlay();
        if (top) dismissOverlay(top);
      }
      return;
    }
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    // A control reached with the keyboard keeps Space and the arrow keys; after a mouse or touch click they stay shortcuts.
    var control = t && t.closest ? t.closest('button, a, summary, [role="radio"]') : null;
    if (control) {
      var keyboard = focusedByKeyboard(control);
      if (e.key === 'Enter' || (keyboard && (e.key === ' ' || e.key === 'Spacebar'))) return;
      if (keyboard && control.getAttribute('role') === 'radio' && /^Arrow/.test(e.key)) {
        e.preventDefault();
        moveRadio(control, e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1);
        return;
      }
    }
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); act('known'); break;
      case 'ArrowLeft': e.preventDefault(); act('learning'); break;
      case ' ': case 'Spacebar': e.preventDefault(); act('skip'); break;
      case 's': case 'S': e.preventDefault(); speakCurrent(); break;
      case 't': case 'T': {
        var typeBox = els.cardPrompt.hidden ? null : els.cardPrompt.querySelector('.type-input');
        if (typeBox) { e.preventDefault(); typeBox.focus(); }
        break;
      }
      case 'h': case 'H': case 'e': case 'E':
        if (!els.gradeRow.hidden) { e.preventDefault(); act('known', /h/i.test(e.key) ? 'hard' : 'easy'); }
        break;
      case 'ArrowUp': case 'ArrowDown': e.preventDefault(); toggleReveal(); break;
      case '1': case '2': case '3': case '4':
        if (CHOICE_STYLES[state.practice]) { e.preventDefault(); pickChoice(Number(e.key) - 1); }
        break;
      case 'Backspace':
        if (buildQ && buildQ.order.length && !buildQ.done) { e.preventDefault(); moveTile(buildQ.order[buildQ.order.length - 1], 'line'); }
        break;
      case 'Enter':
        if (t === els.card) { e.preventDefault(); toggleReveal(); }
        break;
      default: break;
    }
  }
  // The control the last mouse or touch press landed on; Tab clears it, so it only covers pointer focus.
  var pointerFocus = null;
  function focusedByKeyboard(node) {
    return node === document.activeElement && node !== pointerFocus;
  }
  function onKeyUp(e) {
    // Buttons act on Space key-up; after a mouse or touch click, Space was already used as “skip”.
    var b = e.target && e.target.closest ? e.target.closest('button') : null;
    if ((e.key === ' ' || e.key === 'Spacebar') && b && !focusedByKeyboard(b) && !anyOverlayOpen()) e.preventDefault();
  }

