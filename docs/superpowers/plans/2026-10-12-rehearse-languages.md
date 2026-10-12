# Rehearse Known Languages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any meaning language (English, Hungarian, German, Spanish, Romanian) be set to *Rehearse*, so it gets its own marks and review schedule, comes up during Chinese study, takes turns as the main meaning, and can be read aloud.

**Architecture:** A rehearsed language is a fourth kind of skill (`say:<code>`) next to reading, recall and listening, so it reuses the existing marks, Leitner schedule, undo, due lists and sync. A practice style `rh-<code>` drives the Chinese → language card; a small "interjection" shows one such card in place inside a normal word deck. The main meaning is picked per card per day from a hash.

**Tech Stack:** Plain ES5 JavaScript in one IIFE (`src/js/*.js`, joined by `scripts/build.js` in file-name order), CSS in `src/styles/*.css`, markup in `src/index.html`; tests are in-app self-check entries run headless with `npm run selfcheck`.

**Spec:** `docs/superpowers/specs/2026-10-12-rehearse-languages-design.md`

## Global Constraints

- Work in the worktree `D:\source\repos\chinese\.local\rehearse` on branch `feature/rehearse`. Never push; the user pushes.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No external scripts, fonts or images. ES5 only (no arrow functions, `let`, template strings): the existing code is ES5 and `scripts/verify.js` parses it as is.
- Two-space indent inside the IIFE; sections marked `/* ---------- name ---------- */`.
- Any element id used from JS goes in `REQUIRED_IDS` (`src/js/01-core.js`); wired controls also go in `CORE_BUTTONS`. `els.<id>` only exists for ids in `REQUIRED_IDS`.
- A new persisted field goes in both `progressSnapshot()` and `restore()` (`src/js/06-persistence.js`).
- Snapshot `FORMAT` becomes `6` (`src/js/09-srs-skills.js`).
- New buttons and headings get a `ZH_LABELS` entry (`src/js/02-labels.js`, shape `'English': ['中文', 'pīnyīn']`). Rehearse = `温习 wēnxí`.
- English UI text uses American spelling ("Practice" for the noun on new UI).
- Layout must work at 320, 375 and 1440 px with no sideways scroll; keep `env(safe-area-inset-*)` padding.
- Verify after every task: `npm run check`, `npm run build`, `npm run selfcheck` (all checks pass). Before the last commit also `npm run selfcheck -- dist/site/index.html`.

## Review Focus

1. **Role strings are truthy.** After the change `state.langs[k]` is `'off'`, which is truthy; any leftover `if (state.langs.en)` silently treats Off as on. Expect every read to go through `langRole()`/`langsOn()`. (Task 1 fixes `rungName()` and pins it with a test.)
2. **A saved `rh-ro` practice with Romanian no longer rehearsed** (another device switched it to Show, then synced). Expect the app to open on Chinese → meaning, not crash or show an empty deck. (Task 2 test.)
3. **Undo across an interjected card.** Undoing while the rehearse card is on screen must restore the *previous Chinese card* and drop the rehearse card; undoing after answering it must bring the rehearse card back with its old mark. (Task 5 test.)
4. **Sentence deck and challenges never show rehearse cards**, and the main meaning in challenges is always the base language, so a blitz score is comparable across days. (Tasks 4 and 5 tests.)
5. **Older saves** (`langs` booleans, no `rehearse`, format 5) restore into the new shape without losing which languages were on. (Task 1 test.)

---

## File map

| File | Change |
|---|---|
| `src/js/01-core.js` | Role helpers (`LANG_ROLES`, `langRole`, `langsOn`, `langsRehearsed`, `langName`), rotation (`baseLang`, `mainLang`, `langsFor`, `mainMeaning`, `baseMeaning`), state defaults, ids. |
| `src/js/02-labels.js` | Labels, `GROUP_ZH.Rehearse`. |
| `src/js/03-data.js` | `syncSettingsUI()` for roles and rehearse settings, `langsChanged()`, `useDeckType()` clears the interjection. |
| `src/js/05-sync.js` | Conflict dialog shows rehearse known counts. |
| `src/js/06-persistence.js` | `readLangs()`, `readRehearse()`, snapshot/restore of roles, rehearse settings, `say:*` marks, `readMeaning`, `rehearseSeen`, `activity.r`. |
| `src/js/07-deck.js` | Rehearse deck order; `setMode()` clears the interjection. |
| `src/js/08-progress-view.js` | Per-skill line includes rehearsed languages; `recordAnswer()` counts rehearse answers. |
| `src/js/09-srs-skills.js` | `FORMAT = 6`, `BASE_SKILLS`, `rebuildSkills()`, `rehearseSkill()`, skill seals for all skills. |
| `src/js/11-practice.js` | Practice sheet rows per skill, `inPractice()`, rehearse card face, rotation in prompts and multiple choice. |
| `src/js/12-game.js` | Challenges use `baseMeaning`; rehearse quest; recap; rehearse strip in the Today popover. |
| `src/js/12a-rehearse.js` (new) | Pool, interjection, round, `withSkill`, `practiceNow`, `wordByZh`. Sorts after `12-game.js` (`-` < `a`). |
| `src/js/15-cards.js` | `act()`/`undo()`/`render()`/`showCard()`/`setRevealed()` integrate the rehearse card and main-language line. |
| `src/js/16-speech.js` | Any-language speech (`LANG_TAGS`, `voiceFor`, `canSpeak`, parts as `{ text, lang }`), `meaningSpeech()`. |
| `src/js/18-selfcheck.js` | Existing translations test updated to roles; calls `rehearseTests(add)`. |
| `src/js/18a-selfcheck-rehearse.js` (new) | `REHEARSE_TESTS` and `rehearseTests(add)`. |
| `src/js/19-wiring.js` | Handlers for roles, shares, rehearse settings, rehearse strip, speaker buttons, read-meaning setting. |
| `src/index.html` | Translations section, practice menu group, `#cardRehearse`, `#cardMeanMain`, `#rehearseStrip`, read-meaning select, help entry. |
| `src/styles/08-features.css` | Styles for the new elements. |
| `data/changelog.json`, `CLAUDE.md`, `README.md` | Release notes and docs. |

---

### Task 1: Language roles (Off / Show / Rehearse) and rehearse settings

**Files:**
- Modify: `src/js/01-core.js` (meaning-languages section, `state` defaults, `REQUIRED_IDS`, `CORE_BUTTONS`)
- Modify: `src/js/06-persistence.js` (`progressSnapshot`, `restore`, new `readLangs`, `readRehearse`)
- Modify: `src/js/09-srs-skills.js` (`FORMAT`)
- Modify: `src/js/03-data.js` (`syncSettingsUI`, new `langsChanged`)
- Modify: `src/js/19-wiring.js` (language handlers)
- Modify: `src/js/12-game.js` (`rungName`)
- Modify: `src/js/18-selfcheck.js` (existing `langRes` test; call `rehearseTests`)
- Create: `src/js/18a-selfcheck-rehearse.js`
- Modify: `src/index.html` (Translations section)
- Modify: `src/styles/08-features.css`

**Interfaces:**
- Produces: `LANG_ROLES`, `langRole(k) → 'off'|'show'|'rehearse'`, `langsOn() → string[]`, `langsRehearsed() → string[]`, `langName(k) → string`, `readLangs(obj) → {en,hu,de,es,ro}`, `readRehearse(obj) → {share, every, afterGoal}`, `langsChanged()`, `state.rehearse = { share: {code: 0–50}, every: 0|6|8|12, afterGoal: bool }`, `REHEARSE_TESTS` (array of `{ title, run(add) }`), `rehearseTests(add)`, `resetRehearseTestState(keep)`.

- [ ] **Step 1: Create the test file with the first test**

Create `src/js/18a-selfcheck-rehearse.js`:

```js
  /* ---------- self-check: rehearse known languages ---------- */
  // Each entry runs inside functionalTest (testing = true). rehearseTests puts the languages, the rehearse
  // settings, the practice style and the deck back after every entry.
  var REHEARSE_TESTS = [];
  function resetRehearseTestState(keep) {
    state.langs = JSON.parse(JSON.stringify(keep.langs));
    state.rehearse = JSON.parse(JSON.stringify(keep.rehearse));
    syncSettingsUI();
  }
  function rehearseTests(add) {
    var keep = { langs: JSON.parse(JSON.stringify(state.langs)), rehearse: JSON.parse(JSON.stringify(state.rehearse)),
      practice: state.practice, deckType: state.deckType, deck: state.deck.slice(), pos: state.pos, revealed: state.revealed };
    REHEARSE_TESTS.forEach(function (t) {
      try { t.run(add); } catch (e) { add(t.title, false, 'The test stopped with an error: ' + e.message); }
      resetRehearseTestState(keep);
    });
    useDeckType(keep.deckType);
    state.practice = keep.practice;
    useSkill(skillOf(state.practice));
    state.deck = keep.deck; state.pos = keep.pos; state.revealed = keep.revealed;
    syncPracticeSelect();
    render(false);
  }

  REHEARSE_TESTS.push({ title: 'Translation roles: off, show, rehearse', run: function (add) {
    var a = readLangs({ en: true, hu: false, de: 'rehearse', es: 'bogus' });
    var conv = a.en === 'show' && a.hu === 'off' && a.de === 'rehearse' && a.es === 'off' && a.ro === 'off';
    var b = readLangs(null);
    var dflt = b.en === 'show' && b.hu === 'show' && b.de === 'off' && b.ro === 'off';
    var r = readRehearse({ every: 7, share: { ro: 80, de: -3 }, afterGoal: false });
    var rs = r.every === 8 && r.share.ro === 50 && r.share.de === 0 && r.afterGoal === false && readRehearse(null).every === 8;
    // 'off' is a truthy string: the ladder must still fall back to Hungarian names when English is off.
    state.langs = { en: 'off', hu: 'show', de: 'off', es: 'off', ro: 'off' };
    var rung = { en: 'Greet', hu: 'Köszönés' };
    var truthy = rungName(rung) === 'Köszönés';
    // The last language on cannot be switched off.
    state.langs = { en: 'show', hu: 'off', de: 'off', es: 'off', ro: 'off' };
    syncSettingsUI();
    els.optLangEn.value = 'off';
    els.optLangEn.dispatchEvent(new Event('change'));
    var lastStays = state.langs.en === 'show' && els.optLangEn.value === 'show';
    // Rehearse shows the share slider (default 30%) and the rehearse options.
    els.optLangHu.value = 'rehearse';
    els.optLangHu.dispatchEvent(new Event('change'));
    var slider = state.langs.hu === 'rehearse' && !els.optShareHu.hidden && state.rehearse.share.hu === 30 && !els.rehearseOpts.hidden && els.optShareEn.hidden;
    add('Translation roles: off, show, rehearse', conv && dflt && rs && truthy && lastStays && slider,
      'old on/off saves convert: ' + conv + ', defaults: ' + dflt + ', rehearse settings clamp: ' + rs + ', Off counts as off: ' + truthy +
      ', the last one stays on: ' + lastStays + ', Rehearse shows its share slider: ' + slider);
  } });
```

