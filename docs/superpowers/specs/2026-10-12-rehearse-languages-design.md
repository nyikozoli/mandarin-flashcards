# Rehearse known languages while learning Chinese

Status: approved in brainstorming on 2026-10-12, awaiting spec review.
Branch: `feature/rehearse` (off `main` at 85acd38).

## Purpose

The learner (today: the owner; Hungarian native, English fluent, Romanian B1) studies Chinese and wants the languages
they already know to stay active. Since 2.4 every word and example sentence carries English, Hungarian, German,
Spanish and Romanian meanings, but they are only shown: nothing asks the learner to produce a Romanian word, and
nothing records whether they still know it.

This feature lets any meaning language be **rehearsed**: it gets its own marks and review schedule, comes up during
normal Chinese study, takes turns as the main meaning, and can be read aloud.

**Success:** during an ordinary Chinese session, Romanian comes up regularly in a form that makes the learner produce
it, and the progress view shows which Romanian words are slipping.

### Rules from the brainstorm

- The language being learned is always one side of a card. In a Chinese session a rehearsed language is only ever
  paired with Chinese (Chinese → Romanian or Romanian → Chinese), never Hungarian → Romanian.
- The set of languages and their roles is configurable and changes over time.
- Content is the existing reviewed translations. No new vocabulary, gender or plural data.

### Out of scope

- Grouped target languages (learning Spanish, Italian and Romanian together, cognates side by side). A later spec,
  built on the per-language marks this one introduces.
- Rehearsing example sentences (their translations are read aloud, but they get no marks).
- New seals, ranks or XP rules for rehearsed languages.
- Typed or multiple-choice answers for Chinese → Romanian cards.

## 1. Data and settings

### Language roles

`state.langs` changes from `{ code: bool }` to `{ code: 'off' | 'show' | 'rehearse' }` for every code in
`MEANING_LANGS` (`en`, `hu`, `de`, `es`, `ro`).

