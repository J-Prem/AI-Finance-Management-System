/**
 * Multi-LLM router with heavy free-tier fallback chain.
 *
 * Free-tier provider priority (chat):
 *   1. Google Gemini (GEMINI_API_KEY)
 *        - model chain from GEMINI_MODELS env var
 *          (default: 2.0-flash-exp → 1.5-flash → 1.5-flash-8b → 1.5-pro-latest)
 *   2. HuggingFace Inference API (HF_API_KEY)
 *        - model pool from HF_CHAT_MODELS env var
 *          (default: Mistral-7B-Instruct-v0.3 → zephyr-7b-beta → Phi-3-mini-4k)
 *   3. OpenAI (if OPENAI_API_KEY present — optional paid)
 *   4. Anthropic (if ANTHROPIC_API_KEY present — optional paid)
 *   5. Local rule-based advisor — always last, always works.
 *
 * Also exposes free-tier task-specific helpers:
 *   - summarize(text)  → facebook/bart-large-cnn via HF
 *   - sentiment(text)  → cardiffnlp/twitter-roberta-base-sentiment-latest
 *   - embed(texts)     → sentence-transformers/all-MiniLM-L6-v2 via HF
 *
 * Every call has a per-provider timeout and falls through to the next
 * provider on failure. The /api/llm/chat endpoint NEVER 5xx's.
 */
import logger from '../utils/logger.js';

const TIMEOUT_MS = 18000;

const DEFAULT_SYSTEM = `You are FinSight, a pragmatic financial advisor embedded in an AI-powered personal finance dashboard.
You analyze spending, bills, subscriptions, investments, and budgets for the signed-in user.
Respond in concise, actionable bullet points. Include concrete dollar figures when context is provided.
Never invent transactions. If you don't have data, say so and ask for the specific fields you need.`;

const list = (name, fallback) =>
  (process.env[name] || fallback).split(',').map((s) => s.trim()).filter(Boolean);

const GEMINI_MODELS = () =>
  list('GEMINI_MODELS',
    'gemini-2.5-flash,gemini-2.0-flash,gemini-2.0-flash-lite,gemini-flash-latest');

const HF_CHAT_MODELS = () =>
  list('HF_CHAT_MODELS',
    'meta-llama/Llama-3.1-8B-Instruct:novita,openai/gpt-oss-20b:fireworks-ai,HuggingFaceH4/zephyr-7b-beta:featherless-ai');

const HF_SUMMARIZE_MODEL = () => process.env.HF_SUMMARIZE_MODEL || 'facebook/bart-large-cnn';
const HF_SENTIMENT_MODEL = () =>
  process.env.HF_SENTIMENT_MODEL || 'cardiffnlp/twitter-roberta-base-sentiment-latest';
const HF_EMBED_MODEL = () =>
  process.env.HF_EMBED_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';

async function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/* --------------------------- Gemini (multi-model) --------------------------- */

async function callGeminiModel({ messages, model, temperature = 0.3 }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY missing');
  const sys = messages.find((m) => m.role === 'system')?.content || DEFAULT_SYSTEM;
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await withTimeout(fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents,
      generationConfig: { temperature, maxOutputTokens: 1024 },
    }),
  }), TIMEOUT_MS, `gemini:${model}`);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`gemini ${model} ${res.status} ${errText.slice(0, 120)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n') || '';
  return { text, provider: 'gemini', model };
}

async function callGemini({ messages }) {
  const models = GEMINI_MODELS();
  let lastErr;
  for (const m of models) {
    try {
      const r = await callGeminiModel({ messages, model: m });
      if (r.text && r.text.trim()) return r;
      lastErr = new Error(`gemini ${m} empty response`);
    } catch (e) {
      lastErr = e;
      logger.warn(`[LLM] gemini model ${m} failed: ${e.message}`);
    }
  }
  throw lastErr || new Error('all gemini models failed');
}

/* --------------------------- HuggingFace (multi-model) --------------------------- */

async function callHuggingFaceModel({ messages, model }) {
  const key = process.env.HF_API_KEY;
  if (!key) throw new Error('HF_API_KEY missing');
  const res = await withTimeout(fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 512,
      temperature: 0.3,
    }),
  }), TIMEOUT_MS, `hf:${model}`);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`huggingface ${model} ${res.status} ${errText.slice(0, 120)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return { text: text.trim(), provider: 'huggingface', model };
}

