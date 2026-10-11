  /* ---------- the panda ---------- */
  var PET_STAGES = [[0, '新生', 'Newborn'], [100, '幼崽', 'Cub'], [400, '少年', 'Youngster'], [1200, '成年', 'Grown up'], [3000, '大师', 'Sage']];
  function petTotal() { return Object.keys(state.activity).reduce(function (n, k) { return n + dayAnswers(k); }, 0); }
  function petStage(total) { var s = 0; PET_STAGES.forEach(function (x, i) { if (total >= x[0]) s = i; }); return s; }
  // hungry: nothing yet today; eating: on the way; full: daily goal met; sleepy: late at night and not fed; missed: nothing yesterday or today.
  function petMood(hour) {
    var today = dayAnswers(dayKey()), h = hour == null ? new Date().getHours() : hour;
    if (today >= state.goal) return 'full';
    if (today > 0) return 'eating';
    if (h >= 22 || h < 6) return 'sleepy';
    if (petTotal() > 0 && !dayActive(addDays(-1))) return 'missed';
    return 'hungry';
  }
  var PET_MOOD_TEXT = { hungry: 'is hungry. Answer a few cards to feed it.', eating: 'is munching happily. Keep going!', full: 'is full and happy. Daily goal reached!',
    sleepy: 'is sleepy. A few cards before bed?', missed: 'missed you yesterday. Welcome back!' };
  // Ink-and-paper panda; stage adds a scarf, bamboo and a scholar's cap; mood changes eyes and mouth.
  function pandaSvg(stage, mood, big) {
    var ink = '#0e1216', paper = '#f1ece2', red = '#e04a2f', sc = [0.74, 0.84, 0.92, 1, 1][stage];
    var eyes = mood === 'sleepy' ? '<path d="M44 51q5 3 10 0M66 51q5 3 10 0" stroke="' + paper + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
      : mood === 'full' ? '<path d="M44 53q5-6 10 0M66 53q5-6 10 0" stroke="' + paper + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
      : '<circle class="eye" cx="49" cy="51" r="' + (mood === 'missed' ? 3.6 : 3.2) + '" fill="' + paper + '"/><circle class="eye" cx="71" cy="51" r="' + (mood === 'missed' ? 3.6 : 3.2) + '" fill="' + paper + '"/>';
    var mouth = mood === 'missed' || mood === 'hungry' ? '<path d="M54 71q6-5 12 0" stroke="' + ink + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
      : mood === 'sleepy' ? '<ellipse cx="60" cy="69" rx="2.6" ry="2" fill="' + ink + '"/>'
      : '<g class="mouth-open" style="transform-box:fill-box;transform-origin:center"><path d="M53 67q7 7 14 0" stroke="' + ink + '" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>';
    var blush = mood === 'full' ? '<circle cx="41" cy="64" r="5" fill="' + red + '" opacity=".35"/><circle cx="79" cy="64" r="5" fill="' + red + '" opacity=".35"/>' : '';
    var scarf = stage >= 2 ? '<path d="M38 80q22 10 44 0l-2 8q-20 8-40 0z" fill="' + red + '"/><path d="M72 85l6 14-7-2z" fill="' + red + '"/>' : '';
    var bamboo = stage >= 3 ? '<g><rect x="96" y="44" width="7" height="70" rx="3" fill="#5aa469"/><path d="M96 62h7M96 82h7M96 100h7" stroke="#3d7a4a" stroke-width="2"/><path d="M103 56q12-6 16 2q-10 2-16-2z" fill="#6cc07c"/></g>' : '';
    var cap = stage >= 4 ? '<path d="M34 26l26-10 26 10-26 10z" fill="' + ink + '" stroke="' + paper + '" stroke-width="1.2"/><path d="M84 27v12" stroke="' + red + '" stroke-width="2.4"/><circle cx="84" cy="41" r="2.6" fill="' + red + '"/>' : '';
    var zz = mood === 'sleepy' ? '<text class="zz" x="88" y="26" font-size="13" font-weight="700" fill="' + paper + '">z</text><text class="zz" x="96" y="16" font-size="10" font-weight="700" fill="' + paper + '" style="animation-delay:.6s">z</text>' : '';
    var leaf = '<path class="leaf" d="M60 70q8-10 18-8q-6 9-18 8z" fill="#6cc07c" opacity="0"/>';
    var body = big ? '<ellipse cx="60" cy="98" rx="30" ry="22" fill="' + paper + '" stroke="' + ink + '" stroke-width="2"/><ellipse cx="34" cy="94" rx="9" ry="14" fill="' + ink + '" transform="rotate(20 34 94)"/><ellipse cx="86" cy="94" rx="9" ry="14" fill="' + ink + '" transform="rotate(-20 86 94)"/><ellipse cx="45" cy="117" rx="10" ry="6" fill="' + ink + '"/><ellipse cx="75" cy="117" rx="10" ry="6" fill="' + ink + '"/>' : '';
    var moon = '<circle cx="60" cy="60" r="' + (big ? 58 : 60) + '" fill="#2f4a41"/>';
    var head = '<circle cx="36" cy="30" r="10" fill="' + ink + '"/><circle cx="84" cy="30" r="10" fill="' + ink + '"/>' +
      '<circle cx="60" cy="55" r="29" fill="' + paper + '" stroke="' + ink + '" stroke-width="2"/>' +
      '<ellipse cx="48" cy="53" rx="8" ry="10.5" fill="' + ink + '" transform="rotate(-28 48 53)"/><ellipse cx="72" cy="53" rx="8" ry="10.5" fill="' + ink + '" transform="rotate(28 72 53)"/>' +
      eyes + '<ellipse cx="60" cy="63" rx="4.4" ry="3.2" fill="' + ink + '"/>' + mouth + blush;
    var figure = big ? '<g class="breathe" transform="translate(60 64) scale(' + sc + ') translate(-60 -64)">' + bamboo + body + scarf + head + cap + leaf + '</g>'
      : '<g class="breathe" transform="translate(0 6)">' + scarf + head + cap + leaf + '</g>';
    return '<svg class="panda mood-' + mood + '" viewBox="0 0 120 ' + (big ? 124 : 120) + '" role="img" aria-hidden="true">' + moon + figure + zz + '</svg>';
  }
  function renderPet(effect) {
    var total = petTotal(), st = petStage(total), mood = petMood();
    els.petMini.innerHTML = pandaSvg(st, mood, false);
    var name = state.petName || '宝宝';
    els.btnPet.setAttribute('aria-label', 'Your panda ' + name + ': ' + PET_STAGES[st][2].toLowerCase() + ', ' + PET_MOOD_TEXT[mood].replace(/\.$/, '') + '. Open the panda');
    if (effect && !testing && !reduceMotion) {
      var svg = els.petMini.querySelector('svg');
      svg.classList.add(effect);
    }
    if (els.petView.hidden) return;
    els.petBig.innerHTML = pandaSvg(st, mood, true);
    els.petName.textContent = name;
    els.petStageName.textContent = PET_STAGES[st][1] + ' · ' + PET_STAGES[st][2];
    els.petMood.textContent = name + ' ' + PET_MOOD_TEXT[mood];
    var today = dayAnswers(dayKey()), next = PET_STAGES[st + 1];
    els.petFed.style.width = pct(Math.min(today, state.goal), state.goal) + '%';
    els.petFedText.textContent = Math.min(today, state.goal) + ' / ' + state.goal + ' 🎋';
    els.petGrow.style.width = (next ? pct(total - PET_STAGES[st][0], next[0] - PET_STAGES[st][0]) : 100) + '%';
    els.petGrowText.textContent = next ? total + ' / ' + next[0] + ' to ' + next[2].toLowerCase() : total + ' · fully grown';
  }
  function openPet() {
    els.petNameInput.value = state.petName || '宝宝';
    openOverlay(els.petView, els.btnClosePet);
    renderPet();
  }
  function petTap() {
    var svg = els.petBig.querySelector('svg');
    if (svg && !reduceMotion) { svg.classList.remove('hop'); void svg.getBoundingClientRect(); svg.classList.add('hop'); }
    if (testing || reduceMotion) return;
    for (var i = 0; i < 3; i++) {
      var h = el('span', 'heart', '❤');
      h.style.setProperty('--dx', (i - 1) * 28 + 'px');
      h.style.animationDelay = i * 0.12 + 's';
      h.style.color = 'var(--cinnabar)';
      els.petBig.appendChild(h);
      setTimeout(function (n) { return function () { if (n.parentNode) n.parentNode.removeChild(n); }; }(h), 1400);
    }
    buzz(10);
  }
  // A "+10 XP" that floats up from the button that was pressed.
  function floatXp(n, kind) {
    if (testing || reduceMotion) return;
    var btn = kind === 'known' ? els.btnKnown : els.btnLearning, r = btn.getBoundingClientRect();
    var f = el('span', 'xp-float' + (kind === 'known' ? '' : ' miss'), '+' + n + ' XP');
    f.style.left = (r.left + r.width / 2) + 'px';
    f.style.top = (r.top - 6) + 'px';
    document.body.appendChild(f);
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 950);
    btn.classList.remove('nudge');
    void btn.offsetWidth;
    btn.classList.add('nudge');
  }

