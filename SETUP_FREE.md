# SETUP_FREE.md — Running AI Finance Management on 100% FREE tiers

> Goal of this guide: get every feature of the app working without paying a
> cent. No credit card required on any service. If you already followed
> [SETUP_REAL.md](./SETUP_REAL.md), this is the same process but only lists
> services that have a real free tier, and tells you which to skip.

---

## 1. What's actually free, and what isn't

| Service               | Free tier?                                       | Use it? | Why                                                                                  |
| --------------------- | ------------------------------------------------ | ------- | ------------------------------------------------------------------------------------ |
| MongoDB Atlas (M0)    | **Yes** — 512 MB shared cluster, forever free    | **Yes** | Our primary database. M0 is more than enough for personal/dev use.                  |
| Google Gemini API     | **Yes** — 15 req/min, 1M tokens/min, 1,500 req/day on Flash | **Yes** | Primary chat LLM **and** receipt OCR. No billing required. |
| HuggingFace Inference | **Yes** — free rate-limited for public models    | **Yes** | Second LLM fallback, no cost, no card.                                               |
| Built-in rule-based LLM | **Yes** — runs in-process, zero network         | **Yes** | Last-resort fallback — always works even offline.                                   |
| OpenAI (GPT-4o-mini)  | **No** — requires paid credits                   | Skip    | $5 trial credits are gone after a few months. Don't set the key.                   |
| Anthropic (Claude)    | **No** — requires paid credits                   | Skip    | Same story. Don't set the key.                                                      |
| Alpha Vantage (stocks)| **Yes** — 25 req/day, 5 req/min                  | Optional | Only needed if you use the investments page with live prices.                      |
| CoinGecko (crypto)    | **Yes** — 10-30 req/min with no API key          | Optional | For crypto prices in the investments page.                                          |
| NewsAPI               | **Yes** — 100 req/day (dev only)                 | Optional | News widgets, dev-only tier is fine locally.                                        |
| ExchangeRate-API      | **Yes** — 1,500 req/month                        | Optional | Multi-currency conversion.                                                          |
| Stripe                | **Yes** — test mode is free forever              | Optional | Only if you want to test paid-tier flows.                                           |
| Razorpay              | **Yes** — test mode is free                      | Optional | Indian payments — test mode is free.                                                |
| Redis                 | **Yes** — Upstash has a free tier                | Optional | Server runs fine without it. Skip unless you want rate-limiting.                    |
| ML microservice       | **N/A** — Python app you run locally             | Optional | Runs on your machine. Zero cost. Only if you want advanced models.                  |
| Built-in Node ML      | **N/A** — compiled into the server               | **Yes** | EWMA bill forecast + personality classifier + anomaly detection — **already there**. |

### What you will actually set up

For a minimum-viable, fully-free install you need exactly three things:

1. **MongoDB Atlas** free cluster (M0).
2. **Google Gemini API key** (free tier, no billing).
3. **HuggingFace access token** (free tier).

Everything else is optional polish.

---

## 2. Step 1 — MongoDB Atlas (free, 5 min)