In `src/js/18-selfcheck.js`, directly after the line `      add('Suggestion chip in the Today row', sugRes.ok, sugRes.d);` add:

```js
      rehearseTests(add);
```

- [ ] **Step 2: Run the self-check to see it fail**

Run: `npm run build && npm run selfcheck`
Expected: the build passes; the self-check prints `FAIL Translation roles: off, show, rehearse` (error: `readLangs is not defined`) and exits non-zero.

- [ ] **Step 3: Role helpers and state defaults (`src/js/01-core.js`)**

Replace the block from `function langsOn() {` through `function mainMeaning(o) { return mean(o, langsOn()[0]); }` with:

```js
  // Each language is off, shown, or rehearsed (shown and practised: see 12a-rehearse.js).
  var LANG_ROLES = { off: true, show: true, rehearse: true };
  var LANG_NAMES = { en: 'English', hu: 'Hungarian', de: 'German', es: 'Spanish', ro: 'Romanian' };
  function langName(k) { return LANG_NAMES[k] || k; }
  function langRole(k) { return LANG_AVAILABLE[k] && LANG_ROLES[state.langs[k]] ? state.langs[k] : 'off'; }
  function langsOn() {
    var on = MEANING_LANGS.map(function (l) { return l[0]; }).filter(function (k) { return langRole(k) !== 'off'; });
    return on.length ? on : ['en'];
  }
  function langsRehearsed() { return MEANING_LANGS.map(function (l) { return l[0]; }).filter(function (k) { return langRole(k) === 'rehearse'; }); }
  function mainMeaning(o) { return mean(o, langsOn()[0]); }
```

Also update the comment above `MEANING_LANGS` to: `// Settings sets each one to Off, Show or Rehearse; at least one stays on. The first one on is the base meaning.`

In the `state` literal, replace `langs: { en: true, hu: true, de: false, es: false, ro: false },` with:

```js
langs: { en: 'show', hu: 'show', de: 'off', es: 'off', ro: 'off' }, rehearse: { share: {}, every: 8, afterGoal: true },
```

Add to the start of `REQUIRED_IDS`: `'rehearseOpts', 'optRehearseEvery', 'optRehearseAfterGoal', 'optShareEn', 'optShareHu', 'optShareDe', 'optShareEs', 'optShareRo', 'optShareEnOut', 'optShareHuOut', 'optShareDeOut', 'optShareEsOut', 'optShareRoOut', `
Add to the start of `CORE_BUTTONS`: `'optRehearseEvery', 'optRehearseAfterGoal', 'optShareEn', 'optShareHu', 'optShareDe', 'optShareEs', 'optShareRo', `

- [ ] **Step 4: Persistence (`src/js/06-persistence.js`)**

Add above `function restore(saved) {`:

```js
  // Language roles from a save. Older saves stored true/false; anything else falls back to the default.
  function readLangs(src) {
    var out = { en: 'show', hu: 'show', de: 'off', es: 'off', ro: 'off' };
    if (src && typeof src === 'object') {
      MEANING_LANGS.forEach(function (l) {
        var v = src[l[0]];
        if (v === true) out[l[0]] = 'show';
        else if (v === false) out[l[0]] = 'off';
        else if (typeof v === 'string' && LANG_ROLES[v]) out[l[0]] = v;
      });
    }
    return out;
  }
  function readRehearse(src) {
    src = src && typeof src === 'object' ? src : {};
    var out = { share: {}, every: [0, 6, 8, 12].indexOf(src.every) !== -1 ? src.every : 8, afterGoal: src.afterGoal !== false };
    if (src.share && typeof src.share === 'object') {
      MEANING_LANGS.forEach(function (l) { if (typeof src.share[l[0]] === 'number') out.share[l[0]] = clampInt(src.share[l[0]], 0, 50); });
    }
    return out;
  }
```

In `restore()`, delete the existing block

```js
    state.langs = { en: true, hu: true, de: false, es: false, ro: false };
    if (saved && saved.langs && typeof saved.langs === 'object') {
      MEANING_LANGS.forEach(function (l) { if (typeof saved.langs[l[0]] === 'boolean') state.langs[l[0]] = saved.langs[l[0]]; });
    }
```

and insert, directly **above** the line `    if (saved && PRACTICE[saved.practice]) state.practice = saved.practice;`:

```js
    state.langs = readLangs(saved && saved.langs);
    if (!MEANING_LANGS.some(function (l) { return langRole(l[0]) !== 'off'; })) state.langs.en = 'show';
    state.rehearse = readRehearse(saved && saved.rehearse);
```

In `progressSnapshot()`, after `      langs: state.langs,` add `      rehearse: state.rehearse,`.

- [ ] **Step 5: Format (`src/js/09-srs-skills.js`)**

Replace the `FORMAT` comment and line with:

```js
  // Snapshot format. 2 added `skills`, 5 added `rungs`, 6 turned `langs` into roles and added rehearse skills. The server refuses
  // uploads older than the stored format, and this copy refuses to apply progress written by a newer one, so neither side drops
  // what it does not understand.
  var FORMAT = 6;
```

- [ ] **Step 6: Settings markup (`src/index.html`)**

Replace the note `<p class="set-note">Which meanings to show …</p>` and the whole `<div class="lang-switches">…</div>` in the Translations section with:

```html
        <p class="set-note">Show a language on cards, or rehearse it: it then also gets its own marks, comes up during your Chinese practice and sometimes takes the main meaning's place. At least one stays on; the first one on is the base meaning.</p>
        <div class="lang-switches">
          <div class="set-row lang-row" data-mlang="en"><label for="optLangEn">English</label><select id="optLangEn"><option value="off">Off</option><option value="show">Show</option><option value="rehearse">Rehearse</option></select><input type="range" id="optShareEn" class="lang-share" min="0" max="50" step="10" aria-label="English: share of cards with English as the main meaning"><output id="optShareEnOut" for="optShareEn"></output></div>
          <div class="set-row lang-row" data-mlang="hu"><label for="optLangHu">Magyar (Hungarian)</label><select id="optLangHu"><option value="off">Off</option><option value="show">Show</option><option value="rehearse">Rehearse</option></select><input type="range" id="optShareHu" class="lang-share" min="0" max="50" step="10" aria-label="Hungarian: share of cards with Hungarian as the main meaning"><output id="optShareHuOut" for="optShareHu"></output></div>
          <div class="set-row lang-row" data-mlang="de"><label for="optLangDe">Deutsch (German)</label><select id="optLangDe"><option value="off">Off</option><option value="show">Show</option><option value="rehearse">Rehearse</option></select><input type="range" id="optShareDe" class="lang-share" min="0" max="50" step="10" aria-label="German: share of cards with German as the main meaning"><output id="optShareDeOut" for="optShareDe"></output></div>
          <div class="set-row lang-row" data-mlang="es"><label for="optLangEs">Español (Spanish)</label><select id="optLangEs"><option value="off">Off</option><option value="show">Show</option><option value="rehearse">Rehearse</option></select><input type="range" id="optShareEs" class="lang-share" min="0" max="50" step="10" aria-label="Spanish: share of cards with Spanish as the main meaning"><output id="optShareEsOut" for="optShareEs"></output></div>
          <div class="set-row lang-row" data-mlang="ro"><label for="optLangRo">Română (Romanian)</label><select id="optLangRo"><option value="off">Off</option><option value="show">Show</option><option value="rehearse">Rehearse</option></select><input type="range" id="optShareRo" class="lang-share" min="0" max="50" step="10" aria-label="Romanian: share of cards with Romanian as the main meaning"><output id="optShareRoOut" for="optShareRo"></output></div>
        </div>
        <div id="rehearseOpts" class="rehearse-opts" hidden>
          <div class="set-row">
            <label for="optRehearseEvery">Rehearse cards in your Chinese deck</label>
            <select id="optRehearseEvery"><option value="0">Off</option><option value="6">Every 6th card</option><option value="8">Every 8th card</option><option value="12">Every 12th card</option></select>
          </div>
          <label class="switch"><input type="checkbox" id="optRehearseAfterGoal"><span>Offer a short round after the daily goal</span></label>
        </div>
```

- [ ] **Step 7: Settings UI and handlers**

In `src/js/03-data.js`, in `syncSettingsUI()` replace the `['En', 'Hu', 'De', 'Es', 'Ro'].forEach(...)` block with:

```js
    ['En', 'Hu', 'De', 'Es', 'Ro'].forEach(function (K) {
      var k = K.toLowerCase(), role = langRole(k), share = els['optShare' + K], out = els['optShare' + K + 'Out'];
      els['optLang' + K].value = role;
      els['optLang' + K].closest('.lang-row').hidden = !LANG_AVAILABLE[k];
      share.hidden = out.hidden = role !== 'rehearse';
      share.value = String(state.rehearse.share[k] != null ? state.rehearse.share[k] : 30);
      out.textContent = share.value + '%';
    });
    els.rehearseOpts.hidden = !langsRehearsed().length;
    els.optRehearseEvery.value = String(state.rehearse.every);
    els.optRehearseAfterGoal.checked = state.rehearse.afterGoal;
```

Add after `syncSettingsUI()`:

```js
  // After a language's role changes: settings, the card and the save follow.
  function langsChanged() {
    syncSettingsUI();
    render(false);
    save();
  }
```

In `src/js/19-wiring.js` replace the whole `['En', 'Hu', 'De', 'Es', 'Ro'].forEach(function (K) { on('optLang' + K, 'change', … }); });` block with:

```js
    ['En', 'Hu', 'De', 'Es', 'Ro'].forEach(function (K) {
      var k = K.toLowerCase();
      on('optLang' + K, 'change', function () {
        var sel = els['optLang' + K], before = langRole(k);
        state.langs[k] = LANG_ROLES[sel.value] ? sel.value : 'show';
        if (!MEANING_LANGS.some(function (l) { return langRole(l[0]) !== 'off'; })) {
          state.langs[k] = before;
          sel.value = before;
          if (!testing) toast('Keep at least one translation on.');
          return;
        }
        if (state.langs[k] === 'rehearse' && state.rehearse.share[k] == null) state.rehearse.share[k] = 30;
        langsChanged();
      });
      on('optShare' + K, 'input', function () {
        state.rehearse.share[k] = clampInt(els['optShare' + K].value, 0, 50);
        els['optShare' + K + 'Out'].textContent = state.rehearse.share[k] + '%';
        render(false);
        save();
      });
    });
    on('optRehearseEvery', 'change', function () { state.rehearse.every = clampInt(els.optRehearseEvery.value, 0, 12); save(); });
    on('optRehearseAfterGoal', 'change', function () { state.rehearse.afterGoal = els.optRehearseAfterGoal.checked; save(); });
```

In `src/js/12-game.js` replace `function rungName(r) { return !state.langs.en && state.langs.hu ? r.hu : r.en; }` with:

```js
  function rungName(r) { return langRole('en') === 'off' && langRole('hu') !== 'off' ? r.hu : r.en; }
```

- [ ] **Step 8: Update the existing translations test (`src/js/18-selfcheck.js`, `langRes`)**

