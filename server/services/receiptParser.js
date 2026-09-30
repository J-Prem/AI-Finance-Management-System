/**
 * Receipt parser — multimodal OCR + pattern extraction.
 *
 * Provider fallback chain (tries each in order, moves on on error/timeout):
 *   1. Gemini 1.5 Flash        — multimodal JSON mode, 1500 req/day free
 *   2. HuggingFace Donut       — CORD-finetuned receipt parser (structured)
 *   3. HuggingFace TrOCR       — raw OCR text, then regex parse
 *   4. OpenAI GPT-4o-mini      — optional paid fallback
 *   5. Regex on user-supplied text — always-on safety net
 *   6. Empty placeholder       — never lets the request fail
 *
 * Image preprocessing runs before the chain (`imagePreprocess.enhance`): it
 * auto-rotates, greyscales, stretches contrast and resizes when `sharp` is
 * installed, and no-ops otherwise. The OCR providers still handle their own
 * internal normalisation, so the preprocessing is purely additive.
 */
import logger from '../utils/logger.js';
import {
  validateMime, detectDimensions, qualityScore,
  clampBase64, enhance, base64ToBuffer, bufferToBase64,
} from './imagePreprocess.js';
import hf from './hfService.js';

/* --------------------------- category keywords --------------------------- */

const CATEGORY_KEYWORDS = {
  Groceries: ['market', 'grocery', 'whole foods', 'trader', 'costco', 'safeway', 'aldi', 'kroger', 'walmart', 'big bazaar', 'reliance fresh', 'dmart', 'spencer'],
  Dining: ['restaurant', 'cafe', 'starbucks', 'chipotle', 'bistro', 'diner', 'burger', 'pizza', 'taco', 'swiggy', 'zomato', 'dominos', 'mcdonald', 'kfc', 'subway', 'dunkin', 'chai'],
  Transport: ['uber', 'lyft', 'shell', 'chevron', 'bp ', 'exxon', 'metro', 'transit', 'gas', 'ola', 'rapido', 'petrol', 'diesel', 'fuel', 'indian oil', 'iocl', 'hpcl', 'bpcl'],
  Utilities: ['pg&e', 'comcast', 'at&t', 'water', 'electric', 'utility', 'internet', 'jio', 'airtel', 'bsnl', 'vi ', 'vodafone', 'tata power', 'bses', 'torrent power'],
  Entertainment: ['netflix', 'spotify', 'amc', 'cinema', 'steam', 'playstation', 'xbox', 'prime video', 'hotstar', 'pvr', 'inox', 'bookmyshow'],
  Shopping: ['amazon', 'target', 'best buy', 'nike', 'apparel', 'store', 'mall', 'flipkart', 'myntra', 'ajio', 'ikea', 'h&m', 'zara'],
  Healthcare: ['pharmacy', 'cvs', 'walgreens', 'hospital', 'clinic', 'dental', 'kaiser', 'apollo', '1mg', 'pharm', 'medplus', 'netmeds'],
  Subscriptions: ['monthly', 'subscription', 'membership', 'plan', 'renewal', 'auto-renew'],
  Travel: ['airlines', 'airways', 'hotel', 'booking.com', 'expedia', 'airbnb', 'makemytrip', 'goibibo', 'irctc', 'indigo', 'spicejet', 'vistara'],
  Education: ['school', 'college', 'university', 'tuition', 'coursera', 'udemy', 'byjus'],
};

export function categorizeMerchant(merchant = '', description = '') {
  const s = (merchant + ' ' + description).toLowerCase();
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some((k) => s.includes(k))) return cat;
  }
  return 'Other';
}

/* ------------------------------ regex parse ------------------------------ */

