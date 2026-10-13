  /* ---------- Chinese interface labels ---------- */
  // English label → [Chinese, pinyin]. The "Interface labels" setting shows English, 中文 + English (the default) or 中文 only.
  // In 中文 only the English stays in the page, visually hidden, so screen readers still read it; the tooltip shows both.
  var LABEL_MODES = { both: '中文 + English', en: 'English', zh: '中文 only' };
  var ZH_LABELS = {
    'All cards': ['全部', 'quánbù'], 'Due': ['复习', 'fùxí'], 'Learning': ['学习中', 'xuéxí zhōng'], 'New': ['新卡片', 'xīn kǎpiàn'], 'Hardest': ['易错', 'yìcuò'],
    'Still learning': ['还在学', 'hái zài xué'], 'Skip': ['跳过', 'tiàoguò'], 'I know it': ['我会了', 'wǒ huì le'],
    'Hard': ['难', 'nán'], 'Good': ['好', 'hǎo'], 'Easy': ['容易', 'róngyì'],
    'Today': ['今天', 'jīntiān'], 'Progress': ['进度', 'jìndù'], 'Collection': ['成就', 'chéngjiù'], 'Ladder': ['阶梯', 'jiētī'], 'Practice style': ['练习方式', 'liànxí fāngshì'], 'Study settings': ['学习设置', 'xuéxí shèzhì'], 'Your progress': ['我的进度', 'wǒ de jìndù'],
    'Today\u2019s quests': ['每日任务', 'měirì rènwu'], 'Daily goal': ['每日目标', 'měirì mùbiāo'], 'Coming reviews': ['复习计划', 'fùxí jìhuà'],
    'Last 14 days': ['最近两周', 'zuìjìn liǎng zhōu'], 'Calendar': ['日历', 'rìlì'], 'What you can read': ['阅读能力', 'yuèdú nénglì'], 'Your stats': ['统计', 'tǒngjì'],
    'Challenges': ['挑战', 'tiǎozhàn'], 'Seals': ['印章', 'yìnzhāng'], 'By topic': ['话题', 'huàtí'], 'By HSK level': ['等级', 'děngjí'],
    'Settings': ['设置', 'shèzhì'], 'What\'s new': ['新功能', 'xīn gōngnéng'], 'How it works': ['使用说明', 'shǐyòng shuōmíng'], 'Topics': ['话题', 'huàtí'], 'Your panda': ['我的熊猫', 'wǒ de xióngmāo'],
    'All words': ['全部词语', 'quánbù cíyǔ'], 'All sentences': ['全部句子', 'quánbù jùzi'],
    'Cards': ['卡片', 'kǎpiàn'], 'Translations': ['翻译', 'fānyì'], 'Rehearse': ['温习', 'wēnxí'], 'Start': ['开始', 'kāishǐ'], 'Voice': ['语音', 'yǔyīn'], 'Sync across devices': ['同步', 'tóngbù'], 'Sync': ['同步', 'tóngbù'], 'Languages': ['语言', 'yǔyán'], 'Data': ['数据', 'shùjù'], 'Progress and checks': ['进度和自检', 'jìndù hé zìjiǎn']
  };
  var PRACTICE_ZH = { zh: '认字', reverse: '中文怎么说', listen: '听力', choice: '选择题', hanzi: '只看汉字', tone: '听声调', tonepair: '声调组合', cloze: '填空', pairs: '易混词',
    's-zh': '读句子', 's-reverse': '说句子', 's-listen': '听句子', 's-choice': '句子选择题', 's-hanzi': '只看汉字', 's-build': '组句' };
  var GROUP_ZH = { Words: '词语', Sentences: '句子', Rehearse: '温习' };
  // A label unit: the Chinese and the English, stacked in buttons, side by side in headings.
  function zhLabel(en, inline) {
    var z = ZH_LABELS[en];
    if (!z) return document.createTextNode(en);
    var w = el('span', 'lbl' + (inline ? ' inline' : ''));
    w.title = z[0] + ' ' + z[1] + ' · ' + en;
    var zl = el('span', 'zl', z[0]);
    zl.setAttribute('lang', 'zh-CN');
    w.appendChild(zl);
    w.appendChild(el('span', 'el', en));
    return w;
  }
  function setLabel(node, en, inline) { node.textContent = ''; node.appendChild(zhLabel(en, inline)); }
  // Turns every [data-lbl] element of the static page into a label unit once, at start-up.
  function upgradeLabels() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-lbl]'), function (n) {
      if (!n.querySelector('.lbl')) setLabel(n, n.textContent.trim(), n.getAttribute('data-lbl') === 'inline');
    });
  }
  // Labels switch with a class on <body>; the practice menu, which cannot hold markup, is rewritten.
  /* ---------- colour themes ---------- */
  // Ink is the dark default; Sepia is a warm light theme (src/styles/09-sepia.css). The choice stays on this device
  // (DEVICE_ONLY) and is mirrored in its own storage key, which the page reads before it paints.
  var THEMES = { ink: { name: 'Ink (dark)', color: '#12171d', scheme: 'dark' }, sepia: { name: 'Sepia (light)', color: '#f1e8cf', scheme: 'light' } };
  var THEME_KEY = 'mandarin300.theme';
  function applyTheme() {
    var t = THEMES[state.theme] ? state.theme : 'ink';
    if (t === 'ink') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    var tc = document.querySelector('meta[name="theme-color"]'), cs = document.querySelector('meta[name="color-scheme"]');
    if (tc) tc.setAttribute('content', THEMES[t].color);
    if (cs) cs.setAttribute('content', THEMES[t].scheme);
    if (testing) return;
    try { window.localStorage.setItem(THEME_KEY, t); } catch (e) { /* storage blocked: the theme still applies until reload */ }
  }
  function applyLabelMode() {
    var m = state.labels;
    ['en', 'both', 'zh'].forEach(function (k) { document.body.classList.toggle('labels-' + k, m === k); });
    var pick = function (zh, en) { return !zh || m === 'en' ? en : m === 'both' ? zh + ' · ' + en : zh; };
    Array.prototype.forEach.call(els.optPractice.querySelectorAll('optgroup'), function (g) {
      if (!g.hasAttribute('data-en')) g.setAttribute('data-en', g.label);
      g.label = pick(GROUP_ZH[g.getAttribute('data-en')], g.getAttribute('data-en'));
    });
    Array.prototype.forEach.call(els.optPractice.options, function (o) {
      if (!o.hasAttribute('data-en')) o.setAttribute('data-en', o.textContent);
      o.textContent = pick(PRACTICE_ZH[o.value], o.getAttribute('data-en'));
    });
    syncPracticeButton();
  }

