  /* ---------- rehearse: known languages practised with Chinese ---------- */
  // A rehearsed language is a skill ('say:ro', see rebuildSkills) with a practice style 'rh-ro': the card shows the Chinese
  // word and asks for it in that language. Only words already started in Chinese are rehearsed.
  // The rehearse card shown in place inside a word deck ({ zh, code }); null otherwise (see maybeInterject).
  var rehearseCard = null;
  function isRehearseStyle(p) { return typeof p === 'string' && p.indexOf('rh-') === 0; }
  function rehearseCode(p) { return isRehearseStyle(p) ? p.slice(3) : ''; }
  // The style the card on screen is answered in: the interjected rehearse card's, or the chosen one.
  function practiceNow() { return rehearseCard ? 'rh-' + rehearseCard.code : state.practice; }
  function wordByZh(zh) {
    for (var i = 0; i < wordCards.length; i++) if (wordCards[i].zh === zh) return wordCards[i];
    return null;
  }
  function rehearseStarted(c) {
    return !!(marksOf('read').status[c.zh] || marksOf('recall').status[c.zh] || marksOf('listen').status[c.zh]);
  }
  // Words started in Chinese with a meaning in k: due in k first, then Learning in k, then the most missed,
  // then new ones by frequency rank, then the rest.
  function rehearsePool(k) {
    var m = marksOf(rehearseSkill(k)), today = dayKey();
    var group = function (c) {
      var r = m.srs[c.zh];
      if (r && r.d <= today) return 0;
      if (m.status[c.zh] === 'learning') return 1;
      if (m.misses[c.zh]) return 2;
      return m.status[c.zh] ? 4 : 3;
    };
    return wordCards.filter(function (c) { return mean(c, k) && rehearseStarted(c); }).sort(function (a, b) {
      var ga = group(a), gb = group(b);
      if (ga !== gb) return ga - gb;
      if (ga === 0) return m.srs[a.zh].d < m.srs[b.zh].d ? -1 : m.srs[a.zh].d > m.srs[b.zh].d ? 1 : a.n - b.n;
      if (ga === 2) return (m.misses[b.zh] || 0) - (m.misses[a.zh] || 0) || a.n - b.n;
      if (ga === 3) return (a.rk || 1e6) - (b.rk || 1e6) || a.n - b.n;
      return a.n - b.n;
    });
  }
