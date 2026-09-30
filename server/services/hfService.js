/**
 * HuggingFace Inference API wrapper.
 *
 * Wraps the public HF Inference API (free tier, rate-limited).
 *   - OCR vision: TrOCR (printed text), Donut (CORD-finetuned receipt JSON)
 *   - Zero-shot classification: facebook/bart-large-mnli
 *   - Sentiment: cardiffnlp/twitter-roberta-base-sentiment-latest
 *   - Summarization: facebook/bart-large-cnn
 *   - Embeddings: sentence-transformers/all-MiniLM-L6-v2
 *   - Chat (LLM fallback): mistralai/Mistral-7B-Instruct-v0.3
 *
 * All calls share `withTimeout` and graceful failure: on error they throw a
 * short tagged Error so the caller can fall through to the next provider in
 * its chain, never crashing the request.
 */
import logger from '../utils/logger.js';

const HF_BASE = 'https://api-inference.huggingface.co/models';

const MODELS = {
  ocrPrinted: process.env.HF_OCR_PRINTED || 'microsoft/trocr-base-printed',
  ocrHandwritten: process.env.HF_OCR_HANDWRITTEN || 'microsoft/trocr-base-handwritten',
  donutReceipt: process.env.HF_DONUT_RECEIPT || 'naver-clova-ix/donut-base-finetuned-cord-v2',
  sentiment: process.env.HF_SENTIMENT_MODEL || 'cardiffnlp/twitter-roberta-base-sentiment-latest',
  zeroShot: process.env.HF_ZEROSHOT_MODEL || 'facebook/bart-large-mnli',
  summarize: process.env.HF_SUMMARIZE_MODEL || 'facebook/bart-large-cnn',
  embed: process.env.HF_EMBED_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
  chatPool: (process.env.HF_CHAT_MODELS || 'meta-llama/Llama-3.1-8B-Instruct:novita,openai/gpt-oss-20b:fireworks-ai,HuggingFaceH4/zephyr-7b-beta:featherless-ai')
    .split(',').map((s) => s.trim()).filter(Boolean),
};

function key() { return process.env.HF_API_KEY; }
export function isAvailable() { return !!key(); }
export function listModels() { return MODELS; }

async function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

async function callJSON(model, body, { timeoutMs = 25_000, label = 'hf' } = {}) {
  if (!key()) throw new Error('HF_API_KEY not configured');
  const res = await withTimeout(fetch(`${HF_BASE}/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key()}`,
      'Content-Type': 'application/json',
      'X-Wait-For-Model': 'true',
    },
    body: JSON.stringify(body),
  }), timeoutMs, label);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${label} ${res.status}: ${txt.slice(0, 160)}`);
  }
  return res.json();
}

async function callBinary(model, buffer, { mimeType = 'image/jpeg', timeoutMs = 30_000, label = 'hf-vision' } = {}) {
  if (!key()) throw new Error('HF_API_KEY not configured');
  const res = await withTimeout(fetch(`${HF_BASE}/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key()}`,
      'Content-Type': mimeType,
      'X-Wait-For-Model': 'true',
    },
    body: buffer,
  }), timeoutMs, label);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${label} ${res.status}: ${txt.slice(0, 160)}`);
  }
  // HF can return JSON or text depending on the task
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

/* ---------- OCR ---------- */

export async function ocrPrintedText(buffer, mimeType = 'image/jpeg') {
  const out = await callBinary(MODELS.ocrPrinted, buffer, { mimeType, label: 'hf-trocr' });
  // TrOCR returns: [{ generated_text: '...' }]
  if (Array.isArray(out) && out[0]?.generated_text) return out[0].generated_text;
  if (typeof out === 'string') return out;
  return '';
}

export async function ocrDonutReceipt(buffer, mimeType = 'image/jpeg') {
  const out = await callBinary(MODELS.donutReceipt, buffer, { mimeType, label: 'hf-donut', timeoutMs: 45_000 });
  // Donut CORD outputs CORD-style: { menu: [...], total: ... } sometimes wrapped
  if (Array.isArray(out) && out[0]?.generated_text) {
    return parseDonutString(out[0].generated_text);
  }
  if (typeof out === 'string') return parseDonutString(out);
  if (out && typeof out === 'object') return out;
  return null;
}