Inside `var langRes = (function () { … })();` make these replacements:
- `state.langs = { en: false, hu: true, de: false, es: false, ro: false };` → `state.langs = { en: 'off', hu: 'show', de: 'off', es: 'off', ro: 'off' };`
- `if (extra[0]) state.langs[extra[0]] = true;` → `if (extra[0]) state.langs[extra[0]] = 'show';`
- `state.langs = { en: true, hu: false, de: false, es: false, ro: false };` → `state.langs = { en: 'show', hu: 'off', de: 'off', es: 'off', ro: 'off' };`
- `els.optLangEn.checked = false;` → `els.optLangEn.value = 'off';`
- `var lastStays = state.langs.en === true && els.optLangEn.checked === true;` → `var lastStays = state.langs.en === 'show' && els.optLangEn.value === 'show';`
- `.closest('label').hidden` → `.closest('.lang-row').hidden`

- [ ] **Step 9: Styles (`src/styles/08-features.css`)**

Append:

```css
/* Translations: a role per language (Off / Show / Rehearse) and, when rehearsed, its share of main meanings. */
.lang-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 6px 10px; }
.lang-row .lang-share { grid-column: 1; width: 100%; min-width: 0; }
.lang-row output { grid-column: 2; justify-self: end; color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
.rehearse-opts { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
```

- [ ] **Step 10: Run checks**

Run: `npm run check && npm run build && npm run selfcheck`
Expected: all pass, including `ok   Translation roles: off, show, rehearse` and the updated translations test.

- [ ] **Step 11: Commit**

```bash
git add -A src
git commit -m "Translations: each language is Off, Show or Rehearse; format 6

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: A skill per rehearsed language

**Files:**
- Modify: `src/js/09-srs-skills.js` (skills section)
- Modify: `src/js/06-persistence.js` (snapshot `skills`, restore marks, call `rebuildSkills`)
- Modify: `src/js/03-data.js` (`langsChanged` calls `rebuildSkills`)
- Modify: `src/js/11-practice.js` (`PRACTICE_ASK` gets rehearse entries via `rebuildSkills`)
- Modify: `src/js/02-labels.js` (`GROUP_ZH`)
- Modify: `src/index.html` (practice menu group)
- Modify: `src/js/01-core.js` (`REQUIRED_IDS`)
- Test: `src/js/18a-selfcheck-rehearse.js`

**Interfaces:**
- Consumes: `langsRehearsed()`, `langName()` (Task 1).
- Produces: `BASE_SKILLS`, `rehearseSkill(k) → 'say:' + k`, `rebuildSkills()`, `syncRehearseOptions()`, `SKILLS['say:ro'] === 'Romanian'`, `SKILL_OF['rh-ro'] === 'say:ro'`, `PRACTICE['rh-ro']`, `DECK_ONLY['rh-ro'] = ['words', 'zh']`, `SKILL_ZH['say:ro'] === 'RO'`, `skillsSnapshot()`.

- [ ] **Step 1: Write the failing test** (append to `src/js/18a-selfcheck-rehearse.js`)

```js
  REHEARSE_TESTS.push({ title: 'Rehearsed language as its own skill', run: function (add) {
    if (!LANG_AVAILABLE.ro) { add('Rehearsed language as its own skill', true, 'No Romanian data in this build.'); return; }
    state.langs.ro = 'rehearse';
    rebuildSkills();
    var c = wordCards.filter(function (w) { return mean(w, 'ro'); })[0];
    var exists = SKILLS['say:ro'] === 'Romanian' && SKILL_OF['rh-ro'] === 'say:ro' && !!PRACTICE['rh-ro'] && SKILL_ZH['say:ro'] === 'RO' &&
      !!els.optPractice.querySelector('option[value="rh-ro"]');
    var recallBefore = marksOf('recall').status[c.zh] || null;
    useSkill('say:ro');
    state.status[c.zh] = 'learning';
    useSkill('recall');
    var separate = (marksOf('recall').status[c.zh] || null) === recallBefore && marksOf('say:ro').status[c.zh] === 'learning';
    var snap = progressSnapshot();
    var saved = snap.format === 6 && !!snap.skills['say:ro'] && snap.skills['say:ro'].status[c.zh] === 'learning';
    var seal = Array.prototype.some.call(skillMarks(c).querySelectorAll('.sm'), function (s) { return s.textContent === 'RO'; });
    // Back to Show: the skill, the menu entry and a saved rh-ro practice go; the marks stay.
    state.practice = 'rh-ro';
    useSkill('say:ro');
    state.langs.ro = 'show';
    rebuildSkills();
    var gone = !SKILLS['say:ro'] && !els.optPractice.querySelector('option[value="rh-ro"]') && state.practice === 'zh' && state.skill === 'read' &&
      marksOf('say:ro').status[c.zh] === 'learning';
    delete state.marks['say:ro'];
    add('Rehearsed language as its own skill', exists && separate && saved && seal && gone,
      'Romanian skill, style and menu entry: ' + exists + ', its marks are separate from recall: ' + separate + ', saved under skills (format 6): ' + saved +
      ', RO seal on the card: ' + seal + ', set back to Show drops the skill but keeps its marks: ' + gone);
  } });
```

And in `resetRehearseTestState(keep)` add `    rebuildSkills();` directly after the two `state.… = JSON.parse(…)` lines.

- [ ] **Step 2: Run to see it fail**

Run: `npm run build && npm run selfcheck`
Expected: `FAIL Rehearsed language as its own skill` (`rebuildSkills is not defined`), and the Translation roles test also fails through the reset.

- [ ] **Step 3: Skills (`src/js/09-srs-skills.js`)**

Replace `var SKILLS = { read: 'Reading', recall: 'Recall', listen: 'Listening' };` with:

```js
  var BASE_SKILLS = { read: 'Reading', recall: 'Recall', listen: 'Listening' };
  // The three skills plus one per rehearsed language ('say:ro' → 'Romanian'); rebuilt by rebuildSkills().
  var SKILLS = { read: 'Reading', recall: 'Recall', listen: 'Listening' };
  function rehearseSkill(k) { return 'say:' + k; }
  // Rebuilds the rehearse skills and their practice styles (rh-<code>) from the language roles.
  // A skill that goes keeps its marks in state.marks; only the menu entry and the style go.
  function rebuildSkills() {
    SKILLS = {};
    Object.keys(BASE_SKILLS).forEach(function (k) { SKILLS[k] = BASE_SKILLS[k]; });
    Object.keys(SKILL_OF).forEach(function (p) {
      if (p.indexOf('rh-') !== 0) return;
      delete SKILL_OF[p]; delete PRACTICE[p]; delete DECK_ONLY[p]; delete PRACTICE_ASK[p]; delete PRACTICE_ZH[p];
    });
    langsRehearsed().forEach(function (k) {
      var sk = rehearseSkill(k), p = 'rh-' + k;
      SKILLS[sk] = langName(k);
      SKILL_ZH[sk] = k.toUpperCase();
      SKILL_OF[p] = sk;
      PRACTICE[p] = 'Chinese → ' + langName(k);
      PRACTICE_ASK[p] = 'See the word, recall it in ' + langName(k);
      PRACTICE_ZH[p] = '温习';
      DECK_ONLY[p] = ['words', 'zh'];
    });
    if (!PRACTICE[state.practice]) state.practice = 'zh';
    if (!SKILLS[state.skill]) { stashSkill(); state.skill = 'read'; loadSkill(); undoStack = []; }
    if (state.skill !== skillOf(state.practice)) useSkill(skillOf(state.practice));
    syncRehearseOptions();
  }
  // The practice menu's Rehearse group: one option per rehearsed language.
  function syncRehearseOptions() {
    var g = els.optRehearseGroup;
    if (!g) return;
    g.textContent = '';
    langsRehearsed().forEach(function (k) {
      var o = document.createElement('option');
      o.value = 'rh-' + k;
      o.textContent = 'Chinese → ' + MEANING_LANGS.filter(function (l) { return l[0] === k; })[0][1];
      g.appendChild(o);
    });
    g.disabled = g.hidden = !g.children.length;
    syncPracticeSelect();
  }
