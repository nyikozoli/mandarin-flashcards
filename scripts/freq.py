# Regenerates data/freq.json (word ranks and shares, character shares) from wordfreq's Chinese list.
#   python -m venv .validation/wf-venv && .validation/wf-venv/Scripts/python -m pip install wordfreq
#   npm run build    (writes .validation/content.json)
#   .validation/wf-venv/Scripts/python -I scripts/freq.py .validation/content.json data/freq.json
# The output is an adaptation of wordfreq's data and stays CC BY-SA 4.0.
import json, sys, wordfreq, importlib.metadata as md
sys.stdout.reconfigure(encoding='utf-8')
cards = json.load(open(sys.argv[1], encoding='utf-8'))
words = [c['zh'] for c in cards]
freq = wordfreq.get_frequency_dict('zh')
order = sorted(freq, key=lambda w: -freq[w])
rank = {w: i + 1 for i, w in enumerate(order)}
han = lambda ch: '㐀' <= ch <= '鿿'
charf, tot = {}, 0.0
for tok, f in freq.items():
    for ch in tok:
        if han(ch):
            charf[ch] = charf.get(ch, 0.0) + f
            tot += f
mine = sorted({ch for w in words for ch in w if han(ch)})
out = {
  'source': 'wordfreq ' + md.version('wordfreq') + ' (Robyn Speer and contributors), Chinese frequency list; ranks and shares extracted for the HSK 1-3 headwords',
  'license': 'CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). This file is an adaptation and is shared under the same license.',
  'words': {w: [rank.get(w), round(freq[w] * 1e6, 1) if w in freq else None] for w in words},
  'chars': {ch: round(charf.get(ch, 0.0) / tot * 1e6, 1) for ch in mine}
}
print('word share of all 598:', round(sum(v[1] or 0 for v in out['words'].values()) / 1e6, 3),
      ' char share of their', len(mine), 'characters:', round(sum(out['chars'].values()) / 1e6, 3))
with open(sys.argv[2], 'w', encoding='utf-8', newline='\n') as fh:
    fh.write('{\n  "source": ' + json.dumps(out['source']) + ',\n  "license": ' + json.dumps(out['license']) + ',\n  "words": {\n')
    fh.write(',\n'.join('    ' + json.dumps(k, ensure_ascii=False) + ': ' + json.dumps(v) for k, v in out['words'].items()))
    fh.write('\n  },\n  "chars": {\n')
    fh.write(',\n'.join('    ' + json.dumps(k, ensure_ascii=False) + ': ' + json.dumps(v) for k, v in out['chars'].items()))
    fh.write('\n  }\n}\n')
