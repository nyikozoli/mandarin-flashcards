# Mandarin HSK flashcards

Offline flashcards for 598 HSK 1–3 words and their 777 example sentences, with pinyin, English and Hungarian, read-aloud, spaced repetition per skill and optional cloud sync. It also has:
- **Practice styles:** 17, from flashcards and listening to fill-the-gap, sentence building, typed and graded pinyin (Type it, Dictation), a tone quiz and look-alike/sound-alike drills.
- **Learning aids:** character memory hints, topics, and word frequency.
- **Motivation and games:** daily quests, a 60-second blitz, level exams, seals to collect, and a panda that grows as you study.
- **Interface:** labels in 中文 + English.
- **Rehearse languages you know:** English, Hungarian, German, Spanish or Romanian alongside the Chinese, with their own marks, cards mixed into the deck, a round after the daily goal, and read-aloud.

What changed in each version is in `data/changelog.json` and in the app under Settings → What's new.

**Use it:** https://nyikozoli.github.io/mandarin-flashcards/ (add it to your phone's home screen; it works offline), or build the single-file version below and double-click it.

## Build

```bash
npm run check     # data checks: fields, duplicates, tone marks, pinyin syllable counts
npm run build     # writes dist/ and verifies it
npm run selfcheck # runs the in-app self-check in headless Chrome or Edge (Node 22+)
```

To look at the build in a browser, serve `dist/` over http, e.g. `python -m http.server 8766 --directory dist`, and open http://localhost:8766/mandarin-flashcards.html. Double-clicking `dist/mandarin-flashcards.html` works too.

No dependencies: Node 18 or newer builds it; the headless self-check needs Node 22 or newer. `npm run build` runs `scripts/build.js`, which writes three versions and checks the first two with `scripts/verify.js`:
- HTML structure and tag balance, and script syntax
- 598 words with every field and at least one example each, with the right count per level and no duplicate headwords
- every element the code uses exists
- no external `http(s)` resources
- no `service_role` key

The build stops if a check fails.

| Output | What it is |
|---|---|
| `dist/mandarin-flashcards.html` | Single offline file. Double-click to open. |
| `dist/site/` | GitHub Pages version (`index.html`, `sw.js`, manifest, icons). Works offline after the first visit and installs to a phone's home screen. Built and deployed by CI on every push to `main`. |
| `dist/artifact.html` | Version for the claude.ai link (the viewer adds its own `<html>`/`<head>`/`<body>`). |

## Layout

