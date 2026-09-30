import "dotenv/config";
const app = (await import("./app.js")).default;
console.log("app imported OK, router stack length=", app._router?.stack?.length);
// Verify /api/auth routes are mounted
const stack = app._router?.stack || [];
const authLayer = stack.find(l => l.name === "router" && l.regexp?.toString().includes("auth"));
console.log("auth router found:", !!authLayer);
if (authLayer) {
  const paths = authLayer.handle.stack.map(l => (l.route ? Object.keys(l.route.methods)[0].toUpperCase() + " " + l.route.path : null)).filter(Boolean);
  console.log("auth routes:");
  for (const p of paths) console.log("  " + p);
}
process.exit(0);
