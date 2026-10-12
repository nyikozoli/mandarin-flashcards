// Runs the in-app self-check in headless Chrome or Edge: `npm run selfcheck [file]`.
// Exits non-zero if any check fails or the page throws. No dependencies: it talks to the browser over the
// DevTools protocol with Node's built-in WebSocket (Node 22+). Set CHROME_PATH to pick a browser.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist', 'mandarin-flashcards.html'));
if (!fs.existsSync(file)) fail('No such file: ' + file + '. Run `npm run build` first.');
if (typeof WebSocket !== 'function') fail('Node ' + process.versions.node + ' has no built-in WebSocket; use Node 22 or newer.');

const candidates = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);
const browser = candidates.find((p) => fs.existsSync(p));
if (!browser) fail('No Chrome or Edge found. Set CHROME_PATH.');

function fail(msg) {
  console.error(msg);
  process.exit(2);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'selfcheck-'));
  const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
    '--user-data-dir=' + profile, 'about:blank'];
  // Ubuntu 24.04 runners block the unprivileged namespaces Chrome's sandbox needs.
  if (process.env.CI) args.unshift('--no-sandbox');
  const proc = spawn(browser, args, { stdio: 'ignore' });
  let ws;
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 150 && !fs.existsSync(portFile); i++) await sleep(100);
    if (!fs.existsSync(portFile)) throw new Error('The browser did not start: ' + browser);
    await sleep(100);
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
    const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('No page target');

    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('DevTools connection failed')); });
    let id = 0;
    const pending = new Map();
    const waiters = [];
    const errors = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result);
        return;
      }
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        errors.push((d.exception && d.exception.description) || d.text);
      }
      for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].method === m.method) { waiters[i].res(m.params); waiters.splice(i, 1); }
    };
    const send = (method, params) => new Promise((res, rej) => { const n = ++id; pending.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method, params: params || {} })); });
    const event = (method) => new Promise((res) => waiters.push({ method, res }));

    await send('Runtime.enable');
    await send('Page.enable');
    const loaded = event('Page.loadEventFired');
    await send('Page.navigate', { url: pathToFileURL(file).href });
    await loaded;
    // SELFCHECK_SEED=<file.json>: merge these fields into the saved progress, then reload, so the checks run on that state.
    if (process.env.SELFCHECK_SEED) {
      const seed = fs.readFileSync(process.env.SELFCHECK_SEED, 'utf8');
      await send('Runtime.evaluate', { expression: `(() => {
        const k = Object.keys(localStorage).find((x) => /\.progress\.v1$/.test(x)) || 'mandarin300.progress.v1';
        const o = JSON.parse(localStorage.getItem(k) || '{}');
        localStorage.setItem(k, JSON.stringify(Object.assign(o, ${seed})));
      })()` });
      const reloaded = event('Page.loadEventFired');
      await send('Page.reload');
      await reloaded;
    }

    const expr = `(async () => {
      for (let i = 0; i < 100 && !(window.__mandarinApp && window.__mandarinApp.runSelfCheck); i++) await new Promise((r) => setTimeout(r, 100));
      if (!window.__mandarinApp) return { started: false, banner: (document.getElementById('errorList') || {}).textContent || '' };
      const r = await window.__mandarinApp.runSelfCheck().done;
      return { started: true, results: r.results };
    })()`;
    const out = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout: 120000 });
    if (out.exceptionDetails) throw new Error('Self-check threw: ' + (out.exceptionDetails.exception || {}).description);
    const v = out.result.value;
    if (!v.started) throw new Error('The app did not start. ' + v.banner);

    let failed = 0;
    for (const r of v.results) {
      const bad = !r.ok;
      if (bad && !r.info) failed++;
      console.log((r.ok ? 'ok   ' : r.info ? 'warn ' : 'FAIL ') + r.name + (bad ? '\n     ' + r.detail : ''));
    }
    errors.forEach((e) => console.log('FAIL uncaught error: ' + e));
    failed += errors.length;
    console.log('\n' + v.results.length + ' checks, ' + failed + ' failed (' + path.relative(process.cwd(), file) + ', ' + path.basename(browser) + ')');
    return failed;
  } finally {
    try { if (ws) ws.close(); } catch (e) { /* closing anyway */ }
    proc.kill();
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) { /* temp dir, best effort */ }
  }
}

main().then((failed) => process.exit(failed ? 1 : 0), (e) => { console.error(e.message || e); process.exit(2); });