| Path | Contents |
|---|---|
| `src/index.html` | The page: markup and the early error reporter. `__VOCAB_JSON__`, `__EXPECTED_TOTAL__`, `__EXPECTED_LEVELS__`, `__SYNC_CONFIG__` and `<!--__SITE_HEAD__-->` are filled in by the build. |
| `src/styles/*.css` | The CSS, split by area, joined in file-name order (the order is the cascade). |
| `src/js/*.js` | The JavaScript, one file per area (labels, sync, deck, practice, game, panda, speech, self-check…), joined in file-name order into one script. |
| `src/sync-config.json` | Supabase project URL, public `anon` key and the URL a magic link returns to. See [Cloud sync](#cloud-sync). |
| `src/pwa/` | Service worker, web-app manifest and icons for the GitHub Pages version. |
| `data/hsk12/v1.js` … `v6.js` | HSK 1–2 words, grouped by topic. Entry: `[hanzi, pinyin, english, hungarian, sentence, sentenceEn, sentenceHu, (second sentence …)]` |
| `data/hsk12/sentence-pinyin.js` | Pinyin for every HSK 1–2 example sentence, keyed by the Chinese sentence. |
| `data/hsk3/*.json` | HSK 3 words. Entry: `[hanzi, pinyin, english, hungarian, sentence, sentencePinyin, sentenceEn, sentenceHu, (…)]` |
| `data/lists/hsk1.json`, `hsk2.json`, `hsk3.json` | Official HSK 2.0 word lists (from github.com/drkameleon/complete-hsk-vocabulary). They set each card's level. |
| `data/stories.json` | The story in daily episodes. See [The story](#the-story). |
| `scripts/` | `build.js`, `verify.js`, `check.js` and the individual checks, `fix-hsk3.js`, `validate.py`. |
| `supabase/` | `config.toml` and `migrations/` for cloud sync. |
| `.github/workflows/pages.yml` | CI: data checks, build, deploy `dist/site` to GitHub Pages. |
| `docs/prd.txt` | The original requirements. |

## Cloud sync

Optional, and switched on for the GitHub Pages build only. It syncs progress (marks, review schedule, activity, settings) between devices through Supabase. The vocabulary stays inlined in the HTML; none of the word data is fetched.

Sign-in is an email magic link, so there is no password to store. An app installed on the iPhone Home Screen keeps its own storage, and the link opens in Safari. So Safari can hand its sign-in over: Settings → Sync → Move to the app shows a one-time code (the refresh token) and signs Safari out on that device without ending the session; pasted into the installed app, the code becomes that app's own sign-in. Writes go through the `upsert_progress` SQL function, which receives the `updated_at` this device last saw and writes only if the cloud row still has it, in one atomic statement. When it refuses, the app shows both copies with their last-modified date and known/learning counts, and offers to keep either one. Nothing is merged, and nothing is overwritten in the background. Changes upload automatically; while signed in, a sync button in the top bar (and Settings → Sync now) syncs on demand, spins while it works, and shows a dot when changes are waiting to upload.

`voice`, `badVoices`, `voicesTested` and `warmup` never leave the device (see `DEVICE_ONLY` in `src/js/04-transfer.js`). Voice names belong to one operating system, so syncing them would break audio elsewhere.

The single file and `dist/artifact.html` ship with sync off. Neither has a stable `https` address for a magic link to return to: one opens over `file://`, the other runs in a cross-origin frame. Both hide the whole Settings → Sync section and stay fully offline.

| Path | Contents |
|---|---|
| `src/sync-config.json` | `url`, `anonKey`, `siteUrl`. The anon key is public by design (it ships in every page), and row-level security is the only boundary. Deleting this file builds every version with sync off. |
| `supabase/config.toml` | Auth settings, `site_url` and the redirect allow-list. `siteUrl` above must appear in `additional_redirect_urls`, or the magic link bounces. |
| `supabase/migrations/*.sql` | The `progress` table, its row-level-security policies, the privilege revocations, and `upsert_progress`. |

The project is `mandarin-hsk` (`cxmuuxennxfdhavtvrbw`, `eu-west-2`), and the CLI is linked to it from this folder:

```bash
supabase db push      # apply migrations that are not yet on the server
supabase migration list
```

**Secrets never go in this repository; it is public.**
- The database password, the `service_role` key and other API keys live in `.secrets/`, which is git-ignored and never committed.
- `.gitignore` also blocks `.supabase-*`, `*-db-password`, `*-service-key`, `*-api-key` and `.env*`, in case a copy lands elsewhere.
- `scripts/build.js` refuses to build if `sync-config.json` contains a `service_role` key, and `scripts/verify.js` fails the build if one reaches an output file.

Row-level security is what makes the anon key safe to publish:
- There is deliberately no `anon` policy and no `anon` grant on `progress`.
- `authenticated` holds only `SELECT, INSERT, UPDATE, DELETE`. `TRUNCATE` is revoked, because row-level security does not filter it.
- `upsert_progress` is `security invoker`, so the policies still apply inside it, and it reads `auth.uid()` rather than trusting a `user_id` argument.
- A restrictive policy also requires the account to be in `public.sync_allowlist`. The migration enrolled every account that had signed in by then. The list has no API access; add an account from the SQL editor with `insert into public.sync_allowlist (user_id) values ('<auth.users id>');`. An account that is not on the list sees "This account is not enabled for cloud sync."

**Sign-ups are closed.** Sync is for existing accounts: `[auth] enable_signup = false`, applied with `supabase config push` (preview it first with `echo n | supabase config push`). Leave `[auth.email] enable_signup = true`; the CLI treats it as the email login switch, and turning it off locks out existing users too.

**Not production-ready yet:** magic-link email uses Supabase's built-in mail server, which allows only a few emails per hour. Configure `[auth.email.smtp]` in `supabase/config.toml` with your own SMTP provider before others depend on signing in.

## Progress per skill

Reading (Chinese → meaning, 汉字 only, multiple choice), recall (meaning → Chinese) and listening (listening, which tone) each keep their own Known/Learning marks, review schedule and Due list. Words and sentences each remember their own place in the deck. In the saved progress, reading stays in the top-level `status`, `srs` and `misses`, and the other skills sit under `skills`, so an older copy of the app still reads the reading skill.

The saved progress also holds `notes`, your own short note per word (`{ headword: text }`, at most 200 characters each, words only, always shown as plain text), added in snapshot format 8. Notes are exported and synced with the rest; they need no database change, because the server stores the snapshot as one JSON value and only compares its format number.

## Small sessions and trouble words

- **Just 5 cards:** while the day has no answer yet, a button under the Today row starts a round of five cards (due reviews first, then new ones) in the current practice style. The answers count like any others, and one answer keeps the streak. The round ends with a choice between five more and stopping.
- **Trouble words:** a card missed three or more times in the active skill that is not Known there. They form a study mode of their own (`trouble`), reached from the 难 chip in the Today row, the Trouble filter of the word list and the stats in the progress view; a miss brings the card back at the end of the deck.

## The story

`data/stories.json` is a story in 30 episodes of 6 to 8 lines, written with the app's own words. Episode 1 is open from the start; each day the daily goal is reached opens the next one (at most one a day, in order), and an open episode stays readable. The reader shows every word as a tappable word, the story's names with their pinyin, the pinyin of each line, the translation of a line when it is tapped, and reads a line or the whole episode aloud. The saved progress holds `story`: `{ unlocked, days: { episode: day it opened }, read: { episode: day first read }, seen, py }`, exported and synced like the rest.

```json
{
  "names": [{ "zh": "安娜", "py": "Ānnà", "en": "Anna", "hu": "Anna", "de": "Anna", "es": "Anna", "ro": "Anna" }],
  "extra": [],
  "episodes": [{
    "id": 1,
    "level": 1,
    "title": { "zh": "下雨了", "py": "Xià yǔ le", "en": "…", "hu": "…", "de": "…", "es": "…", "ro": "…" },
    "recap": { "en": "", "hu": "", "de": "", "es": "", "ro": "" },
    "lines": [{ "who": "王先生", "zh": "…", "py": "…", "en": "…", "hu": "…", "de": "…", "es": "…", "ro": "…" }]
  }]
}
```

- `names` are the proper names the story uses and `extra` any other allow-listed word outside the word list (same shape, empty now); neither may be a headword. In the reader they are tappable like words and marked as names.
- `episodes` have the ids 1…N in order. `level` says which words an episode may use: 1 is HSK 1; 2 is HSK 1–2 and the Travel pack; 3 is HSK 1–3 and the Travel pack. It never goes down.
- `recap` is one line per language about the story so far, shown above the episode; it is empty in episode 1.
- A line's optional `who` is its speaker, written in Chinese with names and headwords. A line without it is the narrator.
- `node scripts/check-stories.js` (part of `npm run check`, and run by the build) fails when a Chinese character is covered by no headword or name, a word is above the episode's level, a text is missing in one of the five languages, or the shape is off. It prints, as warnings to read, every place where a line's pinyin differs from its words' own (tone changes of 一 and 不, neutral tones). `--segments` shows how each sentence was split.
- The file is optional: without it the story hides and the build still passes. `STORIES_FILE=path npm run build` builds with another file, for trying a draft.

## Reading help

- **Tap a word:** in example sentences and on sentence cards, every HSK 1–3 word is tappable and shows its pinyin, meaning and level. Sentences are split by longest match against the app's own word list, which covers about 95% of the characters in the sentences.
- **Multiple choice without pinyin** (Settings, on by default): turn off "Show pinyin in multiple choice" to see only the characters until you answer.
- **Fading pinyin** (Settings, off by default): in Chinese → meaning, a card whose next review is a week or more away hides its pinyin until you tap it. `docs/prd.txt` asks for pinyin to stay visible, so this is opt-in.

## Topics, frequency and hints

| File | What | How it was made |
|---|---|---|
| `data/travel.json` | The Travel pack: about 60 modern-life words outside HSK (apps, mobile payment, phone and internet, getting around), filed as level 4 and shown as "Travel". `words` in the HSK 3 entry shape, `brands` (app and brand names, tagged "app" on the card), `topics` (each word's topic, merged into `data/topics.json`) and `ladder` (its can-do steps, added to the ladder) | Drafted by an agent from what a visitor meets every day, reviewed by a second one; German, Spanish and Romanian go into `data/i18n` like every other word |
| `data/topics.json` | One of 17 topics per word | Tagged by rule (most specific topic wins; function words → grammar), then reviewed |
| `data/freq.json` | Frequency rank and share of running text per word, share per character | Extracted from [wordfreq](https://github.com/rspeer/wordfreq) 3.1.1. Regenerate with `scripts/freq.py` (steps in its header). **This file is CC BY-SA 4.0**, as an adaptation of wordfreq's data. |
| `data/i18n/<code>.json` | German, Spanish and Romanian meanings and sentence translations: `{ code, name, words: { headword: meaning }, sentences: { sentence: translation } }` | Translated from the Chinese with the English and Hungarian as sense reference, then reviewed in three rounds per language (accuracy, native fluency, a side-by-side check of all three). The build fails if a word or sentence is missing. |
| `data/changelog.json` | Release notes, newest first: `version`, `date`, `title`, and `groups` of items | Written by hand for every user-visible change. The build checks the shape, and the footer's "What's new" link names the newest version. |
| `data/ladder.json` | The can-do ladder: about 30 real-life steps (`id`, `zh`, `py`, `en`, `hu`, `words`, `sentences`), easiest first | Drafted from the word list and topics, then reviewed by a second, independent pass. The build fails if a word is not a headword or a sentence is not an example sentence. |
| `data/cloze-exclude.json` | Fill the gap: words that also fit a sentence's gap (`word`, `sentence`, `not`), never offered as its wrong answers | Found with `scripts/judge.js` (TypeSafe's Jev model), then checked by hand. The build fails if a word is not a headword of the same length or the sentence is not one of the word's examples. |
| `data/choice-exclude.json` | Multiple choice: pairs of words that can mean the same (`pairs`), never offered as each other's wrong option. Words that share an English sense, and homophones in listening questions, are kept apart by `optionClash()` without a list | Found with `scripts/judge-choice.js` (Jev), then checked by hand. The build fails if a pair is not two headwords. |
| `data/hints.json` | Memory hints for 180 characters (picture, combined meaning, or meaning + sound part) | Written from the Shuowen and mainstream modern etymology, then fact-checked by an independent review; contested readings are marked "Traditionally" |

The build adds rank, frequency and topic to each card and puts the topic list, character frequencies, hints, the ladder and the story in a second JSON block (`extra-data`). These files are optional: without them the related features hide.

## Interface labels

Buttons and headings carry their Chinese name (`ZH_LABELS` in `src/js/02-labels.js`: 复习 Due, 我会了 I know it…), with the pinyin in the tooltip. Settings → Interface labels picks 中文 + English (the default), English, or 中文 only. In 中文 only, the English stays in the page, visually hidden, for screen readers. Static labels are marked `data-lbl` in the markup; labels built in code go through `zhLabel()`.

## Pinyin conventions

- Citation tones with tone marks.
- Neutral tones unmarked (`péngyou`, `xǐhuan`).
- Tone changes written only for 一 and 不 (`yídìng`, `bú kèqi`), never third-tone sandhi.
- Erhua as one syllable (`yìdiǎnr`).
- Sentences: one syllable per character, first letter capitalised.

## Checks

```bash
npm run check                                   # all of the below
node scripts/check-hsk12.js                     # HSK 1–2 words
node scripts/check-sentence-pinyin.js           # every HSK 1–2 sentence has pinyin with the right syllable count
node scripts/check-hsk3.js data/hsk3/h3-1.json  # one HSK 3 file
node scripts/check-stories.js                   # the story: coverage by the word list, levels, five languages
node scripts/fix-hsk3.js fixes.json             # apply [headword, old text, new text] corrections to the HSK 3 files
```

Settings shows the build date and build id. The build id is a hash of the app and its data, and also names the service worker cache, so it changes exactly when the app does.

CI runs `npm run selfcheck` on every push, against the single file and the site build. The in-app self-check (Settings → Run self-check) tests the data and every control in the browser, including the sync logic against a simulated server.

### Dictionary and pinyin cross-check (optional)

Compares headwords with CC-CEDICT and sentence pinyin with `pypinyin`, then lists differences for review. Most differences are neutral tones or places where the tools are wrong; read the report rather than applying it blindly.

```bash
python -m venv .validation/venv
.validation/venv/Scripts/python -m pip install pypinyin
curl -L -o .validation/cedict.zip https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.zip
# unzip cedict_ts.u8 into .validation/dl/ and copy data/lists/hsk1.json and hsk2.json there too
npm run build                                   # writes .validation/content.json
.validation/venv/Scripts/python -I scripts/validate.py .validation
```

The report is written to `.validation/report.txt`.