1. Sign up at https://www.mongodb.com/cloud/atlas/register. **No card required** for M0.
2. **Build a Database → Shared → M0 FREE**.
3. Pick a region geographically close to you (e.g. AWS `ap-south-1` if you're in India).
4. Click **Create**.
5. In **Security Quickstart**:
   - Create a database user. Write down the username + password — you'll need them in the connection string.
   - Under **Where would you like to connect from?**, add your current IP, or pick **Allow access from anywhere** (`0.0.0.0/0`) for local dev convenience. Tighten before shipping.
6. Back on the cluster page, click **Connect → Drivers → Node.js (5.5 or later)** and copy the connection string. It looks like:

   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```

7. Edit it to include a database name (I use `ai_finance`):

   ```
   mongodb+srv://krishnan:MyStr0ngPW@cluster0.abc12.mongodb.net/ai_finance?retryWrites=true&w=majority
   ```

Save that string — it's your `MONGODB_URI`.

---

## 3. Step 2 — Google Gemini API key (free, 2 min)

This single key unlocks both the chat advisor and the receipt OCR.

1. Go to https://aistudio.google.com/app/apikey (sign in with a Google account).
2. Click **Create API key in new project**.
3. Copy the key (`AIza...`). That's your `GEMINI_API_KEY`.
4. No billing setup needed. Free-tier Flash limits:
   - 15 requests per minute
   - 1 million tokens per minute
   - 1,500 requests per day

These are plenty for personal use and dev work.

---

## 4. Step 3 — HuggingFace token (free, 1 min)

Used as the second fallback if Gemini ever returns an error or rate-limits you.

1. Sign up / log in at https://huggingface.co/.
2. Go to https://huggingface.co/settings/tokens.
3. **Create new token** → name it `ai-finance-local`, scope `read`.
4. Copy it (`hf_...`). That's your `HF_API_KEY`.

Free model used by the server: `mistralai/Mistral-7B-Instruct-v0.3`. Rate-limited but free.

---

## 5. Step 4 — Clone and install

```bash
git clone <your-repo-url> ai-finance-management
cd ai-finance-management

# Server
cd server
npm install
cp .env.example .env

# Client
cd ../client
npm install
```

Now edit `server/.env`. The minimum free-tier config is below — everything else can stay commented or empty:

```dotenv
# ---------- Runtime ----------
NODE_ENV=development
PORT=5000
HOST=0.0.0.0

# ---------- REQUIRED ----------
MONGODB_URI=mongodb+srv://krishnan:MyStr0ngPW@cluster0.abc12.mongodb.net/ai_finance?retryWrites=true&w=majority
JWT_SECRET=<paste 64-char random hex — command below>
JWT_REFRESH_SECRET=<paste a different 64-char random hex>

# ---------- Admin bootstrap (first-boot only) ----------
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<16+ char strong password>
ADMIN_NAME=Krishnan Lakshmi

# ---------- Free-tier LLM providers (use these, skip OpenAI + Anthropic) ----------
GEMINI_API_KEY=AIza...your-gemini-key
HF_API_KEY=hf_...your-huggingface-token

# Explicitly leave these blank — they don't have free tiers
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# ---------- CORS ----------
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# ---------- Feature flags — turn off things that need paid services ----------
ENABLE_EMAIL_NOTIFICATIONS=false
ENABLE_STRIPE_PAYMENTS=false
ENABLE_ML_FEATURES=true
ENABLE_TEAM_FEATURES=true
```

Generate the two JWT secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run that twice — once per secret.

---

## 6. Step 5 — Run it

Open **two** terminals.

### Terminal 1 — backend

```bash
cd server
npm run dev
```

You should see:

```
[startup] Connecting to MongoDB...
[db] MongoDB connected successfully
[bootstrap] Created admin user: you@example.com
[startup] Redis unavailable (...) — continuing without cache/rate-limit.   ← harmless
[startup] Server running on 0.0.0.0:5000
[startup] LLM providers configured: gemini, huggingface
[startup] API docs: http://0.0.0.0:5000/api/docs
```

Notice the last line says `gemini, huggingface` and **not** `openai, anthropic` — that's the free-tier-only setup working.

### Terminal 2 — frontend

```bash
cd client
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`) and log in as `you@example.com` with the admin password from your `.env`.

---

## 7. What works on free-tier only

Everything in the core app:

- **Auth** — register, login, JWT, refresh token, logout.
- **Transactions / budgets / bills** — all CRUD, no external APIs.
- **Receipts** — image upload → Gemini Vision OCR (free tier) → auto-created Transaction.
- **Personality classifier** — runs in-process, no API, feature-based (Saver / Spender / Balanced / Impulsive / Strategic / Investor).
- **Bill forecasting (ML)** — in-process EWMA model, no API.
- **Anomaly detection** — in-process statistical model, no API.
- **Chat advisor** — Gemini primary → HuggingFace fallback → local rule-based engine. If both free APIs rate-limit you, the rule-based engine still answers coherently with your actual transaction data.
- **Monitoring dashboard** — live Socket.IO KPI feed every 5 s, 100% in-process.
- **Admin console** — all admin features work without any paid service.

What gets disabled / skipped silently:

- Email notifications (no SMTP configured).
- Stripe billing (test mode disabled — `ENABLE_STRIPE_PAYMENTS=false`).
- Redis-backed distributed rate limiting (server uses an in-memory limiter instead).
- Stock / crypto live prices, unless you also add the optional free keys below.

---

## 8. Optional free extras (only add if you need them)

### Live stock prices — Alpha Vantage (25 req/day free)

1. https://www.alphavantage.co/support/#api-key → **Get your free API Key**.
2. `ALPHA_VANTAGE_API_KEY=...`

### Crypto prices — CoinGecko (works without a key)

Leave `COINGECKO_API_KEY=` empty. The client uses the keyless endpoint (30 req/min free).

### News widget — NewsAPI (100 req/day dev free)

1. https://newsapi.org/register → copy key.
2. `NEWS_API_KEY=...`  — only works from `localhost` on the free tier.

### Multi-currency — ExchangeRate-API (1,500 req/month free)

1. https://www.exchangerate-api.com/ → free plan, copy key.
2. `EXCHANGE_RATE_API_KEY=...`

### Distributed rate limiter — Upstash Redis (10k req/day free)

1. https://console.upstash.com/ → create a Redis database (pick the free tier).
2. Copy the endpoint, port, and password.
3. `REDIS_HOST=... REDIS_PORT=... REDIS_PASSWORD=...`

All of the above are strictly optional. The app runs fully without any of them.

---

## 9. ML on free tier — how it actually works

The word "ML" in this project covers four separate things. Here's how each one stays free:

| Feature                       | Where it runs              | Cost | Notes                                                    |
| ----------------------------- | -------------------------- | ---- | ------------------------------------------------------- |
| Receipt OCR (multimodal)      | Gemini 1.5 Flash (free)    | $0   | 1,500 req/day is plenty for personal use.               |
| Chat advisor (LLM)            | Gemini → HF → local rule   | $0   | Triple fallback guarantees a reply without hitting paid APIs. |
| Bill forecasting              | Node EWMA model (in-proc)  | $0   | No external call. Runs on your server CPU.              |
| Personality classifier        | Node feature model (in-proc) | $0 | Deterministic — no network needed.                      |
| Anomaly detection             | Node statistical model     | $0   | Same — in-process.                                      |
| Recurring bill detection      | Node pattern matcher       | $0   | Same.                                                   |
| *(Optional)* advanced ML      | Python ml-service          | $0   | Only if you run it locally. See `ml-service/SETUP.md`.  |

You never need to pay for any of this to work. The heavy models (LLMs) are
reached via free API tiers; the classical ML (forecast, classifier, anomaly)
lives inside the Node server itself — no API call, no cost.

---

## 10. Verifying everything end-to-end

With the server running, in a new terminal:

```bash
# Basic health
curl http://localhost:5000/health

# Detailed — mongodb should be healthy, redis unhealthy (expected on free tier without Upstash)
curl http://localhost:5000/health/detailed

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"your-admin-password"}'

