import { GoogleGenAI } from '@google/genai';

// Initialize with Vertex AI
export const genai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
});

export const MODEL = 'gemini-1.5-flash';

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
