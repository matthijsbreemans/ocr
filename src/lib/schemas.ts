import { z } from 'zod';

/**
 * Parse a host as an IPv4 literal in any of the encodings inet_aton accepts
 * (decimal/hex/octal, and 1-, 2-, 3- or 4-part forms) and return the canonical
 * dotted-decimal string, or null if it isn't an IPv4 literal. This closes the
 * SSRF bypass where e.g. "2130706433", "0x7f000001", or "017700000001" all
 * denote 127.0.0.1 but evade naive string matching.
 */
function canonicalizeIpv4(host: string): string | null {
  const parsePart = (p: string): number | null => {
    if (p === '') return null;
    let n: number;
    if (/^0x[0-9a-f]+$/i.test(p)) n = parseInt(p, 16);
    else if (/^0[0-7]+$/.test(p)) n = parseInt(p, 8);
    else if (/^[0-9]+$/.test(p)) n = parseInt(p, 10);
    else return null;
    return Number.isNaN(n) ? null : n;
  };

  const parts = host.split('.');
  if (parts.length === 0 || parts.length > 4) return null;
  const nums: number[] = [];
  for (const p of parts) {
    const n = parsePart(p);
    if (n === null) return null;
    nums.push(n);
  }
  const last = nums.length - 1;
  for (let i = 0; i < last; i++) if (nums[i] > 255) return null; // leading parts are bytes
  const maxFinal = Math.pow(256, 4 - last) - 1; // final part fills the rest
  if (nums[last] > maxFinal) return null;

  let value = nums[last];
  for (let i = 0; i < last; i++) value += nums[i] * Math.pow(256, 3 - i);
  if (value < 0 || value > 0xffffffff) return null;
  value = value >>> 0;
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join('.');
}

/**
 * Check if a hostname is a private/internal address.
 * Covers IPv4 private ranges (in any encoding), IPv6 loopback/private,
 * IPv4-mapped IPv6, cloud metadata, and localhost variants.
 */
export function isPrivateHostname(hostname: string): boolean {
  let h = hostname.toLowerCase();

  // Normalize IPv4-mapped IPv6 (e.g. [::ffff:7f00:1] / ::ffff:127.0.0.1) and
  // any non-standard IPv4 encoding down to canonical dotted-decimal first.
  const bareForMap = h.replace(/^\[|\]$/g, '');
  const mapped = bareForMap.match(/^::ffff:(.+)$/i);
  if (mapped) {
    const suffix = mapped[1];
    const hexPair = suffix.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (hexPair) {
      const v = (parseInt(hexPair[1], 16) << 16) | parseInt(hexPair[2], 16);
      h = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join('.');
    } else {
      h = canonicalizeIpv4(suffix) || suffix;
    }
  } else {
    h = canonicalizeIpv4(bareForMap) || h;
  }

  // Exact blocked hostnames (localhost, IPv6 loopback variants)
  const blockedExact = new Set([
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '[::1]',
    '0:0:0:0:0:0:0:1',
    '[0:0:0:0:0:0:0:1]',
    '::ffff:127.0.0.1',
    '[::ffff:127.0.0.1]',
    '::ffff:0.0.0.0',
    '[::ffff:0.0.0.0]',
  ]);

  if (blockedExact.has(h)) return true;

  // Block entire 127.0.0.0/8 and 0.0.0.0/8 ranges
  if (/^127\./.test(h) || /^0\./.test(h)) return true;

  // Block RFC 1918 private ranges
  if (
    h.startsWith('192.168.') ||
    h.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)
  ) {
    return true;
  }

  // Block link-local (169.254.0.0/16) — also covers AWS metadata 169.254.169.254
  if (h.startsWith('169.254.')) return true;

  // Block cloud metadata hostnames
  if (
    h === 'metadata.google.internal' ||
    h === 'metadata' ||
    h.endsWith('.internal')
  ) {
    return true;
  }

  // Block IPv6 unique-local (fc00::/7) and link-local (fe80::/10)
  const bare = h.replace(/^\[|\]$/g, '');
  if (/^f[cd][0-9a-f]{2}:/i.test(bare) || /^fe[89ab][0-9a-f]:/i.test(bare)) {
    return true;
  }

  return false;
}

// Custom webhook URL validator to prevent SSRF attacks
const webhookUrlValidator = z
  .string()
  .url('Valid webhook URL required')
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);

        // Only allow http/https schemes
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return false;
        }

        return !isPrivateHostname(parsed.hostname);
      } catch {
        return false;
      }
    },
    {
      message: 'Webhook URL must not point to private/local networks.',
    }
  );

// Languages supported by the PaddleOCR engine (tesseract-style codes,
// mapped to PaddleOCR model names in paddle_ocr.py)
export const SUPPORTED_LANGUAGES = [
  { code: 'eng', label: 'English' },
  { code: 'fra', label: 'French' },
  { code: 'deu', label: 'German' },
  { code: 'spa', label: 'Spanish' },
  { code: 'ita', label: 'Italian' },
  { code: 'por', label: 'Portuguese' },
  { code: 'nld', label: 'Dutch' },
  { code: 'chi_sim', label: 'Chinese (Simplified)' },
  { code: 'chi_tra', label: 'Chinese (Traditional)' },
  { code: 'jpn', label: 'Japanese' },
  { code: 'kor', label: 'Korean' },
  { code: 'ara', label: 'Arabic' },
  { code: 'rus', label: 'Russian' },
] as const;

const languageCodes = SUPPORTED_LANGUAGES.map((l) => l.code) as [string, ...string[]];

export const OCR_MODES = [
  { value: 'auto', label: 'Auto' },
  { value: 'printed', label: 'Printed text' },
  { value: 'handwriting', label: 'Handwriting' },
] as const;

export const uploadSchema = z
  .object({
    documentType: z.string().min(1, 'Document type is required'),
    email: z.string().email('Valid email is required'),
    callbackWebhook: webhookUrlValidator.optional(),
    // When false, the OCR result is delivered to the webhook and never
    // persisted server-side (privacy mode). Coerces common boolean encodings;
    // anything unrecognized is REJECTED rather than silently defaulting to
    // store=true, so a malformed value can't quietly defeat the privacy opt-out.
    storeResult: z
      .preprocess((v) => {
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v !== 0;
        if (typeof v === 'string') {
          const s = v.trim().toLowerCase();
          if (['true', '1', 'yes', 'on'].includes(s)) return true;
          if (['false', '0', 'no', 'off'].includes(s)) return false;
        }
        return v; // unknown -> z.boolean() rejects (fail closed)
      }, z.boolean())
      .default(true),
    language: z.enum(languageCodes).default('eng'),
    ocrMode: z.enum(['auto', 'printed', 'handwriting']).default('auto'),
  })
  // A webhook is the only delivery channel when the result isn't stored, so it
  // becomes mandatory — otherwise the OCR output would be unreachable.
  .refine((data) => data.storeResult || !!data.callbackWebhook, {
    message: 'A callback webhook is required when not storing the OCR result.',
    path: ['callbackWebhook'],
  });

export type UploadRequest = z.infer<typeof uploadSchema>;

export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
  'image/bmp',
  'image/webp',
  'application/pdf',
] as const;

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