async function callHuggingFace({ messages }) {
  const models = HF_CHAT_MODELS();
  let lastErr;
  for (const m of models) {
    try {
      const r = await callHuggingFaceModel({ messages, model: m });
      if (r.text && r.text.trim()) return r;
      lastErr = new Error(`hf ${m} empty response`);
    } catch (e) {
      lastErr = e;
      logger.warn(`[LLM] huggingface model ${m} failed: ${e.message}`);
    }
  }
  throw lastErr || new Error('all huggingface models failed');
}

/* --------------------------- Optional paid providers --------------------------- */

async function callOpenAI({ messages, model = 'gpt-4o-mini', temperature = 0.3 }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY missing');
  const res = await withTimeout(fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature }),
  }), TIMEOUT_MS, 'openai');
  if (!res.ok) throw new Error(`openai ${res.status}`);
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content || '', provider: 'openai', model };
}

async function callAnthropic({ messages, model = 'claude-3-5-sonnet-latest', temperature = 0.3 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY missing');
  const sys = messages.find((m) => m.role === 'system')?.content || DEFAULT_SYSTEM;
  const convo = messages.filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));
  const res = await withTimeout(fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 1024, temperature, system: sys, messages: convo }),
  }), TIMEOUT_MS, 'anthropic');
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || '').join('\n').trim();
  return { text, provider: 'anthropic', model };
}

/* --------------------------- Local rule-based advisor --------------------------- */

function callLocal({ messages, context = {} }) {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const q = lastUser.toLowerCase();
  const lines = [];
  const { topCategory, monthSpend, income, personality, upcomingBills } = context;

  if (q.includes('budget') || q.includes('save') || q.includes('saving')) {
    lines.push('Savings plan suggestions based on your current profile:');
    lines.push(`• Target saving rate: 20% of income${income ? ` = $${(income * 0.2).toFixed(0)}/mo` : ''}.`);
    lines.push('• Cap dining to 10% of income and entertainment to 5%.');
    lines.push('• Auto-transfer the savings amount the day after payday so it never hits the checking account.');
  } else if (q.includes('invest')) {
    lines.push('Investment framing (not advice):');
    lines.push('• Keep a 3-6 month emergency fund in a HYSA before increasing risk.');
    lines.push('• A three-fund index portfolio (US total, intl, bonds) is a common low-cost baseline.');
    lines.push('• Max employer 401(k) match first — it is effectively free return.');
  } else if (q.includes('subscription') || q.includes('cancel')) {
    lines.push('Subscription audit heuristic:');
    lines.push('• Flag any recurring charge used <2x per month.');
    lines.push('• Group overlapping services (e.g., Netflix + Disney+) and keep only your top-use one for 90 days.');
    lines.push(`• From your data I see upcoming bills: ${(upcomingBills || []).slice(0, 4).map((b) => b.name).join(', ') || 'no recurring items visible'}.`);
  } else if (q.includes('bill') || q.includes('predict') || q.includes('next month')) {
    lines.push('Next month bill projection:');
    if (upcomingBills?.length) {
      upcomingBills.slice(0, 6).forEach((b) =>
        lines.push(`• ${b.name}: ~$${Number(b.amount).toFixed(2)} (due day ${b.dueDay})`));
    } else {
      lines.push('• No recurring bills on file yet. Upload a few receipts or connect a bank to enable projections.');
    }
  } else if (q.includes('personality') || q.includes('spender')) {
    lines.push(`Personality profile: ${personality || 'Balanced'}.`);
    lines.push('• Review the top category and set a 10% reduction challenge for next month.');
  } else {
    lines.push('Quick read on your finances:');
    if (monthSpend) lines.push(`• Monthly spend: $${Number(monthSpend).toFixed(2)}.`);
    if (topCategory) lines.push(`• Biggest spend category: ${topCategory}.`);
    lines.push('• Ask me about budgets, saving, subscriptions, bill predictions, or investments.');
  }

  return {
    text: lines.join('\n'),
    provider: 'local',
    model: 'finsight-rule-based-v1',
  };
}

/* --------------------------- Router --------------------------- */

const providerFns = {
  gemini: callGemini,
  huggingface: callHuggingFace,
  openai: callOpenAI,
  anthropic: callAnthropic,
  local: callLocal,
};

