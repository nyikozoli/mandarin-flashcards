// TypeSafe's Jev model for the local judge scripts (judge.js, judge-translations.js): requests with retries,
// an answer cache per script in .validation/, and the cost estimate for --dry-run. Never used by the build or CI.
// The API key comes from TYPESAFE_API_KEY or .secrets/.typesafe-api-key (git-ignored).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '.validation');
const API = process.env.TYPESAFE_API_URL || 'https://api.typesafe.ai/v1/systemone';
// TypeSafe's list price (October 2026). Output tokens are a handful per request and left out of estimates.
const USD_PER_INPUT_TOKEN = 42 / 1e9;

function apiKey() {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY.trim();
  const file = path.join(ROOT, '.secrets', '.typesafe-api-key');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  throw new Error('No API key: create one at https://console.typesafe.ai and save it in .secrets/.typesafe-api-key');
}

// A client whose answers are cached in .validation/<cacheName>, keyed by endpoint and request,
// so a rerun only pays for requests it has not sent before.
function jevClient(cacheName) {
  const file = path.join(OUT, cacheName);
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* first run */ }
  const keyOf = (body) => crypto.createHash('sha256').update(API + JSON.stringify(body)).digest('hex');
  const usage = { requests: 0, cached: 0, input_tokens: 0 };

  async function ask(body) {
    const k = keyOf(body);
    if (cache[k]) { usage.cached++; return cache[k]; }
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(API, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        usage.requests++;
        usage.input_tokens += (data.usage && data.usage.input_tokens) || 0;
        cache[k] = data.answers;
        return data.answers;
      }
      const retry = res.status === 429 || res.status === 529 || res.status >= 500;
      if (!retry || attempt >= 5) throw new Error('TypeSafe API ' + res.status + ': ' + (await res.text()).slice(0, 300));
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  const cached = (body) => cache[keyOf(body)];
  function save() {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cache));
  }
  const summary = () => 'API requests ' + usage.requests + ' (cached ' + usage.cached + '), input tokens ' + usage.input_tokens;
  return { ask, cached, save, summary, usage };
}

// Runs fn over the items a few at a time; the cache is saved even when a request fails.
async function runPool(items, fn, client, parallel) {
  const results = new Array(items.length);
  let next = 0, done = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
      if (++done % 25 === 0) console.log('  ' + done + ' / ' + items.length);
    }
  };
  try {
    await Promise.all(Array.from({ length: parallel || 4 }, worker));
  } finally {
    client.save();
  }
  return results;
}

// Input tokens per request: a fixed part plus the request's characters, fitted on the first runs of both scripts
// (long Chinese-heavy cloze requests and short translation requests).
const TOKENS_PER_REQUEST = 140;
const CHARS_PER_TOKEN = 1.84;

// The --dry-run line: requests not yet cached ({ send, cached, chars }), their input tokens and cost.
function costLine(plan) {
  const tokens = Math.round(plan.send * TOKENS_PER_REQUEST + plan.chars / CHARS_PER_TOKEN);
  return 'To send: ' + plan.send + ' requests (' + plan.cached + ' already answered), about ' + tokens.toLocaleString('en-US') +
    ' input tokens ≈ $' + (tokens * USD_PER_INPUT_TOKEN).toFixed(4);
}

const round = (x) => Math.round(x * 1000) / 1000;

module.exports = { ROOT, OUT, apiKey, jevClient, runPool, costLine, round };
