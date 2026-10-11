# Mandarin HSK flashcards

Offline flashcards for 598 HSK 1–3 words and their 777 example sentences, with pinyin, English and Hungarian, read-aloud, spaced repetition, progress tracking and optional cloud sync.

**Use it:** https://nyikozoli.github.io/mandarin-flashcards/ (add it to your phone's home screen; it works offline), or build the single-file version below and double-click it.

## Build

```bash
npm run check     # data checks: fields, duplicates, tone marks, pinyin syllable counts
npm run build     # writes dist/ and verifies it
```

No dependencies: Node 18 or newer is all you need. `npm run build` runs `scripts/build.js`, which writes three versions and checks the first two with `scripts/verify.js`:
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
| `src/template.html` | The whole app: markup, CSS and JavaScript. `__VOCAB_JSON__`, `__EXPECTED_TOTAL__`, `__EXPECTED_LEVELS__`, `__SYNC_CONFIG__` and `<!--__SITE_HEAD__-->` are filled in by the build. |
| `src/sync-config.json` | Supabase project URL, public `anon` key and the URL a magic link returns to. See [Cloud sync](#cloud-sync). |
| `src/pwa/` | Service worker, web-app manifest and icons for the GitHub Pages version. |
| `data/hsk12/v1.js` … `v6.js` | HSK 1–2 words, grouped by topic. Entry: `[hanzi, pinyin, english, hungarian, sentence, sentenceEn, sentenceHu, (second sentence …)]` |
| `data/hsk12/sentence-pinyin.js` | Pinyin for every HSK 1–2 example sentence, keyed by the Chinese sentence. |
| `data/hsk3/*.json` | HSK 3 words. Entry: `[hanzi, pinyin, english, hungarian, sentence, sentencePinyin, sentenceEn, sentenceHu, (…)]` |
| `data/lists/hsk1.json`, `hsk2.json`, `hsk3.json` | Official HSK 2.0 word lists (from github.com/drkameleon/complete-hsk-vocabulary). They set each card's level. |
| `scripts/` | `build.js`, `verify.js`, `check.js` and the individual checks, `fix-hsk3.js`, `validate.py`. |
| `supabase/` | `config.toml` and `migrations/` for cloud sync. |
| `.github/workflows/pages.yml` | CI: data checks, build, deploy `dist/site` to GitHub Pages. |
| `docs/prd.txt` | The original requirements. |

## Cloud sync

Optional, and switched on for the GitHub Pages build only. It syncs progress (marks, review schedule, activity, settings) between devices through Supabase. The vocabulary stays inlined in the HTML; none of the word data is fetched.

Sign-in is an email magic link, so there is no password to store. Writes go through the `upsert_progress` SQL function, which receives the `updated_at` this device last saw and writes only if the cloud row still has it, in one atomic statement. When it refuses, the app shows both copies with their last-modified date and known/learning counts, and offers to keep either one. Nothing is merged, and nothing is overwritten in the background.

`voice`, `badVoices`, `voicesTested` and `warmup` never leave the device (see `DEVICE_ONLY` in `src/template.html`). Voice names belong to one operating system, so syncing them would break audio elsewhere.

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
- The database password and the `service_role` key live outside it, in `C:\Users\nyiko\.secrets\mandarin-hsk\`.
- `.gitignore` also blocks `.supabase-*`, `*-db-password`, `*-service-key` and `.env*`, in case a copy lands here.
- `scripts/build.js` refuses to build if `sync-config.json` contains a `service_role` key, and `scripts/verify.js` fails the build if one reaches an output file.

Row-level security is what makes the anon key safe to publish:
- There is deliberately no `anon` policy and no `anon` grant on `progress`.
- `authenticated` holds only `SELECT, INSERT, UPDATE, DELETE`. `TRUNCATE` is revoked, because row-level security does not filter it.
- `upsert_progress` is `security invoker`, so the policies still apply inside it, and it reads `auth.uid()` rather than trusting a `user_id` argument.

**Sign-ups are closed.** Sync is for existing accounts: `[auth] enable_signup = false`, applied with `supabase config push` (preview it first with `echo n | supabase config push`). Leave `[auth.email] enable_signup = true`; the CLI treats it as the email login switch, and turning it off locks out existing users too.

**Not production-ready yet:** magic-link email uses Supabase's built-in mail server, which allows only a few emails per hour. Configure `[auth.email.smtp]` in `supabase/config.toml` with your own SMTP provider before others depend on signing in.

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
node scripts/fix-hsk3.js fixes.json             # apply [headword, old text, new text] corrections to the HSK 3 files
```

The in-app self-check (Settings → Run self-check) tests the data and every control in the browser, including the sync logic against a simulated server.

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
