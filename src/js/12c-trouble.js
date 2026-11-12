  /* ---------- trouble words: missed again and again ---------- */
  // A trouble word (or sentence) was missed TROUBLE_MISSES times or more in the active skill and is not Known there.
  // Misses only ever count up (applySrs), so a word leaves the list by becoming Known (a review a week or more away)
  // and comes back if it is then missed again. isTrouble() is the single definition.
  var TROUBLE_MISSES = 3;
  function isTrouble(c) { return (state.misses[c.zh] || 0) >= TROUBLE_MISSES && state.status[c.zh] !== 'known'; }
  // The 'trouble' study mode's deck (buildDeck): inside the level, topic and practice style, most missed first.
  function troubleList() {
    return cards.map(function (c, i) { return i; })
      .filter(function (i) { return inLevel(cards[i]) && isTrouble(cards[i]); })
      .sort(function (a, b) { return state.misses[cards[b].zh] - state.misses[cards[a].zh] || a - b; });
  }
  // Every trouble card of the active deck, whatever the level and topic (the word list's chip).
  function troubleCount() { return cards.filter(isTrouble).length; }
  // Opens the trouble deck. widen: also leave the level and topic when they hide some of the trouble words.
  function studyTrouble(widen) {
    if (widen && troubleList().length < troubleCount()) { state.level = 'all'; state.topic = 'all'; updateTopicBtn(); }
    if (!troubleList().length) { if (!testing) toast('No trouble ' + noun(2) + ' right now.'); return false; }
    OVERLAYS.forEach(function (o) { closeOverlay(els[o]); });
    closeSuggest();
    setMode('trouble');
    if (!testing) toast('Your ' + state.deck.length + ' trouble ' + noun(state.deck.length) + ', most missed first. Choose a study mode to go back.', 4500);
    return true;
  }
  // The strip in #suggestPop: after the word of the day, before the ladder; ✕ hides it until tomorrow.
  function renderTroubleStrip() {
    var n = state.mode === 'trouble' || state.troubleSeen === dayKey() || !els.wotd.hidden || !els.rehearseStrip.hidden || storyUrgent() ? 0 : troubleList().length;
    els.troubleStrip.hidden = !n;
    els.troubleText.textContent = n ? n + ' trouble ' + noun(n) : '';
  }
  // Progress → Today's stats: how many there are and a way in.
  function troubleLine() {
    var n = troubleCount();
    if (!n) return null;
    var p = el('p', 'rp-line', n + ' trouble ' + noun(n) + ' (missed ' + TROUBLE_MISSES + ' times or more, not known yet). ');
    var b = el('button', 'linkish', 'Study ' + (n === 1 ? 'it' : 'them'));
    b.type = 'button';
    b.setAttribute('data-trouble', '1');
    p.appendChild(b);
    return p;
  }

  /* ---------- my note: one short note of your own per word ---------- */
  // state.notes is { headword: text }: words only, at most NOTE_MAX characters each, always shown as text.
  // It is part of the snapshot (export, import, sync). The note shows on the back of the card, under the hints.
  var NOTE_MAX = 200;
  function cleanNote(v) {
    if (typeof v !== 'string') return '';
    v = v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim();
    return Array.from(v).slice(0, NOTE_MAX).join('').trim();
  }
  function readNotes(src) {
    var out = {};
    if (!src || typeof src !== 'object') return out;
    wordCards.forEach(function (w) {
      var t = Object.prototype.hasOwnProperty.call(src, w.zh) ? cleanNote(src[w.zh]) : '';
      if (t) out[w.zh] = t;
    });
    return out;
  }
  function noteOf(zh) { return Object.prototype.hasOwnProperty.call(state.notes, zh) ? state.notes[zh] : ''; }
  function setNote(zh, text) {
    if (!wordByZh(zh)) return false;
    text = cleanNote(text);
    if (text) state.notes[zh] = text; else delete state.notes[zh];
    return true;
  }
  // The card's back: the note with Edit, or a quiet way to add one. Trouble words say why a note may help.
  function renderNote(c) {
    var box = els.cardNote;
    box.textContent = '';
    box.hidden = !!c.sentence;
    if (c.sentence) return;
    var text = noteOf(c.zh);
    var trouble = withSkill(skillNow(), function () { return isTrouble(c) ? state.misses[c.zh] : 0; });
    var b = el('button', 'linkish note-edit');
    b.type = 'button';
    b.setAttribute('data-note', c.zh);
    if (text) {
      var row = el('div', 'note-row');
      var head = el('p', 'note-head');
      head.appendChild(el('span', 'note-cap', '✎ My note'));
      b.appendChild(zhLabel('Edit', true));
      b.setAttribute('aria-label', 'Edit my note');
      head.appendChild(b);
      row.appendChild(head);
      row.appendChild(el('p', 'note-text', text));
      box.appendChild(row);
      return;
    }
    if (trouble) box.appendChild(el('p', 'note-why', 'Missed ' + trouble + ' times. A note of your own can make it stick.'));
    b.appendChild(zhLabel('Add a note', true));
    box.appendChild(b);
  }
  var noteWord = '';
  function openNote(zh) {
    var w = wordByZh(zh);
    if (!w) return;
    closeWordPop(false);
    noteWord = zh;
    els.noteZh.textContent = w.zh;
    renderPinyin(els.notePy, w.py);
    els.noteMean.textContent = shortText(baseMeaning(w));
    els.noteText.value = noteOf(zh);
    els.btnNoteDelete.hidden = !noteOf(zh);
    updateNoteCount();
    openOverlay(els.noteView, els.noteText);
  }
  function updateNoteCount() { els.noteCount.textContent = Array.from(els.noteText.value).length + ' / ' + NOTE_MAX; }
  function closeNote(text) {
    var zh = noteWord;
    noteWord = '';
    closeOverlay(els.noteView);
    if (text === null || !zh || !setNote(zh, text)) return;
    var c = cardOnScreen();
    if (c && c.zh === zh) renderNote(c);
    if (!els.listView.hidden) renderList();
    save();
  }
  function wireTrouble() {
    on('btnTroubleGo', 'click', function () { studyTrouble(false); });
    on('btnTroubleClose', 'click', function () { state.troubleSeen = dayKey(); renderLadderStrip(); save(); });
    on('btnListTrouble', 'click', function () { studyTrouble(true); });
    on('cardNote', 'click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-note]') : null;
      if (b) { e.stopPropagation(); openNote(b.getAttribute('data-note')); }
    });
    on('btnWordPopNote', 'click', function () { if (popWord) openNote(popWord.zh); });
    on('noteText', 'input', updateNoteCount);
    on('btnNoteSave', 'click', function () { closeNote(els.noteText.value); });
    on('btnNoteDelete', 'click', function () { closeNote(''); });
    on('btnNoteCancel', 'click', function () { closeNote(null); });
  }
