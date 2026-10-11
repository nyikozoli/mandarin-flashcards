  'use strict';

  var STORAGE_KEY = 'mandarin300.progress.v1';
  var SYNC_KEY = 'mandarin300.sync.v1';
  // Replaced at build time. null in the single-file and claude.ai artifact builds: neither has
  // a stable https origin for a magic link to return to (file:// and a cross-origin iframe).
  var SYNC_CONFIG = __SYNC_CONFIG__;
  var EXPECTED_COUNT = __EXPECTED_TOTAL__;
  var EXPECTED_LEVELS = __EXPECTED_LEVELS__;
  var MODE_NAMES = { all: 'All cards', due: 'Due for review', learning: 'Learning only', unmarked: 'New cards only', hard: 'Hardest words' };
  var STATUS_NAMES = { known: 'Known', learning: 'Learning', unmarked: 'New' };
  var REQUIRED_IDS = ['confirmCompare', 'confirmActions', 'btnSyncTop', 'newsStrip', 'newsStripText', 'btnNewsSee', 'btnNewsClose', 'btnNews', 'newsView', 'btnCloseNews', 'newsBody', 'optLabels', 'btnPet', 'petMini', 'petView', 'btnClosePet', 'petBig', 'petName', 'petStageName', 'petMood', 'petFedText', 'petFed', 'petGrowText', 'petGrow', 'petRename', 'petNameInput', 'cardHints', 'quizView', 'quizTitle', 'quizBody', 'btnCloseQuiz', 'wotd', 'wotdZh', 'wotdPy', 'wotdEn', 'wotdHint', 'btnWotdStudy', 'btnWotdClose', 'extra-data', 'btnTopic', 'topicBtnZh', 'topicBtnName', 'topicView', 'btnCloseTopic', 'topicGrid', 'cardRank', 'comboTag', 'gradeRow', 'legendTones', 'optChoicePinyin', 'progressTitle', 'optFadePinyin', 'wordPop', 'wordPopZh', 'wordPopLv', 'wordPopPy', 'wordPopEn', 'wordPopHu', 'btnWordPopSpeak', 'btnWordPopClose', 'app', 'errorBanner', 'errorList', 'modeAll', 'modeLearning', 'modeUnmarked', 'countAll', 'countLearningMode',
    'countUnmarkedMode', 'btnShuffle', 'btnUndo', 'btnReset', 'btnSelfCheck', 'btnList', 'cardCounter', 'knownCount', 'learningCount',
    'unmarkedCount', 'progressBar', 'progKnown', 'progLearning', 'progressLabel', 'stage', 'card', 'cardNumber', 'cardStatus', 'cardHanzi',
    'cardPinyin', 'btnSpeak', 'speakLabel', 'cardAnswer', 'cardEn', 'cardHu', 'cardExamples', 'revealHint', 'deckEnd', 'endEmoji', 'endTitle',
    'endText', 'btnEndRestart', 'btnEndLearning', 'btnEndUnmarked', 'btnEndAll', 'btnLearning', 'btnSkip', 'btnKnown', 'optAutoReveal',
    'optRate', 'optVoice', 'optWarmup', 'btnTestVoices', 'footnote', 'btnSettings', 'settingsView', 'btnCloseSettings', 'btnHelp', 'helpView', 'btnCloseHelp', 'srLive', 'transferView', 'transferTitle', 'transferIntro', 'transferText', 'btnCloseTransfer', 'btnCopyProgress', 'btnDownloadProgress', 'transferExportActions', 'transferImportActions', 'importFile', 'btnApplyImport', 'transferStatus', 'btnExport', 'btnImport', 'listTitle', 'btnShowTour', 'tourView', 'tourArt', 'tourTitle', 'tourText', 'tourDots', 'btnTourSkip', 'btnTourBack', 'btnTourNext', 'modeDue', 'modeHard', 'countDueMode', 'countHardMode', 'optPractice', 'cardPrompt', 'choiceBox', 'optTones', 'optAutoplay', 'optVibrate', 'summaryView', 'summaryBody', 'btnSummaryClose', 'btnSummaryProgress', 'btnProgress', 'progressView', 'btnCloseProgress', 'pvBody', 'todayPill', 'levelAll', 'level1', 'level2', 'level3', 'countLvAll', 'countLv1', 'countLv2', 'countLv3', 'lvChips', 'listView', 'btnCloseList', 'searchInput', 'listSummary', 'wordList', 'confirmDialog', 'confirmTitle',
    'confirmText', 'confirmCancel', 'confirmAlt', 'confirmOk', 'diagView', 'btnCloseDiag', 'diagSummary', 'diagResults', 'btnRunCheck', 'toast', 'vocab-data',
    'syncGroup', 'syncEmailRow', 'syncEmail', 'syncLinkRow', 'syncEmailNote', 'btnSignIn', 'syncAccountRow', 'syncAccount', 'btnSignOut',
    'syncDatesRow', 'syncDates', 'btnSyncNow', 'syncStatus'];
  var CORE_BUTTONS = ['btnSyncTop', 'btnNewsSee', 'btnNewsClose', 'btnNews', 'btnCloseNews', 'optLabels', 'btnPet', 'btnClosePet', 'petBig', 'petRename', 'btnCloseQuiz', 'quizBody', 'btnWotdStudy', 'btnWotdClose', 'btnTopic', 'btnCloseTopic', 'topicGrid', 'pvBody', 'gradeRow', 'optChoicePinyin', 'optFadePinyin', 'btnWordPopSpeak', 'btnWordPopClose', 'btnExport', 'btnImport', 'btnApplyImport', 'revealHint', 'btnHelp', 'btnTourNext', 'btnSettings', 'btnKnown', 'btnLearning', 'btnSkip', 'btnSpeak', 'cardExamples', 'modeDue', 'modeHard', 'optPractice', 'choiceBox', 'cardPrompt', 'btnProgress', 'levelAll', 'level1', 'level2', 'level3', 'card', 'btnShuffle', 'btnUndo', 'btnReset', 'btnSelfCheck',
    'btnList', 'btnCloseList', 'modeAll', 'modeLearning', 'modeUnmarked', 'searchInput', 'confirmOk', 'confirmCancel', 'confirmAlt', 'btnSignIn', 'btnSignOut', 'btnSyncNow'];

  var $ = function (id) { return document.getElementById(id); };
  var els = {};
  var bound = {};
  var cards = [], wordCards = [], sentCards = [];
  var state = { status: {}, mode: 'all', deck: [], pos: 0, shuffled: false, revealed: false, autoReveal: false, rate: 0.85, voice: '', badVoices: [], voicesTested: false, level: 'all', activity: {}, goal: 20, warmup: true, deckType: 'words',
    srs: {}, misses: {}, skill: 'read', marks: {}, deckMemory: {}, topic: 'all', xp: 0, bestCombo: 0, learned: {}, wotdSeen: '', quests: null, freezes: 0, frozen: [], recapWeek: '', seals: {}, questDays: 0, petName: '', labels: 'both', newsSeen: '', blitzBest: {}, exams: {}, milestones: [], practice: 'zh', toneColors: true, fadePinyin: false, choicePinyin: true,
    autoplay: false, vibrate: true, seenTour: false };
  var undoStack = [];
  var busy = false;
  var testing = false;
  var storageOK = true;
  var storageWarned = false;
  var listFilter = 'all';
  var listLevel = 'all';
  var lastFocus = null;
  var confirmCallback = null;
  var confirmAltCallback = null;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- helpers ---------- */
  function on(id, type, fn) {
    var el = $(id);
    if (!el) throw new Error('Missing page element #' + id);
    el.addEventListener(type, fn);
    bound[id] = true;
  }
  function str(v) { return typeof v === 'string' ? v.trim() : ''; }
  function fold(s) {
    s = String(s || '');
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s.toLowerCase();
  }
  function compact(s) { return s.replace(/[\s'’\-.,;:()]/g, ''); }
  // Search text for the word list: Chinese, pinyin and both meanings, with tone marks and accents removed.
  function indexCard(c) {
    c.search = fold([c.zh, c.py, c.en, c.hu].join(' | '));
    c.searchCompact = compact(c.search);
  }
  function charLen(s) { return Array.from ? Array.from(s).length : s.length; }
  function clampInt(v, lo, hi) { v = parseInt(v, 10); if (isNaN(v)) v = lo; return Math.max(lo, Math.min(hi, v)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  var toastTimer = null;
  function toast(msg, ms) {
    if (testing) return;
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, ms || 3500);
  }
  function reportError(msg) {
    if (window.__appError) window.__appError(msg);
  }

  /* ---------- data ---------- */
  function loadCards() {
    var node = $('vocab-data');
    if (!node) throw new Error('The vocabulary data block is missing from the page.');
    var data;
    try { data = JSON.parse(node.textContent); }
    catch (e) { throw new Error('The vocabulary data could not be read (' + e.message + ').'); }
    if (!Array.isArray(data)) throw new Error('The vocabulary data is not a list.');
    return data.map(function (d, i) {
      d = d || {};
      var c = {
        n: i + 1,
        zh: str(d.zh), py: str(d.py), en: str(d.en), hu: str(d.hu), lv: parseInt(d.lv, 10) || 0,
        rk: parseInt(d.rk, 10) || 0, fq: Number(d.fq) || 0, tp: str(d.tp),
        ex: Array.isArray(d.ex) ? d.ex.map(function (e) { e = e || {}; return { zh: str(e.zh), py: str(e.py), en: str(e.en), hu: str(e.hu) }; }) : []
      };
      indexCard(c);
      return c;
    });
  }

