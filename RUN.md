# AI Finance Management — Run Guide

A full-stack AI finance SaaS with a React/Vite client, a Node.js/Express API, and an
optional Python ML service. Everything degrades gracefully: the product is usable
with zero external services, better with MongoDB + one LLM key, and a full
enterprise experience with all three tiers running.

## Service topology

```
client (Vite, :5173)  ──>  server (Express + Socket.IO, :5000)  ──>  ml-service (Python, :8000)
                                 │
                                 ├──> MongoDB (required for persistence)
                                 ├──> Redis  (optional; falls back to in-memory)
                                 └──> LLM providers (Gemini / HF / OpenAI / Anthropic — any one works)
```

If the ML service is down, the Node server switches to built-in JS fallbacks for
categorization, anomaly detection, recurring detection, subscription detection,
and health scoring. If the LLM providers are all down, the chatbot returns a
rule-based local response. The UI never breaks.

## 1. Install

```bash
# root-level helper installs all three
cd server && npm install
cd ../client && npm install
cd ../ml-service && pip install -r requirements-lite.txt  # optional; only for full Python ML
```

The `ml-service` can run with zero external dependencies via `ml_lite_server.py`
(pure stdlib). Use `app.py` when you want scikit-learn, transformers, etc.

## 2. Configure `server/.env`

Minimum working config (demo-mode, no cloud keys required):

```
PORT=5000
DEMO_MODE=1
JWT_SECRET=change-me-to-a-long-random-string
JWT_REFRESH_SECRET=change-me-too
CORS_ORIGIN=http://localhost:5173
ML_SERVICE_URL=http://localhost:8000
ENABLE_ML_FEATURES=true
```

Add any of these to light up the corresponding features — all are optional:

```
# persistence
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/ai_finance
REDIS_URL=redis://localhost:6379

# LLM providers (any one is enough; the router picks the first reachable)
GEMINI_API_KEY=AIza...
HF_API_KEY=hf_...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Receipt storage path (defaults to ./storage/receipts relative to server cwd)
RECEIPT_STORAGE_DIR=/var/lib/ai-finance/receipts
```

When `MONGODB_URI` is valid, the app persists receipts, transactions, bills,
investments, audit logs, and API keys. Without it, everything runs in an
in-memory demo store — good for exploring, but data is lost on restart.

## 3. Run (three terminals)

```bash
# Terminal A — Node API server (:5000)
cd server
npm run dev

# Terminal B — Vite client (:5173, proxies /api + /socket.io to :5000)
cd client
npm run dev

# Terminal C — Python ML lite server (:8000). Optional.
cd ml-service
python ml_lite_server.py
```

Open http://localhost:5173 and log in with the seeded demo accounts:

- `demo@ai-finance.local` / `Demo@1234`
- `admin@ai-finance.local` / `Admin@1234`

The landing page's "See Demo" button auto-logs you in as the demo user.

## 4. Pages

| Path            | What it does                                                                 |
|-----------------|------------------------------------------------------------------------------|
| `/`             | Landing page with working "See Demo" CTA                                    |
| `/dashboard`    | Live KPIs, category donut, burn-rate trend, personality snippet, alert feed |
| `/monitoring`   | Ops console: 8 KPIs, live socket stream, recurring subscriptions           |
| `/receipts`     | Drag-drop image upload / manual text → OCR → categorized receipt + thumbnail persisted to disk |
| `/investments`  | Live holdings, 60s price polling, allocation donut; demo data when empty    |
| `/bills`        | Live bills + "Detect from Receipts" button → ML-derived recurring bills     |
| `/personality`  | Radar chart, features, narrative, manual override                           |
| `/chatbot`      | Multi-LLM advisor with provider selector and local fallback                 |

## 5. Key APIs

All `/api/*` routes require `Authorization: Bearer <accessToken>` or an API key
via `x-api-key`. `/health` and `/health/detailed` are unauthenticated.

```
# auth
POST /api/auth/register             { email, password, name }
POST /api/auth/login                { email, password } -> { user, tokens }
POST /api/auth/refresh              { refreshToken }
GET  /api/auth/me

# receipts (images persisted to disk; thumbnails in Mongo)
POST /api/receipts/upload           { imageBase64?, mimeType?, text? }
GET  /api/receipts
GET  /api/receipts/:id/image        streams image with thumbnail fallback
GET  /api/receipts/stats
PATCH /api/receipts/:id/category    { category }
POST /api/receipts/:id/retag        { tags, notes }
DEL  /api/receipts/:id

# bills — derive recurring bills from receipts + transactions
POST /api/bills/derive-from-receipts

# investments
GET  /api/investments
POST /api/investments               { symbol, type, quantity, buyPrice }
PATCH /api/investments/:id          { currentPrice }
DEL  /api/investments/:id
GET  /api/external/stocks/quote/:symbol       live quote
GET  /api/external/stocks/market-summary      indices

# ML (rate-limited per tier, with JS fallback when Python service is down)
POST /api/ml/categorize, /detect-anomalies, /predict-spending, /health-score,
     /detect-recurring, /detect-subscriptions, /identify-opportunities,
     /analyze-personality, /analyze-patterns

# LLM (rate-limited per tier)
POST /api/llm/chat                  { messages:[{role,content}], provider? }
GET  /api/llm/providers

# observability
GET  /health                        fast liveness
GET  /health/detailed               MongoDB + Redis + ML service status
GET  /api/monitoring/snapshot       live KPIs + forecast + alerts + recurring
```

