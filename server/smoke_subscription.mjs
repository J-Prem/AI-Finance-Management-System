/**
 * Subscription wiring smoke test — offline.
 *
 * Stubs Subscription + User models and boots the real express app, then
 * exercises every /api/subscriptions/* endpoint with a valid JWT to
 * prove the new routes (plans, current, usage-stats, resume, inline
 * upgrade/downgrade, invoice fetch) are wired correctly.
 */
import 'dotenv/config';
import http from 'http';
import jwt from 'jsonwebtoken';

const USER_ID = 'user_sub_smoke';
const fakeUser = {
  _id: USER_ID,
  email: 'sub@example.com',
  name: 'Sub Tester',
  role: 'user',
  isActive: true,
  isBanned: false,
  subscriptionTier: 'FREE',
  save: async function () { return this; },
  toObject() { return { ...this }; },
  toJSON() { return { ...this }; },
};

// In-memory subscription store so upgrade/cancel/resume flip state
// between calls the way a real DB would.
const state = { sub: null };

function buildSub(partial = {}) {
  const base = {
    _id: 'sub_1',
    userId: USER_ID,
    plan: 'FREE',
    status: 'active',
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
    usage: {
      apiCalls: { current: 0, limit: 200, resetDate: new Date() },
      transactions: { current: 0, limit: 100, resetDate: new Date() },
      mlPredictions: { current: 0, limit: 50, resetDate: new Date() },
    },
    invoices: [],
    paymentMethod: null,
    priorPlanHistory: [],
    autoRenew: false,
    ...partial,
  };
  base.toObject = (opts) => {
    const { toObject, save, cancel, upgradePlan, updatePaymentMethod, ...rest } = base;
    return { ...rest };
  };
  base.save = async function () { return this; };
  base.cancel = function (immediately) {
    if (immediately) {
      this.status = 'cancelled';
      this.cancelledAt = new Date();
    } else {
      this.cancelAtPeriodEnd = true;
    }
    return this;
  };
  base.upgradePlan = function (code, limits) {
    this.priorPlanHistory.push({ plan: this.plan, startDate: this.currentPeriodStart, endDate: new Date() });
    this.plan = code;
    this.usage.apiCalls.limit = limits.apiCallsPerDay;
    this.usage.transactions.limit = limits.transactionsPerMonth;
    this.usage.mlPredictions.limit = limits.mlPredictionsPerMonth;
    return this;
  };
  base.updatePaymentMethod = function (pm) {
    this.paymentMethod = { id: pm.id, brand: pm.brand, last4: pm.last4, expMonth: pm.exp_month, expYear: pm.exp_year };
    return this;
  };
  return base;
}

// Install stubs on the User + Subscription models BEFORE importing app.
const userMod = await import('./models/User.js');
userMod.default.findOne = async (q) => (q && (q._id === USER_ID || q.email === fakeUser.email) ? fakeUser : null);
userMod.default.findById = async (id) => (String(id) === USER_ID ? fakeUser : null);
userMod.default.findByIdAndUpdate = async (id, patch) => ({ ...fakeUser, ...patch });

const subMod = await import('./models/Subscription.js');
subMod.default.findOne = async () => state.sub;
subMod.default.create = async (data) => {
  state.sub = buildSub({ ...data });
  return state.sub;
};

process.env.JWT_SECRET = process.env.JWT_SECRET || 'sub-smoke-secret';
process.env.ENABLE_ML_FEATURES = 'false';
process.env.ENABLE_STRIPE_PAYMENTS = 'false';

const app = (await import('./app.js')).default;

const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();
const token = jwt.sign({ id: USER_ID }, process.env.JWT_SECRET, { expiresIn: '1h' });

async function req(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        let parsed = buf;
        try { parsed = JSON.parse(buf); } catch {}
        resolve({ status: res.statusCode, json: parsed });
      });
    });
    r.on('error', (e) => resolve({ status: 0, json: { error: e.message } }));
    if (data) r.write(data);
    r.end();
  });
}

