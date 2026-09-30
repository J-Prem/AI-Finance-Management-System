/**
 * Lightweight image preprocessing utilities (pure Node, no native deps).
 *
 * We cannot install `sharp` in the sandbox (npm blocked), so this module
 * focuses on what we *can* do with only the core buffer:
 *   - Validate MIME types
 *   - Detect apparent image dimensions (PNG / JPEG header parsing)
 *   - Clamp oversized base64 payloads before sending to OCR APIs
 *   - Compute a cheap "quality score" (byte density, header validity)
 *
 * The OCR providers (Gemini, HuggingFace TrOCR/Donut, OpenAI) handle
 * resize / denoise / contrast enhancement server-side, so dropping sharp
 * only hurts extreme edge cases. When `sharp` becomes installable the
 * `enhance()` function auto-upgrades (see the dynamic import below).
 */
import logger from '../utils/logger.js';

const SUPPORTED_MIMES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/heic', 'image/heif', 'image/tiff', 'image/bmp',
  'application/pdf',
]);

const MAX_BASE64_CHARS = 8 * 1024 * 1024; // ~6 MB raw — Gemini cap is 20MB, HF is 10

export function validateMime(mimeType) {
  if (!mimeType) return { ok: false, reason: 'missing mimeType' };
  const m = mimeType.toLowerCase();
  if (!SUPPORTED_MIMES.has(m)) return { ok: false, reason: `unsupported: ${m}` };
  return { ok: true };
}

/**
 * Parse the width/height from PNG / JPEG buffer headers.
 * Returns null if the format isn't recognised — which is safe, we just skip.
 */
export function detectDimensions(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) return null;

  // PNG: bytes 0..7 = signature, 16..23 = IHDR width/height (big-endian)
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), format: 'png' };
  }

  // JPEG: 0xFFD8, scan for SOF0/SOF2 marker
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let offset = 2;
    while (offset < buf.length - 1) {
      if (buf[offset] !== 0xFF) { offset += 1; continue; }
      const marker = buf[offset + 1];
      const segLen = buf.readUInt16BE(offset + 2);
      if (marker === 0xC0 || marker === 0xC2) {
        // SOF: bytes [offset+5..+6] = height, [offset+7..+8] = width
        return {
          height: buf.readUInt16BE(offset + 5),
          width: buf.readUInt16BE(offset + 7),
          format: 'jpeg',
        };
      }
      offset += 2 + segLen;
    }
  }

  // WEBP: 'RIFF'....'WEBP'
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') {
    return { width: null, height: null, format: 'webp' };
  }

  return null;
}

export function qualityScore(buf, mimeType) {
  if (!Buffer.isBuffer(buf)) return 0;
  const dims = detectDimensions(buf) || {};
  const bytes = buf.length;
  let score = 0.2;
  if (dims.width && dims.height) {
    const pixels = dims.width * dims.height;
    if (pixels > 800 * 600) score += 0.4;
    else if (pixels > 400 * 300) score += 0.25;
    else score += 0.05;
    const density = bytes / pixels;
    if (density > 0.5 && density < 4) score += 0.2; // heuristically decent
  } else if (bytes > 100_000) {
    score += 0.3;
  }
  if (mimeType?.includes('pdf')) score += 0.1;
  return Math.min(1, +score.toFixed(2));
}

export function clampBase64(base64) {
  if (!base64) return base64;
  if (base64.length <= MAX_BASE64_CHARS) return base64;
  logger.warn(`[preprocess] clamping base64 payload from ${base64.length} to ${MAX_BASE64_CHARS} chars`);
  return base64.slice(0, MAX_BASE64_CHARS);
}

/**
 * Best-effort enhancement: if `sharp` is present, auto-rotate + greyscale +
 * linear stretch + resize. Otherwise return the input unchanged. We *never*
 * throw here — failure just means we send the original bytes downstream.
 */
let _sharp = null;
let _sharpLoaded = false;
async function loadSharp() {
  if (_sharpLoaded) return _sharp;
  _sharpLoaded = true;
  try {
    const mod = await import('sharp');
    _sharp = mod.default || mod;
    logger.info('[preprocess] sharp loaded — full preprocessing enabled');
  } catch {
    logger.info('[preprocess] sharp not installed — using passthrough preprocessing');
  }
  return _sharp;
}

export async function enhance(buffer, { maxWidth = 1800 } = {}) {
  const sharp = await loadSharp();
  if (!sharp || !Buffer.isBuffer(buffer)) return buffer;
  try {
    return await sharp(buffer)
      .rotate() // auto-orient via EXIF
      .greyscale()
      .normalise() // linear stretch -> contrast
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (e) {
    logger.warn('[preprocess] sharp enhance failed — using original', e.message);
    return buffer;
  }
}

export function base64ToBuffer(b64) {
  try { return Buffer.from(b64, 'base64'); } catch { return null; }
}

export function bufferToBase64(buf) {
  return Buffer.isBuffer(buf) ? buf.toString('base64') : buf;
}

export default {
  validateMime,
  detectDimensions,
  qualityScore,
  clampBase64,
  enhance,
  base64ToBuffer,
  bufferToBase64,
};