function regexParse(text) {
  const totalMatch = text.match(/(?:total|amount|grand\s+total|net\s+amount)\s*[:\-]?\s*(?:rs\.?|inr|₹|\$)?\s*(\d+(?:[.,]\d{1,2})?)/i);
  const dateMatch = text.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/) ||
                    text.match(/(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/);
  const currencyMatch = text.match(/\b(USD|EUR|GBP|INR|JPY|CAD|AUD)\b/i) ||
                        (text.includes('₹') ? [null, 'INR'] : null);
  const merchantMatch = text.split('\n').map((s) => s.trim()).filter(Boolean)[0] || 'Unknown Merchant';
  const itemLines = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(.{2,40}?)\s+(?:rs\.?|inr|₹|\$)?\s*(\d+[.,]\d{2})\s*$/i);
    if (m && !/total|subtotal|tax|tip|change|discount/i.test(m[1])) {
      itemLines.push({ name: m[1].trim(), amount: Number(m[2].replace(',', '.')) });
    }
  }
  return {
    merchant: merchantMatch.slice(0, 60),
    total: totalMatch ? Number(totalMatch[1].replace(',', '.')) : null,
    date: dateMatch ? dateMatch[1] : null,
    currency: currencyMatch ? String(currencyMatch[1]).toUpperCase() : null,
    items: itemLines,
  };
}

/* ------------------------------ providers ------------------------------ */

async function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function ocrGemini(base64, mimeType = 'image/jpeg') {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('no gemini key');
  const models = (process.env.GEMINI_MODELS || 'gemini-2.0-flash-exp,gemini-1.5-flash-latest,gemini-1.5-flash-8b-latest,gemini-1.5-pro-latest')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const prompt = [
    'You are an expert receipt-parsing OCR engine. Extract a JSON object from this receipt image.',
    'Output ONLY JSON, no markdown, no prose. Schema:',
    '{"merchant": string, "date": "YYYY-MM-DD", "total": number, "currency": string (ISO-4217), "items": [{"name": string, "amount": number, "quantity": number?}], "paymentMethod": string?, "tax": number?, "subtotal": number?}',
    'Rules: infer currency from symbols (₹ => INR, $ => USD). If a field is unreadable, omit it. No commentary.',
  ].join('\n');
  const errs = [];
  for (const model of models) {
    try {
      const res = await withTimeout(fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                { text: prompt },
                { inlineData: { mimeType, data: base64 } },
              ],
            }],
            generationConfig: { temperature: 0.0, responseMimeType: 'application/json' },
          }),
        }
      ), 25_000, `gemini-ocr:${model}`);
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`${res.status} ${t.slice(0, 140)}`);
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
      return { ...JSON.parse(text), _model: model };
    } catch (e) {
      errs.push(`${model}:${e.message}`);
    }
  }
  throw new Error(`all gemini models failed: ${errs.join(' | ')}`);
}

async function ocrHFDonut(buffer, mimeType) {
  const parsed = await hf.ocrDonutReceipt(buffer, mimeType);
  if (!parsed) throw new Error('donut empty');
  return parsed;
}

async function ocrHFTrocr(buffer, mimeType) {
  const text = await hf.ocrPrintedText(buffer, mimeType);
  if (!text) throw new Error('trocr empty');
  const parsed = regexParse(text);
  return { ...parsed, _rawText: text };
}

