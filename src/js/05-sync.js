  /* ---------- cloud sync ---------- */
  // Last-write-wins against one Supabase row per user. The unit of sync is the whole
  // transferable snapshot -- progressSnapshot() minus DEVICE_ONLY -- which is exactly
  // what exportText() already produces, so applyImport()/restore() apply a remote copy
  // without needing a second validation path.
  var SYNC_PUSH_DELAY = 1200;
  var syncTimer = null;
  var sync = {
    session: null,         // { access_token, refresh_token, expires_at, email }
    dirty: false,          // local edits not yet pushed
    busy: false,           // a request is in flight
    conflict: false,       // cloud and device diverged; auto-push paused until resolved
    applyingRemote: false, // suppress the push that applyImport() -> save() would trigger
    lastSyncedAt: null,    // cloud updated_at this device last saw
    localAt: null,         // when local state last changed
    remoteAt: null,        // cloud updated_at from the last pull
    remoteData: null,      // cloud snapshot from the last pull, for the counts shown in settings
    signature: null        // JSON of the last snapshot that matched the cloud, see markLocalChange
  };

  function syncEnabled() {
    return !!(SYNC_CONFIG && SYNC_CONFIG.url && SYNC_CONFIG.anonKey && window.fetch && window.Promise);
  }
  // fetch rejects with a TypeError when the network is unreachable, and says nothing about
  // whether the credentials are still good.
  function isOffline(e) {
    return (e instanceof TypeError) || (typeof navigator !== 'undefined' && navigator.onLine === false);
  }
  function syncApi(path, opts) {
    opts = opts || {};
    var headers = { 'apikey': SYNC_CONFIG.anonKey, 'Content-Type': 'application/json' };
    // GoTrue and PostgREST both want a Bearer token; before sign-in that is the anon key.
    headers['Authorization'] = 'Bearer ' + (sync.session ? sync.session.access_token : SYNC_CONFIG.anonKey);
    if (opts.prefer) headers['Prefer'] = opts.prefer;
    var init = { method: opts.method || 'GET', headers: headers };
    if (opts.body) init.body = JSON.stringify(opts.body);
    // keepalive lets the browser finish the request after the page is gone (bodies up to 64 KB).
    if (opts.keepalive) init.keepalive = true;
    return window.fetch(SYNC_CONFIG.url + path, init).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (!res.ok) {
          var err = new Error((data && (data.message || data.error_description || data.msg || data.error)) || ('request failed (HTTP ' + res.status + ')'));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }
  // The user id lives in the JWT `sub` claim. Decoding it locally keeps user_id out of
  // the client's hands for RLS purposes -- the policies still compare against auth.uid(),
  // which the token was issued from, so a forged user_id cannot match another user.
  function userId() {
    if (!sync.session || !sync.session.access_token) return null;
    try {
      var part = sync.session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (part.length % 4) part += '=';
      return JSON.parse(atob(part)).sub || null;
    } catch (e) { return null; }
  }
  function loadSyncState() {
    try {
      var o = JSON.parse(window.localStorage.getItem(SYNC_KEY) || 'null');
      if (!o || typeof o !== 'object') return;
      if (o.session && o.session.access_token) sync.session = o.session;
      if (typeof o.lastSyncedAt === 'string') sync.lastSyncedAt = o.lastSyncedAt;
      if (typeof o.localAt === 'string') sync.localAt = o.localAt;
      if (o.dirty === true) sync.dirty = true;
    } catch (e) { /* a corrupt sync record must never stop the app from starting */ }
  }
  function saveSyncState() {
    if (testing) return;
    try {
      window.localStorage.setItem(SYNC_KEY, JSON.stringify({
        session: sync.session, lastSyncedAt: sync.lastSyncedAt, localAt: sync.localAt, dirty: sync.dirty
      }));
    } catch (e) { /* storage blocked: sync simply will not survive a reload */ }
  }
  function tokenFresh() {
    return !!(sync.session && sync.session.access_token && sync.session.expires_at && Date.now() < sync.session.expires_at - 30000);
  }
  function adoptSession(d) {
    if (!d || !d.access_token) return null;
    var u = d.user || {};
    sync.session = {
      access_token: d.access_token,
      refresh_token: d.refresh_token || (sync.session && sync.session.refresh_token) || '',
      expires_at: Date.now() + ((parseInt(d.expires_in, 10) || 3600) * 1000),
      email: u.email || (sync.session && sync.session.email) || ''
    };
    saveSyncState();
    return sync.session;
  }
  // A stored session that cannot be used again. signOut(true) stays silent so the logout
  // button keeps its own wording, but here the user has to be told syncing stopped and why.
  function expireSession() {
    // keepPending: the edits made before the expiry still belong to this account, so signing
    // back in uploads them instead of opening the conflict dialog.
    signOut(true, true);
    setSyncStatus('Your sign-in expired. Sign in again to resume syncing.', true);
  }
  function ensureSession() {
    if (!sync.session) return Promise.resolve(null);
    if (tokenFresh()) return Promise.resolve(sync.session);
    if (!sync.session.refresh_token) { expireSession(); return Promise.resolve(null); }
    return syncApi('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: sync.session.refresh_token } })
      .then(adoptSession)
      .catch(function (e) {
        // fetch rejects with a TypeError when the network is unreachable. That is not an expired
        // token: signing out here would throw away a working refresh token just because the
        // device was offline when the page loaded.
        if (isOffline(e)) {
          setSyncStatus('No connection. Your sign-in is kept — syncing resumes when you are back online.');
          return null;
        }
        // Only the auth server saying the refresh token is invalid ends the session. A 5xx or a
        // rate limit is the server's problem, and the token is still good for the next try.
        if (e && (e.status === 400 || e.status === 401)) { expireSession(); return null; }
        setSyncStatus('Could not reach the sign-in service (' + (e && e.message ? e.message : e) + '). Syncing will try again later.', true);
        return null;
      });
  }
  function requestMagicLink(email) {
    var redirect = SYNC_CONFIG.siteUrl || (location.origin + location.pathname);
    // /otp sends the same magic link as /magiclink but reads create_user, so a first-time
    // email gets an account instead of an error.
    return syncApi('/auth/v1/otp?redirect_to=' + encodeURIComponent(redirect), {
      method: 'POST', body: { email: email, create_user: true }
    });
  }
  // GoTrue returns the session in the URL fragment: #access_token=…&refresh_token=…&expires_in=3600
  function consumeRedirect() {
    var hash = location.hash || '';
    if (hash.indexOf('access_token=') === -1 && hash.indexOf('error_description=') === -1) return false;
    var p = {};
    hash.replace(/^#/, '').split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) p[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
    });
    // Drop the fragment before anything else can read it, so a reload cannot replay the token.
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    if (p.error || p.error_description) {
      setSyncStatus('Sign-in failed: ' + (p.error_description || p.error), true);
      return true;
    }
    if (!p.access_token) return false;
    sync.session = {
      access_token: p.access_token,
      refresh_token: p.refresh_token || '',
      expires_at: Date.now() + ((parseInt(p.expires_in, 10) || 3600) * 1000),
      email: ''
    };
    saveSyncState();
    return true;
  }
  function signOut(quiet, keepPending) {
    if (sync.session) { try { syncApi('/auth/v1/logout', { method: 'POST' }).catch(function () {}); } catch (e) { /* best effort */ } }
    sync.session = null; sync.remoteAt = null; sync.remoteData = null; sync.conflict = false;
    if (!keepPending) { sync.lastSyncedAt = null; sync.dirty = false; }
    clearTimeout(syncTimer);
    saveSyncState();
    renderSyncUI();
    if (!quiet) setSyncStatus('Signed out. Your progress is unchanged on this device.');
  }

  function transferable(snap) {
    var p = Object.assign({}, snap || progressSnapshot());
    DEVICE_ONLY.forEach(function (k) { delete p[k]; });
    return p;
  }
  // progressSnapshot() builds its keys in a fixed order, so this is stable between calls.
  function syncSignature(snap) {
    return JSON.stringify(transferable(snap));
  }
  function pullProgress() {
    return syncApi('/rest/v1/progress?select=version,data,updated_at&limit=1').then(function (rows) {
      var row = (rows && rows[0]) || null;
      sync.remoteAt = row ? row.updated_at : null;
      sync.remoteData = row ? row.data : null;
      return row;
    });
  }
  // Writes go through the conditional-upsert RPC, not a plain PostgREST upsert: passing the
  // timestamp this device last saw means a background save cannot overwrite another device
  // that wrote in the meantime. user_id is never sent -- the function reads auth.uid().
  function pushProgress(expected, data, keepalive) {
    if (!userId()) return Promise.reject(new Error('not signed in'));
    return syncApi('/rest/v1/rpc/upsert_progress', {
      method: 'POST',
      keepalive: !!keepalive,
      body: { p_app: APP_ID, p_version: FORMAT, p_data: data || transferable(), p_expected: expected || null }
    }).then(function (res) { return (Array.isArray(res) ? res[0] : res) || null; });
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Seconds are always shown: two devices can write inside the same minute, and the point of
  // the conflict dialog is to make the difference readable instead of leaving it to a guess.
  function fmtWhen(iso) {
    if (!iso) return 'never';
    var t = Date.parse(iso);
    if (isNaN(t)) return 'unknown';
    var d = new Date(t), now = new Date();
    var hms = pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    var same = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
    var mins = Math.floor((now.getTime() - t) / 60000);
    var ago = mins < 1 ? ' · just now' : (mins < 60 ? ' · ' + mins + ' min ago' : '');
    if (same(d, now)) return 'today at ' + hms + ago;
    if (same(d, new Date(now.getTime() - 86400000))) return 'yesterday at ' + hms + ago;
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ', ' + hms;
  }
  // Progress made before sync existed has no localAt, so fall back to the most recent
  // study day. Without this a long-time user would be told the cloud copy is "newer"
  // than years of local progress.
  function localStamp() {
    if (sync.localAt) return sync.localAt;
    var days = Object.keys(state.activity || {}).sort();
    if (!days.length) return null;
    var p = days[days.length - 1].split('-');
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 23, 59, 59).toISOString();
  }
  function setSyncStatus(msg, bad) {
    if (!els.syncStatus) return;
    els.syncStatus.textContent = msg || '';
    els.syncStatus.className = 'transfer-status' + (bad ? ' bad' : '');
  }
  // "Sync now", from Settings or the top bar.
  function syncNow() {
    if (!syncEnabled() || !sync.session || sync.busy) return;
    // An explicit "Sync now" offers the local copy, and re-offers the choice if the conflict
    // dialog was cancelled earlier. It must not touch localAt: that stamp is what decides
    // the "which one is newer" wording, and clicking a button is not editing your progress.
    sync.dirty = true;
    saveSyncState();
    reconcile('manual sync');
  }
  // The top-bar sync button: shown while signed in; spins while syncing; a dot marks changes not uploaded yet.
  function renderSyncTop() {
    if (!els.btnSyncTop) return;
    var on = syncEnabled() && !!sync.session;
    els.btnSyncTop.hidden = !on;
    if (!on) return;
    els.btnSyncTop.classList.toggle('busy', !!sync.busy);
    els.btnSyncTop.classList.toggle('pending', !!sync.dirty && !sync.busy);
    var label = sync.busy ? 'Syncing…' : 'Sync now' + (sync.dirty ? ': changes waiting to upload' : '') +
      (sync.lastSyncedAt ? '. Last synced ' + fmtWhen(sync.lastSyncedAt) : '');
    els.btnSyncTop.setAttribute('aria-label', label);
    els.btnSyncTop.title = label;
  }
  function renderSyncUI() {
    renderSyncTop();
    if (!els.syncGroup) return;
    if (els.footnote) updateFootnote();
    if (!syncEnabled()) { els.syncGroup.hidden = true; return; }
    els.syncGroup.hidden = false;
    var inSession = !!sync.session;
    els.syncEmailRow.hidden = inSession;
    els.syncLinkRow.hidden = inSession;
    els.syncAccountRow.hidden = !inSession;
    els.syncDatesRow.hidden = !inSession;
    els.btnSyncNow.disabled = sync.busy || !inSession;
    els.syncAccount.textContent = inSession ? 'Signed in as ' + (sync.session.email || 'your account') : '';
    if (!inSession) return;
    var lc = markCounts(marksOf('read').status);
    var ls = localStamp();
    var rc = sync.remoteData ? markCounts(sync.remoteData.status || {}) : null;
    var lm = sync.remoteAt ? Date.parse(sync.remoteAt) : 0;
    var dm = ls ? Date.parse(ls) : 0;
    var rows = [
      { label: 'This device', when: ls, text: lc.known + ' known, ' + lc.learning + ' learning', newer: dm > lm },
      { label: 'In the cloud', when: sync.remoteAt, text: rc ? rc.known + ' known, ' + rc.learning + ' learning' : 'no copy yet', newer: lm > dm }
    ];
    els.syncDates.textContent = '';
    rows.forEach(function (r) {
      var li = el('li', r.newer ? 'newer' : '');
      li.appendChild(el('span', null, r.label));
      li.appendChild(el('b', 'when', fmtWhen(r.when) + (r.when ? ' · ' + r.text : '')));
      els.syncDates.appendChild(li);
    });
    if (sync.conflict) {
      var li = el('li');
      li.appendChild(el('span', null, 'The two differ'));
      li.appendChild(el('b', 'when', 'choose below'));
      els.syncDates.appendChild(li);
    }
  }
  function onSyncError(e) {
    sync.busy = false;
    renderSyncUI();
    if (isOffline(e)) {
      setSyncStatus('No connection. Changes stay on this device and upload automatically when it returns.');
      return;
    }
    if (e && (e.status === 401 || e.status === 403)) {
      expireSession();
      return;
    }
    setSyncStatus('Sync failed: ' + (e && e.message ? e.message : e), true);
  }
  function doPush(note, expected, keepalive) {
    sync.busy = true;
    renderSyncUI();
    setSyncStatus('Uploading…');
    var sending = transferable();
    var sentSig = JSON.stringify(sending);
    return pushProgress(expected === undefined ? sync.lastSyncedAt : expected, sending, keepalive).then(function (r) {
      sync.busy = false;
      if (!r) throw new Error('unexpected reply from the server');
      if (!r.applied) {
        // The cloud moved since this device last synced. Refuse to guess a winner: pull the
        // current row and put both last-modified dates in front of the user.
        return pullProgress().then(function (remote) { offerConflict(remote); });
      }
      sync.remoteAt = r.server_updated_at;
      sync.lastSyncedAt = r.server_updated_at;
      sync.remoteData = sending;
      sync.conflict = false;
      // An edit can land while the request is in flight. Only drop the dirty flag when the
      // snapshot that came back is still the one this device holds, or that edit never uploads.
      var raced = sync.signature !== sentSig;
      sync.signature = sentSig;
      sync.dirty = raced;
      sync.localAt = new Date().toISOString();
      saveSyncState();
      renderSyncUI();
      setSyncStatus('Uploaded' + (note ? ' · ' + note : '') + ' · ' + fmtWhen(sync.remoteAt));
      if (raced) schedulePush();
    }).catch(onSyncError);
  }
  function applyRemote(row) {
    if (!row || !row.data) return;
    if (typeof row.data.format === 'number' && row.data.format > FORMAT) {
      setSyncStatus('The cloud copy was saved by a newer version of the app. Reload this page to update it, then sync again.', true);
      return;
    }
    // applyImport() ends in save(), which would push the cloud copy straight back.
    sync.applyingRemote = true;
    try { applyImport(row.data); } finally { sync.applyingRemote = false; }
    sync.remoteAt = row.updated_at;
    sync.remoteData = row.data;
    sync.lastSyncedAt = row.updated_at;
    sync.localAt = new Date().toISOString();
    sync.dirty = false;
    sync.conflict = false;
    // Taken after applyImport() so it reflects the state this device now holds.
    sync.signature = syncSignature();
    saveSyncState();
    renderSyncUI();
    setSyncStatus('Restored the cloud copy from ' + fmtWhen(row.updated_at) + '.');
    toast('Cloud progress restored.');
  }
  // Both copies are shown with their last-modified date and their known/learning counts,
  // because only one of them survives. sync.conflict pauses auto-push until the user picks,
  // so a debounced save cannot resolve the race silently in the background.
  function offerConflict(remote) {
    if (!remote) {
      renderSyncUI();
      setSyncStatus('The cloud copy changed. Sync again to see which one to keep.', true);
      return;
    }
    sync.conflict = true;
    renderSyncUI();
    setSyncStatus('Another device changed the cloud copy. Choose which one to keep.', true);
    var ls = localStamp();
    var cloudNewer = Date.parse(remote.updated_at) > (ls ? Date.parse(ls) : 0);
    var rc = markCounts((remote.data && remote.data.status) || {});
    var lc = markCounts(marksOf('read').status);
    var keepCloud = function () { applyRemote(remote); };
    // Passing the freshly pulled timestamp is what turns the user's explicit choice into
    // a write the conditional upsert will accept.
    var keepDevice = function () { doPush('replaced the cloud copy', remote.updated_at); };
    // Both choices are offered; the newer copy is the main button. Newer is not always the
    // one you want (a phone with older but fuller progress), so the other stays one tap away.
    askConfirm(
      cloudNewer ? 'The cloud copy is newer' : 'This device is newer',
      'In the cloud: ' + fmtWhen(remote.updated_at) + ' (' + rc.known + ' known, ' + rc.learning + ' learning). ' +
      'On this device: ' + fmtWhen(ls) + ' (' + lc.known + ' known, ' + lc.learning + ' learning). ' +
      'Only one copy can be kept — the other is overwritten and cannot be undone.',
      cloudNewer ? 'Keep the cloud copy' : 'Keep this device', cloudNewer ? keepCloud : keepDevice,
      cloudNewer ? 'Keep this device' : 'Keep the cloud copy', cloudNewer ? keepDevice : keepCloud);
  }
  // Decide between pulling, pushing and asking. Only asks when the cloud copy changed
  // since this device last saw it, or when this device has never synced.
  function reconcile(note) {
    if (!syncEnabled() || sync.busy || !sync.session) return Promise.resolve();
    sync.busy = true;
    renderSyncUI();
    return ensureSession().then(function (sess) {
      if (!sess) { sync.busy = false; renderSyncUI(); return null; }
      return pullProgress().then(function (remote) {
        sync.busy = false;
        var seen = sync.lastSyncedAt ? Date.parse(sync.lastSyncedAt) : 0;

        if (!remote) {
          renderSyncUI();
          var anyMarks = Object.keys(SKILLS).some(function (k) { return Object.keys(marksOf(k).status).length > 0; });
          if (anyMarks) return doPush('first upload');
          setSyncStatus('Signed in. Nothing to upload yet — your progress will sync as you study.');
          return null;
        }

        // Cloud unchanged since this device last saw it: nothing to lose by pushing.
        if (Date.parse(remote.updated_at) === seen) {
          renderSyncUI();
          if (sync.dirty) return doPush();
          setSyncStatus('Up to date · ' + fmtWhen(remote.updated_at));
          return null;
        }

        offerConflict(remote);
        return null;
      });
    }).catch(onSyncError);
  }
  function markLocalChange(snap) {
    if (!syncEnabled() || sync.applyingRemote || testing) return;
    // Signed out on purpose: nothing to track. Expired (lastSyncedAt kept): keep tracking.
    if (!sync.session && !sync.lastSyncedAt) return;
    // save() runs for plenty of reasons that change nothing the cloud holds: picking a voice,
    // toggling warmup, redrawing a panel. Counting those as edits would push a byte-identical
    // blob, move updated_at, and make this device look newer than it is in the conflict dialog.
    var sig = syncSignature(snap);
    if (sig === sync.signature) return;
    sync.signature = sig;
    sync.dirty = true;
    sync.localAt = new Date().toISOString();
    saveSyncState();
    renderSyncTop();
    if (!sync.conflict) schedulePush();
  }
  function schedulePush() {
    if (!syncEnabled() || !sync.session || !sync.dirty || sync.conflict || sync.busy) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(flushPush, SYNC_PUSH_DELAY);
  }
  function flushPush(closing) {
    if (!syncEnabled() || !sync.session || !sync.dirty || sync.conflict) return Promise.resolve();
    if (sync.busy) { schedulePush(); return Promise.resolve(); }
    return doPush(undefined, undefined, closing === true);
  }
  function initSync() {
    if (!syncEnabled()) { renderSyncUI(); return; }
    loadSyncState();
    // Seeded from the state restore() just loaded, so the first save() that changes nothing
    // syncable is not mistaken for an edit. A persisted dirty flag is left alone.
    sync.signature = syncSignature();
    var fromLink = consumeRedirect();
    renderSyncUI();
    window.addEventListener('online', function () { if (sync.dirty) flushPush(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && sync.dirty) flushPush(true); });
    window.addEventListener('pagehide', function () { if (sync.dirty) flushPush(true); });
    if (!sync.session) {
      if (fromLink) setSyncStatus('Signed in.');
      return;
    }
    setSyncStatus(fromLink ? 'Signed in. Checking the cloud copy…' : 'Checking the cloud copy…');
    ensureSession().then(function (s) {
      if (!s) { renderSyncUI(); return null; }
      if (s.email) return reconcile(fromLink ? 'after sign-in' : '');
      return syncApi('/auth/v1/user').then(function (u) {
        if (u && u.email && sync.session) { sync.session.email = u.email; saveSyncState(); }
        renderSyncUI();
      }).catch(function () { /* the email is cosmetic; a failed lookup must not block syncing */ })
        .then(function () { return reconcile(fromLink ? 'after sign-in' : ''); });
    }).catch(onSyncError);
  }

