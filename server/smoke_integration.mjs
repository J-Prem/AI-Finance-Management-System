/**
 * In-process auth integration test.
 * Stubs User.findOne / User.create / User.findById with an in-memory Map so we
 * can exercise the real express app, middleware, validator, and controller
 * without a running MongoDB.
 */
import "dotenv/config";
import http from "http";
import bcrypt from "bcryptjs";

// --- Stub mongoose User model BEFORE importing app.js ---
const UserModule = await import("./models/User.js");
const User = UserModule.default;

const store = new Map();     // email -> user doc
const byId = new Map();      // id -> user doc

function mkId() { return "id_" + Math.random().toString(36).slice(2); }

User.findOne = (q) => ({
  select() { return this; },
  then(resolve) {
    if (q.email) {
      const doc = store.get(q.email.toLowerCase());
      return resolve(doc ? hydrate(doc) : null);
    }
    if (q.emailVerificationToken || q.passwordResetToken) return resolve(null);
    return resolve(null);
  },
  catch() { return this; },
});
User.findById = (id) => Promise.resolve(byId.has(String(id)) ? hydrate(byId.get(String(id))) : null);
User.create = async (data) => {
  const id = mkId();
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(data.password, salt);
  const doc = {
    _id: id,
    email: data.email.toLowerCase(),
    password: hashed,
    name: data.name,
    role: "user",
    subscriptionTier: data.subscriptionTier || "FREE",
    isActive: true,
    isBanned: false,
    emailVerified: false,
    usageStats: { transactionsAdded: 0, apiCallsThisMonth: 0, mlPredictionsThisMonth: 0 },
  };
  store.set(doc.email, doc);
  byId.set(id, doc);
  return hydrate(doc);
};

// Give the in-memory doc the real User prototype so helpers work.
function hydrate(doc) {
  const inst = Object.assign(new User(), doc);
  inst._id = doc._id;
  inst.isNew = false;
  inst.save = async () => { store.set(inst.email, inst); byId.set(String(inst._id), inst); return inst; };
  return inst;
}

// Stub Subscription.create too (authController.register calls it).
const SubModule = await import("./models/Subscription.js");
SubModule.default.create = async () => ({ _id: mkId() });

// --- Now import the app ---
const app = (await import("./app.js")).default;

const server = http.createServer(app);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const { port } = server.address();

async function hit(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: "127.0.0.1", port, path, method,
      headers: { "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) },
    }, (res) => {
      let chunks = "";
      res.on("data", (c) => chunks += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: chunks ? JSON.parse(chunks) : null }); }
        catch { resolve({ status: res.statusCode, body: chunks }); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

let passed = 0, failed = 0;
function ok(name, cond, detail) { if (cond) { console.log("  PASS  " + name); passed++; } else { console.log("  FAIL  " + name + (detail ? " -- " + JSON.stringify(detail) : "")); failed++; } }

const DEMO_PW = "Str0ng" + String.fromCharCode(33) + "Pass";

console.log("\n== GET /health ==");
const health = await hit("GET", "/health");
ok("health 200", health.status === 200, health);

console.log("\n== POST /api/auth/register (weak password -> 400) ==");
const regBad = await hit("POST", "/api/auth/register", { email: "a@b.com", password: "weakpw", name: "A" });
ok("weak password rejected with 400", regBad.status === 400, regBad);
ok("errors array has readable fields", Array.isArray(regBad.body?.errors) && regBad.body.errors[0]?.field && regBad.body.errors[0]?.message, regBad.body);

console.log("\n== POST /api/auth/register (valid) ==");
const reg = await hit("POST", "/api/auth/register", { email: "demo@example.com", password: DEMO_PW, name: "Demo User" });
ok("register 201", reg.status === 201, reg);
ok("register returns data.tokens.accessToken", !!reg.body?.data?.tokens?.accessToken, reg.body);
ok("register returns data.tokens.refreshToken", !!reg.body?.data?.tokens?.refreshToken, reg.body);
ok("register returns data.user.email", reg.body?.data?.user?.email === "demo@example.com", reg.body?.data?.user);

console.log("\n== POST /api/auth/register (duplicate -> 409) ==");
const dup = await hit("POST", "/api/auth/register", { email: "demo@example.com", password: DEMO_PW, name: "Demo User" });
ok("duplicate email 409", dup.status === 409, dup);

console.log("\n== POST /api/auth/login (wrong pw -> 401) ==");
const bad = await hit("POST", "/api/auth/login", { email: "demo@example.com", password: "wrong-pw" });
ok("bad password 401", bad.status === 401, bad);

console.log("\n== POST /api/auth/login (correct) ==");
const login = await hit("POST", "/api/auth/login", { email: "demo@example.com", password: DEMO_PW });
ok("login 200", login.status === 200, login);
ok("login returns data.tokens.accessToken", !!login.body?.data?.tokens?.accessToken, login.body);
ok("login returns data.user.email", login.body?.data?.user?.email === "demo@example.com", login.body?.data?.user);

console.log("\n== GET /api/auth/me (with token) ==");
const token = login.body.data.tokens.accessToken;
const me = await new Promise((resolve) => {
  const req = http.request({ host:"127.0.0.1", port, path:"/api/auth/me", method:"GET",
    headers: { Authorization: "Bearer " + token }
  }, (res) => { let c=""; res.on("data",(d)=>c+=d); res.on("end",()=>resolve({status:res.statusCode, body:c?JSON.parse(c):null})); });
  req.end();
});
ok("/me 200", me.status === 200, me);
ok("/me returns user.email", me.body?.data?.user?.email === "demo@example.com", me.body?.data?.user);

console.log("\n== POST /api/auth/refresh ==");
const refreshToken = login.body.data.tokens.refreshToken;
const ref = await hit("POST", "/api/auth/refresh", { refreshToken });
ok("refresh 200", ref.status === 200, ref);
ok("refresh returns new data.tokens.accessToken", !!ref.body?.data?.tokens?.accessToken, ref.body);

server.close();
console.log("\nResult: " + passed + " passed, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
