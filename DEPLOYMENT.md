# Deployment

This project now has a full-stack deployment path:

- `client`: React app built by Vite and served by Nginx.
- `server`: Node/Express API connected to MongoDB Atlas, Gemini, Hugging Face, Redis, and the ML service.
- `ml-service`: lightweight Python ML service on port `8000`.
- `redis`: cache/rate-limit backend.

## Local Production Deploy

From the repository root:

```bash
docker compose up --build -d
```

Open:

- App: `http://localhost:8080`
- API health: `http://localhost:5000/health/detailed`
- ML health: `http://localhost:8001/api/v1/health`

Stop:

```bash
docker compose down
```

## Required Environment

Before deploying, make sure `server/.env` contains production values:

```bash
NODE_ENV=production
MONGODB_URI=...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
GEMINI_API_KEY=...
HF_API_KEY=...
GEMINI_MODELS=gemini-2.5-flash,gemini-2.0-flash,gemini-2.0-flash-lite,gemini-flash-latest
HF_CHAT_MODELS=meta-llama/Llama-3.1-8B-Instruct:novita,openai/gpt-oss-20b:fireworks-ai,HuggingFaceH4/zephyr-7b-beta:featherless-ai
```

For public production hosting, put these values in the platform secret manager instead of committing `.env`.

## Cloud Deployment Notes

Use three services:

1. Static frontend or Docker web service from `client/Dockerfile`.
2. Web API service from `server/Dockerfile`.
3. ML service from `ml-service/Dockerfile`.

Set `ML_SERVICE_URL` in the backend to the internal URL of the ML service.
Set `CORS_ORIGIN` in the backend to the deployed frontend URL.

Rotate any secrets that were pasted into local chat before public deployment.