- `off`: not shown.
- `show`: shown on cards, as `true` is today.
- `rehearse`: shown, plus everything in this spec.
- At least one language is `show` or `rehearse` (today's rule, unchanged).
- `restore()` maps `true` → `show`, `false` → `off`, and any other unknown value → `show` for `en`, `off` otherwise.
- `langsOn()` keeps its meaning: the languages that are `show` or `rehearse`, in `MEANING_LANGS` order.
- New helper `langsRehearsed()`: the `rehearse` languages that are available (`LANG_AVAILABLE`), in order.

New persisted settings, in `state.rehearse`:

| Field | Values | Default |
|---|---|---|
| `share` | `{ code: 0–50 }`, percent of cards whose main meaning is that language | 30 for each language set to `rehearse` |
| `every` | `0` (off), `6`, `8`, `12`: one rehearse card after every N answers | 8 |
| `afterGoal` | boolean: offer a short round when the daily goal is reached | true |

Settings → Translations shows each language as a three-way control (Off / Show / Rehearse). A language set to
Rehearse also shows its share slider. Below the list: the mix rate select and the after-goal switch, visible only
while at least one language is set to Rehearse.

### A skill per rehearsed language

Approach A from the brainstorm: a rehearsed language is a skill, next to reading, recall and listening.

- Skill key `say:<code>`, for example `say:ro`, named after the language ("Romanian").
- Marks live in `state.marks['say:ro']` with the existing shape `{ status, srs, misses }`, keyed by the Chinese
  headword. The headword already works as the concept id: 家 → casă.
- `SKILLS` becomes the three fixed skills plus one entry per rehearsed language, rebuilt when the roles change
  (`rebuildSkills()`). `useSkill()`, `stashSkill()`, `marksOf()`, the review schedule, Hard/Good/Easy, undo and
  misses work unchanged.
- `resetMarks()` resets every skill, rehearsed ones included.
- Setting a language back to Show or Off keeps `state.marks['say:<code>']`. Its marks return when it is set to
  Rehearse again.
- The card and word-list seals (读 说 听) gain one seal per rehearsed language, its code in capitals (`RO`), while
  that language is set to Rehearse.

### What gets rehearsed

Words only. A word enters the rehearse pool of a language when:

1. it has a mark (Known or Learning) in any of reading, recall or listening, and
2. it has a non-empty meaning in that language (`mean(c, code)`).

Order within the pool: due in that language first, then Learning, then by misses (most first), then New by
frequency rank (`rk`, most frequent first).

### Snapshot

- `progressSnapshot()` writes rehearse marks under `skills`, next to `recall` and `listen`: `skills['say:ro']`.
- `restore()` reads any `skills['say:<code>']` whose code is in `MEANING_LANGS`, and drops others.
- `state.langs` (new shape) and `state.rehearse` are persisted and synced.
- `FORMAT` goes from 5 to 6. The server's existing format guard then refuses uploads from older copies, which would
  otherwise drop the rehearse marks.

## 2. The rehearse card and how it comes up

### Chinese → Romanian card (skill `say:ro`)

- Front: the Chinese word with pinyin and tone colours, as on a reading card, and a prompt line "RO · In Romanian?"
  (the language name in the label: "In Romanian?").
- Back: the Romanian meaning, large, `lang="ro"`, with a speaker button. The other shown languages follow below,
  smaller.
- Answer: the existing answer bar (Still learning / I know it, and Hard/Good/Easy). It moves only the `say:ro`
  marks.
- Practice style key `rh-ro` (one per rehearsed language; not `s…`, which the menu uses for sentence styles), `SKILL_OF['rh-ro'] = 'say:ro'`, words only
  (`DECK_ONLY`).

### Romanian → Chinese

Not a separate card. It is a recall card whose prompt meaning happens to be Romanian through the main-meaning
rotation (section 3), so it counts as Chinese recall and moves only the recall marks.

### Four ways it comes up

1. **Mixed into the deck.** After every `every` answers in the word deck, one rehearse card is shown in place;
   the deck position does not move. It is answered under the rehearse skill and then the app returns to the
   current skill. Not in challenges (blitz, exam), not on the sentence deck, not in the rehearse tile itself.
   With several rehearsed languages, they take turns weighted by `share`. Nothing happens when the pool is empty.
   Undo (Z) undoes it like any card and restores its mark.
2. **After the daily goal.** When the daily goal is reached and `afterGoal` is on, a strip in the Today popover
   offers "5 Romanian cards?". It opens a temporary 5-card deck from the pool (like the ladder's Practise) and
   returns to the previous deck after the last card. Shown once per day; needs at least 5 words in the pool.
3. **Practice tile.** The practice sheet gets a "Rehearse" row with one tile per rehearsed language:
   "中文 → Română". Its Due list is the language's due words.
4. **Daily quest.** "Answer 5 Romanian cards" joins the quest pool, only while a language is set to Rehearse and
   its pool has at least 5 words. Rehearse answers from all four entry points count.

## 3. Main meaning and read-aloud

### Rotating main meaning

`mainMeaning(o)` becomes `mean(o, mainLang(o))`.

- The base language is the first `show`/`rehearse` language in `MEANING_LANGS` order (English for the owner).
- Each rehearsed language takes its `share`; the base language takes the rest and never less than 30%. When the
  shares add up to more than 70%, they are scaled down to fit.
- The choice is deterministic: a hash of the card's key (`zh`) and `dayKey()` mapped to 0–99. The same card keeps
  its language all day, through undo and revisits; tomorrow it may change.
- When the card has no meaning in the chosen language, the base language is used.
- Applies wherever `mainMeaning()` is used today: the recall prompt (this is Romanian → Chinese), multiple-choice
  options (all options of one question in the same language, the language of the card being asked), the word of
  the day, and sentence prompts.
- Challenges (blitz, exam) always use the base language so scores stay comparable.
- When the main meaning is not the base language, a small language tag (`RO`) shows next to it. On the card back
  all shown languages are listed as today, the main one first.

### Read-aloud

- `16-speech.js` is generalized from Chinese-only to any language: `speakText(text, bcp47, btn)`. Voice choice per
  language uses the same ranking as Chinese (local and enhanced voices first): `ro-RO`, `de-DE`, `es-ES`, `hu-HU`,
  `en-US` (falling back to any `en-*`). The rate setting applies to all.
- A speaker button on each meaning line: the card back, the word pop-up, and example-sentence translations.
- New setting "Read the meaning after the Chinese": Off / Rehearse languages only (default) / Always. With autoplay
  on, after the Chinese is spoken on reveal, the main meaning is spoken in its language when the setting allows.
- When a language has no voice on the device, its speaker buttons are hidden, and Settings shows "No Romanian voice
  on this device" with how to add one (iPhone: Settings → Accessibility → Spoken Content → Voices; Windows:
  Settings → Time & language → Speech).
- `testing` keeps speech off, as today.

## 4. Progress, sync, edge cases, testing

### Progress view

- A row per rehearsed language next to reading, recall and listening: Known / Learning / New over its pool, due
  today, and the 7-day forecast.
- The weekly recap adds "Romanian: N cards".
- Rehearse answers earn XP like any answer and count toward the daily goal and streak.

### Sync

- FORMAT 6 (see section 1). No database migration: progress is a JSON blob.
- The conflict dialog's compare cards add "N Romanian known" when there are rehearse marks.

### Edge cases

| Case | Behaviour |
|---|---|
| Word without a Romanian meaning | Never in the Romanian pool; its main meaning falls back to the base language. |
| Unknown `say:xx` or bad `langs` value in a save | Dropped, or treated as described in section 1. |
| Fewer than 5 words in the pool | No after-goal round and no rehearse quest. Mixed-in cards and the tile still work. |
| Language set back to Show or Off | Its seals, tile, quest and mixed-in cards disappear; its marks stay saved. |
| All rehearsed languages switched off mid-session on the rehearse tile | The practice falls back to `zh` (reading). |

### Labels

New buttons and headings get `ZH_LABELS` entries. Rehearse = 温习 wēnxí ("review what you know"), distinct from
复习 fùxí (Due). The tile's Chinese is in `PRACTICE_ZH`.

### Changelog

A new release in `data/changelog.json` (the next version after the newest published one), one line per
user-visible part: the Rehearse role, rehearse cards, main-meaning rotation, read-aloud in other languages.

### Testing

New self-check tests (each must pass; all existing tests keep passing):

- Settings conversion: `true`/`false` → `show`/`off`; at least one language stays on.
- `say:ro` marks are separate from recall; `useSkill('say:ro')` and back leaves the other skills untouched.
- Pool: only started words with a Romanian meaning, in the documented order.
- Mixed-in card: after N answers a rehearse card appears, the deck position is unchanged, undo restores its mark;
  none in challenges or on the sentence deck.
- Rotation: the same card gets the same language within a day; shares follow the weights over the deck; the base
  language keeps at least 30%; challenges use the base language; missing meaning falls back.
- A Romanian prompt on a recall card moves only the recall mark.
- After-goal round: opens 5 cards and returns to the previous deck.
- Quest: counts rehearse answers.
- Speech: the speaker is hidden without a voice; every spoken utterance has the right `lang`.
- Snapshot: FORMAT 6 round trip with `say:ro`; the simulated-sync test passes.

Manual checks: 320, 375 and 1440 px wide, nothing scrolls sideways; iPhone read-aloud of Romanian.

### Delivery

- Branch `feature/rehearse` off `main`; merged to `main` when done. `feature/multi-language` takes it on its next
  merge from `main` (rehearse marks are keyed by headword, so they are per pack automatically).
- Verify with `npm run check`, `npm run build`, `npm run selfcheck` (single file and site build).
