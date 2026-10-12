# Mandarin HSK flashcards

Offline flashcard web app: 598 HSK 1–3 words and 777 example sentences, with pinyin, English and Hungarian, read-aloud, spaced repetition, progress tracking and optional Supabase cloud sync. The original requirements are in `docs/prd.txt`; most are hard constraints (single file, no external resources, works by double-click, visible startup validation and self-check). Cloud sync is a deliberate exception, and only in the GitHub Pages build (see below).

This repository is **public** (`nyikozoli/mandarin-flashcards`). Never commit secrets. They live in the git-ignored `.secrets/` folder (also in `.git/info/exclude`, so it stays ignored on every branch). Never `git add -f` there, never print a secret's value, and never let the build or a published file read from it.

## Layout

| Path | What |
|---|---|
| `src/index.html` | The page: markup, the early error reporter, and the `/*__STYLES__*/` and `/*__SCRIPTS__*/` lines the build fills. |
| `src/styles/*.css` | The CSS, in cascade order (`01-base.css` … `08-features.css`). |
| `src/js/*.js` | The app's JavaScript, one file per area (`01-core.js` … `19-wiring.js`), in load order. |
| `src/sync-config.json` | Supabase URL, public anon key and magic-link return URL. The anon key is public by design. |
| `src/pwa/` | Service worker, manifest and icons for the Pages build. |
| `data/` | Word data (`hsk12/`, `hsk3/`) and the official HSK lists (`lists/`). |
| `scripts/` | `build.js`, `cards.js` (the word loader), `verify.js`, `check.js` + individual checks, `fix-hsk3.js`, `validate.py`, `judge.js`, `judge-choice.js` and `judge-translations.js` (local only, through `jev.js`: TypeSafe's Jev model checks whether a fill-the-gap or multiple-choice question has a second right answer, and how well each meaning in all five languages matches the Chinese; `--control` first, `--dry-run` for the cost; key in `.secrets/.typesafe-api-key`, reports and answer caches in `.validation/`). Jev misses some wrong Romanian single-word glosses and flags good translations near its threshold: review its findings by hand. Jev cannot check the character hints (`data/hints.json`): it does not know how characters were formed (it calls even 人 a sound compound) and flagged 17 correct Shuowen explanations as invented, so do not use it for etymology. It also judges homophones by sound, not meaning (it accepts 久 for "nine"), so it cannot check the Similar words quiz; `optionClash()` keeps that quiz fair. |
| `supabase/` | `config.toml` and `migrations/`: the `progress` table, its row-level security and `upsert_progress`. |
| `.github/workflows/pages.yml` | CI: `npm run check`, `npm run build`, `npm run selfcheck` (both builds), deploy `dist/site` to GitHub Pages. |
| `dist/` | Build output, git-ignored: `mandarin-flashcards.html`, `artifact.html`, `site/`. Never edit. |

`npm run build` regenerates everything in `dist/` and fails if `scripts/verify.js` rejects an output. `npm run check` runs the data checks. README.md has the data formats, pinyin conventions and the sync/security model.

## How the app is put together (`src/index.html`, `src/styles/`, `src/js/`)

- **Structure:**
  - `build.js` joins `src/styles/*.css` and `src/js/*.js` in file-name order into `src/index.html`, so the output is still one file.
  - The JS files together are the body of one IIFE, so they share one scope and need no imports. Within a file, sections are marked `/* ---------- name ---------- */`.
  - Keep the numeric prefixes. CSS order is the cascade, and `01-core.js` defines what later files use at load time.
  - A new file needs a prefix that puts it in the right place; the files keep the IIFE's two-space indent.
  - The build fills `__VOCAB_JSON__`, `__EXPECTED_TOTAL__`, `__EXPECTED_LEVELS__`, `__SYNC_CONFIG__` (null except in the Pages build), `<!--__SITE_HEAD__-->`, and `__BUILD_DATE__` / `__BUILD_ID__` for the version line in Settings.
- **State:** everything lives in `state`. `progressSnapshot()` is the single list of persisted fields: `save()` stores it, and export and sync send it minus `DEVICE_ONLY`. `restore(saved)` reads it back, so a new persisted field needs an entry in both.
- **Skills:** reading, recall and listening (`SKILLS`, `SKILL_OF`) each have their own marks, schedule and misses in `state.marks`. `state.status` / `srs` / `misses` always point at the active skill's maps, so ordinary code stays skill-blind; switch only with `useSkill()`, and call `stashSkill()` (or `marksOf()`) before reading another skill. The snapshot keeps reading at the top level for older copies of the app and puts the rest under `skills`.
- **Decks:** `wordCards`, plus `sentCards` built from them at startup. `cards` points at the active one; switch only through `useDeckType()`, or `switchDeck()` when the user changes deck, which also remembers each deck's place (`state.deckMemory`). Text that differs between words and sentences goes in `DECKS`, read through `deck()` and `noun()`.
- **Practice styles:** `PRACTICE` lists them; the menu prefixes the sentence styles with `s-`. The `<select id="optPractice">` is hidden and stays the single source of the choice: `#btnPractice` shows it (`syncPracticeButton()`) and opens `#practiceView`, a sheet of tiles grouped by skill, a row of word styles and a row of sentence styles (`renderPracticeSheet()`, what each asks in `PRACTICE_ASK`); a tile sets the select and fires its change handler. `applyPractice()` builds each card's prompt and options into `#cardPrompt` and `#choiceBox`. The tone quiz (`tone`) is words-only — `dropToneQuiz()` falls back to `listen` on the sentence deck — asks about the first syllable, and skips the 21 words whose first syllable is neutral or in a 3-3 pair, where speech would not say the citation tone (`toneQuizTarget()`).
- **Panels:** every overlay id is listed in `OVERLAYS`. Open and close them only with `openOverlay()` / `closeOverlay()`, which also lock the page behind (`inert`). `askConfirm(title, text, ok, cb, altLabel, altCb)` is the confirm dialog, with an optional second action.
- **Sync:**
  - Writes go only through the `upsert_progress` RPC, a compare-and-set on `updated_at`. A refusal opens the conflict dialog; the client never merges or silently overwrites.
  - `ensureSession()` signs out only when the auth server rejects the refresh token (400/401). A network error or a 5xx keeps the session.
  - Sign-ups are closed: `[auth] enable_signup = false` in `supabase/config.toml`, applied with `supabase config push`. Keep `[auth.email] enable_signup = true`: the CLI maps it to the email provider switch, so `false` also blocks existing users' magic-link sign-in. That happened once, for about a minute.
  - Only accounts in `public.sync_allowlist` can read or write `progress` (a restrictive policy plus a check in `upsert_progress`). The ids live only in the database, never in this repo.
- **Reading hidden:** `applyPractice()` sets `readingHidden` (characters only, the tone quiz, or the opt-in `fadePinyin` for cards in SRS box 3+). Pinyin, tone colours, autoplay and the screen-reader label all follow it.
- **Word lookup:** `segment()` splits a sentence by longest match against the 598 headwords; known words become `button.w`, and `#wordPop` shows the word. The word list is the whole dictionary, so words outside HSK 1–3 stay plain text.
- **Extras:** `build.js` adds rank (`rk`), frequency (`fq`) and topic (`tp`) to each card from `data/freq.json` and `data/topics.json`, and puts the topic list, character frequencies, `data/hints.json` and the can-do ladder (`data/ladder.json`) the fill-the-gap exclusions (`data/cloze-exclude.json`, used by `clozePool()`) and the multiple-choice pairs (`data/choice-exclude.json`, used by `optionClash()`) in a second JSON block (`extra-data`, read by `loadExtra()` into `EXTRA`). Each file is optional; features hide without it. `data/freq.json` is CC BY-SA 4.0 (wordfreq).
- **Practice styles:** `PRACTICE` lists them, `SKILL_OF` maps each to a skill, `DECK_ONLY` names styles that exist for one deck (with a same-skill fallback), `CHOICE_STYLES` the ones answered with the 1–4 chips. Per-card question state lives in `toneQ`, `clozeQ`, `buildQ`, `similarQ`; `faceHidden` and `readingHidden` say what the card hides until the reveal. `inLevel()` is the single deck filter (level, topic, and the similar-words subset).
- **Game layer:** answers go through `recordAnswer()` → combo, XP (`gainXp`, `RANKS`), learned dates, `questEvent()`, the panda; `afterAnswer()` → `checkSeals()`, `checkRungs()`. Challenges (`startQuiz` blitz/exam in `#quizView`) never touch the review schedule. Daily state: `state.quests`, `freezes`/`frozen` (`applyFreezes` at start-up), `wotdSeen`, `recapWeek`. Snapshot format is `FORMAT` (5); bump it when the saved shape changes, so the server refuses uploads from older copies.
- **Ladder:** `EXTRA.ladder` is a list of can-do steps (`id`, `zh`, `py`, `en`, `hu`, `words`, `sentences`). A step is reached when every word is Known in reading and listening, in any order (`rungProgress()`, `checkRungs()` → `state.rungs` {id: day}, 40 XP). `#ladderStrip` shows `nextRung()` after the word of the day (one strip at a time). The three strips live in `#suggestPop`, a popover opened from the Today row's chip `#btnSuggest` (`renderSuggest()`, refreshed by `renderLadderStrip()`); `practiseRung()` opens the missing words as a deck; the progress view has a Ladder tab; from 1200px `#progressRail` (`renderRail()`, refreshed by `renderLadderStrip()`) draws the rank and the rungs in the right margin. The build checks every word and sentence exists.
- **Labels:** a new button or heading gets an English key in `ZH_LABELS` (Chinese and pinyin; keep them correct and natural) and either `data-lbl` in the markup or `zhLabel()` in code. The practice menu's Chinese is in `PRACTICE_ZH`.
- **Meaning languages:** English and Hungarian are on every card (`en`, `hu`); German, Spanish and Romanian come from `data/i18n/<code>.json` into `c.tr` / `e.tr`. Read any of them with `mean(obj, code)`, list the ones switched on with `langsOn()` (Settings → Translations, `state.langs`, at least one on), and use `mainMeaning()` where only one fits. A new word or example sentence needs an entry in every `data/i18n` file, or the build fails.
- **Changelog:** every user-visible change gets a line in `data/changelog.json`. Add to the newest release while it is unpublished; start a new release (bump `version`) once the previous one has been pushed, because the footer's "What's new in …" link names the newest version.
- **Element ids:** any id used from JS must be in `REQUIRED_IDS`; wired controls also go in `CORE_BUTTONS`. `verify.js` and the self-check enforce this.
- **Self-check:**
  - `runSelfCheck()` → `functionalTest()` clicks through every feature with `testing = true`, which turns off animation, saving, toasts and speech. It snapshots state and restores it afterwards.
  - `syncSelfTest()` then runs the sync code against a fake `fetch`. Because it is asynchronous, `runSelfCheck()` returns `{ failed, results, done }`, and `done` resolves with the final results.
  - Add a test for every new feature and keep all checks passing.

## Verify a change

1. `npm run check` and `npm run build` must pass.
2. `npm run selfcheck` runs the in-app self-check in headless Chrome or Edge (Node 22+; `CHROME_PATH` to pick a browser) and fails on any failed check. CI runs it on the single file and on `dist/site/index.html`. To look at it yourself, open `dist/mandarin-flashcards.html` and run `await window.__mandarinApp.runSelfCheck().done`, or use Settings → Run self-check. Every check must pass.
   - The Claude browser pane cannot open local files over 512 KB, and the build is now larger. Start the `dist` preview server instead (`.claude/launch.json`, git-ignored: `python -m http.server 8766 --directory dist`) and open http://localhost:8766/mandarin-flashcards.html. Served over http, "Progress storage" passes too.
   - To test the Pages build, serve the repo root over http (pick a port other than 8765) and open `/dist/site/`.
3. For layout changes, check a 375px and a 320px wide viewport, and a wide one (1440px). Nothing may scroll sideways. The page is one column at every width, only wider on large screens (760px from 820px, 920px from 1100px, 1080px with a bigger card from 1440px); the user tried two columns and found the side column cluttered. `.side` (deck controls, today block, strips) and `.main-col` (round bar, card, answer bar) only group the markup and are `display: contents`. The installed iPhone app runs under a translucent status bar: keep the `env(safe-area-inset-*)` padding on `.app`, `.overlay` and fixed bars.
4. For a migration, test it in a throwaway Postgres container before `supabase db push`. The local `postgres:16-alpine` image works with a stub `auth` schema: `auth.users` and an `auth.uid()` that reads `request.jwt.claim.sub`.

## Content rules

- Pinyin: citation tones, neutral tones unmarked, tone changes written only for 一 and 不.
- English uses American spelling. Hungarian must be natural, with correct accents and definite/indefinite verb forms.
- Every example sentence must contain its headword.
- No external scripts, fonts or images. Network calls are allowed only to the Supabase project, and only in the Pages build.

## Publishing

- **GitHub Pages:**
  - Push to `main` and CI deploys `dist/site` in about a minute: https://nyikozoli.github.io/mandarin-flashcards/
  - Pushes that touch only Markdown, `docs/` or `supabase/` skip CI.
  - The user's rules: push only when asked, at most once per 15 minutes. The local, untracked `.claude/allow-main-commits` marker allows commits to `main`.
  - The service worker caches by build id, so users see an update on their second launch after it.
- **Database:** `supabase db push` applies new migrations to the live project. It changes production, so ask first. Never edit a migration that is already applied; add a new one.
- **Claude link:** https://claude.ai/artifact/TwdGezEZ5JM7CjDNN5vtv1. Publish `dist/artifact.html` with the Artifact tool, passing that `url`. The viewer blocks downloads, so export there offers copy only.

## Environment notes

- Windows. When writing files from Python, use `newline='\n'`; CRLF output broke a build step once.
- Port 8765 may be taken by an unrelated local server; use another port for test servers.
- Python for the optional tools (`scripts/validate.py`, `scripts/freq.py`) is the system install; put throwaway virtual environments under the git-ignored `.validation/`.
