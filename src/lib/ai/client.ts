import { GoogleGenAI } from '@google/genai';

const useVertexAI = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';

// Initialize based on environment flag
export const genai = useVertexAI 
  ? new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    })
  : new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Models configured by task.
// NOTE: gemini-2.5-pro has a 0-request/day free-tier quota, so we default
// every task to gemini-2.5-flash (which has a generous free quota: 10 RPM /
// 250 RPD / 250k TPM). Override per-task via env vars if you have a paid plan.
export const MODELS = {
  extraction: process.env.GEMINI_MODEL_EXTRACTION || 'gemini-3-flash-preview',
  routing: process.env.GEMINI_MODEL_ROUTING || 'gemini-3-flash-preview',
  vision: process.env.GEMINI_MODEL_VISION || 'gemini-3-flash-preview',
  embeddings: process.env.GEMINI_MODEL_EMBEDDINGS || 'text-embedding-004',
};

// Ordered fallback chain for quota / 5xx retries — tried left-to-right.
export const MODEL_FALLBACKS: Record<string, string[]> = {
  [MODELS.extraction]: ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'],
  [MODELS.routing]: ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'],
  [MODELS.vision]: ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash'],
};

// Default fallback for legacy endpoints
export const MODEL = MODELS.routing;

type GenParams = Parameters<typeof genai.models.generateContent>[0];

/**
 * Wrapper around `genai.models.generateContent` that retries on quota /
 * transient errors and transparently falls back to alternate models defined
 * in `MODEL_FALLBACKS`. Returns the first successful response.
 */
export async function generateContentWithFallback(params: GenParams) {
  const primary = params.model;
  const chain = [primary, ...(MODEL_FALLBACKS[primary] ?? [])].filter(
    (m, i, arr) => arr.indexOf(m) === i,
  );
  let lastErr: unknown;
  for (const model of chain) {
    try {
      return await genai.models.generateContent({ ...params, model });
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isQuota = /RESOURCE_EXHAUSTED|429|quota/i.test(msg);
      const isTransient = /5\d\d|UNAVAILABLE|DEADLINE_EXCEEDED/i.test(msg);
      if (!isQuota && !isTransient) throw err;
      // try next model in chain
    }
  }
  throw lastErr;
}

/**
 * Extract and parse JSON from Gemini response text.
 * Handles markdown code blocks, thought signatures, and raw JSON.
 */
export function parseJsonResponse(text: string): unknown {
  // Helper: fix common JSON issues from LLM output
  function tryParse(s: string): unknown {
    // First try as-is
    try { return JSON.parse(s); } catch { /* continue */ }
    // Escape unescaped newlines/tabs inside JSON string values
    const fixed = s.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"|([^"]+)/g, (match, strContent) => {
      if (strContent !== undefined) {
        // Inside a quoted string — escape literal newlines
        return '"' + strContent.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
      }
      return match;
    });
    try { return JSON.parse(fixed); } catch { /* continue */ }
    // Last resort: collapse all whitespace
    const collapsed = s.replace(/\s+/g, ' ');
    return JSON.parse(collapsed);
  }

  // 1. Try extracting from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try { return tryParse(codeBlockMatch[1].trim()); } catch { /* fall through */ }
  }
  // 2. Try finding first { or [ and matching to last } or ]
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let start = -1;
  let end = -1;
  if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) {
    start = firstBrace;
    end = text.lastIndexOf('}');
  } else if (firstBracket >= 0) {
    start = firstBracket;
    end = text.lastIndexOf(']');
  }
  if (start >= 0 && end > start) {
    try { return tryParse(text.substring(start, end + 1)); } catch { /* fall through */ }
  }
  // 3. Try the whole string
  return tryParse(text.trim());
}
