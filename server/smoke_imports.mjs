import "dotenv/config";
const files = [
  "./routes/auth.js","./routes/transactions.js","./routes/budgets.js","./routes/analytics.js",
  "./routes/subscriptions.js","./routes/teams.js","./routes/admin.js","./routes/apiKeys.js",
  "./routes/notifications.js","./routes/ml.js","./routes/webhooks.js","./routes/external.js",
  "./routes/reports.js","./routes/investments.js","./routes/bills.js",
  "./controllers/analyticsController.js","./controllers/apiKeyController.js","./controllers/authController.js",
  "./controllers/billController.js","./controllers/budgetController.js","./controllers/externalApiController.js",
  "./controllers/investmentController.js","./controllers/mlController.js","./controllers/notificationController.js",
  "./controllers/reportController.js","./controllers/subscriptionController.js","./controllers/teamController.js",
  "./controllers/transactionController.js",
  "./services/bankingService.js","./services/cacheService.js","./services/currencyService.js",
  "./services/emailService.js","./services/investmentService.js","./services/mlProxyService.js",
  "./services/newsService.js","./services/notificationService.js","./services/reportService.js",
  "./services/stockService.js",
];
let ok=0, bad=0;
for (const f of files) {
  try { await import(f); console.log("OK   " + f); ok++; }
  catch (e) { console.log("FAIL " + f + "  :: " + (e.message || e).split("\n")[0]); bad++; }
}
console.log("\nsummary: " + ok + " ok, " + bad + " failed");
process.exit(0);
