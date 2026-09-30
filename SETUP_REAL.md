# SETUP_REAL.md — Running AI Finance Management in REAL mode

> There is no demo mode anymore. Every feature hits real infrastructure:
> MongoDB Atlas, OpenAI / Anthropic / Gemini APIs, and the optional HuggingFace
> fallback. This guide walks you through a clean local install on Windows,
> macOS, or Linux.

---

## 0. What you need before you start

| Component              | Required? | Where to get it                                                                          |
| ---------------------- | --------- | ---------------------------------------------------------------------------------------- |
| Node.js 20 LTS or 22   | yes       | https://nodejs.org/                                                                      |
| npm 10+                | yes       | ships with Node                                                                          |
| Git                    | yes       | https://git-scm.com/                                                                     |
| MongoDB Atlas account  | yes       | https://www.mongodb.com/cloud/atlas/register (free M0 is fine for local dev)            |
| OpenAI API key         | yes (1)   | https://platform.openai.com/api-keys                                                     |
| Anthropic API key      | yes (1)   | https://console.anthropic.com/settings/keys                                              |
| Google Gemini API key  | yes (1)   | https://aistudio.google.com/app/apikey                                                   |
| HuggingFace token      | optional  | https://huggingface.co/settings/tokens (adds a 4th LLM fallback)                         |
| Redis                  | optional  | local install or Upstash — without it, rate-limits and cache are simply skipped          |

(1) At least **one** of the three LLM providers is required. All three configured
gives you the best multi-provider fallback chain. Gemini is the recommended
primary for OCR because of its multimodal vision pricing.

---

## 1. MongoDB Atlas — 5 minutes

1. Sign up at https://www.mongodb.com/cloud/atlas/register.
2. Create a new project → **Build a Database** → choose the free **M0 shared** tier.
3. Pick a region close to you (e.g. AWS `ap-south-1` / `us-east-1`).
4. On the **Security Quickstart** page:
   - Create a database user. Write down the username/password — you need them in the connection string.
   - Under **Where would you like to connect from?**, add your IP. For local dev you can use `0.0.0.0/0` (Access Anywhere) — tighten this before production.
5. Click **Connect → Drivers → Node.js 5.5 or later** and copy the connection string. It looks like:

   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```

6. Edit it so there is a database name between the `/` and the `?`:

   ```
   mongodb+srv://krishnan:MyStr0ngPW@cluster0.abc12.mongodb.net/ai_finance?retryWrites=true&w=majority
   ```

   The database name (`ai_finance` above) is what every collection will live under.

---

## 2. Get your LLM API keys

### OpenAI (recommended for reliability)

1. Go to https://platform.openai.com/api-keys.
2. **Create new secret key** → give it a name (e.g. `ai-finance-local`) → copy it now (you can’t view it again).
3. Add billing at https://platform.openai.com/account/billing — the `gpt-4o-mini` model the server uses costs a fraction of a cent per chat turn.

### Anthropic (recommended for long reasoning)

1. https://console.anthropic.com/settings/keys → **Create Key**.
2. Top up at https://console.anthropic.com/settings/billing.
3. Model used by the server: `claude-3-5-sonnet-latest`.

### Google Gemini (recommended primary for receipt OCR)

1. https://aistudio.google.com/app/apikey → **Create API key in new project**.
2. The free tier is generous and more than enough for local development.
3. Model used: `gemini-1.5-flash` (fast + multimodal — reads receipt images).

### HuggingFace (optional)

1. https://huggingface.co/settings/tokens → **New token**, `read` scope.
2. Used as the 4th fallback (`mistralai/Mistral-7B-Instruct-v0.3`).

---

## 3. Clone the repo and install

```bash
git clone <your-fork-or-this-repo> ai-finance-management
cd ai-finance-management
```

### 3a. Server

```bash
cd server
npm install
cp .env.example .env
```

Now open `server/.env` in your editor. At minimum, fill in the lines below. The
rest can stay at their defaults for local dev.

```dotenv
# ---------- Hard requirements (server refuses to start without these) ----------
MONGODB_URI=mongodb+srv://krishnan:MyStr0ngPW@cluster0.abc12.mongodb.net/ai_finance?retryWrites=true&w=majority
JWT_SECRET=<paste-a-64-char-random-string>
JWT_REFRESH_SECRET=<paste-a-different-64-char-random-string>

# ---------- At least ONE of the following is required for LLM/OCR features ----------
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-api03-...
GEMINI_API_KEY=AIza...
# HF_API_KEY=hf_...   # optional 4th fallback

# ---------- Idempotent admin bootstrap (creates on first start only) ----------
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<something-strong-16+-chars>
ADMIN_NAME=Krishnan Lakshmi

# ---------- Misc ----------
NODE_ENV=development
PORT=5000
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

Generate strong secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run that twice — once for `JWT_SECRET`, once for `JWT_REFRESH_SECRET`.

### 3b. Client

```bash
cd ../client
npm install
# No client-side .env is required for local dev. Vite proxies /api and
# /socket.io to BACKEND_URL (default http://localhost:5000).
```

If you want to point the dev server at a different backend URL, create
`client/.env.local`:

```dotenv
BACKEND_URL=http://localhost:5000
```

---

## 4. Start the stack

Open **two** terminals.

### Terminal 1 — backend

```bash
cd server
npm run dev     # nodemon, auto-restart on file change
```

Expected output:

