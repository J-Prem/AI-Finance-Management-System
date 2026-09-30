/**
 * Smoke tests for real-mode endpoints.
 *
 * Requirements (all must be set in .env):
 *   MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET
 *   ADMIN_EMAIL, ADMIN_PASSWORD   (tried first; falls back to a fresh smoke user)
 *
 * Run:  node smoke_new_features.mjs
 *
 * Talks to real infra. No demo mode, no fake data.
 */
import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import app, { initializeSocket } from './app.js';
import connectDB from './config/db.js';
import { bootstrapAdmin } from './scripts/bootstrap.js';

function requireEnv(keys) {
  const missing = keys.filter((k) => !process.env[k] || String(process.env[k]).includes('<'));
  if (missing.length) {
    console.error(`[smoke] Missing required env vars: ${missing.join(', ')}`);
    console.error('[smoke] See SETUP_REAL.md. The smoke test needs a real .env to run.');
    process.exit(2);
  }
}
requireEnv(['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET']);

console.log('[smoke] Connecting to MongoDB...');
await connectDB();
console.log('[smoke] Bootstrapping admin (idempotent)...');
await bootstrapAdmin();

const server = http.createServer(app);
initializeSocket(server);

const PORT = 5099;
await new Promise((r) => server.listen(PORT, r));
const base = `http://127.0.0.1:${PORT}`;

let pass = 0, fail = 0;
async function t(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
    pass++;
  } catch (e) {
    console.log(`FAIL  ${name} -> ${e.message}`);
    fail++;
  }
}

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

// ---------- Health ----------
await t('health', async () => {
  const r = await req('GET', '/health');
  if (r.status !== 200) throw new Error(`status ${r.status}`);
});

await t('health/detailed shows mongo connected', async () => {
  const r = await req('GET', '/health/detailed');
  if (![200, 503].includes(r.status)) throw new Error(`status ${r.status}`);
  if (!r.json?.checks?.mongodb?.healthy) {
    throw new Error(`mongodb not healthy: ${JSON.stringify(r.json?.checks?.mongodb)}`);
  }
});

// ---------- Auth ----------
let token;
await t('auth token available from admin or smoke account', async () => {
  const r = await req('POST', '/api/auth/login', {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  if (r.status === 200) {
    token = r.json?.data?.tokens?.accessToken || r.json?.data?.accessToken || r.json?.accessToken;
  } else {
    const stamp = Date.now();
    const fallback = await req('POST', '/api/auth/register', {
      email: `smoke-${stamp}@example.com`,
      password: `SmokeTest!${stamp}`,
      name: 'Smoke Test User',
    });
    if (![200, 201].includes(fallback.status)) {
      throw new Error(`admin login status ${r.status}; fallback register status ${fallback.status} body ${JSON.stringify(fallback.json)}`);
    }
    token = fallback.json?.data?.tokens?.accessToken || fallback.json?.data?.accessToken || fallback.json?.accessToken;
  }
  if (!token) throw new Error(`no access token in response: ${JSON.stringify(r.json)}`);
});

// ---------- Protected feature smoke ----------
await t('monitoring snapshot returns kpi block', async () => {
  const r = await req('GET', '/api/monitoring/snapshot', null, token);
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  if (!r.json?.data?.kpi) throw new Error('no kpi in response');
});

await t('personality analyze returns a label (or 400 if no txs yet)', async () => {
  const r = await req('POST', '/api/personality/analyze', {}, token);
  // 400 is acceptable on a brand-new admin account with zero transactions.
  if (r.status === 400) return;
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  if (!r.json?.data?.label) throw new Error('no label');
});

await t('receipt text parse round-trips into a Transaction', async () => {
  const r = await req('POST', '/api/receipts/upload', {
    text: 'Whole Foods Market\nMilk  $3.50\nBread  $4.25\nEggs   $5.99\nTotal  $13.74\nDate: 04/19/2026',
  }, token);
  if (r.status !== 200) throw new Error(`status ${r.status} body ${JSON.stringify(r.json)}`);
  if (!r.json?.data?.receipt?.merchant) throw new Error('no merchant parsed');
});

await t('llm chat returns text (any provider, including local fallback)', async () => {
  const r = await req('POST', '/api/llm/chat', {
    messages: [{ role: 'user', content: 'How should I budget my income?' }],
  }, token);
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  if (!r.json?.data?.reply) throw new Error('no reply');
});

await t('receipt list for admin', async () => {
  const r = await req('GET', '/api/receipts', null, token);
  if (r.status !== 200) throw new Error(`status ${r.status}`);
});

// ---------- Global search ----------
await t('global search returns a results array', async () => {
  const r = await req('GET', '/api/search?q=food&limit=3', null, token);
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  if (!Array.isArray(r.json?.data?.results)) throw new Error('no results array');
});

// ---------- Subscription & plan catalog ----------
await t('plans catalog exposes FREE/PRO/ENTERPRISE', async () => {
  const r = await req('GET', '/api/subscriptions/plans');
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  const codes = (r.json?.data?.plans || []).map((p) => p.code).sort();
  for (const want of ['ENTERPRISE', 'FREE', 'PRO']) {
    if (!codes.includes(want)) throw new Error(`missing plan ${want}; got ${codes.join(',')}`);
  }
});

await t('current subscription auto-creates FREE row', async () => {
  const r = await req('GET', '/api/subscriptions/current', null, token);
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  if (!r.json?.data?.subscription?.plan) throw new Error('no plan on subscription');
});

await t('usage stats returns summary block', async () => {
  const r = await req('GET', '/api/subscriptions/usage-stats', null, token);
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  if (!r.json?.data?.summary) throw new Error('no summary block');
});

await t('inline upgrade to PRO succeeds without Stripe', async () => {
  const r = await req('POST', '/api/subscriptions/upgrade', { planId: 'pro' }, token);
  if (r.status !== 200) throw new Error(`status ${r.status} body ${JSON.stringify(r.json)}`);
  if (r.json?.data?.subscription?.plan !== 'PRO') throw new Error('plan not PRO after upgrade');
});

await t('billing history is paginated', async () => {
  const r = await req('GET', '/api/subscriptions/billing-history?page=1&limit=5', null, token);
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  if (!Array.isArray(r.json?.data?.invoices)) throw new Error('invoices is not an array');
});

await t('cancel marks auto-renewal off', async () => {
  const r = await req('POST', '/api/subscriptions/cancel', { immediately: false }, token);
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  if (r.json?.data?.subscription?.cancelAtPeriodEnd !== true) {
    throw new Error('cancelAtPeriodEnd not flipped');
  }
});

await t('resume undoes pending cancellation', async () => {
  const r = await req('POST', '/api/subscriptions/resume', null, token);
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  if (r.json?.data?.subscription?.cancelAtPeriodEnd) {
    throw new Error('cancelAtPeriodEnd still true after resume');
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
server.close();
await mongoose.disconnect().catch(() => {});
process.exit(fail ? 1 : 0);
