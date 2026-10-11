"""Validate flashcard content against CC-CEDICT, an HSK 2.0 word list and pypinyin.
Usage: python -I validate.py <validation_dir>   (writes report.txt there)"""
import json, re, sys, unicodedata, os
from pypinyin import pinyin, Style

sys.stdout.reconfigure(encoding='utf-8')
base = sys.argv[1]
cards = json.load(open(os.path.join(base, 'content.json'), encoding='utf-8'))
out = []
def say(*a): out.append(' '.join(str(x) for x in a))

MARKS = {'ā':('a',1),'á':('a',2),'ǎ':('a',3),'à':('a',4),'ē':('e',1),'é':('e',2),'ě':('e',3),'è':('e',4),
         'ī':('i',1),'í':('i',2),'ǐ':('i',3),'ì':('i',4),'ō':('o',1),'ó':('o',2),'ǒ':('o',3),'ò':('o',4),
         'ū':('u',1),'ú':('u',2),'ǔ':('u',3),'ù':('u',4),'ǖ':('v',1),'ǘ':('v',2),'ǚ':('v',3),'ǜ':('v',4),'ü':('v',0)}
V = 'aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ'
SYL = re.compile('(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?[' + V + ']+(?:ng|n(?![' + V + '])|r(?![' + V + ']))?')

def syllables(py):
    """tone-marked pinyin -> list of (base, tone) with ü as v, neutral = 5"""
    s = py.lower().replace("'", ' ').replace('-', ' ')
    res = []
    for m in SYL.findall(s):
        tone, b = 5, ''
        for ch in m:
            if ch in MARKS:
                letter, t = MARKS[ch]
                b += letter
                if t: tone = t
            else:
                b += ch
        res.append((b, tone))
    return res

def numeric(tok):
    """CEDICT / pypinyin numeric syllable -> (base, tone)"""
    tok = tok.lower().replace('u:', 'v').replace('ü', 'v')
    m = re.match(r'^([a-z]+)([1-5])?$', tok)
    if not m: return (tok, 0)
    return (m.group(1), int(m.group(2) or 5))

def fmt(sy): return ' '.join(b + str(t) for b, t in sy)

# ---------- load CC-CEDICT ----------
cedict = {}
for line in open(os.path.join(base, 'dl', 'cedict_ts.u8'), encoding='utf-8'):
    if line.startswith('#'): continue
    m = re.match(r'^(\S+) (\S+) \[([^\]]+)\] /(.*)/\s*$', line)
    if not m: continue
    simp, read, gloss = m.group(2), m.group(3), m.group(4)
    cedict.setdefault(simp, []).append(([numeric(t) for t in read.split()], gloss))
say('CC-CEDICT entries loaded:', len(cedict))

# ---------- HSK 2.0 levels 1 and 2 ----------
hsk = {}
for lvl in (1, 2):
    for e in json.load(open(os.path.join(base, 'dl', 'hsk%d.json' % lvl), encoding='utf-8')):
        hsk[e['simplified']] = lvl
say('HSK 2.0 level 1+2 words loaded:', len(hsk))

SANDHI_OK = {('yi', 1): {2, 4}, ('bu', 4): {2}}

def compare(mine, ref):
    """Return (kind, detail) where kind in ok / neutral / sandhi / MISMATCH"""
    if len(mine) != len(ref):
        return 'MISMATCH', 'syllable count %d vs %d' % (len(mine), len(ref))
    kinds = set()
    for (mb, mt), (rb, rt) in zip(mine, ref):
        rb2 = rb[:-1] if rb.endswith('r') and rb not in ('er',) and not mb.endswith('r') else rb
        if mb != rb and mb != rb2 and not (mb.endswith('r') and mb[:-1] == rb):
            return 'MISMATCH', 'syllable %s vs %s' % (mb, rb)
        if mt == rt: continue
        if (rb, rt) in SANDHI_OK and mt in SANDHI_OK[(rb, rt)]: kinds.add('sandhi'); continue
        if mt == 5 or rt == 5: kinds.add('neutral'); continue
        return 'MISMATCH', 'tone %s%d vs %s%d' % (mb, mt, rb, rt)
    return ('neutral' if 'neutral' in kinds else 'sandhi' if kinds else 'ok'), ''