```

Move the line `  var SKILL_ZH = { read: '读', recall: '说', listen: '听' };` so it sits directly above `var BASE_SKILLS` (it must be assigned before `rebuildSkills` can run; all of this runs at start-up, after every file has loaded, so order within the file is for readability only).

Replace `function skillMaps() { … }` and the `['read', 'recall', 'listen'].forEach(function (k) {` line in `skillMarks` so every skill gets a seal:

```js
  function skillMaps() { var m = {}; Object.keys(SKILLS).forEach(function (k) { m[k] = marksOf(k).status; }); return m; }
```

and in `skillMarks(c, maps)` use `Object.keys(SKILLS).forEach(function (k) {` and replace `m.setAttribute('lang', 'zh-CN');` with:

```js
      if (k.indexOf('say:') === 0) m.classList.add('sm-code'); else m.setAttribute('lang', 'zh-CN');
```

(`maps[k]` may be missing when a caller passed an older `maps`; guard with `var s = (maps[k] || {})[c.zh] || 'unmarked';`.)

- [ ] **Step 4: Snapshot and restore (`src/js/06-persistence.js`)**

Add above `function progressSnapshot() {`:

```js
  // Recall, listening and every rehearse skill ever used (kept while a language is set back to Show).
  function skillsSnapshot() {
    var out = { recall: marksOf('recall'), listen: marksOf('listen') };
    Object.keys(state.marks).forEach(function (k) { if (k.indexOf('say:') === 0) out[k] = marksOf(k); });
    return out;
  }
```

In `progressSnapshot()` replace `skills: { recall: marksOf('recall'), listen: marksOf('listen') },` with `skills: skillsSnapshot(),`.

In `restore()`, directly after the line `    state.langs = readLangs(saved && saved.langs);` block from Task 1 (after `state.rehearse = readRehearse(…);`) add `    rebuildSkills();`.

Replace `    state.marks = { read: readMarks(saved), recall: readMarks(sk.recall), listen: readMarks(sk.listen) };` with:

```js
    state.marks = { read: readMarks(saved), recall: readMarks(sk.recall), listen: readMarks(sk.listen) };
    MEANING_LANGS.forEach(function (l) { var k = rehearseSkill(l[0]); if (sk[k]) state.marks[k] = readMarks(sk[k]); });
```

- [ ] **Step 5: Hook into role changes and the menu**

`src/js/03-data.js` `langsChanged()`: make `rebuildSkills();` its first line.

`src/index.html`: after the `<optgroup label="Sentences" …>…</optgroup>` inside `<select id="optPractice">` add:

```html
        <optgroup label="Rehearse" data-en="Rehearse" id="optRehearseGroup" disabled hidden></optgroup>
```

`src/js/01-core.js`: add `'optRehearseGroup', ` to the start of `REQUIRED_IDS`.

`src/js/02-labels.js`: `var GROUP_ZH = { Words: '词语', Sentences: '句子', Rehearse: '温习' };` and add `'Rehearse': ['温习', 'wēnxí'],` to `ZH_LABELS`.

Start-up needs nothing extra: `init()` in `src/js/19-wiring.js` always calls `restore(saved)` (with `null` when there is no save), after `loadCards()` has filled `LANG_AVAILABLE` and after `els` is filled, so `rebuildSkills()` inside `restore` sees both.

- [ ] **Step 6: Seal style (`src/styles/08-features.css`)**

```css
/* A rehearsed language's mark: its code instead of a character. */
.sm.sm-code { font-family: var(--ui-font); font-size: 9px; font-weight: 800; letter-spacing: .02em; }
```

- [ ] **Step 7: Run checks**

Run: `npm run check && npm run build && npm run selfcheck`
Expected: all pass, including `ok   Rehearsed language as its own skill`.

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "Rehearse: a skill per rehearsed language, saved under skills

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Rehearse pool, practice tile and the Chinese → language card

**Files:**
- Create: `src/js/12a-rehearse.js`
- Modify: `src/js/11-practice.js` (`inPractice`, `renderPracticeSheet`, `applyPractice`)
- Modify: `src/js/07-deck.js` (`buildDeck`)
- Modify: `src/js/15-cards.js` (`selfGraded`, `setRevealed`, `showCard`)
- Modify: `src/index.html` (`#cardRehearse`)
- Modify: `src/js/01-core.js` (`REQUIRED_IDS`)
- Modify: `src/styles/08-features.css`
- Test: `src/js/18a-selfcheck-rehearse.js`

**Interfaces:**
- Consumes: `rehearseSkill`, `rebuildSkills`, `SKILL_OF['rh-ro']` (Task 2).
- Produces: `isRehearseStyle(p) → bool`, `rehearseCode(p) → '' | code`, `rehearseStarted(c) → bool`, `rehearsePool(k) → card[]` (ordered), `wordByZh(zh) → card|null`, `practiceNow() → style`, `var rehearseCard = null` (filled in Task 5).

- [ ] **Step 1: Write the failing test** (append to `src/js/18a-selfcheck-rehearse.js`)

```js
  // Marks the first n words with a meaning in k as Learning in reading, so they are in k's rehearse pool.
  function seedRehearsePool(k, n) {
    var picked = wordCards.filter(function (w) { return mean(w, k); }).slice(0, n);
    var read = marksOf('read');
    picked.forEach(function (w) { if (!read.status[w.zh]) read.status[w.zh] = 'learning'; });
    if (state.skill === 'read') loadSkill();
    return picked;
  }
  REHEARSE_TESTS.push({ title: 'Rehearse tile: Chinese → Romanian card', run: function (add) {
    if (!LANG_AVAILABLE.ro) { add('Rehearse tile: Chinese → Romanian card', true, 'No Romanian data in this build.'); return; }
    state.langs.ro = 'rehearse';
    rebuildSkills();
    var picked = seedRehearsePool('ro', 3);
    var started = function (w) { return !!(marksOf('read').status[w.zh] || marksOf('recall').status[w.zh] || marksOf('listen').status[w.zh]); };
    var pool = rehearsePool('ro');
    var onlyStarted = pool.length > 0 && pool.every(function (w) { return started(w) && mean(w, 'ro') && !w.sentence; });
    // A word due in Romanian comes first.
    var ro = marksOf('say:ro'), due = picked[2];
    ro.srs[due.zh] = { b: 1, d: dayKey() };
    var dueFirst = rehearsePool('ro')[0] === due;
    useDeckType('words');
    state.mode = 'all';
    pickPracticeStyle('rh-ro');
    var tile = state.practice === 'rh-ro' && state.skill === 'say:ro' && state.deck.length === rehearsePool('ro').length &&
      cards[state.deck[0]] === due;
    var prompt = els.cardPrompt.textContent.indexOf('In Romanian?') !== -1 && !els.cardPrompt.hidden;
    setRevealed(true);
    var back = !els.cardRehearse.hidden && els.cardRehearse.textContent.indexOf(mean(due, 'ro')) !== -1 && !els.gradeRow.hidden;
    var readBefore = marksOf('read').status[due.zh] || null;
    act('learning');
    var moved = marksOf('say:ro').status[due.zh] === 'learning' && (marksOf('read').status[due.zh] || null) === readBefore;
    delete state.marks['say:ro'];
    add('Rehearse tile: Chinese → Romanian card', onlyStarted && dueFirst && tile && prompt && back && moved,
      'pool holds only started words with Romanian: ' + onlyStarted + ', Romanian-due first: ' + dueFirst + ', tile opens the pool as a Romanian deck: ' + tile +
      ', asks "In Romanian?": ' + prompt + ', back shows the Romanian, self-graded: ' + back + ', the answer moves only the Romanian mark: ' + moved);
  } });
```

- [ ] **Step 2: Run to see it fail**

Run: `npm run build && npm run selfcheck`
Expected: `FAIL Rehearse tile: Chinese → Romanian card` (`rehearsePool is not defined`).

- [ ] **Step 3: Create `src/js/12a-rehearse.js`**

```js
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
```

- [ ] **Step 4: Deck filter and order**

`src/js/11-practice.js`, replace `function inPractice(c) { … }` with:

```js
  function inPractice(c) {
    var rk = rehearseCode(state.practice);
    if (rk) return !c.sentence && !!mean(c, rk) && rehearseStarted(c);
    return state.practice !== 'pairs' || !!c.sentence || similarOf(c).length > 0;
  }
```

`src/js/07-deck.js`, in `buildDeck(mode)` directly before `return idx;` add:

```js
    var rk = rehearseCode(state.practice);
    if (mode === 'all' && rk) {
      var order = {};
      rehearsePool(rk).forEach(function (c, n) { order[c.zh] = n; });
      idx.sort(function (a, b) { return order[cards[a].zh] - order[cards[b].zh]; });
    }
```

`src/js/19-wiring.js`, in the `optPractice` change handler, replace
`var pairsChanged = (prevPractice === 'pairs') !== (state.practice === 'pairs');` with:

```js
      var pairsChanged = (prevPractice === 'pairs') !== (state.practice === 'pairs') || isRehearseStyle(prevPractice) || isRehearseStyle(state.practice);
```

(a rehearse style studies only its pool, so entering or leaving it rebuilds the deck even in "All cards").

- [ ] **Step 5: Practice sheet rows for rehearse skills (`src/js/11-practice.js`)**

In `renderPracticeSheet()` replace `['read', 'recall', 'listen'].forEach(function (k) {` with `Object.keys(SKILLS).forEach(function (k) {`, replace `seal.setAttribute('lang', 'zh-CN');` with `if (k.indexOf('say:') === 0) seal.classList.add('pk-code'); else seal.setAttribute('lang', 'zh-CN');`, and replace `['Words', 'Sentences'].forEach(function (d) {` with `(k.indexOf('say:') === 0 ? ['Rehearse'] : ['Words', 'Sentences']).forEach(function (d) {`.

- [ ] **Step 6: The card face (`src/index.html`, `src/js/11-practice.js`, `src/js/15-cards.js`)**

`src/index.html`: directly after `<div id="cardAnswer" class="answer">` add `<p id="cardRehearse" class="rh-answer" hidden></p>`.
`src/js/01-core.js`: add `'cardRehearse', ` to the start of `REQUIRED_IDS`.

`src/js/11-practice.js`, in `applyPractice(c)`:
- change the first line to `var p = practiceNow(), rh = rehearseCode(p);`
- after `els.card.classList.toggle('tone-mode', !!toneQ);` add:

```js
    els.card.classList.toggle('rh-mode', !!rh);
    els.cardRehearse.hidden = !rh;
    els.cardRehearse.textContent = '';
    if (rh) {
      els.cardRehearse.appendChild(el('span', 'tag ' + rh, rh.toUpperCase()));
      var rw = el('span', 'rh-word', mean(c, rh));
      rw.setAttribute('lang', rh);
      els.cardRehearse.appendChild(rw);
    }
```

- in the `if (p === 'reverse') { … } else if …` chain add, before `} else if (p === 'listen' || toneQ) {`:

```js
    } else if (rh) {
      els.cardPrompt.appendChild(el('p', 'prompt-q', rh.toUpperCase() + ' · In ' + langName(rh) + '?'));
```

(The chain starts with `if (p === 'reverse')`; insert this as a new `else if` arm directly after the `reverse` arm's closing `}`.)

`src/js/15-cards.js`:
- `selfGraded()`: `function selfGraded() { var p = practiceNow(); return (['zh', 'reverse', 'listen', 'hanzi'].indexOf(p) !== -1 || isRehearseStyle(p)) && !toneQ; }`
- `setRevealed(v)`: change `var p = state.practice;` to `var p = practiceNow();`; change the `els.cardPrompt.hidden = …` condition to include `|| isRehearseStyle(p)` inside the parentheses; and before the `: { zh: 'Tap the card …` object literal add the arm `: isRehearseStyle(p) ? 'Say it in ' + langName(rehearseCode(p)) + ', then tap the card to check'`.
- `showCard(c, animate)`: in the `announce(…)` call and the autoplay condition replace `state.practice` with `practiceNow()` (three places: `=== 'reverse'`, `=== 'listen'`, and the autoplay `state.practice === 'listen' || state.practice === 'tone'`).

- [ ] **Step 7: Styles (`src/styles/08-features.css`)**

```css
/* Chinese → rehearsed language: the answer in that language, large, at the top of the back. */
.rh-answer { display: flex; align-items: center; gap: 10px; margin: 0 0 10px; }
.rh-answer .rh-word { font-size: clamp(24px, 6vw, 32px); font-weight: 700; color: var(--paper); overflow-wrap: anywhere; }
.pk-seal.pk-code { font-family: var(--ui-font); font-size: 13px; font-weight: 800; }
```

- [ ] **Step 8: Run checks**

Run: `npm run check && npm run build && npm run selfcheck`
Expected: all pass, including `ok   Rehearse tile: Chinese → Romanian card`.

- [ ] **Step 9: Commit**

```bash
git add -A src
git commit -m "Rehearse: practice tile and Chinese → language card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Rotating main meaning

**Files:**
- Modify: `src/js/01-core.js` (rotation helpers, `meaningLines`)
- Modify: `src/js/11-practice.js` (`promptMeanings`, `choicePool`, `buildChoices`, cloze and build prompts)
- Modify: `src/js/12-game.js` (challenges use `baseMeaning`)
- Modify: `src/js/15-cards.js` (`showCard`: `#cardMeanMain`)
- Modify: `src/index.html` (`#cardMeanMain`), `src/js/01-core.js` (`REQUIRED_IDS`)
- Modify: `src/styles/08-features.css`
- Test: `src/js/18a-selfcheck-rehearse.js`

**Interfaces:**
- Consumes: `langsRehearsed()`, `state.rehearse.share` (Task 1); `hashDay(k)` (`12-game.js`), `dayKey()` (`08-progress-view.js`).
- Produces: `baseLang() → code`, `mainLang(o) → code`, `langsFor(o) → code[]` (main first), `mainMeaning(o)`, `baseMeaning(o)`.

- [ ] **Step 1: Write the failing test**

```js
  REHEARSE_TESTS.push({ title: 'Main meaning takes turns', run: function (add) {
    if (!LANG_AVAILABLE.ro) { add('Main meaning takes turns', true, 'No Romanian data in this build.'); return; }
    state.langs = { en: 'show', hu: 'show', de: 'off', es: 'off', ro: 'rehearse' };
    state.rehearse.share = { ro: 30 };
    rebuildSkills();
    var withRo = wordCards.filter(function (w) { return mean(w, 'ro'); });
    var stable = withRo.every(function (w) { return mainLang(w) === mainLang(w); });
    var n = withRo.filter(function (w) { return mainLang(w) === 'ro'; }).length, share = n / withRo.length;
    var weighted = share > 0.18 && share < 0.42;
    state.rehearse.share = { ro: 0 };
    var none = withRo.every(function (w) { return mainLang(w) === 'en'; });
    // Two languages at 50% each: English still keeps at least 30%.
    if (LANG_AVAILABLE.de) state.langs.de = 'rehearse';
    state.rehearse.share = { ro: 50, de: 50 };
    rebuildSkills();
    var base = withRo.filter(function (w) { return mainLang(w) === 'en'; }).length / withRo.length;
    var floor = base > 0.2;
    var missing = mainLang({ zh: 'x', en: 'a', hu: 'b', tr: {} }) === 'en';
    // A card whose main meaning is Romanian: the recall prompt leads with it, the challenge question does not.
    state.langs.de = 'off';
    state.rehearse.share = { ro: 50 };
    rebuildSkills();
    var c = withRo.filter(function (w) { return mainLang(w) === 'ro'; })[0];
    state.practice = 'reverse'; useSkill('recall'); useDeckType('words');
    state.deck = [wordCards.indexOf(c)]; state.pos = 0; state.revealed = false; render(false);
    var lead = els.cardPrompt.querySelector('.prompt-en');
    var prompt = !!lead && lead.getAttribute('lang') === 'ro' && lead.textContent.indexOf(mean(c, 'ro')) !== -1;
    startQuiz('blitz', 'all');
    quiz.q = makeQuestion('word', c, quiz.pool);
    drawQuestion();
    var q = els.quizBody.querySelector('.qz-en');
    var quizBase = !!q && q.textContent === shortText(baseMeaning(c));
    stopQuiz(); quiz = null; closeOverlay(els.quizView);
    add('Main meaning takes turns', stable && weighted && none && floor && missing && prompt && quizBase,
      'same language all day: ' + stable + ', about 30% Romanian (' + Math.round(share * 100) + '%): ' + weighted + ', 0% means never: ' + none +
      ', the base keeps 30% (' + Math.round(base * 100) + '%): ' + floor + ', a missing meaning falls back: ' + missing +
      ', the recall prompt leads with Romanian: ' + prompt + ', challenges use the base language: ' + quizBase);
  } });
```

- [ ] **Step 2: Run to see it fail**

Run: `npm run build && npm run selfcheck`
Expected: `FAIL Main meaning takes turns` (`mainLang is not defined`).

- [ ] **Step 3: Rotation helpers (`src/js/01-core.js`)**

Replace `function mainMeaning(o) { return mean(o, langsOn()[0]); }` with:

```js
  // The base meaning is the first language on. A rehearsed language takes the main meaning's place on its share of
  // cards (the base keeps at least 30%); the pick hangs on the card and the day, so it holds through undo and revisits.
  function baseLang() { return langsOn()[0]; }
  function mainLang(o) {
    var base = baseLang();
    if (!o || !o.zh) return base;
    var rh = langsRehearsed().filter(function (k) { return k !== base && mean(o, k); });
    var shares = rh.map(function (k) { return state.rehearse.share[k] || 0; });
    var total = shares.reduce(function (a, b) { return a + b; }, 0);
    if (!total) return base;
    var scale = total > 70 ? 70 / total : 1, x = hashDay(o.zh + '|' + dayKey()) % 100, acc = 0;
    for (var i = 0; i < rh.length; i++) { acc += shares[i] * scale; if (x < acc) return rh[i]; }
    return base;
  }
  // The languages on, the main one first.
  function langsFor(o) { var m = mainLang(o); return [m].concat(langsOn().filter(function (k) { return k !== m; })); }
  function mainMeaning(o) { return mean(o, mainLang(o)); }
  function baseMeaning(o) { return mean(o, baseLang()); }
```

In `meaningLines(into, o, cls, short)` replace `langsOn().forEach(` with `langsFor(o).forEach(`.

- [ ] **Step 4: Prompts and multiple choice (`src/js/11-practice.js`)**

`promptMeanings(c, short)`:

```js
  function promptMeanings(c, short) {
    var base = baseLang();
    langsFor(c).forEach(function (k, i) {
      var t = mean(c, k);
      var x = el('p', i ? 'prompt-hu' : 'prompt-en', short ? shortText(t) : t);
      x.setAttribute('lang', k);
      if (!i && k !== base) x.insertBefore(el('span', 'tag ' + k, k.toUpperCase()), x.firstChild);
      els.cardPrompt.appendChild(x);
    });
  }
```

`choicePool(c)`:

```js
  function choicePool(c) {
    var lk = mainLang(c), key = shortText(mean(c, lk)).toLowerCase();
    var pool = cards.filter(function (x) { return x !== c && x.lv === c.lv && mean(x, lk) && shortText(mean(x, lk)).toLowerCase() !== key && !optionClash(c, x, 'meaning'); });
    return pool.length >= 3 ? pool : cards.filter(function (x) { return x !== c && mean(x, lk) && !optionClash(c, x, 'meaning'); });
  }
```

`buildChoices(c)`: move `var ls = langsOn();` out of the `opts.forEach` loop to just before it and change it to `var ls = langsFor(c);` (all four options use the asked card's languages). Update the comment to `// The asked card's main language is the answer; a second one, if on, sits below it smaller.`

Cloze prompt line `langsOn().forEach(function (k) { var x = el('p', 'prompt-sub', mean(clozeQ.ex, k)); …` → `langsFor(clozeQ.ex).forEach(…`.
Build prompt line `langsOn().forEach(function (k) { var x = el('p', 'prompt-sub', mean(c, k)); …` → `langsFor(c).forEach(…`.

- [ ] **Step 5: Challenges keep the base language (`src/js/12-game.js`)**

Replace `mainMeaning(` with `baseMeaning(` in: `makeQuestion` (the `key` function), `drawQuestion` (`qz-en` and `choice-en`), and the results list in `finishQuiz` (`rp-word`). Leave `renderWotd` on `mainMeaning`.

- [ ] **Step 6: Card back shows the main language first (`src/index.html`, `src/js/15-cards.js`)**

`src/index.html`: directly before `<div class="meaning" data-mlang="en">` add `<div id="cardMeanMain"></div>`.
`src/js/01-core.js`: add `'cardMeanMain', ` to the start of `REQUIRED_IDS`.

`src/js/15-cards.js` `showCard`: replace the lines from `var on = langsOn();` through the end of the `on.forEach(function (k) { … els.cardMeanMore.appendChild(m); });` block with:

```js
    var on = langsOn(), main = mainLang(c), lead = main !== baseLang() ? main : '';
    els.cardMeanMain.textContent = '';
    if (lead) {
      var mm = el('div', 'meaning main-mean');
      mm.appendChild(el('span', 'tag ' + lead, lead.toUpperCase()));
      var mt = el('p', null, mean(c, lead));
      mt.setAttribute('lang', lead);
      mm.appendChild(mt);
      els.cardMeanMain.appendChild(mm);
    }
    els.cardEn.parentNode.hidden = on.indexOf('en') === -1 || lead === 'en';
    els.cardHu.parentNode.hidden = on.indexOf('hu') === -1 || lead === 'hu';
    els.cardMeanMore.textContent = '';
    on.forEach(function (k) {
      if (k === 'en' || k === 'hu' || k === lead) return;
      var m = el('div', 'meaning');
      m.appendChild(el('span', 'tag ' + k, k.toUpperCase()));
      var t = el('p', null, mean(c, k));
      t.setAttribute('lang', k);
      m.appendChild(t);
      els.cardMeanMore.appendChild(m);
    });
```

- [ ] **Step 7: Styles**

```css
#cardMeanMain { display: contents; }
```

- [ ] **Step 8: Run checks**

Run: `npm run check && npm run build && npm run selfcheck`
Expected: all pass, including `ok   Main meaning takes turns` and the existing multiple-choice and translations tests.

- [ ] **Step 9: Commit**

```bash
git add -A src
git commit -m "Rehearse: rehearsed languages take turns as the main meaning

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Rehearse cards mixed into the word deck

**Files:**
- Modify: `src/js/12a-rehearse.js` (interjection)
- Modify: `src/js/15-cards.js` (`act`, `undo`, `render`)
- Modify: `src/js/07-deck.js` (`setMode`), `src/js/03-data.js` (`useDeckType`)
- Test: `src/js/18a-selfcheck-rehearse.js`

**Interfaces:**
- Consumes: `rehearseCard`, `practiceNow`, `rehearsePool`, `wordByZh` (Task 3).
- Produces: `withSkill(k, fn)`, `pickRehearseLang() → code|''`, `maybeInterject(kind)`, `actRehearse(kind, grade) → bool`, `var sinceRehearse`, `var rehearsedThisSession`, `var answeringRehearse`, `isRehearseAnswer() → bool`.

- [ ] **Step 1: Write the failing test**

```js
  REHEARSE_TESTS.push({ title: 'Rehearse cards come up in the word deck', run: function (add) {
    if (!LANG_AVAILABLE.ro) { add('Rehearse cards come up in the word deck', true, 'No Romanian data in this build.'); return; }
    state.langs.ro = 'rehearse';
    state.rehearse.every = 6;
    rebuildSkills();
    seedRehearsePool('ro', 3);
    useDeckType('words');
    state.practice = 'zh'; useSkill('read');
    state.deck = [0, 1, 2, 3, 4]; state.pos = 0; state.revealed = true;
    rehearseCard = null; rehearsedThisSession = []; undoStack = [];
    sinceRehearse = 5;
    act('known');
    var shown = !!rehearseCard && state.pos === 1 && els.card.classList.contains('rh-mode') && state.skill === 'read';
    var c = rehearseCard ? wordByZh(rehearseCard.zh) : null;
    // Undo while it is on screen: the previous Chinese card comes back, the rehearse card goes.
    undo();
    var undoBefore = !rehearseCard && state.pos === 0;
    sinceRehearse = 5;
    act('known');
    c = rehearseCard ? wordByZh(rehearseCard.zh) : c;
    var before = marksOf('say:ro').status[c.zh] || null, readBefore = marksOf('read').status[c.zh] || null;
    act('learning');
    var marked = marksOf('say:ro').status[c.zh] === 'learning' && (marksOf('read').status[c.zh] || null) === readBefore && state.pos === 1 && !rehearseCard;
    undo();
    var undone = (marksOf('say:ro').status[c.zh] || null) === before && !!rehearseCard && rehearseCard.zh === c.zh;
    // Never on the sentence deck.
    rehearseCard = null;
    useDeckType('sentences');
    state.deck = [0, 1, 2]; state.pos = 0; sinceRehearse = 5;
    act('known');
    var noSentences = !rehearseCard;
    useDeckType('words');
    delete state.marks['say:ro'];
    add('Rehearse cards come up in the word deck', shown && undoBefore && marked && undone && noSentences,
      'after the 6th answer a Romanian card appears in place: ' + shown + ', undo on it brings back the Chinese card: ' + undoBefore +
      ', answering it moves only the Romanian mark: ' + marked + ', undo brings it back: ' + undone + ', none on the sentence deck: ' + noSentences);
  } });
```

In `resetRehearseTestState(keep)` add `    rehearseCard = null;` after `rebuildSkills();`.

- [ ] **Step 2: Run to see it fail**

Run: `npm run build && npm run selfcheck`
Expected: `FAIL Rehearse cards come up in the word deck` (`sinceRehearse is not defined`).

- [ ] **Step 3: Interjection (`src/js/12a-rehearse.js`, append)**

```js
  /* ---------- rehearse cards in the word deck ---------- */
  var sinceRehearse = 0;
  var rehearsedThisSession = [];
  // True while a rehearse answer is recorded (for the rehearse quest and the day's rehearse count).
  var answeringRehearse = false;
  function isRehearseAnswer() { return answeringRehearse || isRehearseStyle(state.practice); }
  // Runs fn with skill k active and switches back, without clearing undo (useSkill would).
  function withSkill(k, fn) {
    var back = state.skill;
    if (k === back) return fn();
    stashSkill(); state.skill = k; loadSkill();
    try { return fn(); } finally { stashSkill(); state.skill = back; loadSkill(); }
  }
  // A rehearsed language, weighted by its share (at least 1, so a 0% language still gets cards).
  function pickRehearseLang() {
    var ls = langsRehearsed();
    if (!ls.length) return '';
    var w = ls.map(function (k) { return Math.max(1, state.rehearse.share[k] || 0); });
    var x = Math.random() * w.reduce(function (a, b) { return a + b; }, 0);
    for (var i = 0; i < ls.length; i++) { x -= w[i]; if (x < 0) return ls[i]; }
    return ls[ls.length - 1];
  }
  // Called after every answer in the deck: after `every` answers in the word deck, the next card shown is a rehearse card.
  function maybeInterject(kind) {
    if (kind === 'skip' || rehearseCard) return;
    sinceRehearse++;
    if (!state.rehearse.every || sinceRehearse < state.rehearse.every) return;
    if (state.deckType !== 'words' || isRehearseStyle(state.practice) || currentIndex() === null) return;
    var code = pickRehearseLang();
    if (!code) return;
    var pick = rehearsePool(code).filter(function (c) { return rehearsedThisSession.indexOf(code + ':' + c.zh) === -1; })[0];
    if (!pick) return;
    sinceRehearse = 0;
    rehearsedThisSession.push(code + ':' + pick.zh);
    rehearseCard = { zh: pick.zh, code: code };
    state.revealed = false;
  }
  // Answers the rehearse card on screen: only its language's marks move, and the deck stays where it was.
  function actRehearse(kind, grade) {
    var r = rehearseCard, c = wordByZh(r.zh), entry = null;
    rehearseCard = null;
    if (!c) { render(true); return false; }
    withSkill(rehearseSkill(r.code), function () {
      entry = { rehearse: r.code, pos: state.pos, zh: c.zh, prev: state.status[c.zh] || null, srs: state.srs[c.zh] || null,
        miss: state.misses[c.zh] || 0, day: dayKey(), kind: kind, requeued: false };
      if (kind === 'known' || kind === 'learning') {
        applySrs(c, kind, grade);
        state.status[c.zh] = markAfter(c, kind);
      }
    });
    undoStack.push(entry);
    if (kind === 'known' || kind === 'learning') {
      if (testing) entry.kind = 'skip';
      else { answeringRehearse = true; try { recordAnswer(kind, c, entry.prev); } finally { answeringRehearse = false; } }
    }
    stopSpeech();
    state.revealed = state.autoReveal;
    resetCardPosition();
    render(true);
    save();
    afterAnswer(kind);
    return true;
  }
  // Undoes a rehearse answer: its marks go back and the card is shown again.
  function undoRehearse(h) {
    withSkill(rehearseSkill(h.rehearse), function () {
      if (h.prev) state.status[h.zh] = h.prev; else delete state.status[h.zh];
      if (h.srs) state.srs[h.zh] = h.srs; else delete state.srs[h.zh];
      if (h.miss) state.misses[h.zh] = h.miss; else delete state.misses[h.zh];
    });
    var a = state.activity[h.day];
    if (a && (h.kind === 'known' || h.kind === 'learning')) { if (h.kind === 'known') a.k = Math.max(0, a.k - 1); else a.l = Math.max(0, a.l - 1); }
    rehearseCard = { zh: h.zh, code: h.rehearse };
    state.revealed = false;
    stopSpeech();
    render(true);
    save();
  }
```

- [ ] **Step 4: Wire into answering (`src/js/15-cards.js`)**

`act(kind, grade)`: directly after `if (busy) return false;` add `    if (rehearseCard) return actRehearse(kind, grade);`. In `finish`, directly after `state.pos += 1;` add `      maybeInterject(kind);`.

`undo()`: directly after `if (!h) { toast('Nothing to undo.'); return; }` add:

```js
    if (h.rehearse) { undoRehearse(h); return; }
    rehearseCard = null;
```

`render(animate)`: replace

```js
    var i = currentIndex();
    if (i === null) showEnd();
    else showCard(cards[i], animate);
```

with

```js
    var i = currentIndex();
    if (rehearseCard && (state.deckType !== 'words' || langRole(rehearseCard.code) !== 'rehearse' || !wordByZh(rehearseCard.zh))) rehearseCard = null;
    if (rehearseCard) showCard(wordByZh(rehearseCard.zh), animate);
    else if (i === null) showEnd();
    else showCard(cards[i], animate);
```

`src/js/07-deck.js` `setMode(mode)`: after `stopSpeech();` add `    rehearseCard = null;`.
`src/js/03-data.js` `useDeckType(t)`: as its first line add `    rehearseCard = null;`.

- [ ] **Step 5: Run checks**

Run: `npm run check && npm run build && npm run selfcheck`
Expected: all pass, including `ok   Rehearse cards come up in the word deck`; the existing undo and answer tests still pass.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "Rehearse: a rehearse card every Nth answer in the word deck, with undo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Round after the daily goal, and the rehearse quest

**Files:**
- Modify: `src/js/12a-rehearse.js` (round)
- Modify: `src/js/12-game.js` (`QUESTS`, `makeQuests`, `questEvent`, `shownStrip`, `renderSuggest`, `renderLadderStrip`)
- Modify: `src/js/14-feedback-help.js` (`afterAnswer`)
- Modify: `src/js/15-cards.js` (`showEnd`)
- Modify: `src/js/06-persistence.js` (`rehearseSeen`)
- Modify: `src/js/01-core.js` (state default, ids)
- Modify: `src/js/19-wiring.js` (strip buttons)
- Modify: `src/index.html` (`#rehearseStrip`)
- Test: `src/js/18a-selfcheck-rehearse.js`

**Interfaces:**
- Consumes: `rehearsePool`, `rehearseSkill`, `isRehearseAnswer` (Tasks 3, 5).
- Produces: `ROUND_SIZE = 5`, `roundLang() → code|''`, `renderRehearseStrip()`, `startRehearseRound(k)`, `endRehearseRound() → bool`, `var roundReturn`, `state.rehearseSeen` (day string), quest id `rehearse`.

- [ ] **Step 1: Write the failing test**

```js
  REHEARSE_TESTS.push({ title: 'Rehearse round after the goal, and its quest', run: function (add) {
    if (!LANG_AVAILABLE.ro) { add('Rehearse round after the goal, and its quest', true, 'No Romanian data in this build.'); return; }
    state.langs.ro = 'rehearse';
    state.rehearse.afterGoal = true;
    rebuildSkills();
    seedRehearsePool('ro', ROUND_SIZE + 1);
    useDeckType('words'); state.practice = 'zh'; useSkill('read');
    state.deck = [0, 1, 2]; state.pos = 0;
    var day = dayKey(), keepSeen = state.rehearseSeen;
    state.activity[day] = { k: state.goal, l: 0 };
    state.rehearseSeen = '';
    renderRehearseStrip();
    var strip = !els.rehearseStrip.hidden && els.rehearseText.textContent.indexOf('Romanian') !== -1;
    els.btnRehearseGo.click();
    var round = state.practice === 'rh-ro' && state.skill === 'say:ro' && state.deck.length === ROUND_SIZE && state.rehearseSeen === day;
    for (var i = 0; i < ROUND_SIZE; i++) act('known');
    var back = state.practice === 'zh' && state.skill === 'read' && !roundReturn;
    renderRehearseStrip();
    var once = els.rehearseStrip.hidden;
    // The quest counts rehearse answers.
    state.quests = { day: day, rewarded: true, list: [{ id: 'rehearse', goal: 5, n: 0 }] };
    state.practice = 'rh-ro';
    questEvent('known', wordCards[0], null);
    state.practice = 'zh';
    var quest = state.quests.list[0].n === 1 && QUESTS.rehearse.label(state.quests.list[0]).indexOf('Romanian') !== -1;
    state.rehearseSeen = keepSeen;
    delete state.marks['say:ro'];
    add('Rehearse round after the goal, and its quest', strip && round && back && once && quest,
      'goal reached offers 5 Romanian cards: ' + strip + ', the round opens them as a Romanian deck: ' + round + ', after the last card it goes back: ' + back +
      ', offered once a day: ' + once + ', the rehearse quest counts: ' + quest);
  } });
```

In `resetRehearseTestState(keep)` add `    roundReturn = null;` after `rehearseCard = null;`.

- [ ] **Step 2: Run to see it fail**

Run: `npm run build && npm run selfcheck`
Expected: `FAIL Rehearse round after the goal, and its quest` (`ROUND_SIZE is not defined`).

- [ ] **Step 3: Markup, ids, state**

`src/index.html`: inside `#suggestPop`, directly after the closing `</section>` of `#ladderStrip`, add:

```html
        <section id="rehearseStrip" class="wotd rehearse-strip" aria-label="Rehearse round" hidden>
          <div class="wotd-seal" aria-hidden="true">温</div>
          <p class="wotd-body" id="rehearseText"></p>
          <button type="button" class="btn small" id="btnRehearseGo" data-lbl>Start</button>
          <button type="button" class="icon-btn small" id="btnRehearseClose" aria-label="Hide the rehearse round until tomorrow">✕</button>
        </section>
```

`src/js/01-core.js`: add `'rehearseStrip', 'rehearseText', 'btnRehearseGo', 'btnRehearseClose', ` to `REQUIRED_IDS` and `'btnRehearseGo', 'btnRehearseClose', ` to `CORE_BUTTONS`; add `rehearseSeen: '', ` to the `state` literal next to `ladderSeen: ''`.
`src/js/02-labels.js`: add `'Start': ['开始', 'kāishǐ'],` to `ZH_LABELS` if it is not there yet.
`src/js/06-persistence.js`: in `progressSnapshot()` add `rehearseSeen: state.rehearseSeen,` after `ladderSeen`; in `restore()` after the `state.ladderSeen = …` line add `    state.rehearseSeen = saved && isDay(saved.rehearseSeen) ? saved.rehearseSeen : '';`.

- [ ] **Step 4: The round (`src/js/12a-rehearse.js`, append)**

```js
  /* ---------- a short rehearse round after the daily goal ---------- */
  var ROUND_SIZE = 5;
  // Where to go back to when the round's last card is answered ({ practice, deckType }); null outside a round.
  var roundReturn = null;
  function roundLang() {
    return langsRehearsed().filter(function (k) { return rehearsePool(k).length >= ROUND_SIZE; })[0] || '';
  }
  function renderRehearseStrip() {
    var k = state.rehearse.afterGoal && state.rehearseSeen !== dayKey() && dayAnswers(dayKey()) >= state.goal ? roundLang() : '';
    els.rehearseStrip.hidden = !k;
    els.rehearseStrip.setAttribute('data-lang', k);
    els.rehearseText.textContent = k ? 'Goal done. ' + ROUND_SIZE + ' ' + langName(k) + ' cards?' : '';
  }
  function startRehearseRound(k) {
    var pool = rehearsePool(k).slice(0, ROUND_SIZE);
    if (pool.length < ROUND_SIZE) return;
    state.rehearseSeen = dayKey();
    OVERLAYS.forEach(function (o) { closeOverlay(els[o]); });
    closeSuggest();
    stopSpeech();
    rememberDeck();
    roundReturn = { practice: state.practice, deckType: state.deckType };
    useDeckType('words');
    state.practice = 'rh-' + k;
    useSkill(rehearseSkill(k));
    state.mode = 'all';
    state.deck = pool.map(function (c) { return wordCards.indexOf(c); });
    state.pos = 0;
    state.shuffled = false;
    state.revealed = false;
    undoStack = [];
    syncPracticeSelect();
    renderLadderStrip();
    render(true);
    save();
  }
  // Called when the round's deck ends: back to the style and deck from before it.
  function endRehearseRound() {
    var r = roundReturn;
    if (!r) return false;
    roundReturn = null;
    useDeckType(r.deckType);
    state.practice = PRACTICE[r.practice] ? r.practice : 'zh';
    fixStyleForDeck();
    useSkill(skillOf(state.practice));
    syncPracticeSelect();
    if (recallDeck()) { render(true); save(); } else setMode('all');
    if (!testing) toast('Round done. Back to your deck.', 3000);
    return true;
  }
```

- [ ] **Step 5: Hooks**

`src/js/15-cards.js` `showEnd()`: first line `    if (roundReturn && endRehearseRound()) return;`.

`src/js/12-game.js`:
- `shownStrip()`: `return [els.rehearseStrip, els.wotd, els.ladderStrip].filter(function (s) { return !s.hidden; })[0] || null;`
- `renderSuggest()`: replace `var kind = s === els.wotd ? 'wotd' : 'ladder';` with `var kind = s === els.wotd ? 'wotd' : s === els.ladderStrip ? 'ladder' : 'rehearse';`; replace the `els.suggestText.textContent = …` line with:

```js
    els.suggestText.textContent = kind === 'wotd' ? els.wotdZh.textContent + ' ' + els.wotdPy.textContent : kind === 'ladder' ? els.ladderZh.textContent : els.rehearseText.textContent;
```

  and in the `aria-label` expression add a `kind === 'rehearse' ? 'Rehearse round: ' + els.rehearseText.textContent :` arm before the ladder text.
- `renderLadderStrip()`: as its first line add `    renderRehearseStrip();`.
- `QUESTS`: add `rehearse: { label: function (q) { return 'Answer ' + q.goal + ' ' + langName(langsRehearsed()[0] || 'ro') + ' cards'; } },`
- `makeQuests(k)`: after `if (EXTRA.topics.length) pool.push('topic');` add `    if (langsRehearsed().some(function (l) { return rehearsePool(l).length >= 5; })) pool.push('rehearse');` and add `rehearse: 5` to `goals`.
- `questEvent`: add the arm `: q.id === 'rehearse' ? isRehearseAnswer()` before `: false;`.

`src/js/14-feedback-help.js` `afterAnswer(kind)`: after `checkMilestones();` add `    renderLadderStrip();`.

`src/js/19-wiring.js` (next to the ladder strip handlers):

```js
    on('btnRehearseGo', 'click', function () { startRehearseRound(els.rehearseStrip.getAttribute('data-lang')); });
    on('btnRehearseClose', 'click', function () { state.rehearseSeen = dayKey(); renderLadderStrip(); save(); });
```

- [ ] **Step 6: Styles**

```css
.rehearse-strip .wotd-seal { background: var(--pinyin); color: var(--surface); }
```

- [ ] **Step 7: Run checks**

Run: `npm run check && npm run build && npm run selfcheck`
Expected: all pass, including `ok   Rehearse round after the goal, and its quest` and the existing Today-chip test.

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "Rehearse: a 5-card round after the daily goal, and a rehearse quest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Read-aloud in every meaning language

**Files:**
- Modify: `src/js/16-speech.js`
- Modify: `src/js/01-core.js` (`meaningLines`, state default, ids)
- Modify: `src/js/15-cards.js` (`showCard`, `setRevealed`)
- Modify: `src/js/11-practice.js` (`applyPractice` rehearse answer)
- Modify: `src/js/03-data.js` (`syncSettingsUI`: voice note, read-meaning select)
- Modify: `src/js/06-persistence.js` (`readMeaning`)
- Modify: `src/js/19-wiring.js` (speaker clicks, setting)
- Modify: `src/index.html` (setting, voice note)
- Modify: `src/styles/08-features.css`
- Test: `src/js/18a-selfcheck-rehearse.js`

**Interfaces:**
- Consumes: `mainLang`, `rehearseCode`, `practiceNow`, `wordByZh`.
- Produces: `LANG_TAGS`, `voiceFor(k) → SpeechSynthesisVoice|null`, `canSpeak(k) → bool`, `speakParts(parts, btn)` where a part is a Chinese string or `{ text, lang }`, `var lastUtterance`, `speakBtn(k, text) → HTMLButtonElement`, `meaningSpeech(c) → part[]`, `state.readMeaning: 'off'|'rehearse'|'always'`.

- [ ] **Step 1: Write the failing test**

```js
  REHEARSE_TESTS.push({ title: 'Read-aloud in every language', run: function (add) {
    var c = wordCards.filter(function (w) { return mean(w, 'ro'); })[0] || wordCards[0];
    var b = speakBtn('ro', 'casă');
    var btn = b.classList.contains('mean-speak') && b.getAttribute('data-lang') === 'ro' && b.hidden === !canSpeak('ro');
    var keepRead = state.readMeaning;
    state.readMeaning = 'off';
    var off = meaningSpeech(c).length === 0;
    state.readMeaning = 'always';
    var always = meaningSpeech(c).length === (canSpeak(mainLang(c)) ? 1 : 0);
    state.readMeaning = keepRead;
    var tagged = true;
    if (speechSupported) {
      lastUtterance = null;
      speakParts([{ text: 'casă', lang: 'ro' }], null);
      tagged = !!lastUtterance && lastUtterance.lang === 'ro-RO';
      stopSpeech();
    }
    add('Read-aloud in every language', btn && off && always && tagged,
      'speaker hidden without a voice: ' + btn + ', "Off" reads no meaning: ' + off + ', "Always" reads the main one: ' + always +
      ', a Romanian part is spoken as ro-RO: ' + (speechSupported ? tagged : 'no speech in this browser'));
  } });
```

- [ ] **Step 2: Run to see it fail**

Run: `npm run build && npm run selfcheck`
Expected: `FAIL Read-aloud in every language` (`speakBtn is not defined`).

- [ ] **Step 3: Speech (`src/js/16-speech.js`)**

After `var warnedNoVoice = false;` add:

```js
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
```

In `markSpeaking(btn, on)` change `else btn.setAttribute('aria-label', …);` to `else if (btn.classList.contains('ex-speak')) btn.setAttribute('aria-label', …);`.

In `speakParts`, inside `var next = function () {`, replace

```js
      var text = parts[idx];
      var u = new Utterance(text);
      u.lang = 'zh-CN';
      if (zhVoice) u.voice = zhVoice;
```

with

```js
      var part = parts[idx], text = typeof part === 'string' ? part : part.text, k = typeof part === 'string' ? '' : part.lang;
      var u = new Utterance(text);
      if (k) { var kv = voiceFor(k); u.lang = LANG_TAGS[k] || k; if (kv) u.voice = kv; }
      else { u.lang = 'zh-CN'; if (zhVoice) u.voice = zhVoice; }
      lastUtterance = u;
```

and in `u.onerror` change `if (zhVoice && retries < 2 && …)` to `if (!k && zhVoice && retries < 2 && …)` (voice retries are for Chinese voices only).

- [ ] **Step 4: Speaker buttons**

`src/js/01-core.js` `meaningLines`: after `p.appendChild(el('span', null, short ? shortText(mean(o, k)) : mean(o, k)));` add `      p.appendChild(speakBtn(k, mean(o, k)));`.

`src/js/15-cards.js` `showCard`, after the meaning block from Task 4:

```js
    [[els.cardEn, 'en'], [els.cardHu, 'hu']].forEach(function (x) {
      var box = x[0].parentNode, old = box.querySelector('.mean-speak');
      if (old) box.removeChild(old);
      box.appendChild(speakBtn(x[1], mean(c, x[1])));
    });
    Array.prototype.forEach.call(els.cardMeanMore.querySelectorAll('.meaning'), function (m) {
      var p = m.querySelector('p');
      m.appendChild(speakBtn(p.getAttribute('lang'), p.textContent));
    });
    if (lead) els.cardMeanMain.firstChild.appendChild(speakBtn(lead, mean(c, lead)));
```

`src/js/11-practice.js` `applyPractice`, in the `if (rh) { … }` block from Task 3, after appending `rw` add `      els.cardRehearse.appendChild(speakBtn(rh, mean(c, rh)));`.

`src/js/19-wiring.js`, in the wiring function next to the other document-level listeners:

```js
    // Speaker buttons on meaning lines. Capture phase, so the tap does not also flip the card.
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.mean-speak');
      if (!b) return;
      e.stopPropagation();
      e.preventDefault();
      speakParts([{ text: b.getAttribute('data-text'), lang: b.getAttribute('data-lang') }], b);
    }, true);
```

- [ ] **Step 5: Read the meaning after the Chinese**

`src/index.html`, in the Voice section after the `optAutoplay` switch:

```html
        <div class="set-row">
          <label for="optReadMeaning">Read the meaning after the Chinese</label>
          <select id="optReadMeaning"><option value="off">Off</option><option value="rehearse">Rehearsed languages only</option><option value="always">Always</option></select>
        </div>
```

And at the end of the Translations section (after `#rehearseOpts`): `<p class="set-note" id="rehearseVoiceNote" hidden></p>`.

`src/js/01-core.js`: `readMeaning: 'rehearse', ` in the `state` literal; `'optReadMeaning', 'rehearseVoiceNote', ` in `REQUIRED_IDS`; `'optReadMeaning', ` in `CORE_BUTTONS`.
`src/js/06-persistence.js`: snapshot `readMeaning: state.readMeaning,`; restore `    state.readMeaning = saved && ['off', 'rehearse', 'always'].indexOf(saved.readMeaning) !== -1 ? saved.readMeaning : 'rehearse';` (next to the `toneColors` booleans line).
`src/js/03-data.js` `syncSettingsUI()`, at the end:

```js
    els.optReadMeaning.value = state.readMeaning;
    var mute = speechSupported ? langsRehearsed().filter(function (k) { return !canSpeak(k); }) : [];
    els.rehearseVoiceNote.hidden = !mute.length;
    els.rehearseVoiceNote.textContent = mute.length ? 'No ' + mute.map(langName).join(' or ') + ' voice on this device. iPhone: Settings → Accessibility → Spoken Content → Voices. Windows: Settings → Time & language → Speech.' : '';
```

`src/js/19-wiring.js`: `on('optReadMeaning', 'change', function () { state.readMeaning = els.optReadMeaning.value; save(); });`

`src/js/15-cards.js` `setRevealed(v)`: as the first lines:

```js
    var was = state.revealed;
```

and at the end of the function:

```js
    // With "Read each new card aloud" on, revealing reads the Chinese and then its meaning, when the setting allows.
    if (state.revealed && !was && state.autoplay && !testing && userHasInteracted) {
      var ci = currentIndex(), rc = rehearseCard ? wordByZh(rehearseCard.zh) : ci === null ? null : cards[ci];
      var extra = rc ? meaningSpeech(rc) : [];
      if (extra.length) speakParts([rc.zh].concat(extra), null);
    }
```

- [ ] **Step 6: Styles**

```css
/* A speaker on a meaning line: small, after the text, a full tap target on touch. */
.mean-speak { border: 0; background: transparent; color: var(--muted); font-size: 14px; min-width: 32px; min-height: 32px; margin-left: 4px; cursor: pointer; border-radius: 8px; flex: none; }
.mean-speak:hover, .mean-speak.speaking { color: var(--pinyin); }
@media (pointer: coarse) { .mean-speak { min-width: 44px; min-height: 44px; } }
```

- [ ] **Step 7: Run checks**

Run: `npm run check && npm run build && npm run selfcheck`
Expected: all pass, including `ok   Read-aloud in every language`.

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "Read-aloud in every meaning language; read the meaning after the Chinese

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Progress, sync, help, changelog and docs

**Files:**
- Modify: `src/js/08-progress-view.js` (per-skill line, `recordAnswer` counts `a.r`)
- Modify: `src/js/06-persistence.js` (`activity.r`)
- Modify: `src/js/12-game.js` (`weekRecap`, `maybeShowRecap`)
- Modify: `src/js/05-sync.js` (conflict compare cards)
- Modify: `src/index.html` (help entries)
- Modify: `data/changelog.json`, `CLAUDE.md`, `README.md`
- Test: `src/js/18a-selfcheck-rehearse.js`

**Interfaces:**
- Consumes: `isRehearseAnswer()`, `langsRehearsed()`, `knownIn(k)`, `rehearsePool(k)`.
- Produces: `state.activity[day].r` (rehearse answers that day), `rehearseNote(skills) → string`.

- [ ] **Step 1: Write the failing test**

```js
  REHEARSE_TESTS.push({ title: 'Rehearse progress and sync counts', run: function (add) {
    if (!LANG_AVAILABLE.ro) { add('Rehearse progress and sync counts', true, 'No Romanian data in this build.'); return; }
    state.langs.ro = 'rehearse';
    rebuildSkills();
    var picked = seedRehearsePool('ro', 2);
    marksOf('say:ro').status[picked[0].zh] = 'known';
    openProgress('progress');
    var line = els.pvBody.querySelector('.pv-skills');
    var shown = !!line && line.textContent.indexOf('Romanian') !== -1;
    closeOverlay(els.progressView);
    var note = rehearseNote(progressSnapshot().skills).indexOf('1 Romanian known') !== -1;
    var day = '2001-01-01';
    state.activity[day] = { k: 1, l: 0, r: 3 };
    var recap = weekRecap(day).rehearse === 3;
    delete state.activity[day];
    delete state.marks['say:ro'];
    add('Rehearse progress and sync counts', shown && note && recap,
      'progress lists Romanian next to the skills: ' + shown + ', the sync conflict cards count Romanian: ' + note + ', the weekly recap counts rehearse answers: ' + recap);
  } });
```

(If `openProgress` takes no tab argument or the per-skill line lives in another pane, open the pane that contains `.pv-skills`; check `openProgress` in `src/js/08-progress-view.js` before writing this line.)

- [ ] **Step 2: Run to see it fail**

Run: `npm run build && npm run selfcheck`
Expected: `FAIL Rehearse progress and sync counts` (`rehearseNote is not defined`).

- [ ] **Step 3: Progress view and activity**

`src/js/08-progress-view.js`, replace the `panes.progress.appendChild(el('p', 'pv-skills', …));` statement with:

```js
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
```

In `recordAnswer`, after `if (kind === 'known') a.k++; else a.l++;` add `    if (isRehearseAnswer()) a.r = (a.r || 0) + 1;`.

`src/js/06-persistence.js` activity restore: change the object to `{ k: …, l: …, r: Math.max(0, parseInt(a.r, 10) || 0) }`.

- [ ] **Step 4: Recap**

`src/js/12-game.js` `weekRecap(start)`: declare `r = 0` with `k = 0, l = 0`, add `r += a.r || 0;` next to `k += a.k; l += a.l;`, and add `rehearse: r` to the returned object. In `maybeShowRecap()`, after the tiles row is appended, add:

```js
    if (r.rehearse) b.appendChild(el('p', 'sum-line', 'Rehearsed languages: ' + r.rehearse + ' cards.'));
```

- [ ] **Step 5: Sync conflict cards (`src/js/05-sync.js`)**

Add near the conflict code:

```js
  // " · 12 Romanian known" for every rehearse skill in a snapshot's skills; '' when there are none.
  function rehearseNote(skills) {
    var parts = [];
    MEANING_LANGS.forEach(function (l) {
      var m = skills && skills[rehearseSkill(l[0])], n = 0;
      if (m && m.status) Object.keys(m.status).forEach(function (z) { if (m.status[z] === 'known') n++; });
      if (n) parts.push(n + ' ' + langName(l[0]) + ' known');
    });
    return parts.length ? ' · ' + parts.join(' · ') : '';
  }
```

Change `var copy = function (label, iso, c, newer) {` to take a fifth parameter `note` and its `counts:` to `c.known + ' known · ' + c.learning + ' learning' + (note || '')`. Pass `rehearseNote(remote.data && remote.data.skills)` to the "In the cloud" copy and `rehearseNote(progressSnapshot().skills)` to the "On this device" copy.

- [ ] **Step 6: Help, labels, changelog, docs**

`src/index.html` help: after the `<dt>Translations</dt>…</dd>` entry add:

```html
          <dt>Rehearse (温习)</dt><dd>Set a language you already know to Rehearse in Settings → Translations. Its words then get their own marks: a card shows the Chinese and asks for the word in that language. These cards come up every few cards in the word deck, as a 5-card round after your daily goal, in their own practice style, and in a daily quest. The language also takes the main meaning's place on part of the cards (the slider sets how many), and its words can be read aloud.</dd>
```

and change the Translations entry's text "in any combination. At least one stays on; the first one switched on is the main meaning" to "each Off, Show or Rehearse. At least one stays on; the first one on is the base meaning".

`src/js/02-labels.js` `ZH_LABELS`: confirm `'Rehearse'` (Task 2) and `'Start'` (Task 6) exist.

`data/changelog.json`: run `git log origin/main --oneline -1` and compare with the newest `version` in the file. If the newest release is already on `origin/main`, add a new release at the top (next version, today's date); otherwise add to the newest one. Lines:

```json
"Rehearse a language you already know: in Settings → Translations each language is Off, Show or Rehearse.",
"A rehearsed language gets its own marks: cards show the Chinese and ask for the word in that language, every few cards in the word deck, as a 5-card round after the daily goal, as a practice style and as a daily quest.",
"A rehearsed language also takes turns as the main meaning, on the share of cards its slider sets.",
"Meanings and example translations can be read aloud in English, Hungarian, German, Spanish and Romanian; Settings → Voice can read the meaning after the Chinese."
```

`CLAUDE.md`, "How the app is put together": replace the **Meaning languages** bullet's sentence about `langsOn()` with: "Each language has a role in `state.langs` (`'off' | 'show' | 'rehearse'`, read with `langRole()`; never test `state.langs[k]` for truthiness). `langsOn()` lists the ones shown, `langsRehearsed()` the rehearsed ones, `mainLang(o)` / `langsFor(o)` the main meaning per card and day (`baseLang()` / `baseMeaning()` in challenges)." Add a bullet:

"- **Rehearse:** a rehearsed language is a skill `say:<code>` (`rebuildSkills()` adds it to `SKILLS` with the practice style `rh-<code>`), with marks in `state.marks` keyed by headword. `12a-rehearse.js` holds the pool (`rehearsePool()`: words started in Chinese with a meaning in that language), the card shown in place every `state.rehearse.every` answers (`rehearseCard`, `maybeInterject()`, `actRehearse()`, `undoRehearse()`; use `practiceNow()` for the style of the card on screen), and the round after the daily goal (`startRehearseRound()`, `endRehearseRound()`). Speech takes parts as Chinese strings or `{ text, lang }` (`voiceFor()`, `canSpeak()`, `speakBtn()`)."

Change "Snapshot format is `FORMAT` (5)" to "(6)".

`README.md`: in the features list add one line: "Rehearse languages you already know (English, Hungarian, German, Spanish, Romanian) alongside the Chinese: their own marks, cards mixed into the deck, a round after the daily goal, read-aloud."

- [ ] **Step 7: Run checks**

Run: `npm run check && npm run build && npm run selfcheck`
Expected: all pass, including `ok   Rehearse progress and sync counts`.

- [ ] **Step 8: Commit**

```bash
git add -A src data CLAUDE.md README.md
git commit -m "Rehearse: progress, recap, sync compare, help, changelog and docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Whole-branch verification

**Files:** none new; fixes go where the checks point.

- [ ] **Step 1: Full checks on both builds**

Run: `npm run check && npm run build && npm run selfcheck && npm run selfcheck -- dist/site/index.html`
Expected: `all data checks passed`, the build succeeds, both self-checks report `0 failed`.

- [ ] **Step 2: Layout and manual pass**

Start the preview server (`.claude/launch.json` "dist" in the main checkout serves the main checkout's `dist`; for this worktree run `python -m http.server 8767 --bind 127.0.0.1 --directory dist` from the worktree) and open `http://127.0.0.1:8767/mandarin-flashcards.html`. Then:
- Settings → Translations: set Romanian to Rehearse; the slider and the rehearse options appear. At 320, 375 and 1440 px nothing scrolls sideways (`document.documentElement.scrollWidth === clientWidth`).
- Mark a few words, answer 8 cards: a Romanian card appears with "RO · In Romanian?"; reveal shows the Romanian large; answer it; Z undoes it.
- Practice sheet shows a Rehearse row with "Chinese → Română".
- Recall style: some prompts lead with an RO tag.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A src
git commit -m "Rehearse: layout fixes from the manual pass

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Skip if nothing changed.)

- [ ] **Step 4: Report**

Tell the user: what was built, the check results, anything left, and that the branch is local (not pushed, not merged).
