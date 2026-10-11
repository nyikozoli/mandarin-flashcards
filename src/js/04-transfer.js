  /* ---------- move progress between devices ---------- */
  var APP_ID = 'mandarin-hsk-flashcards';
  var DEVICE_ONLY = ['voice', 'badVoices', 'voicesTested', 'warmup'];
  function exportText() {
    var p = progressSnapshot();
    DEVICE_ONLY.forEach(function (k) { delete p[k]; });
    return JSON.stringify({ app: APP_ID, version: 1, exported: new Date().toISOString(), progress: p });
  }
  function parseImport(text) {
    var obj;
    try { obj = JSON.parse(String(text || '').trim()); } catch (e) {
      return { error: 'This is not a progress code. Paste the whole code you copied, or open the saved file.' };
    }
    var p = obj && obj.app === APP_ID ? obj.progress : (obj && obj.version === 1 && obj.status ? obj : null);
    if (!p || typeof p !== 'object' || !p.status || typeof p.status !== 'object') {
      return { error: 'This code does not contain Mandarin HSK progress.' };
    }
    if (typeof p.format === 'number' && p.format > FORMAT) {
      return { error: 'This progress was saved by a newer version of the app. Reload this page to update it, then import again.' };
    }
    var m = markCounts(p.status);
    var days = Object.keys(p.activity || {}).sort();
    return { progress: p, known: m.known, learning: m.learning, last: days[days.length - 1] || null };
  }
  function applyImport(p) {
    stopSpeech();
    DEVICE_ONLY.forEach(function (k) { delete p[k]; });
    state.status = {}; state.srs = {}; state.misses = {}; state.activity = {}; state.milestones = [];
    useDeckType(p.deckType === 'sentences' ? 'sentences' : 'words');
    restore(p);
    migrateSrs();
    undoStack = [];
    syncSettingsUI();
    render(true);
    save();
  }
  function markCounts(status) {
    var k = 0, l = 0;
    Object.keys(status).forEach(function (z) { if (status[z] === 'known') k++; else if (status[z] === 'learning') l++; });
    return { known: k, learning: l };
  }
  function openTransfer(mode) {
    var exp = mode === 'export';
    els.transferTitle.textContent = exp ? 'Export progress' : 'Import progress';
    els.transferIntro.textContent = exp
      ? 'Copy this code or save it as a file, then use “Import progress” on your other device. It holds your marks, review schedule, streak and study settings.'
      : 'Paste a progress code, or open a saved progress file. Importing replaces the progress on this device.';
    els.transferText.value = exp ? exportText() : '';
    els.transferText.readOnly = exp;
    els.transferText.placeholder = exp ? '' : 'Paste your progress code here';
    els.transferExportActions.hidden = !exp;
    // Embedded viewers (such as the claude.ai link) block downloads, so only offer copying there.
    var embedded = true;
    try { embedded = window.self !== window.top; } catch (e) { /* cross-origin parent: embedded */ }
    els.btnDownloadProgress.hidden = embedded;
    els.transferImportActions.hidden = exp;
    els.transferStatus.textContent = '';
    closeOverlay(els.settingsView);
    openOverlay(els.transferView, exp ? els.btnCopyProgress : els.transferText);
  }
  function startImport() {
    var r = parseImport(els.transferText.value);
    if (r.error) { els.transferStatus.textContent = r.error; return; }
    var cur = markCounts(marksOf('read').status);
    askConfirm('Replace progress on this device?',
      'The imported progress has ' + r.known + ' known and ' + r.learning + ' learning cards' + (r.last ? ', last studied on ' + r.last : '') +
      '. It replaces the progress on this device (' + cur.known + ' known, ' + cur.learning + ' learning).', 'Replace progress', function () {
        applyImport(r.progress);
        closeOverlay(els.transferView);
        toast('Progress imported: ' + markCounts(marksOf('read').status).known + ' known.');
      });
  }

