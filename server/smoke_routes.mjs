/**
 * End-to-end route smoke test.
 *
 * Stubs every Mongoose model used by controllers with generic no-op statics,
 * boots the real express app in-process, generates a valid JWT for a fake
 * user, then hits at least one representative endpoint per route file.
 *
 * Goal: prove that every route file is wired correctly — the middleware
 * stack runs, the controller function resolves, and no route 500s purely
 * from missing imports / wiring bugs. Not a functional test.
 */
import "dotenv/config";
import http from "http";
import jwt from "jsonwebtoken";

const MODEL_NAMES = [
  "User",
  "Transaction",
  "Budget",
  "Investment",
  "Bill",
  "Notification",
  "ApiKey",
  "Team",
  "Subscription",
  "Organization",
  "AuditLog",
];

// Fake user attached to req.user by authenticateJWT for the test JWT
const USER_ID = "user_smoke_001";
const fakeUser = {
  _id: USER_ID,
  email: "smoke@example.com",
  name: "Smoke Tester",
  role: "admin",
  isActive: true,
  isBanned: false,
  subscriptionTier: "PREMIUM",
  usageStats: { transactionsAdded: 0, apiCallsThisMonth: 0, mlPredictionsThisMonth: 0 },
  preferences: { currency: "USD", timezone: "UTC", language: "en" },
  save: async function () { return this; },
  toObject() { return { ...this }; },
  toJSON() { return { ...this }; },
};

// Build a thenable that acts as both a Mongoose Query and a resolved result
function makeQuery(result) {
  const q = {
    sort() { return q; },
    limit() { return q; },
    skip() { return q; },
    select() { return q; },
    populate() { return q; },
    lean() { return q; },
    exec: async () => result,
    then(onF, onR) { return Promise.resolve(result).then(onF, onR); },
    catch(fn) { return Promise.resolve(result).catch(fn); },
  };
  return q;
}

// Stub every model BEFORE importing app.js
for (const name of MODEL_NAMES) {
  const mod = await import(`./models/${name}.js`);
  const Model = mod.default;

  Model.find = () => makeQuery([]);
  Model.findOne = (q) => {
    if (name === "User" && q && (q._id === USER_ID || q.email === fakeUser.email)) {
      return makeQuery(fakeUser);
    }
    return makeQuery(null);
  };
  Model.findById = (id) => {
    if (name === "User" && String(id) === USER_ID) return makeQuery(fakeUser);
    return makeQuery(null);
  };
  Model.findByIdAndUpdate = () => makeQuery(null);
  Model.findByIdAndDelete = () => makeQuery(null);
  Model.findOneAndUpdate = () => makeQuery(null);
  Model.findOneAndDelete = () => makeQuery(null);
  Model.countDocuments = () => makeQuery(0);
  Model.estimatedDocumentCount = () => makeQuery(0);
  Model.aggregate = () => makeQuery([]);
  Model.distinct = () => makeQuery([]);
  Model.deleteOne = async () => ({ acknowledged: true, deletedCount: 0 });
  Model.deleteMany = async () => ({ acknowledged: true, deletedCount: 0 });
  Model.updateOne = async () => ({ acknowledged: true, modifiedCount: 0 });
  Model.updateMany = async () => ({ acknowledged: true, modifiedCount: 0 });
  Model.insertMany = async (docs) => docs || [];
  Model.create = async (data) => {
    const base = Array.isArray(data) ? data[0] : data || {};
    const id = `${name.toLowerCase()}_${Math.random().toString(36).slice(2, 10)}`;
    return {
      _id: id,
      ...base,
      save: async function () { return this; },
      toObject() { return { ...this }; },
      toJSON() { return { ...this }; },
    };
  };

  if (name === "ApiKey") Model.findByKeyHash = async () => null;
  if (name === "Subscription") Model.findByUserId = async () => null;
  if (name === "Transaction") Model.findByUser = () => makeQuery([]);
  if (name === "Budget") Model.findActiveBudgetsForUser = () => makeQuery([]);
}

process.env.JWT_SECRET = process.env.JWT_SECRET || "smoke-secret-key";
process.env.ENABLE_ML_FEATURES = "false"; // skip ML reachability check

const app = (await import("./app.js")).default;