async function ocrOpenAI(base64, mimeType = 'image/jpeg') {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('no openai key');
  const res = await withTimeout(fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Extract receipt fields as strict JSON: merchant, date (YYYY-MM-DD), total (number), currency, items[{name,amount,quantity?}], tax?, subtotal?, paymentMethod?.' },
        { role: 'user', content: [
          { type: 'text', text: 'Parse this receipt to JSON.' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ]},
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    }),
  }), 20_000, 'openai-ocr');
  if (!res.ok) throw new Error(`openai ocr ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices?.[0]?.message?.content || '{}');
}

/* ------------------------------ HF-assisted category ------------------------------ */

async function hfReclassify(parsed) {
  // Zero-shot category refinement when the keyword match returns 'Other'.
  if (!hf.isAvailable()) return null;
  const labels = Object.keys(CATEGORY_KEYWORDS);
  const text = `Merchant: ${parsed.merchant || 'Unknown'}. Items: ${
    (parsed.items || []).slice(0, 10).map((i) => i.name).join(', ')
  }`;
  try {
    const r = await hf.classifyZeroShot(text, labels);
    if (r && r.score > 0.4) return { category: r.label, score: r.score };
  } catch (e) {
    logger.warn('[receipt] hf zero-shot reclassify failed', e.message);
  }
  return null;
}

/* ------------------------------ public API ------------------------------ */

/**
 * Parse a receipt.
 * Input: { text?, imageBase64?, mimeType? }
 * Output: {
 *   merchant, date, total, currency, items[], category, confidence,
 *   provider, errors[], quality, dims, model?, tax?, subtotal?, paymentMethod?
 * }
 */
export async function parseReceipt({ text, imageBase64, mimeType }) {
  let parsed = null;
  let provider = 'fallback';
  let model = null;
  const errors = [];
  let quality = 0;
  let dims = null;
  let imageProcessing = null;

  // ---- preprocess ----
  let buffer = null;
  if (imageBase64) {
    const mimeCheck = validateMime(mimeType);
    if (!mimeCheck.ok) errors.push(`mime:${mimeCheck.reason}`);
    imageBase64 = clampBase64(imageBase64);
    buffer = base64ToBuffer(imageBase64);
    const originalBytes = buffer?.length || 0;
    dims = detectDimensions(buffer);
    quality = qualityScore(buffer, mimeType);
    // Best-effort enhance (no-op if sharp missing)
    try {
      const enhanced = await enhance(buffer);
      if (enhanced && enhanced !== buffer) {
        buffer = enhanced;
        imageBase64 = bufferToBase64(enhanced);
      }
    } catch (e) {
      errors.push(`enhance:${e.message}`);
    }
    imageProcessing = {
      originalBytes,
      processedBytes: buffer?.length || originalBytes,
      enhanced: (buffer?.length || 0) !== originalBytes,
      mimeValid: mimeCheck.ok,
      mimeReason: mimeCheck.reason || null,
    };
  }

  // ---- provider chain ----
  if (buffer) {
    const providers = [
      ['gemini', async () => ocrGemini(imageBase64, mimeType)],
      ['hf-donut', async () => ocrHFDonut(buffer, mimeType)],
      ['hf-trocr', async () => ocrHFTrocr(buffer, mimeType)],
      ['openai', async () => ocrOpenAI(imageBase64, mimeType)],
    ];
    for (const [name, fn] of providers) {
      try {
        const out = await fn();
        if (out && (out.total != null || (out.items && out.items.length) || out.merchant)) {
          parsed = out;
          provider = name;
          model = out._model || null;
          break;
        }
      } catch (e) {
        errors.push(`${name}:${e.message}`);
      }
    }
  }

  if (!parsed && text) {
    parsed = regexParse(text);
    provider = 'regex';
  }

  if (!parsed) {
    parsed = { merchant: 'Unknown', total: 0, date: null, items: [] };
    provider = 'empty';
  }

  // ---- category ----
  let category = categorizeMerchant(parsed.merchant, JSON.stringify(parsed.items || []));
  let categorySource = 'keyword';
  let categoryScore = category === 'Other' ? 0.2 : 0.85;
  if (category === 'Other') {
    const hfCat = await hfReclassify(parsed);
    if (hfCat) {
      category = hfCat.category;
      categorySource = 'hf-zeroshot';
      categoryScore = hfCat.score;
    }
  }

  const confidence = (
    provider === 'gemini' ? 0.94 :
    provider === 'hf-donut' ? 0.88 :
    provider === 'openai' ? 0.92 :
    provider === 'hf-trocr' ? 0.72 :
    provider === 'regex' ? 0.6 : 0.2
  );

  return {
    merchant: parsed.merchant || 'Unknown',
    date: parsed.date || new Date().toISOString().slice(0, 10),
    total: Number(parsed.total) || 0,
    currency: parsed.currency || 'USD',
    items: Array.isArray(parsed.items) ? parsed.items : [],
    category,
    categorySource,
    categoryScore: +Number(categoryScore).toFixed(3),
    confidence,
    provider,
    model,
    tax: parsed.tax ?? null,
    subtotal: parsed.subtotal ?? null,
    paymentMethod: parsed.paymentMethod ?? null,
    quality,
    dims,
    imageProcessing,
    rawText: parsed._rawText || text || parsed.raw || null,
    errors,
  };
}

export default { parseReceipt, categorizeMerchant };