Socket.IO: connect with `{ auth: { token } }`; receives `metrics:update`,
`transaction:new`, `notification:budget`, `notification:anomaly`.

## 6. SaaS hardening features

- **Tier-based rate limiting.** `/api/ml`, `/api/llm`, `/api/receipts` are
  wrapped with a per-user, per-tier limiter. Free: 10/min, Pro: 60/min,
  Enterprise: 600/min. Uses Redis when available, in-memory buckets otherwise.
- **Request IDs.** Every request gets `X-Request-Id` (passed in or generated)
  and it's recorded in the audit log row for cross-service correlation.
- **Audit log.** Every mutating `/api/*` request is written to the `AuditLog`
  collection with actor, resource, method, status, IP, UA, duration, and
  requestId. 90-day TTL by default.
- **Image persistence.** Receipt thumbnails go into Mongo (<= 200 KB); full-res
  images go to disk under `RECEIPT_STORAGE_DIR/${userId}/`. `deleteReceipt`
  unlinks the file too.
- **JS ML fallbacks.** `mlProxyService.js` wraps every upstream call with a
  cache + a pure-JS fallback so the UI never receives a 501 when Python ML is
  offline.

## 7. Free-tier / offline mode

Everything works with zero external services:

- MongoDB missing → memory store (auth, receipts, transactions all work)
- Redis missing → in-memory rate-limit buckets
- ML service missing → JS fallbacks for categorization, anomaly detection,
  recurring detection, subscriptions, opportunities, and health scoring
- All LLM providers missing → rule-based local advisor

This is the recommended path for smoke-testing the product. To switch to a
production stack, set `MONGODB_URI`, `REDIS_URL`, and one LLM provider key,
remove `DEMO_MODE`, and restart.

## 8. Smoke test

```bash
# Start the three services in three terminals (ML optional), then:
curl -s http://localhost:5000/health
curl -s http://localhost:5000/health/detailed | jq .

# Auth + a full write cycle
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@ai-finance.local","password":"Demo@1234"}' | jq -r .tokens.accessToken)

curl -s http://localhost:5000/api/receipts/stats -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:5000/api/bills/derive-from-receipts -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:5000/api/ml/health-score -H "Authorization: Bearer $TOKEN"
```

Every endpoint should return JSON (never HTML, never 5xx). If ML is down, the
`model` field will read `js-fallback`.

## 9. Architecture notes

- `server/app.js` — Helmet, CORS, compression, Morgan logs, global limiter,
  request-id middleware, tier limiter on expensive routes, audit log, Swagger
  at `/api/docs`.
- `server/middleware/rateLimiter.js` — global + tier-aware limiters with Redis
  store fallback.
- `server/middleware/auditLog.js` — records every mutating `/api/*` request
  with correlation id.
- `server/services/mlProxyService.js` — proxies ML calls + caching + JS
  fallbacks.
- `server/services/receiptParser.js` — Gemini / HF / OpenAI vision pipelines
  with preprocessing and regex fallback.
- `server/services/billPredictor.js` — recurring detection via coefficient of
  variation + median-gap frequency inference.
- `server/controllers/receiptController.js` — image persistence and streaming.
- `ml-service/ml_lite_server.py` — stdlib-only HTTP server with endpoints for
  categorize, detect-anomalies, predict-spending, detect-recurring,
  detect-subscriptions, identify-opportunities, health-score,
  analyze-personality, analyze-patterns.
- `client/src/pages/InvestmentsPage.jsx`, `BillsPage.jsx`, `ReceiptsPage.jsx` —
  now fetch live data with graceful demo fallback.

## 10. Wiring MongoDB Atlas

1. Create a free cluster at https://www.mongodb.com/atlas.
2. Add a user, whitelist your IP (or 0.0.0.0/0 for dev), copy the SRV URI.
3. Paste into `MONGODB_URI=` in `server/.env`.
4. Remove `DEMO_MODE=1` (or keep it to force the in-memory path).
5. Restart. First request auto-creates indexes.

If the connection fails the app logs the reason and falls back to demo mode —
it never crashes the server.

## 11. Deployment

The `docker-compose.yml` at repo root brings up MongoDB + Redis + the server +
the client. Wire `ml-service` in by adding:

```yaml
  ml:
    build: ./ml-service
    ports: ["8000:8000"]
    environment:
      - PYTHONUNBUFFERED=1
```

For production, put the API server behind an LB with sticky sessions (Socket.IO
uses long-polling fallback), front the client with a CDN, and point
`ML_SERVICE_URL` at the internal ML endpoint.