function parseDonutString(s) {
  // Donut emits a tag-soup string like: <s_menu><s_nm>Milk</s_nm><s_price>3.50</s_price></s_menu><s_total>11.48</s_total>
  if (!s) return null;
  const items = [];
  const itemRe = /<s_nm>([^<]+)<\/s_nm>\s*(?:<s_unitprice>[^<]*<\/s_unitprice>)?\s*(?:<s_cnt>[^<]*<\/s_cnt>)?\s*<s_price>([^<]+)<\/s_price>/g;
  let m;
  while ((m = itemRe.exec(s)) !== null) {
    items.push({ name: m[1].trim(), amount: Number(String(m[2]).replace(/[^\d.\-]/g, '')) || 0 });
  }
  const total = (s.match(/<s_total_price>([^<]+)<\/s_total_price>/) ||
                 s.match(/<s_total>([^<]+)<\/s_total>/))?.[1];
  const merchant = (s.match(/<s_nm>([^<]+)<\/s_nm>/) || [])[1] || null;
  const date = (s.match(/<s_date>([^<]+)<\/s_date>/) || [])[1] || null;
  return {
    merchant: merchant || 'Unknown',
    total: total ? Number(String(total).replace(/[^\d.\-]/g, '')) : null,
    date,
    items,
    raw: s,
  };
}

/* ---------- NLP utilities ---------- */

export async function classifyZeroShot(text, candidateLabels = []) {
  const out = await callJSON(MODELS.zeroShot, {
    inputs: text,
    parameters: { candidate_labels: candidateLabels, multi_label: false },
  }, { label: 'hf-zeroshot' });
  if (!out?.labels) return null;
  const top = out.labels[0];
  const score = out.scores?.[0] ?? 0;
  return { label: top, score, all: out.labels.map((l, i) => ({ label: l, score: out.scores[i] })) };
}

export async function sentiment(text) {
  const out = await callJSON(MODELS.sentiment, { inputs: text }, { label: 'hf-sentiment' });
  // [[ {label,score}, {label,score}, {label,score} ]] (nested)
  const flat = Array.isArray(out?.[0]) ? out[0] : out;
  if (!Array.isArray(flat)) return null;
  const top = flat.reduce((a, b) => (a.score > b.score ? a : b));
  return { label: top.label, score: top.score, all: flat };
}

export async function summarize(text, { max = 120, min = 30 } = {}) {
  const out = await callJSON(MODELS.summarize, {
    inputs: text,
    parameters: { max_length: max, min_length: min, do_sample: false },
  }, { label: 'hf-summarize', timeoutMs: 35_000 });
  if (Array.isArray(out) && out[0]?.summary_text) return out[0].summary_text;
  return null;
}

export async function embed(texts) {
  const inputs = Array.isArray(texts) ? texts : [texts];
  const out = await callJSON(MODELS.embed, { inputs }, { label: 'hf-embed' });
  return out;
}

/* ---------- LLM fallback chat ---------- */

export async function chat(messages, { maxTokens = 400, temperature = 0.4 } = {}) {
  if (!key()) throw new Error('HF_API_KEY not configured');
  const errs = [];
  for (const model of MODELS.chatPool) {
    try {
      const res = await withTimeout(fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
      }), 35_000, `hf-chat:${model.split('/').pop()}`);
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`${res.status}: ${txt.slice(0, 160)}`);
      }
      const out = await res.json();
      const text = out.choices?.[0]?.message?.content;
      if (text) return { text: text.trim(), provider: 'huggingface', model };
    } catch (e) {
      errs.push(`${model}:${e.message}`);
      logger.warn(`[hf-chat] ${model} failed`, e.message);
    }
  }
  throw new Error(`all hf chat models failed: ${errs.join(' | ')}`);
}

export default {
  isAvailable,
  listModels,
  ocrPrintedText,
  ocrDonutReceipt,
  classifyZeroShot,
  sentiment,
  summarize,
  embed,
  chat,
};