let pass = 0, fail = 0;
function t(name, cond, extra = '') {
  if (cond) { console.log(`  PASS ${name}${extra ? ' — ' + extra : ''}`); pass++; }
  else { console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`); fail++; }
}

console.log('== Subscription endpoints smoke ==\n');

// Plans catalog — unauthenticated endpoint
{
  const r = await req('GET', '/api/subscriptions/plans');
  const codes = (r.json?.data?.plans || []).map((p) => p.code).sort();
  t('GET /plans returns FREE/PRO/ENTERPRISE', r.status === 200 && codes.join(',') === 'ENTERPRISE,FREE,PRO', `status=${r.status} codes=${codes.join(',')}`);
  t('plans response advertises stripe disabled', r.json?.data?.stripeEnabled === false);
}

// Current — auto-creates FREE row on first access
{
  const r = await req('GET', '/api/subscriptions/current');
  t('GET /current auto-creates FREE subscription', r.status === 200 && r.json?.data?.subscription?.plan === 'FREE', `status=${r.status}`);
  t('response includes planMeta block', Boolean(r.json?.data?.subscription?.planMeta?.features?.length));
}

// Usage stats
{
  const r = await req('GET', '/api/subscriptions/usage-stats');
  t('GET /usage-stats returns summary', r.status === 200 && r.json?.data?.summary?.plan === 'FREE');
}
{
  const r = await req('GET', '/api/subscriptions/usage');
  t('GET /usage legacy path works too', r.status === 200);
}

// Inline upgrade (Stripe disabled)
{
  const r = await req('POST', '/api/subscriptions/upgrade', { planId: 'pro' });
  t('POST /upgrade flips plan to PRO inline', r.status === 200 && r.json?.data?.subscription?.plan === 'PRO', `status=${r.status}`);
  t('upgrade recorded synthetic invoice', (state.sub?.invoices || []).length === 1);
}

// Checkout fallback uses inline mode when Stripe is off
{
  const r = await req('POST', '/api/subscriptions/checkout', { plan: 'enterprise' });
  t('POST /checkout falls back to inline when Stripe is disabled', r.status === 200 && r.json?.data?.mode === 'inline' && r.json?.data?.subscription?.plan === 'ENTERPRISE');
}

// Billing history pagination envelope
{
  const r = await req('GET', '/api/subscriptions/billing-history?page=1&limit=10');
  t('GET /billing-history returns pagination envelope', r.status === 200 && Array.isArray(r.json?.data?.invoices) && typeof r.json?.data?.total === 'number');
}

// Cancel + resume
{
  const r = await req('POST', '/api/subscriptions/cancel', { immediately: false });
  t('POST /cancel flips cancelAtPeriodEnd', r.status === 200 && r.json?.data?.subscription?.cancelAtPeriodEnd === true);
}
{
  const r = await req('POST', '/api/subscriptions/resume');
  t('POST /resume undoes pending cancellation', r.status === 200 && r.json?.data?.subscription?.cancelAtPeriodEnd === false);
}

// Downgrade back to FREE
{
  const r = await req('POST', '/api/subscriptions/downgrade', { planId: 'free' });
  t('POST /downgrade switches back to FREE', r.status === 200 && r.json?.data?.subscription?.plan === 'FREE');
}

// Payment method — inline add + remove
{
  const r = await req('POST', '/api/subscriptions/payment-methods', { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2027 });
  t('POST /payment-methods records card details', r.status === 200 && state.sub?.paymentMethod?.last4 === '4242');
}
{
  const pmId = state.sub?.paymentMethod?.id;
  const r = await req('DELETE', `/api/subscriptions/payment-methods/${pmId}`);
  t('DELETE /payment-methods/:id removes card', r.status === 200 && !state.sub?.paymentMethod);
}

// Unknown plan rejected
{
  const r = await req('POST', '/api/subscriptions/upgrade', { planId: 'platinum' });
  t('unknown plan id is rejected with 400', r.status === 400);
}

console.log(`\n== ${pass} passed, ${fail} failed ==`);
server.close();
process.exit(fail === 0 ? 0 : 1);
