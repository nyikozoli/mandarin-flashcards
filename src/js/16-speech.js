  /* ---------- speech ---------- */
  var synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;
  var Utterance = window.SpeechSynthesisUtterance || null;
  var speechSupported = !!(synth && Utterance);
  var zhVoice = null;
  var speakToken = 0;
  var speakTimers = [];
  var warnedNoVoice = false;
  var lastUtterance = null;
  var LANG_TAGS = { en: 'en-US', hu: 'hu-HU', de: 'de-DE', es: 'es-ES', ro: 'ro-RO' };
  function allVoices() { try { return synth.getVoices() || []; } catch (e) { return []; } }
  // The best voice for a meaning language: the exact locale first, then any of the language; device voices first.
  function voiceFor(k) {
    if (!speechSupported) return null;
    var tag = (LANG_TAGS[k] || k).toLowerCase(), pre = tag.split('-')[0];
    var vs = allVoices().filter(function (v) { var l = langOf(v); return !isBadVoice(v) && (l === tag || l === pre || l.indexOf(pre + '-') === 0); });
    vs.sort(function (a, b) { return ((langOf(b) === tag) - (langOf(a) === tag)) || ((b.localService ? 1 : 0) - (a.localService ? 1 : 0)); });
    return vs[0] || null;
  }
  function canSpeak(k) { return !!voiceFor(k); }
  // A small speaker button for a meaning line; hidden when the device has no voice for the language.
  function speakBtn(k, text) {
    var b = el('button', 'mean-speak', '🔊');
    b.type = 'button';
    b.setAttribute('data-lang', k);
    b.setAttribute('data-text', text);
    b.setAttribute('aria-label', 'Read the ' + langName(k) + ' aloud');
    b.hidden = !canSpeak(k);
    return b;
  }
  // What to say after the Chinese on reveal: the main meaning (or the rehearse card's language), if the setting allows it.
  function meaningSpeech(c) {
    var k = rehearseCode(practiceNow()) || mainLang(c);
    if (state.readMeaning === 'off' || (state.readMeaning === 'rehearse' && langRole(k) !== 'rehearse')) return [];
    if (!canSpeak(k)) return [];
    return [{ text: shortText(mean(c, k)), lang: k }];
  }

  function langOf(v) { return String(v.lang || '').replace('_', '-').toLowerCase(); }
  function chineseVoices() {
    var voices = [];
    try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
    return voices.filter(function (v) { return /^(zh|cmn)/.test(langOf(v)); });
  }
  function isBadVoice(v) { return state.badVoices.indexOf(v.name) !== -1; }
  function pickVoice() {
    if (!speechSupported) return null;
    var all = chineseVoices();
    var zh = all.filter(function (v) { return !isBadVoice(v); });
    var mainland = zh.filter(function (v) { var l = langOf(v); return l === 'zh-cn' || l.indexOf('zh-cn') === 0 || l.indexOf('cmn') === 0 || l === 'zh-hans' || l === 'zh'; });
    var pool = mainland.length ? mainland : zh.filter(function (v) { return !/hk|yue/.test(langOf(v)); });
    if (!pool.length) pool = zh;
    var local = pool.filter(function (v) { return v.localService; });
    var chosen = state.voice ? zh.filter(function (v) { return v.name === state.voice; })[0] : null;
    zhVoice = chosen || local[0] || pool[0] || null;
    fillVoiceSelect(zh, all.length - zh.length);
    return zhVoice;
  }
  function voiceLabel(v) {
    return v.name.replace(/^Microsoft\s+/, '').replace(/\s+-\s+Chinese.*$/, '').replace(/\s+Online \(Natural\)/, '') + ' (' + v.lang + ')';
  }
  // Lists the usable Chinese voices: Windows voices (offline) and Edge "Natural" voices (online).
  // Voices that failed to play, in a test or in normal use, are hidden.
  var voiceListKey = '';
  function fillVoiceSelect(zh, hiddenCount) {
    var sel = els.optVoice;
    if (!sel) return;
    var key = zh.map(function (v) { return v.name; }).join('|') + '#' + state.voice + '#' + hiddenCount;
    if (key === voiceListKey) return;
    voiceListKey = key;
    sel.textContent = '';
    var auto = el('option', null, 'Automatic (offline voice first)');
    auto.value = '';
    sel.appendChild(auto);
    var groups = [
      { label: 'Offline – always available', list: zh.filter(function (v) { return v.localService; }) },
      { label: 'Online – needs internet', list: zh.filter(function (v) { return !v.localService; }) }
    ];
    groups.forEach(function (g) {
      if (!g.list.length) return;
      var og = document.createElement('optgroup');
      og.label = g.label;
      g.list.forEach(function (v) {
        var o = el('option', null, voiceLabel(v));
        o.value = v.name;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    sel.value = zh.some(function (v) { return v.name === state.voice; }) ? state.voice : '';
    sel.disabled = !zh.length;
    sel.title = hiddenCount ? hiddenCount + ' voice(s) hidden because they could not play on this device' : '';
    els.btnTestVoices.textContent = state.voicesTested ? 'Test voices again' : 'Test voices';
  }
  function markBadVoice(name) {
    if (!name || state.badVoices.indexOf(name) !== -1) return;
    state.badVoices.push(name);
    if (state.voice === name) state.voice = '';
    save();
  }
  // Plays one silent syllable with every Chinese voice and keeps only the ones that finish without an error.
  var testingVoices = false;
  function testVoices() {
    if (!speechSupported) { toast('Speech synthesis is not supported in this browser.'); return; }
    if (testingVoices) return;
    stopSpeech();
    var list = chineseVoices();
    if (!list.length) { toast('This browser offers no Chinese voices.'); return; }
    testingVoices = true;
    var btn = els.btnTestVoices;
    btn.disabled = true;
    var bad = [], i = 0;
    var nextVoice = function () {
      if (i >= list.length) {
        testingVoices = false;
        btn.disabled = false;
        state.badVoices = bad;
        state.voicesTested = true;
        if (state.voice && bad.indexOf(state.voice) !== -1) state.voice = '';
        save();
        voiceListKey = '';
        pickVoice();
        toast((list.length - bad.length) + ' of ' + list.length + ' Chinese voices work on this device' + (bad.length ? '. Hidden ' + bad.length + (bad.length === 1 ? ' voice' : ' voices') + ' that failed.' : '.'), 6000);
        return;
      }
      var v = list[i++];
      btn.textContent = 'Testing ' + i + ' / ' + list.length + '…';
      var settled = false;
      var settle = function (ok) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!ok) bad.push(v.name);
        try { synth.cancel(); } catch (e) { /* ignore */ }
        setTimeout(nextVoice, 120);
      };
      var timer = setTimeout(function () { settle(false); }, 8000);
      var u = new Utterance('好');
      u.voice = v;
      u.lang = v.lang;
      u.volume = 0;
      u.onend = function () { settle(true); };
      u.onerror = function () { settle(false); };
      try { synth.speak(u); } catch (e) { settle(false); }
    };
    nextVoice();
  }
  var activeSpeakBtn = null;
  var lastSpeechEnd = 0;
  function markSpeaking(btn, on) {
    if (!btn) return;
    btn.classList.toggle('speaking', on);
    if (btn === els.btnSpeak) els.speakLabel.textContent = on ? 'Stop' : 'Read aloud';
    else if (btn.classList.contains('ex-speak')) btn.setAttribute('aria-label', on ? 'Stop reading this sentence' : 'Read this sentence aloud');
  }
  function stopSpeech() {
    speakToken++;
    speakTimers.forEach(clearTimeout);
    speakTimers = [];
    if (speechSupported) { try { synth.cancel(); } catch (e) { /* ignore */ } }
    markSpeaking(activeSpeakBtn, false);
    activeSpeakBtn = null;
  }
  // Speaks the texts one after another with a short pause in between; btn shows the speaking state.
  function speakParts(parts, btn) {
    if (!speechSupported) {
      toast('Read aloud is not available: this browser does not support speech synthesis (Web Speech API).', 6000);
      return;
    }
    if (btn && btn === activeSpeakBtn) { stopSpeech(); return; }
    parts = parts.filter(Boolean);
    stopSpeech();
    if (!parts.length) return;
    pickVoice();
    if (!zhVoice && !warnedNoVoice) {
      warnedNoVoice = true;
      toast('No Chinese voice was found on this device, so the browser default voice is used with zh-CN. For correct pronunciation, install a Chinese (Mandarin) voice in your system settings.', 8000);
    }
    var token = ++speakToken;
    var idx = 0;
    var retries = 0;
    activeSpeakBtn = btn || null;
    markSpeaking(activeSpeakBtn, true);
    var finish = function () {
      if (token !== speakToken) return;
      lastSpeechEnd = Date.now();
      markSpeaking(activeSpeakBtn, false);
      activeSpeakBtn = null;
    };
    var next = function () {
      if (token !== speakToken) return;
      if (idx >= parts.length) { finish(); return; }
      var part = parts[idx], text = typeof part === 'string' ? part : part.text, k = typeof part === 'string' ? '' : part.lang;
      var u = new Utterance(text);
      if (k) { var kv = voiceFor(k); u.lang = LANG_TAGS[k] || k; if (kv) u.voice = kv; }
      else { u.lang = 'zh-CN'; if (zhVoice) u.voice = zhVoice; }
      lastUtterance = u;
      u.rate = state.rate;
      var done = false;
      var advance = function () {
        if (done || token !== speakToken) return;
        done = true;
        idx++;
        speakTimers.push(setTimeout(next, idx === 1 ? 700 : 450)); // short pause after the word, then each sentence
      };
      u.onend = function () { lastSpeechEnd = Date.now(); advance(); };
      u.onerror = function (ev) {
        if (done || token !== speakToken) return;
        var err = ev && ev.error;
        done = true;
        if (err === 'interrupted' || err === 'canceled' || err === 'not-allowed') { finish(); return; }
        if (!k && zhVoice && retries < 2 && err !== 'network' && err !== 'audio-busy') {
          var failed = zhVoice.name;
          markBadVoice(failed);
          pickVoice();
          retries++;
          toast('The voice “' + failed.replace(/^Microsoft\s+/, '').replace(/\s+-\s+Chinese.*$/, '') + '” could not play here, so it was hidden' +
            (zhVoice ? '. Using ' + zhVoice.name.replace(/^Microsoft\s+/, '').replace(/\s+-\s+Chinese.*$/, '') + ' instead.' : '.'), 6000);
          if (zhVoice) { speakTimers.push(setTimeout(next, 80)); return; }
        }
        toast('Speech could not be played' + (err ? ' (' + err + ')' : '') + '. Your device may need a Chinese voice installed.', 6000);
        finish();
        speakToken++;
      };
      // Safety net for browsers that never fire onend.
      speakTimers.push(setTimeout(advance, 2500 + charLen(text) * 450 / state.rate));
      try {
        if (synth.paused) synth.resume();
        synth.speak(u);
      } catch (e) {
        toast('Speech could not be started: ' + e.message, 6000);
        stopSpeech();
      }
    };
    if (testing) { next(); return; }
    // The audio output (often Bluetooth or USB) can sleep between sounds and swallow the start of a word,
    // and speaking right after cancel() can clip it too. So pause briefly, and when the output has been idle,
    // play a near-silent syllable first to wake it.
    var idle = state.warmup && Date.now() - lastSpeechEnd > 1500;
    speakTimers.push(setTimeout(function () {
      if (token !== speakToken) return;
      if (!idle) { next(); return; }
      var w = new Utterance('嗯');
      w.lang = 'zh-CN';
      if (zhVoice) w.voice = zhVoice;
      w.volume = 0.01;
      w.rate = 1.5;
      var warmed = false;
      var go = function () { if (warmed) return; warmed = true; if (token === speakToken) speakTimers.push(setTimeout(next, 60)); };
      w.onend = go;
      w.onerror = go;
      speakTimers.push(setTimeout(go, 1500));
      try { synth.speak(w); } catch (e) { go(); }
    }, 150));
  }
  function speakCurrent() {
    var i = currentIndex();
    if (i === null) return;
    var c = cards[i];
    speakParts([c.zh].concat(c.ex.map(function (e) { return e.zh; })), els.btnSpeak);
  }
  function speakExample(k, btn) {
    var i = currentIndex();
    if (i === null || !cards[i].ex[k]) return;
    speakParts([cards[i].ex[k].zh], btn);
  }

