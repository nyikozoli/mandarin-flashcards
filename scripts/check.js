// Runs every data check: `npm run check`. Exits non-zero if any check reports a problem.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const here = __dirname;
const hsk3 = path.join(here, '..', 'data', 'hsk3');
const runs = [
  ['check-hsk12.js'],
  ['check-sentence-pinyin.js'],
  ...fs.readdirSync(hsk3).filter((f) => /\.json$/.test(f)).sort().map((f) => ['check-hsk3.js', path.join(hsk3, f)])
];

let failed = 0;
for (const [script, ...args] of runs) {
  const r = spawnSync(process.execPath, [path.join(here, script), ...args], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  // check-hsk12 and check-sentence-pinyin print "ERRORS n" / "errors n"; check-hsk3 prints "n problems" and exits 1.
  const bad = r.status !== 0 || /ERRORS [1-9]|errors [1-9]|[1-9]\d* problems/.test(out);
  if (bad) failed++;
  console.log((bad ? 'FAIL ' : 'ok   ') + [script, ...args.map((a) => path.relative(path.join(here, '..'), a))].join(' '));
  if (bad) process.stdout.write(out.replace(/^/gm, '     '));
}
console.log(failed ? '\n' + failed + ' check(s) failed' : '\nall data checks passed');
process.exit(failed ? 1 : 0);