// Free-tier first ordering
const PROVIDER_ORDER = ['gemini', 'huggingface', 'openai', 'anthropic', 'local'];

export function availableProviders() {
  const out = [];
  if (process.env.GEMINI_API_KEY) out.push({ name: 'gemini', models: GEMINI_MODELS() });
  if (process.env.HF_API_KEY) out.push({ name: 'huggingface', models: HF_CHAT_MODELS() });
  if (process.env.OPENAI_API_KEY) out.push({ name: 'openai', models: ['gpt-4o-mini'] });
  if (process.env.ANTHROPIC_API_KEY) out.push({ name: 'anthropic', models: ['claude-3-5-sonnet-latest'] });
  out.push({ name: 'local', models: ['finsight-rule-based-v1'] });
  return out;
}

export async function providerDiagnostics() {
  const diagnostics = [];

  if (process.env.GEMINI_API_KEY) {
    const configured = GEMINI_MODELS();
    try {
      const res = await withTimeout(fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`,
      ), 8000, 'gemini-models');
      if (!res.ok) throw new Error(`models.list ${res.status}`);
      const data = await res.json();
      const validModels = (data.models || [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => String(m.name || '').replace(/^models\//, ''));
      diagnostics.push({
        name: 'gemini',
        configured: true,
        healthy: configured.some((model) => validModels.includes(model)),
        models: configured,
        activeModel: configured.find((model) => validModels.includes(model)) || null,
      });
    } catch (e) {
      diagnostics.push({
        name: 'gemini',
        configured: true,
        healthy: false,
        models: configured,
        error: e.message,
      });
    }
  } else {
    diagnostics.push({ name: 'gemini', configured: false, healthy: false, models: [] });
  }

  if (process.env.HF_API_KEY) {
    const configured = HF_CHAT_MODELS();
    try {
      const res = await withTimeout(fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.HF_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: configured[0],
          messages: [{ role: 'user', content: 'Reply with ok.' }],
          max_tokens: 3,
          temperature: 0,
        }),
      }), 12000, 'hf-router');
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${res.status}: ${text.slice(0, 180)}`);
      }
      diagnostics.push({
        name: 'huggingface',
        configured: true,
        healthy: true,
        models: configured,
        activeModel: configured[0],
      });
    } catch (e) {
      const needsPermission = /sufficient permissions|Inference Providers/i.test(e.message);
      diagnostics.push({
        name: 'huggingface',
        configured: true,
        healthy: false,
        models: configured,
        needsPermission,
        error: needsPermission
          ? 'HF token needs Inference Providers permission'
          : e.message,
      });
    }
  } else {
    diagnostics.push({ name: 'huggingface', configured: false, healthy: false, models: [] });
  }

  diagnostics.push({
    name: 'local',
    configured: true,
    healthy: true,
    models: ['finsight-rule-based-v1'],
  });

  return diagnostics;
}

export async function chat({ messages, preferredProvider, context = {} }) {
  const baseMessages = messages.some((m) => m.role === 'system')
    ? messages
    : [{ role: 'system', content: DEFAULT_SYSTEM }, ...messages];

  const order = [preferredProvider, ...PROVIDER_ORDER].filter((v, i, a) => v && a.indexOf(v) === i);
  const errors = [];

  for (const name of order) {
    const fn = providerFns[name];
    if (!fn) continue;
    try {
      const result = await fn({ messages: baseMessages, context });
      if (result.text && result.text.trim()) {
        return { ...result, fallbacks: errors };
      }
      errors.push({ provider: name, error: 'empty response' });
    } catch (e) {
      logger.warn(`[LLM] ${name} failed: ${e.message}`);
      errors.push({ provider: name, error: e.message });
    }
  }
  const local = callLocal({ messages: baseMessages, context });
  return { ...local, fallbacks: errors };
}

/* --------------------------- Task-specific free helpers --------------------------- */

/**
 * Summarize any long text using HuggingFace's BART-CNN (free).
 * Gracefully falls back to a local truncator if HF is unavailable.
 */