# ---------- 1. headwords vs CC-CEDICT ----------
say('\n=== 1. HEADWORDS vs CC-CEDICT ===')
stats = {'ok': 0, 'sandhi': 0, 'neutral': 0, 'MISMATCH': 0, 'missing': 0}
gloss_rows = []
for c in cards:
    mine = syllables(c['py'])
    entries = cedict.get(c['zh'])
    if not entries:
        # compose from single characters
        stats['missing'] += 1
        per = []
        for ch in c['zh']:
            per.append('/'.join(sorted({fmt(r) for r, _ in cedict.get(ch, [])})) or '?')
        say('  NOT A CEDICT ENTRY  #%d %s [%s]  -> characters: %s' % (c['n'], c['zh'], c['py'], ' + '.join(per)))
        continue
    best = None
    for read, gloss in entries:
        k, d = compare(mine, read)
        rank = {'ok': 0, 'sandhi': 1, 'neutral': 2, 'MISMATCH': 3}[k]
        if best is None or rank < best[0]: best = (rank, k, d, read, gloss)
    _, k, d, read, gloss = best
    stats[k] += 1
    if k == 'MISMATCH':
        say('  MISMATCH  #%d %s mine=[%s] cedict=%s  (%s)' % (c['n'], c['zh'], c['py'], ' | '.join(fmt(r) for r, _ in entries), d))
    elif k == 'neutral':
        say('  neutral-tone difference  #%d %s mine=[%s] cedict=[%s]' % (c['n'], c['zh'], c['py'], fmt(read)))
    gloss_rows.append((c, gloss))
say('  summary:', stats)

# ---------- 2. English meaning overlap with CEDICT glosses ----------
say('\n=== 2. ENGLISH MEANINGS: low overlap with CC-CEDICT glosses (manual review) ===')
STOP = set('a an the to of for and or (used sth sb someone something be is in on at with as by used word measure particle'.split())
def words(s): return {w for w in re.findall(r'[a-z]+', s.lower()) if w not in STOP and len(w) > 1}
low = 0
for c, _ in gloss_rows:
    allg = ' '.join(g for _, g in cedict[c['zh']])
    ov = words(c['en']) & words(allg)
    if not ov:
        low += 1
        say('  #%d %s  mine: %s\n        cedict: %s' % (c['n'], c['zh'], c['en'], allg[:220]))
say('  entries with zero word overlap:', low)

# ---------- 3. HSK membership ----------
say('\n=== 3. HSK 2.0 LEVEL 1-2 MEMBERSHIP ===')
in1 = [c for c in cards if hsk.get(c['zh']) == 1]
in2 = [c for c in cards if hsk.get(c['zh']) == 2]
notin = [c for c in cards if c['zh'] not in hsk]
say('  HSK1: %d   HSK2: %d   not in HSK 1-2: %d' % (len(in1), len(in2), len(notin)))
say('  not in HSK 1-2:', ', '.join(c['zh'] for c in notin))
mine_set = {c['zh'] for c in cards}
say('  HSK 1-2 words not in the deck:', ', '.join(sorted(w for w in hsk if w not in mine_set)))

# ---------- 4. sentence pinyin vs pypinyin ----------
say('\n=== 4. EXAMPLE-SENTENCE PINYIN vs pypinyin (per character) ===')
sstats = {'ok': 0, 'sandhi': 0, 'neutral': 0, 'MISMATCH': 0}
for c in cards:
    for ex in c['ex']:
        hz = [ch for ch in ex['zh'] if '一' <= ch <= '鿿']
        ref_raw = pinyin(''.join(hz), style=Style.TONE3, neutral_tone_with_five=True, errors='ignore')
        ref = [numeric(r[0]) for r in ref_raw]
        # merge erhua 儿 (not in 儿子/女儿) into the previous syllable
        merged = []
        for i, ch in enumerate(hz):
            if ch == '儿' and i > 0 and not (i + 1 < len(hz) and hz[i + 1] == '子') and hz[i - 1] != '女':
                b, t = merged[-1]
                merged[-1] = (b + 'r', t)
            else:
                merged.append(ref[i])
        mine = syllables(ex['py'])
        k, d = compare(mine, merged)
        sstats[k] += 1
        if k == 'MISMATCH':
            say('  MISMATCH  #%d %s\n      sentence: %s\n      mine:     %s\n      pypinyin: %s   (%s)' % (c['n'], c['zh'], ex['zh'], fmt(mine), fmt(merged), d))
        elif k == 'neutral':
            diffs = ['%s:%s%d/%s%d' % (hz_c, mb, mt, rb, rt) for hz_c, (mb, mt), (rb, rt) in zip([h for h in hz if True], mine, merged) if mt != rt and (mt == 5 or rt == 5)]
            say('  neutral  #%d %s | %s  -> %s' % (c['n'], c['zh'], ex['zh'], ', '.join(diffs)))
say('  summary:', sstats)

open(os.path.join(base, 'report.txt'), 'w', encoding='utf-8').write('\n'.join(out))
print('\n'.join(out))
