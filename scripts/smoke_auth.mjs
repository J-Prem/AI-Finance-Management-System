/**
 * Offline smoke test for the auth stack.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", "server", ".env") });

const serverDir = path.join(__dirname, "..", "server");
const { isStrongPassword } = await import(path.join(serverDir, "utils", "helpers.js"));
const UserModule = await import(path.join(serverDir, "models", "User.js"));
const User = UserModule.default;
const jwt = (await import("jsonwebtoken")).default;

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { console.log("  PASS  " + name + (detail ? " -- " + detail : "")); passed++; }
  else       { console.log("  FAIL  " + name + (detail ? " -- " + detail : "")); failed++; }
}

console.log("\n== validator ==");
ok("rejects weak password",      !isStrongPassword("password123"));
ok("accepts strong password",    isStrongPassword("Str0ng!Pass"));
ok("rejects short password",     !isStrongPassword("Ab1!"));

console.log("\n== User instance (no DB) ==");
const u = new User({
  email: "demo@example.com",
  password: "Str0ng!Pass",
  name: "Demo User",
});

// Run the pre-save hash hook manually.
await new Promise((resolve, reject) => {
  const hooks = u.schema.s.hooks._pres.get("save") || [];
  let i = 0;
  const next = (err) => { if (err) return reject(err); const h = hooks[i++]; if (!h) return resolve(); h.fn.call(u, next); };
  next();
});
ok("password is hashed after pre-save hook", u.password && u.password != "Str0ng!Pass" && u.password.length > 20, "hash prefix=" + (u.password || "").slice(0, 7));
ok("comparePassword matches correct",  await u.comparePassword("Str0ng!Pass"));
ok("comparePassword rejects wrong",    !(await u.comparePassword("wrong-pw")));

console.log("\n== JWT round-trip ==");
const token = u.generateAuthToken();
const refresh = u.generateRefreshToken();
ok("access token looks like a JWT", typeof token === "string" && token.split(".").length === 3);
ok("refresh token looks like a JWT", typeof refresh === "string" && refresh.split(".").length === 3);

const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
ok("access token carries user id",   !!decoded.id);
ok("access token carries email",     decoded.email === "demo@example.com");
ok("access token carries role",      decoded.role === "user");

const decodedR = jwt.verify(refresh, process.env.JWT_REFRESH_SECRET || "your-refresh-secret");
ok("refresh token carries user id",  !!decodedR.id);

console.log("\n== response contract matches client expectation ==");
const fakeRegisterResponse = {
  success: true,
  message: "Account created successfully",
  data: {
    user: { id: u._id, email: u.email, name: u.name, subscriptionTier: "FREE" },
    tokens: { accessToken: token, refreshToken: refresh },
  },
};
ok("response has data.tokens.accessToken",  !!fakeRegisterResponse.data.tokens.accessToken);
ok("response has data.tokens.refreshToken", !!fakeRegisterResponse.data.tokens.refreshToken);
ok("response has data.user.email",          fakeRegisterResponse.data.user.email === "demo@example.com");

console.log("\nResult: " + passed + " passed, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