# Full smoke test (requires .env to be populated)
cd server && node smoke_new_features.mjs
```

---

## 11. Free-tier troubleshooting

| Symptom                                                          | Fix                                                                                                        |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Missing required env vars: MONGODB_URI, JWT_SECRET, ...`        | `.env` values still contain `<...>` placeholders. Fill in real values.                                      |
| Chat reply always from `provider: "local"`                       | Your Gemini/HF keys are missing or wrong. `curl http://localhost:5000/api/llm/providers` tells you who's healthy. |
| `429 Too Many Requests` from Gemini                              | Hit the 15 req/min cap. Wait a minute — server will auto-fall-back to HuggingFace, then to local.           |
| `429` from HuggingFace                                           | Free tier is slow under load. The local rule-based engine takes over automatically.                        |
| Receipt OCR returns `provider: "regex-fallback"` with low confidence | `GEMINI_API_KEY` missing/invalid, or image isn't being sent. Check the server logs.                        |
| MongoDB connection timeout                                       | Atlas IP allowlist doesn't include your public IP. Atlas → Network Access → Add IP.                         |
| Stripe endpoints return errors                                   | `ENABLE_STRIPE_PAYMENTS=false` disables them — ignore any 503s on those routes.                            |
| Frontend can't reach backend (`ERR_NETWORK`)                     | Make sure the server is on port 5000 and `CORS_ORIGIN` includes `http://localhost:5173`.                    |

---

## 12. TL;DR — the exact three keys you need

```dotenv
MONGODB_URI=mongodb+srv://...
GEMINI_API_KEY=AIza...
HF_API_KEY=hf_...
```

Plus the two JWT secrets (generate locally, no signup). That's it. No paid
service, no credit card, full app.