```
[startup] Connecting to MongoDB...
[db] MongoDB connected successfully
[startup] MongoDB connected.
[bootstrap] Created admin user: you@example.com        # first run only
[startup] Redis unavailable (...) — continuing without cache/rate-limit.   (if no Redis)
[startup] Server running on 0.0.0.0:5000
[startup] LLM providers configured: openai, anthropic, gemini
[startup] API docs: http://0.0.0.0:5000/api/docs
```

If you see `Missing required env vars: MONGODB_URI`, your `.env` didn’t load —
check you are in the `server/` folder and the file is named exactly `.env`.

### Terminal 2 — frontend

```bash
cd client
npm run dev
```

Vite prints a URL like `http://localhost:5173`. Open it.

---

## 5. First-time verification (3 quick checks)

### 5a. Health check

```bash
curl http://localhost:5000/health
# {"status":"ok","timestamp":"..."}

curl http://localhost:5000/health/detailed
# {"status":"ok","checks":{"mongodb":{"healthy":true,...},"redis":{...}, "mlService":{...}}}
```

If `mongodb.healthy` is `false`, re-check your `MONGODB_URI`, the database user
password, and the IP allowlist in Atlas.

### 5b. Log in as the admin you bootstrapped

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"your-admin-password"}'
```

You should get back `{ data: { user: {...}, tokens: { accessToken, refreshToken } } }`.

Or just log in through the web UI at http://localhost:5173/login.

### 5c. Exercise the new features

From the UI, as the logged-in admin:

1. **Transactions** → add a handful of real transactions (or import a CSV).
2. **Receipts** → drop a receipt image or paste receipt text — you should see a parsed receipt, a new Transaction auto-created, and the provider shown (`gemini`, `openai`, or `regex-fallback`).
3. **Personality** → click **Analyze** — classifier runs over your real transactions + investments and returns a label (Saver / Spender / Balanced / …).
4. **Chat advisor** → ask a question — provider is chosen in order: OpenAI → Anthropic → Gemini → HuggingFace → local rule-based. The fallback chain is visible in the response.
5. **Monitoring** → live KPI tiles should update every 5 seconds over Socket.IO (`metrics:update`).

---

## 6. Production-style run

```bash
cd server && npm start
cd client && npm run build && npm run preview
```

For real deploys:

- Put the whole stack behind a reverse proxy (nginx/Caddy/Cloudflare) with TLS.
- Set `NODE_ENV=production` and `CORS_ORIGIN=https://yourdomain.com`.
- Restrict the Atlas IP allowlist to your deploy’s IP/CIDR — never leave `0.0.0.0/0` in production.
- Rotate `JWT_SECRET` on compromise — every existing token becomes invalid.
- Use a managed Redis (Upstash, Elasticache) so rate-limiting is actually enforced across instances.

---

## 7. Troubleshooting

| Symptom                                                              | Cause / fix                                                                                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `Missing required env vars: MONGODB_URI, JWT_SECRET, …`              | `.env` not loaded, or any required value still contains `<…>`. Fill real values and restart.                                            |
| `MongoServerSelectionError: ... querySrv ETIMEOUT`                   | Your network is blocking outbound DNS to Atlas, or IP not allowlisted. Add your public IP at Atlas → Network Access.                    |
| `E11000 duplicate key error` on admin bootstrap                      | Admin with that email already exists — bootstrap is idempotent and just skips.                                                          |
| `Authentication token required` on every request                     | Frontend isn’t sending the JWT. Log out + log in again; check `localStorage` for `accessToken`.                                          |
| Chat returns `provider: "local"` even with keys set                  | Check the logs — most often the provider key is present but rejected (wrong prefix, out of credits). `/api/llm/providers` tells you which are healthy. |
| Receipts always parsed by `regex-fallback`                           | Set `GEMINI_API_KEY` (or `OPENAI_API_KEY`). Without vision-capable keys, only text pasted into the parser is understood.                |
| `Socket auth error: Invalid token`                                   | Happens if the access token expired. Refresh the page — the client will hit `/api/auth/refresh`.                                         |
| `[startup] Redis unavailable` warning                                | Harmless for local dev — rate limiting is just disabled. Install Redis locally or set `REDIS_HOST` / `REDIS_PORT` to fix.                 |
| Windows: `Error: EPERM operation not permitted`                      | Something has the DB directory open (another Node process). Close it, or use Task Manager → end `node.exe`.                              |
| CORS error in the browser console                                    | Your frontend origin isn’t in `CORS_ORIGIN`. Add it (comma-separated) and restart the server.                                            |

---

## 8. What happened to demo mode?

Everything demo-related has been stripped:

- `DEMO_MODE` env flag — removed; the server will **not** boot without real `MONGODB_URI` / `JWT_SECRET` / `JWT_REFRESH_SECRET`.
- Fake seed transactions in `scripts/seedDemo.js` — no-op stub.
- In-memory store (`services/memoryStore.js`) — throws on use; only Mongoose models are live.
- `/api/auth` demo user routes — removed.
- Socket.IO no longer falls back to a fake userId — a valid JWT is mandatory.

Every user now starts with an empty account and builds up their own data by
adding transactions, uploading receipts, and running the classifier.

---

## 9. Quick command reference

```bash
# From a fresh clone
cd server && npm install && cp .env.example .env   # fill in .env
cd ../client && npm install

# Daily dev
cd server  && npm run dev       # http://localhost:5000
cd client  && npm run dev       # http://localhost:5173

# Smoke test (real mode — requires a live .env)
cd server && node smoke_new_features.mjs

# Production
cd server && npm start
cd client && npm run build && npm run preview
```

You’re set. If anything breaks, the first thing to check is `GET /health/detailed` — it tells you at a glance which dependency is unhappy.