export async function summarize(text, { maxLength = 160, minLength = 40 } = {}) {
  const key = process.env.HF_API_KEY;
  const model = HF_SUMMARIZE_MODEL();
  if (key) {
    try {
      const res = await withTimeout(fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: text,
          parameters: { max_length: maxLength, min_length: minLength, do_sample: false },
          options: { wait_for_model: true },
        }),
      }), TIMEOUT_MS, 'hf-summarize');
      if (res.ok) {
        const data = await res.json();
        const s = Array.isArray(data) ? data[0]?.summary_text || data[0]?.generated_text : data.summary_text;
        if (s) return { text: s.trim(), provider: 'huggingface', model };
      }
      const errText = await res.text().catch(() => '');
      logger.warn(`[summarize] ${res.status} ${errText.slice(0, 120)}`);
    } catch (e) {
      logger.warn(`[summarize] HF failed: ${e.message}`);
    }
  }
  // Local fallback — take the first 2-3 sentences
  const fallback = text.split(/[.!?]+\s/).slice(0, 3).join('. ').trim();
  return { text: fallback + (fallback.endsWith('.') ? '' : '.'), provider: 'local', model: 'truncate' };
}

/**
 * Classify sentiment (POS/NEU/NEG) using HF's cardiffnlp model (free).
 * Returns { label, score, provider }.
 */
export async function sentiment(text) {
  const key = process.env.HF_API_KEY;
  const model = HF_SENTIMENT_MODEL();
  if (!key) return localSentiment(text);
  try {
    const res = await withTimeout(fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
    }), TIMEOUT_MS, 'hf-sentiment');
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    // Response shape: [[{label: 'positive', score: 0.9}, {label:'neutral',...}, {label:'negative',...}]]
    const arr = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : data;
    const top = arr.sort((a, b) => b.score - a.score)[0];
    return { label: top.label.toLowerCase(), score: top.score, provider: 'huggingface', model };
  } catch (e) {
    logger.warn(`[sentiment] HF failed: ${e.message}`);
    return localSentiment(text);
  }
}

function localSentiment(text) {
  const pos = /(good|great|nice|save|gain|profit|growth|strong|ahead|up|positive)/i;
  const neg = /(bad|worse|loss|negative|debt|overdraft|behind|down|late|miss)/i;
  const p = (text.match(pos) || []).length;
  const n = (text.match(neg) || []).length;
  const label = p > n ? 'positive' : n > p ? 'negative' : 'neutral';
  return { label, score: 0.5, provider: 'local', model: 'keyword' };
}

/**
 * Embed one or more texts via HF's all-MiniLM-L6-v2 (free, 384-dim).
 * Returns { vectors: number[][], provider, model }.
 */
export async function embed(textsInput) {
  const texts = Array.isArray(textsInput) ? textsInput : [textsInput];
  const key = process.env.HF_API_KEY;
  const model = HF_EMBED_MODEL();
  if (key) {
    try {
      // Feature-extraction endpoint
      const res = await withTimeout(fetch(
        `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: texts, options: { wait_for_model: true } }),
        }), TIMEOUT_MS, 'hf-embed');
      if (res.ok) {
        const data = await res.json();
        // Response: number[][] for single, or number[][][] if batched oddly
        const vectors = Array.isArray(data[0]) && Array.isArray(data[0][0]) ? data.map((d) => d[0] || d) : data;
        return { vectors, provider: 'huggingface', model };
      }
      logger.warn(`[embed] HF ${res.status}`);
    } catch (e) {
      logger.warn(`[embed] HF failed: ${e.message}`);
    }
  }
  // Fallback: simple hashing projection to 128 dims — deterministic, bad but non-null
  const dims = 128;
  const hash = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
    return h >>> 0;
  };
  const vectors = texts.map((t) => {
    const v = new Array(dims).fill(0);
    for (const w of t.toLowerCase().split(/\W+/).filter(Boolean)) {
      v[hash(w) % dims] += 1;
    }
    // L2 normalize
    const mag = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
    return v.map((x) => x / mag);
  });
  return { vectors, provider: 'local', model: 'hash-128' };
}

/**
 * Cosine similarity between two vectors.
 */
export function cosineSim(a, b) {
  let dot = 0, ma = 0, mb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    ma += a[i] * a[i];
    mb += b[i] * b[i];
  }
  return dot / (Math.sqrt(ma) * Math.sqrt(mb) || 1);
}

export default { chat, availableProviders, providerDiagnostics, summarize, sentiment, embed, cosineSim };
