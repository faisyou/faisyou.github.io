'use strict';

// ── App state ──────────────────────────────────────────────────────────────
const S = { region: '', token: '', me: null, org: null };
let ROLE_DEF      = null;
let rawSecret     = '';
let secretVisible = false;

// ── Bootstrap: load role.json then initialise ──────────────────────────────
fetch('role.json')
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then(def => {
    ROLE_DEF = def;
    boot();
  })
  .catch(err => {
    document.body.innerHTML = `
      <div style="font-family:system-ui;color:#f87171;background:#0f1117;min-height:100vh;
                  display:flex;align-items:center;justify-content:center;padding:2rem;text-align:center">
        <div>
          <div style="font-size:2rem;margin-bottom:1rem">⚠</div>
          <strong>Could not load role.json</strong><br><br>
          ${err.message}<br><br>
          <span style="color:#94a3b8;font-size:0.875rem">
            Open the app via a local server, not directly as a file.<br>
            Run: <code style="color:#60a5fa">npm run web</code>
          </span>
        </div>
      </div>`;
  });

function boot() {
  // Restore saved region/token from localStorage
  try {
    const saved = JSON.parse(localStorage.getItem('gc_setup') || '{}');
    if (saved.region) document.getElementById('sel-region').value = saved.region;
    if (saved.token)  document.getElementById('inp-token').value  = saved.token;
  } catch {}

  // Eye toggle for bearer token field
  const inp = document.getElementById('inp-token');
  document.getElementById('eye-btn').addEventListener('click', function () {
    const reveal = inp.type === 'password';
    inp.type = reveal ? 'text' : 'password';
    this.textContent = reveal ? '🙈' : '👁';
  });
}

// ── View router ────────────────────────────────────────────────────────────
const VIEWS = ['v-creds', 'v-confirm', 'v-progress', 'v-results'];
function show(id) {
  VIEWS.forEach(v => document.getElementById(v).classList.toggle('hidden', v !== id));
}

// ── API helper ─────────────────────────────────────────────────────────────
async function gc(method, path, body) {
  const res = await fetch(`https://api.${S.region}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${S.token}`,
      'Content-Type':  'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const d = await res.json();
      if (d.message)              msg = d.message;
      if (d.errors?.[0]?.message) msg += ` — ${d.errors[0].message}`;
    } catch {}
    const e = new Error(msg);
    e.status = res.status;
    throw e;
  }

  return res.status === 204 ? null : res.json();
}

// ── Alert helpers ──────────────────────────────────────────────────────────
function setErr(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}
function clrErr(id) { document.getElementById(id).classList.add('hidden'); }

// ── Credentials view ───────────────────────────────────────────────────────
async function submitCredentials() {
  clrErr('creds-err');

  S.region = document.getElementById('sel-region').value.trim();
  S.token  = document.getElementById('inp-token').value.trim();

  if (!S.token) { setErr('creds-err', 'Please paste your bearer token.'); return; }

  localStorage.setItem('gc_setup', JSON.stringify({ region: S.region, token: S.token }));

  show('v-confirm');
  document.getElementById('conf-loading').classList.remove('hidden');
  document.getElementById('conf-details').classList.add('hidden');
  clrErr('conf-err');

  try {
    const [me, org] = await Promise.all([
      gc('GET', '/api/v2/users/me?expand=organization'),
      gc('GET', '/api/v2/organizations/me'),
    ]);
    S.me = me; S.org = org;

    document.getElementById('id-grid').innerHTML = `
      <dt>Organisation</dt><dd>${esc(org.name)}</dd>
      <dt>User</dt><dd>${esc(me.name)} (${esc(me.email)})</dd>
      <dt>Region</dt><dd>${esc(S.region)}</dd>
    `;
    document.getElementById('conf-loading').classList.add('hidden');
    document.getElementById('conf-details').classList.remove('hidden');
  } catch (err) {
    document.getElementById('conf-loading').classList.add('hidden');
    const hint = err.status === 401 ? ' Token may be expired — paste a fresh token.' : '';
    setErr('conf-err', `Failed to verify identity: ${err.message}.${hint}`);
  }
}

function backToCreds() { show('v-creds'); }

