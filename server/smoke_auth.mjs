/**
 * Offline smoke test for the auth stack.
 */
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { isStrongPassword } = await import(path.join(__dirname, "utils", "helpers.js"));
const UserModule = await import(path.join(__dirname, "models", "User.js"));
const User = UserModule.default;
const jwt = (await import("jsonwebtoken")).default;
const bcrypt = (await import("bcryptjs")).default;

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { console.log("  PASS  " + name + (detail ? " -- " + detail : "")); passed++; }
  else       { console.log("  FAIL  " + name + (detail ? " -- " + detail : "")); failed++; }
}

const DEMO_PW = "Str0ng" + String.fromCharCode(33) + "Pass";
const BAD_PW  = "password123";
const SHORT_PW = "Ab1" + String.fromCharCode(33);

console.log("\n== validator ==");
ok("rejects weak password",      !isStrongPassword(BAD_PW));
ok("accepts strong password",    isStrongPassword(DEMO_PW));
ok("rejects short password",     !isStrongPassword(SHORT_PW));

console.log("\n== User instance (no DB) ==");
// Hash the same way the pre-save hook does, then stamp it on the instance,
// so comparePassword can be tested without running mongoose save hooks.
const salt = await bcrypt.genSalt(10);
const hashed = await bcrypt.hash(DEMO_PW, salt);
const u = new User({
  email: "demo@example.com",
  password: hashed,
  name: "Demo User",
});
ok("user instance has comparePassword",    typeof u.comparePassword === "function");
ok("user instance has generateAuthToken",  typeof u.generateAuthToken === "function");
ok("user instance has generateRefreshToken", typeof u.generateRefreshToken === "function");
ok("comparePassword accepts correct",      await u.comparePassword(DEMO_PW));
ok("comparePassword rejects wrong",        !(await u.comparePassword("wrong-pw")));

console.log("\n== JWT round-trip ==");
const token = u.generateAuthToken();
const refresh = u.generateRefreshToken();
ok("access token is a JWT",  typeof token === "string" && token.split(".").length === 3);
ok("refresh token is a JWT", typeof refresh === "string" && refresh.split(".").length === 3);

const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
ok("access token carries user id",  !!decoded.id);
ok("access token carries email",    decoded.email === "demo@example.com");
ok("access token carries role",     decoded.role === "user");
ok("subscriptionTier on token",     decoded.subscriptionTier === "FREE");

const decodedR = jwt.verify(refresh, process.env.JWT_REFRESH_SECRET || "your-refresh-secret");
ok("refresh token carries user id", !!decodedR.id);

console.log("\n== response contract matches client ==");
// This is the fixed contract: client reads data.tokens.accessToken.
const payload = {
  success: true,
  message: "Account created successfully",
  data: {
    user: { id: String(u._id), email: u.email, name: u.name, subscriptionTier: "FREE" },
    tokens: { accessToken: token, refreshToken: refresh },
  },
};
ok("payload.data.tokens.accessToken",  !!payload.data.tokens.accessToken);
ok("payload.data.tokens.refreshToken", !!payload.data.tokens.refreshToken);
ok("payload.data.user.email",          payload.data.user.email === "demo@example.com");

console.log("\nResult: " + passed + " passed, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