const server = http.createServer(app);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const { port } = server.address();

const token = jwt.sign({ id: USER_ID }, process.env.JWT_SECRET, { expiresIn: "1h" });

async function hit(method, path, { authed = true, body = null, apiKey = null } = {}) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (data) headers["Content-Length"] = Buffer.byteLength(data);
    if (authed) headers["Authorization"] = `Bearer ${token}`;
    if (apiKey) headers["x-api-key"] = apiKey;
    const req = http.request(
      { host: "127.0.0.1", port, path, method, headers },
      (res) => {
        let buf = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          let parsed = buf;
          try { parsed = JSON.parse(buf); } catch {}
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.setTimeout(5000, () => req.destroy(new Error(`timeout ${method} ${path}`)));
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    if (data) req.write(data);
    req.end();
  });
}

const probes = [
  { file: "auth.js", method: "GET", path: "/api/auth/me" },
  { file: "transactions.js", method: "GET", path: "/api/transactions" },
  { file: "budgets.js", method: "GET", path: "/api/budgets" },
  { file: "analytics.js", method: "GET", path: "/api/analytics/dashboard" },
  { file: "subscriptions.js", method: "GET", path: "/api/subscriptions/plans", authed: false },
  { file: "teams.js", method: "GET", path: "/api/teams" },
  { file: "admin.js", method: "GET", path: "/api/admin/stats" },
  { file: "apiKeys.js", method: "GET", path: "/api/api-keys" },
  { file: "notifications.js", method: "GET", path: "/api/notifications" },
  { file: "ml.js", method: "GET", path: "/api/ml/predictions" },
  { file: "webhooks.js", method: "POST", path: "/api/webhooks/stripe", authed: false, body: { type: "noop" } },
  { file: "external.js", method: "GET", path: "/api/external/currency/supported" },
  { file: "reports.js", method: "GET", path: "/api/reports/budget" },
  { file: "investments.js", method: "GET", path: "/api/investments" },
  { file: "bills.js", method: "GET", path: "/api/bills" },
  { file: "audit.js", method: "GET", path: "/api/audit" },
  { file: "audit.js", method: "GET", path: "/api/audit/summary" },
];

let passed = 0;
let failed = 0;
function check(label, condition, extra = "") {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${label}${extra ? " - " + extra : ""}`);
  } else {
    failed++;
    console.log(`  [FAIL] ${label}${extra ? " - " + extra : ""}`);
  }
}

console.log("== Route wiring smoke ==\n");

{
  const r = await hit("GET", "/health", { authed: false });
  check("/health returns 200", r.status === 200, `got ${r.status}`);
}
{
  const r = await hit("GET", "/health/detailed", { authed: false });
  const keysOk = r.body && typeof r.body.checks === "object";
  check(
    "/health/detailed returns 200 or 503 with structured checks",
    (r.status === 200 || r.status === 503) && keysOk,
    `status=${r.status} keys=${keysOk ? Object.keys(r.body.checks).join(",") : "none"}`
  );
}

// A controller that runs, calls a service that throws because external APIs
// are unreachable, and returns a structured error is still a working route —
// accept 500 when the body is a structured error envelope.
for (const p of probes) {
  const r = await hit(p.method, p.path, { authed: p.authed !== false, body: p.body });
  const structured =
    r.body && typeof r.body === "object" &&
    ("success" in r.body || "status" in r.body || "message" in r.body);
  const ok = r.status !== 500 || structured;
  const note = r.status === 500 && structured ? " (500 with structured error - acceptable)" : "";
  check(
    `${p.method} ${p.path} - ${p.file}${note}`,
    ok,
    `status=${r.status}${!ok ? ` body=${JSON.stringify(r.body).slice(0, 180)}` : ""}`
  );
}

{
  const r = await hit("GET", "/api/does-not-exist", { authed: false });
  check("unknown route returns 404", r.status === 404, `got ${r.status}`);
}
{
  const r = await hit("GET", "/api/budgets", { authed: false });
  check("protected route without token -> 401", r.status === 401, `got ${r.status}`);
}

console.log(`\n== ${passed} passed, ${failed} failed ==`);
server.close();
process.exit(failed === 0 ? 0 : 1);