// ── Step state helpers ─────────────────────────────────────────────────────
function stepRunning(n) {
  const ic = document.getElementById(`s${n}-icon`);
  ic.className = 'step-icon icon-running';
  ic.innerHTML = '<div class="spinner"></div>';
}
function stepDone(n, txt) {
  const ic = document.getElementById(`s${n}-icon`);
  ic.className = 'step-icon icon-done';
  ic.textContent = '✔';
  document.getElementById(`s${n}-detail`).textContent = txt;
}
function stepError(n, txt) {
  const ic = document.getElementById(`s${n}-icon`);
  ic.className = 'step-icon icon-error';
  ic.textContent = '✖';
  document.getElementById(`s${n}-detail`).textContent = txt;
}
function resetSteps() {
  [1, 2, 3].forEach(n => {
    const ic = document.getElementById(`s${n}-icon`);
    ic.className = 'step-icon icon-pending';
    ic.textContent = n;
    document.getElementById(`s${n}-detail`).textContent = 'Pending…';
  });
  clrErr('prog-err');
}

// ── Setup flow ─────────────────────────────────────────────────────────────
async function runSetup() {
  show('v-progress');
  resetSteps();

  // Step 1 — Create role
  stepRunning(1);
  let role;
  try {
    role = await gc('POST', '/api/v2/authorization/roles', ROLE_DEF);
    stepDone(1, `Role created — ${role.id}`);
  } catch (err) {
    stepError(1, err.message);
    const extra = (err.status === 409 || err.message.toLowerCase().includes('already exists'))
      ? ' A role with this name may already exist — update "name" in role.json.'
      : '';
    setErr('prog-err', `Step 1 failed: ${err.message}.${extra}`);
    return;
  }

  // Step 2 — Assign role to user (all divisions)
  stepRunning(2);
  try {
    await gc(
      'POST',
      `/api/v2/authorization/roles/${role.id}?subjectType=PC_USER`,
      { subjectIds: [S.me.id], divisionIds: ['*'] }
    );
    stepDone(2, `Assigned to ${S.me.name} — all divisions`);
  } catch (err) {
    stepError(2, err.message);
    setErr('prog-err', `Step 2 failed: ${err.message}`);
    return;
  }

  // Brief pause for Genesys eventual consistency
  await new Promise(r => setTimeout(r, 1500));

  // Step 3 — Create OAuth client
  stepRunning(3);
  let oauth;
  try {
    oauth = await gc('POST', '/api/v2/oauth/clients', {
      name:                       ROLE_DEF.name,
      description:                'OAuth client for CX as Code Terraform provider and Archy CLI.',
      authorizedGrantType:        'CLIENT-CREDENTIALS',
      accessTokenValiditySeconds: 86400,
      state:                      'active',
      roleDivisions: [{ roleId: role.id, divisionId: '*' }],
    });
    stepDone(3, `OAuth client created — ${oauth.id}`);
  } catch (err) {
    stepError(3, err.message);
    const extra = err.status === 403
      ? ' Permission cache may still be propagating — wait 10–15 s and retry.'
      : '';
    setErr('prog-err', `Step 3 failed: ${err.message}.${extra}`);
    return;
  }

  setTimeout(() => showResults(oauth.id, oauth.secret), 600);
}

// ── Results view ───────────────────────────────────────────────────────────
function showResults(clientId, clientSecret) {
  rawSecret     = clientSecret;
  secretVisible = false;

  document.getElementById('r-id').textContent     = clientId;
  document.getElementById('r-secret').textContent = '•'.repeat(Math.min(clientSecret.length, 40));
  document.getElementById('btn-reveal').textContent = 'Show';
  document.getElementById('r-region').textContent  = S.region;

  document.getElementById('r-terraform').textContent =
`provider "genesyscloud" {
  oauthclient_id     = "${clientId}"
  oauthclient_secret = "${clientSecret}"
  aws_region         = "${S.region}"
}`;

  document.getElementById('r-env').textContent =
`export GENESYSCLOUD_OAUTHCLIENT_ID="${clientId}"
export GENESYSCLOUD_OAUTHCLIENT_SECRET="${clientSecret}"
export GENESYSCLOUD_REGION="${S.region}"`;

  show('v-results');
}

function toggleSecret() {
  secretVisible = !secretVisible;
  document.getElementById('r-secret').textContent =
    secretVisible ? rawSecret : '•'.repeat(Math.min(rawSecret.length, 40));
  document.getElementById('btn-reveal').textContent = secretVisible ? 'Hide' : 'Show';
}

async function copyVal(elId, btn) {
  await navigator.clipboard.writeText(document.getElementById(elId).textContent);
  flash(btn);
}

async function copySecret(btn) {
  await navigator.clipboard.writeText(rawSecret);
  flash(btn);
}

function flash(btn) {
  const orig = btn.textContent;
  btn.textContent = 'Copied!';
  btn.classList.add('flash');
  setTimeout(() => { btn.textContent = orig; btn.classList.remove('flash'); }, 1500);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
